// Draw once, then move: the one transform that moves a drawn part, and the painter's slots.
//
// In an orthographic view, a flat part turning or sliding within its own plane maps to a single 2D
// affine transform on screen: the camera is linear, so a rigid motion inside the plane becomes
// B·R·B⁻¹ plus a shift, where B is the screen image of the plane's two axes. A part drawn once at
// rest can therefore be moved exactly, every frame, by setting one SVG transform.

import { stepOf, type Camera } from "./camera.ts";
import type { V3, P2 } from "./vec.ts";

export type Affine = [number, number, number, number, number, number]; // SVG matrix(a b c d e f)

export interface PlaneAxes {
  u: V3;
  v: V3;
  n: V3;
  /** a world point on the plane: the rest position's origin */
  origin: V3;
}

/**
 * The transform that takes a part drawn at rest (plane coordinates (a, b), offset `fromN` along the
 * normal) to the same part turned by `theta` (radians, from u toward v) about the plane's origin,
 * then shifted by `to` in the plane and set at offset `toN` along the normal.
 * Exact for every point of a part that lies in planes parallel to this one.
 */
export function moveInPlane(cam: Camera, pl: PlaneAxes, theta: number, to: P2, fromN: number, toN: number): Affine {
  const U = stepOf(cam, pl.u), Vv = stepOf(cam, pl.v), N = stepOf(cam, pl.n);
  const det = U[0] * Vv[1] - Vv[0] * U[1];
  if (Math.abs(det) < 1e-12) throw new Error("moveInPlane: the plane is seen edge-on, so a motion within it has no 2D transform");
  const inv = [Vv[1] / det, -Vv[0] / det, -U[1] / det, U[0] / det] as const; // B⁻¹ rows
  const c = Math.cos(theta), s = Math.sin(theta);
  // B·R, with B's columns U and V
  const br = [U[0] * c + Vv[0] * s, -U[0] * s + Vv[0] * c, U[1] * c + Vv[1] * s, -U[1] * s + Vv[1] * c] as const;
  const a = br[0] * inv[0] + br[1] * inv[2], cc = br[0] * inv[1] + br[1] * inv[3];
  const b = br[2] * inv[0] + br[3] * inv[2], d = br[2] * inv[1] + br[3] * inv[3];
  const O = stepOf(cam, pl.origin);
  const base: P2 = [cam.origin[0] + O[0], cam.origin[1] + O[1]];
  const src: P2 = [base[0] + N[0] * fromN, base[1] + N[1] * fromN];
  const dst: P2 = [base[0] + U[0] * to[0] + Vv[0] * to[1] + N[0] * toN, base[1] + U[1] * to[0] + Vv[1] * to[1] + N[1] * toN];
  return [a, b, cc, d, dst[0] - (a * src[0] + cc * src[1]), dst[1] - (b * src[0] + d * src[1])];
}

export const affineString = (m: Affine): string => `matrix(${m.slice(0, 4).map((x) => +x.toFixed(4)).join(" ")} ${m[4].toFixed(1)} ${m[5].toFixed(1)})`;
export const applyAffine = (m: Affine, p: P2): P2 => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/**
 * Painter's slots for parts that are slabs between parallel planes (a cassette's cogs, the chain,
 * pulleys and cage). `planes` are the positions of the fixed slabs along the normal, sorted from
 * far to near. A fixed slab k gets key 2k; anything else sits in the gap after every plane at or
 * behind it, at a fixed `rank` (0..1) inside the gap. Keys change only when a part really crosses
 * a plane, so the order never flickers between near ties.
 */
export function slotKey(planes: readonly number[], pos: number, rank: number): number {
  let c = 0;
  while (c < planes.length && planes[c]! <= pos + 1e-3) c++;
  return 2 * c - 1 + Math.max(0, Math.min(0.999, rank));
}
export const planeKey = (k: number): number => 2 * k;

/**
 * A part that turns, drawn ahead at `bins` angles across its symmetry `period` (2π for none, one
 * tooth for a sprocket): which drawing to show, and the small turn left for its transform. A thick
 * part turned by a transform is exact on the face it is placed by (fromN) and off by at most
 * |Δt|·|rest| times the screen length of the normal across its thickness, so a few bins keep that
 * well under a pixel.
 */
export function angleBin(theta: number, period: number, bins: number): { bin: number; rest: number } {
  const step = period / bins;
  const k = Math.round(theta / step);
  return { bin: ((k % bins) + bins) % bins, rest: theta - k * step };
}
