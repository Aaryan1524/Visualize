import assert from "node:assert/strict";
import test from "node:test";
import type { Mark, SolidMark, Vec3 } from "../core/types.ts";
import { boundsOf, type Bounds } from "../iso/solids.ts";
import { project } from "../iso/project.ts";
import { gate, marker, puck, reservoir, ringAssembly, source } from "./flow.ts";
import { railAssembly } from "./rail.ts";

const solids = (marks: Mark[]) => marks.filter((m): m is SolidMark => m.kind === "box" || m.kind === "cylinder");
const EPS = 1e-6;
const interpenetrate = (a: Bounds, b: Bounds) => [0, 1, 2].every((i) => a.max[i]! > b.min[i]! + EPS && b.max[i]! > a.min[i]! + EPS);

function supported(parts: SolidMark[], floor: number): string[] {
  const b = parts.map(boundsOf);
  return parts.filter((m, i) => {
    const z = b[i]!.min[2];
    if (Math.abs(z - floor) < EPS) return false;
    return !b.some((o, j) => j !== i && Math.abs(o.max[2] - z) < EPS && o.min[0] < b[i]!.max[0] && b[i]!.min[0] < o.max[0] && o.min[1] < b[i]!.max[1] && b[i]!.min[1] < o.max[1]);
  }).map((m) => m.key);
}
const onPart = (p: Vec3, parts: SolidMark[], slack = 1.5) => parts.map(boundsOf).some((b) => [0, 1, 2].every((i) => p[i]! >= b.min[i]! - slack && p[i]! <= b.max[i]! + slack));

const ring6 = ringAssembly({ key: "ring", slots: 6, at: [5, 5, 0] });
const withPucks = [...ring6.marks, ...[0, 1, 2, 3, 4, 5].map((i) => puck({ key: `v${i}`, at: ring6.slot(i), label: String(i), tone: "subject" }))];
const cases: Record<string, { marks: Mark[]; floor: number }> = {
  "ring of 6 with entries": { marks: withPucks, floor: 0 },
  "ring of 12": { marks: ringAssembly({ key: "r", slots: 12 }).marks, floor: 0 },
  "ring of 3": { marks: ringAssembly({ key: "r", slots: 3 }).marks, floor: 0 },
  marker: { marks: marker("m", [0, 0, 0], "head").marks, floor: 0 },
  "marker in lane 2": { marks: marker("m", [0, 0, 0], "tail", { lane: 2 }).marks, floor: 0 },
  "full reservoir": { marks: reservoir("b", [0, 0, 0], { capacity: 10, items: Array.from({ length: 10 }, (_, i) => ({ id: String(i) })) }).marks, floor: 0 },
  "empty reservoir": { marks: reservoir("b", [0, 0, 0], { capacity: 4, items: [] }).marks, floor: 0 },
  source: { marks: source("s", [0, 0, 0], { rate: "+2 / s" }).marks, floor: 0 },
  "open gate": { marks: gate("g", [0, 0, 0], { open: true }).marks, floor: 0 },
  "closed gate": { marks: gate("g", [0, 0, 0], { open: false }).marks, floor: 0 },
};

for (const [name, { marks, floor }] of Object.entries(cases)) {
  test(`${name}: no two pieces interpenetrate`, () => {
    const s = solids(marks);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.ok(!interpenetrate(boundsOf(s[i]!), boundsOf(s[j]!)), `${s[i]!.key} and ${s[j]!.key}`);
  });
  test(`${name}: every piece rests on the floor or on another piece`, () => {
    assert.deepEqual(supported(solids(marks), floor), []);
  });
  test(`${name}: keys are unique`, () => {
    const keys = marks.map((m) => m.key);
    assert.equal(new Set(keys).size, keys.length);
  });
}

test("a ring goes clockwise on screen from slot 0 at the back, and wraps to a neighbour", () => {
  const r = ringAssembly({ key: "r", slots: 8 });
  const screen = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => project(r.slot(i)));
  const top = screen.reduce((a, p, i) => (p[1] < screen[a]![1] ? i : a), 0);
  assert.equal(top, 0, "slot 0 is at the top of the screen");
  assert.ok(screen[1]![0] > screen[0]![0], "slot 1 is to the right of slot 0");
  // Slot 7 and slot 0 are as close as any two neighbours: the wrap is one step.
  const gap = (a: number, b: number) => Math.hypot(r.slot(a)[0] - r.slot(b)[0], r.slot(a)[1] - r.slot(b)[1]);
  assert.ok(Math.abs(gap(7, 0) - gap(0, 1)) < 1e-6);
});

test("ring anchors: entries stand on pads, markers stand outside the plinth on the floor", () => {
  const s = solids(ring6.marks);
  for (let i = 0; i < 6; i++) {
    const pad = boundsOf(s.find((m) => m.key === `ring/pad-${i}`)!);
    assert.ok(Math.abs(ring6.slot(i)[2] - pad.max[2]) < EPS, `slot ${i} is on its pad's top`);
    assert.equal(ring6.outside(i)[2], 0);
    const plinth = s.find((m) => m.key === "ring/plinth")! as SolidMark & { radius: number; at: Vec3 };
    const o = ring6.outside(i);
    assert.ok(Math.hypot(o[0] - plinth.at[0], o[1] - plinth.at[1]) > plinth.radius, `marker spot ${i} is outside the plinth`);
  }
  assert.throws(() => ring6.slot(6), RangeError);
  assert.throws(() => ringAssembly({ key: "r", slots: 6, radius: 10 }), RangeError);
  assert.throws(() => ringAssembly({ key: "r", slots: 2 }), RangeError);
});

test("names a scene gives to slots are never optional; default numbers are", () => {
  const named = ringAssembly({ key: "r", slots: 4, slotLabel: (i) => `C${i + 1}` }).marks.filter((m) => m.kind === "label");
  assert.ok(named.every((m) => m.kind === "label" && !m.optional));
  const numbered = ringAssembly({ key: "r", slots: 4 }).marks.filter((m) => m.kind === "label");
  assert.ok(numbered.every((m) => m.kind === "label" && m.optional));
  const rail = railAssembly({ key: "q", slots: 3, slotLabel: (i) => `C${i + 1}` }).marks.filter((m) => m.kind === "label");
  assert.ok(rail.every((m) => m.kind === "label" && !m.optional));
  assert.ok(railAssembly({ key: "q", slots: 3 }).marks.filter((m) => m.kind === "label").every((m) => m.kind === "label" && m.optional));
});

test("a marker on a rail slot reads as on that slot: its foot is nearer that slot than any other", () => {
  const rail = railAssembly({ key: "q", slots: 8 });
  for (let i = 0; i < 8; i++) {
    const foot = project(marker("m", rail.front(i), "lo").anchor.foot);
    // Compare with each slot's centre on screen (slot() is a tray's back-left corner).
    const d = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => { const s = rail.slot(j), c = project([s[0] + rail.cell[0] / 2, s[1] + rail.cell[1] / 2, s[2]]); return Math.abs(c[0] - foot[0]); });
    assert.ok(Math.min(...d) < 1, `marker ${i} is straight below its slot`);
    assert.equal(d.indexOf(Math.min(...d)), i, `marker ${i}`);
  }
});

test("the marker's name is a label above its cap and is never optional", () => {
  const m = marker("m", [0, 0, 0], "head");
  const name = m.marks.find((x) => x.kind === "label")!;
  assert.ok(name.kind === "label" && !name.optional && name.text === "head");
  assert.ok(onPart(m.anchor.tip, solids(m.marks)));
  assert.throws(() => marker("m", [0, 0, 0], "x", { lane: 4 }), RangeError);
});

test("a reservoir's capacity post is as tall as a full stack", () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ id: String(i) }));
  const r = reservoir("b", [0, 0, 0], { capacity: 6, items });
  const s = solids(r.marks);
  const top = Math.max(...s.filter((m) => m.key.includes("/item-")).map((m) => boundsOf(m).max[2]));
  assert.ok(Math.abs(top - r.anchor.capacity[2]) < EPS, "a full stack reaches the capacity mark");
  assert.throws(() => reservoir("b", [0, 0, 0], { capacity: 2, items }), RangeError);
});

test("a source's mouth is above what it fills, and a gate's lane runs through it", () => {
  const s = source("s", [10, 10, 0], { rate: "+2 / s" });
  assert.deepEqual([s.anchor.out[0], s.anchor.out[1]], [10, 10]);
  assert.ok(onPart(s.anchor.out, solids(s.marks)));
  const g = gate("g", [0, 0, 0], { open: true });
  assert.ok(g.anchor.in[0] < 0 && g.anchor.out[0] > 0 && g.anchor.reject[1] > g.anchor.in[1]);
  assert.ok(onPart(g.anchor.top, solids(g.marks)));
});
