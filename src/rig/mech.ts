// Machine parts for the rig: wheels, pinions, arbors, bridges, jewels, screws, a cut-open case,
// springs and the exploded stack, each built to proportions that read at page size.
//
// Why this exists: every machine figure (a watch, a gearbox, a pump, a lock) was inventing its
// wheels and plates from scratch, and the inventions drifted: teeth too dense to read, wheels that
// overlapped or floated apart, cases whose full wall fought the painter's order. These parts are
// the proven shapes, sized from their own dimensions, and they say where they are (anchors).
//
//   const w = spokedWheel(60, 12, 0.8, { at: [0, 0, 1] });   // a MechPart: pieces + anchors
//   drawPart(w, cam)                                          // SVG, pieces in painter's order
//   drawAssembly([plate, ...train, bridge], cam)              // several parts sorted together
//
// Every part is built about an axis (default +z) from `at`, the centre of its base. Its pieces are
// closed meshes with outward normals; its anchors are points on its own surface, for callouts.
// Parts never invent their camera: a cut-open case takes the angle it opens toward
// (`facingCamera(cam)` gives the one toward the viewer).

import { axesOf, nearness, screenOf, type Camera } from "./camera.ts";
import { contactShadow, drawMesh, keyLight, linesOn, shadeOf, type Look } from "./draw.ts";
import { circlePoints, planeOf, plate, pointOn, tube, turned, type Face, type Mesh, type Plane } from "./shapes.ts";
import { add, along, area2, cross, dot, n1, pathThrough, scale, sub, unit, type P2, type V3 } from "./vec.ts";

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the part record

/** One closed solid of a part, with its look. */
export interface Piece {
  name: string;
  mesh: Mesh;
  look: Look;
  /** -1 drawn before everything else in an assembly (a case's back), +1 after (its front), 0 sorted */
  stage?: -1 | 0 | 1;
  /** lay a contact shadow under it when the assembly asks for shadows */
  shadow?: boolean;
  /** false: draw with drawMesh (one path per shade, every line last; lighter, but hidden edges
   *  show through the part's own top). Default: face by face with `drawOrdered` */
  ordered?: boolean;
  /** lines drawn on one of its flat faces (section hatching), shown only while that face is seen */
  marks?: { segs: [V3, V3][]; normal: V3; cls?: string }[];
}

/** A part: its solids, the axis it is built about, and named points on its surface. */
export interface MechPart {
  pieces: Piece[];
  axis: V3;
  anchors: Record<string, V3>;
}

/** Where a part sits: the centre of its base, the axis it is built about, and its in-plane x. */
export interface Mount {
  at?: V3;
  axis?: V3;
  uHint?: V3;
}

const frameOf = (m: Mount = {}): Plane => {
  const axis = unit(m.axis ?? [0, 0, 1]);
  const hint = m.uHint ?? (Math.abs(axis[0]) > 0.95 ? [0, 1, 0] : [1, 0, 0]);
  return planeOf(m.at ?? [0, 0, 0], axis, hint);
};

const need = (ok: boolean, what: string) => {
  if (!ok) throw new RangeError(what);
};
const positive = (v: number, name: string) => need(Number.isFinite(v) && v > 0, `${name} must be a positive number, got ${v}`);
const whole = (v: number, min: number, name: string) => need(Number.isInteger(v) && v >= min, `${name} must be a whole number of at least ${min}, got ${v}`);

const METAL = (material: string, crease = 32): Look => ({ material, shine: true, crease });

// ---------------------------------------------------------------- tooth outlines

/**
 * The tooth forms: `clock` is the horological form (radial flanks, an ogival tip on wheels, a
 * round-ended leaf on pinions); `involute` is the industrial gearbox form (straight 20° flanks,
 * flat tips), the same on wheel and pinion.
 */
export type ToothForm = "clock" | "involute";

export interface ProfileOptions {
  form?: ToothForm;
  /** `wheel` or `pinion`: in the clock form a pinion's leaves are round-ended and shallower */
  kind?: "wheel" | "pinion";
  /** turn of the outline, radians: a tooth is centred on `rot` */
  rot?: number;
}

/** The module of a gear: pitch diameter per tooth. Two gears mesh only if their modules agree. */
export const moduleOf = (teeth: number, pitchR: number): number => (2 * pitchR) / teeth;

/** Tooth sizes for a form and kind, in modules: addendum, dedendum, tooth thickness (fraction of pitch). */
function toothSizes(form: ToothForm, kind: "wheel" | "pinion") {
  if (form === "involute") return { add: 1.0, ded: 1.25, thick: 0.47 };
  return kind === "wheel" ? { add: 1.1, ded: 1.45, thick: 0.42 } : { add: 0.0, ded: 1.6, thick: 0.42 }; // leaf addendum set by its round end
}

/**
 * A gear's outline on pitch radius `pitchR`, counter-clockwise, a tooth centred on `rot` and every
 * 2π/teeth after it. Few points per tooth (five to eleven), so dense wheels stay crisp.
 */
export function gearProfile(teeth: number, pitchR: number, o: ProfileOptions = {}): P2[] {
  whole(teeth, 3, "teeth");
  positive(pitchR, "pitchR");
  const form = o.form ?? "clock", kind = o.kind ?? "wheel", rot = o.rot ?? 0;
  const m = moduleOf(teeth, pitchR), step = TAU / teeth, R = pitchR;
  const sz = toothSizes(form, kind);
  const rRoot = R - sz.ded * m;
  need(rRoot > 0.2 * R, `${teeth} teeth on radius ${R} leave no root: use more teeth or the involute form`);
  const at = (a: number, r: number): P2 => [r * Math.cos(a), r * Math.sin(a)];
  const out: P2[] = [];
  for (let j = 0; j < teeth; j++) {
    const c = rot + j * step;
    // the root between this tooth and the one before it
    out.push(at(c - step / 2, rRoot));
    if (form === "involute") {
      const hwP = (sz.thick * step * R) / 2, tan = Math.tan((20 * Math.PI) / 180);
      // flanks at 20° above the pitch circle, radial below it (room for the mate's tip on small gears)
      const hwAt = (r: number) => (r <= R ? hwP / R : (hwP - (r - R) * tan) / r); // half-width as an angle
      const rTip = R + sz.add * m;
      out.push(at(c - hwAt(rRoot), rRoot), at(c - hwAt(R), R), at(c - hwAt(rTip), rTip), at(c + hwAt(rTip), rTip), at(c + hwAt(R), R), at(c + hwAt(rRoot), rRoot));
    } else if (kind === "wheel") {
      const hw = (sz.thick * step) / 2; // radial flanks: the same angle from root to pitch
      const ogive: [number, number][] = [[0.5, 0.93], [0.82, 0.68], [1, 0.28]]; // [height, width] fractions
      out.push(at(c - hw, rRoot), at(c - hw, R));
      for (const [k, w] of ogive) out.push(at(c - hw * w * (R / (R + k * sz.add * m)), R + k * sz.add * m));
      for (const [k, w] of [...ogive].reverse()) out.push(at(c + hw * w * (R / (R + k * sz.add * m)), R + k * sz.add * m));
      out.push(at(c + hw, R), at(c + hw, rRoot));
    } else {
      // a pinion leaf: parallel flanks up to the pitch circle, then a half-round end
      const hwl = R * Math.sin((sz.thick * step) / 2);
      const ux = Math.cos(c), uy = Math.sin(c), nx = -uy, ny = ux;
      const flank = (side: number, r: number): P2 => {
        const along = Math.sqrt(Math.max(0, r * r - hwl * hwl));
        return [ux * along + nx * side * hwl, uy * along + ny * side * hwl];
      };
      out.push(flank(-1, rRoot));
      const cx = ux * Math.sqrt(R * R - hwl * hwl), cy = uy * Math.sqrt(R * R - hwl * hwl);
      for (let i = 0; i <= 4; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / 4; // from the -side round to the +side
        const ca = Math.cos(a), sa = Math.sin(a);
        out.push([cx + hwl * (ux * ca + nx * sa), cy + hwl * (uy * ca + ny * sa)]);
      }
      out.push(flank(1, rRoot));
    }
  }
  return out;
}

/** How far a gear's teeth reach beyond its pitch circle. */
export function tipRadius(teeth: number, pitchR: number, o: ProfileOptions = {}): number {
  const p = gearProfile(teeth, pitchR, o);
  return Math.max(...p.map(([x, y]) => Math.hypot(x, y)));
}

/**
 * The readability rule: at `pxPerUnit` screen pixels per world unit, a gear of pitch radius
 * `pitchR` shows at most this many teeth with a tooth pitch of at least `minPitchPx` (8 px: a
 * tooth and a gap of 4 px each; at 6 px a wheel seen at 30° already turns to a grey fringe where
 * the ellipse squeezes its sides, as the mech gallery shows).
 * Choose the module for the whole train from the smallest wheel, so mating gears stay legal.
 */
export function readableTeeth(pitchR: number, pxPerUnit: number, minPitchPx = 8): number {
  positive(pitchR, "pitchR");
  positive(pxPerUnit, "pxPerUnit");
  positive(minPitchPx, "minPitchPx");
  return Math.floor((TAU * pitchR * pxPerUnit) / minPitchPx);
}

const checkReadable = (teeth: number, pitchR: number, px: number | undefined, minPx: number | undefined) => {
  if (px === undefined) return;
  const most = readableTeeth(pitchR, px, minPx);
  need(teeth <= most, `${teeth} teeth on radius ${pitchR} at ${px} px per unit are too dense to read: at most ${most} (a larger module, or a larger wheel)`);
};

// ---------------------------------------------------------------- 2D helpers (internal)

/** Round every corner of a closed loop that turns more than `minTurn` with an arc of radius r. */
function fillet(loop: readonly P2[], r: number, minTurn = 0.4, segs = 3): P2[] {
  const n = loop.length, out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const p = loop[(i - 1 + n) % n]!, c = loop[i]!, q = loop[(i + 1) % n]!;
    const ax = p[0] - c[0], ay = p[1] - c[1], la = Math.hypot(ax, ay);
    const bx = q[0] - c[0], by = q[1] - c[1], lb = Math.hypot(bx, by);
    const cosA = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    const alpha = Math.acos(cosA); // the corner's opening angle
    if (Math.PI - alpha < minTurn || la < 1e-9 || lb < 1e-9) {
      out.push(c);
      continue;
    }
    let t = r / Math.tan(alpha / 2);
    t = Math.min(t, 0.45 * la, 0.45 * lb);
    const rr = t * Math.tan(alpha / 2);
    const ux = ax / la, uy = ay / la, vx = bx / lb, vy = by / lb;
    const s = [c[0] + ux * t, c[1] + uy * t] as const, e = [c[0] + vx * t, c[1] + vy * t] as const;
    const mx = ux + vx, my = uy + vy, ml = Math.hypot(mx, my);
    const d = rr / Math.sin(alpha / 2);
    const o = [c[0] + (mx / ml) * d, c[1] + (my / ml) * d] as const;
    const a0 = Math.atan2(s[1] - o[1], s[0] - o[0]);
    let a1 = Math.atan2(e[1] - o[1], e[0] - o[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    a1 = a0 + da;
    for (let k = 0; k <= segs; k++) {
      const a = a0 + (da * k) / segs;
      out.push([o[0] + rr * Math.cos(a), o[1] + rr * Math.sin(a)]);
    }
  }
  return out;
}

/** Move every point of a loop `d` to the left of travel: into the material for a CCW outline or a CW hole. */
function offsetLoop(loop: readonly P2[], d: number): P2[] {
  const n = loop.length;
  return loop.map((c, i) => {
    const p = loop[(i - 1 + n) % n]!, q = loop[(i + 1) % n]!;
    const e0x = c[0] - p[0], e0y = c[1] - p[1], l0 = Math.hypot(e0x, e0y) || 1;
    const e1x = q[0] - c[0], e1y = q[1] - c[1], l1 = Math.hypot(e1x, e1y) || 1;
    const n0x = -e0y / l0, n0y = e0x / l0, n1x = -e1y / l1, n1y = e1x / l1;
    const bx = n0x + n1x, by = n0y + n1y, bl = Math.hypot(bx, by);
    if (bl < 1e-9) return [c[0] + n0x * d, c[1] + n0y * d] as P2;
    const k = Math.max(0.4, (bx / bl) * n0x + (by / bl) * n0y);
    return [c[0] + ((bx / bl) * d) / k, c[1] + ((by / bl) * d) / k] as P2;
  });
}

/**
 * A plate from t0 to t1 with chamfered rims: the outline and every hole get a 45° bevel of `top` at
 * t1 and `bottom` at t0 (holes take `hole`, a polished sink). Closed, normals outward.
 */
function bevelSlab(pl: Plane, outer: readonly P2[], holes: readonly (readonly P2[])[], t0: number, t1: number, b: { top: number; bottom: number; hole: number }, depths: readonly (number | undefined)[] = []): Mesh {
  const h = t1 - t0;
  const loops = [area2(outer) > 0 ? [...outer] : [...outer].reverse(), ...holes.map((l) => (area2(l) < 0 ? [...l] : [...l].reverse()))];
  const verts: V3[] = [];
  const faces: Face[] = [];
  const tops: number[][] = [], bottoms: number[][] = [];
  const ring = (pts: readonly P2[], t: number) => pts.map(([x, y]) => verts.push(pointOn(pl, x, y, t)) - 1);
  const normalOf = (q: number[]): V3 => {
    const a = verts[q[0]!]!, bb = verts[q[1]!]!, c = verts[q[2]!]!, d = verts[q[3]!]!;
    return unit(cross(sub(c, a), sub(d, bb)));
  };
  loops.forEach((loop, k) => {
    const blind = k > 0 ? depths[k - 1] : undefined;
    const bt = Math.min(k === 0 ? b.top : b.hole, h * 0.4, blind !== undefined ? blind * 0.5 : Infinity), bb = Math.min(k === 0 ? b.bottom : b.hole * 0.5, h * 0.4);
    const rings: number[][] = [];
    if (blind !== undefined) rings.push(ring(loop, t1 - blind));
    else {
      if (bb > 1e-6) rings.push(ring(offsetLoop(loop, bb), t0));
      rings.push(ring(loop, t0 + bb));
    }
    rings.push(ring(loop, t1 - bt));
    if (bt > 1e-6) rings.push(ring(offsetLoop(loop, bt), t1));
    // a blind hole ends in a floor facing up ("end": drawn after the walls, before the top cap)
    if (blind !== undefined) faces.push({ loops: [[...rings[0]!].reverse()], normal: pl.n, role: "end" });
    else bottoms.push(rings[0]!);
    tops.push(rings[rings.length - 1]!);
    const n = loop.length;
    for (let r = 0; r + 1 < rings.length; r++) {
      const lo = rings[r]!, hi = rings[r + 1]!;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const q = [lo[i]!, lo[j]!, hi[j]!, hi[i]!];
        faces.push({ loops: [q], normal: normalOf(q), role: "wall" });
      }
    }
  });
  faces.unshift(
    { loops: tops.map((l) => [...l]), normal: pl.n, role: "cap" },
    { loops: bottoms.map((l) => [...l].reverse()), normal: scale(pl.n, -1), role: "cap" },
  );
  return { verts, faces };
}

/** A solid of revolution about the frame's axis: profile [s along the axis, r], closed at both ends (r > 0). */
const revolve = (pl: Plane, profile: readonly P2[], segments: number): Mesh => turned(pl.origin, pl.n, profile, segments, pl.u);

const inPlane = (pl: Plane, x: number, y: number, t: number): V3 => pointOn(pl, x, y, t);

// ---------------------------------------------------------------- wheels, pinions, arbors

export interface WheelOptions extends Mount {
  form?: ToothForm;
  /** spokes (crossings); 0 for a solid web. Default 5, or 0 when the rim and hub would crowd */
  spokes?: number;
  /** the hub disc left solid round the centre, default 0.24 × pitchR */
  hubR?: number;
  /** radial width of the rim inside the tooth roots, default max(1.6 module, 0.08 pitchR) */
  rimW?: number;
  /** turn of teeth and spokes, radians */
  rot?: number;
  /** the raised collet that holds the wheel on its arbor: radius and height (0 for none) */
  colletR?: number;
  colletH?: number;
  material?: string;
  colletMaterial?: string;
  /** give the on-screen scale to enforce `readableTeeth` (throws when too dense) */
  pxPerUnit?: number;
  minPitchPx?: number;
}

/**
 * A spoked wheel: teeth on pitch radius `pitchR`, a rim with real width, straight spokes of even
 * width with filleted windows, a hub, and a collet standing on it. `thickness` along the axis.
 * Anchors: `top` (collet top, on the axis), `face` (the rim's top face), `pitch` (a tooth on the
 * pitch circle, at angle `rot`), `base` (underside centre).
 */
export function spokedWheel(teeth: number, pitchR: number, thickness: number, o: WheelOptions = {}): MechPart {
  whole(teeth, 6, "teeth");
  positive(pitchR, "pitchR");
  positive(thickness, "thickness");
  checkReadable(teeth, pitchR, o.pxPerUnit, o.minPitchPx);
  const pl = frameOf(o), form = o.form ?? "clock", rot = o.rot ?? 0;
  const m = moduleOf(teeth, pitchR);
  const rRoot = pitchR - toothSizes(form, "wheel").ded * m;
  const rimW = o.rimW ?? Math.max(1.6 * m, 0.08 * pitchR);
  const hubR = o.hubR ?? 0.24 * pitchR;
  const rimIn = rRoot - rimW;
  positive(rimW, "rimW");
  positive(hubR, "hubR");
  need(hubR < rRoot - 0.5 * rimW, `hubR ${hubR} does not fit inside the rim (root radius ${rRoot.toFixed(3)})`);
  const room = rimIn - hubR;
  const spokes = o.spokes ?? (room > 0.3 * pitchR ? 5 : 0);
  need(Number.isInteger(spokes) && spokes >= 0 && spokes <= 12 && spokes !== 1 && spokes !== 2, `spokes must be 0 or 3 to 12, got ${spokes}`);
  const colR = o.colletR ?? hubR * 0.62;
  const colH = o.colletH ?? thickness * 0.9;
  const boreR = colR * 0.55;
  need(colR >= 0 && colR < hubR && colH >= 0, `the collet (radius ${colR}) must sit inside the hub (radius ${hubR})`);

  const holes: P2[][] = [];
  if (colR > 0) holes.push(circlePoints(boreR, 20));
  if (spokes > 0) {
    need(room > 2 * m, `no room for spokes between hub ${hubR} and rim ${rimIn.toFixed(3)}: use spokes: 0`);
    const hw = Math.min(0.06 * pitchR + 0.35 * m, 0.3 * hubR); // half the spoke's width, even along it (≤ 0.3 hub: five spokes always fit)
    const seg = TAU / spokes;
    need(2 * Math.asin(hw / hubR) < seg * 0.6, `${spokes} spokes are too many for this hub`);
    const fr = Math.min(0.35 * hw + 0.25 * m, 0.2 * room);
    for (let i = 0; i < spokes; i++) {
      const a = rot + i * seg, b = a + seg;
      const win: P2[] = [];
      const h0 = a + Math.asin(hw / hubR), h1 = b - Math.asin(hw / hubR);
      const r0 = a + Math.asin(hw / rimIn), r1 = b - Math.asin(hw / rimIn);
      const arc = (r: number, from: number, to: number, n: number) => {
        for (let k = 0; k <= n; k++) win.push([r * Math.cos(from + ((to - from) * k) / n), r * Math.sin(from + ((to - from) * k) / n)]);
      };
      arc(rimIn, r0, r1, Math.max(6, Math.round(((r1 - r0) * 24) / Math.PI)));
      arc(hubR, h1, h0, Math.max(3, Math.round(((h1 - h0) * 10) / Math.PI)));
      holes.push(fillet(win, fr));
    }
  }
  const outline = gearProfile(teeth, pitchR, { form, kind: "wheel", rot });
  const wheel = plate(pl, { outer: outline, holes }, 0, thickness);
  const pieces: Piece[] = [{ name: "wheel", mesh: wheel, look: METAL(o.material ?? "brass", 56), shadow: true, ordered: true }];
  const tip = Math.min(colH * 0.3, colR * 0.25);
  if (colR > 0) {
    const collet = revolve(pl, [[0, boreR], [thickness, boreR], [thickness, colR], [thickness + colH - tip, colR], [thickness + colH, colR - tip]], 28);
    pieces.push({ name: "collet", mesh: collet, look: METAL(o.colletMaterial ?? o.material ?? "brass") });
  }
  const rimMid = (rimIn + rRoot) / 2;
  return {
    pieces,
    axis: pl.n,
    anchors: {
      top: colR > 0 ? inPlane(pl, 0, 0, thickness + colH) : inPlane(pl, 0, 0, thickness),
      face: inPlane(pl, rimMid * Math.cos(rot + Math.PI / Math.max(spokes, 1)), rimMid * Math.sin(rot + Math.PI / Math.max(spokes, 1)), thickness),
      pitch: inPlane(pl, pitchR * Math.cos(rot), pitchR * Math.sin(rot), thickness),
      base: inPlane(pl, (boreR + hubR) / 2, 0, 0),
    },
  };
}

export interface PinionOptions extends Mount {
  form?: ToothForm;
  rot?: number;
  material?: string;
  pxPerUnit?: number;
  minPitchPx?: number;
}

/**
 * A pinion: `leaves` leaves on pitch radius `r`, `length` along the axis. Solid: an arbor through it
 * is drawn in pieces above and below. Anchors: `top`, `bottom` (end centres), `leaf` (a leaf's
 * tip at the top end, angle `rot`).
 */
export function pinion(leaves: number, r: number, length: number, o: PinionOptions = {}): MechPart {
  whole(leaves, 5, "leaves");
  positive(r, "r");
  positive(length, "length");
  checkReadable(leaves, r, o.pxPerUnit, o.minPitchPx);
  const pl = frameOf(o), rot = o.rot ?? 0;
  const outline = gearProfile(leaves, r, { form: o.form ?? "clock", kind: "pinion", rot });
  const rTip = Math.hypot(...outline.reduce((best, p) => (Math.hypot(p[0], p[1]) > Math.hypot(best[0], best[1]) ? p : best)));
  return {
    pieces: [{ name: "pinion", mesh: plate(pl, { outer: outline }, 0, length), look: METAL(o.material ?? "steel", 56), shadow: true, ordered: true }],
    axis: pl.n,
    anchors: {
      bottom: inPlane(pl, 0, 0, 0),
      top: inPlane(pl, 0, 0, length),
      leaf: inPlane(pl, (r + rTip) / 2 * Math.cos(rot), (r + rTip) / 2 * Math.sin(rot), length),
    },
  };
}

export interface ArborOptions extends Mount {
  /** radius of the pivots at either end, default 0.45 r; their length, default min(0.12 length, 4 r) */
  pivotR?: number;
  pivotLength?: number;
  /** cut the arbor into separate solids at these distances along it, so wheels it passes through
   *  can be drawn between its pieces (painter's order) */
  breaks?: readonly number[];
  /** spans [s0, s1] hidden inside parts mounted on it (a wheel's collet, a pinion): cut out, not drawn */
  inside?: readonly (readonly [number, number])[];
  material?: string;
}

/**
 * A stationary shaft: a body of radius `r` with conical shoulders down to a pivot at each end.
 * Anchors: `base` and `tip` (the pivot ends, on the axis), `mid` (the body's surface, halfway).
 */
export function arbor(r: number, length: number, o: ArborOptions = {}): MechPart {
  positive(r, "r");
  positive(length, "length");
  const pr = o.pivotR ?? 0.45 * r;
  const pLen = o.pivotLength ?? Math.min(0.12 * length, 4 * r);
  need(pr > 0 && pr <= r, `pivotR must be in (0, r], got ${pr}`);
  need(pLen >= 0 && 2 * pLen + 2 * (r - pr) < length, `pivots of ${pLen} leave no body on an arbor ${length} long`);
  const pl = frameOf(o);
  const cone = r - pr;
  const full: P2[] = pLen > 0
    ? [[0, pr], [pLen, pr], [pLen + cone, r], [length - pLen - cone, r], [length - pLen, pr], [length, pr]]
    : [[0, r], [length, r]];
  const inside = o.inside ?? [];
  for (const [a, b] of inside) need(a >= 0 && b <= length && a < b, `span [${a}, ${b}] is not inside the arbor (0, ${length})`);
  const breaks = [...(o.breaks ?? []), ...inside.flat().filter((s) => s > 1e-6 && s < length - 1e-6)].sort((a, b) => a - b);
  for (const b of breaks) need(b > 1e-6 && b < length - 1e-6, `break ${b} is not inside the arbor (0, ${length})`);
  const cuts = [0, ...breaks, length].filter((s, i, all) => i === 0 || s - all[i - 1]! > 1e-9);
  const radiusAt = (s: number) => {
    for (let i = 0; i + 1 < full.length; i++) {
      const [s0, r0] = full[i]!, [s1, r1] = full[i + 1]!;
      if (s >= s0 - 1e-12 && s <= s1 + 1e-12) return s1 - s0 < 1e-12 ? r1 : r0 + ((r1 - r0) * (s - s0)) / (s1 - s0);
    }
    return full[full.length - 1]![1];
  };
  const pieces: Piece[] = [], drawn: [number, number][] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i]!, b = cuts[i + 1]!;
    if (b - a < 1e-9 || inside.some(([x, y]) => a >= x - 1e-9 && b <= y + 1e-9)) continue;
    const prof: P2[] = [[a, radiusAt(a)], ...full.filter(([s]) => s > a + 1e-9 && s < b - 1e-9), [b, radiusAt(b)]];
    pieces.push({ name: `arbor${i}`, mesh: revolve(pl, prof, 16), look: METAL(o.material ?? "steel") });
    drawn.push([a, b]);
  }
  need(drawn.length > 0, "the arbor is hidden end to end");
  // `mid`: on the body, in the middle of the longest piece drawn
  const [ma, mb] = drawn.reduce((x, y) => (y[1] - y[0] > x[1] - x[0] ? y : x));
  const sm = (ma + mb) / 2;
  const anchors: Record<string, V3> = { mid: inPlane(pl, radiusAt(sm), 0, sm) };
  if (drawn[0]![0] < 1e-9) anchors.base = inPlane(pl, 0, 0, 0);
  if (drawn[drawn.length - 1]![1] > length - 1e-9) anchors.tip = inPlane(pl, 0, 0, length);
  return { pieces, axis: pl.n, anchors };
}

// ---------------------------------------------------------------- placing meshing gears

export interface GearSpec {
  teeth: number;
  pitchR: number;
}

/** The centre of a gear of pitch radius rB meshing one at `a` (pitch radius rA), in direction `angle`. */
export function meshCentre(a: P2, rA: number, rB: number, angle: number): P2 {
  positive(rA, "rA");
  positive(rB, "rB");
  const d = rA + rB;
  return [a[0] + d * Math.cos(angle), a[1] + d * Math.sin(angle)];
}

/**
 * The turn (`rot`) for gear B so its teeth fall into A's gaps where their pitch circles touch,
 * given A's turn. Both outlines centre a tooth on their `rot`.
 */
export function meshPhase(a: { at: P2; teeth: number; rot: number }, b: { at: P2; teeth: number }): number {
  const theta = Math.atan2(b.at[1] - a.at[1], b.at[0] - a.at[0]);
  const sa = TAU / a.teeth, sb = TAU / b.teeth;
  const fa = ((((theta - a.rot) / sa) % 1) + 1) % 1; // where A's nearest tooth sits, in tooth pitches
  const rot = theta + Math.PI + (0.5 + fa) * sb;
  return ((rot % sb) + sb) % sb;
}

/** One stage of a train: the driver on arbor i meshes the driven on arbor i+1, which lies `angle` from it. */
export interface TrainStage {
  driver: GearSpec;
  driven: GearSpec;
  angle: number;
}

export interface Placement {
  at: P2;
  /** turn for every gear on this arbor (teeth centred on it) */
  rot: number;
  /** turns of this arbor per turn of the first; negative when it runs the other way */
  speed: number;
}

/**
 * Lay out a gear train: arbor 0 at `start`, and each stage's driven gear exactly tangent to the
 * driver on its pitch circle (no gap, no overlap), turned so their teeth interleave. Throws a
 * RangeError when a stage's two gears have different modules (they could not mesh).
 */
export function meshCentres(start: P2, stages: readonly TrainStage[], rot0 = 0): Placement[] {
  const out: Placement[] = [{ at: start, rot: rot0, speed: 1 }];
  stages.forEach((s, i) => {
    whole(s.driver.teeth, 3, `stage ${i} driver teeth`);
    whole(s.driven.teeth, 3, `stage ${i} driven teeth`);
    const mA = moduleOf(s.driver.teeth, s.driver.pitchR), mB = moduleOf(s.driven.teeth, s.driven.pitchR);
    need(Math.abs(mA - mB) <= 1e-9 * Math.max(mA, mB), `stage ${i}: module ${mA} meets module ${mB}; meshing gears need the same module`);
    need(Number.isFinite(s.angle), `stage ${i}: angle must be a number`);
    const prev = out[out.length - 1]!;
    const at = meshCentre(prev.at, s.driver.pitchR, s.driven.pitchR, s.angle);
    const rot = meshPhase({ at: prev.at, teeth: s.driver.teeth, rot: prev.rot }, { at, teeth: s.driven.teeth });
    out.push({ at, rot, speed: -prev.speed * (s.driver.teeth / s.driven.teeth) });
  });
  return out;
}

/** Throws unless two gears are exactly tangent on their pitch circles (within `tol`) with one module. */
export function assertMeshed(a: GearSpec & { at: P2 }, b: GearSpec & { at: P2 }, tol = 1e-9): void {
  const d = Math.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]);
  const gap = d - (a.pitchR + b.pitchR);
  if (Math.abs(gap) > tol) throw new Error(`pitch circles ${gap > 0 ? "miss by" : "overlap by"} ${Math.abs(gap)} (tolerance ${tol})`);
  const mA = moduleOf(a.teeth, a.pitchR), mB = moduleOf(b.teeth, b.pitchR);
  if (Math.abs(mA - mB) > 1e-9 * Math.max(mA, mB)) throw new Error(`modules differ: ${mA} and ${mB}`);
}

// ---------------------------------------------------------------- jewels and screws

export interface JewelOptions extends Mount {
  /** height of the chaton (the setting) from its base, default 0.7 r */
  height?: number;
  material?: string;
  jewelMaterial?: string;
}

/**
 * A jewel bearing in its chaton: a polished setting of radius `r`, the jewel domed in it, and the
 * pivot hole at its centre. Anchors: `top` (the hole, on the axis), `rim` (the chaton's top ring),
 * `base`.
 */
export function jewelSetting(r: number, o: JewelOptions = {}): MechPart {
  positive(r, "r");
  const h = o.height ?? 0.7 * r;
  positive(h, "height");
  const pl = frameOf(o);
  const rj = 0.6 * r, lip = Math.min(0.12 * r, 0.5 * h), dome = 0.14 * r, hole = 0.16 * r;
  const chaton = revolve(pl, [[0, r], [h - lip, r], [h, r - lip], [h, rj]], 28);
  const jewel = revolve(pl, [[h - 0.5 * dome, rj], [h + 0.35 * dome, rj], [h + dome, 0.62 * rj], [h + dome, hole * 1.5]], 24);
  const pivot = revolve(pl, [[h + 0.8 * dome, hole], [h + 1.1 * dome, hole]], 12);
  return {
    pieces: [
      { name: "chaton", mesh: chaton, look: METAL(o.material ?? "brass") },
      { name: "jewel", mesh: jewel, look: { material: o.jewelMaterial ?? "ruby", shine: true, crease: 40 } },
      { name: "hole", mesh: pivot, look: METAL("steel") },
    ],
    axis: pl.n,
    anchors: { top: inPlane(pl, 0, 0, h + 1.1 * dome), rim: inPlane(pl, (r - lip + rj) / 2, 0, h), base: inPlane(pl, 0, 0, 0) },
  };
}

export interface ScrewOptions extends Mount {
  /** cut a slot across the head (default true) */
  slot?: boolean;
  /** the slot's direction in the head's plane, radians */
  slotAngle?: number;
  /** head height, default 0.6 r */
  height?: number;
  /** length of the threaded shank below the head (0: hidden in its hole) */
  shank?: number;
  material?: string;
}

/**
 * A cheese-head screw of head radius `r`, chamfered, with a real slot (two half-heads over the slot
 * floor). The base of the head sits at `at`; a shank, if any, hangs below. Anchors: `head` (the slot
 * floor centre, or the head top), `rim` (a point on the head's top), `base`.
 */
export function screw(r: number, o: ScrewOptions = {}): MechPart {
  positive(r, "r");
  const h = o.height ?? 0.6 * r;
  positive(h, "height");
  const shank = o.shank ?? 0;
  need(shank >= 0, `shank must not be negative, got ${shank}`);
  const pl = frameOf(o), slot = o.slot ?? true, sa = o.slotAngle ?? 0.5;
  const mat = o.material ?? "cobalt";
  const pieces: Piece[] = [];
  if (shank > 0) {
    const sr = 0.5 * r;
    pieces.push({ name: "shank", mesh: revolve(pl, [[-shank, sr * 0.7], [-shank + sr * 0.3, sr], [0, sr]], 16), look: METAL(mat) });
  }
  const bevel = 0.18 * h;
  if (!slot) {
    pieces.push({ name: "head", mesh: bevelSlab(pl, circlePoints(r, 32), [], 0, h, { top: bevel, bottom: 0, hole: 0 }), look: METAL(mat) });
    return { pieces, axis: pl.n, anchors: { head: inPlane(pl, 0, 0, h), rim: inPlane(pl, 0.5 * r * Math.cos(sa + 1), 0.5 * r * Math.sin(sa + 1), h), base: inPlane(pl, 0, 0, 0) } };
  }
  const sw = 0.22 * r, depth = 0.45 * h;
  pieces.push({ name: "head", mesh: revolve(pl, [[0, r], [h - depth, r]], 32), look: METAL(mat) });
  for (const side of [1, -1]) {
    // a half-head: the circle beyond the slot's edge, closed by the slot wall
    const c = Math.asin(sw / 2 / r), pts: P2[] = [];
    for (let k = 0; k <= 14; k++) {
      const a = c + ((Math.PI - 2 * c) * k) / 14;
      const x = r * Math.cos(a), y = r * Math.sin(a) * side;
      pts.push([x * Math.cos(sa) - y * Math.sin(sa), x * Math.sin(sa) + y * Math.cos(sa)]);
    }
    pieces.push({ name: side > 0 ? "half" : "half2", mesh: bevelSlab(pl, pts, [], h - depth, h, { top: bevel, bottom: 0, hole: 0 }), look: METAL(mat) });
  }
  return {
    pieces,
    axis: pl.n,
    anchors: { head: inPlane(pl, 0, 0, h - depth), rim: inPlane(pl, 0.6 * r * Math.cos(sa + Math.PI / 2), 0.6 * r * Math.sin(sa + Math.PI / 2), h), base: inPlane(pl, 0.8 * r, 0, 0) },
  };
}

// ---------------------------------------------------------------- bridges and plates

/** A bridge's shape: arms of `width` through `points` (bosses round each point), or any outline. */
export type BridgeShape = { points: readonly P2[]; width: number; boss?: number } | { outline: readonly P2[] };

export interface BridgeOptions extends Mount {
  /** the bevel on the top edge (and on holes), default 0.3 × thickness */
  chamfer?: number;
  /** screw positions, each with a head of radius screwR (default 0.2 × width or 1.4) */
  screwHoles?: readonly P2[];
  screwR?: number;
  /** jewel positions, each a chaton of radius jewelR (default 0.17 × width or 1.2) */
  jewelHoles?: readonly P2[];
  jewelR?: number;
  /** set a screw in every screw hole and a jewel in every jewel hole (default true); "jewels" or
   *  "screws" fills only those (an exploded view lifts the screws out and draws them on their own) */
  fill?: boolean | "jewels" | "screws";
  material?: string;
  screwMaterial?: string;
  slotAngle?: number;
}

/** Signed distance to a polygon (negative inside). */
function polygonDistance(loop: readonly P2[], x: number, y: number): number {
  let d = Infinity, inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!, b = loop[j]!;
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1)));
    d = Math.min(d, Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t));
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? -d : d;
}

/** The zero contour of f on a grid of step h over the box: closed loops (marching squares). */
function contour(f: (x: number, y: number) => number, x0: number, y0: number, x1: number, y1: number, h: number): P2[][] {
  const nx = Math.ceil((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1;
  const v: number[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v.push(f(x0 + i * h, y0 + j * h));
  const val = (i: number, j: number) => v[j * nx + i]!;
  const pt = new Map<string, P2>();
  const edgePt = (i0: number, j0: number, i1: number, j1: number): string => {
    const key = `${i0},${j0},${i1},${j1}`;
    if (!pt.has(key)) {
      const a = val(i0, j0), b = val(i1, j1), t = a / (a - b);
      pt.set(key, [x0 + (i0 + (i1 - i0) * t) * h, y0 + (j0 + (j1 - j0) * t) * h]);
    }
    return key;
  };
  const links = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const c = [val(i, j) < 0, val(i + 1, j) < 0, val(i + 1, j + 1) < 0, val(i, j + 1) < 0];
    const e = [
      c[0] !== c[1] ? edgePt(i, j, i + 1, j) : "",
      c[1] !== c[2] ? edgePt(i + 1, j, i + 1, j + 1) : "",
      c[3] !== c[2] ? edgePt(i, j + 1, i + 1, j + 1) : "",
      c[0] !== c[3] ? edgePt(i, j, i, j + 1) : "",
    ];
    const cut = e.filter(Boolean);
    if (cut.length === 2) link(cut[0]!, cut[1]!);
    else if (cut.length === 4) {
      const centre = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 < 0;
      if (centre === c[0]) { link(e[0]!, e[1]!); link(e[2]!, e[3]!); } else { link(e[0]!, e[3]!); link(e[1]!, e[2]!); }
    }
  }
  const loops: P2[][] = [], used = new Set<string>();
  for (const startKey of links.keys()) {
    if (used.has(startKey)) continue;
    const loop: P2[] = [];
    let prev = "", cur = startKey;
    while (!used.has(cur)) {
      used.add(cur);
      loop.push(pt.get(cur)!);
      const next = links.get(cur)!.find((k) => k !== prev && !used.has(k)) ?? "";
      prev = cur;
      if (!next) break;
      cur = next;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

/**
 * A plate bridge: a chamfered plate `thickness` thick whose outline is either arms of `width`
 * through `points` (round bosses at each point, blended with a fillet) or a given outline, with
 * screw holes and jewel holes, filled with screws and jewels unless `fill: false`. Holes are blind (see below). Anchors: `top`
 * (the deepest point of the top face), `screw0..`, `jewel0..` (on what fills them, or on the hole's
 * top edge when empty). Also returns `holes` for placing things in them.
 */
export function bridge(shape: BridgeShape, thickness: number, o: BridgeOptions = {}): MechPart & { holes: { at: V3; r: number; kind: "screw" | "jewel" }[] } {
  positive(thickness, "thickness");
  const pl = frameOf(o);
  let sdf: (x: number, y: number) => number;
  let scaleRef: number;
  let outline: P2[];
  if ("points" in shape) {
    need(shape.points.length >= 1, "a bridge needs at least one point");
    positive(shape.width, "width");
    const hw = shape.width / 2, boss = shape.boss ?? shape.width * 0.62, k = shape.width * 0.45;
    const pts = shape.points;
    const smin = (a: number, b: number) => {
      const t = Math.max(k - Math.abs(a - b), 0) / k;
      return Math.min(a, b) - (t * t * k) / 4;
    };
    sdf = (x, y) => {
      let d = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        d = smin(d, Math.hypot(x - p[0], y - p[1]) - boss);
        if (i + 1 < pts.length) {
          const q = pts[i + 1]!, ex = q[0] - p[0], ey = q[1] - p[1];
          const t = Math.max(0, Math.min(1, ((x - p[0]) * ex + (y - p[1]) * ey) / (ex * ex + ey * ey || 1)));
          d = smin(d, Math.hypot(x - p[0] - ex * t, y - p[1] - ey * t) - hw);
        }
      }
      return d;
    };
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), pad = Math.max(boss, hw) + shape.width;
    const step = shape.width / 14;
    const loops = contour(sdf, Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad, step);
    need(loops.length >= 1, "the bridge outline came out empty");
    loops.sort((a, b) => Math.abs(area2(b)) - Math.abs(area2(a)));
    outline = loops[0]!;
    scaleRef = shape.width;
  } else {
    need(shape.outline.length >= 3, "an outline needs at least three points");
    need(Math.abs(area2(shape.outline)) > 1e-9, "the outline has no area");
    outline = [...shape.outline];
    sdf = (x, y) => polygonDistance(outline, x, y);
    const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
    scaleRef = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 3;
  }
  if (area2(outline) < 0) outline.reverse();
  const screwR = o.screwR ?? Math.max(0.2 * scaleRef, 0.4 * thickness);
  const jewelR = o.jewelR ?? Math.max(0.17 * scaleRef, 0.35 * thickness);
  const chamfer = o.chamfer ?? 0.3 * thickness;
  need(chamfer >= 0 && chamfer < thickness * 0.45, `chamfer must be in [0, 0.45 × thickness), got ${chamfer}`);
  const holeSpecs: { at: P2; r: number; kind: "screw" | "jewel"; drill: number }[] = [
    ...(o.screwHoles ?? []).map((at) => ({ at, r: screwR, kind: "screw" as const, drill: screwR * 0.55 })),
    ...(o.jewelHoles ?? []).map((at) => ({ at, r: jewelR, kind: "jewel" as const, drill: jewelR })),
  ];
  for (const hs of holeSpecs) {
    positive(hs.r, `${hs.kind}R`);
    need(sdf(hs.at[0], hs.at[1]) < -(hs.r + chamfer), `the ${hs.kind} hole at (${hs.at[0]}, ${hs.at[1]}) breaks the bridge's edge`);
  }
  const holeLoops = holeSpecs.map((hs) => circlePoints(hs.drill, hs.kind === "jewel" ? 28 : 18, hs.at[0], hs.at[1]));
  // Holes are blind: a jewel's seat is as deep as the chaton is sunk, a screw's tapping as deep as
  // its width. drawMesh lays silhouettes over its own caps, so a through hole would show its far
  // bottom edge across the top face (see the report on draw.ts).
  const fillAll = o.fill ?? true;
  const depths = holeSpecs.map((hs) => {
    const filled = fillAll === true || fillAll === (hs.kind === "jewel" ? "jewels" : "screws");
    return Math.min(thickness * 0.85, hs.kind === "jewel" && filled ? 0.15 * hs.r + chamfer * 0.5 : 1.6 * hs.drill);
  });
  const slab = bevelSlab(pl, outline, holeLoops, 0, thickness, { top: chamfer, bottom: chamfer * 0.35, hole: chamfer * 0.5 }, depths);
  // no specular line: on a curved chamfer it ticks every facet seam (see the report on draw.ts)
  const pieces: Piece[] = [{ name: "bridge", mesh: slab, look: { material: o.material ?? "alloy", shine: false, crease: 34 }, shadow: true, ordered: true }];
  const anchors: Record<string, V3> = {};
  const fillWhat = o.fill ?? true;
  let si = 0, ji = 0;
  for (const hs of holeSpecs) {
    const name = hs.kind === "screw" ? `screw${si++}` : `jewel${ji++}`;
    // a jewel is set flush: only its chaton's top stands in the hole's mouth, so nothing of it is
    // drawn where the plate should hide it (a chaton drawn full depth would paint over the plate)
    const sunk = 0.15 * hs.r;
    const base = inPlane(pl, hs.at[0], hs.at[1], hs.kind === "screw" ? thickness : thickness - sunk);
    const mount = { at: base, axis: pl.n, uHint: pl.u };
    const fill = fillWhat === true || (fillWhat === "jewels" && hs.kind === "jewel") || (fillWhat === "screws" && hs.kind === "screw");
    if (!fill) {
      anchors[name] = inPlane(pl, hs.at[0], hs.at[1], thickness - depths[holeSpecs.indexOf(hs)]!); // the hole's floor
      continue;
    }
    const part = hs.kind === "screw"
      ? screw(hs.r, { ...mount, material: o.screwMaterial ?? "cobalt", slotAngle: o.slotAngle ?? 0.5 + 0.7 * si })
      : jewelSetting(hs.r, { ...mount, height: sunk + 0.06 * hs.r });
    for (const p of part.pieces) pieces.push({ ...p, name: `${name}-${p.name}` });
    anchors[name] = hs.kind === "screw" ? part.anchors.head! : part.anchors.top!;
  }
  // the deepest point of the top face, clear of every hole and screw head
  let best: P2 = [0, 0], bestD = Infinity;
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  const gx = (Math.max(...xs) - Math.min(...xs)) / 40, gy = (Math.max(...ys) - Math.min(...ys)) / 40;
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
    const x = Math.min(...xs) + i * gx, y = Math.min(...ys) + j * gy;
    let d = polygonDistance(outline, x, y);
    for (const hs of holeSpecs) d = Math.max(d, hs.r * 1.15 - Math.hypot(x - hs.at[0], y - hs.at[1]));
    if (d < bestD) { bestD = d; best = [x, y]; }
  }
  need(bestD < -chamfer, "the bridge has no flat top left between its holes");
  anchors.top = inPlane(pl, best[0], best[1], thickness);
  return { pieces, axis: pl.n, anchors, holes: holeSpecs.map((hs) => ({ at: inPlane(pl, hs.at[0], hs.at[1], thickness), r: hs.r, kind: hs.kind })) };
}

// ---------------------------------------------------------------- the cut-open case

export interface ShellOptions extends Mount {
  /** outer radius, height of the wall above the floor, wall thickness */
  r: number;
  h: number;
  wall: number;
  /** how wide the cut is, radians (default 140°); the wall left is drawn behind and beside */
  openAngle?: number;
  /** the angle in the base plane the cut faces (radians); `facingCamera(cam)` faces the viewer */
  facing?: number;
  /** the floor (case back) thickness below the inside floor, default = wall */
  floor?: number;
  material?: string;
  /** hatch the cut faces, as a section (default true) */
  hatch?: boolean;
}

/** The base-plane angle that points at the viewer: open a case toward it. */
export function facingCamera(cam: Camera, mount: Mount = {}): number {
  const pl = frameOf(mount), t = axesOf(cam.azimuth, cam.elevation).toward;
  return Math.atan2(dot(t, pl.v), dot(t, pl.u));
}

/**
 * A cylindrical case cut open toward `facing`: the floor whole, the wall only where it was not cut.
 * The floor and the back wall are staged behind (-1), the wall's two front ends ahead (+1), so
 * whatever is inside draws between them and nothing fights the painter's order. The cut faces are
 * hatched. Anchors: `floor` (the inside floor's centre), `rim` (the back wall's top), `cut` (on a
 * cut face).
 */
export function cutawayShell(o: ShellOptions): MechPart {
  positive(o.r, "r");
  positive(o.h, "h");
  positive(o.wall, "wall");
  need(o.wall < o.r, `wall ${o.wall} must be thinner than the radius ${o.r}`);
  const open = o.openAngle ?? (140 * Math.PI) / 180;
  need(open > 0 && open < TAU, `openAngle must be between 0 and 2π, got ${open}`);
  const floorT = o.floor ?? o.wall;
  positive(floorT, "floor");
  const pl = frameOf(o), f = o.facing ?? 0, mat = o.material ?? "steel";
  const rIn = o.r - o.wall, top = o.h, bev = Math.min(0.3 * o.wall, 0.15 * o.h);
  const floor = revolve(pl, [[-floorT, o.r - bev], [-floorT + bev, o.r], [0, o.r], [0, rIn]], 64);
  const pieces: Piece[] = [{ name: "floor", mesh: floor, look: METAL(mat), stage: -1, shadow: true }];
  // the wall runs from f + open/2 round to f + 2π − open/2; split where it passes ±90° from the cut
  const a0 = f + open / 2, a1 = f + TAU - open / 2;
  const sideL = f + Math.PI / 2, sideR = f + (3 * Math.PI) / 2;
  const spans: { from: number; to: number; stage: -1 | 1 }[] = [];
  if (a0 < sideL) spans.push({ from: a0, to: sideL, stage: 1 });
  spans.push({ from: Math.max(a0, sideL), to: Math.min(a1, sideR), stage: -1 });
  if (a1 > sideR) spans.push({ from: sideR, to: a1, stage: 1 });
  const hatch = o.hatch ?? true;
  for (const [i, s] of spans.entries()) {
    if (s.to - s.from < 1e-6) continue;
    const steps = Math.max(2, Math.round(((s.to - s.from) * 48) / TAU));
    const ring: P2[] = [];
    for (let k = 0; k <= steps; k++) ring.push([o.r * Math.cos(s.from + ((s.to - s.from) * k) / steps), o.r * Math.sin(s.from + ((s.to - s.from) * k) / steps)]);
    for (let k = steps; k >= 0; k--) ring.push([rIn * Math.cos(s.from + ((s.to - s.from) * k) / steps), rIn * Math.sin(s.from + ((s.to - s.from) * k) / steps)]);
    const mesh = bevelSlab(pl, ring, [], 0, top, { top: bev, bottom: 0, hole: 0 });
    const piece: Piece = { name: `wall${i}`, mesh, look: { material: mat, shine: false, crease: 40 }, stage: s.stage }; // no shine: it would tick every facet of the rim
    // hatch the true cut ends: the faces at a0 and a1
    const ends = [Math.abs(s.from - a0) < 1e-9 ? a0 : null, Math.abs(s.to - a1) < 1e-9 ? a1 : null].filter((v): v is number => v !== null);
    for (const cutAt of hatch ? ends : []) {
      const outward = cutAt === a0 ? -1 : 1; // the cut face looks back into the opening
      const n = inPlaneDir(pl, Math.cos(cutAt + (outward * Math.PI) / 2), Math.sin(cutAt + (outward * Math.PI) / 2));
      const segs: [V3, V3][] = [];
      const gap = o.wall * 0.42, lift = 1e-3;
      const P = (rr: number, t: number): V3 => along(inPlane(pl, rr * Math.cos(cutAt), rr * Math.sin(cutAt), t), n, lift);
      for (let d = gap; d < o.wall + top; d += gap) {
        // 45° lines across the face (radial width `wall`, height `top - bev`), clipped to it
        const hmax = top - bev;
        let x0 = 0, t0 = d, x1 = d, t1 = 0;
        if (t0 > hmax) { x0 = t0 - hmax; t0 = hmax; }
        if (x1 > o.wall) { t1 = x1 - o.wall; x1 = o.wall; }
        if (x0 <= o.wall && t1 <= hmax) segs.push([P(rIn + x0, t0), P(rIn + x1, t1)]);
      }
      (piece.marks ??= []).push({ segs, normal: n, cls: "rig-crease" });
    }
    pieces.push(piece);
  }
  const back = f + Math.PI;
  return {
    pieces,
    axis: pl.n,
    anchors: {
      floor: inPlane(pl, 0, 0, 0),
      rim: inPlane(pl, (o.r - bev / 2 + rIn) / 2 * Math.cos(back), (o.r - bev / 2 + rIn) / 2 * Math.sin(back), top),
      cut: inPlane(pl, (o.r + rIn) / 2 * Math.cos(a0), (o.r + rIn) / 2 * Math.sin(a0), top / 2),
    },
  };
}

const inPlaneDir = (pl: Plane, x: number, y: number): V3 => add(scale(pl.u, x), scale(pl.v, y));

// ---------------------------------------------------------------- springs

export interface SpringOptions extends Mount {
  material?: string;
}

/**
 * A helical compression spring: coil radius `r` (to the wire's centre), wire radius `wire`, free
 * `length`, `turns` turns, with closed, flat ends. Drawn half a turn per solid so the coils overlap
 * in the right order. Anchors: `base`, `top` (on the end coils), `side` (a coil's outside, halfway).
 */
export function helicalSpring(r: number, wire: number, length: number, turns: number, o: SpringOptions = {}): MechPart {
  positive(r, "r");
  positive(wire, "wire");
  positive(length, "length");
  positive(turns, "turns");
  need(wire < r * 0.6, `wire ${wire} is too thick for a coil of radius ${r}`);
  need(length > 2 * wire * (turns + 1), `${turns} turns of wire ${wire} do not fit in ${length}`);
  const pl = frameOf(o);
  const halves = Math.ceil(turns * 2), per = 10;
  // flat ends: the first and last half-turn rise by one wire diameter only
  const zAt = (u: number) => {
    const ends = 0.5, flat = 2 * wire, live = length - 2 * wire - 2 * flat;
    if (u <= ends) return wire + (flat * u) / ends;
    if (u >= turns - ends) return length - wire - (flat * (turns - u)) / ends;
    return wire + flat + (live * (u - ends)) / (turns - 2 * ends);
  };
  const pieces: Piece[] = [];
  for (let k = 0; k < halves; k++) {
    const u0 = (k / 2), u1 = Math.min(turns, (k + 1) / 2);
    if (u1 - u0 < 1e-6) continue;
    const pts: V3[] = [];
    for (let i = 0; i <= per; i++) {
      const u = u0 + ((u1 - u0) * i) / per, a = u * TAU;
      pts.push(inPlane(pl, r * Math.cos(a), r * Math.sin(a), zAt(u)));
    }
    pieces.push({ name: `coil${k}`, mesh: tube(pts, wire, 10), look: METAL(o.material ?? "steel", 40) });
  }
  // the outermost vertex of a middle coil, so the anchor lies exactly on the wire
  const mid = pieces[Math.floor(pieces.length / 2)]!.mesh.verts;
  const side = mid.reduce((b, v) => (dot(sub(v, pl.origin), pl.u) > dot(sub(b, pl.origin), pl.u) ? v : b));
  return {
    pieces,
    axis: pl.n,
    anchors: { base: inPlane(pl, r, 0, zAt(0)), top: inPlane(pl, r * Math.cos(turns * TAU), r * Math.sin(turns * TAU), zAt(turns)), side },
  };
}

// ---------------------------------------------------------------- the exploded stack

export interface StackLayer {
  /** the layer's height along the stack axis when assembled */
  thickness: number;
  /** where guide lines run in the gap below this layer (base-plane points): the axles that join it to the layer beneath */
  axes?: readonly P2[];
}

export interface ExplodedStack {
  /** each layer's displacement along the axis: 0 when assembled, never decreasing up the stack */
  offsets: number[];
  /** each layer's base along the axis, assembled position plus offset */
  bases: number[];
  /** each layer's base as a point: origin + axis × base */
  origins: V3[];
  /** guides[i]: the dashed centre lines across the gap below layer i (empty for layer 0, or when closed) */
  guides: [V3, V3][][];
}

/**
 * Layers along an axis, pulled apart by `explode` (0 assembled, 1 fully apart): layer i moves
 * `explode × spread × i`. Returns where each layer sits and the centre lines across each gap,
 * the way an exploded view in a watchmaker's or gearbox manual draws them. Draw layer 0, the guides
 * of layer 1, layer 1, and so on (`centreLines`).
 */
export function explodedStack(layers: readonly StackLayer[], explode: number, o: { spread?: number; gap?: number; origin?: V3; axis?: V3 } = {}): ExplodedStack {
  need(layers.length >= 1, "a stack needs at least one layer");
  need(Number.isFinite(explode) && explode >= 0 && explode <= 1, `explode must be in [0, 1], got ${explode}`);
  for (const [i, l] of layers.entries()) need(Number.isFinite(l.thickness) && l.thickness >= 0, `layer ${i} thickness must be a number ≥ 0`);
  const tallest = Math.max(...layers.map((l) => l.thickness));
  const spread = o.spread ?? Math.max(1.5 * tallest, 1e-6);
  const gap = o.gap ?? 0;
  need(Number.isFinite(spread) && spread >= 0, `spread must be ≥ 0, got ${spread}`);
  need(Number.isFinite(gap) && gap >= 0, `gap must be ≥ 0, got ${gap}`);
  const origin = o.origin ?? [0, 0, 0], axis = unit(o.axis ?? [0, 0, 1]);
  const pl = planeOf(origin, axis, Math.abs(axis[0]) > 0.95 ? [0, 1, 0] : [1, 0, 0]);
  const offsets: number[] = [], bases: number[] = [];
  let assembled = 0;
  layers.forEach((l, i) => {
    offsets.push(explode * spread * i);
    bases.push(assembled + offsets[i]!);
    assembled += l.thickness + gap;
  });
  const guides: [V3, V3][][] = layers.map((l, i) => {
    if (i === 0) return [];
    const from = bases[i - 1]! + layers[i - 1]!.thickness, to = bases[i]!;
    if (to - from < 1e-9) return [];
    return (l.axes ?? []).map(([x, y]) => [inPlane(pl, x, y, from), inPlane(pl, x, y, to)] as [V3, V3]);
  });
  return { offsets, bases, origins: bases.map((b) => along(origin, axis, b)), guides };
}

/** Dash-dot centre lines (an axle's line across an exploded gap, an axis), in the page's ink. */
export function centreLines(cam: Camera, segs: readonly (readonly [V3, V3])[]): string {
  if (!segs.length) return "";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const d = segs.map(([a, b]) => pathThrough([screenOf(cam, a, ax), screenOf(cam, b, ax)], false)).join("");
  return `<path class="rig-axis mech-axis" d="${d}"/>`;
}

// ---------------------------------------------------------------- moving and drawing

/** The part moved by `d` (meshes, anchors and marks). */
export function shifted<T extends MechPart>(part: T, d: V3): T {
  const mv = (m: Mesh): Mesh => ({ verts: m.verts.map((v) => add(v, d)), faces: m.faces });
  const anchors: Record<string, V3> = {};
  for (const [k, v] of Object.entries(part.anchors)) anchors[k] = add(v, d);
  return {
    ...part,
    pieces: part.pieces.map((p) => ({ ...p, mesh: mv(p.mesh), ...(p.marks ? { marks: p.marks.map((mk) => ({ ...mk, segs: mk.segs.map(([a, b]) => [add(a, d), add(b, d)] as [V3, V3]) })) } : {}) })),
    anchors,
  };
}

/** Every vertex of some parts: hand to `fitCamera`. */
export const partPoints = (...parts: readonly MechPart[]): V3[] => parts.flatMap((p) => p.pieces.flatMap((q) => q.mesh.verts));

export interface AssemblyOptions {
  /** the "up" of the assembly for ordering (default the first part's axis) */
  up?: V3;
  /** lay contact shadows under pieces that ask for one */
  shadow?: boolean;
  /** how far a shadow falls, world units (default 0.06 × the assembly's size) */
  shadowDistance?: number;
}

/**
 * Several parts drawn as one SVG in painter's order: staged-behind pieces first, then every piece
 * by how high its top stands along `up` (lower first; seen from below, higher first), ties broken
 * far to near, then staged-ahead pieces. Right for stacks of plates, wheels on arbors and parts in
 * an open case; split an arbor (`breaks`) where wheels pass over it.
 */
export function drawAssembly(parts: readonly MechPart[], cam: Camera, o: AssemblyOptions = {}): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const up = unit(o.up ?? parts[0]?.axis ?? [0, 0, 1]);
  const sign = dot(up, ax.toward) >= 0 ? 1 : -1;
  const all = parts.flatMap((p) => p.pieces);
  const key = all.map((p) => {
    let top = -Infinity, near = 0;
    for (const v of p.mesh.verts) {
      top = Math.max(top, sign * dot(v, up));
      near += nearness(cam, v, ax);
    }
    return { p, stage: p.stage ?? 0, top, near: near / Math.max(1, p.mesh.verts.length) };
  });
  key.sort((a, b) => a.stage - b.stage || (Math.abs(a.top - b.top) > 1e-6 ? a.top - b.top : a.near - b.near));
  let out = "";
  if (o.shadow) {
    const pts = partPoints(...parts);
    let lo = Infinity, hi = -Infinity;
    for (const v of pts) { lo = Math.min(lo, v[0], v[1], v[2]); hi = Math.max(hi, v[0], v[1], v[2]); }
    const dist = o.shadowDistance ?? 0.06 * (hi - lo);
    const away = scale(keyLight(ax), -dist);
    for (const k of key) if (k.p.shadow) out += contactShadow(k.p.mesh, cam, away);
  }
  for (const k of key) {
    out += k.p.ordered !== false ? drawOrdered(k.p.mesh, cam, k.p.look) : drawMesh(k.p.mesh, cam, k.p.look);
    for (const mk of k.p.marks ?? []) if (dot(mk.normal, ax.toward) > 1e-6) out += `<g class="rig-solid rig-m-${k.p.look.material}">${linesOn(cam, mk.segs, mk.cls ?? "rig-crease")}</g>`;
  }
  return out;
}

/** One part as SVG, its pieces in painter's order. */
export const drawPart = (part: MechPart, cam: Camera, o: AssemblyOptions = {}): string => drawAssembly([part], cam, o);

/**
 * A mesh drawn face by face, far to near (caps last, as drawMesh orders them), each face followed
 * by its own outline: its silhouette edges, and its creases with faces already drawn. A nearer face
 * then covers the edges behind it, so a pinion's far leaves or a wheel's far tooth flanks do not
 * show their bottom edges through the top, which drawMesh (all lines last) cannot avoid. Specular
 * lines go only on edges that are drawn, so a curved flank does not tick at every facet.
 * Costs a path per face: for parts drawn once.
 */
export function drawOrdered(mesh: Mesh, cam: Camera, look: Look): string {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const light = keyLight(ax), half = unit(add(light, ax.toward));
  const pts = mesh.verts.map((v) => screenOf(cam, v, ax));
  const z = mesh.verts.map((v) => nearness(cam, v, ax));
  const seen = mesh.faces.map((f) => dot(f.normal, ax.toward) > 1e-6);
  const depth = (i: number) => {
    const l = mesh.faces[i]!.loops[0]!;
    return l.reduce((acc, k) => acc + z[k]!, 0) / l.length + (mesh.faces[i]!.role === "cap" ? 1e3 : 0);
  };
  const order = mesh.faces.map((_, i) => i).filter((i) => seen[i]).sort((a, b) => depth(a) - depth(b));
  const edges = new Map<string, number[]>();
  mesh.faces.forEach((f, i) => {
    for (const l of f.loops) for (let k = 0; k < l.length; k++) {
      const a = l[k]!, b = l[(k + 1) % l.length]!;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      (edges.get(key) ?? edges.set(key, []).get(key)!).push(i);
    }
  });
  const cosCrease = Math.cos(((look.crease ?? 28) * Math.PI) / 180);
  const done = new Set<number>();
  const seg = (a: number, b: number) => `M${n1(pts[a]![0])} ${n1(pts[a]![1])}L${n1(pts[b]![0])} ${n1(pts[b]![1])}`;
  let body = "";
  for (const i of order) {
    const f = mesh.faces[i]!;
    const sh = Math.round(shadeOf(f.normal, light) * 32) / 32;
    const cls = f.role === "cap" || f.role === "end" ? "rig-cap" : "rig-wall";
    body += `<path class="rig-face ${cls}" fill-rule="evenodd" style="fill:color-mix(in oklab,var(--rig-lit) ${Math.round(sh * 100)}%,var(--rig-dark))" d="${f.loops.map((l) => pathThrough(l.map((k) => pts[k]!))).join("")}"/>`;
    let sil = "", crease = "", shine = "";
    const lit = look.shine && f.role !== "cap" && f.role !== "end" && dot(f.normal, half) > 0.93;
    for (const l of f.loops) for (let k = 0; k < l.length; k++) {
      const a = l[k]!, b = l[(k + 1) % l.length]!;
      const fs = edges.get(a < b ? `${a}|${b}` : `${b}|${a}`)!;
      const other = fs.find((j) => j !== i);
      if (other === undefined || !seen[other]) sil += seg(a, b);
      else if (done.has(other) && dot(f.normal, mesh.faces[other]!.normal) < cosCrease) crease += seg(a, b);
      else continue;
      if (lit) shine += seg(a, b);
    }
    done.add(i);
    if (crease) body += `<path class="rig-crease" d="${crease}"/>`;
    if (shine) body += `<path class="rig-shine" d="${shine}"/>`;
    if (sil) body += `<path class="rig-sil" d="${sil}"/>`;
  }
  return `<g class="rig-solid rig-m-${look.material}${look.className ? " " + look.className : ""}">${body}</g>`;
}
