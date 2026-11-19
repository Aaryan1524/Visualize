// What concepts are made of, as rig solids: cells and slots with printed values, rails of cells with
// their indices, a token or key card, a ring of slots, a pointer, and an arrow between parts drawn in
// the figure's projection. The same look as a machine (shaded solids, one key light, the rig's
// materials), and the same rule: each solid is drawn once and only moved. A value changes by swapping
// a small printed decal, and a tone by a data attribute on the part (`flags`), never by rebuilding the
// solid.
//
// The concept world: x to the right along a rail, y away from the viewer, z up; parts stand on the
// floor z = 0, in millimetres. A good camera is CONCEPT_VIEW, from in front and a little to the left.
//
//   const C = cellDrawing(cam, { w: 20, d: 20, h: 9 });        // once
//   items.push({ id: "bit3", key, transform: placeAt(cam, at), flags: { "t-set": true }, part: "bits" });
//   items.push({ id: "bit3-v", key: key + 0.5, transform: decalAt(cam, top(at, 9)), svg: valueText("1", 9), part: "bits" });

import { axesOf, screenOf, stepOf, type Camera } from "./camera.ts";
import { drawMesh } from "./draw.ts";
import { moveInPlane, affineString } from "./motion.ts";
import { circlePoints, planeOf, plate, roundedHull, turned, type Mesh } from "./shapes.ts";
import { pathThrough, type P2, type V3 } from "./vec.ts";

export const CONCEPT_VIEW = { azimuth: 247, elevation: 32 };
const UP: V3 = [0, 0, 1];
const FLOOR = planeOf([0, 0, 0], UP, [1, 0, 0]);
const FLOOR_AXES = { origin: [0, 0, 0] as V3, u: FLOOR.u, v: FLOOR.v, n: FLOOR.n };
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** A rounded rectangle's outline in the floor plane, centred on the origin. */
export function roundedRect(w: number, d: number, r: number): P2[] {
  const x = w / 2 - r, y = d / 2 - r;
  return roundedHull([[-x, -y, r], [x, -y, r], [x, y, r], [-x, y, r]], 10);
}

/** A slab standing on the floor, centred on the origin: footprint w by d, height h. */
export const slab = (w: number, d: number, h: number, r = Math.min(w, d) * 0.14): Mesh => plate(FLOOR, { outer: roundedRect(w, d, r) }, 0, h);

/**
 * A cell or slot, drawn once at the origin: a rounded block with a shallow well on top, in the
 * `cell` material (rig.css), whose tones the part's flags set: t-set, t-hot, t-good, t-bad.
 */
export function cellDrawing(cam: Camera, o: { w: number; d: number; h: number; material?: string }): string {
  const lip = Math.min(o.w, o.d) * 0.12;
  return drawMesh(slab(o.w, o.d, o.h), cam, { material: o.material ?? "cell", shine: true }) +
    drawMesh(plate(planeOf([0, 0, o.h - 0.01], UP, [1, 0, 0]), { outer: roundedRect(o.w - 2 * lip, o.d - 2 * lip, Math.min(o.w, o.d) * 0.08) }, -0.6, 0), cam, { material: o.material ?? "cell" });
}

/** A token or key card, drawn once at the origin: a thin raised card in the `card` material. */
export const cardDrawing = (cam: Camera, o: { w: number; d: number; h?: number; material?: string }): string =>
  drawMesh(slab(o.w, o.d, o.h ?? 4, Math.min(o.w, o.d) * 0.22), cam, { material: o.material ?? "card", shine: true });

/** A pointer or marker, drawn once at the origin: a pin standing on the floor with a ball on top. */
export function markerDrawing(cam: Camera, o: { h: number; r?: number; material?: string }): string {
  const r = o.r ?? 1.6;
  return drawMesh(turned([0, 0, 0], UP, [[0, r], [o.h - 3 * r, r * 0.8]], 18), cam, { material: "steel", shine: true }) +
    drawMesh(turned([0, 0, o.h - 4 * r], UP, [[0, 0.01], [0.6 * r, 1.6 * r], [2 * r, 2.2 * r], [3.4 * r, 1.6 * r], [4 * r, 0.01]], 18), cam, { material: o.material ?? "subject", shine: true });
}

/** A floor plate under a group of parts: quiet context. */
export const boardDrawing = (cam: Camera, o: { w: number; d: number; h?: number }): string =>
  drawMesh(plate(planeOf([0, 0, -(o.h ?? 3)], UP, [1, 0, 0]), { outer: roundedRect(o.w, o.d, 4) }, 0, o.h ?? 3), cam, { material: "frame" });

/** Where a part drawn at the origin goes: a world translation is a screen translation (the camera is linear). */
export function placeAt(cam: Camera, at: V3): string {
  const a = screenOf(cam, at), o = screenOf(cam, [0, 0, 0]);
  return `translate(${f1(a[0] - o[0])} ${f1(a[1] - o[1])})`;
}

/** A part drawn at the origin, turned by `theta` about the vertical and set at `at` on the floor (a ring's slot). */
export const turnAt = (cam: Camera, theta: number, at: V3, z = 0): string => affineString(moveInPlane(cam, FLOOR_AXES, theta, [at[0], at[1]], z, z + at[2]));

/**
 * A decal lying flat on a horizontal face at height `centre[2]`: maps face coordinates (x to the
 * right, y toward the viewer, in mm) to the screen, so text printed at the origin reads on the face.
 */
export function decalAt(cam: Camera, centre: V3): string {
  const U = stepOf(cam, [1, 0, 0]), Vv = stepOf(cam, [0, -1, 0]), o = screenOf(cam, centre);
  return `matrix(${[U[0], U[1], Vv[0], Vv[1]].map((x) => +x.toFixed(4)).join(" ")} ${f1(o[0])} ${f1(o[1])})`;
}

/** A printed value for a decal, `size` mm tall, centred on the origin. Swap the string to change it. */
export const valueText = (text: string, size: number, cls = "rig-value"): string =>
  `<text class="${cls}" x="0" y="${f1(size * 0.36)}" font-size="${f1(size)}" text-anchor="middle">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;

/** The centres of n cells in a rail along x, `pitch` apart, the first at `origin`. */
export const railCentres = (n: number, pitch: number, origin: V3 = [0, 0, 0]): V3[] => Array.from({ length: n }, (_, i) => [origin[0] + i * pitch, origin[1], origin[2]]);

/** The centres and headings of n slots on a ring of radius r about `centre`, the first at the front. */
export const ringSlots = (n: number, r: number, centre: V3 = [0, 0, 0]): { at: V3; theta: number }[] =>
  circlePoints(r, n, 0, 0, -Math.PI / 2).map(([x, y], i) => ({ at: [centre[0] + x, centre[1] + y, centre[2]] as V3, theta: (2 * Math.PI * i) / n }));

/**
 * An arrow between two points of the figure, drawn in its projection: an arc lifted `lift` mm above
 * the straight line between them, with its head at `to`. Rebuilt when its ends move (a short path,
 * not a solid). Returns the SVG and the screen points of its ends.
 */
export function arrow(cam: Camera, from: V3, to: V3, o: { lift?: number; head?: number; cls?: string; via?: V3[] } = {}): { svg: string; a: P2; b: P2 } {
  const ax = axesOf(cam.azimuth, cam.elevation), lift = o.lift ?? 12, pts: P2[] = [];
  if (o.via?.length) {
    // through the given points, on a smooth curve (Catmull-Rom): to route round parts, such as over
    // the gap between two cells instead of across the value printed on one
    const P = [from, ...o.via, to], seg = 14;
    for (let s = 0; s < P.length - 1; s++) {
      const p0 = P[Math.max(0, s - 1)]!, p1 = P[s]!, p2 = P[s + 1]!, p3 = P[Math.min(P.length - 1, s + 2)]!;
      for (let i = 0; i < seg; i++) {
        const t = i / seg, t2 = t * t, t3 = t2 * t;
        const c = (k: number) => 0.5 * (2 * p1[k]! + (-p0[k]! + p2[k]!) * t + (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 + (-p0[k]! + 3 * p1[k]! - 3 * p2[k]! + p3[k]!) * t3);
        pts.push(screenOf(cam, [c(0), c(1), c(2)], ax));
      }
    }
    pts.push(screenOf(cam, to, ax));
  } else {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, h = 4 * lift * t * (1 - t);
      pts.push(screenOf(cam, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t + h], ax));
    }
  }
  const n = pts.length - 1, b = pts[n]!, p = pts[n - 2]!, len = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1, u: P2 = [(b[0] - p[0]) / len, (b[1] - p[1]) / len];
  const size = (o.head ?? 3.4) * cam.scale, nrm: P2 = [-u[1], u[0]], base: P2 = [b[0] - u[0] * size, b[1] - u[1] * size];
  const head = pathThrough([b, [base[0] + nrm[0] * size * 0.42, base[1] + nrm[1] * size * 0.42], [base[0] - nrm[0] * size * 0.42, base[1] - nrm[1] * size * 0.42]]);
  const line = pathThrough([...pts.slice(0, n - 1), [base[0] + u[0] * size * 0.3, base[1] + u[1] * size * 0.3]], false);
  const cls = o.cls ?? "rig-arrow";
  return { svg: `<g class="${cls}"><path class="rig-arrow-halo" d="${line}"/><path class="rig-arrow-line" d="${line}"/><path class="rig-arrow-head" d="${head}"/></g>`, a: pts[0]!, b };
}

/**
 * The working beside a part: a small card of rows of text, upright on screen (not printed on a face, so
 * long numbers stay legible), its top-left corner at screen point `at`, the text `size` figure units
 * tall. Rows are plain strings (`h1  2,668,802,083 mod 16 = 3`); swap them as the step goes on. Returns
 * the SVG and the card's size.
 */
export function workingStrip(rows: string[], at: P2, size: number): { svg: string; w: number; h: number } {
  const lh = size * 1.45, pad = size * 0.6;
  const w = Math.max(1, ...rows.map((r) => r.length)) * size * 0.62 + 2 * pad, h = Math.max(1, rows.length) * lh - (lh - size) + 2 * pad;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const text = rows.map((r, i) => `<text class="rig-working-text" x="${f1(pad)}" y="${f1(pad + i * lh + size * 0.8)}" font-size="${f1(size)}">${esc(r)}</text>`).join("");
  return { svg: `<g class="rig-working" transform="translate(${f1(at[0])} ${f1(at[1])})"><rect class="rig-working-bg" width="${f1(w)}" height="${f1(h)}" rx="${f1(size * 0.35)}"/>${text}</g>`, w, h };
}
