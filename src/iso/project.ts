import type { Projection, Vec3 } from "../core/types.ts";

export type Pt = readonly [number, number];

const C = Math.cos(Math.PI / 6);
const S = 0.5;

/**
 * World to screen. World: x and y on the floor, z up.
 *
 * iso:   the classic 30° isometric view from the (+x, +y, +z) side.
 *        Screen x grows with x - y; screen y grows with x + y and falls with z.
 * front: a flat orthographic view from -y. Screen x is world x, screen y is -z.
 */
export function project(p: Vec3, projection: Projection = "iso"): Pt {
  if (projection === "front") return [p[0], -p[2]];
  return [(p[0] - p[1]) * C, (p[0] + p[1]) * S - p[2]];
}

/** The direction toward the viewer. Larger dot product means nearer. */
export function viewVector(projection: Projection = "iso"): Vec3 {
  return projection === "front" ? [0, -1, 0] : [1, 1, 1];
}

export function depth(p: Vec3, projection: Projection = "iso"): number {
  const v = viewVector(projection);
  return p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
}

/** Semi-axes of a horizontal circle of radius r as drawn on screen. */
export function ellipseAxes(r: number, projection: Projection = "iso"): Pt {
  if (projection === "front") return [r, 0];
  return [Math.SQRT2 * C * r, Math.SQRT2 * S * r];
}
