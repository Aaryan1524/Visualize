// A least-recently-used cache, as an executable model that records every step.

export type Result = "hit" | "miss";

export interface LruState {
  capacity: number;
  /** Cached keys, least recently used first. */
  order: string[];
  /** Every request in the run, and how many have been served. */
  requests: string[];
  served: number;
  results: Result[];
  hits: number;
  misses: number;
  evictions: number;
  /** Keys in the order they were first stored, for contrasting with FIFO. */
  stored: string[];
}

export interface GetEvent {
  type: "get";
  key: string;
  /** Position of this request in the run. */
  index: number;
  result: Result;
  /** Key evicted to make room, if any. */
  evicted: string | null;
  /** Recency position the key held before a hit, least recent = 0. */
  from: number | null;
}

export function initial(capacity: number, requests: string[]): LruState {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error(`capacity must be a positive integer, got ${capacity}`);
  return { capacity, order: [], requests, served: 0, results: [], hits: 0, misses: 0, evictions: 0, stored: [] };
}

/** Serve the next request. Pure: returns a new state. */
export function step(s: LruState): { state: LruState; event: GetEvent } {
  const index = s.served;
  const key = s.requests[index];
  if (key === undefined) throw new Error("no requests left");
  const pos = s.order.indexOf(key);

  if (pos >= 0) {
    const order = [...s.order.slice(0, pos), ...s.order.slice(pos + 1), key];
    return {
      state: { ...s, order, served: index + 1, results: [...s.results, "hit"], hits: s.hits + 1 },
      event: { type: "get", key, index, result: "hit", evicted: null, from: pos },
    };
  }

  let order = s.order;
  let evicted: string | null = null;
  let stored = s.stored;
  if (order.length === s.capacity) {
    evicted = order[0]!;
    order = order.slice(1);
    stored = stored.filter((k) => k !== evicted);
  }
  return {
    state: {
      ...s,
      order: [...order, key],
      served: index + 1,
      results: [...s.results, "miss"],
      misses: s.misses + 1,
      evictions: s.evictions + (evicted ? 1 : 0),
      stored: [...stored, key],
    },
    event: { type: "get", key, index, result: "miss", evicted, from: null },
  };
}

/**
 * A first-in-first-out cache over the same requests, for comparison. Returns,
 * for each request, the cache contents before it and the key FIFO evicts.
 */
export function runFifo(capacity: number, requests: string[]): { before: string[]; evicted: string | null }[] {
  let queue: string[] = [];
  return requests.map((key) => {
    const before = queue;
    let evicted: string | null = null;
    if (!queue.includes(key)) {
      if (queue.length === capacity) {
        evicted = queue[0]!;
        queue = queue.slice(1);
      }
      queue = [...queue, key];
    }
    return { before, evicted };
  });
}

/**
 * Where LRU and FIFO hold exactly the same keys before a request but evict
 * different ones: the only places a "FIFO would have…" claim is true.
 */
export function fifoContrast(capacity: number, requests: string[]): Map<number, string> {
  const fifo = runFifo(capacity, requests);
  const out = new Map<number, string>();
  let lru = initial(capacity, requests);
  for (let i = 0; i < requests.length; i++) {
    const { state, event } = step(lru);
    const f = fifo[i]!;
    const same = f.before.length === lru.order.length && f.before.every((k) => lru.order.includes(k));
    if (same && event.evicted && f.evicted && f.evicted !== event.evicted) out.set(i, f.evicted);
    lru = state;
  }
  return out;
}

export function run(capacity: number, requests: string[]) {
  let state = initial(capacity, requests);
  const steps: { state: LruState; event: GetEvent }[] = [];
  while (state.served < requests.length) {
    const next = step(state);
    steps.push(next);
    state = next.state;
  }
  return { initial: initial(capacity, requests), steps };
}

/** Hits a FIFO cache scores on the same requests. */
export function fifoHits(capacity: number, requests: string[]): number {
  return runFifo(capacity, requests).filter((f, i) => f.before.includes(requests[i]!)).length;
}

/**
 * Hits Belady's optimal policy scores on the same requests: on a full-cache
 * miss it evicts the key whose next request is furthest ahead (or never comes).
 * No policy that cannot see the future does better.
 */
export function optimalHits(capacity: number, requests: string[]): number {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error(`capacity must be a positive integer, got ${capacity}`);
  let cache: string[] = [];
  let hits = 0;
  requests.forEach((key, i) => {
    if (cache.includes(key)) return void hits++;
    if (cache.length === capacity) {
      const next = (k: string) => { const j = requests.indexOf(k, i + 1); return j < 0 ? Infinity : j; };
      const victim = cache.reduce((a, b) => (next(b) > next(a) ? b : a));
      cache = cache.filter((k) => k !== victim);
    }
    cache = [...cache, key];
  });
  return hits;
}
