// Everyday physical object primitives for the rig: vessels/bottles (solid or cutaway),
// liquid columns, dip tubes, pressable plunger nozzles, deterministic 3D mist sprays,
// wristwatch cases & hands, coiled springs, and studio explainer cards & meter bars.
// Every 3D solid is built from closed meshes with outward normals on the shared rig camera.

import { axesOf, nearness, screenOf, type Camera } from "./camera.ts";
import { drawMesh, drawSpiralRibbon, linesOn } from "./draw.ts";
import { arcOutline, circlePoints, planeOf, plate, rod, turned, type Face, type Mesh } from "./shapes.ts";
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
  const sheenAngle = Math.atan2(dot(ax.toward, [0, 1, 0]), dot(ax.toward, [1, 0, 0])) + (115 * Math.PI) / 180;
  const sheenSvg = (): string => {
    if (material !== "glass") return "";
    const zLo = Math.min(bodyTop * 0.2, wall + 2);
    const zHi = Math.max(zLo + 1, bodyTop * 0.88);
    const rr = r * 0.995;
    const p0: V3 = [rr * Math.cos(sheenAngle), rr * Math.sin(sheenAngle), zLo];
    const p1: V3 = [rr * Math.cos(sheenAngle), rr * Math.sin(sheenAngle), zHi];
    return linesOn(cam, [[p0, p1]], "rig-glass-sheen");
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

  const facing = Math.atan2(dot(ax.toward, [0, 1, 0]), dot(ax.toward, [1, 0, 0]));
  const openAngle = (140 * Math.PI) / 180; // leaves 220° back/side wall
  const a0 = facing + openAngle / 2;
  const a1 = facing + TAU - openAngle / 2;
  const arcSteps = Math.max(12, Math.round((segments * (TAU - openAngle)) / TAU));
  const shellMesh = revolvedShellArc(outer, inner, a0, a1, arcSteps);

  return (
    `<g class="rig-vessel rig-vessel-cutaway">` +
    drawMesh(baseMesh, cam, { material, shine: true, crease: 36 }) +
    drawMesh(shellMesh, cam, { material, shine: false, crease: 38, sort: "face" }) +
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
 * Recognizable 3D wristwatch case with optional lugs, stepped bezel, 12 crisp hour markers
 * projected onto the dial face, and an optional lower-right cutaway window so an interior
 * `coiledSpring` and balance wheel can show right through the dial.
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
  const showLugs = opts.lugs ?? true;
  const cutaway = opts.cutaway ?? false;
  const bezelMat = opts.bezelMaterial ?? "steel";
  const dialMat = opts.dialMaterial ?? "ceramic";
  const ax = axesOf(cam.azimuth, cam.elevation);

  const rDial = r * 0.82;
  const dialZ0 = h * 0.62;
  const dialZ1 = h * 0.76;

  // Optional 4 lugs + 3 o'clock crown sorted relative to case centre
  const backAddons: { depth: number; svg: string }[] = [];
  const frontAddons: { depth: number; svg: string }[] = [];
  const centerDepth = nearness(cam, [0, 0, h * 0.5], ax);

  if (showLugs) {
    const lugW = r * 0.22;
    const lugX = r * 0.52;
    const lugY0 = r * 0.74;
    const lugY1 = r * 1.28;
    const lugH = h * 0.72;
    const corners: [number, number][] = [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (const [sx, sy] of corners) {
      const xIn = sx * (lugX - lugW * 0.52);
      const xOut = sx * (lugX + lugW * 0.48);
      const xTipIn = sx * (lugX - lugW * 0.34);
      const xTipOut = sx * (lugX + lugW * 0.32);
      const outline: P2[] = [
        [xIn, sy * lugY0],
        [xOut, sy * lugY0],
        [xTipOut, sy * lugY1],
        [xTipIn, sy * lugY1],
      ];
      const mesh = plate(FLOOR, { outer: outline }, h * 0.08, lugH);
      const svg = drawMesh(mesh, cam, { material: bezelMat, shine: true, crease: 34 });
      const depth = nearness(cam, [sx * lugX, sy * ((lugY0 + lugY1) / 2), lugH * 0.5], ax);
      (depth < centerDepth ? backAddons : frontAddons).push({ depth, svg });
    }
    // Winding crown at 3 o'clock (+x)
    const crownR = Math.max(1.2, h * 0.28);
    const crownLen = Math.max(1.4, r * 0.18);
    const crownMesh = turned(
      [r * 0.94, 0, h * 0.48],
      [1, 0, 0],
      [
        [0, crownR * 0.65],
        [crownLen * 0.25, crownR],
        [crownLen * 0.85, crownR],
        [crownLen, crownR * 0.84],
      ],
      20,
      UP,
    );
    const crownSvg = drawMesh(crownMesh, cam, { material: bezelMat, shine: true, crease: 34 });
    const crownDepth = nearness(cam, [r + crownLen * 0.5, 0, h * 0.48], ax);
    (crownDepth < centerDepth ? backAddons : frontAddons).push({ depth: crownDepth, svg: crownSvg });
  }

  backAddons.sort((a, b) => a.depth - b.depth);
  frontAddons.sort((a, b) => a.depth - b.depth);

  // Main case body
  const caseMesh = turned(
    [0, 0, 0],
    UP,
    [
      [0, r * 0.92],
      [h * 0.14, r],
      [h * 0.74, r],
      [dialZ1, r * 0.96],
    ],
    48,
  );
  const caseSvg = drawMesh(caseMesh, cam, { material: bezelMat, shine: true, crease: 36 });

  // Dial face (solid or lower-right cutaway window)
  let dialSvg = "";
  if (!cutaway) {
    const dialMesh = plate(FLOOR, { outer: circlePoints(rDial + 0.15, 48) }, dialZ0, dialZ1);
    dialSvg = drawMesh(dialMesh, cam, { material: dialMat, shine: false, crease: 40 });
  } else {
    // Recessed movement cavity plate visible behind the cutaway window
    const cavityMesh = plate(FLOOR, { outer: circlePoints(rDial * 0.92, 36) }, h * 0.26, h * 0.34);
    const cavitySvg = drawMesh(cavityMesh, cam, { material: "frame", shine: false, crease: 42 });
    const cutHole = arcOutline(rDial * 0.14, rDial * 0.78, (-125 * Math.PI) / 180, (25 * Math.PI) / 180, 24);
    const dialMesh = plate(FLOOR, { outer: circlePoints(rDial + 0.15, 48), holes: [cutHole] }, dialZ0, dialZ1);
    dialSvg = cavitySvg + drawMesh(dialMesh, cam, { material: dialMat, shine: false, crease: 40, sort: "face" });
  }

  // 12 crisp hour markers projected onto the dial chapter ring
  const majorSegs: [V3, V3][] = [];
  const minorSegs: [V3, V3][] = [];
  const tickZ = dialZ1 + 0.04;
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 - (i * TAU) / 12;
    const isMajor = i % 3 === 0;
    const r0 = rDial * (isMajor ? 0.8 : 0.85);
    const r1 = rDial * 0.94;
    const seg: [V3, V3] = [
      [r0 * Math.cos(a), r0 * Math.sin(a), tickZ],
      [r1 * Math.cos(a), r1 * Math.sin(a), tickZ],
    ];
    (isMajor ? majorSegs : minorSegs).push(seg);
  }
  const ticksSvg =
    linesOn(cam, minorSegs, "rig-dial-tick") + linesOn(cam, majorSegs, "rig-dial-tick is-major");

  // Stepped bezel ring framing the dial
  const bezelRing = plate(
    FLOOR,
    { outer: circlePoints(r * 0.96, 48), holes: [circlePoints(rDial, 48)] },
    dialZ1,
    h,
  );
  const bezelSvg = drawMesh(bezelRing, cam, { material: bezelMat, shine: true, crease: 38 });

  return (
    `<g class="rig-watch-case">` +
    backAddons.map((a) => a.svg).join("") +
    caseSvg +
    dialSvg +
    ticksSvg +
    bezelSvg +
    frontAddons.map((a) => a.svg).join("") +
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
