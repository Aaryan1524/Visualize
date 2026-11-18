// node --test examples/bloom/model.test.mjs
//
// The model against a separately written reference (a set of bit positions, FNV-1a written out again)
// and the cases the story needs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, OPS, M, fnv1a, fpRate, fpRateClassic, fpRateTrue, bestK, bestKTrue, run } from "./model.mjs";

// the reference: no shared code with the model
function fnv(s) {
  let h = 2166136261n;
  for (const c of s) h = ((h ^ BigInt(c.charCodeAt(0))) * 16777619n) % 4294967296n;
  return Number(h);
}
function reference(m, k, ops) {
  const on = new Set(), members = new Set(), out = [];
  const pos = (w) => Array.from({ length: k }, (_, i) => fnv(`${i + 1}:${w}`) % m);
  for (const { op, word } of ops) {
    if (op === "add") (pos(word).forEach((b) => on.add(b)), members.add(word), out.push("added"));
    else if (op === "clear") (pos(word).forEach((b) => on.delete(b)), members.delete(word), out.push("cleared"));
    else {
      const all = pos(word).every((b) => on.has(b));
      out.push(all ? (members.has(word) ? "maybe" : "false-positive") : members.has(word) ? "false-negative" : "no");
    }
  }
  return { bits: Array.from({ length: m }, (_, i) => (on.has(i) ? 1 : 0)), results: out };
}

test("FNV-1a matches its published test vectors", () => {
  assert.equal(fnv1a(""), 0x811c9dc5);
  assert.equal(fnv1a("a"), 0xe40c292c);
  assert.equal(fnv1a("foobar"), 0xbf9cf968);
});

for (const [name, Mo] of Object.entries(MODELS)) {
  test(`${name}: every bit and every answer matches a separately written reference`, () => {
    const ref = reference(M, Mo.k, Mo.ops), last = Mo.steps.at(-1).state;
    assert.deepEqual(last.bits, ref.bits);
    assert.deepEqual(last.results, ref.results);
  });
}

test("random words and filters agree with the reference", () => {
  let seed = 11;
  const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const word = () => Array.from({ length: 2 + Math.floor(r() * 6) }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join("");
  for (let n = 0; n < 200; n++) {
    const m = 8 + Math.floor(r() * 56), k = 1 + Math.floor(r() * 6);
    const ops = Array.from({ length: 1 + Math.floor(r() * 10) }, () => ({ op: ["add", "add", "ask", "clear"][Math.floor(r() * 4)], word: word() }));
    const got = run(m, k, ops).steps.at(-1).state, ref = reference(m, k, ops);
    assert.deepEqual([got.bits, got.results], [ref.bits, ref.results]);
  }
});

test("the three-hash story has every case: a shared bit, a true maybe, a definite no, a false positive, a broken member", () => {
  const r = MODELS.three.steps.map((s) => s.state.results.at(-1));
  assert.deepEqual(r, ["added", "added", "added", "maybe", "no", "false-positive", "cleared", "false-negative"]);
  assert.ok(MODELS.three.steps[1].event.already.length > 0);
});

test("the rate formulas: (1 − e^(−kn/m))^k and the best k", () => {
  assert.ok(Math.abs(fpRate(16, 3, 3) - Math.pow(1 - Math.exp(-9 / 16), 3)) < 1e-12);
  assert.ok(Math.abs(bestK(16, 3) - (16 / 3) * Math.log(2)) < 1e-12);
});

// The true expected false-positive rate, E[(X/m)^k] over the X bits kn uniform hashes set, against a
// separate reference: the occupancy distribution from Stirling numbers of the second kind, in exact
// integers, P(X = j) = C(m, j) j! S(N, j) / m^N.
function trueRateReference(m, k, n) {
  const N = k * n, S = [[1n]];
  for (let i = 1; i <= N; i++) {
    S[i] = [0n];
    for (let j = 1; j <= i; j++) S[i][j] = BigInt(j) * (S[i - 1][j] ?? 0n) + (S[i - 1][j - 1] ?? 0n);
  }
  let fall = 1n, total = 0;
  const mN = BigInt(m) ** BigInt(N);
  for (let j = 1; j <= Math.min(m, N); j++) {
    fall *= BigInt(m - j + 1); // m (m-1) ... (m-j+1) = C(m, j) j!
    const ways = fall * S[N][j];
    total += (Number((ways * 10n ** 18n) / mN) / 1e18) * Math.pow(j / m, k);
  }
  return total;
}

test("the true expected rate matches an exact reference, and the reviewer's figures for 16 bits and 3 words", () => {
  for (const k of [1, 2, 3, 4, 5, 6]) assert.ok(Math.abs(fpRateTrue(16, k, 3) - trueRateReference(16, k, 3)) < 1e-12, `k = ${k}`);
  const r = (k) => Math.round(fpRateTrue(16, k, 3) * 10000) / 100;
  assert.deepEqual([r(1), r(3), r(4), r(6)], [17.6, 9.06, 9.35, 12.71]);
});

test("the true expected rate agrees with a large seeded simulation of fresh hashes", () => {
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (const k of [2, 4]) {
    let hits = 0;
    const T = 200000;
    for (let t = 0; t < T; t++) {
      const on = new Set();
      for (let i = 0; i < 3 * k; i++) on.add(Math.floor(rnd() * 16));
      let all = true;
      for (let i = 0; i < k; i++) if (!on.has(Math.floor(rnd() * 16))) all = false;
      if (all) hits++;
    }
    assert.ok(Math.abs(hits / T - fpRateTrue(16, k, 3)) < 0.003, `k = ${k}: ${hits / T} vs ${fpRateTrue(16, k, 3)}`);
  }
});

test("Bloom's classic estimate is exact for one hash function and below the true rate for more", () => {
  assert.ok(Math.abs(fpRateClassic(16, 1, 3) - fpRateTrue(16, 1, 3)) < 1e-12);
  for (const k of [2, 3, 4, 6]) assert.ok(fpRateClassic(16, k, 3) < fpRateTrue(16, k, 3), `k = ${k}`);
  // at this size the true rate ranks three hash functions ahead of four; the classic estimate does not
  assert.equal(bestKTrue(16, 3), 3);
  assert.ok(fpRateClassic(16, 4, 3) < fpRateClassic(16, 3, 3));
});

test("every variant's story has every case: a shared bit, a true maybe, a definite no, a false positive, a broken member", () => {
  for (const [name, Mo] of Object.entries(MODELS)) {
    assert.deepEqual(Mo.steps.map((s) => s.state.results.at(-1)), ["added", "added", "added", "maybe", "no", "false-positive", "cleared", "false-negative"], name);
    assert.ok(Mo.steps[1].event.already.length > 0, `${name}: the second word shares a bit`);
  }
  assert.deepEqual(MODELS.three.ops, OPS, "the three-hash story keeps its own words");
});
