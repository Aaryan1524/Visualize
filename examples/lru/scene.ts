import { defineScene } from "../../src/core/scene.ts";
import type { Mark, Observation, Scene, Vec3 } from "../../src/core/types.ts";
import { railAssembly, cartridge, RAIL_CELL, RAIL_PITCH } from "../../src/parts/rail.ts";
import { strip, totals, type StripItem } from "../../src/render/components.ts";
import { fifoContrast, fifoHits, initial, optimalHits, run, runFifo, type GetEvent, type LruState } from "./model.ts";

export const CAPACITY = 3;
/**
 * Chosen so the run shows cold misses, a hit that refreshes recency, an
 * eviction where LRU and FIFO disagree, and a later hit on a refreshed key.
 */
export const REQUESTS = ["A", "B", "C", "A", "D", "B", "A", "E", "B"];
/** LRU's weak case: a loop over one more key than the cache holds. */
export const LOOP_KEYS = Array.from({ length: CAPACITY + 1 }, (_, i) => String.fromCharCode(65 + i));
const LOOP = [...LOOP_KEYS, ...LOOP_KEYS, ...LOOP_KEYS];

type Step = { state: LruState; event: GetEvent };
/** When a key requested at `index` was last evicted, and the step that loaded it back (steps count from 1). */
function returned(steps: Step[], index: number, key: string): { out: number; back: number } | null {
  const out = steps.slice(0, index).map((st) => st.event.evicted).lastIndexOf(key);
  if (out < 0) return null;
  const back = steps.findIndex((st, j) => j > out && j <= index && st.event.key === key);
  return back < 0 ? null : { out: out + 1, back: back + 1 };
}

// The rail carries recency, not insertion time. Every decorative part belongs
// to a slot, its guide, or the request belt; all entries remain model entities.
const PITCH = RAIL_PITCH;
const BLOCK: Vec3 = RAIL_CELL;
const TRAY_Z = 3;
const QUEUE_PITCH = 20;
const QUEUE_SHOWN = 6;
const railEnd = (CAPACITY - 1) * PITCH + BLOCK[0];

function viewFor(flat: boolean) {

  const queue = (j: number): Vec3 => flat ? [j*QUEUE_PITCH,0,-35] : [j*QUEUE_PITCH,53,-2];
  return (s: LruState, e: GetEvent | null): Mark[] => {
    // The rail is a recency ranking, not storage, so its places carry no numbers.
    const rail = railAssembly({key: "", slots: s.capacity, flat, slotLabel: null});
    const marks: Mark[] = [...rail.marks];
    // Entries sit against the most-recent end: a new key always enters there, and free room is at the cold end.
    const free = s.capacity - s.order.length;
    s.order.forEach((key,i) => {
      const accessed=e?.key===key;
      marks.push(cartridge({key:`entry-${key}`,at:rail.slot(free+i),size:BLOCK,
        tone:accessed ? (e!.result==="hit" ? "good" : "accent") : "subject",
        lit:accessed,label:key,link:`key-${key}`,enter:"drop",
        title:`${key}, ${i===s.order.length-1 ? "most recently used" : i===0 ? "least recently used" : "middle of recency order"}`,
        ...(accessed && e!.result==="hit" ? {arc:BLOCK[2]*2.3} : {}),
      }));
    });
    if (e?.evicted) marks.push(cartridge({key:`entry-${e.evicted}`,at:[-35,0,TRAY_Z],size:BLOCK,tone:"bad",label:e.evicted,leaving:true}));
    if (s.served < s.requests.length) {
      marks.push({kind:"box",key:"belt",at:flat ? [-3,0,-38] : [-3,50,-5],size:[(QUEUE_SHOWN-1)*QUEUE_PITCH+20,flat ? 16 : 20,3],radius:3,tone:"base",inset:true});
      for (let j=0;j<QUEUE_SHOWN;j++) {
        const index=s.served+j,key=s.requests[index];
        if (key===undefined) break;
        marks.push({kind:"box",key:`req-${index}`,at:queue(j),size:[14,14,flat ? 12 : 5],radius:1.5,tone:j===0 ? "structure" : "muted",label:key,link:`key-${key}`,enter:"fade"});
      }
      const left=s.requests.length-s.served;
      marks.push({kind:"label",key:"next",at:flat ? [0,0,-53] : [55,94,-5],text:left>QUEUE_SHOWN ? `Next ${QUEUE_SHOWN} of ${left} requests` : "Upcoming requests",size:"small"});
    }
    if (e && !flat) marks.push({kind:"box",key:`req-${e.index}`,at:flat ? [0,0,-22] : [0,38,18],size:[14,14,flat ? 12 : 5],radius:1.5,tone:"structure",label:e.key,leaving:true});
    marks.push(
      {kind:"label",key:"cold",at:flat ? [-8,0,12] : [-12,24,13],text:"Least recent",anchor:"end",size:"small",target:rail.anchor.first},
      {kind:"label",key:"fresh",at:flat ? [railEnd+8,0,12] : [railEnd+20,25,3],text:"Most recent",anchor:"start",size:"small",target:rail.anchor.last},
    );

    return marks;
  };
}

function caption(prev: LruState, e: GetEvent, steps: Step[], fifo: Map<number, string>): string {
  const k = e.key;
  const fifoHit = runFifo(CAPACITY, REQUESTS)[e.index]!.before.includes(k);
  if (e.result === "hit") {
    const older = prev.order.slice(e.from! + 1);
    const back = returned(steps, e.index, k);
    return (older.length
      ? `get(${k}): a hit. ${k} moves to the most-recent end, so ${older.join(" and ")} each become one place older.`
      : `get(${k}): a hit. ${k} is already the most recent, so nothing moves.`)
      + (back ? ` ${k} was evicted at step ${back.out} and reloaded at step ${back.back}.` : "")
      + (fifoHit ? "" : " FIFO, run on the same requests, would have missed here.");
  }
  if (!e.evicted) return `get(${k}): not cached, a miss. ${k} is loaded and stored at the most-recent end; ${prev.order.length + 1} of ${prev.capacity} slots used.`;
  // Only claimed where a FIFO cache, run on the same requests, holds the same keys and evicts differently.
  const other = fifo.get(e.index);
  const contrast = other ? ` A first-in-first-out (FIFO) cache holding the same keys would have dropped ${other}, which was stored first but used since.` : "";
  // Where LRU's choice costs it: the key it evicted on the last request comes straight back, and FIFO kept it.
  const lost = e.index > 0 && steps[e.index - 1]!.event.evicted === k && fifoHit
    ? ` ${k} was evicted one request ago, so here LRU's bet that recent use predicts the next use loses: FIFO, which kept ${k}, would have hit.`
    : "";
  return `get(${k}): a miss with the cache full. ${e.evicted} has gone longest without being used, so it is evicted to make room.${contrast}${lost}`;
}

/** The run's totals, set against FIFO, the optimum and LRU's weak case, all from the model. */
function summary(last: LruState): string {
  const n = last.requests.length;
  return `LRU tracks the last use, not the first arrival. This run ends with ${last.hits} hits, ${last.misses} misses and ${last.evictions} evictions, a hit rate of ${last.hits} in ${n} (${Math.round(100 * last.hits / n)}%). `
    + `FIFO gets ${fifoHits(CAPACITY, REQUESTS)} hits on the same requests, and Belady's optimal policy, which evicts the key needed furthest ahead, gets ${optimalHits(CAPACITY, REQUESTS)}. `
    + `LRU's weak case is a loop over more keys than it holds: cycling ${LOOP_KEYS.length} keys through ${CAPACITY} slots misses every time, because each eviction removes the key needed next.`;
}

function panels(s: LruState) {
  const items: StripItem[] = s.requests.map((key, i) => {
    const result = s.results[i];
    return {
      label: key,
      link: `key-${key}`,
      ...(result ? { note: result, status: result === "hit" ? "good" : "accent" } : i === s.served ? { note: "next", status: "next" } : { status: "waiting" }),
    } as StripItem;
  });
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  return [{
    key: "requests",
    title: "Requests",
    html: strip(items) + totals([
      { value: String(s.hits), label: plural(s.hits, "hit", "hits"), key: "hits" },
      { value: String(s.misses), label: plural(s.misses, "miss", "misses"), key: "misses" },
      { value: String(s.evictions), label: plural(s.evictions, "eviction", "evictions"), key: "evictions" },
    ]),
  }];
}

function teaching(s: LruState, e: GetEvent | null, index: number) {
  if (index===0) return {chapter:"Fill",heading:"Fill the three slots."};
  if (index===REQUESTS.length) return {chapter:"Remember",heading:e?.result==="hit" ? `${e.key} is a hit. The run ends.` : "The run ends."};
  if (index===4) return {chapter:"Refresh",heading:"A moves to most recent.",prediction:{
    question:"D is next. Which key leaves?",
    choices:["A","B","C"],answer:s.order[0]!,
    explanation:`${s.order[0]} was used least recently.`,
  }};
  if (index<4) return {chapter:"Fill",heading:index === CAPACITY && e?.key ? `${e.key} fills the last slot. Cache full.` : e?.key ? `${e.key} takes an empty slot.` : "Fill the three slots."};
  return {chapter:"Evict",heading:e?.evicted ? `${e.evicted} leaves. ${e.key} enters.` : `${e?.key} moves to most recent.`};
}

function observe(s: LruState, e: GetEvent | null): Observation[] {
  const obs: Observation[] = [
    { type: "text", key: "hits", equals: String(s.hits) },
    { type: "text", key: "misses", equals: String(s.misses) },
    { type: "text", key: "evictions", equals: String(s.evictions) },
    ...s.order.map((k) => ({ type: "text" as const, key: `entry-${k}`, equals: k })),
    ...s.order.map((k) => ({ type: "visible" as const, key: `entry-${k}`, visible: true })),
    ...s.order.map((k) => ({ type: "extent" as const, key: `entry-${k}`, size: BLOCK, radius: 2 })),
  ];
  if (s.order.length > 1) obs.push({ type: "order", keys: s.order.map((k) => `entry-${k}`), axis: "x" });
  if (e?.evicted) obs.push({ type: "visible", key: `entry-${e.evicted}`, visible: false });
  if (e) obs.push({ type: "lit", key: `entry-${e.key}` });
  if (e) obs.push({ type: "tone", key: `entry-${e.key}`, equals: e.result === "hit" ? "good" : "accent" });
  const next = s.requests[s.served];
  if (next) obs.push({ type: "text", key: `req-${s.served}`, equals: next });
  return obs;
}

/**
 * Now you try: a fresh request history, run through the same model. The
 * question only appears when the next request would evict, so there is
 * always one right answer, and the model says which.
 */
export function practice(seed: number) {
  let x = seed * 2654435761 % 4294967296 || 1;
  const rand = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (;;) {
    const keys = ["A", "B", "C", "D", "E"];
    const history = Array.from({ length: 5 + Math.floor(rand() * 3) }, () => keys[Math.floor(rand() * keys.length)]!);
    const before = run(CAPACITY, history).steps.at(-1)?.state;
    if (!before || before.order.length < CAPACITY) continue;
    const next = keys.find((k) => !before.order.includes(k) && rand() < 0.7) ?? keys.find((k) => !before.order.includes(k));
    if (!next) continue;
    const evicted = run(CAPACITY, [...history, next]).steps.at(-1)!.event.evicted!;
    return {
      question: `A ${CAPACITY}-slot cache starts empty. Requests so far: ${history.join(" ")}. Next comes ${next}. Which key leaves?`,
      choices: [...before.order].sort(),
      answer: evicted,
      explanation: `Of ${before.order.join(", ")}, ${evicted} was used least recently.`,
    };
  }
}

function makeScene(flat: boolean): Scene<LruState, GetEvent> {
  return defineScene<LruState, GetEvent>({
    id: flat ? "lru-flat" : "lru",
    title: flat ? "LRU cache (flat)" : "LRU cache",
    question: "Why not drop the oldest?",
    presentation: "editorial",
    practice,
    setup: "The first key stored can still be the one you need. Follow each request, then decide what deserves to stay.",
    teaching,
    trust: "computed",
    projection: flat ? "front" : "iso",
    assumptions: [
      `The cache holds ${CAPACITY} entries, all the same size; only keys are shown, not values.`,
      "Recency is updated on every access, hit or miss, as in a textbook LRU. Many production caches approximate it (sampled LRU, CLOCK) to avoid that bookkeeping.",
      "Loading a missing key is shown as instant; in practice it is the slow path the cache exists to avoid.",
      "Not shown: how a real cache finds and reorders a key in constant time, with a hash map and a doubly linked list. The rail is that list's recency order, not storage: a hit relinks the entry and copies no data.",
    ],
    trace: () => {
      const { steps } = run(CAPACITY, REQUESTS);
      const fifo = fifoContrast(CAPACITY, REQUESTS);
      const start = initial(CAPACITY, REQUESTS);
      return {
        initial: start,
        intro: `An empty cache with room for ${CAPACITY} entries, and ${REQUESTS.length} requests waiting. Entries are kept in order of last use: least recent at the left.`,
        steps: steps.map(({ state, event }, i) => ({
          event,
          state,
          caption: caption(i === 0 ? start : steps[i - 1]!.state, event, steps, fifo) + (i === steps.length - 1 ? ` ${summary(state)}` : ""),
        })),
      };
    },
    view: viewFor(flat),
    panels,
    observe,
    readout: (s) => `${s.order.length} of ${s.capacity} slots occupied`,
    timing: (e) => ({ duration: e.evicted ? 1600 : e.result === "hit" ? 1300 : 1100 }),
    legend: [
      { tone: "subject", label: "Cached entry" },
      { tone: "good", label: "Hit: found in the cache" },
      { tone: "accent", label: "Miss: loaded and stored" },
      { tone: "bad", label: "Evicted" },
      { tone: "muted", label: "Waiting request" },
    ],
  });
}

export const variants = { lru: makeScene(false), "lru-flat": makeScene(true) };
export default variants.lru;

// The correctness audit (SKILL.md, Correctness): what the page says, checked like the picture.
const RUN = run(CAPACITY, REQUESTS);
const LAST = RUN.steps.at(-1)!.state;
const at = (k: number) => RUN.steps[k - 1]!;
const FIFO_RUN = runFifo(CAPACITY, REQUESTS);
const LOOP_RUN = run(CAPACITY, LOOP);
const BACK = returned(RUN.steps, REQUESTS.length - 1, REQUESTS.at(-1)!)!;
export const audit = {
  models: [RUN, { capacity: CAPACITY, requests: REQUESTS.length }],
  // numbers the text states: slots used as the cache fills, the run's totals and hit rate, FIFO's
  // and the optimum's hits, when the last key was evicted and reloaded, and the loop's size
  facts: [...Array(CAPACITY).keys()].map((i) => i + 1).concat([
    LAST.hits, LAST.misses, LAST.evictions, LAST.hits / REQUESTS.length,
    fifoHits(CAPACITY, REQUESTS), optimalHits(CAPACITY, REQUESTS), BACK.out, BACK.back, LOOP_KEYS.length,
  ]),
  claims: [
    { text: "A moves to the most-recent end, so B and C each become one place older", test: () => at(4).event.result === "hit" && at(4).state.order.join("") === "BCA" },
    { text: "B has gone longest without being used, so it is evicted to make room", test: () => at(5).event.evicted === "B" && at(4).state.order[0] === "B" },
    { text: "A first-in-first-out (FIFO) cache holding the same keys would have dropped A, which was stored first but used since", test: () => fifoContrast(CAPACITY, REQUESTS).get(4) === "A" },
    { text: "B was used least recently", test: () => at(4).state.order[0] === "B" },
    { text: "B was evicted one request ago, so here LRU's bet that recent use predicts the next use loses: FIFO, which kept B, would have hit", test: () => at(5).event.evicted === "B" && at(6).event.key === "B" && at(6).event.result === "miss" && FIFO_RUN[5]!.before.includes("B") },
    { text: "FIFO, run on the same requests, would have missed here", test: () => [7, 9].every((k) => at(k).event.result === "hit" && !FIFO_RUN[k - 1]!.before.includes(at(k).event.key)) },
    { text: "B was evicted at step 5 and reloaded at step 6", test: () => at(5).event.evicted === "B" && at(6).event.key === "B" && at(9).event.key === "B" && at(9).event.result === "hit" },
    { text: "This run ends with 3 hits, 6 misses and 3 evictions, a hit rate of 3 in 9 (33%)", test: () => LAST.hits === 3 && LAST.misses === 6 && LAST.evictions === 3 && REQUESTS.length === 9 },
    { text: "FIFO gets 2 hits on the same requests, and Belady's optimal policy, which evicts the key needed furthest ahead, gets 4", test: () => fifoHits(CAPACITY, REQUESTS) === 2 && optimalHits(CAPACITY, REQUESTS) === 4 },
    { text: "cycling 4 keys through 3 slots misses every time, because each eviction removes the key needed next", test: () => LOOP_KEYS.length === 4 && CAPACITY === 3 && LOOP_RUN.steps.every((st) => st.event.result === "miss") && LOOP_RUN.steps.every((st, i) => !st.event.evicted || i + 1 === LOOP.length || LOOP[i + 1] === st.event.evicted) && LOOP_RUN.steps.some((st) => st.event.evicted) },
  ],
  coverage: {
    source: "Wikipedia, Cache replacement policies (Least recently used, Bélády's algorithm); Cormen et al. style course notes on LRU caches",
    topics: [
      { topic: "a miss loads the key into a free slot", where: "step:1" },
      { topic: "a hit refreshes the key's recency", where: "step:4" },
      { topic: "a full-cache miss evicts the least recently used", where: "step:5" },
      { topic: "how LRU differs from FIFO", where: "step:5" },
      { topic: "LRU can lose: an evicted key requested again at once", where: "step:6" },
      { topic: "hits, misses and the hit rate", where: "step:9" },
      { topic: "Belady's optimal policy as the benchmark", where: "step:9" },
      { topic: "LRU's weak case: a loop over more keys than the cache holds", where: "step:9" },
      { topic: "a hash map and a doubly linked list", where: "deferred", why: "the page shows the policy, not its data structure; Details names it" },
    ],
  },
};
