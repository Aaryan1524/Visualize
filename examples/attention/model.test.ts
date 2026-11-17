import assert from "node:assert/strict";
import test from "node:test";
import { attention, matmul, shape, softmax, transpose } from "./model.ts";
import { EXAMPLE } from "./scene.ts";

const close = (a: number, b: number, eps = 1e-12) => Math.abs(a - b) <= eps;

/** Independent reference: plain loops, no shared helpers. */
function reference(Q: number[][], K: number[][], V: number[][]) {
  const n = Q.length, m = K.length, dk = Q[0]!.length, dv = V[0]!.length;
  const W: number[][] = [];
  const Z: number[][] = [];
  for (let i = 0; i < n; i++) {
    const s: number[] = [];
    for (let j = 0; j < m; j++) {
      let acc = 0;
      for (let t = 0; t < dk; t++) acc += Q[i]![t]! * K[j]![t]!;
      s.push(acc / Math.sqrt(dk));
    }
    let denom = 0;
    for (const x of s) denom += Math.exp(x);
    const w = s.map((x) => Math.exp(x) / denom);
    W.push(w);
    const z = new Array<number>(dv).fill(0);
    for (let j = 0; j < m; j++) for (let t = 0; t < dv; t++) z[t]! += w[j]! * V[j]![t]!;
    Z.push(z);
  }
  return { W, Z };
}

const { tokens, Q, K, V } = EXAMPLE;
const a = attention(tokens, Q, K, V);

test("shapes: n×d_k scores, n×n weights, n×d_v output", () => {
  assert.deepEqual(shape(a.scores), [3, 3]);
  assert.deepEqual(shape(a.weights), [3, 3]);
  assert.deepEqual(shape(a.output), [3, shape(V)[1]]);
});

test("every row of weights is positive and sums to 1", () => {
  for (const row of a.weights) {
    assert.ok(row.every((w) => w > 0));
    assert.ok(close(row.reduce((s, w) => s + w, 0), 1, 1e-12));
  }
});

test("output equals an independent loop-based recomputation", () => {
  const ref = reference(Q, K, V);
  a.weights.forEach((row, i) => row.forEach((w, j) => assert.ok(close(w, ref.W[i]![j]!), `w[${i}][${j}]`)));
  a.output.forEach((row, i) => row.forEach((z, t) => assert.ok(close(z, ref.Z[i]![t]!), `z[${i}][${t}]`)));
});

test("the example's story holds: 'sat' attends mostly to 'cat'", () => {
  const sat = tokens.indexOf("sat");
  const cat = tokens.indexOf("cat");
  const row = a.weights[sat]!;
  assert.equal(row.indexOf(Math.max(...row)), cat);
});

test("scores are exactly the dot products the captions quote", () => {
  // q_sat = [1, 2], k_the = [1, 0], k_cat = [0, 2], k_sat = [0.5, 0.5]
  assert.deepEqual(a.scores[2], [1, 4, 1.5]);
});

test("softmax is shift-invariant and stable for large inputs", () => {
  const x = [1, 2, 3];
  const y = softmax(x.map((v) => v + 1000));
  softmax(x).forEach((v, i) => assert.ok(close(v, y[i]!, 1e-12)));
  assert.ok(softmax([1000, 1000]).every((v) => close(v, 0.5)));
});

test("permuting the tokens permutes the output rows", () => {
  const p = [2, 0, 1];
  const pa = attention(p.map((i) => tokens[i]!), p.map((i) => Q[i]!), p.map((i) => K[i]!), p.map((i) => V[i]!));
  p.forEach((src, dst) => pa.output[dst]!.forEach((z, t) => assert.ok(close(z, a.output[src]![t]!), `row ${dst}`)));
});

test("matrix helpers: transpose and shape checks", () => {
  assert.deepEqual(transpose([[1, 2, 3]]), [[1], [2], [3]]);
  assert.throws(() => matmul([[1, 2]], [[1, 2]]), /shape mismatch/);
  assert.throws(() => attention(["a"], [[1, 2]], [[1]], [[1]]), /share d_k/);
});

test("dividing by √d_k flattens every row: the top weight drops", () => {
  a.scores.forEach((row, i) => assert.ok(Math.max(...softmax(row)) > Math.max(...a.weights[i]!), `row ${i}`));
  const sat = tokens.indexOf("sat"), cat = tokens.indexOf("cat");
  assert.ok(close(softmax(a.scores[sat]!)[cat]!, Math.exp(4) / (Math.exp(1) + Math.exp(4) + Math.exp(1.5))));
});
