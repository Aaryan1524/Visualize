// Everyday physical object primitives for the rig: vessels/bottles (solid or cutaway),
// liquid columns, dip tubes, pressable plunger nozzles, deterministic 3D mist sprays,
// wristwatch cases & hands, coiled springs, and studio explainer cards & meter bars.
// Every 3D solid is built from closed meshes with outward normals on the shared rig camera.

import { axesOf, nearness, screenOf, type Camera } from "./camera.ts";
import { cutawayHatch, drawMesh, drawSpiralRibbon, linesOn, softShadow, type Finish } from "./draw.ts";
import { arcOutline, chamferPlate, circlePoints, planeOf, plate, pointOn, rod, roundedRect, tube, turned, type Face, type Mesh, type Plane } from "./shapes.ts";
import { add, along, convexOutline, cross, dot, n1, pathThrough, scale, sub, unit, type P2, type V3 } from "./vec.ts";

export const OBJECT_VIEW = { azimuth: 238, elevation: 22 };

const UP: V3 = [0, 0, 1];
const FLOOR = planeOf([0, 0, 0], UP, [1, 0, 0]);
const TAU = Math.PI * 2;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a closed, watertight thick-walled revolved shell swept across an angular arc [a0, a1].
 * `outer` and `inner` have the same length N, ordered bottom-to-top as [z, r] pairs with r > 0.
 * Every face is a convex quad with outward normal; `sort: "face"` handles self-occlusion cleanly.
 */
function revolvedShellArc(
  outer: readonly P2[],
  inner: readonly P2[],
  a0: number,
  a1: number,
  arcSteps: number,
): Mesh {
  const N = outer.length;
  const K = Math.max(4, Math.round(arcSteps));
  const verts: V3[] = [];
  const oIdx: number[][] = [];
  const iIdx: number[][] = [];

  for (let i = 0; i <= K; i++) {
    const a = a0 + ((a1 - a0) * i) / K;
    const ca = Math.cos(a), sa = Math.sin(a);
    const oCol: number[] = [];
    const iCol: number[] = [];
    for (let k = 0; k < N; k++) {
      const [zo, ro] = outer[k]!;
      const [zi, ri] = inner[k]!;
      oCol.push(verts.push([ro * ca, ro * sa, zo]) - 1);
      iCol.push(verts.push([ri * ca, ri * sa, zi]) - 1);
    }
    oIdx.push(oCol);
    iIdx.push(iCol);
  }

  const quadNormal = (q: number[]): V3 => {
    const a = verts[q[0]!]!, b = verts[q[1]!]!, c = verts[q[2]!]!, d = verts[q[3]!]!;
    return unit(cross(sub(c, a), sub(d, b)));
  };

  const faces: Face[] = [];
  for (let i = 0; i < K; i++) {
    for (let k = 0; k + 1 < N; k++) {
      // Outer band: outward radial
      const qOut = [oIdx[i]![k]!, oIdx[i + 1]![k]!, oIdx[i + 1]![k + 1]!, oIdx[i]![k + 1]!];
      faces.push({ loops: [qOut], normal: quadNormal(qOut), role: "band" });
      // Inner band: inward radial (facing cavity)
      const qIn = [iIdx[i]![k]!, iIdx[i]![k + 1]!, iIdx[i + 1]![k + 1]!, iIdx[i + 1]![k]!];
      faces.push({ loops: [qIn], normal: quadNormal(qIn), role: "band" });
    }
    // Top rim (+z)
    const qTop = [oIdx[i]![N - 1]!, oIdx[i + 1]![N - 1]!, iIdx[i + 1]![N - 1]!, iIdx[i]![N - 1]!];
    faces.push({ loops: [qTop], normal: UP, role: "cap" });
    // Bottom rim (-z)
    const qBot = [iIdx[i]![0]!, iIdx[i + 1]![0]!, oIdx[i + 1]![0]!, oIdx[i]![0]!];
    faces.push({ loops: [qBot], normal: [0, 0, -1], role: "cap" });
  }

  // Cut end caps at a0 (-e_t) and a1 (+e_t)
  const n0: V3 = [Math.sin(a0), -Math.cos(a0), 0];
  const n1v: V3 = [-Math.sin(a1), Math.cos(a1), 0];
  for (let k = 0; k + 1 < N; k++) {
    const q0 = [oIdx[0]![k]!, oIdx[0]![k + 1]!, iIdx[0]![k + 1]!, iIdx[0]![k]!];
    faces.push({ loops: [q0], normal: n0, role: "end" });
    const q1 = [iIdx[K]![k]!, iIdx[K]![k + 1]!, oIdx[K]![k + 1]!, oIdx[K]![k]!];
    faces.push({ loops: [q1], normal: n1v, role: "end" });
  }

  return { verts, faces, sort: "face" };
}

/**
 * Turned 3D bottle / vessel standing on z = 0.
 * When `cutaway` is true, builds a 220° open-front cutaway shell with visible wall thickness
 * opening toward the camera so interior parts (`liquidColumn`, `dipTube`, spring, piston) show inside.
 */
export function vesselShell(
  cam: Camera,
  opts: {
    r: number;
    h: number;
    neckR?: number;
    neckH?: number;
    shoulderH?: number;
    wall?: number;
    cutaway?: boolean;
    material?: string;
    segments?: number;
  },
): string {
  const r = Math.max(1, opts.r);
  const h = Math.max(2, opts.h);
  const neckR = Math.max(0.8, Math.min(r, opts.neckR ?? r * 0.4));
  const shoulderH = Math.max(0, Math.min(h * 0.45, opts.shoulderH ?? (neckR < r * 0.96 ? Math.min(h * 0.22, r * 0.55) : 0)));
  const neckH = Math.max(0, opts.neckH ?? (neckR < r * 0.96 ? Math.max(3, h * 0.16) : 0));
  const wall = Math.max(0.4, Math.min(opts.wall ?? Math.max(1.2, r * 0.1), r * 0.35, neckR * 0.45));
  const material = opts.material ?? "glass";
  const segments = Math.max(12, Math.round(opts.segments ?? 32));
  const bev = Math.min(wall * 0.45, r * 0.08, h * 0.08);
  const bodyTop = Math.max(wall + 0.5, h - shoulderH);

  // Build smooth vertical profile from z = 0 to z = h + neckH
  const shoulderSteps = shoulderH > 0.2 && Math.abs(r - neckR) > 0.1 ? 4 : 0;
  const buildOuter = (zStart: number): P2[] => {
    const pts: P2[] = [];
    if (zStart <= bev * 0.5) {
      pts.push([0, Math.max(0.2, r - bev)], [bev, r]);
    } else {
      pts.push([zStart, r]);
    }
    pts.push([bodyTop, r]);
    for (let s = 1; s <= shoulderSteps; s++) {
      const t = s / shoulderSteps;
      // Smooth S-curve shoulder
      const f = t * t * (3 - 2 * t);
      pts.push([bodyTop + shoulderH * t, r + (neckR - r) * f]);
    }
    if (shoulderSteps === 0 && Math.abs(h - bodyTop) > 1e-4) {
      pts.push([h, neckR]);
    }
    if (neckH > 0.1) {
      pts.push([h + neckH, neckR]);
    }
    return pts;
  };

  const ax = axesOf(cam.azimuth, cam.elevation);
  const facing = Math.atan2(dot(ax.toward, [0, 1, 0]), dot(ax.toward, [1, 0, 0]));
  const sheenSvg = (): string => {
    if (material !== "glass") return "";
    const zLo = Math.min(bodyTop * 0.2, wall + 2);
    const zHi = Math.max(zLo + 1, bodyTop * 0.88);
    const zSpan = zHi - zLo;
    const rr = r * 0.996;
    const segs: [V3, V3][] = [];
    // Primary diagonal crystal glass sheen streak curving cleanly across the lit left flank
    const aStart1 = facing + (106 * Math.PI) / 180;
    const aEnd1 = facing + (122 * Math.PI) / 180;
    const steps1 = 4;
    for (let i = 0; i < steps1; i++) {
      const t0 = i / steps1;
      const t1 = (i + 1) / steps1;
      const aa0 = aStart1 + (aEnd1 - aStart1) * t0;
      const aa1 = aStart1 + (aEnd1 - aStart1) * t1;
      segs.push([
        [rr * Math.cos(aa0), rr * Math.sin(aa0), zLo + zSpan * t0],
        [rr * Math.cos(aa1), rr * Math.sin(aa1), zLo + zSpan * t1],
      ]);
    }
    // Companion secondary diagonal glint streak offset in azimuth and height
    const aStart2 = facing + (95 * Math.PI) / 180;
    const aEnd2 = facing + (105 * Math.PI) / 180;
    const z2Lo = zLo + zSpan * 0.42;
    const z2Hi = zLo + zSpan * 0.82;
    segs.push([
      [rr * Math.cos(aStart2), rr * Math.sin(aStart2), z2Lo],
      [rr * Math.cos(aEnd2), rr * Math.sin(aEnd2), z2Hi],
    ]);
    return linesOn(cam, segs, "rig-glass-sheen");
  };

  if (!opts.cutaway) {
    const outer = buildOuter(0);
    const bodyMesh = turned([0, 0, 0], UP, outer, segments);
    return `<g class="rig-vessel">${drawMesh(bodyMesh, cam, { material, shine: true, crease: 36 })}${sheenSvg()}</g>`;
  }

  // Cutaway mode: solid glass base (z = 0..wall) + 220° thick-walled shell opening toward viewer
  const baseMesh = turned([0, 0, 0], UP, [[0, Math.max(0.3, r - bev)], [bev, r], [wall, r]], segments);
  const outer = buildOuter(wall);
  const inner: P2[] = outer.map(([z, ro]) => [z, Math.max(0.25, ro - wall)]);

  const openAngle = (140 * Math.PI) / 180; // leaves 220° back/side wall
  const a0 = facing + openAngle / 2;
  const a1 = facing + TAU - openAngle / 2;
  const arcSteps = Math.max(12, Math.round((segments * (TAU - openAngle)) / TAU));
  const shellMesh = revolvedShellArc(outer, inner, a0, a1, arcSteps);

  // Architectural cross-section cut-edge lines & subtle section ticks along visible vertical cutaway rims
  const cutEdgeSegs: [V3, V3][] = [];
  const cutEnds: [number, V3][] = [
    [a0, [Math.sin(a0), -Math.cos(a0), 0]],
    [a1, [-Math.sin(a1), Math.cos(a1), 0]],
  ];
  for (const [ang, normal] of cutEnds) {
    if (dot(normal, ax.toward) <= 1e-4) continue;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lift = 0.02;
    const pt = (rr: number, zz: number): V3 => [rr * ca + normal[0] * lift, rr * sa + normal[1] * lift, zz];
    // Continuous inner & outer architectural cut-edge profile lines
    for (let k = 0; k + 1 < outer.length; k++) {
      const [zo0, ro0] = outer[k]!;
      const [zo1, ro1] = outer[k + 1]!;
      const [zi0, ri0] = inner[k]!;
      const [zi1, ri1] = inner[k + 1]!;
      cutEdgeSegs.push([pt(ro0, zo0), pt(ro1, zo1)], [pt(ri0, zi0), pt(ri1, zi1)]);
      // Subtle 45-degree cross-section hatching across vertical wall segments
      const dz = zo1 - zo0;
      if (dz > wall * 1.1 && Math.abs(ro1 - ro0) < wall * 0.4) {
        const pitch = Math.max(wall * 1.4, dz / 7);
        const midR = (ro0 + ro1) / 2;
        const midRi = (ri0 + ri1) / 2;
        for (let zTick = zo0 + pitch * 0.5; zTick + wall * 0.65 < zo1; zTick += pitch) {
          cutEdgeSegs.push([pt(midRi, zTick), pt(midR, zTick + wall * 0.65)]);
        }
      }
    }
  }
  const cutEdgesSvg = cutEdgeSegs.length ? linesOn(cam, cutEdgeSegs, "rig-crease rig-cut-edge") : "";

  return (
    `<g class="rig-vessel rig-vessel-cutaway">` +
    drawMesh(baseMesh, cam, { material, shine: true, crease: 36 }) +
    drawMesh(shellMesh, cam, { material, shine: false, crease: 38, sort: "face" }) +
    cutEdgesSvg +
    sheenSvg() +
    `</g>`
  );
}

/**
 * Shaded cylindrical liquid body from `z0` to `z0 + h` with a bright top meniscus cap.
 * Returns `""` when `h <= 0.1`.
 */
export function liquidColumn(
  cam: Camera,
  opts: { r: number; h: number; z0?: number; material?: string; segments?: number },
): string {
  if (!Number.isFinite(opts.h) || opts.h <= 0.1) return "";
  const r = Math.max(0.2, opts.r);
  const h = opts.h;
  const z0 = opts.z0 ?? 0;
  const material = opts.material ?? "liquid";
  const segments = Math.max(12, Math.round(opts.segments ?? 28));
  const men = Math.min(r * 0.08, h * 0.2, 1.1);
  const profile: P2[] =
    h > men * 2.2
      ? [
          [0, Math.max(0.1, r - men * 0.4)],
          [men * 0.4, r],
          [h - men, r],
          [h, Math.max(0.1, r - men * 0.38)],
        ]
      : [
          [0, r],
          [h, Math.max(0.1, r - men * 0.25)],
        ];
  const mesh = turned([0, 0, z0], UP, profile, segments);
  return drawMesh(mesh, cam, { material, shine: true, crease: 42 });
}

/** Shaded vertical straw / dip tube from `z0` to `z1` at optional `[x, y]` offset. */
export function dipTube(
  cam: Camera,
  opts: { r: number; z0: number; z1: number; offset?: [number, number]; material?: string },
): string {
  if (!Number.isFinite(opts.z0) || !Number.isFinite(opts.z1) || Math.abs(opts.z1 - opts.z0) < 1e-4) return "";
  const [ox, oy] = opts.offset ?? [0, 0];
  const lo = Math.min(opts.z0, opts.z1);
  const hi = Math.max(opts.z0, opts.z1);
  const r = Math.max(0.15, opts.r);
  const mesh = rod([ox, oy, lo], [ox, oy, hi], r, 16);
  return drawMesh(mesh, cam, { material: opts.material ?? "glass", shine: true, crease: 40 });
}

/**
 * Pressable 3D spray cap / plunger head standing on `z = 0..h` with a raised side nozzle
 * orifice pointing along `spoutDir` (default `[1, 0]`).
 */
export function plungerNozzle(
  cam: Camera,
  opts: { r: number; h: number; spoutLen?: number; spoutDir?: [number, number]; material?: string },
): string {
  const r = Math.max(1, opts.r);
  const h = Math.max(1.5, opts.h);
  const spoutLen = Math.max(0.5, opts.spoutLen ?? r * 0.65);
  const rawDir = opts.spoutDir ?? [1, 0];
  const dLen = Math.hypot(rawDir[0], rawDir[1]) || 1;
  const dir: V3 = [rawDir[0] / dLen, rawDir[1] / dLen, 0];
  const material = opts.material ?? "alloy";

  const bev = Math.min(r * 0.14, h * 0.18);
  const capMesh = turned([0, 0, 0], UP, [[0, r], [h - bev, r], [h, Math.max(0.2, r - bev)]], 28);
  const capSvg = drawMesh(capMesh, cam, { material, shine: true, crease: 36 });

  const spoutZ = h * 0.56;
  const spoutR = Math.max(0.4, Math.min(r * 0.3, h * 0.28));
  const spoutStart: V3 = [dir[0] * (r * 0.65), dir[1] * (r * 0.65), spoutZ];
  const spoutTotal = r * 0.35 + spoutLen;
  const spoutMesh = turned(
    spoutStart,
    dir,
    [
      [0, spoutR * 1.08],
      [spoutTotal * 0.84, spoutR],
      [spoutTotal, spoutR * 0.88],
    ],
    20,
    UP,
  );
  const orificeMesh = turned(
    along(spoutStart, dir, spoutTotal - 0.15),
    dir,
    [
      [0, spoutR * 0.44],
      [0.35, spoutR * 0.44],
    ],
    14,
    UP,
  );
  const spoutSvg =
    drawMesh(spoutMesh, cam, { material, shine: true, crease: 38 }) +
    drawMesh(orificeMesh, cam, { material: "rubber", shine: false, crease: 40 });

  const ax = axesOf(cam.azimuth, cam.elevation);
  const spoutTip = along(spoutStart, dir, spoutTotal);
  const spoutInFront = nearness(cam, spoutTip, ax) >= nearness(cam, [0, 0, spoutZ], ax);
  return `<g class="rig-plunger">${spoutInFront ? capSvg + spoutSvg : spoutSvg + capSvg}</g>`;
}

/**
 * Deterministic 3D-projected mist spray cone and fine droplets fanning outward from `origin`
 * along `dir`. Returns `""` when `intensity <= 0.01` or `length <= 0.5`.
 */
export function sprayCone(
  cam: Camera,
  opts: {
    origin: V3;
    dir: V3;
    length: number;
    spreadDeg?: number;
    intensity?: number;
    seed?: number;
    droplets?: number;
  },
): string {
  const intensity = opts.intensity ?? 1;
  if (!Number.isFinite(opts.length) || opts.length <= 0.5 || !Number.isFinite(intensity) || intensity <= 0.01) {
    return "";
  }
  const clampedInt = Math.max(0, Math.min(1, intensity));
  const spreadDeg = Math.max(2, Math.min(75, opts.spreadDeg ?? 24));
  const seed = opts.seed ?? 1337;
  const count = Math.max(0, Math.round((opts.droplets ?? 28) * clampedInt));

  const ax = axesOf(cam.azimuth, cam.elevation);
  const d = unit(opts.dir);
  const helper: V3 = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const pl = planeOf(opts.origin, d, helper);
  const endR = opts.length * Math.tan((spreadDeg * Math.PI) / 180);

  // Project 3D cone silhouette via convex outline of apex + circular far mouth
  const conePts: P2[] = [screenOf(cam, opts.origin, ax)];
  const mouthSteps = 24;
  for (let i = 0; i < mouthSteps; i++) {
    const a = (TAU * i) / mouthSteps;
    const p = along(
      along(along(opts.origin, d, opts.length), pl.u, endR * Math.cos(a)),
      pl.v,
      endR * Math.sin(a),
    );
    conePts.push(screenOf(cam, p, ax));
  }
  const hull = convexOutline(conePts);
  const coneOpacity = +(0.18 + 0.34 * clampedInt).toFixed(2);
  const coneSvg = `<path class="rig-spray-cone" style="fill-opacity:${coneOpacity}" d="${pathThrough(hull)}"/>`;

  // Deterministic droplets distributed inside the 3D cone
  const rand = mulberry32(seed);
  const drops: { sp: P2; r: number; op: number; depth: number }[] = [];
  const baseDropWorldR = Math.max(0.22, opts.length * 0.018);
  for (let i = 0; i < count; i++) {
    const t = 0.12 + 0.88 * Math.pow(rand(), 0.72);
    const theta = rand() * TAU;
    const rad = Math.sqrt(rand()) * t * endR;
    const p = along(
      along(along(opts.origin, d, t * opts.length), pl.u, rad * Math.cos(theta)),
      pl.v,
      rad * Math.sin(theta),
    );
    const worldR = baseDropWorldR * (0.55 + 0.85 * rand()) * (1.15 - 0.45 * t);
    const op = +Math.max(0.2, Math.min(0.95, clampedInt * (1.05 - 0.55 * t))).toFixed(2);
    drops.push({ sp: screenOf(cam, p, ax), r: worldR * cam.scale, op, depth: nearness(cam, p, ax) });
  }
  drops.sort((a, b) => a.depth - b.depth);
  const dropsSvg = drops
    .map(
      (dr) =>
        `<circle class="rig-spray-drop" cx="${n1(dr.sp[0])}" cy="${n1(dr.sp[1])}" r="${n1(dr.r)}" fill-opacity="${dr.op}"/>`,
    )
    .join("");

  return `<g class="rig-spray">${coneSvg}${dropsSvg}</g>`;
}

/**
 * Closed watertight 360° annular turned ring (e.g., double-stepped chamfered watch bezel).
 * `outer` and `inner` have equal length N >= 2, ordered bottom-to-top as [z, r] with outer r > inner r > 0.
 */
function annularTurned(outer: readonly P2[], inner: readonly P2[], segments: number): Mesh {
  const N = outer.length;
  const K = Math.max(12, Math.round(segments));
  const verts: V3[] = [];
  const oIdx: number[][] = [];
  const iIdx: number[][] = [];

  for (let i = 0; i < K; i++) {
    const a = (TAU * i) / K;
    const ca = Math.cos(a), sa = Math.sin(a);
    const oCol: number[] = [];
    const iCol: number[] = [];
    for (let k = 0; k < N; k++) {
      const [zo, ro] = outer[k]!;
      const [zi, ri] = inner[k]!;
      oCol.push(verts.push([ro * ca, ro * sa, zo]) - 1);
      iCol.push(verts.push([ri * ca, ri * sa, zi]) - 1);
    }
    oIdx.push(oCol);
    iIdx.push(iCol);
  }

  const quadNormal = (q: number[]): V3 => {
    const a = verts[q[0]!]!, b = verts[q[1]!]!, c = verts[q[2]!]!, d = verts[q[3]!]!;
    return unit(cross(sub(c, a), sub(d, b)));
  };

  const faces: Face[] = [];
  for (let i = 0; i < K; i++) {
    const j = (i + 1) % K;
    for (let k = 0; k + 1 < N; k++) {
      const qOut = [oIdx[i]![k]!, oIdx[j]![k]!, oIdx[j]![k + 1]!, oIdx[i]![k + 1]!];
      faces.push({ loops: [qOut], normal: quadNormal(qOut), role: "band" });
      const qIn = [iIdx[i]![k]!, iIdx[i]![k + 1]!, iIdx[j]![k + 1]!, iIdx[j]![k]!];
      faces.push({ loops: [qIn], normal: quadNormal(qIn), role: "band" });
    }
    const qTop = [oIdx[i]![N - 1]!, oIdx[j]![N - 1]!, iIdx[j]![N - 1]!, iIdx[i]![N - 1]!];
    faces.push({ loops: [qTop], normal: UP, role: "cap" });
    const qBot = [iIdx[i]![0]!, iIdx[j]![0]!, oIdx[j]![0]!, oIdx[i]![0]!];
    faces.push({ loops: [qBot], normal: [0, 0, -1], role: "cap" });
  }

  return { verts, faces, sort: "face" };
}

/**
 * Recognizable 3D wristwatch case with sculpted double-stepped brushed chamfer bezel, recessed
 * dial chapter ring with 12 baton hour markers (thicker 12/3/6/9 indices), subtle diagonal
 * sapphire crystal sheen, optional sleek tapered chamfered lugs (`lugs: false` by default), and
 * a wide 240° exhibition skeleton cutaway (`cutaway: true` by default) revealing the movement inside.
 */
export function watchCaseDial(
  cam: Camera,
  opts: {
    r: number;
    h?: number;
    lugs?: boolean;
    cutaway?: boolean;
    bezelMaterial?: string;
    dialMaterial?: string;
  },
): string {
  const r = Math.max(4, opts.r);
  const h = Math.max(2, opts.h ?? r * 0.34);
  const showLugs = opts.lugs ?? false;
  const cutaway = opts.cutaway ?? true;
  const bezelMat = opts.bezelMaterial ?? "steel";
  const dialMat = opts.dialMaterial ?? "ceramic";
  const ax = axesOf(cam.azimuth, cam.elevation);

  const rDial = r * 0.82;
  const rChapterIn = rDial * 0.78;
  const dialZ0 = h * 0.58;
  const dialZ1 = h * 0.72;

  // Optional 4 sleek tapered chamfered lugs + fluted 3 o'clock crown sorted relative to case centre
  const backAddons: { depth: number; svg: string }[] = [];
  const frontAddons: { depth: number; svg: string }[] = [];
  const centerDepth = nearness(cam, [0, 0, h * 0.5], ax);

  if (showLugs) {
    const lugZ0 = h * 0.1;
    const lugZ1 = h * 0.68;
    const lugBevel = Math.min((lugZ1 - lugZ0) * 0.28, r * 0.045);
    const corners: [number, number][] = [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (const [sx, sy] of corners) {
      // Sleek tapered trapezoidal horn lug hugging the circular case curvature cleanly
      const outline: P2[] = [
        [sx * r * 0.42, sy * r * 0.80],
        [sx * r * 0.62, sy * r * 0.68],
        [sx * r * 0.53, sy * r * 1.18],
        [sx * r * 0.43, sy * r * 1.20],
      ];
      const mesh = chamferPlate(FLOOR, outline, lugZ0, lugZ1, lugBevel);
      const svg = drawMesh(mesh, cam, { material: bezelMat, shine: true, crease: 34 });
      const depth = nearness(cam, [sx * r * 0.5, sy * r * 0.96, (lugZ0 + lugZ1) / 2], ax);
      (depth < centerDepth ? backAddons : frontAddons).push({ depth, svg });
    }
    // Winding crown at 3 o'clock (+x)
    const crownR = Math.max(1.2, h * 0.26);
    const crownLen = Math.max(1.4, r * 0.16);
    const crownMesh = turned(
      [r * 0.95, 0, h * 0.46],
      [1, 0, 0],
      [
        [0, crownR * 0.62],
        [crownLen * 0.24, crownR],
        [crownLen * 0.82, crownR],
        [crownLen, crownR * 0.80],
      ],
      20,
      UP,
    );
    const crownSvg = drawMesh(crownMesh, cam, { material: bezelMat, shine: true, crease: 34 });
    const crownDepth = nearness(cam, [r + crownLen * 0.5, 0, h * 0.46], ax);
    (crownDepth < centerDepth ? backAddons : frontAddons).push({ depth: crownDepth, svg: crownSvg });
  }

  backAddons.sort((a, b) => a.depth - b.depth);
  frontAddons.sort((a, b) => a.depth - b.depth);

  // Main case body with sculpted underside bevel and upper shoulder
  const caseMesh = turned(
    [0, 0, 0],
    UP,
    [
      [0, r * 0.90],
      [h * 0.14, r],
      [h * 0.64, r],
      [dialZ1, r * 0.97],
    ],
    48,
  );
  const caseSvg = drawMesh(caseMesh, cam, { material: bezelMat, shine: true, crease: 36 });

  // Dial face (solid or wide 240° exhibition skeleton aperture with full outer chapter ring)
  let dialSvg = "";
  if (!cutaway) {
    const dialMesh = plate(FLOOR, { outer: circlePoints(rDial + 0.15, 48) }, dialZ0, dialZ1);
    dialSvg = drawMesh(dialMesh, cam, { material: dialMat, shine: false, crease: 40 });
  } else {
    // Recessed movement cavity plate visible behind the 240° exhibition aperture
    const cavityMesh = plate(FLOOR, { outer: circlePoints(rDial * 0.94, 40) }, h * 0.22, h * 0.30);
    const cavitySvg = drawMesh(cavityMesh, cam, { material: "frame", shine: false, crease: 42 });
    const cutHole = arcOutline(rDial * 0.10, rChapterIn, (-145 * Math.PI) / 180, (95 * Math.PI) / 180, 36);
    const dialMesh = plate(FLOOR, { outer: circlePoints(rDial + 0.15, 48), holes: [cutHole] }, dialZ0, dialZ1);
    dialSvg = cavitySvg + drawMesh(dialMesh, cam, { material: dialMat, shine: false, crease: 40, sort: "face" });
  }

  // Recessed chapter ring groove + 12 clean baton hour markers (thicker 12/3/6/9 indices)
  const tickZ = dialZ1 + 0.04;
  const ringPts = circlePoints(rChapterIn + rDial * 0.015, 48);
  const chapterRingSegs: [V3, V3][] = [];
  for (let i = 0; i < ringPts.length; i++) {
    const p0 = ringPts[i]!;
    const p1 = ringPts[(i + 1) % ringPts.length]!;
    chapterRingSegs.push([
      [p0[0], p0[1], tickZ],
      [p1[0], p1[1], tickZ],
    ]);
  }
  const majorSegs: [V3, V3][] = [];
  const minorSegs: [V3, V3][] = [];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 - (i * TAU) / 12;
    const isMajor = i % 3 === 0;
    const r0 = rDial * (isMajor ? 0.805 : 0.845);
    const r1 = rDial * 0.955;
    const ca = Math.cos(a), sa = Math.sin(a);
    if (isMajor) {
      // Crisp double-flank baton at 12, 3, 6, 9 for bold horological hierarchy
      const off = rDial * 0.016;
      const nx = -sa * off, ny = ca * off;
      majorSegs.push(
        [
          [r0 * ca, r0 * sa, tickZ],
          [r1 * ca, r1 * sa, tickZ],
        ],
        [
          [r0 * ca + nx, r0 * sa + ny, tickZ],
          [r1 * ca + nx, r1 * sa + ny, tickZ],
        ],
        [
          [r0 * ca - nx, r0 * sa - ny, tickZ],
          [r1 * ca - nx, r1 * sa - ny, tickZ],
        ],
      );
    } else {
      minorSegs.push([
        [r0 * ca, r0 * sa, tickZ],
        [r1 * ca, r1 * sa, tickZ],
      ]);
    }
  }
  const ticksSvg =
    linesOn(cam, chapterRingSegs, "rig-crease") +
    linesOn(cam, minorSegs, "rig-dial-tick") +
    linesOn(cam, majorSegs, "rig-dial-tick is-major");

  // Sculpted double-stepped brushed chamfer bezel framing the dial and rehaut
  const bezelH = h - dialZ1;
  const bezelOuter: P2[] = [
    [dialZ1, r * 0.97],
    [dialZ1 + bezelH * 0.38, r * 0.96],
    [dialZ1 + bezelH * 0.56, r * 0.925],
    [dialZ1 + bezelH * 0.82, r * 0.905],
    [h, r * 0.865],
  ];
  const bezelInner: P2[] = [
    [dialZ1, rDial],
    [dialZ1 + bezelH * 0.38, rDial],
    [dialZ1 + bezelH * 0.56, rDial * 1.006],
    [dialZ1 + bezelH * 0.82, rDial * 1.012],
    [h, rDial * 1.022],
  ];
  const bezelRing = annularTurned(bezelOuter, bezelInner, 48);
  const bezelSvg = drawMesh(bezelRing, cam, { material: bezelMat, shine: true, crease: 34, sort: "face" });

  // Subtle diagonal sapphire crystal glass sheen streaks across the upper-left dial edge
  const crystalZ = h + 0.04;
  const sheenR = rDial * 0.93;
  const crystalPt = (angDeg: number, frac = 1): V3 => {
    const rad = (angDeg * Math.PI) / 180;
    return [sheenR * frac * Math.cos(rad), sheenR * frac * Math.sin(rad), crystalZ];
  };
  const sapphireSheen = linesOn(
    cam,
    [
      [crystalPt(156, 0.96), crystalPt(104, 0.96)],
      [crystalPt(164, 0.92), crystalPt(118, 0.92)],
    ],
    "rig-glass-sheen",
  );

  return (
    `<g class="rig-watch-case">` +
    backAddons.map((a) => a.svg).join("") +
    caseSvg +
    dialSvg +
    ticksSvg +
    bezelSvg +
    sapphireSheen +
    frontAddons.map((a) => a.svg).join("") +
    `</g>`
  );
}

/**
 * Sculpted rhodium/brass watch movement mainplate with beveled outer rim, recessed circular
 * barrel/balance pockets, synthetic ruby jewel settings, and slotted steel screws.
 */
export function calibrePlate(
  cam: Camera,
  opts: {
    r: number;
    h?: number;
    z?: number;
    pockets?: { x: number; y: number; r: number; depth?: number }[];
    jewels?: { x: number; y: number; r?: number }[];
    screws?: { x: number; y: number; r?: number }[];
    material?: string;
  },
): string {
  const r = Math.max(4, opts.r);
  const h = Math.max(0.8, opts.h ?? Math.max(1.8, r * 0.12));
  const z = opts.z ?? 0;
  const material = opts.material ?? "rhodium";
  const topZ = z + h;
  const bevel = Math.min(h * 0.28, r * 0.045);
  const ax = axesOf(cam.azimuth, cam.elevation);

  // Beveled circular mainplate chassis
  const plateMesh = chamferPlate(FLOOR, circlePoints(r, 48), z, topZ, bevel);
  const plateSvg = drawMesh(plateMesh, cam, { material, shine: true, crease: 36 });

  // Subtle concentric machined perlage perimeter groove
  const groovePts = circlePoints(r * 0.91, 48);
  const grooveSegs: [V3, V3][] = [];
  for (let i = 0; i < groovePts.length; i++) {
    const p0 = groovePts[i]!;
    const p1 = groovePts[(i + 1) % groovePts.length]!;
    grooveSegs.push([
      [p0[0], p0[1], topZ + 0.02],
      [p1[0], p1[1], topZ + 0.02],
    ]);
  }
  const grooveSvg = linesOn(cam, grooveSegs, "rig-crease");

  // Recessed circular barrel / balance pockets sorted far-to-near
  const pocketEntries: { depth: number; svg: string }[] = [];
  for (const pk of opts.pockets ?? []) {
    if (!Number.isFinite(pk.r) || pk.r <= 0.1) continue;
    const pr = pk.r;
    const pDepth = Math.max(0.15, Math.min(pk.depth ?? h * 0.45, h * 0.85));
    const lipH = Math.min(0.14, pDepth * 0.22);
    const floorMesh = turned(
      [pk.x, pk.y, topZ - 0.02],
      UP,
      [
        [0, pr],
        [lipH * 0.55, pr],
        [lipH, pr * 0.93],
      ],
      32,
    );
    const innerMesh = turned(
      [pk.x, pk.y, topZ + lipH * 0.35],
      UP,
      [
        [0, pr * 0.88],
        [lipH * 0.85, pr * 0.88],
      ],
      28,
    );
    const rimPts = circlePoints(pr, 32, pk.x, pk.y);
    const rimSegs: [V3, V3][] = [];
    for (let i = 0; i < rimPts.length; i++) {
      const a = rimPts[i]!;
      const b = rimPts[(i + 1) % rimPts.length]!;
      rimSegs.push([
        [a[0], a[1], topZ + lipH + 0.01],
        [b[0], b[1], topZ + lipH + 0.01],
      ]);
    }
    const svg =
      `<g class="rig-calibre-pocket">` +
      drawMesh(floorMesh, cam, { material: "frame", shine: false, crease: 40 }) +
      drawMesh(innerMesh, cam, { material: "graphite", shine: false, crease: 42 }) +
      linesOn(cam, rimSegs, "rig-crease") +
      `</g>`;
    pocketEntries.push({ depth: nearness(cam, [pk.x, pk.y, topZ], ax), svg });
  }
  pocketEntries.sort((a, b) => a.depth - b.depth);

  // Synthetic ruby jewel settings & slotted steel screws sorted far-to-near
  const hardware: { depth: number; svg: string }[] = [];

  for (const jw of opts.jewels ?? []) {
    const jr = Math.max(0.35, jw.r ?? Math.max(0.9, r * 0.065));
    const jh = Math.max(0.24, jr * 0.38);
    const rGem = jr * 0.64;
    const rPivot = jr * 0.20;
    const chatonMesh = turned(
      [jw.x, jw.y, topZ],
      UP,
      [
        [0, jr],
        [jh * 0.68, jr],
        [jh, jr * 0.82],
      ],
      22,
    );
    const rubyMesh = turned(
      [jw.x, jw.y, topZ + jh * 0.55],
      UP,
      [
        [0, rGem],
        [jh * 0.52, rGem],
        [jh * 0.82, rGem * 0.65],
      ],
      20,
    );
    const pivotMesh = turned(
      [jw.x, jw.y, topZ + jh * 1.1],
      UP,
      [
        [0, rPivot],
        [jh * 0.35, rPivot],
      ],
      12,
    );
    const svg =
      `<g class="rig-calibre-jewel">` +
      drawMesh(chatonMesh, cam, { material: "brass", shine: true, crease: 36 }) +
      drawMesh(rubyMesh, cam, { material: "ruby", shine: true, crease: 40 }) +
      drawMesh(pivotMesh, cam, { material: "steel", shine: true, crease: 40 }) +
      `</g>`;
    hardware.push({ depth: nearness(cam, [jw.x, jw.y, topZ + jh], ax), svg });
  }

  for (let idx = 0; idx < (opts.screws ?? []).length; idx++) {
    const sc = opts.screws![idx]!;
    const sr = Math.max(0.35, sc.r ?? Math.max(0.85, r * 0.06));
    const sh = Math.max(0.24, sr * 0.42);
    const headMesh = turned(
      [sc.x, sc.y, topZ],
      UP,
      [
        [0, sr],
        [sh * 0.72, sr],
        [sh, sr * 0.82],
      ],
      22,
    );
    const slotAngle = 0.45 + idx * 0.85;
    const ca = Math.cos(slotAngle), sa = Math.sin(slotAngle);
    const slotR = sr * 0.78;
    const slotZ = topZ + sh + 0.02;
    const slotSvg = linesOn(
      cam,
      [
        [
          [sc.x - slotR * ca, sc.y - slotR * sa, slotZ],
          [sc.x + slotR * ca, sc.y + slotR * sa, slotZ],
        ],
      ],
      "rig-sil",
    );
    const svg =
      `<g class="rig-calibre-screw">` +
      drawMesh(headMesh, cam, { material: "steel", shine: true, crease: 36 }) +
      slotSvg +
      `</g>`;
    hardware.push({ depth: nearness(cam, [sc.x, sc.y, topZ + sh], ax), svg });
  }
  hardware.sort((a, b) => a.depth - b.depth);

  return (
    `<g class="rig-calibre-plate">` +
    plateSvg +
    grooveSvg +
    pocketEntries.map((p) => p.svg).join("") +
    hardware.map((hw) => hw.svg).join("") +
    `</g>`
  );
}

/**
 * Clean tapered 3D watch hand centered at `[0, 0, z]` pointing along `+x`
 * (ready for rotation via `turningPart` or `moveInPlane` for thin hands).
 */
export function watchHand(
  cam: Camera,
  opts: { len: number; width?: number; tail?: number; z?: number; material?: string },
): string {
  const len = Math.max(1, opts.len);
  const width = Math.max(0.4, opts.width ?? Math.max(0.8, len * 0.12));
  const tail = Math.max(0, opts.tail ?? len * 0.22);
  const z = opts.z ?? 0;
  const material = opts.material ?? "blued";

  const hw = width / 2;
  const thick = Math.max(0.24, Math.min(width * 0.32, 0.75));
  const bladeOutline: P2[] = [
    [-tail, -hw * 0.55],
    [0, -hw],
    [len, -hw * 0.12],
    [len, hw * 0.12],
    [0, hw],
    [-tail, hw * 0.55],
  ];
  const bladeMesh = plate(FLOOR, { outer: bladeOutline }, z, z + thick);
  const hubR = Math.max(hw * 1.15, 0.45);
  const hubMesh = turned(
    [0, 0, z],
    UP,
    [
      [0, hubR],
      [thick * 1.45, hubR],
      [thick * 1.65, hubR * 0.72],
    ],
    18,
  );
  return (
    `<g class="rig-watch-hand">` +
    drawMesh(bladeMesh, cam, { material, shine: true, crease: 36 }) +
    drawMesh(hubMesh, cam, { material, shine: true, crease: 36 }) +
    `</g>`
  );
}

/**
 * Shaded 3D coiled mainspring / spiral spring using `drawSpiralRibbon` (`sort: "face"`)
 * so near turns cleanly overlap far turns.
 */
export function coiledSpring(
  cam: Camera,
  opts: { rInner: number; rOuter: number; turns: number; z?: number; thickness?: number; material?: string },
): string {
  if (!Number.isFinite(opts.turns) || opts.turns <= 0 || opts.rOuter <= opts.rInner) return "";
  const rInner = Math.max(0.2, opts.rInner);
  const rOuter = opts.rOuter;
  const z = opts.z ?? 0;
  const radialPitch = (rOuter - rInner) / Math.max(opts.turns, 0.5);
  const thickness = Math.max(0.15, Math.min(opts.thickness ?? radialPitch * 0.28, radialPitch * 0.48));
  const height = Math.max(0.6, thickness * 3.2);
  const steps = Math.max(36, Math.round(opts.turns * 28));
  const pl = planeOf([0, 0, z], UP, [1, 0, 0]);
  return drawSpiralRibbon(
    cam,
    pl,
    { r0: rInner, r1: rOuter, turns: opts.turns, t0: 0, t1: height, thick: thickness, steps },
    { material: opts.material ?? "blued", shine: true, sort: "face" },
  );
}

export type CardTone = "neutral" | "good" | "bad" | "hot";

/**
 * Clean upright studio explainer card anchored in screen space at `screenOf(cam, at)`:
 * crisp rounded card with header title, optional status badge, and plain-English rows,
 * sized proportionally to `cam.scale` for both light and dark themes.
 */
export function explainerCard(
  cam: Camera,
  opts: { at: V3; title: string; rows: string[]; badge?: string; tone?: CardTone; width?: number },
): string {
  const [sx, sy] = screenOf(cam, opts.at);
  const s = Math.max(0.1, cam.scale);
  const tone: CardTone = opts.tone ?? "neutral";

  const titleFont = 2.05 * s;
  const rowFont = 1.5 * s;
  const badgeFont = 1.25 * s;
  const padX = 1.75 * s;
  const padY = 1.45 * s;
  const rowH = 2.25 * s;

  const titleW = opts.title.length * titleFont * 0.58;
  const badgeW = opts.badge ? Math.max(opts.badge.length * badgeFont * 0.65 + 2.0 * s, 5.0 * s) : 0;
  const headerW = titleW + (badgeW > 0 ? badgeW + 1.5 * s : 0);
  const rowsW = opts.rows.reduce((max, r) => Math.max(max, r.length * rowFont * 0.56), 0);
  const autoW = Math.max(headerW, rowsW) + 2 * padX;
  const cardW = opts.width !== undefined ? Math.max(opts.width * s, 8 * s) : Math.max(autoW, 22 * s);

  const headerH = titleFont * 1.2;
  const rowsGap = opts.rows.length > 0 ? 0.85 * s : 0;
  const cardH = 2 * padY + headerH + rowsGap + opts.rows.length * rowH;
  const rx = 1.1 * s;

  const titleY = padY + titleFont * 0.9;
  let badgeSvg = "";
  if (opts.badge) {
    const bx = cardW - padX - badgeW;
    const by = padY;
    const bh = headerH;
    badgeSvg =
      `<rect class="rig-explainer-badge" x="${n1(bx)}" y="${n1(by)}" width="${n1(badgeW)}" height="${n1(bh)}" rx="${n1(bh * 0.45)}"/>` +
      `<text class="rig-explainer-badge-text" x="${n1(bx + badgeW / 2)}" y="${n1(by + bh * 0.72)}" font-size="${n1(badgeFont)}" text-anchor="middle">${esc(opts.badge)}</text>`;
  }

  const rowsStartY = padY + headerH + rowsGap + rowFont * 0.9;
  const rowsSvg = opts.rows
    .map(
      (row, idx) =>
        `<text class="rig-explainer-row" x="${n1(padX)}" y="${n1(rowsStartY + idx * rowH)}" font-size="${n1(rowFont)}">${esc(row)}</text>`,
    )
    .join("");

  return (
    `<g class="rig-explainer" data-tone="${tone}" transform="translate(${n1(sx)} ${n1(sy)})">` +
    `<rect class="rig-explainer-bg" width="${n1(cardW)}" height="${n1(cardH)}" rx="${n1(rx)}"/>` +
    `<text class="rig-explainer-title" x="${n1(padX)}" y="${n1(titleY)}" font-size="${n1(titleFont)}">${esc(opts.title)}</text>` +
    badgeSvg +
    rowsSvg +
    `</g>`
  );
}

/**
 * Compact upright studio progress / level bar (`fraction` clamped to `0..1`) with label
 * and optional readout value, anchored at `screenOf(cam, at)`.
 */
export function meterBar(
  cam: Camera,
  opts: { at: V3; w: number; h?: number; fraction: number; label: string; valueText?: string; tone?: CardTone },
): string {
  const [sx, sy] = screenOf(cam, opts.at);
  const s = Math.max(0.1, cam.scale);
  const tone: CardTone = opts.tone ?? "neutral";
  const frac = Number.isFinite(opts.fraction) ? Math.max(0, Math.min(1, opts.fraction)) : 0;

  const barW = Math.max(1, opts.w) * s;
  const barH = Math.max(0.5, opts.h ?? Math.max(2.0, opts.w * 0.1)) * s;
  const fontSize = Math.max(barH * 0.9, 1.5 * s);
  const gap = 0.7 * s;
  const rx = barH * 0.45;
  const trackY = fontSize + gap;
  const fillW = barW * frac;

  const valueSvg =
    opts.valueText !== undefined
      ? `<text class="rig-meter-value" x="${n1(barW)}" y="${n1(fontSize * 0.88)}" font-size="${n1(fontSize)}" text-anchor="end">${esc(opts.valueText)}</text>`
      : "";
  const fillSvg =
    fillW > 0.05
      ? `<rect class="rig-meter-fill" x="0" y="${n1(trackY)}" width="${n1(fillW)}" height="${n1(barH)}" rx="${n1(rx)}"/>`
      : "";

  return (
    `<g class="rig-meter" data-tone="${tone}" transform="translate(${n1(sx)} ${n1(sy)})">` +
    `<text class="rig-meter-label" x="0" y="${n1(fontSize * 0.88)}" font-size="${n1(fontSize)}">${esc(opts.label)}</text>` +
    valueSvg +
    `<rect class="rig-meter-track" x="0" y="${n1(trackY)}" width="${n1(barW)}" height="${n1(barH)}" rx="${n1(rx)}"/>` +
    fillSvg +
    `</g>`
  );
}

// ---------------------------------------------------------------- universal physical engineering primitives

export interface AxialHousingOpts {
  length: number;
  rOuter: number;
  rInner?: number;
  rOuterEnd?: number;
  rInnerEnd?: number;
  x0?: number;
  axis?: V3;
  origin?: V3;
  cutaway?: boolean;
  hatch?: boolean;
  material?: string;
  finish?: Finish;
  segments?: number;
}

/**
 * Watertight thick-walled revolved shell around an arbitrary plane's normal `pl.n`.
 * `outer` and `inner` are equal-length arrays of `[s, r]` pairs ordered with increasing `s` and `rOuter > rInner > 0`.
 * When `closed360` is false, sweeps `[a0, a1]` and closes both longitudinal cut walls with exact outward normals.
 */
function axialShellMesh(
  pl: Plane,
  outer: readonly P2[],
  inner: readonly P2[],
  a0: number,
  a1: number,
  arcSteps: number,
  closed360: boolean,
): Mesh {
  const N = outer.length;
  const K = Math.max(4, Math.round(arcSteps));
  const colCount = closed360 ? K : K + 1;
  const verts: V3[] = [];
  const oIdx: number[][] = [];
  const iIdx: number[][] = [];

  for (let i = 0; i < colCount; i++) {
    const a = closed360 ? (TAU * i) / K : a0 + ((a1 - a0) * i) / K;
    const ca = Math.cos(a), sa = Math.sin(a);
    const oCol: number[] = [];
    const iCol: number[] = [];
    for (let k = 0; k < N; k++) {
      const [so, ro] = outer[k]!;
      const [si, ri] = inner[k]!;
      oCol.push(verts.push(pointOn(pl, ro * ca, ro * sa, so)) - 1);
      iCol.push(verts.push(pointOn(pl, ri * ca, ri * sa, si)) - 1);
    }
    oIdx.push(oCol);
    iIdx.push(iCol);
  }

  const quadNormal = (q: number[]): V3 => {
    const p0 = verts[q[0]!]!, p1 = verts[q[1]!]!, p2 = verts[q[2]!]!, p3 = verts[q[3]!]!;
    return unit(cross(sub(p2, p0), sub(p3, p1)));
  };

  const faces: Face[] = [];
  const negN = scale(pl.n, -1);
  for (let i = 0; i < K; i++) {
    const j = closed360 ? (i + 1) % K : i + 1;
    for (let k = 0; k + 1 < N; k++) {
      // Outer band: outward radial (+e_t x (+ds·n + dr·e_r))
      const qOut = [oIdx[i]![k]!, oIdx[j]![k]!, oIdx[j]![k + 1]!, oIdx[i]![k + 1]!];
      faces.push({ loops: [qOut], normal: quadNormal(qOut), role: "band" });
      // Inner band: inward radial facing cavity
      const qIn = [iIdx[i]![k]!, iIdx[i]![k + 1]!, iIdx[j]![k + 1]!, iIdx[j]![k]!];
      faces.push({ loops: [qIn], normal: quadNormal(qIn), role: "band" });
    }
    // End ring (+n)
    const qEndHi = [oIdx[i]![N - 1]!, oIdx[j]![N - 1]!, iIdx[j]![N - 1]!, iIdx[i]![N - 1]!];
    faces.push({ loops: [qEndHi], normal: pl.n, role: "cap" });
    // Start ring (-n)
    const qEndLo = [iIdx[i]![0]!, iIdx[j]![0]!, oIdx[j]![0]!, oIdx[i]![0]!];
    faces.push({ loops: [qEndLo], normal: negN, role: "cap" });
  }

  if (!closed360) {
    // Longitudinal cutaway end walls at a0 (-e_t(a0)) and a1 (+e_t(a1))
    const n0 = unit(add(scale(pl.u, Math.sin(a0)), scale(pl.v, -Math.cos(a0))));
    const n1v = unit(add(scale(pl.u, -Math.sin(a1)), scale(pl.v, Math.cos(a1))));
    for (let k = 0; k + 1 < N; k++) {
      const q0 = [oIdx[0]![k]!, oIdx[0]![k + 1]!, iIdx[0]![k + 1]!, iIdx[0]![k]!];
      faces.push({ loops: [q0], normal: n0, role: "end" });
      const q1 = [iIdx[K]![k]!, iIdx[K]![k + 1]!, oIdx[K]![k + 1]!, oIdx[K]![k]!];
      faces.push({ loops: [q1], normal: n1v, role: "end" });
    }
  }

  return { verts, faces, sort: "face" };
}

/**
 * Horizontal (or arbitrary-axis) cylindrical/conical housing with optional camera-facing ~140° cutaway
 * and crisp 45° section hatching along longitudinal cut walls (`sort: "face"` so shafts, turbines, or
 * gears sit cleanly visible inside).
 */
export function axialHousing(cam: Camera, opts: AxialHousingOpts): string {
  const length = Math.max(1, opts.length);
  const rOuter = Math.max(1, opts.rOuter);
  const rInner = Math.max(0.2, Math.min(rOuter * 0.96, opts.rInner ?? rOuter * 0.86));
  const rOuterEnd = Math.max(1, opts.rOuterEnd ?? rOuter);
  const rInnerEnd = Math.max(
    0.2,
    Math.min(
      rOuterEnd * 0.96,
      opts.rInnerEnd ?? (opts.rOuterEnd !== undefined ? rOuterEnd * (rInner / rOuter) : rInner),
    ),
  );
  const x0 = opts.x0 ?? -length / 2;
  const x1 = x0 + length;
  const cutaway = opts.cutaway ?? true;
  const hatch = opts.hatch ?? true;
  const material = opts.material ?? "steel";
  const finish: Finish = opts.finish ?? "metal";
  const segments = Math.max(12, Math.round(opts.segments ?? 28));

  const a = unit(opts.axis ?? [1, 0, 0]);
  const helper: V3 = Math.abs(dot(a, UP)) > 0.92 ? [0, 1, 0] : UP;
  const pl = planeOf(opts.origin ?? [0, 0, 0], a, helper);

  const wallStart = rOuter - rInner;
  const wallEnd = rOuterEnd - rInnerEnd;
  const bev = Math.min(length * 0.04, wallStart * 0.28, wallEnd * 0.28);
  const outer: P2[] =
    bev > 1e-3
      ? [
          [x0, rOuter - bev],
          [x0 + bev, rOuter],
          [x1 - bev, rOuterEnd],
          [x1, rOuterEnd - bev],
        ]
      : [
          [x0, rOuter],
          [x1, rOuterEnd],
        ];
  const inner: P2[] =
    bev > 1e-3
      ? [
          [x0, rInner],
          [x0 + bev, rInner],
          [x1 - bev, rInnerEnd],
          [x1, rInnerEnd],
        ]
      : [
          [x0, rInner],
          [x1, rInnerEnd],
        ];

  const ax = axesOf(cam.azimuth, cam.elevation);
  const facing = Math.atan2(dot(ax.toward, pl.v), dot(ax.toward, pl.u));
  const openAngle = (140 * Math.PI) / 180; // leaves 220° back/side casing
  const a0 = facing + openAngle / 2;
  const a1 = facing + TAU - openAngle / 2;
  const arcSteps = cutaway ? Math.max(12, Math.round((segments * (TAU - openAngle)) / TAU)) : segments;

  const mesh = axialShellMesh(pl, outer, inner, a0, a1, arcSteps, !cutaway);
  const shellSvg = drawMesh(mesh, cam, {
    material,
    finish,
    shine: finish === "metal" || finish === "glass",
    crease: 36,
    sort: "face",
  });

  let hatchSvg = "";
  if (cutaway && hatch) {
    const meanWall = Math.max(0.5, (wallStart + wallEnd) * 0.5);
    const spacing = Math.max(1.2, Math.min(meanWall * 0.95, length / 12));
    const cutWalls: [number, V3][] = [
      [a0, unit(add(scale(pl.u, Math.sin(a0)), scale(pl.v, -Math.cos(a0))))],
      [a1, unit(add(scale(pl.u, -Math.sin(a1)), scale(pl.v, Math.cos(a1))))],
    ];
    for (const [ang, nCut] of cutWalls) {
      if (dot(nCut, ax.toward) <= 1e-4) continue;
      const eR = unit(add(scale(pl.u, Math.cos(ang)), scale(pl.v, Math.sin(ang))));
      const cutPl = planeOf(along(pl.origin, nCut, 0.02), nCut, pl.n);
      const rSign = dot(cutPl.v, eR) >= 0 ? 1 : -1;
      const wallOutline: P2[] = [];
      for (let k = 0; k < outer.length; k++) {
        wallOutline.push([outer[k]![0], rSign * outer[k]![1]]);
      }
      for (let k = inner.length - 1; k >= 0; k--) {
        wallOutline.push([inner[k]![0], rSign * inner[k]![1]]);
      }
      hatchSvg += cutawayHatch(cam, cutPl, wallOutline, spacing);
    }
  }

  return `<g class="rig-axial-housing${cutaway ? " rig-axial-housing-cutaway" : ""}">${shellSvg}${hatchSvg}</g>`;
}

export interface TurbineRotorOpts {
  origin?: V3;
  axis?: V3;
  rHub: number;
  rTip: number;
  blades: number;
  bladeWidth?: number;
  bladeThick?: number;
  twistDeg?: number;
  noseLen?: number;
  rotRad?: number;
  material?: string;
  hubMaterial?: string;
}

/**
 * 3D bladed fan / compressor / turbine rotor centered at `origin` along `axis` (default `[1, 0, 0]`).
 * Draws depth-sorted pitched 3D blades around a beveled turned hub plus an optional aerodynamic
 * ogive spinner nose cone, compatible with `turningPart()`.
 */
export function turbineRotor(cam: Camera, opts: TurbineRotorOpts): string {
  const origin: V3 = opts.origin ?? [0, 0, 0];
  const a = unit(opts.axis ?? [1, 0, 0]);
  const helper: V3 = Math.abs(dot(a, UP)) > 0.92 ? [0, 1, 0] : UP;
  const pl = planeOf(origin, a, helper);

  const rHub = Math.max(0.8, opts.rHub);
  const rTip = Math.max(rHub + 0.6, opts.rTip);
  const span = rTip - rHub;
  const blades = Math.max(1, Math.round(opts.blades));
  const bladeWidth = Math.max(0.8, opts.bladeWidth ?? span * 0.38);
  const bladeThick = Math.max(0.3, opts.bladeThick ?? Math.max(0.6, span * 0.08));
  const twistRad = ((opts.twistDeg ?? 28) * Math.PI) / 180;
  const noseLen = Math.max(0, opts.noseLen ?? 0);
  const rotRad = opts.rotRad ?? 0;
  const material = opts.material ?? "steel";
  const hubMaterial = opts.hubMaterial ?? "subject";

  const ax = axesOf(cam.azimuth, cam.elevation);
  const centerDepth = nearness(cam, origin, ax);

  // Turned beveled hub body seated along axis around origin
  const hubHalf = Math.max(bladeWidth * 0.56, rHub * 0.25);
  const hubBev = Math.min(hubHalf * 0.25, rHub * 0.14);
  const hubMesh = turned(
    along(origin, a, -hubHalf),
    a,
    [
      [0, Math.max(0.2, rHub - hubBev)],
      [hubBev, rHub],
      [hubHalf * 2 - hubBev, rHub],
      [hubHalf * 2, Math.max(0.2, rHub - hubBev)],
    ],
    28,
    helper,
  );
  const hubParts: { depth: number; svg: string }[] = [
    {
      depth: centerDepth,
      svg: drawMesh(hubMesh, cam, { material: hubMaterial, finish: "metal", shine: true, crease: 34 }),
    },
  ];

  // Optional aerodynamic ogive spinner nose cone pointing upstream along -axis
  if (noseLen > 0.1) {
    const noseBase = along(origin, a, -hubHalf);
    const noseDir = scale(a, -1);
    const rBase = rHub * 0.96;
    const rTipNose = Math.max(0.15, rHub * 0.07);
    const stations = [0, 0.24, 0.5, 0.76, 0.93, 1];
    const noseProfile: P2[] = stations.map((t) => [
      t * noseLen,
      t < 1 ? Math.max(rTipNose, rBase * Math.pow(1 - t, 0.65)) : rTipNose,
    ]);
    const noseMesh = turned(noseBase, noseDir, noseProfile, 26, helper);
    const noseMid = along(noseBase, noseDir, noseLen * 0.42);
    hubParts.push({
      depth: nearness(cam, noseMid, ax),
      svg: drawMesh(noseMesh, cam, { material: hubMaterial, finish: "metal", shine: true, crease: 36 }),
    });
  }
  hubParts.sort((x, y) => x.depth - y.depth);

  // Build pitched 3D airfoil-tapered blades, sorted into back & front halves relative to hub center
  const backBlades: { depth: number; svg: string }[] = [];
  const frontBlades: { depth: number; svg: string }[] = [];
  const rRoot = rHub * 0.86;
  const rMid = rRoot + (rTip - rRoot) * 0.55;
  const halfW = bladeWidth / 2;
  const bladeOutline: P2[] = [
    [rRoot, -halfW * 0.72],
    [rMid, -halfW],
    [rTip, -halfW * 0.86],
    [rTip, halfW * 0.94],
    [rMid, halfW],
    [rRoot, halfW * 0.72],
  ];
  const cosTw = Math.cos(twistRad), sinTw = Math.sin(twistRad);

  for (let i = 0; i < blades; i++) {
    const ang = rotRad + (TAU * i) / blades;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const eR = add(scale(pl.u, ca), scale(pl.v, sa));
    const eT = add(scale(pl.u, -sa), scale(pl.v, ca));
    const thickDir = unit(add(scale(eT, cosTw), scale(a, -sinTw)));
    const bladePl = planeOf(origin, thickDir, eR);
    const mesh = plate(bladePl, { outer: bladeOutline }, -bladeThick / 2, bladeThick / 2);
    const svg = drawMesh(mesh, cam, { material, finish: "metal", shine: true, crease: 30 });
    const centroid = along(origin, eR, (rHub + rTip) * 0.55);
    const depth = nearness(cam, centroid, ax);
    (depth < centerDepth ? backBlades : frontBlades).push({ depth, svg });
  }
  backBlades.sort((x, y) => x.depth - y.depth);
  frontBlades.sort((x, y) => x.depth - y.depth);

  return (
    `<g class="rig-turbine-rotor">` +
    backBlades.map((b) => b.svg).join("") +
    hubParts.map((p) => p.svg).join("") +
    frontBlades.map((b) => b.svg).join("") +
    `</g>`
  );
}

export interface PistonAssemblyOpts {
  r: number;
  height?: number;
  z0?: number;
  rodLen?: number;
  material?: string;
  ringMaterial?: string;
}

/**
 * Machined 3D piston with recessed compression/oil rings, steel wrist pin bosses, and optional
 * downward connecting rod with big-end bearing journal.
 */
export function pistonAssembly(cam: Camera, opts: PistonAssemblyOpts): string {
  const r = Math.max(2, opts.r);
  const height = Math.max(3, opts.height ?? r * 1.15);
  const z0 = opts.z0 ?? 0;
  const rodLen = Math.max(0, opts.rodLen ?? 0);
  const material = opts.material ?? "alu";
  const ringMaterial = opts.ringMaterial ?? "graphite";

  const ax = axesOf(cam.azimuth, cam.elevation);
  const fromAbove = ax.toward[2] >= 0;

  // Optional downward connecting rod (tapered chamfered shank + big-end bearing journal)
  let rodSvg = "";
  const pinZ = z0 + height * 0.34;
  if (rodLen > 0.2) {
    const zBot = z0 - rodLen;
    const rodPl = planeOf([0, 0, 0], [0, 1, 0], [1, 0, 0]);
    const wTop = Math.max(0.8, r * 0.22);
    const wBot = Math.max(1.0, r * 0.30);
    const rodThick = Math.max(0.8, r * 0.24);
    const shankOutline: P2[] = [
      [-wBot, zBot],
      [wBot, zBot],
      [wTop, z0 + height * 0.12],
      [-wTop, z0 + height * 0.12],
    ];
    const shankMesh = chamferPlate(rodPl, shankOutline, -rodThick / 2, rodThick / 2, Math.min(rodThick * 0.25, wTop * 0.25));
    const bigEndR = Math.max(wBot * 1.35, r * 0.36);
    const bigEndLen = rodThick * 1.35;
    const bigEndMesh = turned(
      [0, -bigEndLen / 2, zBot],
      [0, 1, 0],
      [
        [0, bigEndR * 0.9],
        [bigEndLen * 0.12, bigEndR],
        [bigEndLen * 0.88, bigEndR],
        [bigEndLen, bigEndR * 0.9],
      ],
      24,
      UP,
    );
    const boreR = bigEndR * 0.56;
    const boreMesh = turned(
      [0, -bigEndLen * 0.52, zBot],
      [0, 1, 0],
      [
        [0, boreR],
        [bigEndLen * 1.04, boreR],
      ],
      18,
      UP,
    );
    const shankDepth = nearness(cam, [0, 0, (zBot + z0) * 0.5], ax);
    const bigEndDepth = nearness(cam, [0, 0, zBot], ax);
    const shankSvg = drawMesh(shankMesh, cam, { material: "steel", finish: "metal", shine: true, crease: 34 });
    const journalSvg =
      drawMesh(bigEndMesh, cam, { material: "steel", finish: "metal", shine: true, crease: 34 }) +
      drawMesh(boreMesh, cam, { material: ringMaterial, finish: "satin", shine: false, crease: 40 });
    rodSvg = `<g class="rig-piston-rod">${bigEndDepth < shankDepth ? journalSvg + shankSvg : shankSvg + journalSvg}</g>`;
  }

  // Stacked coaxial slices (skirt -> 3 compression/oil rings & lands -> beveled crown)
  const skirtTop = height * 0.55;
  const ringZone = height * 0.34;
  const ringH = Math.max(0.35, ringZone * 0.15);
  const landH = (ringZone - 3 * ringH) / 2;
  const zR1 = skirtTop;
  const zR2 = zR1 + ringH + landH;
  const zR3 = zR2 + ringH + landH;
  const zCrownStart = zR3 + ringH;
  const bev = Math.min(r * 0.08, (height - zCrownStart) * 0.45, skirtTop * 0.15);
  const rRing = r * 1.016;

  const cyl = (zLo: number, zHi: number, prof: P2[], mat: string, fin: Finish) =>
    drawMesh(turned([0, 0, z0 + zLo], UP, prof, 32), cam, { material: mat, finish: fin, shine: fin === "metal", crease: 36 });

  const skirtSvg = cyl(
    0,
    zR1,
    [
      [0, Math.max(0.5, r - bev)],
      [bev, r],
      [zR1, r],
    ],
    material,
    "metal",
  );
  const upperSlices: string[] = [
    cyl(zR1, zR1 + ringH, [[0, rRing], [ringH, rRing]], ringMaterial, "satin"),
    cyl(zR1 + ringH, zR2, [[0, r], [landH, r]], material, "metal"),
    cyl(zR2, zR2 + ringH, [[0, rRing], [ringH, rRing]], ringMaterial, "satin"),
    cyl(zR2 + ringH, zR3, [[0, r], [landH, r]], material, "metal"),
    cyl(zR3, zCrownStart, [[0, rRing], [ringH, rRing]], ringMaterial, "satin"),
    cyl(
      zCrownStart,
      height,
      [
        [0, r],
        [Math.max(0.1, height - zCrownStart - bev), r],
        [height - zCrownStart, Math.max(0.5, r - bev)],
      ],
      material,
      "metal",
    ),
  ];

  // Steel wrist pin bosses seated on -y and +y skirt flanks
  const pinR = Math.min(r * 0.24, skirtTop * 0.34);
  const pinBoreR = pinR * 0.56;
  const pinOut = r * 1.03;
  const pinStart = r * 0.88;
  const makePinBoss = (signY: -1 | 1): { depth: number; svg: string } => {
    const dir: V3 = [0, signY, 0];
    const outerMesh = turned(
      [0, signY * pinStart, pinZ],
      dir,
      [
        [0, pinR],
        [pinOut - pinStart, pinR * 0.94],
      ],
      20,
      UP,
    );
    const innerMesh = turned(
      [0, signY * (pinOut - 0.08), pinZ],
      dir,
      [
        [0, pinBoreR],
        [0.14, pinBoreR],
      ],
      16,
      UP,
    );
    const svg =
      `<g class="rig-piston-pin">` +
      drawMesh(outerMesh, cam, { material: "steel", finish: "metal", shine: true, crease: 36 }) +
      drawMesh(innerMesh, cam, { material: ringMaterial, finish: "satin", shine: false, crease: 40 }) +
      `</g>`;
    return { depth: nearness(cam, [0, signY * pinOut, pinZ], ax), svg };
  };
  const skirtDepth = nearness(cam, [0, 0, pinZ], ax);
  const pins = [makePinBoss(-1), makePinBoss(1)];
  const backPins = pins.filter((p) => p.depth < skirtDepth).sort((a, b) => a.depth - b.depth).map((p) => p.svg).join("");
  const frontPins = pins.filter((p) => p.depth >= skirtDepth).sort((a, b) => a.depth - b.depth).map((p) => p.svg).join("");

  const bodyOrdered = fromAbove
    ? rodSvg + backPins + skirtSvg + frontPins + upperSlices.join("")
    : upperSlices.reverse().join("") + backPins + skirtSvg + frontPins + rodSvg;

  return `<g class="rig-piston">${bodyOrdered}</g>`;
}

export interface HelicalCoilOpts {
  r: number;
  height: number;
  turns: number;
  wireR?: number;
  z0?: number;
  axis?: V3;
  origin?: V3;
  material?: string;
}

/**
 * 3D helical spring or electromagnetic induction coil swept with parallel-transport `tube()`
 * (`sort: "face"` so near coils cleanly overlap far coils along any axis).
 */
export function helicalCoil(cam: Camera, opts: HelicalCoilOpts): string {
  if (
    !Number.isFinite(opts.r) ||
    opts.r <= 0.1 ||
    !Number.isFinite(opts.height) ||
    opts.height <= 0.1 ||
    !Number.isFinite(opts.turns) ||
    opts.turns <= 0
  ) {
    return "";
  }
  const r = opts.r;
  const height = opts.height;
  const turns = opts.turns;
  const wireR = Math.max(0.25, opts.wireR ?? Math.max(0.7, r * 0.11));
  const z0 = opts.z0 ?? 0;
  const axis = unit(opts.axis ?? [0, 0, 1]);
  const origin: V3 = opts.origin ?? [0, 0, 0];
  const material = opts.material ?? "steel";

  const helper: V3 = Math.abs(dot(axis, [1, 0, 0])) > 0.92 ? [0, 0, 1] : [1, 0, 0];
  const baseOrigin = along(origin, axis, z0);
  const pl = planeOf(baseOrigin, axis, helper);

  const steps = Math.max(24, Math.min(200, Math.round(turns * 18)));
  const inset = height > wireR * 3 ? wireR : 0;
  const sLo = inset;
  const sHi = height - inset;
  const pts: V3[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const ang = u * turns * TAU;
    const s = sLo + (sHi - sLo) * u;
    pts.push(pointOn(pl, r * Math.cos(ang), r * Math.sin(ang), s));
  }

  const mesh = tube(pts, wireR, 10);
  const coilSvg = drawMesh(mesh, cam, {
    material,
    finish: "metal",
    shine: true,
    crease: 42,
    sort: "face",
  });
  return `<g class="rig-helical-coil">${coilSvg}</g>`;
}

export interface ElectrodeStackOpts {
  w: number;
  d: number;
  layerH?: number;
  gap?: number;
  layers?: number;
  origin?: V3;
  anodeMaterial?: string;
  cathodeMaterial?: string;
  sepMaterial?: string;
}

/**
 * Layered battery / fuel-cell / capacitor / microchip cutaway stack with beveled electrode plates,
 * opposing anode/cathode current-collector tabs, dielectric separator sheets, and a soft floor shadow.
 */
export function electrodeStack(cam: Camera, opts: ElectrodeStackOpts): string {
  const w = Math.max(2, opts.w);
  const d = Math.max(2, opts.d);
  const layerH = Math.max(0.5, opts.layerH ?? 3.2);
  const gap = Math.max(0, opts.gap ?? 1.6);
  const layers = Math.max(1, Math.round(opts.layers ?? 5));
  const origin: V3 = opts.origin ?? [0, 0, 0];
  const anodeMat = opts.anodeMaterial ?? "graphite";
  const cathodeMat = opts.cathodeMaterial ?? "cobalt";
  const sepMat = opts.sepMaterial ?? "ceramic";

  const ax = axesOf(cam.azimuth, cam.elevation);
  const pl = planeOf(origin, UP, [1, 0, 0]);
  const cornerR = Math.min(w, d) * 0.1;
  const bevel = Math.min(layerH * 0.24, Math.min(w, d) * 0.04);
  const tabLen = Math.min(w * 0.16, 4.8);
  const tabW = Math.min(d * 0.26, 6.0);
  const tabCornerR = Math.min(tabLen, tabW) * 0.18;

  const layerEntries: { zMid: number; svg: string }[] = [];
  let bottomMesh: Mesh | null = null;

  for (let i = 0; i < layers; i++) {
    const zBot = i * (layerH + gap);
    const kind: "anode" | "cathode" | "sep" =
      layers === 2
        ? i === 0
          ? "anode"
          : "cathode"
        : i % 2 === 1
          ? "sep"
          : i % 4 === 0
            ? "anode"
            : "cathode";

    const isSep = kind === "sep";
    const hCur = isSep ? Math.max(0.4, layerH * 0.72) : layerH;
    const zLo = zBot + (layerH - hCur) * 0.5;
    const zHi = zLo + hCur;
    const zMid = (zLo + zHi) * 0.5;
    const mat = isSep ? sepMat : kind === "anode" ? anodeMat : cathodeMat;
    const fin: Finish = isSep ? "satin" : "metal";
    const pw = isSep ? w * 0.96 : w;
    const pd = isSep ? d * 0.96 : d;

    const plateMesh = chamferPlate(pl, roundedRect(pw, pd, cornerR, 0, 0, 4), zLo, zHi, Math.min(bevel, hCur * 0.28));
    if (i === 0) bottomMesh = plateMesh;
    const plateSvg = drawMesh(plateMesh, cam, {
      material: mat,
      finish: fin,
      shine: fin === "metal",
      crease: 34,
    });

    let layerSvg = plateSvg;
    if (!isSep) {
      const signX = kind === "anode" ? -1 : 1;
      const tabCx = signX * (w * 0.5 + tabLen * 0.42);
      const tabCy = signX * (d * 0.18);
      const tabH = Math.max(0.35, hCur * 0.56);
      const tabZLo = zMid - tabH / 2;
      const tabZHi = zMid + tabH / 2;
      const tabMesh = chamferPlate(
        pl,
        roundedRect(tabLen * 1.15, tabW, tabCornerR, tabCx, tabCy, 3),
        tabZLo,
        tabZHi,
        Math.min(bevel * 0.6, tabH * 0.25),
      );
      const tabMat = kind === "anode" ? "brass" : "alu";
      const tabSvg = drawMesh(tabMesh, cam, { material: tabMat, finish: "metal", shine: true, crease: 34 });
      const plateDepth = nearness(cam, pointOn(pl, 0, 0, zMid), ax);
      const tabDepth = nearness(cam, pointOn(pl, tabCx, tabCy, zMid), ax);
      layerSvg = tabDepth < plateDepth ? tabSvg + plateSvg : plateSvg + tabSvg;
    }

    layerEntries.push({ zMid, svg: `<g class="rig-electrode-layer" data-kind="${kind}">${layerSvg}</g>` });
  }

  const ordered = ax.toward[2] >= 0 ? layerEntries : [...layerEntries].reverse();
  let shadowSvg = "";
  if (bottomMesh && ax.toward[2] >= 0) {
    const shDist = Math.max(0.8, Math.min(w, d) * 0.08);
    const shadowOff: V3 = [
      (ax.right[0] - ax.toward[0]) * shDist * 0.5,
      (ax.right[1] - ax.toward[1]) * shDist * 0.5,
      -0.05,
    ];
    shadowSvg = softShadow(bottomMesh, cam, shadowOff);
  }

  return `<g class="rig-electrode-stack">${shadowSvg}${ordered.map((e) => e.svg).join("")}</g>`;
}

export type FlowTone = "subject" | "cool" | "good" | "bad" | "neutral";

export interface FlowArrow3DOpts {
  points: readonly V3[];
  width?: number;
  headSize?: number;
  tone?: FlowTone;
  dashed?: boolean;
}

const FLOW_TONE_COLOR: Record<FlowTone, string> = {
  subject: "var(--orange, #e05a20)",
  cool: "var(--blue, #2563eb)",
  good: "var(--teal, var(--t-good, #1f8a7a))",
  bad: "var(--t-bad, #c4322b)",
  neutral: "var(--ink, #1b1b19)",
};

/**
 * Bold 3D-projected streamline/flow arrow along a smooth Catmull-Rom curve for air, heat, fluid,
 * blood, or electric current. Uses theme-aware CSS tokens and stage halo so it reads crisply on
 * both light and dark stages.
 */
export function flowArrow3D(cam: Camera, opts: FlowArrow3DOpts): string {
  const raw = opts.points ?? [];
  const pts: V3[] = [];
  for (const p of raw) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) continue;
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) > 1e-6) pts.push(p);
  }
  if (pts.length < 2) return "";

  const ax = axesOf(cam.azimuth, cam.elevation);
  const screenPts: P2[] = [];
  if (pts.length === 2) {
    const a = pts[0]!, b = pts[1]!;
    const seg = 10;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      screenPts.push(
        screenOf(cam, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], ax),
      );
    }
  } else {
    const seg = 12;
    for (let s = 0; s < pts.length - 1; s++) {
      const p0 = pts[Math.max(0, s - 1)]!;
      const p1 = pts[s]!;
      const p2 = pts[s + 1]!;
      const p3 = pts[Math.min(pts.length - 1, s + 2)]!;
      for (let i = 0; i < seg; i++) {
        const t = i / seg, t2 = t * t, t3 = t2 * t;
        const c = (k: number) =>
          0.5 *
          (2 * p1[k]! +
            (-p0[k]! + p2[k]!) * t +
            (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 +
            (-p0[k]! + 3 * p1[k]! - 3 * p2[k]! + p3[k]!) * t3);
        screenPts.push(screenOf(cam, [c(0), c(1), c(2)], ax));
      }
    }
    screenPts.push(screenOf(cam, pts[pts.length - 1]!, ax));
  }

  // Compute total projected screen length and tip tangent
  let totalLen = 0;
  for (let i = 1; i < screenPts.length; i++) {
    totalLen += Math.hypot(screenPts[i]![0] - screenPts[i - 1]![0], screenPts[i]![1] - screenPts[i - 1]![1]);
  }
  if (totalLen < 1e-3) return "";

  const tip = screenPts[screenPts.length - 1]!;
  let refIdx = screenPts.length - 2;
  while (refIdx > 0 && Math.hypot(tip[0] - screenPts[refIdx]![0], tip[1] - screenPts[refIdx]![1]) < 0.5) {
    refIdx--;
  }
  const refPt = screenPts[refIdx]!;
  const tLen = Math.hypot(tip[0] - refPt[0], tip[1] - refPt[1]) || 1;
  const u: P2 = [(tip[0] - refPt[0]) / tLen, (tip[1] - refPt[1]) / tLen];
  const nrm: P2 = [-u[1], u[0]];

  const headSize = Math.max(2, opts.headSize ?? Math.max(6, Math.abs(cam.scale) * 1.45));
  const trimDist = Math.min(headSize * 0.72, totalLen * 0.45);

  // Trim stem smoothly so it meets the arrowhead notch without poking past the tip
  const stemPts: P2[] = [...screenPts];
  let remain = trimDist;
  while (stemPts.length > 2 && remain > 0) {
    const last = stemPts[stemPts.length - 1]!;
    const prev = stemPts[stemPts.length - 2]!;
    const segLen = Math.hypot(last[0] - prev[0], last[1] - prev[1]);
    if (segLen <= remain) {
      stemPts.pop();
      remain -= segLen;
    } else {
      const f = remain / segLen;
      stemPts[stemPts.length - 1] = [last[0] - (last[0] - prev[0]) * f, last[1] - (last[1] - prev[1]) * f];
      remain = 0;
    }
  }

  const headPoly: P2[] = [
    tip,
    [tip[0] - u[0] * headSize + nrm[0] * headSize * 0.44, tip[1] - u[1] * headSize + nrm[1] * headSize * 0.44],
    [tip[0] - u[0] * headSize * 0.74, tip[1] - u[1] * headSize * 0.74],
    [tip[0] - u[0] * headSize - nrm[0] * headSize * 0.44, tip[1] - u[1] * headSize - nrm[1] * headSize * 0.44],
  ];

  const tone: FlowTone = opts.tone ?? "subject";
  const strokeW = Math.max(0.6, opts.width ?? 2.6);
  const haloW = +(strokeW + 3.8).toFixed(2);
  const dashCss = opts.dashed ? `;stroke-dasharray:${n1(strokeW * 2.8)} ${n1(strokeW * 1.8)}` : "";
  const stemD = pathThrough(stemPts, false);
  const headD = pathThrough(headPoly, true);

  return (
    `<g class="rig-flow-arrow${opts.dashed ? " is-dashed" : ""}" data-tone="${tone}" style="--rig-arrow:${FLOW_TONE_COLOR[tone]}">` +
    `<path class="rig-arrow-halo" style="stroke-width:${haloW}px" d="${stemD}"/>` +
    `<path class="rig-arrow-line" style="stroke-width:${+strokeW.toFixed(2)}px${dashCss}" d="${stemD}"/>` +
    `<path class="rig-arrow-head" d="${headD}"/>` +
    `</g>`
  );
}
