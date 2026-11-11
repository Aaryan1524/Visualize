import type { BoxMark, Projection } from "../core/types.ts";
import { project, type Pt } from "./project.ts";
import { geometryOf } from "./solids.ts";

export interface SurfacePath {
  kind: "seam" | "fastener" | "slot" | "tick" | "well" | "panel" | "vent" | "lamp";
  points: readonly Pt[];
  closed?: boolean;
  tone?: string;
}

/** Surface decoration is generated in its owner's coordinates, never overlaid on the scene. */
export function surfaceGeometry(m: BoxMark, projection: Projection): SurfacePath[] {
  if (!m.surface) return [];
  const [x, y, z] = m.at, [w, d, h] = m.size;
  const P = (u: number, v: number, q: number) => project([x + u, y + v, z + q], projection);
  const paths: SurfacePath[] = [];
  const { seam, seams, fasteners, ticks, well, panel, vents, lamp } = m.surface;
  for (const level of [...(seam !== undefined ? [seam] : []), ...(seams ?? [])]) {
    if (!(level > 0 && level < 1)) continue;
    const shape = geometryOf({ ...m, at: [x, y, z + h * level], size: [w, d, 0], inset: false }, projection);
    const points = projection === "front" ? [P(0, 0, h * level), P(w, 0, h * level)] : shape.rim;
    if (points) paths.push({ kind: "seam", points });
  }
  if (projection === "front") return paths;
  // Side-face details stay inside the flat part of the face, clear of the rounded corners.
  const r = Math.max(m.radius ?? 0, 0);
  const onFace = (face: "left" | "right", u: number, q: number): Pt => (face === "left" ? P(u, d, q) : P(w, u, q));
  const span = (face: "left" | "right") => (face === "left" ? w : d);
  if (panel) {
    const len = span(panel.face);
    const u0 = Math.max(r, panel.inset), u1 = len - Math.max(r, panel.inset);
    const q0 = h * panel.from, q1 = h * panel.to;
    if (u1 > u0 && q1 > q0) paths.push({ kind: "panel", points: [onFace(panel.face, u0, q1), onFace(panel.face, u1, q1), onFace(panel.face, u1, q0), onFace(panel.face, u0, q0)], closed: true });
  }
  if (vents && vents.count > 0) {
    const len = span(vents.face);
    const u0 = Math.max(r + 1, (len - vents.length) / 2), u1 = Math.min(len - r - 1, u0 + vents.length);
    for (let i = 0; i < vents.count; i++) {
      const q = h * (vents.from + ((vents.to - vents.from) * (i + 0.5)) / vents.count);
      if (u1 > u0) paths.push({ kind: "vent", points: [onFace(vents.face, u0, q), onFace(vents.face, u1, q)] });
    }
  }
  if (lamp) {
    const len = span(lamp.face);
    const u = Math.min(Math.max(lamp.u, r + lamp.radius), len - r - lamp.radius);
    const q = h * lamp.at;
    // A disc on a vertical face: a circle in the face's plane.
    const points = Array.from({ length: 20 }, (_, i) => {
      const a = (i * Math.PI) / 10;
      return onFace(lamp.face, u + lamp.radius * Math.cos(a), q + lamp.radius * Math.sin(a));
    });
    paths.push({ kind: "lamp", points, closed: true, tone: lamp.tone });
  }
  if (well && well * 2 < Math.min(w, d)) {
    const shape = geometryOf({ ...m, at: [x + well, y + well, z + h], size: [w - 2*well, d - 2*well, 0], radius: Math.max(.2, (m.radius ?? 0) - well/2), inset: false }, projection);
    paths.push({ kind: "well", points: shape.faces.find(f => f.shade === "top")!.points, closed: true });
  }
  if (fasteners) {
    const inset = Math.min(fasteners.inset, w/3, d/3);
    const r = Math.min(fasteners.radius, inset/3);
    for (const u of [inset, w-inset]) for (const v of [inset, d-inset]) {
      const points = Array.from({ length: 24 }, (_, i) => { const a = i*Math.PI/12; return P(u + r*Math.cos(a), v + r*Math.sin(a), h); });
      paths.push({ kind: "fastener", points, closed: true });
      paths.push({ kind: "slot", points: [P(u-r*.55,v,h), P(u+r*.55,v,h)] });
    }
  }
  if (ticks && ticks.step > 0 && ticks.majorEvery > 0) {
    const margin = Math.max(m.radius ?? 0, 1);
    for (let u=margin, i=0; u<=w-margin; u+=ticks.step, i++) {
      // Each tick terminates at the guide's edge; long marks encode five divisions.
      const length = d * (i % ticks.majorEvery === 0 ? .85 : .45);
      paths.push({ kind: "tick", points: [P(u,d-length,h), P(u,d,h)] });
    }
  }
  return paths;
}
