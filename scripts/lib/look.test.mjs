import { test } from "node:test";
import assert from "node:assert/strict";
import { longestSameRun, oklabL, partContrast, turns, weightedMedian } from "./look.mjs";

test("look: OKLab lightness runs from black to white", () => {
  assert.equal(oklabL([0, 0, 0]), 0);
  assert.ok(Math.abs(oklabL([255, 255, 255]) - 1) < 1e-6);
  assert.ok(Math.abs(oklabL([128, 128, 128]) - 0.5999) < 1e-3);
});

test("look: a weighted median follows the weight", () => {
  assert.equal(weightedMedian([[0.2, 1], [0.9, 10]]), 0.9);
  assert.equal(weightedMedian([[0.2, 5], [0.9, 1], [0.5, 1]]), 0.2);
  assert.equal(weightedMedian([]), null);
});

test("look: a translate or a uniform scale does not turn a part; a rotation, a shear, a mirror or a half turn does", () => {
  assert.equal(turns(1, 0, 0, 1), false);
  assert.equal(turns(2.5, 0, 0, 2.5), false);
  const a = (20 * Math.PI) / 180;
  assert.equal(turns(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)), true);
  assert.equal(turns(1, 0, 0.3, 1), true);
  assert.equal(turns(-1, 0, 0, 1), true);
  assert.equal(turns(-1, 0, 0, -1), true);
});

test("look: a part's top against its sides counts only sides that hold a tenth of their weight", () => {
  const grey = (v, w) => [v, v, v, w];
  // a top at 230 and a side at 150 read apart
  assert.ok(Math.abs(partContrast([{ caps: [grey(230, 10)], walls: [grey(150, 10)], material: "m" }]).cap - oklabL([230, 230, 230])) < 1e-9);
  const flat = partContrast([{ caps: [grey(240, 10)], walls: [grey(236, 100), grey(120, 1)], material: "m" }]);
  assert.ok(Math.abs(flat.cap - flat.wall) < 0.02, "a sliver of dark side does not make a flat part read as solid");
  assert.equal(partContrast([{ caps: [], walls: [grey(100, 1)], material: "m" }]), null);
});

test("look: the longest run of steps in the same framing", () => {
  const clear = { x0: 0, y0: 0, x1: 1000, y1: 600 };
  const at = (x) => ({ s: 1, x, y: 0 });
  assert.deepEqual(longestSameRun([at(0), at(200), at(400), at(600)], clear), { len: 1, from: 1, to: 1 });
  assert.deepEqual(longestSameRun([at(0), at(200), at(201), at(202), at(600)], clear), { len: 3, from: 2, to: 4 });
  assert.deepEqual(longestSameRun([], clear), { len: 0, from: 0, to: 0 });
});
