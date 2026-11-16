// An orthographic camera at any azimuth and elevation, fitted to a figure's bounds.
//
// The viewer looks along -toward. Azimuth turns the viewer about the vertical (z) axis, from +x
// toward +y; elevation raises them above the floor. Screen x runs along `right`, screen y down
// (SVG), so up on screen is -`up`. Depth grows toward the viewer.

import { cross, dot, type P2, type V3 } from "./vec.ts";

export interface Camera {
  azimuth: number; // degrees
  elevation: number; // degrees
  scale: number; // svg units per world unit
  origin: P2; // where the world origin lands on screen
}

export interface Axes {
  right: V3;
  up: V3;
  toward: V3;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function axesOf(azimuth: number, elevation: number): Axes {
  const a = rad(azimuth), e = rad(elevation);
  const toward: V3 = [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
  const right: V3 = [-Math.sin(a), Math.cos(a), 0];
  return { right, up: cross(toward, right), toward };
}

/** Where a world point lands on screen. */
export function screenOf(cam: Camera, p: V3, ax: Axes = axesOf(cam.azimuth, cam.elevation)): P2 {
  return [cam.origin[0] + cam.scale * dot(p, ax.right), cam.origin[1] - cam.scale * dot(p, ax.up)];
}

/** How far a world point sits toward the viewer. */
export function nearness(cam: Camera, p: V3, ax: Axes = axesOf(cam.azimuth, cam.elevation)): number {
  return dot(p, ax.toward);
}

/** The screen step for a world direction (the camera's linear part). */
export function stepOf(cam: Camera, v: V3, ax: Axes = axesOf(cam.azimuth, cam.elevation)): P2 {
  return [cam.scale * dot(v, ax.right), -cam.scale * dot(v, ax.up)];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The camera that fits every point into the box, centred, at the given angles. */
export function fitCamera(points: readonly V3[], box: Box, azimuth: number, elevation: number): Camera {
  const ax = axesOf(azimuth, elevation);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) {
    const x = dot(p, ax.right), y = -dot(p, ax.up);
    x0 = Math.min(x0, x), x1 = Math.max(x1, x), y0 = Math.min(y0, y), y1 = Math.max(y1, y);
  }
  const scale = Math.min(box.w / Math.max(1e-9, x1 - x0), box.h / Math.max(1e-9, y1 - y0));
  return { azimuth, elevation, scale, origin: [box.x + box.w / 2 - (scale * (x0 + x1)) / 2, box.y + box.h / 2 - (scale * (y0 + y1)) / 2] };
}

/** A second camera, magnified, with the world point `focus` at screen point `at`. */
export function insetCamera(azimuth: number, elevation: number, scale: number, focus: V3, at: P2): Camera {
  const cam: Camera = { azimuth, elevation, scale, origin: [0, 0] };
  const f = screenOf(cam, focus);
  return { ...cam, origin: [at[0] - f[0], at[1] - f[1]] };
}
