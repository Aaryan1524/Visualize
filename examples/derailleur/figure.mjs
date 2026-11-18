// The derailleur on Visualize's rig (src/rig): every part is a closed solid, shaded by one key
// light, drawn once; each frame only places it.
//
//   const F = figure(M, camera, { prefix })  // once per variant
//   F.parts                                  // drawings put in the page once
//   F.pose(state)                            // each frame: { items, at, defs }
//
// How each part moves:
//   - in place: frame, dropout, hanger, B-knuckle, hub and spokes, housing;
//   - one transform, exact: the P-knuckle and the pulleys' hubs (they only slide), the gate marks
//     (flat, on a cog's face);
//   - drawn ahead at a few angles, then one small turn: cogs and pulleys (one tooth of symmetry),
//     cage plates and chain links. A thick part turned by a transform is exact on the face it is
//     placed by; the few drawings keep the far face within a fraction of a pixel (figure.test.mjs);
//   - rebuilt when their state changes: the parallelogram's links (they turn on tilted pins), the
//     return spring, the inner cable, the barrel, and the force arrows.
//
// World: x forward, y up, e lateral (outboard +), mm, rear axle at the origin. The rig's world is
// right-handed [x, y, z] with z up, and the drive side is the bike's right, so a point is
// [x, -e, y]. The side plane's coordinates are (x, y) and its normal points outboard, so a part at
// lateral e sits at t = e along it.

import {
  add, affineString, angleBin, axesOf, contactShadow, cross, dot, drawMesh, fitCamera, keyLight, linesOn, moveInPlane,
  pathThrough, planeKey, planeOf, plate, circlePoints, rod, roundedHull, scale, screenOf, slotKey, sprocket, sub, turned, unit,
} from "../../src/rig/index.ts";
import { pathAt } from "./model.mjs";
export { RigStage, screenOf } from "../../src/rig/index.ts";

export const W = (x, y, e) => [x, -e, y];
const TAU = Math.PI * 2;
const SIDE = planeOf([0, 0, 0], [0, -1, 0], [1, 0, 0]); // u forward, v up, n outboard
const SIDE_AXES = { origin: [0, 0, 0], u: SIDE.u, v: SIDE.v, n: SIDE.n };
const LAT = [0, -1, 0]; // outboard

// The chain is drawn forward to here, fading over the last FADE mm: the chainring is 404 mm ahead.
export const XCUT = 128;
// The off-line arrow's drawn length, mm sideways: far longer than any real offset, so it reads at 1x.
export const OFF_ARROW = 30;
const FADE = 46;

// How many drawings each turning part gets, and the plane each chain piece is placed by. A thick part
// turned by a transform is exact on that plane and off elsewhere by its distance from it times the
// turn left over; figure.test.mjs holds every part under a pixel.
export const BINS = {
  cog: 1, // one drawing a cog: at most half a tooth left to the transform
  pulley: 2,
  link: 12, // at most 15 degrees left to a chain piece
  cageStep: (4 * Math.PI) / 180, // a cage plate drawn every 4 degrees of its turn
  // a chain piece is placed by the lateral plane in the middle of what it draws: the outer plates'
  // mid-plane, and for an inner link, between its rollers and its near plate
  placeBy: { outer: 2.35, inner: 0.76 },
};

export const VIEW = { azimuth: 244, elevation: 21 }; // from outboard and a little behind

/**
 * Where to set the cassette so the chain's rollers sit in the valleys of the cog it is on: the cog
 * and its offset from the cassette's angle `theta`, at `roll` mm of chain, in this pose.
 */
export function seatPhase(M, p, roll, theta) {
  const k = Math.max(0, Math.min(M.last, Math.round(p.chainK)));
  const path = p.path, Lp = M.D.p;
  const sCog = path.wraps[0].L + path.runs[0].L;
  const ds = (((-roll - sCog) % Lp) + Lp) % Lp;
  const seat = path.wraps[1].a0 + ds / path.circles[1].r + Math.PI / M.cogs[k];
  const tooth = TAU / M.cogs[k];
  return { k, offset: (((seat - theta) % tooth) + tooth) % tooth };
}

/** The main camera for one variant, fitted to every gear, so the figure fills its box. */
export function cameraFor(M, box) {
  const pts = [];
  const big = M.Rk[M.last] + 4;
  for (let a = 0; a < 360; a += 30) for (const e of [2, -M.zMax - 2]) pts.push(W(big * Math.cos((a * Math.PI) / 180), big * Math.sin((a * Math.PI) / 180), e));
  for (let k = 0; k <= M.last; k++) {
    const p = M.pose(M.pullFor(k), k);
    pts.push(W(p.T[0], p.T[1] - M.r - 8, p.e), W(p.T[0] - M.r - 7, p.T[1], p.e), W(p.G[0] - M.r - 6, p.G[1], p.e));
  }
  pts.push(W(XCUT - 8, 8, 0), W(XCUT - 8, -40, 0), W(-70, -30, 40));
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

// ---------------------------------------------------------------- shapes in the side plane
const slab = (outline, e0, e1, holes) => plate(SIDE, { outer: outline, holes }, e0, e1);
// a part turned about a lateral axis through side point (x, y), from lateral e0 to e1
const lateralTurned = (x, y, e0, e1, profile, seg = 32) => turned(W(x, y, e0), LAT, profile.map(([s, r]) => [s, r]), seg, [1, 0, 0]);
const windows = (R, n, phase = 0.12) => {
  const r0 = 21, r1 = R - 8, out = [];
  for (let i = 0; i < n; i++) {
    const a0 = phase + (TAU * i) / n, a1 = a0 + TAU / n - 0.42, w = [];
    for (let j = 0; j <= 8; j++) w.push([r0 * Math.cos(a0 + ((a1 - a0) * j) / 8), r0 * Math.sin(a0 + ((a1 - a0) * j) / 8)]);
    for (let j = 8; j >= 0; j--) w.push([r1 * Math.cos(a0 + 0.06 + ((a1 - a0 - 0.12) * j) / 8), r1 * Math.sin(a0 + 0.06 + ((a1 - a0 - 0.12) * j) / 8)]);
    out.push(w);
  }
  return out;
};
const arrowHead = (at, dir, size) => {
  const n = [-dir[1], dir[0]], b = [at[0] - dir[0] * size, at[1] - dir[1] * size];
  return pathThrough([at, [b[0] + n[0] * size * 0.42, b[1] + n[1] * size * 0.42], [b[0] - n[0] * size * 0.42, b[1] - n[1] * size * 0.42]]);
};

/**
 * @param {object} M     the model for one variant
 * @param {object} cam   the camera
 * @param {object} o     { prefix }: the id prefix of every part
 */
export function figure(M, cam, o = {}) {
  const px = o.prefix ?? "m", D = M.D;
  const ax = axesOf(cam.azimuth, cam.elevation);
  const L = keyLight(ax);
  const shadowAway = scale(L, -2.4); // contact shadows fall away from the light
  const S = (x, y, e) => screenOf(cam, W(x, y, e), ax);
  const parts = []; // drawn once: { id, part, svg }
  const once = (id, part, svg) => parts.push({ id: `${px}-${id}`, part, svg });
  const defs = new Map(); // drawings made ahead, by id: { svg, sent }
  const tpl = (id, make) => {
    const full = `${px}-${id}`;
    if (!defs.has(full)) defs.set(full, { svg: `<g id="${full}">${make()}</g>`, sent: false });
    return `#${full}`;
  };
  const place = (theta, to, fromN, toN) => affineString(moveInPlane(cam, SIDE_AXES, theta, to, fromN, toN));

  // painter's slots: the cogs' planes, far (inboard) to near
  const cogE = M.cogs.map((_, k) => M.cogE(k));
  const planes = [...cogE].sort((a, b) => a - b);
  const cogKey = (k) => planeKey(planes.indexOf(cogE[k]));
  const gap = (e, rank) => slotKey(planes, e, rank);
  const out = (e) => 30 + e / 100;

  // ---- context and fixed structure, drawn in place (main view only)
  const [mx, my] = D.mount;
  const cu = unit(sub(M.guide3(M.zMax), M.guide3(0)));
  const off = [D.pOff[0], D.pOff[1], D.pLat];
  const BK = add(M.centre, off);
  const topE = BK[2] + 11;
  const pinAxis = unit(cross(sub(M.guide3(M.zMax), M.guide3(0)), sub(M.centre, M.guide3(M.zMax / 2))));
  const qOff = scale(cu, 10); // the two links sit 20 mm apart in the plane they swing in
  const k3 = (q) => W(q[0], q[1], q[2]);
  // spokes leave the hub flange and run out past the cassette, fading
  const e0 = -M.zMax - 13;
  let sp = "";
  for (let i = 0; i < 14; i++) {
    const a = (TAU * i) / 14 + 0.13, c = [24 * Math.cos(a), 24 * Math.sin(a)], d = [Math.cos(a + (i % 2 ? 0.6 : -0.6)), Math.sin(a + (i % 2 ? 0.6 : -0.6))];
    const P0 = S(c[0], c[1], e0 + 1.5);
    for (let s = 0; s < 3; s++) {
      const q0 = S(c[0] + d[0] * 40 * s, c[1] + d[1] * 40 * s, e0 + 1.5 + 4 * s), q1 = S(c[0] + d[0] * 40 * (s + 1), c[1] + d[1] * 40 * (s + 1), e0 + 1.5 + 4 * (s + 1));
      sp += `<path class="spoke" style="opacity:${(0.9 - s * 0.3).toFixed(2)}" d="${pathThrough([s ? q0 : P0, q1], false)}"/>`;
    }
  }
  once("spokes", "context", sp);
  once("hub", "context", drawMesh(lateralTurned(0, 0, e0 - 1.5, e0 + 1.5, [[0, 20], [0.4, 28], [2.6, 28], [3, 20]]), cam, { material: "frame" }));
  once("freehub", "cassette", drawMesh(lateralTurned(0, 0, -M.zMax - 6, 3, [[0, 17.4], [M.zMax + 9, 17.4]], 36), cam, { material: "slate" }));
  // the frame: chainstay and seatstay (cut, fading), dropout, thru-axle end
  const stay = (to, r) => drawMesh(rod(W(4, 0, 12), W(to[0], to[1], to[2]), r, 24), cam, { material: "frame" });
  once("stays", "context", `<g mask="url(#fadeStays)">${stay([150, -12, 20], 9)}${stay([95, 150, 20], 7)}</g>`);
  once("dropout", "context", drawMesh(slab(roundedHull([[0, 0, 11], [-4, -8, 8], [14, -3, 8]]), 9, 15), cam, { material: "frame" }));
  once("axle", "context", drawMesh(lateralTurned(0, 0, 15, 20, [[0, 6.5], [4, 6.5], [5, 5.2]], 28), cam, { material: "steel", shine: true }));
  // the hanger: a plate from the dropout down and back to the B-knuckle's bolt
  const hanger = drawMesh(slab(roundedHull([[-3, -5, 7], [mx, my, 8], [mx + 5, my + 11, 6]]), 15.3, 18.6), cam, { material: "steel", shine: true });
  once("hanger", "hanger", hanger);
  // the B-knuckle: one clean body from the bolt to the fixed pivots, with its bolt head
  const body = slab(roundedHull([[mx, my, 8.5], [BK[0] + 3, BK[1] + 8, 7.5], [BK[0] - 2, BK[1] - 7, 8.5]]), 19.4, topE);
  once("bknuckle", "bknuckle", contactShadow(body, cam, shadowAway) + drawMesh(body, cam, { material: "slate", shine: true }) + drawMesh(lateralTurned(mx, my, topE, topE + 3, [[0, 5.6], [2.4, 5.6], [3, 4.6]], 6), cam, { material: "alloy", shine: true }));
  // the B screw on the knuckle's tab
  once("bscrew", "bknuckle", drawMesh(lateralTurned(mx + 9, my + 7, topE, topE + 2.2, [[0, 2.7], [2.2, 2.7]], 18), cam, { material: "alloy" }) + linesOn(cam, [[W(mx + 9 - 1.9, my + 7 - 1.2, topE + 2.2), W(mx + 9 + 1.9, my + 7 + 1.2, topE + 2.2)]]));
  // the housing: a loop from the chainstay back into the barrel adjuster
  const barrelA = [mx - 15, my + 8, topE + 4.6], dirB = unit([1, 0.3, 0.1]);
  const barrelB = add(barrelA, scale(dirB, 12));
  const h0 = [XCUT - 12, 6, 18], h1 = [40, 2, 32], h2 = add(barrelB, scale(dirB, 26));
  const bez = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    return add(add(scale(h0, a), scale(h1, b)), add(scale(h2, c), scale(barrelB, d)));
  });
  const hp = pathThrough(bez.map((q) => screenOf(cam, k3(q), ax)), false);
  once("housing", "cable", `<g mask="url(#fadeX)"><path class="housing" d="${hp}"/><path class="housing-core" d="${hp}"/></g>`);
  var anchorsStatic = { housing: screenOf(cam, k3(bez[8]), ax), hanger: S(mx * 0.45, my * 0.45 - 4, 19), bknuckle: S(BK[0] + 2, BK[1] + 2, topE), bscrew: S(mx + 9, my + 7, topE + 2.2), bbolt: S(mx, my, topE + 3), barrel: screenOf(cam, k3(add(barrelA, scale(dirB, 6))), ax) };
  var barrel = { barrelA, dirB };

  // ---- cogs: drawn ahead at four angles across one tooth, in steel; the one the chain is on is lit
  const COG_BINS = BINS.cog;
  const cogDrawing = (k, bin) => tpl(`cog${k}-${bin}`, () => {
    const R = M.Rk[k], N = M.cogs[k], rot = (bin * TAU) / N / COG_BINS;
    const holes = [circlePoints(17.6, 40)];
    // windows only in a number that divides the teeth, so the cog keeps one tooth's symmetry and a
    // drawing turned a whole tooth back is the same picture
    const nW = [7, 6, 5, 4, 3].find((w) => N % w === 0);
    if (R > 34 && nW) holes.push(...windows(R, nW, 0.12 + rot));
    return drawMesh(slab(sprocket(N, R, D.tipAdd, rot), cogE[k] - 0.85, cogE[k] + 0.85, holes), cam, { material: "steel", shine: true });
  });
  // ---- pulleys: toothed plates in the subject's colour, on a turned alloy hub
  const PUL_BINS = BINS.pulley;
  const pulleyTeeth = (bin) => tpl(`pulley-${bin}`, () => {
    const rot = (bin * TAU) / D.pulleyT / PUL_BINS;
    return drawMesh(slab(sprocket(D.pulleyT, M.r, 2.4, rot), -1.4, 1.4, [circlePoints(6.4, 28)]), cam, { material: "subject", shine: true });
  });
  const pulleyHub = tpl("pulleyHub", () => drawMesh(lateralTurned(0, 0, -3.6, 3.6, [[0, 6.2], [0.6, 7], [6.6, 7], [7.2, 6.2]], 28), cam, { material: "alloy", shine: true }) + drawMesh(lateralTurned(0, 0, 3.6, 5.2, [[0, 3.4], [1.6, 3.4]], 6), cam, { material: "alloy" }));
  // ---- cage plates, drawn ahead every 4° of the cage's turn
  const CAGE_STEP = BINS.cageStep;
  const cage = M.v.cage;
  const cageDrawing = (which, bin) => tpl(`cage${which}-${bin}`, () => {
    const a = bin * CAGE_STEP, c = Math.cos(a), s = Math.sin(a);
    const rot = (pts) => pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
    if (which === "In") return drawMesh(slab(rot(roundedHull([[0, 0, 10], [cage, 0, 11]])), -5.9, -4.5), cam, { material: "subject" });
    const outline = rot(roundedHull([[0, 0, 11], [cage, 0, 12], [cage / 2, -3.5, 9.5]]));
    const slot = rot(roundedHull([[cage * 0.36, -1, 3.2], [cage * 0.64, -1.6, 3.2]], 12));
    const plateM = slab(outline, 4.5, 6.1, [slot]);
    let s2 = contactShadow(plateM, cam, shadowAway);
    s2 += drawMesh(plateM, cam, { material: "subject", shine: true });
    for (const [bx, by] of rot([[0, 0], [cage, 0]])) s2 += drawMesh(lateralTurned(bx, by, 6.1, 7.8, [[0, 3.6], [1.2, 3.6], [1.7, 2.9]], 6), cam, { material: "alloy", shine: true });
    return s2;
  });
  // ---- the P-knuckle: drawn with the guide pulley's axle at the origin; it only slides
  const [ox, oy] = D.pOff;
  const pk = slab(roundedHull([[ox, oy, 8], [0, 0, 10], [7, 8, 7.5]]), 7.4, D.pLat - 2);
  once("pknuckle", "pknuckle", contactShadow(pk, cam, shadowAway) + drawMesh(lateralTurned(0, 0, 6, 7.6, [[0, 10.4], [1.6, 10.4]], 40), cam, { material: "slate" }) + drawMesh(pk, cam, { material: "slate", shine: true }));
  // ---- the chain: each piece drawn ahead at a few angles; an inner link carries its rollers
  const LINK_BINS = BINS.link, Lp = D.p;
  const linkDrawing = (kind, bin) => tpl(`${kind}-${bin}`, () => {
    const a = (bin * TAU) / LINK_BINS, c = Math.cos(a), s = Math.sin(a);
    const outer = kind.startsWith("outer"), r = outer ? 3.9 : 3.6;
    const shape = roundedHull([[-Lp / 2, 0, r], [Lp / 2, 0, r]], 14).map(([x, y]) => [x * c - y * s, x * s + y * c]);
    const [s0, s1] = outer ? [1.95, 2.75] : [1.15, 1.9];
    const near = kind.endsWith("Near");
    const m = near ? slab(shape, s0, s1) : slab(shape, -s1, -s0);
    // an inner link carries its two rollers, drawn between its plates (round, so turning them is free)
    let svg = !outer && near ? [-Lp / 2, Lp / 2].map((sx) => drawMesh(lateralTurned(sx * c, sx * s, -1.15, 1.15, [[0, 3.85], [2.3, 3.85]], 16), cam, { material: "chain", crease: 40 })).join("") : "";
    svg += drawMesh(m, cam, { material: "chain", shine: near, crease: 40 });
    if (outer && near) for (const sx of [-Lp / 2, Lp / 2]) svg += drawMesh(lateralTurned(sx * c, sx * s, s1, s1 + 0.5, [[0, 1.6], [0.5, 1.2]], 10), cam, { material: "alloy" });
    return svg;
  });
  // ---- the gate marks: flat lines on a cog's face, so one exact transform turns them
  const gateMarks = (k) => tpl(`gates${k}`, () => {
    const R = M.Rk[k], e = cogE[k] + 0.86;
    const ga = Array.from({ length: D.gates }, (_, g) => 0.6 + (TAU * g) / D.gates);
    const d = ga.map((a) => pathThrough([S((R - 1.6) * Math.cos(a), (R - 1.6) * Math.sin(a), e), S((R + D.tipAdd) * Math.cos(a - 0.18), (R + D.tipAdd) * Math.sin(a - 0.18), e)], false)).join("");
    const pins = ga.map((a) => S((R - 1.2) * Math.cos(a + 0.07), (R - 1.2) * Math.sin(a + 0.07), e));
    return `<path class="gate" d="${d}"/>` + pins.map(([x, y]) => `<circle class="gate-pin" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="24"/>`).join("");
  });
  const lock = [];
  for (let i = 0; i < 12; i++) {
    const a = (TAU * i) / 12;
    lock.push([16 * Math.cos(a - 0.12), 16 * Math.sin(a - 0.12)], [13.6 * Math.cos(a - 0.1), 13.6 * Math.sin(a - 0.1)], [13.6 * Math.cos(a + 0.1), 13.6 * Math.sin(a + 0.1)], [16 * Math.cos(a + 0.12), 16 * Math.sin(a + 0.12)]);
  }
  tpl("lockring", () => drawMesh(slab(lock, 0.9, 3.1, [circlePoints(10, 30)]), cam, { material: "steel", shine: true }));

  // Draw ahead, at mount, everything a frame may ask for, so no frame pays for a first drawing:
  // every cog, both pulley angles, every chain piece, and the cage across the angles it reaches.
  M.cogs.forEach((_, k) => cogDrawing(k, 0));
  for (let b = 0; b < PUL_BINS; b++) pulleyTeeth(b);
  for (const kind of ["outerFar", "outerNear", "innerFar", "innerNear"]) for (let b = 0; b < LINK_BINS; b++) linkDrawing(kind, b);
  {
    const al = M.cogs.map((_, k) => (M.pose(M.pullFor(k), k).alpha * Math.PI) / 180);
    for (let b = Math.floor(Math.min(...al) / CAGE_STEP) - 3; b <= Math.ceil(Math.max(...al) / CAGE_STEP) + 3; b++) (cageDrawing("In", b), cageDrawing("Out", b));
  }
  M.cogs.forEach((_, k) => k > 0 && gateMarks(k));

  // Live parts are rebuilt only when what they show changes; this keeps the last of each.
  const cache = new Map();
  const memo = (id, sig, make) => {
    const c = cache.get(id);
    if (c && c.sig === sig) return c.svg;
    const svg = make();
    cache.set(id, { sig, svg });
    return svg;
  };
  const alphaAt = (x) => (x < XCUT - FADE ? 1 : x > XCUT ? 0 : 1 - (x - (XCUT - FADE)) / FADE);

  function pose(st) {
    const p = st.pose, items = [], at = {};
    const put = (id, key, extra) => items.push({ id: `${px}-${id}`, key, ...extra });
    const live = (id, part, key, svg) => items.push({ id: `${px}-${id}`, part, key, svg, transform: null });
    const eng = Math.max(0, Math.min(M.last, Math.round(p.chainK)));
    const [gx, gy] = p.G, [tx, ty] = p.T, eG = p.e, roll = st.roll ?? 0;
    const path = p.path;

    for (const id of ["spokes", "hub"]) put(id, -6, { transform: null });
    put("freehub", -5, { transform: null });
    // the cassette turns as one block with the chain (clockwise, the top run moving forward); the
    // cog the chain is on is phased so its rollers sit in the tooth valleys
    // st.turn is the cassette's running angle (the page integrates it through a climb, so it never
    // jumps); st.phase seats the chain's rollers in one cog's valleys. Without them (a still pose,
    // a test) the cassette turns with the cog the chain is on and is seated now.
    const theta = st.turn ?? -roll / M.Rk[eng];
    const ph = st.phase ?? seatPhase(M, p, roll, theta);
    for (let k = 0; k <= M.last; k++) {
      const th = theta + (k === ph.k ? ph.offset : 0.37 * k);
      const { bin, rest } = angleBin(th, TAU / M.cogs[k], COG_BINS);
      put(`cog${k}`, cogKey(k), { href: cogDrawing(k, bin), transform: place(rest, [0, 0], cogE[k], cogE[k]), part: "cassette", flags: { on: k === eng } });
      if (k > 0 && st.show?.gates && k === Math.min(M.last, eng + 1)) {
        put(`gates`, out(3.3), { href: gateMarks(k), transform: place(th, [0, 0], cogE[k] + 0.86, cogE[k] + 0.86), part: "cassette" });
        const best = [0, 1, 2].map((g) => th + 0.6 + (TAU * g) / D.gates).reduce((b, a) => (Math.cos(a - 0.5) > Math.cos(b - 0.5) ? a : b));
        at.gate = S((M.Rk[k] - 3) * Math.cos(best), (M.Rk[k] - 3) * Math.sin(best), cogE[k] + 0.86);
      }
    }
    put("lockring", out(2), { href: `#${px}-lockring`, transform: place(angleBin(theta, TAU / 12, 1).rest, [0, 0], 2, 2), part: "cassette" });
    put("stays", -7, { transform: null });
    for (const [id, e] of [["dropout", 12], ["axle", 21.5], ["hanger", 19], ["bknuckle", BK[2] + 6], ["bscrew", BK[2] + 6.2], ["housing", BK[2] + 14]]) put(id, out(e), { transform: null });

    // pulleys and cage: placed at the guide pulley's axle; the cage turned to its solved angle
    // Pedalling runs the chain against the path's order (ring, cog, guide, tension), so each wheel
    // turns against the way the path goes round it: the cassette and the tension pulley clockwise
    // in the side view, the guide pulley counter-clockwise (the chain's S through the cage).
    for (const [name, cx, cy, spin] of [["guide", gx, gy, roll / M.r], ["tension", tx, ty, -roll / M.r]]) {
      const { bin, rest } = angleBin(spin, TAU / D.pulleyT, PUL_BINS);
      // off line (the lab, a slack cable): the guide pulley's teeth turn red, out of line with their cog
      const off = name === "guide" && !!st.show?.offline && Math.abs(p.off) > 0.05;
      put(`${name}Teeth`, gap(eG, 0.4), { href: pulleyTeeth(bin), transform: place(rest, [cx, cy], 0, eG), part: name, flags: { off } });
      put(`${name}Hub`, gap(eG, 0.45), { href: pulleyHub, transform: place(0, [cx, cy], 0, eG), part: name });
    }
    const al = (p.alpha * Math.PI) / 180;
    const cb = Math.round(al / CAGE_STEP), crest = al - cb * CAGE_STEP;
    put("cageIn", gap(eG - 5.2, 0.1), { href: cageDrawing("In", cb), transform: place(crest, [gx, gy], -5.2, eG - 5.2), part: "cage" });
    put("cageOut", gap(eG + 5.3, 0.8), { href: cageDrawing("Out", cb), transform: place(crest, [gx, gy], 5.3, eG + 5.3), part: "cage" });
    put("pknuckle", out(eG + D.pLat - 6), { transform: place(0, [gx, gy], 0, eG) });
    at.guide = S(gx - M.r * 0.72, gy - M.r * 0.72, eG);
    at.tension = S(tx - M.r * 0.72, ty - M.r * 0.72, eG);
    at.cage = S(gx * 0.42 + tx * 0.58 + 7, gy * 0.42 + ty * 0.58, eG + 6);
    at.pknuckle = S(gx + D.pOff[0] + 6, gy + D.pOff[1], eG + D.pLat - 2);

    // the chain: each link placed along the solved path
    {
      const total = path.total, ringE = M.ringE, cE = p.chainE;
      const latAt = (q) => q.on === "ring" ? ringE : q.on === "cog" ? cE : q.on === "guide" || q.on === "tension" || q.on === "run2" ? eG : q.on === "run0" ? ringE + (cE - ringE) * q.f : q.on === "run1" ? cE + (eG - cE) * q.f : eG + (ringE - eG) * q.f;
      const pins = [];
      for (let i = 0; i <= M.links; i++) {
        const q = pathAt(path, (((-roll + i * Lp) % total) + total) % total);
        pins.push({ q, x: q.p[0], y: q.p[1], e: latAt(q) });
      }
      for (let i = 0; i < M.links; i++) {
        const A = pins[i], B = pins[i + 1], outer = i % 2 === 0, s0 = outer ? 1.95 : 1.15;
        const xm = (A.x + B.x) / 2, alpha = alphaAt(xm);
        const hide = alpha <= 0.02;
        if (hide) {
          items.push({ id: `${px}-cf${i}`, hidden: true }, { id: `${px}-cn${i}`, hidden: true });
          continue;
        }
        const em = (A.e + B.e) / 2, th = Math.atan2(B.y - A.y, B.x - A.x);
        const { bin, rest } = angleBin(th, TAU, LINK_BINS);
        // each plate is placed by its own mid-plane, so the turn left over is exact there
        const sm = BINS.placeBy[outer ? "outer" : "inner"], ym = (A.y + B.y) / 2;
        const opacity = alpha < 1 ? alpha : 1;
        put(`cf${i}`, gap(em - s0, 0.2), { href: linkDrawing(outer ? "outerFar" : "innerFar", bin), transform: place(rest, [xm, ym], -sm, em - sm), opacity, part: "chain" });
        put(`cn${i}`, gap(em + s0, 0.6), { href: linkDrawing(outer ? "outerNear" : "innerNear", bin), transform: place(rest, [xm, ym], sm, em + sm), opacity, part: "chain" });
      }
      const w = (x) => S(x.x, x.y, x.e);
      at.chain = w(pins.find((x) => x.q.on === "cog" && x.q.f > 0.35 && x.q.f < 0.65) ?? pins[0]);
      at.chainUpper = w(pins.find((x) => x.q.on === "run0" && x.x > 30 && x.x < 80) ?? pins[0]);
      at.chainLower = w(pins.find((x) => x.q.on === "run3" && x.x > 30 && x.x < 90) ?? pins[0]);
      // the run from the cog the chain is on down to the guide pulley: at an angle while they differ
      at.run1a = S(path.runs[1].p0[0], path.runs[1].p0[1], p.chainE);
      at.run1b = S(path.runs[1].p1[0], path.runs[1].p1[1], eG);
    }
    at.cassette = S(0, M.Rk[M.last] + 3, -M.zMax * 0.55);
    at.cog = S(M.Rk[eng] * Math.cos(2.2), M.Rk[eng] * Math.sin(2.2), cogE[eng]);

    // ---- live: the links (they turn on tilted pins), the return spring, the screws, the cable
    // the live parts follow the travel to a quarter of a millimetre (a third of a pixel), so a
    // shift rebuilds them a few times rather than every frame
    const zq = Math.round(p.z * 4) / 4;
    const g3 = M.guide3(zq), PK = add(g3, off), linkDir = unit(sub(PK, BK));
    const links = [
      { id: "linkOut", B: add(BK, scale(qOff, -1)), P: add(PK, scale(qOff, -1)) },
      { id: "linkIn", B: add(BK, qOff), P: add(PK, qOff) },
    ];
    const cut = !!st.show?.cutaway;
    for (const lk of links) {
      live(lk.id, "links", out((lk.B[2] + lk.P[2]) / 2 + (lk.id === "linkOut" ? 4 : -4)), memo(lk.id, `${zq}|${cut}`, () => {
        const len = Math.hypot(...sub(lk.P, lk.B));
        const pl = planeOf(k3(lk.B), k3(qOff), k3(linkDir));
        const bar = (a0, a1) => plate(pl, { outer: roundedHull([[a0, 0, 5.2], [a1, 0, 5.2]], 16) }, -1.5, 1.5);
        const meshes = cut && lk.id === "linkOut" ? [bar(0, 6), bar(len - 6, len)] : [bar(0, len)];
        let s = meshes.map((m) => contactShadow(m, cam, shadowAway) + drawMesh(m, cam, { material: "slate", shine: true })).join("");
        for (const end of [lk.B, lk.P]) s += drawMesh(rod(k3(add(end, scale(pinAxis, -5))), k3(add(end, scale(pinAxis, 5))), 2.2, 16), cam, { material: "alloy", shine: true });
        return s;
      }));
    }
    at.links = screenOf(cam, k3(scale(add(links[0].B, links[0].P), 0.5)), ax);
    {
      const a = add(links[1].B, scale(linkDir, 3)), b = add(links[0].P, scale(linkDir, -3));
      const axis = unit(sub(b, a)), Ls = Math.hypot(...sub(b, a));
      live("rspring", "rspring", cut ? out((links[0].B[2] + links[0].P[2]) / 2 + 4.5) : out((a[2] + b[2]) / 2), memo("rspring", `${zq}|${cut}`, () => {
        const pl = planeOf(k3(a), k3(axis), k3(pinAxis));
        const turns = 13, r = 3.4, back = [], front = [];
        let run = [], near = null;
        for (let i = 0; i <= turns * 18; i++) {
          const t = (i / (turns * 18)) * TAU * turns, s = (Ls * i) / (turns * 18);
          const radial = add(scale(pl.u, Math.cos(t)), scale(pl.v, Math.sin(t)));
          const q = screenOf(cam, add(add(k3(a), scale(k3(axis), s)), scale(radial, r)), ax), facing = dot(radial, ax.toward) > 0;
          if (near !== null && facing !== near) {
            run.push(q);
            (near ? front : back).push(pathThrough(run, false));
            run = [q];
          } else run.push(q);
          near = facing;
        }
        if (run.length > 1) (near ? front : back).push(pathThrough(run, false));
        return `<path class="spring back" d="${back.join("")}"/><path class="spring" d="${front.join("")}"/>`;
      }));
      at.rspring = screenOf(cam, k3(add(a, scale(axis, Ls * 0.55))), ax);
    }
    // the H and L screws: a touched screw is marked; a backed-out one stands proud
    const lOut = st.lOut ?? 0;
    const hTouch = p.z <= 1e-6, lTouch = p.z >= M.zMax - 1e-6 + lOut && p.z > M.zMax - 1e-6;
    for (const [name, sx, sy, o2, touch] of [["H", BK[0] - 9, BK[1] + 4, 0, hTouch], ["L", BK[0] - 3, BK[1] - 7, lOut, lTouch]]) {
      live(`screw${name}`, "bknuckle", out(BK[2] + 6.5), memo(`screw${name}`, `${o2}`, () => {
        const h = topE + 0.3 + o2 * 0.9;
        let s = o2 > 0 ? drawMesh(lateralTurned(sx, sy, topE, h, [[0, 1.6], [h - topE, 1.6]], 14), cam, { material: "alloy" }) : "";
        s += drawMesh(lateralTurned(sx, sy, h, h + 2.6, [[0, 3.1], [2.1, 3.1], [2.6, 2.6]], 24), cam, { material: "alloy", shine: true });
        s += linesOn(cam, [[W(sx - 2.4, sy - 0.8, h + 2.6), W(sx + 2.4, sy + 0.8, h + 2.6)]]);
        const lab = S(sx + 5.2 * Math.cos(name === "H" ? 2.4 : 3.6), sy + 5.2 * Math.sin(name === "H" ? 2.4 : 3.6), topE);
        return s + `<text class="engrave" x="${lab[0].toFixed(1)}" y="${lab[1].toFixed(1)}" text-anchor="middle">${name}</text>`;
      }));
      items[items.length - 1].flags = { touch: touch && !!st.show?.screws };
      at[name === "H" ? "hscrew" : "lscrew"] = S(sx, sy, topE + 2.8 + o2 * 0.9);
    }
    // the barrel (its knurl turns), the inner cable and its anchor on the outer link
    {
      const { barrelA, dirB } = barrel;
      const turnB = Math.round(((st.barrel ?? 0) % 1) * 88) / 88;
      live("barrel", "cable", out(BK[2] + 14.5), memo("barrel", turnB.toFixed(3), () => {
        const knurl = turned(k3(barrelA), k3(dirB), [[0, 4.3], [12, 4.3]], 30);
        const ribs = Array.from({ length: 22 }, (_, i) => turnB * TAU + (TAU * i) / 22).map((t) => {
          const pl = planeOf(k3(barrelA), k3(dirB), [0, 0, 1]);
          const radial = add(scale(pl.u, Math.cos(t)), scale(pl.v, Math.sin(t)));
          return dot(radial, ax.toward) > 0.15 ? [add(k3(barrelA), add(scale(k3(dirB), 1.2), scale(radial, 4.35))), add(k3(barrelA), add(scale(k3(dirB), 10.8), scale(radial, 4.35)))] : null;
        }).filter(Boolean);
        return drawMesh(knurl, cam, { material: "alloy", shine: true }) + linesOn(cam, ribs) + drawMesh(turned(k3(add(barrelA, scale(dirB, 12))), k3(dirB), [[0, 3.2], [2.6, 3.2]], 20), cam, { material: "slate" });
      }));
      const anchor = add(scale(add(links[0].B, links[0].P), 0.5), add(scale(linkDir, 6), scale(unit(qOff), -1.8)));
      live("wire", "cable", out(BK[2] + 14.2), memo("wire", `${zq}`, () => `<path class="cable" d="${pathThrough([screenOf(cam, k3(barrelA), ax), screenOf(cam, k3(anchor), ax)], false)}"/>` + drawMesh(turned(k3(add(anchor, scale(unit(qOff), -3))), k3(unit(qOff)), [[0, 3.4], [3, 3.4]], 6), cam, { material: "alloy", shine: true })));
      at.cable = screenOf(cam, k3(add(scale(barrelA, 0.45), scale(anchor, 0.55))), ax);
    }
    Object.assign(at, anchorsStatic);
    at.spokes = S(-40, 70, -M.zMax - 10);

    // ---- forces on the cage: the spring turns it back, the chain pulls it forward
    if (st.show?.forces) {
      const r0 = 27, arc = [];
      for (let i = 0; i <= 24; i++) {
        const a = al + 0.75 - (1.25 * i) / 24;
        arc.push(S(gx + r0 * Math.cos(a), gy + r0 * Math.sin(a), eG + 9));
      }
      const tip = arc[arc.length - 1], prev = arc[arc.length - 3], dl = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
      let s = `<path class="force spring-f" d="${pathThrough(arc, false)}"/><path class="force-head spring-f" d="${arrowHead(tip, [(tip[0] - prev[0]) / dl, (tip[1] - prev[1]) / dl], 120)}"/>`;
      const Fc = p.chainForce, fl = Math.hypot(Fc[0], Fc[1]) || 1;
      const a = S(tx, ty, eG + 3), b = S(tx + (Fc[0] / fl) * 44, ty + (Fc[1] / fl) * 44, eG + 3), l2 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      s += `<path class="force chain-f" d="${pathThrough([a, b], false)}"/><path class="force-head chain-f" d="${arrowHead(b, [(b[0] - a[0]) / l2, (b[1] - a[1]) / l2], 120)}"/>`;
      live("forces", "forces", out(eG + 12), s);
      at.springForce = arc[12];
      at.chainForce = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    // ---- off line: under the guide pulley, a red tick on the pulley's plane and an arrow from it toward
    // its cog's line, labelled with the model's offset. A real offset (1 to 4 mm) would be a pixel or
    // two here, so the arrow is drawn OFF_ARROW mm long whatever the offset: it shows which way; the
    // number, exact, says how far.
    if (st.show?.offline && Math.abs(p.off) > 0.05) {
      const ea = -M.cogZ(p.cog), dir = Math.sign(ea - eG), y = gy - M.r - D.tipAdd - 7;
      const t0 = S(gx, y + 3.2, eG), t1 = S(gx, y - 3.2, eG), a = S(gx, y, eG), b = S(gx, y, eG + dir * OFF_ARROW);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const text = `${Math.abs(p.off).toFixed(2)} mm ${p.off > 0 ? "inboard" : "outboard"}`;
      const tx2 = b[0] + u[0] * 60, anchor = u[0] >= 0 ? "start" : "end";
      live("offline", "guide", 1e6, `<g class="offline-mark" data-off="${p.off.toFixed(4)}" data-len="${len.toFixed(1)}"><path class="offline-halo" d="${pathThrough([t0, t1], false)}M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}"/><path class="offline" d="${pathThrough([t0, t1], false)}"/><path class="offline" d="${pathThrough([a, [b[0] - u[0] * 70, b[1] - u[1] * 70]], false)}"/><path class="offline-head" d="${arrowHead(b, u, 110)}"/><text class="offline-text" x="${tx2.toFixed(1)}" y="${(b[1] + 50).toFixed(1)}" text-anchor="${anchor}">${text}</text></g>`);
      at.offline = a;
    }
    // drawings needed for the first time this frame
    const fresh = [];
    for (const [, d] of defs) if (!d.sent) (fresh.push(d.svg), (d.sent = true));
    return { items, at, defs: fresh };
  }
  return { parts, pose };
}
