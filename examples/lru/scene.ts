import { defineScene } from "../../src/core/scene.ts";
import type { Mark, Observation, Scene, Vec3 } from "../../src/core/types.ts";
import { fifoContrast, initial, run, type GetEvent, type LruState } from "./model.ts";

export const CAPACITY = 3;
/**
 * Chosen so the run shows cold misses, a hit that refreshes recency, an
 * eviction where LRU and FIFO disagree, and a later hit on a refreshed key.
 */
export const REQUESTS = ["A", "B", "C", "A", "D", "B", "A", "E", "B"];

// World layout, in units of about one screen pixel at 1×.
const PITCH = 34; // distance between slots along the recency rail
const BLOCK: Vec3 = [24, 24, 18];
const TRAY_Z = 1.5; // entries sit on their trays
const QUEUE_PITCH = 20;
const QUEUE_SHOWN = 6;

const railEnd = (CAPACITY - 1) * PITCH + BLOCK[0];

function layout(flat: boolean) {
  return {
    slot: (i: number): Vec3 => [i * PITCH, 0, TRAY_Z],
    // Off the cold end of the rail, where an evicted entry is pushed.
    evicted: (): Vec3 => [-PITCH - 14, 0, TRAY_Z],
    queue: (j: number): Vec3 => (flat ? [j * QUEUE_PITCH, 0, -40] : [j * QUEUE_PITCH, 50, -4]),
    consumed: (): Vec3 => (flat ? [0, 0, -22] : [0, 36, 16]),
    coldLabel: (): Vec3 => (flat ? [-6, 0, -18] : [-10, 30, -4]),
    freshLabel: (): Vec3 => (flat ? [railEnd + 6, 0, -18] : [railEnd + 12, 30, -4]),
  };
}

function viewFor(flat: boolean) {
  const L = layout(flat);
  return (s: LruState, e: GetEvent | null): Mark[] => {
    const marks: Mark[] = [
      { kind: "box", key: "base", at: [-PITCH - 26, -16, -8], size: [railEnd + PITCH + 60, flat ? 40 : 86, 4], tone: "base" },
      { kind: "box", key: "rail", at: [-6, -6, -4], size: [railEnd + 12, BLOCK[1] + 12, 4], tone: "structure" },
    ];
    for (let i = 0; i < s.capacity; i++) {
      marks.push({ kind: "box", key: `tray-${i}`, at: [i * PITCH - 2, -2, 0], size: [BLOCK[0] + 4, BLOCK[1] + 4, TRAY_Z], tone: "muted" });
    }

    // Cached entries, least recent at the cold end.
    s.order.forEach((key, i) => {
      const accessed = e?.key === key;
      marks.push({
        kind: "box",
        key: `entry-${key}`,
        at: L.slot(i),
        size: BLOCK,
        tone: accessed ? (e!.result === "hit" ? "good" : "accent") : "subject",
        lit: accessed,
        label: key,
        link: `key-${key}`,
        enter: "drop",
        // A hit hops over the entries shifting toward the cold end.
        ...(accessed && e!.result === "hit" ? { arc: BLOCK[2] * 1.9 } : {}),
      });
    });
    if (e?.evicted) {
      marks.push({ kind: "box", key: `entry-${e.evicted}`, at: L.evicted(), size: BLOCK, tone: "bad", label: e.evicted, leaving: true });
    }

    // Requests still to come, next one first.
    for (let j = 0; j < QUEUE_SHOWN; j++) {
      const index = s.served + j;
      const key = s.requests[index];
      if (key === undefined) break;
      marks.push({
        kind: "box",
        key: `req-${index}`,
        at: L.queue(j),
        size: [14, 14, 10],
        tone: j === 0 ? "structure" : "muted",
        label: key,
        link: `key-${key}`,
        enter: "fade",
      });
    }
    // The request just served is consumed, rising toward the rail.
    if (e) marks.push({ kind: "box", key: `req-${e.index}`, at: L.consumed(), size: [14, 14, 10], tone: "structure", label: e.key, leaving: true });

    marks.push(
      { kind: "label", key: "cold", at: L.coldLabel(), text: "least recent", anchor: "end", size: "small" },
      { kind: "label", key: "fresh", at: L.freshLabel(), text: "most recent", anchor: "start", size: "small" },
    );
    if (s.served < s.requests.length) {
      marks.push({ kind: "label", key: "next", at: flat ? [-6, 0, -36] : [-8, 66, -4], text: "next requests", anchor: "end", size: "small" });
    }
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
  const cells = s.requests
    .map((k, i) => {
      const r = s.results[i];
      const cls = i === s.served ? "vz-hot" : r === "hit" ? "vz-good" : r === "miss" ? "vz-bad" : "vz-dim";
      return `<td class="${cls}" data-link="key-${k}">${k}</td>`;
    })
    .join("");
  const marks = s.requests
    .map((_, i) => {
      const r = s.results[i];
      return `<td class="vz-dim">${r === "hit" ? "H" : r === "miss" ? "M" : i === s.served ? "▲" : ""}</td>`;
    })
    .join("");
  const rate = s.served ? `${Math.round((100 * s.hits) / s.served)}%` : "–";
  return [
    {
      key: "rule",
      title: "The rule",
      html: `<p>On a <span class="vz-good">hit</span>, move the key to the most-recent end.<br>On a <span class="vz-bad">miss</span>, if the cache is full, evict the least-recent key; then store the new key at the most-recent end.</p>`,
    },
    {
      key: "cache",
      title: `Cache · ${s.capacity} slots · least → most recent`,
      html: `<p data-key="recency" style="font:600 15px var(--mono)">${s.order.map((k) => `<span data-link="key-${k}">${k}</span>`).join(" · ") || "empty"}</p>`,
    },
    {
      key: "requests",
      title: "Requests",
      html: `<table><tr>${cells}</tr><tr>${marks}</tr></table><p class="vz-dim" style="margin:6px 0 0;font-size:12px">H hit · M miss · ▲ next</p>`,
    },
    {
      key: "counts",
      title: "Counts",
      html: `<table><tr><th>hits</th><th>misses</th><th>evictions</th><th>hit rate</th></tr><tr><td data-key="hits">${s.hits}</td><td data-key="misses">${s.misses}</td><td data-key="evictions">${s.evictions}</td><td data-key="rate">${rate}</td></tr></table>`,
    },
  ];
}

function observe(s: LruState, e: GetEvent | null): Observation[] {
  const obs: Observation[] = [
    { type: "text", key: "recency", equals: s.order.join(" · ") || "empty" },
    { type: "text", key: "hits", equals: String(s.hits) },
    { type: "text", key: "misses", equals: String(s.misses) },
    { type: "text", key: "evictions", equals: String(s.evictions) },
    ...s.order.map((k) => ({ type: "text" as const, key: `entry-${k}`, equals: k })),
    ...s.order.map((k) => ({ type: "visible" as const, key: `entry-${k}`, visible: true })),
  ];
  if (s.order.length > 1) obs.push({ type: "order", keys: s.order.map((k) => `entry-${k}`), axis: "x" });
  if (e?.evicted) obs.push({ type: "visible", key: `entry-${e.evicted}`, visible: false });
  if (e) obs.push({ type: "lit", key: `entry-${e.key}` });
  const next = s.requests[s.served];
  if (next) obs.push({ type: "text", key: `req-${s.served}`, equals: next });
  return obs;
}

function makeScene(flat: boolean): Scene<LruState, GetEvent> {
  return defineScene<LruState, GetEvent>({
    id: flat ? "lru-flat" : "lru",
    title: flat ? "LRU cache (flat)" : "LRU cache",
    question: "When a cache is full, which entry does it throw away?",
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
          caption: caption(i === 0 ? start : steps[i - 1]!.state, state, event, fifo),
        })),
      };
    },
    view: viewFor(flat),
    panels,
    observe,
    readout: (s) => `${s.order.length}/${s.capacity} slots · hits ${s.hits} · misses ${s.misses} · evictions ${s.evictions}`,
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
