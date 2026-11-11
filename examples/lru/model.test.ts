import assert from "node:assert/strict";
import test from "node:test";
import { fifoContrast, run, runFifo, type Result } from "./model.ts";
import { REQUESTS, CAPACITY } from "./scene.ts";

/**
 * Reference implementation, written separately: a Map keeps insertion
 * order, so deleting and re-inserting a key on every read makes the first
 * key the least recently used.
 */
class ReferenceLru {
  private map = new Map<string, true>();
  private capacity: number;
  constructor(capacity: number) {
    this.capacity = capacity;
  }
  get(key: string): { result: Result; evicted: string | null } {
    if (this.map.has(key)) {
      this.map.delete(key);
      this.map.set(key, true);
      return { result: "hit", evicted: null };
    }
    let evicted: string | null = null;
    if (this.map.size === this.capacity) {
      evicted = this.map.keys().next().value!;
      this.map.delete(evicted);
    }
    this.map.set(key, true);
    return { result: "miss", evicted };
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

function agree(capacity: number, requests: string[]) {
  const ref = new ReferenceLru(capacity);
  const { steps } = run(capacity, requests);
  steps.forEach(({ state, event }, i) => {
    const r = ref.get(requests[i]!);
    assert.equal(event.result, r.result, `request ${i} (${requests[i]}): result`);
    assert.equal(event.evicted, r.evicted, `request ${i} (${requests[i]}): evicted`);
    assert.deepEqual(state.order, ref.keys(), `request ${i} (${requests[i]}): recency order`);
    assert.ok(state.order.length <= capacity, "never over capacity");
    assert.equal(state.hits + state.misses, i + 1);
    assert.equal(new Set(state.order).size, state.order.length, "no duplicate keys");
  });
}

test("the scene's own request sequence matches the reference", () => {
  agree(CAPACITY, REQUESTS);
});

test("the scene's sequence shows a hit, a miss without eviction, an eviction, and an LRU-not-FIFO choice", () => {
  const { steps } = run(CAPACITY, REQUESTS);
  assert.ok(steps.some((s) => s.event.result === "hit"));
  assert.ok(steps.some((s) => s.event.result === "miss" && !s.event.evicted));
  assert.ok(steps.some((s) => s.event.evicted));
  // At least one eviction removes a key that was not the oldest stored:
  // the case where LRU and FIFO disagree.
  const disagree = steps.some((s, i) => {
    if (!s.event.evicted) return false;
    const before = i === 0 ? [] : steps[i - 1]!.state.stored;
    return before[0] !== s.event.evicted;
  });
  assert.ok(disagree, "sequence should include an eviction where FIFO would choose differently");
});

test("edge cases match the reference", () => {
  agree(1, ["A", "A", "B", "A", "B", "B"]);
  agree(2, ["A", "A", "A"]);
  agree(3, ["A", "B", "C", "D", "E", "F"]); // every request a miss
  agree(3, ["A", "B", "A", "B", "A", "B"]); // fits: only cold misses
  agree(4, []);
});

test("random sequences match the reference", () => {
  let seed = 99;
  const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let trial = 0; trial < 300; trial++) {
    const capacity = 1 + Math.floor(r() * 5);
    const alphabet = 1 + Math.floor(r() * 8);
    const requests = Array.from({ length: Math.floor(r() * 40) }, () => String.fromCharCode(65 + Math.floor(r() * alphabet)));
    agree(capacity, requests);
  }
});

test("invalid capacity is rejected", () => {
  assert.throws(() => run(0, ["A"]), /positive integer/);
});

test("FIFO comparison: only claimed where both caches hold the same keys", () => {
  const contrast = fifoContrast(CAPACITY, REQUESTS);
  const fifo = runFifo(CAPACITY, REQUESTS);
  const { steps } = run(CAPACITY, REQUESTS);
  assert.ok(contrast.size >= 1, "the scene relies on at least one true contrast");
  for (const [i, key] of contrast) {
    const lruBefore = i === 0 ? [] : steps[i - 1]!.state.order;
    assert.deepEqual([...fifo[i]!.before].sort(), [...lruBefore].sort(), `request ${i}: contents differ, so the claim would be false`);
    assert.equal(fifo[i]!.evicted, key);
    assert.notEqual(steps[i]!.event.evicted, key);
  }
  // In this run the two diverge at request 4 (D) and never hold the same keys again.
  assert.deepEqual([...contrast.keys()], [4]);
});

test("FIFO reference: evicts in insertion order and ignores reads", () => {
  const f = runFifo(2, ["A", "B", "A", "C", "A"]);
  assert.deepEqual(f.map((x) => x.evicted), [null, null, null, "A", "B"]);
});

test("the prediction precedes the first eviction and answers from the current recency order", async () => {
  const {compile}=await import('../../src/core/scene.ts');
  const {default:scene}=await import('./scene.ts');
  const compiled=compile(scene);
  const promptIndex=compiled.steps.findIndex(s=>s.teaching?.prediction);
  const {steps}=run(CAPACITY,REQUESTS);
  const firstEviction=steps.findIndex(s=>s.event.evicted);
  assert.equal(promptIndex,firstEviction);
  const prompt=compiled.steps[promptIndex]!.teaching!.prediction!;
  assert.equal(prompt.answer,steps[firstEviction]!.event.evicted);
  assert.ok(prompt.choices.includes(prompt.answer));
  assert.match(compiled.steps.at(-1)!.caption,/last read, not the first arrival/);
});
