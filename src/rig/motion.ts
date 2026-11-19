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

export interface TurningPartOptions {
  /** the drawings' id stem: bin k is `${id}-${k}` */
  id: string;
  /** the part's symmetry, radians: one tooth of a wheel, a third of a turn for three spokes; 2π for none */
  period?: number;
  /**
   * How far the drawing reaches along the plane's normal, from the plane's origin, at rest: every
   * face, bolt, roller and pin it draws must lie between n0 and n1.
   */
  n0: number;
  n1: number;
  /** the worst screen error allowed, px (default 0.5) */
  maxErrPx?: number;
  /** svg units per screen px (default 10: a 14200-wide viewBox on a 1440 px page) */
  unitsPerPx?: number;
  /** at least this many drawings across the period (to keep a part's existing angles) */
  minBins?: number;
  /** the part drawn turned by `rot` radians (from u toward v) about the plane's origin */
  draw: (rot: number, bin: number) => string;
  /**
   * Where drawings go: given an id and how to make it, register `<g id=…>` once and return its href.
   * Without it the part keeps its own and hands new ones out through drain().
   */
  def?: (id: string, make: () => string) => string;
}

export interface Turned {
  href: string;
  transform: string;
  /** the worst screen error of this placement, px: hand it to the stage as Placed.turnErrPx */
  turnErrPx: number;
  bin: number;
  rest: number;
}

export interface TurningPart {
  bins: number;
  /** radians between drawings */
  step: number;
  /** the plane the part is placed by: halfway through what it draws */
  mid: number;
  /** the worst error any placement can leave, px */
  worstErrPx: number;
  /** the exact error, px, of a placement that turns the drawing by `rest` */
  errPx(rest: number): number;
  href(bin: number): string;
  /** turned by `theta` about the plane's origin, shifted by `to` in the plane and `shift` along its normal */
  place(theta: number, to: P2, shift: number): Turned;
  /** draw ahead every drawing (or only those for angles from a0 to a1), so no frame pays for one */
  drawAll(a0?: number, a1?: number): void;
  /** drawings made since the last drain (only without `def`) */
  drain(): string[];
}

/**
 * A thick part that turns in a plane, drawn once per angle bin and placed by one transform.
 *
 * A transform that turns a drawing is exact on one plane only. With B the screen image of the
 * plane's axes and N that of its normal, a point d from the placing plane lands off by
 * |(B·R(rest)·B⁻¹ − I)·N|·|d|, wherever it is in the plane. So the part is placed by its mid-plane
 * ((n0 + n1) / 2, where |d| is at most half its thickness), and gets the fewest drawings across its
 * symmetry that keep that error under maxErrPx at the worst turn left over. Each placement reports
 * its own exact error, for the page to record (RigStage, Placed.turnErrPx).
 */
export function turningPart(cam: Camera, plane: PlaneAxes, o: TurningPartOptions): TurningPart {
  const period = o.period ?? 2 * Math.PI, maxErr = o.maxErrPx ?? 0.5, upp = o.unitsPerPx ?? 10;
  if (!(o.n1 >= o.n0)) throw new RangeError(`turningPart ${o.id}: n1 must not be below n0`);
  const mid = (o.n0 + o.n1) / 2, half = (o.n1 - o.n0) / 2;
  const N = stepOf(cam, plane.n);
  const errPx = (rest: number): number => {
    const m = moveInPlane(cam, plane, rest, [0, 0], 0, 0);
    const ex = (m[0] - 1) * N[0] + m[2] * N[1], ey = m[1] * N[0] + (m[3] - 1) * N[1];
    return (Math.hypot(ex, ey) * half) / upp;
  };
  const worstFor = (bins: number) => {
    const h = period / bins / 2;
    let w = 0;
    for (let i = 0; i <= 64; i++) w = Math.max(w, errPx(-h + (2 * h * i) / 64));
    return w;
  };
  // a little under budget, so the transform's printed digits never tip a placement over it
  let bins = Math.max(1, Math.ceil(o.minBins ?? 1));
  while (worstFor(bins) >= maxErr * 0.98) {
    if (bins > 4096) throw new RangeError(`turningPart ${o.id}: no bin count keeps the error under ${maxErr} px`);
    bins++;
  }
  const step = period / bins;
  const own = new Map<string, { svg: string; sent: boolean }>();
  const def = o.def ?? ((id: string, make: () => string) => {
    if (!own.has(id)) own.set(id, { svg: `<g id="${id}">${make()}</g>`, sent: false });
    return `#${id}`;
  });
  const href = (bin: number) => {
    const b = ((bin % bins) + bins) % bins;
    return def(`${o.id}-${b}`, () => o.draw(b * step, b));
  };
  return {
    bins, step, mid, worstErrPx: worstFor(bins), errPx, href,
    place(theta, to, shift) {
      const { bin, rest } = angleBin(theta, period, bins);
      const m = moveInPlane(cam, plane, rest, to, mid, mid + shift);
      // printed finer than affineString: a turned part's error budget is a fraction of a pixel
      const transform = `matrix(${m.slice(0, 4).map((x) => +x.toFixed(6)).join(" ")} ${+m[4].toFixed(2)} ${+m[5].toFixed(2)})`;
      return { href: href(bin), transform, turnErrPx: errPx(rest), bin, rest };
    },
    drawAll(a0, a1) {
      if (a0 === undefined || a1 === undefined || Math.abs(a1 - a0) >= period) for (let b = 0; b < bins; b++) href(b);
      else for (let k = Math.round(Math.min(a0, a1) / step); k <= Math.round(Math.max(a0, a1) / step); k++) href(k);
    },
    drain() {
      const out: string[] = [];
      for (const d of own.values()) if (!d.sent) (out.push(d.svg), (d.sent = true));
      return out;
    },
  };
}
