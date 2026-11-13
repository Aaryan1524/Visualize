import assert from "node:assert/strict";
import test from "node:test";
import { clearOf, intrusion, silhouettes, type Rect, type ViewBox } from "./clear.ts";
import { railAssembly } from "../parts/rail.ts";
import type { Pt } from "../iso/project.ts";

const square = (x: number, y: number, s: number): Pt[] => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];

test("a shape inside the reserved corner reports both escapes", () => {
  const r: Rect = { x0: 0, y0: 0, x1: 30, y1: 20 };
  const hit = intrusion([square(10, 5, 10)], r)!;
  assert.equal(hit.right, 20);
  assert.equal(hit.down, 15);
  assert.equal(intrusion([square(40, 5, 10)], r), null, "a shape right of the corner is clear");
  assert.equal(intrusion([[[31, 0], [60, 0], [60, 30]]], r), null, "a triangle whose box overlaps but whose body does not is clear");
});

test("the view grows the cheaper way until the corner is empty", () => {
  // A unit-scale stage: the reserved corner is 30×20 drawing units from the box's top-left.
  const rectFor = (vb: ViewBox): Rect => ({ x0: vb[0], y0: vb[1], x1: vb[0] + 30, y1: vb[1] + 20 });
  const shapes = [square(0, 0, 10), square(50, 50, 10)];
  const vb = clearOf([0, 0, 60, 60], shapes, rectFor);
  assert.equal(intrusion(shapes, rectFor(vb)), null);
  assert.ok(vb[2] >= 60 && vb[3] >= 60, "the view only grows");
  // Escaping up costs 20, escaping left costs 30: it grows up.
  assert.ok(vb[1] < 0 && vb[0] === 0);
});

test("a long rail's silhouettes include its first slot at the top-left", () => {
  const rail = railAssembly({ key: "r", slots: 10 });
  const shapes = silhouettes([rail.marks], "iso");
  assert.ok(shapes.length > 10);
  const xs = shapes.flat().map((p) => p[0]);
  assert.ok(Math.min(...xs) < 0, "the rail runs from the top-left");
});
