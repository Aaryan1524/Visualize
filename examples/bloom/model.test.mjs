// node --test examples/bloom/model.test.mjs
//
// The model against a separately written reference (a set of bit positions, FNV-1a written out again)
// and the cases the story needs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, OPS, M, fnv1a, fpRate, bestK, run } from "./model.mjs";

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
    const ref = reference(M, Mo.k, OPS), last = Mo.steps.at(-1).state;
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
