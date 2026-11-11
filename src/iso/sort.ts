import type { Projection, SolidMark } from "../core/types.ts";
import { viewVector } from "./project.ts";
import { boundsOf, type Bounds } from "./solids.ts";

const EPS = 1e-6;

/**
 * Screen-space extents of an axis-aligned box along the three directions
 * its isometric hexagon's edges are parallel to. Two such hexagons overlap
 * exactly when all three ranges overlap.
 */
function isoRanges(b: Bounds): [number, number][] {
  return [
    [b.min[0] - b.max[1], b.max[0] - b.min[1]], // x - y
    [b.min[0] - b.max[2], b.max[0] - b.min[2]], // x - z
    [b.min[1] - b.max[2], b.max[1] - b.min[2]], // y - z
  ];
}

export function screenOverlap(a: Bounds, b: Bounds, projection: Projection = "iso"): boolean {
  if (projection === "front") {
    return a.min[0] < b.max[0] - EPS && b.min[0] < a.max[0] - EPS && a.min[2] < b.max[2] - EPS && b.min[2] < a.max[2] - EPS;
  }
  const ra = isoRanges(a);
  const rb = isoRanges(b);
  for (let i = 0; i < 3; i++) {
    if (ra[i]![1] <= rb[i]![0] + EPS || rb[i]![1] <= ra[i]![0] + EPS) return false;
  }
  return true;
}

/**
 * -1 if a must be painted before b, 1 if after, 0 if the boxes intersect
 * and no axis separates them.
 *
 * For the isometric view, when two hexagons overlap on screen every
 * separating world axis agrees on the order: an axis pair disagreeing would
 * separate them on screen. So the first separating axis decides.
 */
export function paintOrder(a: Bounds, b: Bounds, projection: Projection = "iso"): -1 | 0 | 1 {
  const v = viewVector(projection);
  for (let axis = 0; axis < 3; axis++) {
    const dir = v[axis]!;
    if (dir === 0) continue;
    if (a.max[axis]! <= b.min[axis]! + EPS) return dir > 0 ? -1 : 1;
    if (b.max[axis]! <= a.min[axis]! + EPS) return dir > 0 ? 1 : -1;
  }
  return 0;
}

function centreDepth(b: Bounds, projection: Projection): number {
  const v = viewVector(projection);
  let d = 0;
  for (let i = 0; i < 3; i++) d += ((b.min[i]! + b.max[i]!) / 2) * v[i]!;
  return d;
}

export interface SortResult<M> {
  order: M[];
  /** Pairs that intersect in 3D, so no painter's order is correct. */
  conflicts: [string, string][];
}

/**
 * Painter's order for solids: back to front, deterministic.
 * Builds "must be drawn before" edges for every pair that overlaps on
 * screen, then a topological sort that breaks ties by centre depth and key.
 */
export function depthSort<M extends SolidMark>(marks: readonly M[], projection: Projection = "iso"): SortResult<M> {
  const n = marks.length;
  const bounds = marks.map(boundsOf);
  const depthOf = bounds.map((b) => centreDepth(b, projection));
  const after: number[][] = Array.from({ length: n }, () => []);
  const indegree = new Array<number>(n).fill(0);
  const conflicts: [string, string][] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!screenOverlap(bounds[i]!, bounds[j]!, projection)) continue;
      const o = paintOrder(bounds[i]!, bounds[j]!, projection);
      if (o === 0) {
        conflicts.push([marks[i]!.key, marks[j]!.key]);
        continue;
      }
      const [first, second] = o < 0 ? [i, j] : [j, i];
      after[first]!.push(second);
      indegree[second]!++;
    }
  }

  const rank = (i: number, j: number) =>
    depthOf[i]! - depthOf[j]! || (marks[i]!.key < marks[j]!.key ? -1 : marks[i]!.key > marks[j]!.key ? 1 : 0);

  const ready: number[] = [];
  for (let i = 0; i < n; i++) if (indegree[i] === 0) ready.push(i);
  const done = new Array<boolean>(n).fill(false);
  const order: M[] = [];

  while (order.length < n) {
    if (ready.length === 0) {
      // A cycle from intersecting solids: release the farthest remaining one.
      let pick = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || rank(i, pick) < 0)) pick = i;
      ready.push(pick);
      indegree[pick] = 0;
    }
    ready.sort(rank);
    const i = ready.shift()!;
    if (done[i]) continue;
    done[i] = true;
    order.push(marks[i]!);
    for (const j of after[i]!) {
      if (done[j]) continue;
      if (--indegree[j]! === 0) ready.push(j);
    }
  }
  return { order, conflicts };
}
