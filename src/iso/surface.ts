import type { BoxMark, Projection } from "../core/types.ts";
import { project, type Pt } from "./project.ts";
import { geometryOf } from "./solids.ts";

export interface SurfacePath {
  kind: "seam" | "fastener" | "slot" | "tick" | "well";
  points: readonly Pt[];
  closed?: boolean;
}

/** Surface decoration is generated in its owner's coordinates, never overlaid on the scene. */
export function surfaceGeometry(m: BoxMark, projection: Projection): SurfacePath[] {
  if (!m.surface) return [];
  const [x, y, z] = m.at, [w, d, h] = m.size;
  const P = (u: number, v: number, q: number) => project([x + u, y + v, z + q], projection);
  const paths: SurfacePath[] = [];
  const { seam, fasteners, ticks, well } = m.surface;
  if (seam !== undefined && seam > 0 && seam < 1) {
    const level = h * seam;
    const shape = geometryOf({ ...m, at: [x, y, z + level], size: [w, d, 0], inset: false }, projection);
    const points = projection === "front" ? [P(0, 0, level), P(w, 0, level)] : shape.rim;
    if (points) paths.push({ kind: "seam", points });
  }
  if (projection === "front") return paths;
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
