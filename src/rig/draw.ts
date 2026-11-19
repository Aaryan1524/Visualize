// Drawing a mesh as SVG, in Visualize's look:
//   - every face that turns toward the viewer is filled with a continuous shade of its material,
//     from its actual normal under one key light (no fixed set of tones);
//   - the silhouette (edges between a face turned toward the viewer and one turned away) is drawn
//     heavier than the creases (sharp edges between two visible faces);
//   - metal edges that catch the light get a thin specular line;
//   - a soft contact shadow can be laid under a part, toward the part behind it.
// Materials and weights are CSS tokens (rig.css), so both themes, and receding parts, follow.

import { axesOf, nearness, screenOf, type Axes, type Camera } from "./camera.ts";
import type { Mesh } from "./shapes.ts";
import { add, convexOutline, dot, n1, pathThrough, scale, unit, type P2, type V3 } from "./vec.ts";

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
}

const fill = (s: number) => `fill:color-mix(in oklab,var(--rig-lit) ${Math.round(s * 100)}%,var(--rig-dark))`;

/** The mesh as an SVG group. */
export function drawMesh(mesh: Mesh, cam: Camera, look: Look): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const light = keyLight(ax);
  const half = unit(add(light, ax.toward));
  const pts = mesh.verts.map((v) => screenOf(cam, v, ax));
  const z = mesh.verts.map((v) => nearness(cam, v, ax));
  const seen = mesh.faces.map((f) => dot(f.normal, ax.toward) > 1e-6);
  // faces toward the viewer, far to near; a plate's near cap always comes last
  const order = mesh.faces.map((f, i) => i).filter((i) => seen[i]);
  const depth = (i: number) => {
    const l = mesh.faces[i]!.loops[0]!;
    return l.reduce((s, k) => s + z[k]!, 0) / l.length + (mesh.faces[i]!.role === "cap" ? 1e3 : 0);
  };
  order.sort((a, b) => depth(a) - depth(b));
  let body = "";
  // Side faces (walls, bands) share one path per shade: a plate's walls hide behind its near cap,
  // and a turned part's bands do not overlap, so their order among themselves does not show. Each
  // is wound one way so they never cancel. Caps and ends come after, far to near.
  const buckets = new Map<number, { d: string; depth: number; n: number }>();
  const tail: string[] = [];
  for (const i of order) {
    const f = mesh.faces[i]!;
    const s = Math.round(shadeOf(f.normal, light) * 32) / 32;
    const loops = f.loops.map((l) => l.map((k) => pts[k]!));
    if (f.role === "cap" || f.role === "end" || loops.length > 1) {
      tail.push(`<path class="rig-face rig-${f.role === "end" ? "cap" : f.role === "cap" ? "cap" : "wall"}" fill-rule="evenodd" style="${fill(s)}" d="${loops.map((l) => pathThrough(l)).join("")}"/>`);
      continue;
    }
    const l = loops[0]!;
    let a2 = 0;
    for (let k = 0; k < l.length; k++) a2 += l[k]![0] * l[(k + 1) % l.length]![1] - l[(k + 1) % l.length]![0] * l[k]![1];
    const bk = buckets.get(s) ?? { d: "", depth: 0, n: 0 };
    bk.d += pathThrough(a2 < 0 ? [...l].reverse() : l);
    bk.depth += depth(i);
    bk.n++;
    buckets.set(s, bk);
  }
  for (const [s, bk] of [...buckets].sort((x, y) => x[1].depth / x[1].n - y[1].depth / y[1].n)) body += `<path class="rig-face rig-wall" style="${fill(s)}" d="${bk.d}"/>`;
  body += tail.join("");

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
  let sil = "", crease = "", shine = "";
  for (const [key, fs] of edges) {
    const nSeen = fs.filter((i) => seen[i]).length;
    if (!nSeen) continue;
    const [a, b] = key.split("|").map(Number) as [number, number];
    const seg = `M${n1(pts[a]![0])} ${n1(pts[a]![1])}L${n1(pts[b]![0])} ${n1(pts[b]![1])}`;
    if (nSeen < fs.length || fs.length === 1) sil += seg;
    else if (fs.length === 2 && dot(mesh.faces[fs[0]!]!.normal, mesh.faces[fs[1]!]!.normal) < cosCrease) crease += seg;
    // a metal edge catches the light where the side face beside it turns toward the half vector
    if (look.shine && fs.some((i) => seen[i] && mesh.faces[i]!.role !== "cap" && mesh.faces[i]!.role !== "end" && dot(mesh.faces[i]!.normal, half) > 0.93)) shine += seg;
  }
  const cls = `rig-solid rig-m-${look.material}${look.className ? " " + look.className : ""}`;
  return `<g class="${cls}">${body}${crease ? `<path class="rig-crease" d="${crease}"/>` : ""}${shine ? `<path class="rig-shine" d="${shine}"/>` : ""}${sil ? `<path class="rig-sil" d="${sil}"/>` : ""}</g>`;
}

/**
 * A soft contact shadow: the part's outline pushed `offset` (world) away from the light, onto
 * whatever lies behind it. Drawn just before the part.
 */
export function contactShadow(mesh: Mesh, cam: Camera, offset: V3): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const pts: P2[] = mesh.verts.map((v) => screenOf(cam, add(v, offset), ax));
  return `<path class="rig-contact" d="${pathThrough(convexOutline(pts))}"/>`;
}

/** Lines lying on surfaces (ribs, grooves, rules), drawn with the crease weight. */
export function linesOn(cam: Camera, segments: readonly (readonly [V3, V3])[], className = "rig-crease"): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const d = segments.map(([a, b]) => pathThrough([screenOf(cam, a, ax), screenOf(cam, b, ax)], false)).join("");
  return d ? `<path class="${className}" d="${d}"/>` : "";
}
