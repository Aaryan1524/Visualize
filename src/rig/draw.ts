// Drawing a mesh as SVG, in Visualize's look:
//   - every face that turns toward the viewer is filled with a continuous shade of its material,
//     from its actual normal under one key light (no fixed set of tones);
//   - the silhouette (edges between a face turned toward the viewer and one turned away) is drawn
//     heavier than the creases (sharp edges between two visible faces);
//   - metal edges that catch the light get a thin specular line;
//   - a soft contact shadow can be laid under a part, toward the part behind it.
// Materials and weights are CSS tokens (rig.css), so both themes, and receding parts, follow.

import { axesOf, nearness, screenOf, type Axes, type Camera } from "./camera.ts";
import { spiralStrip, type FaceSort, type Mesh, type Plane, type SpiralStrip } from "./shapes.ts";
import { add, area2, convexOutline, dot, n1, pathThrough, scale, unit, type P2, type V3 } from "./vec.ts";

/** The key light, fixed to the camera: from above, a little to the left and toward the viewer. */
export function keyLight(ax: Axes): V3 {
  return unit(add(add(scale(ax.up, 0.72), scale(ax.right, -0.45)), scale(ax.toward, 0.55)));
}

/** How lit a face is, 0 to 1: a floor of ambient light plus the light falling square on it. */
export const shadeOf = (normal: V3, light: V3): number => 0.16 + 0.84 * Math.max(0, dot(normal, light));

export interface Look {
  /** a material token family in rig.css: steel, alloy, chain, subject, frame, slate */
  material: string;
  /** draw the specular line on edges that catch the light (metal) */
  shine?: boolean;
  /** creases sharper than this (degrees between normals) are drawn as edges */
  crease?: number;
  className?: string;
  /** override the mesh's own order (see paintGroups): "face" for anything that hides parts of itself */
  sort?: FaceSort;
}

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
export function paintGroups(mesh: Mesh, cam: Camera, sort: FaceSort = mesh.sort ?? "bucket"): { groups: number[][]; tier: number[]; shade: number[]; seen: boolean[] } {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const light = keyLight(ax);
  const z = mesh.verts.map((v) => nearness(cam, v, ax));
  const seen = mesh.faces.map((f) => dot(f.normal, ax.toward) > 1e-6);
  const shade = mesh.faces.map((f) => Math.round(shadeOf(f.normal, light) * 32) / 32);
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
      if (g && j !== undefined && single(i) && single(j) && tier[i] === tier[j] && shade[i] === shade[j] && (mesh.faces[i]!.role === "cap") === (mesh.faces[j]!.role === "cap")) g.push(i);
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
  const ax = axesOf(cam.azimuth, cam.elevation);
  const light = keyLight(ax);
  const half = unit(add(light, ax.toward));
  const pts = mesh.verts.map((v) => screenOf(cam, v, ax));
  const sort = look.sort ?? mesh.sort ?? "bucket";
  const { groups, tier, shade, seen } = paintGroups(mesh, cam, sort);

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
  const lines = Array.from({ length: perGroup ? groups.length : 1 }, () => ({ sil: "", crease: "", shine: "" }));
  for (const [key, fs] of edges) {
    const nSeen = fs.filter((i) => seen[i]).length;
    if (!nSeen) continue;
    const at = lines[perGroup ? Math.max(...fs.filter((i) => seen[i]).map((i) => groupOf.get(i)!)) : 0]!;
    const [a, b] = key.split("|").map(Number) as [number, number];
    const seg = `M${n1(pts[a]![0])} ${n1(pts[a]![1])}L${n1(pts[b]![0])} ${n1(pts[b]![1])}`;
    if (nSeen < fs.length || fs.length === 1) at.sil += seg;
    else if (fs.length === 2 && dot(mesh.faces[fs[0]!]!.normal, mesh.faces[fs[1]!]!.normal) < cosCrease) at.crease += seg;
    // a metal edge catches the light where the side face beside it turns toward the half vector
    if (look.shine && fs.some((i) => seen[i] && mesh.faces[i]!.role !== "cap" && mesh.faces[i]!.role !== "end" && dot(mesh.faces[i]!.normal, half) > 0.93)) at.shine += seg;
  }
  const lineSvg = (l: { sil: string; crease: string; shine: string }) =>
    `${l.crease ? `<path class="rig-crease" d="${l.crease}"/>` : ""}${l.shine ? `<path class="rig-shine" d="${l.shine}"/>` : ""}${l.sil ? `<path class="rig-sil" d="${l.sil}"/>` : ""}`;
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
