// Shapes as closed meshes: plates extruded from any 2D outline (holes allowed), turned parts
// from a profile, and rods. Every face carries its outward normal, so drawing can shade it by the
// light and find the silhouette from which faces turn away.

import { add, along, area2, cross, dot, scale, sub, unit, type P2, type V3 } from "./vec.ts";

export type Role = "cap" | "wall" | "band" | "end";

export interface Face {
  /** Vertex indices: the outer loop first, then any holes. */
  loops: number[][];
  normal: V3;
  role: Role;
}

export interface Mesh {
  verts: V3[];
  faces: Face[];
}

/** A plane: points are origin + a·u + b·v, and n = u × v is its normal. */
export interface Plane {
  origin: V3;
  u: V3;
  v: V3;
  n: V3;
}

/** The plane through `origin` with normal `normal`; `uHint` sets the in-plane x direction. */
export function planeOf(origin: V3, normal: V3, uHint: V3): Plane {
  const n = unit(normal);
  const u = unit(sub(uHint, scale(n, dot(uHint, n))));
  return { origin, u, v: cross(n, u), n };
}

export const pointOn = (pl: Plane, a: number, b: number, t = 0): V3 => along(along(along(pl.origin, pl.u, a), pl.v, b), pl.n, t);

export interface Outline {
  outer: readonly P2[];
  holes?: readonly (readonly P2[])[];
}

/** An outline extruded along the plane's normal from t0 to t1: two caps and a wall per edge. */
export function plate(pl: Plane, outline: Outline, t0: number, t1: number): Mesh {
  const ccw = (loop: readonly P2[], want: boolean) => (area2(loop) > 0 === want ? [...loop] : [...loop].reverse());
  const loops = [ccw(outline.outer, true), ...(outline.holes ?? []).map((h) => ccw(h, false))];
  const verts: V3[] = [];
  const low: number[][] = [], high: number[][] = [];
  for (const loop of loops) {
    low.push(loop.map(([a, b]) => verts.push(pointOn(pl, a, b, t0)) - 1));
    high.push(loop.map(([a, b]) => verts.push(pointOn(pl, a, b, t1)) - 1));
  }
  const faces: Face[] = [
    { loops: high.map((l) => [...l]), normal: pl.n, role: "cap" },
    { loops: low.map((l) => [...l].reverse()), normal: scale(pl.n, -1), role: "cap" },
  ];
  loops.forEach((loop, k) => {
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      const da = loop[j]![0] - loop[i]![0], db = loop[j]![1] - loop[i]![1];
      // to the right of travel: outward round a counter-clockwise outer loop, into a clockwise hole
      const normal = unit(add(scale(pl.u, db), scale(pl.v, -da)));
      faces.push({ loops: [[low[k]![i]!, low[k]![j]!, high[k]![j]!, high[k]![i]!]], normal, role: "wall" });
    }
  });
  return { verts, faces };
}

/**
 * A part turned about an axis: profile points [s along the axis, r from it]. The ends are closed
 * where the radius there is not zero. `segments` is the number of facets round the axis.
 */
export function turned(origin: V3, axis: V3, profile: readonly P2[], segments = 32, uHint: V3 = [0, 0, 1]): Mesh {
  const a = unit(axis);
  const helper: V3 = Math.abs(dot(unit(uHint), a)) > 0.95 ? [1, 0, 0] : uHint;
  const pl = planeOf(origin, a, helper);
  const verts: V3[] = [];
  const rings = profile.map(([s, r]) => Array.from({ length: segments }, (_, i) => {
    const t = (2 * Math.PI * i) / segments;
    return verts.push(along(along(along(origin, a, s), pl.u, r * Math.cos(t)), pl.v, r * Math.sin(t))) - 1;
  }));
  const faces: Face[] = [];
  for (let k = 0; k + 1 < profile.length; k++) {
    const [s0, r0] = profile[k]!, [s1, r1] = profile[k + 1]!;
    const ds = s1 - s0, dr = r1 - r0;
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const t = (2 * Math.PI * (i + 0.5)) / segments;
      const radial = add(scale(pl.u, Math.cos(t)), scale(pl.v, Math.sin(t)));
      const normal = unit(add(scale(radial, ds), scale(a, -dr)));
      faces.push({ loops: [[rings[k]![i]!, rings[k]![j]!, rings[k + 1]![j]!, rings[k + 1]![i]!]], normal, role: "band" });
    }
  }
  if (profile[0]![1] > 1e-9) faces.push({ loops: [[...rings[0]!].reverse()], normal: scale(a, -1), role: "end" });
  if (profile[profile.length - 1]![1] > 1e-9) faces.push({ loops: [[...rings[rings.length - 1]!]], normal: a, role: "end" });
  return { verts, faces };
}

/** A cylinder from a to b. */
export const rod = (a: V3, b: V3, r: number, segments = 20): Mesh => {
  const d = sub(b, a), L = Math.hypot(d[0], d[1], d[2]);
  return turned(a, d, [[0, r], [L, r]], segments);
};

/** A round outline: n points on a circle. */
export const circlePoints = (r: number, n = 48, cx = 0, cy = 0, phase = 0): P2[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(phase + (2 * Math.PI * i) / n), cy + r * Math.sin(phase + (2 * Math.PI * i) / n)]);

/** The outline round a chain of circles: a link, a cage plate, a knuckle (convex). */
export function roundedHull(circles: readonly (readonly [number, number, number])[], n = 24): P2[] {
  const pts: P2[] = circles.flatMap(([cx, cy, r]) => circlePoints(r, n, cx, cy));
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [], upper: P2[] = [];
  for (const q of p) {
    while (lower.length > 1 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length > 1 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A sprocket's outline: `teeth` teeth on pitch radius R, tips `tip` beyond it, seats below it. */
export function sprocket(teeth: number, R: number, tip: number, rot = 0): P2[] {
  const out: P2[] = [], step = (2 * Math.PI) / teeth, root = R - 3;
  for (let j = 0; j < teeth; j++) {
    const a = rot + j * step;
    for (const [f, r] of [[-0.5, root], [-0.32, root + 0.6], [-0.1, R + tip], [0.1, R + tip], [0.32, root + 0.6]] as const) out.push([r * Math.cos(a + f * step), r * Math.sin(a + f * step)]);
  }
  return out;
}

/** A regular polygon centred at (cx, cy). */
export const regularPolygon = (sides: number, r: number, cx = 0, cy = 0, phase = 0): P2[] =>
  Array.from({ length: sides }, (_, i) => {
    const a = phase + (2 * Math.PI * i) / sides;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as P2;
  });

/** A rounded rectangle of width w and height h, centred at (cx, cy), corner radius r. */
export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0, cornerSegs = 5): P2[] {
  const cr = Math.max(0, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  const hw = w / 2 - cr, hh = h / 2 - cr;
  if (cr <= 1e-6) return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
  const corners: readonly [number, number, number, number][] = [
    [cx + hw, cy + hh, 0, Math.PI / 2],
    [cx - hw, cy + hh, Math.PI / 2, Math.PI],
    [cx - hw, cy - hh, Math.PI, 1.5 * Math.PI],
    [cx + hw, cy - hh, 1.5 * Math.PI, 2 * Math.PI],
  ];
  const out: P2[] = [];
  for (const [ox, oy, a0, a1] of corners) {
    for (let i = 0; i <= cornerSegs; i++) {
      const a = a0 + ((a1 - a0) * i) / cornerSegs;
      out.push([ox + cr * Math.cos(a), oy + cr * Math.sin(a)]);
    }
  }
  return out;
}

/** An annular sector (ring arc) from angle a0 to a1, inner radius rIn to outer radius rOut. */
export function arcOutline(rIn: number, rOut: number, a0: number, a1: number, steps = 32, cx = 0, cy = 0): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + rOut * Math.cos(a), cy + rOut * Math.sin(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + rIn * Math.cos(a), cy + rIn * Math.sin(a)]);
  }
  return out;
}

export interface GearOptions {
  /** tooth height above pitch circle (default: 0.9 * module) */
  addendum?: number;
  /** tooth depth below pitch circle (default: 1.15 * module) */
  dedendum?: number;
  rot?: number;
}

/** A horological / involute-taper gear wheel outline on pitch radius R. */
export function gearOutline(teeth: number, R: number, opts: GearOptions = {}): P2[] {
  const mod = (2 * R) / teeth;
  const addH = opts.addendum ?? mod * 0.92;
  const dedH = opts.dedendum ?? mod * 1.15;
  const rTip = R + addH, rRoot = Math.max(0.5, R - dedH);
  const step = (2 * Math.PI) / teeth, rot = opts.rot ?? 0;
  const out: P2[] = [];
  for (let j = 0; j < teeth; j++) {
    const a = rot + j * step;
    for (const [f, r] of [
      [-0.46, rRoot],
      [-0.28, rRoot],
      [-0.21, R],
      [-0.12, rTip],
      [0.12, rTip],
      [0.21, R],
      [0.28, rRoot],
      [0.46, rRoot],
    ] as const) {
      out.push([r * Math.cos(a + f * step), r * Math.sin(a + f * step)]);
    }
  }
  return out;
}

/** Watchmaker spoked-wheel cutouts between rInner and rOuter, leaving `spokes` radial arms. */
export function spokedHoles(rInner: number, rOuter: number, spokes = 5, spokeHalfAngle = 0.14, phase = 0, arcSteps = 10): P2[][] {
  const holes: P2[][] = [];
  const step = (2 * Math.PI) / spokes;
  for (let i = 0; i < spokes; i++) {
    const a0 = phase + i * step + spokeHalfAngle;
    const a1 = phase + (i + 1) * step - spokeHalfAngle;
    if (a1 - a0 <= 0.05) continue;
    holes.push(arcOutline(rInner, rOuter, a0, a1, arcSteps));
  }
  return holes;
}

/** A Swiss lever club-tooth escape wheel outline: raked teeth with angled impulse clubs. */
export function escapeWheelOutline(teeth: number, rTip: number, rRoot: number, rot = 0): P2[] {
  const step = (2 * Math.PI) / teeth;
  const rMid = rRoot + (rTip - rRoot) * 0.62;
  const out: P2[] = [];
  for (let j = 0; j < teeth; j++) {
    const a = rot + j * step;
    // Raked forward in direction of CCW travel (+angle): narrow root, clubbed impulse tip, undercut back
    for (const [f, r] of [
      [0.0, rRoot],
      [0.28, rRoot],
      [0.52, rMid],
      [0.72, rTip],
      [0.84, rTip * 0.985],
      [0.64, rMid * 0.96],
      [0.44, rRoot * 1.03],
    ] as const) {
      out.push([r * Math.cos(a + f * step), r * Math.sin(a + f * step)]);
    }
  }
  return out;
}

/** Inset a counter-clockwise 2D polygon by `d` along vertex bisectors (clamped against inversion). */
function insetLoop(loop: readonly P2[], d: number): P2[] {
  const n = loop.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n]!;
    const cur = loop[i]!;
    const next = loop[(i + 1) % n]!;
    const e0x = cur[0] - prev[0], e0y = cur[1] - prev[1], l0 = Math.hypot(e0x, e0y) || 1;
    const e1x = next[0] - cur[0], e1y = next[1] - cur[1], l1 = Math.hypot(e1x, e1y) || 1;
    // inward normals for CCW loop: (-ey, ex)
    const n0x = -e0y / l0, n0y = e0x / l0;
    const n1x = -e1y / l1, n1y = e1x / l1;
    const bx = n0x + n1x, by = n0y + n1y, bl = Math.hypot(bx, by);
    if (bl < 1e-6) {
      out.push([cur[0] + n0x * d, cur[1] + n0y * d]);
    } else {
      const ux = bx / bl, uy = by / bl;
      const cosHalf = Math.max(0.35, ux * n0x + uy * n0y);
      const step = Math.min(d / cosHalf, d * 2.2);
      out.push([cur[0] + ux * step, cur[1] + uy * step]);
    }
  }
  return out;
}

/**
 * A closed plate extruded from t0 to t1 with true 45-degree beveled top and bottom rims.
 * The beveled rims catch directional specular light and give architectural chassis and horological
 * plates sharp, machined silhouettes.
 */
export function chamferPlate(pl: Plane, outer: readonly P2[], t0: number, t1: number, bevel: number): Mesh {
  const loop = area2(outer) > 0 ? [...outer] : [...outer].reverse();
  const h = t1 - t0;
  const b = Math.max(0, Math.min(bevel, h * 0.42));
  if (b <= 1e-5) return plate(pl, { outer: loop }, t0, t1);
  const inner = insetLoop(loop, b);
  const n = loop.length;
  const verts: V3[] = [];
  const pushRing = (pts: readonly P2[], t: number) => pts.map(([x, y]) => verts.push(pointOn(pl, x, y, t)) - 1);
  const r0 = pushRing(inner, t0);
  const r1 = pushRing(loop, t0 + b);
  const r2 = pushRing(loop, t1 - b);
  const r3 = pushRing(inner, t1);

  const faces: Face[] = [
    { loops: [[...r3]], normal: pl.n, role: "cap" },
    { loops: [[...r0].reverse()], normal: scale(pl.n, -1), role: "cap" },
  ];
  const quadNormal = (a: number, bIdx: number, c: number): V3 => {
    const pa = verts[a]!, pb = verts[bIdx]!, pc = verts[c]!;
    return unit(cross(sub(pb, pa), sub(pc, pa)));
  };
  const connect = (lo: number[], hi: number[], role: Role) => {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const q = [lo[i]!, lo[j]!, hi[j]!, hi[i]!];
      faces.push({ loops: [q], normal: quadNormal(q[0]!, q[1]!, q[2]!), role });
    }
  };
  connect(r0, r1, "wall");
  connect(r1, r2, "wall");
  connect(r2, r3, "wall");
  return { verts, faces };
}

/**
 * A closed circular tube swept along a 3D polyline using parallel-transport frames (so it never
 * twists or kinks through inflection points), with capped ends and exact outward normals.
 */
export function tube(points: readonly V3[], r: number, segments = 12): Mesh {
  // Deduplicate near-coincident consecutive points
  const pts: V3[] = [];
  for (const p of points) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) > 1e-6) pts.push(p);
  }
  if (pts.length < 2) throw new RangeError("tube needs at least two distinct points");
  const m = pts.length;
  const tangents: V3[] = [];
  for (let i = 0; i < m; i++) {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(m - 1, i + 1)]!;
    tangents.push(unit(sub(b, a)));
  }
  // Initial normal perpendicular to first tangent
  const t0 = tangents[0]!;
  const ref: V3 = Math.abs(dot(t0, [0, 0, 1])) > 0.92 ? [1, 0, 0] : [0, 0, 1];
  let U = unit(sub(ref, scale(t0, dot(ref, t0))));
  let V = cross(t0, U);
  const frames: { u: V3; v: V3 }[] = [{ u: U, v: V }];
  for (let i = 1; i < m; i++) {
    const prevT = tangents[i - 1]!, curT = tangents[i]!;
    const axis = cross(prevT, curT);
    const sinA = Math.hypot(axis[0], axis[1], axis[2]);
    if (sinA > 1e-7) {
      const k = scale(axis, 1 / sinA);
      const cosA = Math.max(-1, Math.min(1, dot(prevT, curT)));
      // Rodrigues rotation of U around k by angle(prevT, curT)
      U = unit(add(add(scale(U, cosA), scale(cross(k, U), sinA)), scale(k, dot(k, U) * (1 - cosA))));
    }
    // Re-orthogonalize against curT
    U = unit(sub(U, scale(curT, dot(U, curT))));
    V = cross(curT, U);
    frames.push({ u: U, v: V });
  }

  const verts: V3[] = [];
  const rings: number[][] = [];
  for (let i = 0; i < m; i++) {
    const p = pts[i]!, { u, v } = frames[i]!;
    const ring: number[] = [];
    for (let s = 0; s < segments; s++) {
      const a = (2 * Math.PI * s) / segments;
      const off = add(scale(u, r * Math.cos(a)), scale(v, r * Math.sin(a)));
      ring.push(verts.push(add(p, off)) - 1);
    }
    rings.push(ring);
  }
  const faces: Face[] = [];
  for (let i = 0; i < m - 1; i++) {
    const rA = rings[i]!, rB = rings[i + 1]!;
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments;
      const q = [rA[s]!, rA[s2]!, rB[s2]!, rB[s]!];
      const pa = verts[q[0]!]!, pb = verts[q[1]!]!, pc = verts[q[2]!]!;
      const normal = unit(cross(sub(pb, pa), sub(pc, pa)));
      faces.push({ loops: [q], normal, role: "band" });
    }
  }
  faces.push({ loops: [[...rings[0]!].reverse()], normal: scale(tangents[0]!, -1), role: "end" });
  faces.push({ loops: [[...rings[m - 1]!]], normal: tangents[m - 1]!, role: "end" });
  return { verts, faces };
}

/** A 3D Archimedean spiral polyline in plane `pl`, from radius r0 to r1 over `turns` turns. */
export function spiralPoints(pl: Plane, r0: number, r1: number, turns: number, steps: number, z0 = 0, z1 = 0, phase = 0): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = phase + u * turns * 2 * Math.PI;
    const r = r0 + (r1 - r0) * u;
    const t = z0 + (z1 - z0) * u;
    out.push(pointOn(pl, r * Math.cos(a), r * Math.sin(a), t));
  }
  return out;
}
