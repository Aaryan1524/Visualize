import assert from "node:assert/strict";
import test from "node:test";
import type { BoxMark, Vec3 } from "../core/types.ts";
import { project } from "./project.ts";
import { boundsOf, geometryOf, type Bounds } from "./solids.ts";
import { depthSort, screenOverlap } from "./sort.ts";

/** Deterministic PRNG so failures reproduce. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const box = (key: string, at: Vec3, size: Vec3): BoxMark => ({ kind: "box", key, at, size });

function intersects3d(a: Bounds, b: Bounds): boolean {
  for (let i = 0; i < 3; i++) if (a.max[i]! <= b.min[i]! || b.max[i]! <= a.min[i]!) return false;
  return true;
}

/**
 * Independent oracle: cast the line of sight through screen point (sx, sy)
 * and return the parameter where it leaves the box toward the viewer, or
 * null if it misses. Larger means nearer the viewer.
 */
function rayExit(b: Bounds, sx: number, sy: number): number | null {
  const C = Math.cos(Math.PI / 6);
  const u = sx / C; // x - y
  const v = 2 * sy; // x + y at z = 0
  const base: Vec3 = [(u + v) / 2, (v - u) / 2, 0];
  let t0 = -Infinity, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const lo = b.min[i]! - base[i]!;
    const hi = b.max[i]! - base[i]!;
    t0 = Math.max(t0, lo);
    t1 = Math.min(t1, hi);
  }
  return t0 < t1 ? t1 : null;
}

function randomScene(r: () => number, n: number): BoxMark[] {
  const out: BoxMark[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 5000) {
    const m = box(
      `b${out.length}`,
      [Math.floor(r() * 60), Math.floor(r() * 60), Math.floor(r() * 30)],
      [4 + Math.floor(r() * 20), 4 + Math.floor(r() * 20), 4 + Math.floor(r() * 20)],
    );
    const b = boundsOf(m);
    if (out.every((o) => !intersects3d(boundsOf(o), b))) out.push(m);
  }
  return out;
}

test("projection: the line of sight (1,1,1) collapses to one screen point", () => {
  const a = project([3, 4, 5]);
  const b = project([13, 14, 15]);
  assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
});

test("screen overlap agrees with sampled hexagon coverage", () => {
  const r = rng(7);
  for (let trial = 0; trial < 300; trial++) {
    const [a, b] = randomScene(r, 2);
    if (!a || !b) continue;
    const ga = geometryOf(a).outline;
    const gb = geometryOf(b).outline;
    const inside = (poly: readonly (readonly [number, number])[], x: number, y: number) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]!;
        const [xj, yj] = poly[j]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    let sampled = false;
    for (let x = -80; x <= 80 && !sampled; x += 0.75)
      for (let y = -60; y <= 80 && !sampled; y += 0.75)
        if (inside(ga, x, y) && inside(gb, x, y)) sampled = true;
    if (sampled) assert.ok(screenOverlap(boundsOf(a), boundsOf(b)), `trial ${trial}: missed overlap`);
  }
});

test("depth sort matches an independent ray cast on random non-intersecting scenes", () => {
  const r = rng(42);
  let checkedPoints = 0;
  for (let trial = 0; trial < 60; trial++) {
    const scene = randomScene(r, 8);
    const { order, conflicts } = depthSort(scene);
    assert.equal(conflicts.length, 0);
    const paintIndex = new Map(order.map((m, i) => [m.key, i]));
    for (let k = 0; k < 400; k++) {
      const sx = (r() - 0.5) * 140;
      const sy = (r() - 0.3) * 120;
      let nearest: string | null = null;
      let best = -Infinity;
      let lastPainted: string | null = null;
      let lastIndex = -1;
      for (const m of scene) {
        const t = rayExit(boundsOf(m), sx, sy);
        if (t === null) continue;
        if (t > best) [best, nearest] = [t, m.key];
        const pi = paintIndex.get(m.key)!;
        if (pi > lastIndex) [lastIndex, lastPainted] = [pi, m.key];
      }
      if (nearest) {
        checkedPoints++;
        assert.equal(lastPainted, nearest, `trial ${trial}: wrong solid on top at (${sx.toFixed(1)}, ${sy.toFixed(1)})`);
      }
    }
  }
  assert.ok(checkedPoints > 1000, `only ${checkedPoints} covered points sampled`);
});

test("depth sort is deterministic and reports intersecting solids", () => {
  const scene = [box("a", [0, 0, 0], [10, 10, 10]), box("b", [5, 5, 5], [10, 10, 10]), box("c", [40, 0, 0], [5, 5, 5])];
  const one = depthSort(scene).order.map((m) => m.key);
  const two = depthSort([...scene].reverse()).order.map((m) => m.key);
  assert.deepEqual(one, two);
  assert.deepEqual(depthSort(scene).conflicts, [["a", "b"]]);
});

test("front projection: nearer (smaller y) is painted last", () => {
  const scene = [box("near", [0, 0, 0], [10, 5, 10]), box("far", [5, 20, 0], [10, 5, 10])];
  assert.deepEqual(depthSort(scene, "front").order.map((m) => m.key), ["far", "near"]);
});

test("stacked boxes: the upper one is painted after the lower one", () => {
  const scene = [box("upper", [0, 0, 10], [10, 10, 4]), box("lower", [0, 0, 0], [10, 10, 10])];
  assert.deepEqual(depthSort(scene).order.map((m) => m.key), ["lower", "upper"]);
});

test("rounded extrusions keep their declared dimensions and an unbroken top rim", () => {
  const m: BoxMark = {...box("rounded", [0,0,0], [28,24,17]), radius:2, inset:true};
  const g=geometryOf(m);
  const xs=g.outline.map(p=>p[0]), ys=g.outline.map(p=>p[1]);
  const trim=4*(2-Math.SQRT2);
  assert.ok(Math.abs(Math.max(...xs)-Math.min(...xs)-(52-trim)*Math.cos(Math.PI/6))<1e-6);
  assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-(17+(52-trim)/2))<1e-6);
  assert.ok(g.faces.length>20,"curved corners have continuously changing face normals");
  assert.ok(g.rim && g.rim.length>20);
  assert.ok(g.inset && g.inset.length>20);
  assert.deepEqual(geometryOf(m,"front").outline,geometryOf({...m,radius:0},"front").outline);
});

// Round parts inside each other's bounding squares but not touching: markers
// around a ring's plinth, pads on it. Order them against true cylinder ray casts.
test("depth sort orders round parts by their real footprints, not their boxes", () => {
  type Cyl = { kind: "cylinder"; key: string; at: Vec3; radius: number; height: number; tone: "subject" };
  const C = Math.cos(Math.PI / 6);
  const hit = (m: Cyl, sx: number, sy: number): number | null => {
    // Ray toward the viewer through screen point (sx, sy): p(t) = p0 + t(1,1,1), starting on z = 0.
    const xmy = sx / C, xpy = 2 * sy;
    const p0x = (xmy + xpy) / 2, p0y = (xpy - xmy) / 2;
    const ox = p0x - m.at[0], oy = p0y - m.at[1];
    // |o + t(1,1)|² = r²
    const A = 2, B = 2 * (ox + oy), K = ox * ox + oy * oy - m.radius * m.radius;
    const disc = B * B - 4 * A * K;
    if (disc < 0) return null;
    const t0 = (-B - Math.sqrt(disc)) / (2 * A), t1 = (-B + Math.sqrt(disc)) / (2 * A);
    const lo = Math.max(t0, m.at[2]), hi = Math.min(t1, m.at[2] + m.height);
    return lo <= hi ? hi : null;
  };
  const r = rng(7);
  let checked = 0;
  for (let trial = 0; trial < 40; trial++) {
    const plinth: Cyl = { kind: "cylinder", key: "plinth", at: [0, 0, 0], radius: 40, height: 6, tone: "subject" };
    const scene: Cyl[] = [plinth];
    for (let k = 0; k < 6; k++) {
      // Outside the plinth's circle, inside its bounding square: on a diagonal.
      const ang = (Math.PI / 4) * (1 + 2 * Math.floor(r() * 4)) + (r() - 0.5) * 0.3;
      const rad = 3 + r() * 2;
      const dist = 40 + rad + 0.5 + r() * 4;
      const c: Cyl = { kind: "cylinder", key: `m${k}`, at: [Math.cos(ang) * dist, Math.sin(ang) * dist, 0], radius: rad, height: 10 + r() * 20, tone: "subject" };
      if (scene.every((o) => Math.hypot(o.at[0] - c.at[0], o.at[1] - c.at[1]) >= o.radius + c.radius)) scene.push(c);
    }
    const { order, conflicts } = depthSort(scene as never);
    assert.deepEqual(conflicts, [], `trial ${trial}`);
    const paint = new Map(order.map((m, i) => [m.key, i]));
    for (let k = 0; k < 600; k++) {
      const sx = (r() - 0.5) * 140, sy = (r() - 0.6) * 100;
      let nearest: string | null = null, best = -Infinity, top: string | null = null, topIndex = -1;
      for (const m of scene) {
        const t = hit(m, sx, sy);
        if (t === null) continue;
        if (t > best + 1e-9) [best, nearest] = [t, m.key];
        if (paint.get(m.key)! > topIndex) [topIndex, top] = [paint.get(m.key)!, m.key];
      }
      if (nearest) { checked++; assert.equal(top, nearest, `trial ${trial} at (${sx.toFixed(1)}, ${sy.toFixed(1)})`); }
    }
  }
  assert.ok(checked > 2000);
});
