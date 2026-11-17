// Shapes as closed meshes: plates extruded from any 2D outline (holes allowed), turned parts
// from a profile, and rods. Every face carries its outward normal, so drawing can shade it by the
// light and find the silhouette from which faces turn away.

import { add, along, area2, cross, dot, scale, sub, unit, type P2, type V3 } from "./vec.ts";

export type Role = "cap" | "wall" | "band" | "end";

export interface Face {
  /** Vertex indices: the outer loop first, then any holes. */
  loops: number[][];
  normal: V3;
  role: Role;
}

export interface Mesh {
  verts: V3[];
  faces: Face[];
}

/** A plane: points are origin + a·u + b·v, and n = u × v is its normal. */
export interface Plane {
  origin: V3;
  u: V3;
  v: V3;
  n: V3;
}

/** The plane through `origin` with normal `normal`; `uHint` sets the in-plane x direction. */
export function planeOf(origin: V3, normal: V3, uHint: V3): Plane {
  const n = unit(normal);
  const u = unit(sub(uHint, scale(n, dot(uHint, n))));
  return { origin, u, v: cross(n, u), n };
}

export const pointOn = (pl: Plane, a: number, b: number, t = 0): V3 => along(along(along(pl.origin, pl.u, a), pl.v, b), pl.n, t);

export interface Outline {
  outer: readonly P2[];
  holes?: readonly (readonly P2[])[];
}

/** An outline extruded along the plane's normal from t0 to t1: two caps and a wall per edge. */
export function plate(pl: Plane, outline: Outline, t0: number, t1: number): Mesh {
  const ccw = (loop: readonly P2[], want: boolean) => (area2(loop) > 0 === want ? [...loop] : [...loop].reverse());
  const loops = [ccw(outline.outer, true), ...(outline.holes ?? []).map((h) => ccw(h, false))];
  const verts: V3[] = [];
  const low: number[][] = [], high: number[][] = [];
  for (const loop of loops) {
    low.push(loop.map(([a, b]) => verts.push(pointOn(pl, a, b, t0)) - 1));
    high.push(loop.map(([a, b]) => verts.push(pointOn(pl, a, b, t1)) - 1));
  }
  const faces: Face[] = [
    { loops: high.map((l) => [...l]), normal: pl.n, role: "cap" },
    { loops: low.map((l) => [...l].reverse()), normal: scale(pl.n, -1), role: "cap" },
  ];
  loops.forEach((loop, k) => {
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      const da = loop[j]![0] - loop[i]![0], db = loop[j]![1] - loop[i]![1];
      // to the right of travel: outward round a counter-clockwise outer loop, into a clockwise hole
      const normal = unit(add(scale(pl.u, db), scale(pl.v, -da)));
      faces.push({ loops: [[low[k]![i]!, low[k]![j]!, high[k]![j]!, high[k]![i]!]], normal, role: "wall" });
    }
  });
  return { verts, faces };
}

/**
 * A part turned about an axis: profile points [s along the axis, r from it]. The ends are closed
 * where the radius there is not zero. `segments` is the number of facets round the axis.
 */
export function turned(origin: V3, axis: V3, profile: readonly P2[], segments = 32, uHint: V3 = [0, 0, 1]): Mesh {
  const a = unit(axis);
  const helper: V3 = Math.abs(dot(unit(uHint), a)) > 0.95 ? [1, 0, 0] : uHint;
  const pl = planeOf(origin, a, helper);
  const verts: V3[] = [];
  const rings = profile.map(([s, r]) => Array.from({ length: segments }, (_, i) => {
    const t = (2 * Math.PI * i) / segments;
    return verts.push(along(along(along(origin, a, s), pl.u, r * Math.cos(t)), pl.v, r * Math.sin(t))) - 1;
  }));
  const faces: Face[] = [];
  for (let k = 0; k + 1 < profile.length; k++) {
    const [s0, r0] = profile[k]!, [s1, r1] = profile[k + 1]!;
    const ds = s1 - s0, dr = r1 - r0;
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const t = (2 * Math.PI * (i + 0.5)) / segments;
      const radial = add(scale(pl.u, Math.cos(t)), scale(pl.v, Math.sin(t)));
      const normal = unit(add(scale(radial, ds), scale(a, -dr)));
      faces.push({ loops: [[rings[k]![i]!, rings[k]![j]!, rings[k + 1]![j]!, rings[k + 1]![i]!]], normal, role: "band" });
    }
  }
  if (profile[0]![1] > 1e-9) faces.push({ loops: [[...rings[0]!].reverse()], normal: scale(a, -1), role: "end" });
  if (profile[profile.length - 1]![1] > 1e-9) faces.push({ loops: [[...rings[rings.length - 1]!]], normal: a, role: "end" });
  return { verts, faces };
}

/** A cylinder from a to b. */
export const rod = (a: V3, b: V3, r: number, segments = 20): Mesh => {
  const d = sub(b, a), L = Math.hypot(d[0], d[1], d[2]);
  return turned(a, d, [[0, r], [L, r]], segments);
};

/** A round outline: n points on a circle. */
export const circlePoints = (r: number, n = 48, cx = 0, cy = 0, phase = 0): P2[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(phase + (2 * Math.PI * i) / n), cy + r * Math.sin(phase + (2 * Math.PI * i) / n)]);

/** The outline round a chain of circles: a link, a cage plate, a knuckle (convex). */
export function roundedHull(circles: readonly (readonly [number, number, number])[], n = 24): P2[] {
  const pts: P2[] = circles.flatMap(([cx, cy, r]) => circlePoints(r, n, cx, cy));
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [], upper: P2[] = [];
  for (const q of p) {
    while (lower.length > 1 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length > 1 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A sprocket's outline: `teeth` teeth on pitch radius R, tips `tip` beyond it, seats below it. */
export function sprocket(teeth: number, R: number, tip: number, rot = 0): P2[] {
  const out: P2[] = [], step = (2 * Math.PI) / teeth, root = R - 3;
  for (let j = 0; j < teeth; j++) {
    const a = rot + j * step;
    for (const [f, r] of [[-0.5, root], [-0.32, root + 0.6], [-0.1, R + tip], [0.1, R + tip], [0.32, root + 0.6]] as const) out.push([r * Math.cos(a + f * step), r * Math.sin(a + f * step)]);
  }
  return out;
}
