import { defineScene } from "../../src/core/scene.ts";
import type { Mark, Observation, Scene, Vec3 } from "../../src/core/types.ts";
import { railAssembly, cartridge, RAIL_CELL, RAIL_PITCH } from "../../src/parts/rail.ts";
import { strip, totals, type StripItem } from "../../src/render/components.ts";
import { fifoContrast, initial, run, type GetEvent, type LruState } from "./model.ts";

export const CAPACITY = 3;
/**
 * Chosen so the run shows cold misses, a hit that refreshes recency, an
 * eviction where LRU and FIFO disagree, and a later hit on a refreshed key.
 */
export const REQUESTS = ["A", "B", "C", "A", "D", "B", "A", "E", "B"];

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
    const rail = railAssembly({key: "", slots: s.capacity, flat});
    const marks: Mark[] = [...rail.marks];
    s.order.forEach((key,i) => {
      const accessed=e?.key===key;
      marks.push(cartridge({key:`entry-${key}`,at:rail.slot(i),size:BLOCK,
        tone:accessed ? (e!.result==="hit" ? "good" : "accent") : "subject",
        lit:accessed,label:key,link:`key-${key}`,enter:"drop",
        title:`${key}, ${i===0 ? "least recently used" : i===s.order.length-1 ? "most recently used" : "middle of recency order"}`,
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
      marks.push({kind:"label",key:"next",at:flat ? [0,0,-53] : [55,94,-5],text:"Upcoming requests",size:"small"});
    }
    if (e && !flat) marks.push({kind:"box",key:`req-${e.index}`,at:flat ? [0,0,-22] : [0,38,18],size:[14,14,flat ? 12 : 5],radius:1.5,tone:"structure",label:e.key,leaving:true});
    marks.push(
      {kind:"label",key:"cold",at:flat ? [-8,0,12] : [-12,24,13],text:"Least recent",anchor:"end",size:"small",target:rail.anchor.first},
      {kind:"label",key:"fresh",at:flat ? [railEnd+8,0,12] : [railEnd+20,25,3],text:"Most recent",anchor:"start",size:"small",target:rail.anchor.last},
    );

    return marks;
  };
}

function caption(prev: LruState, s: LruState, e: GetEvent, fifo: Map<number, string>): string {
  const k = e.key;
  if (e.result === "hit") {
    const older = prev.order.slice(e.from! + 1);
    return older.length
      ? `get(${k}): a hit. ${k} moves to the most-recent end, so ${older.join(" and ")} each become one place older.`
      : `get(${k}): a hit. ${k} is already the most recent, so nothing moves.`;
  }
  if (!e.evicted) return `get(${k}): not cached, a miss. ${k} is loaded and stored at the most-recent end; ${s.order.length} of ${s.capacity} slots used.`;
  // Only claimed where a FIFO cache, run on the same requests, holds the same keys and evicts differently.
  const other = fifo.get(e.index);
  const contrast = other ? ` A first-in-first-out cache holding the same keys would have dropped ${other}, which was stored first but read since.` : "";
  return `get(${k}): a miss with the cache full. ${e.evicted} has gone longest without being read, so it is evicted to make room.${contrast}`;
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
  if (index===REQUESTS.length) return {chapter:"Remember",heading:"Keep the most recently used."};
  if (index===4) return {chapter:"Refresh",heading:"A moves to most recent.",prediction:{
    question:"D is next. Which key leaves?",
    choices:["A","B","C"],answer:s.order[0]!,
    explanation:`${s.order[0]} was read least recently.`,
  }};
  if (index<4) return {chapter:"Fill",heading:index === 3 ? "Cache full. Read A again." : e?.key ? `${e.key} takes an empty slot.` : "Fill the three slots."};
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
      question: `Requests so far: ${history.join(" ")}. Next comes ${next}. Which key leaves?`,
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
    setup: "The first key stored can still be the one you need. Follow a read, then decide what deserves to stay.",
    teaching,
    trust: "computed",
    projection: flat ? "front" : "iso",
    assumptions: [
      `The cache holds ${CAPACITY} entries, all the same size; only keys are shown, not values.`,
      "Recency is updated on every read, as in a textbook LRU. Many production caches approximate it (sampled LRU, CLOCK) to avoid that bookkeeping.",
      "Loading a missing key is shown as instant; in practice it is the slow path the cache exists to avoid.",
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
          caption: i === steps.length-1
            ? `LRU tracks the last read, not the first arrival. A hit refreshes a key; a full-cache miss replaces the least recently used. This run ends with ${state.hits} hits, ${state.misses} misses and ${state.evictions} evictions.`
            : caption(i === 0 ? start : steps[i - 1]!.state, state, event, fifo),
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
      { tone: "good", label: "Hit: read from the cache" },
      { tone: "accent", label: "Miss: loaded and stored" },
      { tone: "bad", label: "Evicted" },
      { tone: "muted", label: "Waiting request" },
    ],
  });
}

export const variants = { lru: makeScene(false), "lru-flat": makeScene(true) };
export default variants.lru;
