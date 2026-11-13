// Keeping the drawing clear of the editorial caption.
//
// The step heading and the prediction card sit over the stage's top-left
// corner. A long rail on the isometric diagonal starts exactly there, so every
// eval scene had to be rearranged by hand to stay out from under it. The camera
// fit now widens the view until no part's silhouette, at rest or in motion,
// falls inside the caption's largest footprint.

import type { Mark, Projection, SolidMark, Vec3 } from "../core/types.ts";
import { DROP } from "../core/interpolate.ts";
import { project, type Pt } from "../iso/project.ts";
import { boundsOf, type Bounds } from "../iso/solids.ts";

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type ViewBox = [number, number, number, number];

const solid = (m: Mark): m is SolidMark => m.kind === "box" || m.kind === "cylinder";

function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function boxHull(b: Bounds, projection: Projection): Pt[] {
  const corners: Pt[] = [];
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) corners.push(project([x, y, z] as Vec3, projection));
  return hull(corners);
}

const raise = (b: Bounds, dz: number): Bounds => ({ min: [b.min[0], b.min[1], b.min[2] + dz], max: [b.max[0], b.max[1], b.max[2] + dz] });

/** Screen silhouettes of every solid in every state, including where drops, lifts and travels take them. */
export function silhouettes(allMarks: readonly (readonly Mark[])[], projection: Projection): Pt[][] {
  const out: Pt[][] = [];
  const seen = new Set<string>();
  const push = (b: Bounds) => {
    const id = [...b.min, ...b.max].map((n) => n.toFixed(2)).join(",");
    if (seen.has(id)) return;
    seen.add(id);
    out.push(boxHull(b, projection));
  };
  for (const marks of allMarks) for (const m of marks) {
    if (!solid(m)) continue;
    const b = boundsOf(m);
    push(b);
    // Mostly transparent over the top half of a drop or lift, as in fitViewBox.
    if (m.enter === "drop" || m.exit === "lift") push(raise(b, DROP / 2));
    if (m.arc) push(raise(b, m.arc));
    if (m.transient && m.travel) for (const p of [m.travel.from, m.travel.to]) push(boundsOf({ ...m, at: p } as SolidMark));
  }
  return out;
}

/** Clip a convex polygon to the horizontal band y0..y1. */
function clipBand(poly: Pt[], y0: number, y1: number): Pt[] {
  const clip = (input: Pt[], keep: (p: Pt) => boolean, cut: (a: Pt, b: Pt) => Pt) => {
    const out: Pt[] = [];
    input.forEach((cur, i) => {
      const prev = input[(i + input.length - 1) % input.length]!;
      if (keep(cur)) {
        if (!keep(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (keep(prev)) out.push(cut(prev, cur));
    });
    return out;
  };
  const atY = (y: number) => (a: Pt, b: Pt): Pt => [a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y];
  const top = clip(poly, (p) => p[1] >= y0, atY(y0));
  return top.length ? clip(top, (p) => p[1] <= y1, atY(y1)) : [];
}

/** Clip a convex polygon to the vertical band x0..x1. */
function clipColumn(poly: Pt[], x0: number, x1: number): Pt[] {
  const swap = (p: Pt): Pt => [p[1], p[0]];
  return clipBand(poly.map(swap), x0, x1).map(swap);
}

/**
 * How far the drawing reaches into a reserved rectangle (in drawing units):
 * `right` is how far the view must grow leftward so everything in the band of
 * the rectangle starts right of it; `down` is the same upward.
 */
export function intrusion(shapes: readonly Pt[][], r: Rect): { right: number; down: number } | null {
  let right = 0, down = 0, any = false;
  for (const s of shapes) {
    if (!overlapsRect(s, r)) continue;
    any = true;
    // The part of the shape level with the rectangle must start right of it, or
    // the part of the shape below its columns must start under it.
    const band = clipBand(s, r.y0, r.y1), column = clipColumn(s, r.x0, r.x1);
    if (band.length) right = Math.max(right, r.x1 - Math.min(...band.map((p) => p[0])));
    if (column.length) down = Math.max(down, r.y1 - Math.min(...column.map((p) => p[1])));
  }
  return any ? { right, down } : null;
}

function overlapsRect(poly: Pt[], r: Rect): boolean {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  if (Math.max(...xs) <= r.x0 || Math.min(...xs) >= r.x1 || Math.max(...ys) <= r.y0 || Math.min(...ys) >= r.y1) return false;
  // Separating axes of the polygon's edges.
  const corners: Pt[] = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const n: Pt = [b[1] - a[1], a[0] - b[0]];
    const proj = (p: Pt) => p[0] * n[0] + p[1] * n[1];
    const pp = poly.map(proj), rp = corners.map(proj);
    if (Math.max(...pp) <= Math.min(...rp) + 1e-9 || Math.max(...rp) <= Math.min(...pp) + 1e-9) return false;
  }
  return true;
}

/**
 * Grow a view box until no shape falls inside a reserved screen rectangle.
 * `rectFor(vb)` gives that rectangle in drawing units for a candidate box (it
 * depends on the box, because the scale does). Each round grows by the smaller
 * of the two escapes (left or up), so the drawing shrinks as little as it can.
 */
export function clearOf(vb: ViewBox, shapes: readonly Pt[][], rectFor: (vb: ViewBox) => Rect | null, rounds = 10): ViewBox {
  let box: ViewBox = [...vb];
  for (let i = 0; i < rounds; i++) {
    const r = rectFor(box);
    if (!r) return box;
    const hit = intrusion(shapes, r);
    if (!hit) return box;
    const grow = Math.min(hit.right, hit.down) + 0.5;
    box = hit.right <= hit.down ? [box[0] - grow, box[1], box[2] + grow, box[3]] : [box[0], box[1] - grow, box[2], box[3] + grow];
  }
  return box;
}
