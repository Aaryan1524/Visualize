// Drawing a mesh as SVG, in Visualize's look:
//   - every face that turns toward the viewer is filled with a continuous shade of its material,
//     from its actual normal under one key light (no fixed set of tones);
//   - the silhouette (edges between a face turned toward the viewer and one turned away) is drawn
//     heavier than the creases (sharp edges between two visible faces);
//   - metal edges that catch the light get a thin specular line;
//   - a soft contact shadow can be laid under a part, toward the part behind it.
// Materials and weights are CSS tokens (rig.css), so both themes, and receding parts, follow.

import { axesOf, nearness, screenOf, type Axes, type Camera } from "./camera.ts";
import { pointOn, spiralStrip, type FaceSort, type Mesh, type Plane, type SpiralStrip } from "./shapes.ts";
import { add, area2, convexOutline, dot, n1, pathThrough, scale, unit, type P2, type V3 } from "./vec.ts";

export type Finish = "metal" | "satin" | "glass" | "matte";

/** The key light, fixed to the camera: from above, a little to the left and toward the viewer. */
export function keyLight(ax: Axes): V3 {
  return unit(add(add(scale(ax.up, 0.72), scale(ax.right, -0.45)), scale(ax.toward, 0.55)));
}

/** Cool secondary studio bounce/rim light from lower-right-behind for sculptural shadow-side wrap. */
export function rimLight(ax: Axes): V3 {
  return unit(add(add(scale(ax.right, 0.78), scale(ax.up, -0.25)), scale(ax.toward, -0.35)));
}

/** How lit a face is, 0 to 1: a floor of ambient light plus the light falling square on it. */
export const shadeOf = (normal: V3, light: V3): number => 0.16 + 0.84 * Math.max(0, dot(normal, light));

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * 3-point studio shading: Lambert key diffuse + subtle studio bounce/rim wrap + finish-aware
 * analytical Blinn-Phong specular highlight, clamped cleanly to [0.12, 1.0].
 */
export function studioShade(normal: V3, light: V3, rim: V3, toward: V3, finish: Finish = "satin"): number {
  const n = unit(normal);
  const key = Math.max(0, dot(n, light));
  // Rim bounce wraps softly into shadowed faces without washing out key-lit faces
  const bounce = Math.max(0, dot(n, rim)) * (1 - key);
  const half = unit(add(light, toward));
  const nh = Math.max(0, dot(n, half));
  let ambient: number, diffuse: number, rimGain: number, specGain: number, specExp: number;
  switch (finish) {
    case "metal":
      ambient = 0.15; diffuse = 0.85; rimGain = 0.06; specGain = 0.22; specExp = 20;
      break;
    case "glass":
      ambient = 0.16; diffuse = 0.80; rimGain = 0.08; specGain = 0.28; specExp = 24;
      break;
    case "matte":
      ambient = 0.16; diffuse = 0.84; rimGain = 0.02; specGain = 0; specExp = 1;
      break;
    default: // "satin"
      ambient = 0.16; diffuse = 0.84; rimGain = 0.02; specGain = 0.03; specExp = 22;
      break;
  }
  const spec = specGain > 0 ? specGain * Math.pow(nh, specExp) : 0;
  return clamp(ambient + diffuse * key + rimGain * bounce + spec, 0.12, 1);
}

export interface Look {
  /** a material token family in rig.css: steel, alloy, chain, subject, frame, slate */
  material: string;
  /** surface finish for 3-point studio shading; defaults from shine / material when omitted */
  finish?: Finish;
  /** draw the specular line on edges that catch the light (metal) */
  shine?: boolean;
  /** creases sharper than this (degrees between normals) are drawn as edges */
  crease?: number;
  className?: string;
  /** override the mesh's own order (see paintGroups): "face" for anything that hides parts of itself */
  sort?: FaceSort;
}

const resolveFinish = (look: Look): Finish =>
  look.finish ?? (look.shine ? "metal" : look.material === "glass" ? "glass" : "satin");

const fill = (s: number) => `fill:color-mix(in oklab,var(--rig-lit) ${Math.round(s * 100)}%,var(--rig-dark))`;

/**
 * The order a mesh is painted in, as groups: each group is one <path>, painted in turn. Seen faces
 * fall in three tiers, which are right for any extrusion seen from the side of the cap it shows:
 *   0. walls, bands and ends (the only faces that can hide one another);
 *   1. bevels next to the cap the viewer sees (a wall can never hide them, they never hide that cap);
 *   2. caps (nothing of the same solid lies in front of a seen cap).
 * Within tier 0, "bucket" merges each shade into one path (ordered by the shade's mean depth), and
 * caps, ends and holed faces follow far to near, as before; "face" paints every face far to near,
 * merging only neighbours in that order that share a shade, so a coil's near turn covers its far one.
 */
export function paintGroups(
  mesh: Mesh,
  cam: Camera,
  sort: FaceSort = mesh.sort ?? "bucket",
  finish: Finish = "satin",
): { groups: number[][]; tier: number[]; shade: number[]; seen: boolean[] } {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const light = keyLight(ax);
  const rim = rimLight(ax);
  const z = mesh.verts.map((v) => nearness(cam, v, ax));
  const seen = mesh.faces.map((f) => dot(f.normal, ax.toward) > 1e-6);
  const shade = mesh.faces.map((f) => Math.round(studioShade(f.normal, light, rim, ax.toward, finish) * 32) / 32);
  const seenCaps = mesh.faces.filter((f, i) => seen[i] && f.role === "cap");
  const tier = mesh.faces.map((f) => (f.role === "cap" ? 2 : f.bevel && seenCaps.some((c) => dot(c.normal, f.normal) > 0) ? 1 : 0));
  const depth = (i: number) => {
    const l = mesh.faces[i]!.loops[0]!;
    return l.reduce((s, k) => s + z[k]!, 0) / l.length + (mesh.faces[i]!.role === "cap" ? 1e3 : 0);
  };
  const order = mesh.faces.map((_, i) => i).filter((i) => seen[i]);
  order.sort((a, b) => depth(a) - depth(b));
  const single = (i: number) => mesh.faces[i]!.loops.length === 1;
  const groups: number[][] = [];
  if (sort === "face") {
    order.sort((a, b) => tier[a]! - tier[b]! || depth(a) - depth(b));
    for (const i of order) {
      const g = groups[groups.length - 1];
      const j = g?.[g.length - 1];
      if (g && j !== undefined && single(i) && single(j) && tier[i] === tier[j] && shade[i] === shade[j] && mesh.faces[i]!.role === mesh.faces[j]!.role && mesh.faces[i]!.role !== "end") g.push(i);
      else groups.push([i]);
    }
    return { groups, tier, shade, seen };
  }
  // bucket: side faces share one path per shade; a plate's walls hide behind its near cap, and a
  // turned part's bands do not overlap, so their order among themselves does not show
  const tail: number[][] = [];
  for (const t of [0, 1]) {
    const buckets = new Map<number, { faces: number[]; depth: number }>();
    for (const i of order) {
      const f = mesh.faces[i]!;
      if (f.role === "cap" || f.role === "end" || !single(i)) {
        if (t === 0) tail.push([i]);
        continue;
      }
      if (tier[i] !== t) continue;
      const bk = buckets.get(shade[i]!) ?? { faces: [], depth: 0 };
      bk.faces.push(i);
      bk.depth += depth(i);
      buckets.set(shade[i]!, bk);
    }
    for (const [, bk] of [...buckets].sort((x, y) => x[1].depth / x[1].faces.length - y[1].depth / y[1].faces.length)) groups.push(bk.faces);
  }
  groups.push(...tail);
  return { groups, tier, shade, seen };
}

/** The mesh as an SVG group. */
export function drawMesh(mesh: Mesh, cam: Camera, look: Look): string {
  const finish = resolveFinish(look);
  const ax = axesOf(cam.azimuth, cam.elevation);
  const light = keyLight(ax);
  const rim = rimLight(ax);
  const half = unit(add(light, ax.toward));
  const rimHalf = unit(add(rim, ax.toward));
  const pts = mesh.verts.map((v) => screenOf(cam, v, ax));
  const sort = look.sort ?? mesh.sort ?? "bucket";
  const { groups, tier, shade, seen } = paintGroups(mesh, cam, sort, finish);

  const faceSvg = (g: number[]): string => {
    const f0 = mesh.faces[g[0]!]!, s = shade[g[0]!]!;
    const role = f0.role === "cap" || f0.role === "end" ? "rig-cap" : tier[g[0]!] === 1 ? "rig-wall rig-bevel" : "rig-wall";
    if (g.length === 1 && (f0.role === "cap" || f0.role === "end" || f0.loops.length > 1))
      return `<path class="rig-face ${role}" fill-rule="evenodd" style="${fill(s)}" d="${f0.loops.map((l) => pathThrough(l.map((k) => pts[k]!))).join("")}"/>`;
    // each loop wound one way, so merged faces never cancel
    let d = "";
    for (const i of g) {
      const l = mesh.faces[i]!.loops[0]!.map((k) => pts[k]!);
      d += pathThrough(area2(l) < 0 ? [...l].reverse() : l);
    }
    return `<path class="rig-face ${role}" style="${fill(s)}" d="${d}"/>`;
  };

  // edges: silhouette where a face turned toward meets one turned away, creases between two seen faces
  const cosCrease = Math.cos(((look.crease ?? 28) * Math.PI) / 180);
  const edges = new Map<string, number[]>();
  mesh.faces.forEach((f, i) => {
    for (const l of f.loops)
      for (let k = 0; k < l.length; k++) {
        const a = l[k]!, b = l[(k + 1) % l.length]!;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const list = edges.get(key);
        if (list) list.push(i);
        else edges.set(key, [i]);
      }
  });
  // in face order, an edge is drawn right after the last group it borders, so nearer faces cover it
  const groupOf = new Map<number, number>();
  groups.forEach((g, k) => g.forEach((i) => groupOf.set(i, k)));
  const perGroup = sort === "face";
  const glossy = finish === "metal" || finish === "glass" || Boolean(look.shine);
  const lines = Array.from({ length: perGroup ? groups.length : 1 }, () => ({ sil: "", crease: "", shine: "", rim: "" }));
  for (const [key, fs] of edges) {
    const nSeen = fs.filter((i) => seen[i]).length;
    if (!nSeen) continue;
    const at = lines[perGroup ? Math.max(...fs.filter((i) => seen[i]).map((i) => groupOf.get(i)!)) : 0]!;
    const [a, b] = key.split("|").map(Number) as [number, number];
    const seg = `M${n1(pts[a]![0])} ${n1(pts[a]![1])}L${n1(pts[b]![0])} ${n1(pts[b]![1])}`;
    const isSil = nSeen < fs.length || fs.length === 1;
    const isCrease = !isSil && fs.length === 2 && dot(mesh.faces[fs[0]!]!.normal, mesh.faces[fs[1]!]!.normal) < cosCrease;
    if (isSil) at.sil += seg;
    else if (isCrease) at.crease += seg;
    // metallic & glass edges catch the primary specular highlight and a subtle grazing rim reflection
    if (glossy) {
      const catchesKey = fs.some((i) => seen[i] && mesh.faces[i]!.role !== "cap" && mesh.faces[i]!.role !== "end" && dot(mesh.faces[i]!.normal, half) > 0.93);
      if (catchesKey) at.shine += seg;
      else if ((isSil || isCrease) && fs.some((i) => seen[i] && mesh.faces[i]!.role !== "cap" && mesh.faces[i]!.role !== "end" && dot(mesh.faces[i]!.normal, rimHalf) > 0.85 && dot(mesh.faces[i]!.normal, ax.toward) < 0.72)) at.rim += seg;
    }
  }
  const lineSvg = (l: { sil: string; crease: string; shine: string; rim: string }) =>
    `${l.crease ? `<path class="rig-crease" d="${l.crease}"/>` : ""}${l.rim ? `<path class="rig-rim-shine" d="${l.rim}"/>` : ""}${l.shine ? `<path class="rig-shine" d="${l.shine}"/>` : ""}${l.sil ? `<path class="rig-sil" d="${l.sil}"/>` : ""}`;
  let body = "";
  if (perGroup) groups.forEach((g, k) => (body += faceSvg(g) + lineSvg(lines[k]!)));
  else body = groups.map(faceSvg).join("") + lineSvg(lines[0]!);
  const cls = `rig-solid rig-m-${look.material}${look.className ? " " + look.className : ""}`;
  return `<g class="${cls}">${body}</g>`;
}

/**
 * A flat spring coiled in a plane (mainspring, hairspring), drawn as a solid strip: its coils hide
 * one another face by face, its top edge reads as a bright cap. See spiralStrip.
 */
export function drawSpiralRibbon(cam: Camera, pl: Plane, strip: SpiralStrip, look: Look): string {
  return drawMesh(spiralStrip(pl, strip), cam, { ...look, sort: look.sort ?? "face" });
}

/**
 * A soft contact shadow: the part's outline pushed `offset` (world) away from the light, onto
 * whatever lies behind it. Drawn just before the part. Its outline is the convex hull of the part,
 * which is right for a convex slab; a part with notches or holes wants plateShadow.
 */
export function contactShadow(mesh: Mesh, cam: Camera, offset: V3): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const pts: P2[] = mesh.verts.map((v) => screenOf(cam, add(v, offset), ax));
  return `<path class="rig-contact" d="${pathThrough(convexOutline(pts))}"/>`;
}

/**
 * A soft contact shadow that keeps the part's real outline: a C-shaped rotor or a forked lever
 * casts a C or a fork, and light passes through its holes. It is the union of the part's caps (or,
 * for a part without caps, of the faces turned toward the viewer), pushed `offset` away from the
 * light: each face's outline is wound one way on screen and its holes the other, so under the
 * nonzero rule overlapping faces add up and a hole stays open wherever no face covers it.
 */
export function plateShadow(mesh: Mesh, cam: Camera, offset: V3): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const caps = mesh.faces.filter((f) => f.role === "cap");
  const faces = caps.length ? caps : mesh.faces.filter((f) => dot(f.normal, ax.toward) > 1e-6);
  const pts: P2[] = mesh.verts.map((v) => screenOf(cam, add(v, offset), ax));
  let d = "";
  for (const f of faces) {
    const loops = f.loops.map((l) => l.map((k) => pts[k]!));
    const a = area2(loops[0]!);
    if (Math.abs(a) < 1e-9) continue; // edge-on: covers nothing
    for (const l of loops) d += pathThrough(a < 0 ? [...l].reverse() : l);
  }
  return d ? `<path class="rig-contact" fill-rule="nonzero" d="${d}"/>` : "";
}

/** Lines lying on surfaces (ribs, grooves, rules), drawn with the crease weight. */
export function linesOn(cam: Camera, segments: readonly (readonly [V3, V3])[], className = "rig-crease"): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const d = segments.map(([a, b]) => pathThrough([screenOf(cam, a, ax), screenOf(cam, b, ax)], false)).join("");
  return d ? `<path class="${className}" d="${d}"/>` : "";
}

function expandConvex(hull: readonly P2[], pad: number): P2[] {
  const n = hull.length;
  if (n < 3 || !(pad > 0)) return [...hull];
  const sign = area2(hull) >= 0 ? 1 : -1;
  const edgeNormals: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = hull[i]!, b = hull[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    edgeNormals.push([(sign * dy) / len, (-sign * dx) / len]);
  }
  return hull.map((p, i) => {
    const n0 = edgeNormals[(i - 1 + n) % n]!, n1v = edgeNormals[i]!;
    const bx = n0[0] + n1v[0], by = n0[1] + n1v[1];
    const bLen = Math.hypot(bx, by);
    const ux = bLen > 1e-6 ? bx / bLen : n1v[0];
    const uy = bLen > 1e-6 ? by / bLen : n1v[1];
    const cos = ux * n1v[0] + uy * n1v[1];
    const miter = Math.min(2, 1 / Math.max(0.5, cos));
    return [p[0] + ux * pad * miter, p[1] + uy * pad * miter] as P2;
  });
}

/**
 * Layered 2-ring soft studio drop shadow: a faint wider outer penumbra halo plus a tighter inner
 * contact shadow, using pure SVG paths (zero Gaussian <filter> repaints, stays 60 fps).
 */
export function softShadow(mesh: Mesh, cam: Camera, offset: V3): string {
  if (!mesh.verts.length) return "";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const inner = convexOutline(mesh.verts.map((v) => screenOf(cam, add(v, offset), ax)));
  if (inner.length < 3 || Math.abs(area2(inner)) < 1e-9) return "";
  const outerOffset = scale(offset, 1.35);
  const outerBase = convexOutline(mesh.verts.map((v) => screenOf(cam, add(v, outerOffset), ax)));
  const xs = inner.map((p) => p[0]), ys = inner.map((p) => p[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const sc = Math.abs(cam.scale);
  const pad = Math.max(sc * 0.3, Math.min(diag * 0.045, sc * 2.5));
  const outer = expandConvex(outerBase, pad);
  return `<g class="rig-shadow"><path class="rig-shadow-outer" d="${pathThrough(outer)}"/><path class="rig-shadow-inner" d="${pathThrough(inner)}"/></g>`;
}

/**
 * Projects parallel 45° architectural section-cut hatching lines clipped inside a planar polygon
 * `outline` on plane `pl`. Returns `<path class="rig-hatch" d="..."/>`, or `""` for degenerate outlines.
 */
export function cutawayHatch(cam: Camera, pl: Plane, outline: readonly P2[], spacing = 2.4): string {
  if (outline.length < 3 || !(spacing > 0) || !Number.isFinite(spacing)) return "";
  for (const p of outline) if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return "";
  if (Math.abs(area2(outline)) < 1e-9) return "";
  const c = Math.SQRT1_2;
  const rot: P2[] = outline.map(([a, b]) => [(a + b) * c, (-a + b) * c]);
  let tMin = Infinity, tMax = -Infinity;
  for (const [, t] of rot) {
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }
  if (tMax - tMin <= 1e-9) return "";
  const ax = axesOf(cam.azimuth, cam.elevation);
  let d = "";
  const start = Math.floor(tMin / spacing) * spacing + spacing * 0.5;
  for (let t = start; t < tMax; t += spacing) {
    if (t <= tMin) continue;
    const xs: number[] = [];
    for (let i = 0; i < rot.length; i++) {
      const [s0, t0] = rot[i]!;
      const [s1, t1] = rot[(i + 1) % rot.length]!;
      if ((t0 <= t && t1 > t) || (t1 <= t && t0 > t)) {
        xs.push(s0 + ((t - t0) / (t1 - t0)) * (s1 - s0));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const s0 = xs[k]!, s1 = xs[k + 1]!;
      if (s1 - s0 <= 1e-6) continue;
      const p0 = screenOf(cam, pointOn(pl, (s0 - t) * c, (s0 + t) * c, 0), ax);
      const p1 = screenOf(cam, pointOn(pl, (s1 - t) * c, (s1 + t) * c, 0), ax);
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1e-3) continue;
      d += `M${n1(p0[0])} ${n1(p0[1])}L${n1(p1[0])} ${n1(p1[1])}`;
    }
  }
  return d ? `<path class="rig-hatch" d="${d}"/>` : "";
}
