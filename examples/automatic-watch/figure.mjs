// Automatic mechanical watch movement on Visualize's rig (src/rig/mech.ts):
// Museum-grade 6-layer exploded horological calibre inside a cutaway brushed-steel watch case:
//   Layer 0: Cutaway steel case (hatched section faces, 3 o'clock fluted crown) + compact stepped
//            mainplate with 6 recessed gold-chaton synthetic ruby lower bearings
//   Layer 1: Open-top mainspring barrel (coiled blued-steel spiral ribbon + slipping bridle) and
//            4-stage brass-and-steel going train laid out by meshCentres() & verified by assertMeshed()
//   Layer 2: 3D Swiss lever escapement (15-tooth club-tooth escape wheel, steel pallet fork with
//            twin ruby stones & banking pins, balance roller with ruby impulse jewel) + poised
//            balance wheel with 6 rim weights & breathing blued-steel hairspring
//   Layer 3: Sculpted chamfered rhodium bridges (train bridge, barrel bridge, escape cock, balance
//            cock) with flush ruby jewels, lifted heat-blued slotted screws & micron regulator index
//   Layer 4: Bidirectional automatic winding train (rotor pinion, twin reversing click wheels,
//            barrel ratchet) — exact pitch-circle tangency verified by assertMeshed()
//   Layer 5: Skeletonized steel-and-graphite ball-bearing oscillating rotor
//
// Dashed vertical centreLines() connect every arbor, jewel hole and screw axis across the exploded
// gaps. Every stationary assembly is drawn once and placed by pure translation; every turning gear,
// rotor, fork, roller, balance and pointer uses turningPart() with worst error strictly < 0.45 px.

import {
  add, arbor, arcOutline, assertMeshed, axesOf, bridge, centreLines, chamferPlate, circlePoints,
  cutawayShell, drawAssembly, drawMesh, drawOrdered, drawPart, drawSpiralRibbon, escapeWheelOutline,
  explodedStack, facingCamera, fitCamera, gearProfile, keyLight, linesOn, meshCentres, meshPhase,
  moveInPlane, pathThrough, pinion, planeOf, plate, plateShadow, readableTeeth, RigStage, rod,
  roundedHull, scale, screenOf, screw, spokedHoles, spokedWheel, stepOf, turned, turningPart,
} from "../../src/rig/index.ts";
export { RigStage, screenOf, assertMeshed, readableTeeth } from "../../src/rig/index.ts";

// Three-quarter watchmaker's exploded elevation: generous top-to-side contrast and open front axis
export const VIEW = { azimuth: 232, elevation: 30 };
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const FLOOR = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
const FLOOR_AXES = { origin: [0, 0, 0], u: FLOOR.u, v: FLOOR.v, n: FLOOR.n };

function circleIntersect(ax, ay, ra, bx, by, rb, side = 1) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  const a = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - a * a));
  const mx = ax + (a * dx) / d, my = ay + (a * dy) / d;
  return [mx - (side * h * dy) / d, my + (side * h * dx) / d];
}

// ---------------------------------------------------------------- exact gear train layout
// Modules chosen so every tooth pitch is >= 11 px on screen (well above readableTeeth 8 px bar)
// and every meshing pair satisfies assertMeshed() to machine precision.
const M_BARREL = 0.46; // barrel (32T) <-> centerPin (8T)
const M_G1 = 0.42;     // center (30T) <-> thirdPin (8T)
const M_G2 = 0.40;     // third (28T)  <-> fourthPin (8T)
const M_G3 = 0.38;     // fourth (28T) <-> escapePin (7T)
const M_WIND = 0.42;   // rotorPin (18T) <-> revB (14T) <-> revA (14T) <-> ratchet (20T)

const GOING_STAGES = [
  { driver: { teeth: 30, pitchR: 15 * M_G1 }, driven: { teeth: 8, pitchR: 4 * M_G1 }, angle: 20 * RAD },
  { driver: { teeth: 28, pitchR: 14 * M_G2 }, driven: { teeth: 8, pitchR: 4 * M_G2 }, angle: -60 * RAD },
  { driver: { teeth: 28, pitchR: 14 * M_G3 }, driven: { teeth: 7, pitchR: 3.5 * M_G3 }, angle: -132 * RAD },
];
const GOING = meshCentres([0, 0], GOING_STAGES, 0.08);
const BARREL_CHAIN = meshCentres(
  [0, 0],
  [{ driver: { teeth: 8, pitchR: 4 * M_BARREL }, driven: { teeth: 32, pitchR: 16 * M_BARREL }, angle: 135 * RAD }],
  GOING[0].rot,
);

const BARREL_AT = BARREL_CHAIN[1].at;
const CENTER_AT = GOING[0].at;
const THIRD_AT = GOING[1].at;
const FOURTH_AT = GOING[2].at;
const ESCAPE_AT = GOING[3].at;

// Straight-line Swiss lever escapement axis: escape <-> pallet fork <-> balance roller & wheel
const FORK_AT = [0.5, -10.55];
const FE_DX = ESCAPE_AT[0] - FORK_AT[0], FE_DY = ESCAPE_AT[1] - FORK_AT[1];
const FE_DIST = Math.hypot(FE_DX, FE_DY); // 6.50
const FORK_BASE_ANG = Math.atan2(FE_DY, FE_DX); // ~ +18.9 deg (fork anchor points to escape)
const BALANCE_DIST = 7.4;
const BALANCE_AT = [
  FORK_AT[0] - (FE_DX / FE_DIST) * BALANCE_DIST,
  FORK_AT[1] - (FE_DY / FE_DIST) * BALANCE_DIST,
]; // (-6.50, -12.94) — right in the open front-center!

// Coplanar automatic winding train: rotorPin <-> revB <-> revA <-> barrel ratchet
const ROTOR_PIN_T = 18, ROTOR_PIN_R = (ROTOR_PIN_T * M_WIND) / 2; // 3.78
const REV_T = 14, REV_R = (REV_T * M_WIND) / 2;                   // 2.94
const RATCHET_T = 20, RATCHET_R = (RATCHET_T * M_WIND) / 2;       // 4.20
const REV_B_CHAIN = meshCentres(
  CENTER_AT,
  [{ driver: { teeth: ROTOR_PIN_T, pitchR: ROTOR_PIN_R }, driven: { teeth: REV_T, pitchR: REV_R }, angle: 74 * RAD }],
  0.04,
);
const REV_B_AT = REV_B_CHAIN[1].at;
const REV_A_AT = circleIntersect(REV_B_AT[0], REV_B_AT[1], REV_R + REV_R, BARREL_AT[0], BARREL_AT[1], RATCHET_R + REV_R, -1);
const REV_A_ROT = meshPhase({ at: REV_B_AT, teeth: REV_T, rot: REV_B_CHAIN[1].rot }, { at: REV_A_AT, teeth: REV_T });
const RATCHET_ROT = meshPhase({ at: REV_A_AT, teeth: REV_T, rot: REV_A_ROT }, { at: BARREL_AT, teeth: RATCHET_T });

// Bridge mounting screw positions (well inside plateR = 21.4 and clear of all moving wheels)
const SCREW_TRAIN = [13.6, 4.2];
const SCREW_BARREL = [-13.4, 11.4];
const SCREW_ESC = [12.4, -12.8];
const SCREW_BAL = [-14.4, -4.6]; // sits BEHIND-LEFT of balance wheel, never hiding it!

export const CAL = {
  plateR: 21.4,
  caseR: 23.8,
  caseWall: 1.7,
  barrel:  { x: BARREL_AT[0], y: BARREL_AT[1], teeth: 32, r: 16 * M_BARREL, rot0: BARREL_CHAIN[1].rot, speed: BARREL_CHAIN[1].speed, rRatchet: RATCHET_R, ratchetT: RATCHET_T, ratchetRot0: RATCHET_ROT },
  center:  { x: CENTER_AT[0], y: CENTER_AT[1], teeth: 30, r: 15 * M_G1, pinT: 8, pinR: 4 * M_BARREL, rotorPinT: ROTOR_PIN_T, rotorPinR: ROTOR_PIN_R, rot0: GOING[0].rot, speed: GOING[0].speed },
  third:   { x: THIRD_AT[0], y: THIRD_AT[1], teeth: 28, r: 14 * M_G2, pinT: 8, pinR: 4 * M_G1, rot0: GOING[1].rot, speed: GOING[1].speed },
  fourth:  { x: FOURTH_AT[0], y: FOURTH_AT[1], teeth: 28, r: 14 * M_G3, pinT: 8, pinR: 4 * M_G2, rot0: GOING[2].rot, speed: GOING[2].speed },
  escape:  { x: ESCAPE_AT[0], y: ESCAPE_AT[1], teeth: 15, r: 4.85, rRoot: 3.30, pinT: 7, pinR: 3.5 * M_G3, rot0: GOING[3].rot, speed: GOING[3].speed },
  fork:    { x: FORK_AT[0], y: FORK_AT[1], baseAng: FORK_BASE_ANG, feDist: FE_DIST, balDist: BALANCE_DIST },
  balance: { x: BALANCE_AT[0], y: BALANCE_AT[1], r: 6.5, rollerR: 2.35 },
  revB:    { x: REV_B_AT[0], y: REV_B_AT[1], teeth: REV_T, r: REV_R, rot0: REV_B_CHAIN[1].rot },
  revA:    { x: REV_A_AT[0], y: REV_A_AT[1], teeth: REV_T, r: REV_R, rot0: REV_A_ROT },
  rotor:   { x: 0, y: 0, rIn: 14.2, rOut: 21.4 },
  screws:  { train: SCREW_TRAIN, barrel: SCREW_BARREL, esc: SCREW_ESC, bal: SCREW_BAL },
};

// Every meshing gear pair — exported so figure.test.mjs & model.test.mjs assert exact tangency
export const GEAR_PAIRS = [
  { name: "barrel <-> centerPin", a: { at: BARREL_AT, teeth: CAL.barrel.teeth, pitchR: CAL.barrel.r }, b: { at: CENTER_AT, teeth: CAL.center.pinT, pitchR: CAL.center.pinR } },
  { name: "center <-> thirdPin", a: { at: CENTER_AT, teeth: CAL.center.teeth, pitchR: CAL.center.r }, b: { at: THIRD_AT, teeth: CAL.third.pinT, pitchR: CAL.third.pinR } },
  { name: "third <-> fourthPin", a: { at: THIRD_AT, teeth: CAL.third.teeth, pitchR: CAL.third.r }, b: { at: FOURTH_AT, teeth: CAL.fourth.pinT, pitchR: CAL.fourth.pinR } },
  { name: "fourth <-> escapePin", a: { at: FOURTH_AT, teeth: CAL.fourth.teeth, pitchR: CAL.fourth.r }, b: { at: ESCAPE_AT, teeth: CAL.escape.pinT, pitchR: CAL.escape.pinR } },
  { name: "rotorPin <-> revB", a: { at: CENTER_AT, teeth: CAL.center.rotorPinT, pitchR: CAL.center.rotorPinR }, b: { at: REV_B_AT, teeth: CAL.revB.teeth, pitchR: CAL.revB.r } },
  { name: "revB <-> revA", a: { at: REV_B_AT, teeth: CAL.revB.teeth, pitchR: CAL.revB.r }, b: { at: REV_A_AT, teeth: CAL.revA.teeth, pitchR: CAL.revA.r } },
  { name: "revA <-> ratchet", a: { at: REV_A_AT, teeth: CAL.revA.teeth, pitchR: CAL.revA.r }, b: { at: BARREL_AT, teeth: CAL.barrel.ratchetT, pitchR: CAL.barrel.rRatchet } },
];
for (const p of GEAR_PAIRS) assertMeshed(p.a, p.b, 1e-6);

// ---------------------------------------------------------------- exploded Z stack
// 6 functional watchmaker layers separated vertically along +z with dashed centreLines across gaps.
export const STACK_LAYERS = [
  { thickness: 2.6 }, // Layer 0: cutaway steel case + stepped mainplate
  { thickness: 4.6, axes: [BARREL_AT, CENTER_AT, THIRD_AT, FOURTH_AT, ESCAPE_AT] }, // Layer 1: barrel + 4-stage going train
  { thickness: 2.8, axes: [ESCAPE_AT, FORK_AT, BALANCE_AT] }, // Layer 2: Swiss lever escapement + balance + hairspring
  { thickness: 2.6, axes: [BARREL_AT, CENTER_AT, THIRD_AT, FOURTH_AT, ESCAPE_AT, BALANCE_AT, SCREW_TRAIN, SCREW_BARREL, SCREW_ESC, SCREW_BAL] }, // Layer 3: rhodium bridges + ruby jewels + screws + regulator
  { thickness: 1.6, axes: [CENTER_AT, BARREL_AT, REV_B_AT, REV_A_AT] }, // Layer 4: bidirectional automatic winding train
  { thickness: 2.6, axes: [CENTER_AT] }, // Layer 5: ball-bearing oscillating rotor
];
export const BASE_EXPLODE = 0.88;
export const STACK_SPREAD = 5.4;

export function stackFor(explode = BASE_EXPLODE) {
  return explodedStack(STACK_LAYERS, explode, { spread: STACK_SPREAD });
}

// 3 o'clock (screen-right) direction at azimuth 232 deg: right = (+0.788, -0.616)
const CROWN_ANG = Math.atan2(-0.616, 0.788);

export function cameraFor(box) {
  const st = stackFor(BASE_EXPLODE);
  const zTop = st.bases[5] + STACK_LAYERS[5].thickness + 1.2;
  const zBot = -1.6;
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (TAU * i) / 16;
    for (const z of [zBot, zTop]) pts.push([CAL.caseR * Math.cos(a), CAL.caseR * Math.sin(a), z]);
  }
  pts.push([Math.cos(CROWN_ANG) * (CAL.caseR + 4.4), Math.sin(CROWN_ANG) * (CAL.caseR + 4.4), 2.8]);
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/** Build the complete 6-layer exploded automatic watch figure on src/rig/mech.ts. */
export function figure(M, cam, opts = {}) {
  const px = opts.prefix ?? "aw";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const S = (x, y, z) => screenOf(cam, [x, y, z], ax);
  const NSTEP = stepOf(cam, [0, 0, 1], ax); // exact screen shift per +1 world z
  const zShift = (z) => `translate(${(NSTEP[0] * z).toFixed(2)} ${(NSTEP[1] * z).toFixed(2)})`;
  const pxPerUnit = cam.scale / 10; // ~10 SVG units per screen pixel at 1440x900

  const parts = [];
  const defs = new Map();
  const once = (id, part, svg) => parts.push({ id: `${px}-${id}`, part, svg });
  const tpl = (id, make) => {
    const full = `${px}-${id}`;
    if (!defs.has(full)) defs.set(full, { svg: `<g id="${full}">${make()}</g>`, sent: false });
    return `#${full}`;
  };
  const drainDefs = () => {
    const out = [];
    for (const d of defs.values()) if (!d.sent) ((d.sent = true), out.push(d.svg));
    return out;
  };
  const place = (theta, x, y, fromN, toN) => {
    const m = moveInPlane(cam, FLOOR_AXES, theta, [x, y], fromN, toN);
    return `matrix(${m.slice(0, 4).map((v) => +v.toFixed(6)).join(" ")} ${+m[4].toFixed(2)} ${+m[5].toFixed(2)})`;
  };
  const turningSpecs = [];
  const turning = (id, o) => {
    const t = turningPart(cam, FLOOR_AXES, { id, def: tpl, maxErrPx: 0.45, unitsPerPx: 10, ...o });
    turningSpecs.push({ id, bins: t.bins, worstErrPx: t.worstErrPx });
    return t;
  };
  const turnedAt = (t, theta, x, y, shift) => {
    const r = t.place(theta, [x, y], shift);
    return { href: r.href, transform: r.transform, turnErrPx: r.turnErrPx };
  };
  const shadowAway = scale(keyLight(ax), -1.1);

  // ================================================================ LAYER 0: Cutaway Case + Mainplate
  const shell = cutawayShell({
    r: CAL.caseR,
    h: 4.8,
    wall: CAL.caseWall,
    floor: 1.4,
    openAngle: 158 * RAD,
    facing: facingCamera(cam),
    material: "steel",
    hatch: true,
  });
  const mainplate = bridge({ outline: circlePoints(CAL.plateR, 56) }, 2.2, {
    at: [0, 0, 0.15],
    chamfer: 0.38,
    jewelHoles: [CENTER_AT, THIRD_AT, FOURTH_AT, ESCAPE_AT, FORK_AT, BALANCE_AT],
    jewelR: 0.92,
    fill: "jewels",
    material: "frame",
  });
  // Fluted 3 o'clock winding crown on the right case wall
  const cDir = [Math.cos(CROWN_ANG), Math.sin(CROWN_ANG), 0];
  const cBase = [Math.cos(CROWN_ANG) * (CAL.caseR - 0.6), Math.sin(CROWN_ANG) * (CAL.caseR - 0.6), 2.5];
  const crownTube = turned(cBase, cDir, [[0, 1.0], [1.6, 1.0]], 12);
  const crownHead = turned(add(cBase, scale(cDir, 1.3)), cDir, [
    [0, 2.3], [0.45, 2.9], [2.4, 2.9], [2.85, 2.3], [3.0, 1.3],
  ], 18);
  const crownGrooves = [];
  for (let i = 0; i < 12; i++) {
    const phi = (TAU * i) / 12;
    const u1 = [-cDir[1], cDir[0], 0], u2 = [0, 0, 1];
    const off = add(scale(u1, Math.cos(phi) * 2.93), scale(u2, Math.sin(phi) * 2.93));
    crownGrooves.push([
      add(add(cBase, scale(cDir, 1.75)), off),
      add(add(cBase, scale(cDir, 3.65)), off),
    ]);
  }
  const crownSvg = drawMesh(crownTube, cam, { material: "steel" })
    + drawMesh(crownHead, cam, { material: "alloy", shine: true })
    + linesOn(cam, crownGrooves, "rig-crease");

  // Subtle concentric perlage engine-turning lines on mainplate top face
  const perlage = [];
  for (const r of [9.5, 15.8, 19.8]) {
    const ring = circlePoints(r, 40);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      perlage.push([[a[0], a[1], 2.38], [b[0], b[1], 2.38]]);
    }
  }
  once("caseShell", "case", drawAssembly([shell], cam, { shadow: true }) + crownSvg);
  once("mainplate", "mainplate", drawAssembly([mainplate], cam, { shadow: false }) + linesOn(cam, perlage, "rig-deck-grid"));

  // ================================================================ LAYER 1: Barrel & Going Train
  // Local sub-heights inside Layer 1 (0 .. 4.6)
  const Z1 = {
    barrel: [0.25, 3.4],
    cPin: [0.35, 1.85],
    center: [2.25, 0.82],
    tPin: [1.65, 1.45],
    third: [3.15, 0.78],
    fPin: [2.80, 1.45],
    fourth: [1.30, 0.78],
    ePin: [0.95, 1.55],
  };

  // Stationary steel arbors for Layer 1 (with `inside` cutouts so they never fight wheels)
  const aBarrel = arbor(0.65, 4.5, { at: [BARREL_AT[0], BARREL_AT[1], 0], inside: [[Z1.barrel[0], Z1.barrel[0] + Z1.barrel[1]]], material: "steel" });
  const aCenter = arbor(0.50, 4.6, { at: [CENTER_AT[0], CENTER_AT[1], 0], inside: [[Z1.cPin[0], Z1.cPin[0] + Z1.cPin[1]], [Z1.center[0], Z1.center[0] + Z1.center[1] * 1.65]], material: "steel" });
  const aThird = arbor(0.42, 4.6, { at: [THIRD_AT[0], THIRD_AT[1], 0], inside: [[Z1.tPin[0], Z1.tPin[0] + Z1.tPin[1]], [Z1.third[0], Z1.third[0] + Z1.third[1] * 1.65]], material: "steel" });
  const aFourth = arbor(0.42, 4.6, { at: [FOURTH_AT[0], FOURTH_AT[1], 0], inside: [[Z1.fourth[0], Z1.fourth[0] + Z1.fourth[1] * 1.65], [Z1.fPin[0], Z1.fPin[0] + Z1.fPin[1]]], material: "steel" });
  const aEscL1 = arbor(0.36, 3.4, { at: [ESCAPE_AT[0], ESCAPE_AT[1], 0], inside: [[Z1.ePin[0], Z1.ePin[0] + Z1.ePin[1]]], material: "steel" });
  once("trainArbors", "mainplate", drawAssembly([aBarrel, aCenter, aThird, aFourth, aEscL1], cam, { shadow: false }));

  // Mainspring Barrel Drum (32 clock teeth, open top, recessed graphite floor, blued spiral ribbon, slipping bridle)
  const BARREL_H = Z1.barrel[1];
  const barrelFloorMesh = plate(FLOOR, {
    outer: circlePoints(CAL.barrel.r - 1.15, 32, BARREL_AT[0], BARREL_AT[1]),
    holes: [circlePoints(1.75, 14, BARREL_AT[0], BARREL_AT[1])],
  }, Z1.barrel[0], Z1.barrel[0] + 0.55);
  const barrelCoreMesh = turned([BARREL_AT[0], BARREL_AT[1], Z1.barrel[0] + 0.3], [0, 0, 1], [[0, 1.8], [BARREL_H - 0.5, 1.8], [BARREL_H - 0.2, 1.45]], 18);
  once("barrelBase", "barrel",
    drawMesh(barrelFloorMesh, cam, { material: "graphite" })
    + drawMesh(barrelCoreMesh, cam, { material: "steel", shine: true }),
  );
  const barrelTurn = turning("barrel", {
    period: TAU / CAL.barrel.teeth,
    n0: 0,
    n1: BARREL_H,
    minBins: 2,
    draw: (rot) => {
      const outer = gearProfile(CAL.barrel.teeth, CAL.barrel.r, { form: "clock", kind: "wheel", rot });
      const drum = plate(FLOOR, { outer, holes: [circlePoints(CAL.barrel.r - 1.25, 36)] }, 0, BARREL_H);
      return drawOrdered(drum, cam, { material: "brass", shine: true, crease: 52 });
    },
  });
  barrelTurn.drawAll();

  // Coiled blued-steel mainspring ribbon (9 discrete wind states, drawn face-by-face)
  const mainspringTpl = (level) => tpl(`mspr-${level}`, () => {
    const f = level / 8;
    const turns = 3.1 + f * 2.1;
    const r0 = 2.65 - f * 0.72;
    const r1 = CAL.barrel.r - 1.95;
    return drawSpiralRibbon(
      cam, FLOOR,
      { r0, r1, turns, t0: 0.6, t1: BARREL_H - 0.25, thick: 0.17, steps: 84, phase: 0.35 },
      { material: "blued", shine: true, crease: 40 },
    );
  });
  for (let i = 0; i <= 8; i++) mainspringTpl(i);

  // Slipping bridle lining the front-facing inner barrel wall (steel normally, subject orange when slipping!)
  const bridleTpl = (slipping) => tpl(`bridle-${slipping ? 1 : 0}`, () => {
    const arc = arcOutline(CAL.barrel.r - 1.90, CAL.barrel.r - 1.26, -2.75, -0.45, 24);
    const mesh = plate(FLOOR, { outer: arc }, 0.55, BARREL_H + 0.15);
    return drawOrdered(mesh, cam, { material: slipping ? "subject" : "steel", shine: true, crease: 45 });
  });
  bridleTpl(0);
  bridleTpl(1);

  // Going train wheels & pinions built via src/rig/mech.ts spokedWheel() & pinion()
  const makeWheel = (id, teeth, pitchR, th, opts = {}) => {
    const spokes = opts.spokes ?? 5;
    const period = spokes > 0 ? TAU / spokes : TAU / teeth;
    const colH = opts.colletH ?? th * 0.65;
    const t = turning(id, {
      period,
      n0: 0,
      n1: th + colH,
      minBins: opts.minBins ?? 6,
      draw: (rot) => drawPart(spokedWheel(teeth, pitchR, th, {
        rot, spokes, colletH: colH, material: opts.material ?? "brass", colletMaterial: "steel", pxPerUnit,
      }), cam, { shadow: false }),
    });
    t.drawAll();
    return t;
  };
  const makePinion = (id, leaves, pitchR, len, opts = {}) => {
    const t = turning(id, {
      period: TAU / leaves,
      n0: 0,
      n1: len,
      minBins: 2,
      draw: (rot) => drawPart(pinion(leaves, pitchR, len, { rot, material: opts.material ?? "steel", pxPerUnit }), cam, { shadow: false }),
    });
    t.drawAll();
    return t;
  };

  const cPinTurn = makePinion("cpin", CAL.center.pinT, CAL.center.pinR, Z1.cPin[1]);
  const centerTurn = makeWheel("center", CAL.center.teeth, CAL.center.r, Z1.center[1], { spokes: 5, material: "brass", minBins: 8 });
  const tPinTurn = makePinion("tpin", CAL.third.pinT, CAL.third.pinR, Z1.tPin[1]);
  const thirdTurn = makeWheel("third", CAL.third.teeth, CAL.third.r, Z1.third[1], { spokes: 5, material: "gilt", minBins: 8 });
  const fPinTurn = makePinion("fpin", CAL.fourth.pinT, CAL.fourth.pinR, Z1.fPin[1]);
  const fourthTurn = makeWheel("fourth", CAL.fourth.teeth, CAL.fourth.r, Z1.fourth[1], { spokes: 4, material: "brass", minBins: 8 });
  const ePinTurn = makePinion("epin", CAL.escape.pinT, CAL.escape.pinR, Z1.ePin[1]);

  // Delicate heat-blued sweep second hand coaxially mounted on the fourth-wheel collet
  const secondHandTurn = turning("shand", {
    n0: 0,
    n1: 0.4,
    minBins: 24,
    draw: (a) => {
      const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
      const L = CAL.fourth.r * 0.96, B = -1.7;
      const poly = [
        [c * B - nx * 0.34, s * B - ny * 0.34],
        [c * L - nx * 0.12, s * L - ny * 0.12],
        [c * L + nx * 0.12, s * L + ny * 0.12],
        [c * B + nx * 0.34, s * B + ny * 0.34],
      ];
      return drawMesh(plate(FLOOR, { outer: poly }, 0, 0.4), cam, { material: "blued", shine: true });
    },
  });
  secondHandTurn.drawAll();

  // ================================================================ LAYER 2: Escapement & Balance
  // 15-tooth Swiss club-tooth escape wheel (3 spokes -> 120 deg symmetry)
  const escTurn = turning("esc", {
    period: TAU / 3,
    n0: 0,
    n1: 1.05,
    minBins: 14,
    draw: (rot) => {
      const outer = escapeWheelOutline(CAL.escape.teeth, CAL.escape.r, CAL.escape.rRoot, rot);
      const holes = [circlePoints(0.8, 12), ...spokedHoles(1.3, CAL.escape.rRoot * 0.80, 3, 0.22, rot, 8)];
      const wheel = plate(FLOOR, { outer, holes }, 0, 0.85);
      const collet = turned([0, 0, 0.75], [0, 0, 1], [[0, 1.05], [0.3, 0.9]], 16);
      return drawOrdered(wheel, cam, { material: "gilt", shine: true, crease: 52 })
        + drawMesh(collet, cam, { material: "steel", shine: true });
    },
  });
  escTurn.drawAll();

  // Swiss Lever Pallet Fork with twin bold ruby stones (entry + exit) and U-shaped roller notch!
  const D_FE = CAL.fork.feDist; // 6.50
  const R_ESC = CAL.escape.r;   // 4.85
  const forkTurn = turning("fork", {
    n0: Math.min(0, shadowAway[2]),
    n1: 1.1,
    minBins: 72,
    draw: (a) => {
      const ang = FORK_BASE_ANG + a;
      const c = Math.cos(ang), s = Math.sin(ang);
      const rotP = ([x, y]) => [x * c - y * s, x * s + y * c];
      // Stone positions at exact 2.5 tooth pitches (+/- 150 deg around escape center)
      const stPt = (rf, deg) => [D_FE + R_ESC * rf * Math.cos(deg * RAD), R_ESC * rf * Math.sin(deg * RAD)];
      const entryStone = [stPt(0.95, 145), stPt(0.97, 154), stPt(1.17, 155), stPt(1.15, 146)].map(rotP);
      const exitStone = [stPt(0.97, -154), stPt(0.95, -145), stPt(1.15, -146), stPt(1.17, -155)].map(rotP);
      const armL = CAL.fork.balDist - CAL.balance.rollerR * 0.82; // 5.47 -> surrounds roller impulse jewel!
      const forkPoly = [
        [-armL - 0.5, -0.95], [-armL + 0.45, -1.25], [-armL + 0.45, -0.42],
        [-0.3, -0.48], [1.9, -2.55], [2.45, -2.15], [0.75, -0.55],
        [0.75, 0.55], [2.45, 2.15], [1.9, 2.55], [-0.3, 0.48],
        [-armL + 0.45, 0.42], [-armL + 0.45, 1.25], [-armL - 0.5, 0.95],
      ].map(rotP);
      const body = plate(FLOOR, { outer: forkPoly }, 0, 0.88);
      const boss = turned([0, 0, 0], [0, 0, 1], [[0, 0.92], [1.05, 0.92]], 16);
      return plateShadow(body, cam, shadowAway)
        + drawOrdered(body, cam, { material: "steel", shine: true, crease: 45 })
        + drawMesh(boss, cam, { material: "alloy", shine: true })
        + drawOrdered(plate(FLOOR, { outer: entryStone }, 0.08, 1.05), cam, { material: "ruby", shine: true })
        + drawOrdered(plate(FLOOR, { outer: exitStone }, 0.08, 1.05), cam, { material: "ruby", shine: true });
    },
  });
  forkTurn.drawAll(-7.5 * RAD - forkTurn.step, 7.5 * RAD + forkTurn.step);

  // Twin stationary steel banking pins limiting fork travel to +/- 6.5 deg
  const bpBase = -3.3;
  const bpSpread = 1.08;
  const cf = Math.cos(FORK_BASE_ANG), sf = Math.sin(FORK_BASE_ANG);
  const bankingPinsSvg = [-1, 1].map((side) => {
    const bx = FORK_AT[0] + bpBase * cf - side * bpSpread * sf;
    const by = FORK_AT[1] + bpBase * sf + side * bpSpread * cf;
    return drawMesh(turned([bx, by, 0], [0, 0, 1], [[0, 0.34], [1.25, 0.34]], 10), cam, { material: "graphite", shine: true });
  }).join("");
  once("bankingPins", "fork", bankingPinsSvg);

  // Coaxial Balance Roller + Ruby Impulse Jewel (sits right beneath balance wheel, engages fork notch!)
  const rollerTurn = turning("roller", {
    n0: 0,
    n1: 0.95,
    minBins: 24,
    draw: (a) => {
      const disc = turned([0, 0, 0.05], [0, 0, 1], [[0, CAL.balance.rollerR], [0.55, CAL.balance.rollerR]], 24);
      const jAng = FORK_BASE_ANG + a;
      const jr = CAL.balance.rollerR * 0.84;
      const pin = turned([Math.cos(jAng) * jr, Math.sin(jAng) * jr, 0.0], [0, 0, 1], [[0, 0.44], [0.92, 0.44]], 12);
      return drawMesh(disc, cam, { material: "steel", shine: true })
        + drawMesh(pin, cam, { material: "ruby", shine: true });
    },
  });
  rollerTurn.drawAll();

  // Poised Balance Wheel (3 spokes, 6 machined timing screws -> 120 deg symmetry)
  const balTurn = turning("bal", {
    period: TAU / 3,
    n0: 0,
    n1: 1.05,
    minBins: 14,
    draw: (rot) => {
      const r = CAL.balance.r;
      const rim = plate(FLOOR, {
        outer: circlePoints(r, 44),
        holes: [circlePoints(1.15, 14), ...spokedHoles(1.75, r - 1.15, 3, 0.17, rot + 0.15, 12)],
      }, 0, 1.05);
      let weights = "";
      for (let i = 0; i < 6; i++) {
        const a = rot + (TAU * i) / 6;
        weights += drawMesh(turned([Math.cos(a) * (r + 0.24), Math.sin(a) * (r + 0.24), 0.15], [0, 0, 1], [[0, 0.44], [0.75, 0.44]], 10), cam, { material: "steel", shine: true });
      }
      return drawOrdered(rim, cam, { material: "brass", shine: true, crease: 52 }) + weights;
    },
  });
  balTurn.drawAll();

  // Breathing 3D blued-steel hairspring ribbon (9 breathing states, stationary center)
  const hairspringTpl = (bin) => tpl(`hspr-${bin}`, () => {
    const f = 0.88 + (bin / 8) * 0.24;
    return drawSpiralRibbon(
      cam, FLOOR,
      { r0: 1.2, r1: 4.55 * f, turns: 4.2, t0: 0, t1: 0.72, thick: 0.12, steps: 64, phase: 0.5 },
      { material: "blued", shine: true, crease: 40 },
    );
  });
  for (let i = 0; i <= 8; i++) hairspringTpl(i);

  // ================================================================ LAYER 3: Rhodium Bridges, Jewels, Screws & Regulator
  const trainBr = bridge({ points: [CENTER_AT, THIRD_AT, FOURTH_AT, SCREW_TRAIN], width: 4.5, boss: 2.9 }, 1.2, {
    chamfer: 0.28,
    jewelHoles: [CENTER_AT, THIRD_AT, FOURTH_AT],
    jewelR: 1.02,
    screwHoles: [SCREW_TRAIN],
    screwR: 1.10,
    fill: "jewels",
    material: "rhodium",
  });
  const barrelBr = bridge({ points: [BARREL_AT, SCREW_BARREL], width: 4.4, boss: 2.8 }, 1.2, {
    chamfer: 0.28,
    jewelHoles: [BARREL_AT],
    jewelR: 1.10,
    screwHoles: [SCREW_BARREL],
    screwR: 1.10,
    fill: "jewels",
    material: "rhodium",
  });
  const escCock = bridge({ points: [ESCAPE_AT, SCREW_ESC], width: 3.6, boss: 2.35 }, 1.05, {
    chamfer: 0.24,
    jewelHoles: [ESCAPE_AT],
    jewelR: 0.92,
    screwHoles: [SCREW_ESC],
    screwR: 1.02,
    fill: "jewels",
    material: "rhodium",
  });
  const balCock = bridge({ points: [BALANCE_AT, SCREW_BAL], width: 4.2, boss: 2.75 }, 1.15, {
    chamfer: 0.26,
    jewelHoles: [BALANCE_AT],
    jewelR: 1.18,
    screwHoles: [SCREW_BAL],
    screwR: 1.10,
    fill: "jewels",
    material: "rhodium",
  });

  // Lifted heat-blued watchmaker screws with real slots and shanks hovering above each bridge!
  const makeBlueScrew = (pt, r, slotAngle) => screw(r, { at: [pt[0], pt[1], 2.55], shank: 1.5, slotAngle, material: "blued" });
  once("trainBridge", "trainBridge", drawAssembly([trainBr, makeBlueScrew(SCREW_TRAIN, 1.10, 0.45)], cam, { shadow: true }));
  once("barrelBridge", "barrelBridge", drawAssembly([barrelBr, makeBlueScrew(SCREW_BARREL, 1.10, -0.6)], cam, { shadow: true }));
  once("escCock", "escCock", drawAssembly([escCock, makeBlueScrew(SCREW_ESC, 1.02, 1.1)], cam, { shadow: true }));
  once("balanceCock", "balanceCock", drawAssembly([balCock, makeBlueScrew(SCREW_BAL, 1.10, 0.7)], cam, { shadow: true }));

  // Micron Regulator Index Pointer Arm (subject orange, seated atop balance cock jewel!)
  const regTurn = turning("reg", {
    n0: -1.35,
    n1: 0.75,
    minBins: 72,
    draw: (a) => {
      const ang = a - 155 * RAD; // rests sweeping along the balance cock toward the outer scale
      const c = Math.cos(ang), s = Math.sin(ang);
      const rotP = ([x, y]) => [x * c - y * s, x * s + y * c];
      const arm = roundedHull([[0, 0, 1.05], [7.2, 0, 0.45]]).map(rotP);
      const pinX = 4.6 * c, pinY = 4.6 * s;
      return drawOrdered(plate(FLOOR, { outer: arm }, 0, 0.58), cam, { material: "subject", shine: true })
        + drawMesh(rod([pinX, pinY, -1.35], [pinX, pinY, 0.72], 0.28, 8), cam, { material: "brass", shine: true });
    },
  });
  regTurn.drawAll(-26 * RAD - regTurn.step, 26 * RAD + regTurn.step);

  // ================================================================ LAYER 4: Automatic Winding Train
  // Solid-web click/ratchet wheels (spokes: 0) match real automatic winding trains and keep <defs> lean.
  const rotorPinTurn = makeWheel("rpin", CAL.center.rotorPinT, CAL.center.rotorPinR, 0.88, { spokes: 0, material: "steel", minBins: 3 });
  const ratchetTurn = makeWheel("ratch", CAL.barrel.ratchetT, CAL.barrel.rRatchet, 0.88, { spokes: 0, material: "alloy", minBins: 3 });
  const revHotTurn = makeWheel("rev-hot", CAL.revA.teeth, CAL.revA.r, 0.92, { spokes: 0, material: "subject", minBins: 3 });
  const revIdleTurn = makeWheel("rev-idle", CAL.revA.teeth, CAL.revA.r, 0.92, { spokes: 0, material: "steel", minBins: 3 });

  // ================================================================ LAYER 5: Ball-Bearing Oscillating Rotor
  const rotorShadow = [shadowAway[0], shadowAway[1], 0];
  const rotorTurn = turning("rotor", {
    n0: 0,
    n1: 2.35,
    minBins: 36,
    draw: (rot) => {
      const span = Math.PI * 0.46;
      const lowerArc = arcOutline(CAL.rotor.rIn, CAL.rotor.rOut, rot - span, rot + span, 16);
      const weightArc = arcOutline(CAL.rotor.rIn + 1.1, CAL.rotor.rOut - 0.5, rot - span + 0.03, rot + span - 0.03, 16);
      const accentArc = arcOutline(CAL.rotor.rIn + 0.15, CAL.rotor.rIn + 1.05, rot - span + 0.06, rot + span - 0.06, 12);
      const lowerRim = plate(FLOOR, { outer: lowerArc }, 0, 1.15);
      const weightRim = plate(FLOOR, { outer: weightArc }, 1.15, 2.30);
      const accentRim = plate(FLOOR, { outer: accentArc }, 1.15, 1.95);
      const ribs = [];
      for (let i = -4; i <= 4; i++) {
        const a = rot + i * 0.27;
        ribs.push([
          [Math.cos(a) * (CAL.rotor.rIn + 1.5), Math.sin(a) * (CAL.rotor.rIn + 1.5), 2.33],
          [Math.cos(a) * (CAL.rotor.rOut - 0.9), Math.sin(a) * (CAL.rotor.rOut - 0.9), 2.33],
        ]);
      }
      let arms = "";
      for (const da of [-1.05, 0, 1.05]) {
        const a = rot + da;
        const p1 = [Math.cos(a) * (CAL.rotor.rIn + 0.9), Math.sin(a) * (CAL.rotor.rIn + 0.9)];
        arms += drawOrdered(plate(FLOOR, { outer: roundedHull([[0, 0, 2.5], [p1[0], p1[1], 1.05]]) }, 0.25, 1.1), cam, { material: "steel", shine: true });
      }
      return plateShadow(lowerRim, cam, rotorShadow)
        + arms
        + drawOrdered(lowerRim, cam, { material: "steel", shine: true, crease: 45 })
        + drawOrdered(weightRim, cam, { material: "graphite", shine: true, crease: 45 })
        + drawOrdered(accentRim, cam, { material: "subject", shine: true, crease: 45 })
        + linesOn(cam, ribs, "rig-crease");
    },
  });
  rotorTurn.drawAll();

  // Central 5-ball bearing hub on rotor axis
  const hubOuter = turned([0, 0, 0.2], [0, 0, 1], [[0, 3.0], [1.6, 3.0], [2.1, 2.45]], 24);
  const hubInner = turned([0, 0, 1.6], [0, 0, 1], [[0, 1.35], [0.75, 1.35]], 18);
  let balls = "";
  for (let i = 0; i < 5; i++) {
    const a = (TAU * i) / 5 + 0.3;
    balls += drawMesh(turned([Math.cos(a) * 2.0, Math.sin(a) * 2.0, 1.7], [0, 0, 1], [[0, 0.38], [0.45, 0.38]], 10), cam, { material: "alloy", shine: true });
  }
  once("rotorHub", "rotor",
    drawMesh(hubOuter, cam, { material: "steel", shine: true })
    + balls
    + drawMesh(hubInner, cam, { material: "ruby", shine: true }),
  );

  // Pre-build the dashed vertical centreLines per explode setting (cached so 60 fps costs 0!)
  const guidesCache = new Map();
  const guidesFor = (explode) => {
    const k = Math.round(explode * 1000);
    if (!guidesCache.has(k)) {
      const st = stackFor(explode);
      const svgs = st.guides.map((segs) => centreLines(cam, segs));
      // Add vertical screw centre lines from each bridge top up to its lifted blued screw
      const b3 = st.bases[3];
      const screwSegs = Object.values(CAL.screws).map(([x, y]) => [[x, y, b3 + 1.2], [x, y, b3 + 2.55]]);
      svgs[3] = (svgs[3] || "") + centreLines(cam, screwSegs);
      guidesCache.set(k, { st, svgs });
    }
    return guidesCache.get(k);
  };

  /** Compute one 60 fps frame for the exploded watch state. */
  function pose(st) {
    const {
      explode = BASE_EXPLODE,
      rotorDeg = 52,
      revDir = 1,
      ratchetDeg = 0,
      windPct = 78,
      slipping = false,
      centerDeg = 0,
      esc,
      regRateDeg = 0,
      useEscDrive = false,
    } = st;

    const { st: stack, svgs: guideSvgs } = guidesFor(explode);
    const [b0, b1, b2, b3, b4, b5] = stack.bases;
    const items = [];

    // ---- Layer 0: Cutaway case & compact stepped mainplate
    items.push({ id: `${px}-caseShell`, key: 2, transform: zShift(b0) });
    items.push({ id: `${px}-mainplate`, key: 4, transform: zShift(b0) });
    items.push({ id: `${px}-guide1`, part: "guides", key: 8, svg: guideSvgs[1] });

    // ---- Layer 1: Mainspring barrel & 4-stage going train (100% kinematically meshed!)
    // Either driven by exact escapement beats (Chapters 1, 2, 4) OR sped up smoothly by centerDeg (Chapter 3)
    const cRad = useEscDrive
      ? (esc.escapeDeg * RAD) / CAL.escape.speed
      : centerDeg * RAD;
    const barrelRad = CAL.barrel.rot0 + cRad * CAL.barrel.speed;
    const centerRad = CAL.center.rot0 + cRad * CAL.center.speed;
    const thirdRad = CAL.third.rot0 + cRad * CAL.third.speed;
    const fourthRad = CAL.fourth.rot0 + cRad * CAL.fourth.speed;
    const escPinRad = CAL.escape.rot0 + cRad * CAL.escape.speed;
    const escWheelRad = useEscDrive ? (esc.escapeDeg * RAD) : escPinRad;

    const windLevel = Math.max(0, Math.min(8, Math.round((windPct / 100) * 8)));
    items.push({ id: `${px}-trainArbors`, key: 10, transform: zShift(b1) });
    items.push({ id: `${px}-barrelBase`, key: 12, transform: zShift(b1) });
    items.push({
      id: `${px}-barrel`, part: "barrel", key: 14,
      ...turnedAt(barrelTurn, barrelRad, CAL.barrel.x, CAL.barrel.y, b1 + Z1.barrel[0]),
    });
    items.push({
      id: `${px}-mainspring`, part: "barrel", key: 15,
      href: mainspringTpl(windLevel),
      transform: place(0, CAL.barrel.x, CAL.barrel.y, 0, b1 + Z1.barrel[0]),
    });
    items.push({
      id: `${px}-bridle`, part: "bridle", key: 16,
      href: bridleTpl(slipping ? 1 : 0),
      transform: place(0, CAL.barrel.x, CAL.barrel.y, 0, b1 + Z1.barrel[0]),
    });

    items.push({ id: `${px}-cpin`, part: "center", key: 18, ...turnedAt(cPinTurn, centerRad, CAL.center.x, CAL.center.y, b1 + Z1.cPin[0]) });
    items.push({ id: `${px}-epin`, part: "escapePin", key: 19, ...turnedAt(ePinTurn, escPinRad, CAL.escape.x, CAL.escape.y, b1 + Z1.ePin[0]) });
    items.push({ id: `${px}-fourth`, part: "fourth", key: 20, ...turnedAt(fourthTurn, fourthRad, CAL.fourth.x, CAL.fourth.y, b1 + Z1.fourth[0]) });
    items.push({ id: `${px}-secondHand`, part: "fourth", key: 21, ...turnedAt(secondHandTurn, fourthRad, CAL.fourth.x, CAL.fourth.y, b1 + Z1.fourth[0] + Z1.fourth[1] + 0.55) });
    items.push({ id: `${px}-tpin`, part: "third", key: 22, ...turnedAt(tPinTurn, thirdRad, CAL.third.x, CAL.third.y, b1 + Z1.tPin[0]) });
    items.push({ id: `${px}-center`, part: "center", key: 24, ...turnedAt(centerTurn, centerRad, CAL.center.x, CAL.center.y, b1 + Z1.center[0]) });
    items.push({ id: `${px}-fpin`, part: "fourth", key: 25, ...turnedAt(fPinTurn, fourthRad, CAL.fourth.x, CAL.fourth.y, b1 + Z1.fPin[0]) });
    items.push({ id: `${px}-third`, part: "third", key: 26, ...turnedAt(thirdTurn, thirdRad, CAL.third.x, CAL.third.y, b1 + Z1.third[0]) });

    // ---- Layer 2: 3D Swiss Lever Escapement & Harmonic Oscillator
    items.push({ id: `${px}-guide2`, part: "guides", key: 30, svg: guideSvgs[2] });
    items.push({ id: `${px}-bankingPins`, key: 32, transform: zShift(b2) });
    items.push({ id: `${px}-escape`, part: "escape", key: 34, ...turnedAt(escTurn, escWheelRad, CAL.escape.x, CAL.escape.y, b2 + 0.25) });
    items.push({ id: `${px}-fork`, part: "fork", key: 36, ...turnedAt(forkTurn, esc.forkDeg * RAD, CAL.fork.x, CAL.fork.y, b2 + 0.28) });
    items.push({ id: `${px}-roller`, part: "roller", key: 37, ...turnedAt(rollerTurn, esc.balDeg * RAD, CAL.balance.x, CAL.balance.y, b2 + 0.20) });
    const breathBin = Math.max(0, Math.min(8, Math.round(((esc.breath - 0.88) / 0.24) * 8)));
    items.push({ id: `${px}-balance`, part: "balance", key: 39, ...turnedAt(balTurn, esc.balDeg * RAD, CAL.balance.x, CAL.balance.y, b2 + 1.15) });
    items.push({
      id: `${px}-hairspring`, part: "balance", key: 41,
      href: hairspringTpl(breathBin),
      transform: place(0, CAL.balance.x, CAL.balance.y, 0, b2 + 2.20),
    });

    // ---- Layer 3: Sculpted Rhodium Bridges, Ruby Jewels, Blued Screws & Regulator
    items.push({ id: `${px}-guide3`, part: "guides", key: 45, svg: guideSvgs[3] });
    items.push({ id: `${px}-barrelBridge`, key: 48, transform: zShift(b3) });
    items.push({ id: `${px}-trainBridge`, key: 50, transform: zShift(b3) });
    items.push({ id: `${px}-escCock`, key: 52, transform: zShift(b3) });
    items.push({ id: `${px}-balanceCock`, key: 54, transform: zShift(b3) });
    const rDeg = Math.max(-24, Math.min(24, regRateDeg ?? 0));
    items.push({ id: `${px}-regArm`, part: "regulator", key: 56, ...turnedAt(regTurn, rDeg * RAD, CAL.balance.x, CAL.balance.y, b3 + 1.55) });

    // ---- Layer 4: Automatic Winding Train (rotorPin <-> revB <-> revA <-> ratchet)
    items.push({ id: `${px}-guide4`, part: "guides", key: 60, svg: guideSvgs[4] });
    const rRad = rotorDeg * RAD;
    const revBRad = CAL.revB.rot0 - rRad * (CAL.center.rotorPinT / CAL.revB.teeth);
    const revARad = CAL.revA.rot0 + rRad * (CAL.center.rotorPinT / CAL.revA.teeth);
    const ratchetRad = CAL.barrel.ratchetRot0 - (ratchetDeg * RAD);
    items.push({ id: `${px}-rotorPin`, part: "reversing", key: 62, ...turnedAt(rotorPinTurn, 0.04 + rRad, CAL.center.x, CAL.center.y, b4) });
    items.push({ id: `${px}-ratchet`, part: "reversing", key: 63, ...turnedAt(ratchetTurn, ratchetRad, CAL.barrel.x, CAL.barrel.y, b4) });
    items.push({ id: `${px}-revB`, part: "reversing", key: 64, ...turnedAt(revDir < 0 ? revHotTurn : revIdleTurn, revBRad, CAL.revB.x, CAL.revB.y, b4) });
    items.push({ id: `${px}-revA`, part: "reversing", key: 65, ...turnedAt(revDir >= 0 ? revHotTurn : revIdleTurn, revARad, CAL.revA.x, CAL.revA.y, b4) });

    // ---- Layer 5: Ball-Bearing Oscillating Rotor
    items.push({ id: `${px}-guide5`, part: "guides", key: 70, svg: guideSvgs[5] });
    items.push({ id: `${px}-rotor`, part: "rotor", key: 74, ...turnedAt(rotorTurn, rRad, CAL.rotor.x, CAL.rotor.y, b5) });
    items.push({ id: `${px}-rotorHub`, key: 76, transform: zShift(b5) });

    // Live projected anchors for callout leaders (placed cleanly on outer exposed faces)
    const regAng = rDeg * RAD - 155 * RAD;
    const at = {
      rotor: S(Math.cos(rRad) * 18.5, Math.sin(rRad) * 18.5, b5 + 1.8),
      reversing: S(CAL.revA.x - 1.5, CAL.revA.y + 1.2, b4 + 0.9),
      trainBridge: S(CAL.third.x + 2.5, CAL.third.y + 1.2, b3 + 1.2),
      barrel: S(CAL.barrel.x - 5.5, CAL.barrel.y + 1.2, b1 + 2.6),
      bridle: S(CAL.barrel.x + 0.1, CAL.barrel.y - 5.75, b1 + 2.6),
      center: S(CAL.center.x - 5.45, CAL.center.y - 1.98, b1 + 2.8),
      third: S(CAL.third.x + 5.0, CAL.third.y, b1 + 3.7),
      fourth: S(CAL.fourth.x + 4.0, CAL.fourth.y - 1.5, b1 + 2.2),
      escape: S(CAL.escape.x + 3.2, CAL.escape.y - 1.8, b2 + 0.9),
      fork: S(CAL.fork.x + 0.2, CAL.fork.y - 1.2, b2 + 0.9),
      roller: S(CAL.balance.x + 1.4, CAL.balance.y + 0.4, b2 + 0.6),
      balance: S(CAL.balance.x - 4.8, CAL.balance.y - 3.0, b2 + 1.9),
      balanceCock: S(SCREW_BAL[0] + 1.5, SCREW_BAL[1], b3 + 1.1),
      regulator: S(CAL.balance.x + 3.6 * Math.cos(regAng), CAL.balance.y + 3.6 * Math.sin(regAng), b3 + 1.85),
      case: S(Math.cos(CROWN_ANG) * (CAL.caseR + 2.4), Math.sin(CROWN_ANG) * (CAL.caseR + 2.4), b0 + 2.5),
    };

    return { items, at, defs: drainDefs() };
  }

  return { parts, pose, turningSpecs, pxPerUnit };
}
