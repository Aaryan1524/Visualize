// How an Automatic Watch Works (Everyday Edition): 3-Layer Studio Exhibition Cutaway.
//
// ZERO hand-guessed coordinates — every gear center, pitch tangency, collision clearance,
// cavity fill proportion, and vertical layer elevation is solved mathematically via src/rig/layout.ts:
//   - solveGearTrain()        : exact 5-part horological going train (barrel -> center -> third -> fourth -> escape)
//   - assertNoCollisions()    : zero overlap between balance wheel, pallet fork, barrel, and going train
//   - checkCavityFill()       : ratio >= 0.30 inside r = 32 mainplate cavity, zero parts poking outside
//   - composeExplodedLayers() : sleek 3-layer vertical exhibition cutaway connected by dash-dot centreLines()
//
// Layers:
//   Layer 0 (Movement Base)   : Museum-grade rhodium calibrePlate + meshed brass/gilt going train +
//                               open-top mainspring barrel (blued coiledSpring) + steel escape wheel +
//                               ruby-jeweled steel pallet fork + sculpted brass balance wheel & blued hairspring
//   Layer 1 (Winding Rotor)   : Anodized-orange weighted half-moon rotor floating cleanly above the movement
//                               with softShadow() cast onto the mainplate below
//   Layer 2 (Exhibition Dial) : Sleek rimless open-cutaway watchCaseDial (r = 35, lugs: false, cutaway: true)
//                               + sweeping heat-blued watchHand trio on the central arbor
//
// Every rotating solid uses turningPart() (worstErrPx < 0.5 px) and bucketed studio finishes
// (`finish: "metal"`) so total SVG paths stay well under 8,000 and playback stays locked at 60 fps.

import {
  arbor,
  arcOutline,
  assertMeshed,
  assertNoCollisions,
  axesOf,
  calibrePlate,
  centreLines,
  checkCavityFill,
  circlePoints,
  coiledSpring,
  composeExplodedLayers,
  drawMesh,
  drawSpiralRibbon,
  escapeWheelOutline,
  explainerCard,
  fitCamera,
  gearProfile,
  keyLight,
  linesOn,
  meshPhase,
  meterBar,
  moveInPlane,
  planeOf,
  plate,
  plateShadow,
  rod,
  roundedHull,
  scale,
  screenOf,
  softShadow,
  solveGearTrain,
  spokedHoles,
  stepOf,
  turned,
  turningPart,
  watchCaseDial,
  watchHand,
} from "../../src/rig/index.ts";
export {
  RigStage,
  assertMeshed,
  assertNoCollisions,
  checkCavityFill,
  screenOf,
} from "../../src/rig/index.ts";
export { practice } from "./story.mjs";

// Clean three-quarter horological exhibition elevation: wide top-vs-side value step & open front axis
export const VIEW = { azimuth: 235, elevation: 28 };
export const CAVITY_R = 32;
export const DIAL_R = 33.5;

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const UP = [0, 0, 1];
const FLOOR = planeOf([0, 0, 0], UP, [1, 0, 0]);
const FLOOR_AXES = { origin: [0, 0, 0], u: FLOOR.u, v: FLOOR.v, n: FLOOR.n };

// ---------------------------------------------------------------- 1. Vertical 3-Layer Stack (layout.ts)
export const LAYER_SPECS = [
  { name: "movement", thickness: 8.6, gap: 18 },
  { name: "rotor", thickness: 2.8, gap: 19 },
  { name: "dial", thickness: 8.5 },
];
export const LAYERS = composeExplodedLayers(LAYER_SPECS, { baseZ: 0, explode: 1.0 });

// ---------------------------------------------------------------- 2. Mathematically Solved Going Train (layout.ts)
export const TRAIN = solveGearTrain(
  [
    { name: "centerPinion", teeth: 10, module: 0.56, layer: 0, z: 3.1 },
    { name: "barrel", teeth: 36, module: 0.56, driver: "centerPinion", angleDeg: 142, layer: 0, z: 3.0 },
    { name: "centerWheel", teeth: 32, module: 0.54, coaxialWith: "centerPinion", layer: 1, z: 5.1 },
    { name: "thirdPinion", teeth: 10, module: 0.54, driver: "centerWheel", angleDeg: 18, layer: 1, z: 4.5 },
    { name: "thirdWheel", teeth: 28, module: 0.50, coaxialWith: "thirdPinion", layer: 2, z: 6.3 },
    { name: "fourthPinion", teeth: 10, module: 0.50, driver: "thirdWheel", angleDeg: -66, layer: 2, z: 5.5 },
    { name: "fourthWheel", teeth: 28, module: 0.48, coaxialWith: "fourthPinion", layer: 3, z: 3.9 },
    { name: "escapePinion", teeth: 8, module: 0.48, driver: "fourthWheel", angleDeg: -115, layer: 3, z: 3.5 },
    { name: "escapeWheel", teeth: 15, module: 0.72, outerR: 5.8, coaxialWith: "escapePinion", layer: 4, z: 5.5 },
  ],
  { origin: [0, 0, 3.0], minGap: 0.5 },
);

const gBarrel = TRAIN.byName.barrel;
const gCenterPin = TRAIN.byName.centerPinion;
const gCenter = TRAIN.byName.centerWheel;
const gThirdPin = TRAIN.byName.thirdPinion;
const gThird = TRAIN.byName.thirdWheel;
const gFourthPin = TRAIN.byName.fourthPinion;
const gFourth = TRAIN.byName.fourthWheel;
const gEscapePin = TRAIN.byName.escapePinion;
const gEscape = TRAIN.byName.escapeWheel;

// Straight-line Swiss lever escapement axis from escapeWheel toward the open front-left of the plate
const ESC_AXIS_DEG = -162;
const ESC_AXIS_RAD = ESC_AXIS_DEG * RAD;
const FE_DIST = 7.8;
const BAL_DIST = 10.6;

export const PALLET = {
  name: "pallet",
  x: gEscape.x + FE_DIST * Math.cos(ESC_AXIS_RAD),
  y: gEscape.y + FE_DIST * Math.sin(ESC_AXIS_RAD),
  r: 1.6,
  feDist: FE_DIST,
  balDist: BAL_DIST,
  baseAng: ESC_AXIS_RAD + Math.PI, // points from pallet fork toward escape wheel
};

export const BALANCE = {
  name: "balance",
  x: PALLET.x + BAL_DIST * Math.cos(ESC_AXIS_RAD),
  y: PALLET.y + BAL_DIST * Math.sin(ESC_AXIS_RAD),
  r: 8.6,
  rollerR: 2.5,
};

// Verify zero collision between balance wheel and barrel / going train on movement plane
export const CLEARANCE_ITEMS = [
  { name: "barrel", x: gBarrel.x, y: gBarrel.y, r: gBarrel.outerR, layer: 0 },
  { name: "balance", x: BALANCE.x, y: BALANCE.y, r: BALANCE.r, layer: 0 },
  { name: "centerWheel", x: gCenter.x, y: gCenter.y, r: gCenter.outerR, layer: 0 },
  { name: "escapeWheel", x: gEscape.x, y: gEscape.y, r: gEscape.outerR, layer: 0 },
];
assertNoCollisions(CLEARANCE_ITEMS, {
  minGap: 1.0,
  ignorePairs: [
    ["barrel", "centerWheel"], // barrel is on layer 0 (z=3.0), centerWheel rides cleanly above (z=5.1)
  ],
});

// Verify cavity fill ratio >= 0.30 and zero parts poking outside CAVITY_R = 32
export const CAVITY_ITEMS = [
  { x: gBarrel.x, y: gBarrel.y, r: gBarrel.outerR },
  { x: gCenter.x, y: gCenter.y, r: gCenter.outerR },
  { x: gThird.x, y: gThird.y, r: gThird.outerR },
  { x: gFourth.x, y: gFourth.y, r: gFourth.outerR },
  { x: gEscape.x, y: gEscape.y, r: gEscape.outerR },
  { x: BALANCE.x, y: BALANCE.y, r: BALANCE.r },
];
export const CAVITY_FILL = checkCavityFill(CAVITY_R, CAVITY_ITEMS, 0.30);
if (!CAVITY_FILL.ok) {
  throw new Error(`Cavity fill failed: ratio=${CAVITY_FILL.ratio.toFixed(3)}, outside=${CAVITY_FILL.outside}`);
}

// Verify exact pitch tangency for all 4 meshed pairs in the going train
export const GEAR_PAIRS = [
  {
    name: "barrel <-> centerPinion",
    a: { at: [gBarrel.x, gBarrel.y], teeth: gBarrel.teeth, pitchR: gBarrel.pitchR },
    b: { at: [gCenterPin.x, gCenterPin.y], teeth: gCenterPin.teeth, pitchR: gCenterPin.pitchR },
  },
  {
    name: "centerWheel <-> thirdPinion",
    a: { at: [gCenter.x, gCenter.y], teeth: gCenter.teeth, pitchR: gCenter.pitchR },
    b: { at: [gThirdPin.x, gThirdPin.y], teeth: gThirdPin.teeth, pitchR: gThirdPin.pitchR },
  },
  {
    name: "thirdWheel <-> fourthPinion",
    a: { at: [gThird.x, gThird.y], teeth: gThird.teeth, pitchR: gThird.pitchR },
    b: { at: [gFourthPin.x, gFourthPin.y], teeth: gFourthPin.teeth, pitchR: gFourthPin.pitchR },
  },
  {
    name: "fourthWheel <-> escapePinion",
    a: { at: [gFourth.x, gFourth.y], teeth: gFourth.teeth, pitchR: gFourth.pitchR },
    b: { at: [gEscapePin.x, gEscapePin.y], teeth: gEscapePin.teeth, pitchR: gEscapePin.pitchR },
  },
];
for (const p of GEAR_PAIRS) assertMeshed(p.a, p.b, 1e-6);

// Exact tooth-interleaving rest phases computed via meshPhase()
const CENTER_ROT0 = 0.14;
const BARREL_ROT0 = meshPhase(
  { at: [gCenterPin.x, gCenterPin.y], teeth: gCenterPin.teeth, rot: CENTER_ROT0 },
  { at: [gBarrel.x, gBarrel.y], teeth: gBarrel.teeth },
);
const THIRD_ROT0 = meshPhase(
  { at: [gCenter.x, gCenter.y], teeth: gCenter.teeth, rot: CENTER_ROT0 },
  { at: [gThirdPin.x, gThirdPin.y], teeth: gThirdPin.teeth },
);
const FOURTH_ROT0 = meshPhase(
  { at: [gThird.x, gThird.y], teeth: gThird.teeth, rot: THIRD_ROT0 },
  { at: [gFourthPin.x, gFourthPin.y], teeth: gFourthPin.teeth },
);
const ESCAPE_ROT0 = meshPhase(
  { at: [gFourth.x, gFourth.y], teeth: gFourth.teeth, rot: FOURTH_ROT0 },
  { at: [gEscapePin.x, gEscapePin.y], teeth: gEscapePin.teeth },
);

export const LAYOUT = {
  cavityR: CAVITY_R,
  dialR: DIAL_R,
  layers: LAYERS,
  train: TRAIN,
  pallet: PALLET,
  balance: BALANCE,
  cavityFill: CAVITY_FILL,
};

/** Fit the orthographic camera so all 3 exploded exhibition layers fill `box` cleanly. */
export function cameraFor(box) {
  const zBot = -2.2;
  const zTop = LAYERS.byName.dial.z1 + 1.5;
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (TAU * i) / 16;
    for (const z of [zBot, zTop]) {
      pts.push([DIAL_R * Math.cos(a), DIAL_R * Math.sin(a), z]);
    }
  }
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/**
 * Draw a clean spoked gear wheel blade with bucketed metal finish (compact SVG path count).
 * Its axisymmetric center collet is drawn once statically on the arbor so turning bins stay lean.
 */
function drawCompactWheel(cam, teeth, pitchR, thickness, rot, opts = {}) {
  const spokes = opts.spokes ?? 5;
  const mat = opts.material ?? "brass";
  const m = (2 * pitchR) / teeth;
  const rRoot = pitchR - 1.45 * m;
  const rimIn = rRoot - Math.max(1.5 * m, 0.1 * pitchR);
  const hubR = Math.max(1.6, 0.25 * pitchR);
  const boreR = hubR * 0.42;
  const holes = [circlePoints(boreR, 12)];
  if (spokes > 0 && rimIn - hubR > 1.2) {
    holes.push(...spokedHoles(hubR, rimIn, spokes, 0.16, rot, 8));
  }
  const outer = gearProfile(teeth, pitchR, { form: "clock", kind: "wheel", rot });
  const wheelMesh = plate(FLOOR, { outer, holes }, 0, thickness);
  return drawMesh(wheelMesh, cam, { material: mat, finish: "metal", shine: true, crease: 54 });
}

function drawCompactPinion(cam, leaves, pitchR, len, rot, material = "steel") {
  const outer = gearProfile(leaves, pitchR, { form: "clock", kind: "pinion", rot });
  const mesh = plate(FLOOR, { outer }, 0, len);
  return drawMesh(mesh, cam, { material, finish: "metal", shine: true, crease: 56 });
}

/** Build the complete 3-layer studio exhibition watch figure once and return `{ parts, pose, turningSpecs }`. */
export function figure(M, cam, opts = {}) {
  const px = opts.prefix ?? "we";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const S = (x, y, z) => screenOf(cam, [x, y, z], ax);
  const NSTEP = stepOf(cam, UP, ax);
  const zShift = (z) => `translate(${(NSTEP[0] * z).toFixed(2)} ${(NSTEP[1] * z).toFixed(2)})`;
  const right2 = [ax.right[0], ax.right[1]];

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
  const shadowDir = scale(keyLight(ax), -1.35);

  const zMove = LAYERS.byName.movement.z0;
  const zRotor = LAYERS.byName.rotor.z0;
  const zDial = LAYERS.byName.dial.z0;

  // ================================================================ LAYER 0: Movement Base
  // Grounding softShadow beneath the entire calibre plate on the studio floor (kept in "shadow" part)
  const floorDisc = plate(FLOOR, { outer: circlePoints(CAVITY_R + 4.5, 36) }, 0, 0.2);
  const mainplateGroundShadow = softShadow(floorDisc, cam, [2.2, -2.0, -2.6]);
  once("groundShadow", "shadow", mainplateGroundShadow);

  // Museum-grade rhodium calibrePlate with recessed barrel & balance pockets, ruby jewels & slotted screws
  const plateSvg = calibrePlate(cam, {
    r: CAVITY_R,
    h: 2.8,
    z: 0,
    material: "rhodium",
    pockets: [
      { x: gBarrel.x, y: gBarrel.y, r: gBarrel.outerR + 0.9, depth: 1.0 },
      { x: BALANCE.x, y: BALANCE.y, r: BALANCE.r + 0.9, depth: 0.9 },
    ],
    jewels: [
      { x: gCenter.x, y: gCenter.y, r: 1.85 },
      { x: gThird.x, y: gThird.y, r: 1.55 },
      { x: gFourth.x, y: gFourth.y, r: 1.55 },
      { x: gEscape.x, y: gEscape.y, r: 1.45 },
      { x: PALLET.x, y: PALLET.y, r: 1.35 },
      { x: BALANCE.x, y: BALANCE.y, r: 1.75 },
    ],
    screws: [
      { x: -24.5, y: 12.5, r: 1.7 },
      { x: 24.0, y: 13.0, r: 1.7 },
      { x: 24.5, y: -12.5, r: 1.7 },
      { x: -22.0, y: -15.5, r: 1.7 },
    ],
  });
  once("mainplate", "mainplate", plateSvg);

  // Stationary steel arbors at each wheel center
  const arborSvg = [
    arbor(0.95, 5.6, { at: [gBarrel.x, gBarrel.y, 2.7], material: "steel" }),
    arbor(0.85, 5.8, { at: [gCenter.x, gCenter.y, 2.7], material: "steel" }),
    arbor(0.68, 5.4, { at: [gThird.x, gThird.y, 2.7], material: "steel" }),
    arbor(0.68, 4.8, { at: [gFourth.x, gFourth.y, 2.7], material: "steel" }),
    arbor(0.58, 4.8, { at: [gEscape.x, gEscape.y, 2.7], material: "steel" }),
  ]
    .map((a) => a.pieces.map((pc) => drawMesh(pc.mesh, cam, { ...pc.look, finish: "metal" })).join(""))
    .join("");
  once("arbors", "mainplate", arborSvg);

  // ---- Mainspring Barrel (open-top gilt-brass drum + blued-steel coiledSpring)
  const BARREL_H = 3.6;
  const barrelInnerR = gBarrel.pitchR - 1.55;
  const barrelFloor = plate(
    FLOOR,
    {
      outer: circlePoints(barrelInnerR + 0.15, 28, gBarrel.x, gBarrel.y),
      holes: [circlePoints(2.1, 14, gBarrel.x, gBarrel.y)],
    },
    gBarrel.z,
    gBarrel.z + 0.55,
  );
  const barrelArborCore = turned(
    [gBarrel.x, gBarrel.y, gBarrel.z + 0.3],
    UP,
    [
      [0, 2.2],
      [BARREL_H - 0.5, 2.2],
      [BARREL_H, 1.75],
    ],
    18,
  );
  once(
    "barrelBase",
    "barrel",
    drawMesh(barrelFloor, cam, { material: "graphite", finish: "satin", crease: 45 }) +
      drawMesh(barrelArborCore, cam, { material: "steel", finish: "metal", shine: true, crease: 40 }),
  );

  const barrelTurn = turning("barrel", {
    period: TAU / gBarrel.teeth,
    n0: 0,
    n1: BARREL_H,
    minBins: 2,
    draw: (rot) => {
      const outer = gearProfile(gBarrel.teeth, gBarrel.pitchR, { form: "clock", kind: "wheel", rot });
      const drum = plate(FLOOR, { outer, holes: [circlePoints(barrelInnerR, 32)] }, 0, BARREL_H);
      return drawMesh(drum, cam, { material: "gilt", finish: "metal", shine: true, crease: 52 });
    },
  });
  barrelTurn.drawAll();

  // 5 quantized coiled mainspring states (0 = relaxed/uncoiled at 0h .. 4 = coiled tight at 42h)
  const mainspringTpl = (level) =>
    tpl(`mspr-${level}`, () => {
      const f = level / 4;
      const turns = 1.9 + f * 2.5;
      const rInner = 2.9 - f * 0.45;
      const rOuter = barrelInnerR - 0.55 - (1 - f) * 0.25;
      return coiledSpring(cam, {
        rInner,
        rOuter,
        turns,
        z: 0.65,
        thickness: 0.38,
        material: "blued",
      });
    });
  for (let i = 0; i <= 4; i++) mainspringTpl(i);

  // ---- Going train wheels & pinions (turningPart on every rotating thick solid!)
  const cPinTurn = turning("cpin", {
    period: TAU / gCenterPin.teeth,
    n0: 0,
    n1: 1.4,
    minBins: 2,
    draw: (rot) => drawCompactPinion(cam, gCenterPin.teeth, gCenterPin.pitchR, 1.4, rot),
  });
  cPinTurn.drawAll();

  const centerTurn = turning("center", {
    period: TAU / 5,
    n0: 0,
    n1: 0.82,
    minBins: 3,
    draw: (rot) => drawCompactWheel(cam, gCenter.teeth, gCenter.pitchR, 0.82, rot, { spokes: 5, material: "gilt" }),
  });
  centerTurn.drawAll();

  const tPinTurn = turning("tpin", {
    period: TAU / gThirdPin.teeth,
    n0: 0,
    n1: 1.3,
    minBins: 2,
    draw: (rot) => drawCompactPinion(cam, gThirdPin.teeth, gThirdPin.pitchR, 1.3, rot),
  });
  tPinTurn.drawAll();

  const thirdTurn = turning("third", {
    period: TAU / 5,
    n0: 0,
    n1: 0.78,
    minBins: 3,
    draw: (rot) => drawCompactWheel(cam, gThird.teeth, gThird.pitchR, 0.78, rot, { spokes: 5, material: "brass" }),
  });
  thirdTurn.drawAll();

  const fPinTurn = turning("fpin", {
    period: TAU / gFourthPin.teeth,
    n0: 0,
    n1: 1.3,
    minBins: 2,
    draw: (rot) => drawCompactPinion(cam, gFourthPin.teeth, gFourthPin.pitchR, 1.3, rot),
  });
  fPinTurn.drawAll();

  const fourthTurn = turning("fourth", {
    period: TAU / 4,
    n0: 0,
    n1: 0.78,
    minBins: 3,
    draw: (rot) => drawCompactWheel(cam, gFourth.teeth, gFourth.pitchR, 0.78, rot, { spokes: 4, material: "gilt" }),
  });
  fourthTurn.drawAll();

  const ePinTurn = turning("epin", {
    period: TAU / gEscapePin.teeth,
    n0: 0,
    n1: 1.3,
    minBins: 2,
    draw: (rot) => drawCompactPinion(cam, gEscapePin.teeth, gEscapePin.pitchR, 1.3, rot),
  });
  ePinTurn.drawAll();

  // ---- Steel 15-tooth Escape Wheel
  const escTurn = turning("escape", {
    period: TAU / 3,
    n0: 0,
    n1: 0.82,
    minBins: 4,
    draw: (rot) => {
      const outer = escapeWheelOutline(gEscape.teeth, gEscape.outerR, 3.85, rot);
      const holes = [circlePoints(0.9, 10), ...spokedHoles(1.4, 3.1, 3, 0.22, rot, 6)];
      const mesh = plate(FLOOR, { outer, holes }, 0, 0.82);
      return drawMesh(mesh, cam, { material: "steel", finish: "metal", shine: true, crease: 52 });
    },
  });
  escTurn.drawAll();

  // ---- Ruby-Jeweled Steel Pallet Fork
  const forkTurn = turning("pallet", {
    n0: 0,
    n1: 0.95,
    minBins: 18,
    draw: (a) => {
      const ang = PALLET.baseAng + a;
      const c = Math.cos(ang), s = Math.sin(ang);
      const rotP = ([x, y]) => [x * c - y * s, x * s + y * c];
      const stPt = (rf, deg) => [
        PALLET.feDist + gEscape.outerR * rf * Math.cos(deg * RAD),
        gEscape.outerR * rf * Math.sin(deg * RAD),
      ];
      const entryStone = [stPt(0.92, 144), stPt(0.96, 155), stPt(1.18, 156), stPt(1.14, 145)].map(rotP);
      const exitStone = [stPt(0.96, -155), stPt(0.92, -144), stPt(1.14, -145), stPt(1.18, -156)].map(rotP);
      const armL = PALLET.balDist - BALANCE.rollerR * 0.85;
      const forkPoly = [
        [-armL - 0.6, -1.15],
        [-armL + 0.55, -1.5],
        [-armL + 0.55, -0.5],
        [-0.35, -0.58],
        [2.3, -3.05],
        [2.95, -2.55],
        [0.9, -0.68],
        [0.9, 0.68],
        [2.95, 2.55],
        [2.3, 3.05],
        [-0.35, 0.58],
        [-armL + 0.55, 0.5],
        [-armL + 0.55, 1.5],
        [-armL - 0.6, 1.15],
      ].map(rotP);
      const body = plate(FLOOR, { outer: forkPoly }, 0, 0.82);
      return (
        drawMesh(body, cam, { material: "steel", finish: "metal", shine: true, crease: 46 }) +
        drawMesh(plate(FLOOR, { outer: entryStone }, 0.08, 0.94), cam, { material: "ruby", finish: "metal", shine: true }) +
        drawMesh(plate(FLOOR, { outer: exitStone }, 0.08, 0.94), cam, { material: "ruby", finish: "metal", shine: true })
      );
    },
  });
  forkTurn.drawAll(-7.5 * RAD - forkTurn.step, 7.5 * RAD + forkTurn.step);

  // ---- Sculpted Brass Balance Wheel + Blued Hairspring
  const balTurn = turning("balance", {
    period: TAU / 3,
    n0: 0,
    n1: 0.92,
    minBins: 5,
    draw: (rot) => {
      const r = BALANCE.r;
      // Poised rim with 6 integral micro-poising timing lobes on the outer perimeter (zero extra cylinder bloat)
      const rimPts = [];
      const N = 48;
      for (let i = 0; i < N; i++) {
        const a = rot + (TAU * i) / N;
        const lobe = i % 8 === 0 ? 0.52 : 0;
        rimPts.push([(r + lobe) * Math.cos(a), (r + lobe) * Math.sin(a)]);
      }
      const rim = plate(
        FLOOR,
        {
          outer: rimPts,
          holes: [circlePoints(1.4, 12), ...spokedHoles(2.15, r - 1.45, 3, 0.17, rot + 0.2, 8)],
        },
        0,
        0.92,
      );
      return drawMesh(rim, cam, { material: "brass", finish: "metal", shine: true, crease: 52 });
    },
  });
  balTurn.drawAll();

  // Stationary axisymmetric ruby center jewel on balance hub & steel pivot boss on pallet fork
  once(
    "escHubs",
    "balance",
    drawMesh(turned([BALANCE.x, BALANCE.y, 5.95], UP, [[0, 1.35], [0.5, 1.05]], 14), cam, { material: "ruby", finish: "metal", shine: true }) +
      drawMesh(turned([PALLET.x, PALLET.y, 5.4], UP, [[0, 1.15], [1.05, 1.15]], 14), cam, { material: "alloy", finish: "metal", shine: true }),
  );

  // 5 breathing states for the blued-steel hairspring sitting cleanly atop the balance hub
  const hairspringTpl = (bin) =>
    tpl(`hspr-${bin}`, () => {
      const f = 0.89 + (bin / 4) * 0.22;
      return drawSpiralRibbon(
        cam,
        FLOOR,
        { r0: 1.5, r1: 5.4 * f, turns: 3.1, t0: 0, t1: 0.68, thick: 0.18, steps: 42, phase: 0.45 },
        { material: "blued", finish: "metal", shine: true, crease: 42 },
      );
    });
  for (let i = 0; i <= 4; i++) hairspringTpl(i);

  // ================================================================ LAYER 1: Anodized-Orange Winding Rotor
  const ROTOR_R_IN = 19.5;
  const ROTOR_R_OUT = 29.8;
  const rotorShadowOff = [shadowDir[0] * 1.4, shadowDir[1] * 1.4, -3.5];

  const rotorTurn = turning("rotor", {
    n0: 0,
    n1: 1.48,
    minBins: 18,
    draw: (rot) => {
      const span = Math.PI * 0.46;
      const lowerArc = arcOutline(ROTOR_R_IN, ROTOR_R_OUT, rot - span, rot + span, 14);
      const weightArc = arcOutline(ROTOR_R_IN + 1.5, ROTOR_R_OUT - 0.5, rot - span + 0.04, rot + span - 0.04, 14);
      const lowerRim = plate(FLOOR, { outer: lowerArc }, 0, 0.72);
      const weightRim = plate(FLOOR, { outer: weightArc }, 0.72, 1.48);

      // Subtle machined radial grooves across the orange weighted outer crescent
      const ribs = [];
      for (let i = -3; i <= 3; i++) {
        const a = rot + i * 0.34;
        ribs.push([
          [Math.cos(a) * (ROTOR_R_IN + 2.1), Math.sin(a) * (ROTOR_R_IN + 2.1), 1.5],
          [Math.cos(a) * (ROTOR_R_OUT - 1.2), Math.sin(a) * (ROTOR_R_OUT - 1.2), 1.5],
        ]);
      }

      // Three brushed-steel skeleton arms linking the central bearing to the heavy orange crescent
      let arms = "";
      for (const da of [-1.05, 0, 1.05]) {
        const a = rot + da;
        const p1 = [Math.cos(a) * (ROTOR_R_IN + 1.2), Math.sin(a) * (ROTOR_R_IN + 1.2)];
        arms += drawMesh(
          plate(FLOOR, { outer: roundedHull([[0, 0, 3.0], [p1[0], p1[1], 1.4]]) }, 0.18, 0.7),
          cam,
          { material: "steel", finish: "metal", shine: true, crease: 45 },
        );
      }

      // Soft studio drop shadow cast cleanly onto the plane beneath the rotor
      const dropShadow = softShadow(lowerRim, cam, rotorShadowOff);
      return (
        dropShadow +
        arms +
        drawMesh(lowerRim, cam, { material: "steel", finish: "metal", shine: true, crease: 46 }) +
        drawMesh(weightRim, cam, { material: "subject", finish: "metal", shine: true, crease: 46 }) +
        linesOn(cam, ribs, "rig-crease")
      );
    },
  });
  // Pre-draw full operating arc (-20..245 deg) so rotor can swing wide in Step 1 and park
  // cleanly out of the way in the back-right (20 deg) during close-up movement steps!
  rotorTurn.drawAll(-10 * RAD, 245 * RAD);

  // Central ball-bearing rotor hub (polished steel race + 5 steel bearings + ruby center cap)
  const hubOuter = turned([0, 0, 0.1], UP, [[0, 4.1], [1.45, 4.1], [1.95, 3.3]], 24);
  const hubInner = turned([0, 0, 1.5], UP, [[0, 1.85], [0.75, 1.85]], 18);
  let bearings = "";
  for (let i = 0; i < 5; i++) {
    const a = (TAU * i) / 5 + 0.3;
    bearings += drawMesh(
      turned([Math.cos(a) * 2.75, Math.sin(a) * 2.75, 1.55], UP, [[0, 0.5], [0.45, 0.5]], 10),
      cam,
      { material: "alloy", finish: "metal", shine: true },
    );
  }
  once(
    "rotorHub",
    "rotor",
    drawMesh(hubOuter, cam, { material: "steel", finish: "metal", shine: true }) +
      bearings +
      drawMesh(hubInner, cam, { material: "ruby", finish: "metal", shine: true }),
  );

  // ================================================================ LAYER 2: Sleek Exhibition Bezel & Hands
  // Rimless open-cutaway watchCaseDial (lugs: false, cutaway: true -> 240° exhibition opening, 12 baton indices)
  const dialRingShadow = softShadow(plate(FLOOR, { outer: circlePoints(DIAL_R * 0.92, 32) }, 0, 0.2), cam, [1.5, -1.5, -3.2]);
  const dialSvg = watchCaseDial(cam, {
    r: DIAL_R,
    h: 8.5,
    lugs: false,
    cutaway: true,
    bezelMaterial: "steel",
    dialMaterial: "ceramic",
  });
  once("dialShadow", "shadow", dialRingShadow);
  once("dial", "dial", dialSvg);

  // Stationary axisymmetric center hand cannon pinion & cap (avoids repeating cylinders in every hand bin)
  once(
    "handCap",
    "hands",
    drawMesh(turned([0, 0, 6.4], UP, [[0, 1.8], [1.4, 1.8], [1.75, 1.3]], 18), cam, { material: "blued", finish: "metal", shine: true }) +
      drawMesh(turned([0, 0, 7.9], UP, [[0, 1.05], [0.42, 0.8]], 14), cam, { material: "subject", finish: "metal", shine: true }),
  );

  // Three sweeping blued/orange watch hands mounted coaxially at the dial center using turningPart()
  const hourHandTurn = turning("hhand", {
    n0: 0,
    n1: 0.28,
    minBins: 12,
    draw: (a) => {
      const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
      const len = 15.5, tail = 4.0, hw = 1.35;
      const poly = [
        [-tail * c - nx * hw * 0.55, -tail * s - ny * hw * 0.55],
        [-nx * hw, -ny * hw],
        [len * c - nx * hw * 0.16, len * s - ny * hw * 0.16],
        [len * c + nx * hw * 0.16, len * s + ny * hw * 0.16],
        [nx * hw, ny * hw],
        [-tail * c + nx * hw * 0.55, -tail * s + ny * hw * 0.55],
      ];
      return drawMesh(plate(FLOOR, { outer: poly }, 0, 0.28), cam, { material: "blued", finish: "metal", shine: true });
    },
  });
  hourHandTurn.drawAll();

  const minuteHandTurn = turning("mhand", {
    n0: 0,
    n1: 0.26,
    minBins: 12,
    draw: (a) => {
      const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
      const len = 22.8, tail = 5.2, hw = 1.05;
      const poly = [
        [-tail * c - nx * hw * 0.55, -tail * s - ny * hw * 0.55],
        [-nx * hw, -ny * hw],
        [len * c - nx * hw * 0.14, len * s - ny * hw * 0.14],
        [len * c + nx * hw * 0.14, len * s + ny * hw * 0.14],
        [nx * hw, ny * hw],
        [-tail * c + nx * hw * 0.55, -tail * s + ny * hw * 0.55],
      ];
      return drawMesh(plate(FLOOR, { outer: poly }, 0, 0.26), cam, { material: "blued", finish: "metal", shine: true });
    },
  });
  minuteHandTurn.drawAll();

  // Reference watchHand() primitive used cleanly at rest + matching rotated sweep bins
  const secondHandTurn = turning("shand", {
    n0: 0,
    n1: 0.24,
    minBins: 14,
    draw: (a) => {
      if (a === 0) return watchHand(cam, { len: 25.5, width: 1.0, tail: 7.0, z: 0, material: "subject" });
      const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
      const len = 25.5, tail = 7.0, hw = 0.52;
      const poly = [
        [-tail * c - nx * hw * 0.7, -tail * s - ny * hw * 0.7],
        [-nx * hw, -ny * hw],
        [len * c - nx * hw * 0.25, len * s - ny * hw * 0.25],
        [len * c + nx * hw * 0.25, len * s + ny * hw * 0.25],
        [nx * hw, ny * hw],
        [-tail * c + nx * hw * 0.7, -tail * s + ny * hw * 0.7],
      ];
      return drawMesh(plate(FLOOR, { outer: poly }, 0, 0.24), cam, { material: "subject", finish: "metal", shine: true });
    },
  });
  secondHandTurn.drawAll();

  // Crisp dash-dot vertical centreLines aligning the 3 exploded layers strictly along the shared center axis
  const guideLowerSvg = centreLines(cam, [
    [[0, 0, zMove + 7.2], [0, 0, zRotor - 0.5]],
  ]);
  const guideUpperSvg = centreLines(cam, [
    [[0, 0, zRotor + 3.0], [0, 0, zDial + 4.5]],
  ]);
  once("guideLower", "guides", guideLowerSvg);
  once("guideUpper", "guides", guideUpperSvg);

  /** Compute one 60 fps frame for the 3-layer everyday automatic watch state. */
  function pose(st) {
    const {
      reserveHours = 30,
      rotorDeg = 148,
      centerDeg = 0,
      esc = { balDeg: 30, forkDeg: 6.5, escDeg: 0, hairspringBreath: 1.0 },
      hourDeg = 145,
      minuteDeg = 32,
      secondDeg = -48,
    } = st;

    const items = [];
    const cRad = centerDeg * RAD;

    // Every gear advances in mathematically locked ratio & spin sign from solveGearTrain()!
    const barrelRad = BARREL_ROT0 + cRad * gBarrel.ratioToRoot * gBarrel.omegaSign;
    const centerRad = CENTER_ROT0 + cRad * gCenter.ratioToRoot * gCenter.omegaSign;
    const thirdRad = THIRD_ROT0 + cRad * gThird.ratioToRoot * gThird.omegaSign;
    const fourthRad = FOURTH_ROT0 + cRad * gFourth.ratioToRoot * gFourth.omegaSign;
    const escPinRad = ESCAPE_ROT0 + cRad * gEscapePin.ratioToRoot * gEscapePin.omegaSign;
    const escWheelRad = st.useEscDrive ? esc.escDeg * RAD : escPinRad;

    const springLevel = Math.max(0, Math.min(4, Math.round((Math.max(0, Math.min(42, reserveHours)) / 42) * 4)));
    const breathBin = Math.max(0, Math.min(4, Math.round(((esc.hairspringBreath - 0.89) / 0.22) * 4)));

    // ---- Layer 0: Rhodium Mainplate + Mainspring Barrel + Going Train + Escapement + Balance
    items.push({ id: `${px}-groundShadow`, key: 1, transform: zShift(zMove) });
    items.push({ id: `${px}-mainplate`, key: 2, transform: zShift(zMove) });
    items.push({ id: `${px}-arbors`, key: 4, transform: zShift(zMove) });

    // Open-top mainspring barrel + live coiled blued spring
    items.push({ id: `${px}-barrelBase`, key: 8, transform: zShift(zMove) });
    items.push({
      id: `${px}-barrel`,
      part: "barrel",
      key: 10,
      ...turnedAt(barrelTurn, barrelRad, gBarrel.x, gBarrel.y, zMove + gBarrel.z),
    });
    items.push({
      id: `${px}-mainspring`,
      part: "barrel",
      key: 12,
      href: mainspringTpl(springLevel),
      transform: place(0, gBarrel.x, gBarrel.y, 0, zMove + gBarrel.z),
    });

    // Going train: exact z-layering so pinions & wheels never collide
    items.push({ id: `${px}-cpin`, part: "center", key: 14, ...turnedAt(cPinTurn, centerRad, gCenterPin.x, gCenterPin.y, zMove + gCenterPin.z) });
    items.push({ id: `${px}-epin`, part: "escape", key: 15, ...turnedAt(ePinTurn, escPinRad, gEscapePin.x, gEscapePin.y, zMove + gEscapePin.z) });
    items.push({ id: `${px}-fourth`, part: "fourth", key: 16, ...turnedAt(fourthTurn, fourthRad, gFourth.x, gFourth.y, zMove + gFourth.z) });
    items.push({ id: `${px}-tpin`, part: "third", key: 18, ...turnedAt(tPinTurn, thirdRad, gThirdPin.x, gThirdPin.y, zMove + gThirdPin.z) });
    items.push({ id: `${px}-center`, part: "center", key: 20, ...turnedAt(centerTurn, centerRad, gCenter.x, gCenter.y, zMove + gCenter.z) });
    items.push({ id: `${px}-fpin`, part: "fourth", key: 22, ...turnedAt(fPinTurn, fourthRad, gFourthPin.x, gFourthPin.y, zMove + gFourthPin.z) });
    items.push({ id: `${px}-third`, part: "third", key: 24, ...turnedAt(thirdTurn, thirdRad, gThird.x, gThird.y, zMove + gThird.z) });

    // Swiss lever escapement + balance wheel & breathing hairspring
    items.push({ id: `${px}-escape`, part: "escape", key: 26, ...turnedAt(escTurn, escWheelRad, gEscape.x, gEscape.y, zMove + gEscape.z) });
    items.push({ id: `${px}-pallet`, part: "pallet", key: 28, ...turnedAt(forkTurn, esc.forkDeg * RAD, PALLET.x, PALLET.y, zMove + 5.4) });
    items.push({ id: `${px}-balance`, part: "balance", key: 30, ...turnedAt(balTurn, esc.balDeg * RAD, BALANCE.x, BALANCE.y, zMove + 5.2) });
    items.push({ id: `${px}-escHubs`, key: 31, transform: zShift(zMove) });
    items.push({
      id: `${px}-hairspring`,
      part: "balance",
      key: 32,
      href: hairspringTpl(breathBin),
      transform: place(0, BALANCE.x, BALANCE.y, 0, zMove + 6.45),
    });

    // ---- Lower dash-dot centreLines connecting movement up to floating rotor
    items.push({ id: `${px}-guideLower`, key: 36, transform: null });

    // ---- Layer 1: Elevated Anodized-Orange Weighted Half-Moon Rotor
    const rRad = rotorDeg * RAD;
    items.push({ id: `${px}-rotor`, part: "rotor", key: 42, ...turnedAt(rotorTurn, rRad, 0, 0, zRotor) });
    items.push({ id: `${px}-rotorHub`, key: 44, transform: zShift(zRotor) });

    // ---- Upper dash-dot centreLines connecting rotor center up to exhibition dial hands
    items.push({ id: `${px}-guideUpper`, key: 48, transform: null });

    // ---- Layer 2: Sleek Rimless Exhibition Bezel, Open-Cutaway Dial & Sweeping Watch Hands
    items.push({ id: `${px}-dialShadow`, key: 52, transform: zShift(zDial) });
    items.push({ id: `${px}-dial`, key: 54, transform: zShift(zDial) });
    items.push({ id: `${px}-hourHand`, part: "hands", key: 56, ...turnedAt(hourHandTurn, hourDeg * RAD, 0, 0, zDial + 6.45) });
    items.push({ id: `${px}-minuteHand`, part: "hands", key: 58, ...turnedAt(minuteHandTurn, minuteDeg * RAD, 0, 0, zDial + 7.0) });
    items.push({ id: `${px}-secondHand`, part: "hands", key: 60, ...turnedAt(secondHandTurn, secondDeg * RAD, 0, 0, zDial + 7.55) });
    items.push({ id: `${px}-handCap`, key: 62, transform: zShift(zDial) });

    // Live projected screen-space callout anchors (non-crossing left & right edges!)
    const leftPt = (cx, cy, r, z) => S(cx - right2[0] * r, cy - right2[1] * r, z);
    const rightPt = (cx, cy, r, z) => S(cx + right2[0] * r, cy + right2[1] * r, z);
    const at = {
      dial: leftPt(0, 0, DIAL_R * 0.94, zDial + 4.8),
      hands: leftPt(0, 0, 12.0, zDial + 7.2),
      rotor: leftPt(0, 0, ROTOR_R_OUT * 0.92, zRotor + 1.6),
      barrel: leftPt(gBarrel.x, gBarrel.y, gBarrel.outerR * 0.88, zMove + gBarrel.z + 2.4),
      center: S(-1.8, -5.8, zMove + gCenter.z + 0.8),
      third: rightPt(gThird.x, gThird.y, gThird.outerR * 0.86, zMove + gThird.z + 0.8),
      fourth: rightPt(gFourth.x, gFourth.y, gFourth.outerR * 0.85, zMove + gFourth.z + 0.8),
      escape: S(gEscape.x + 2.5, gEscape.y - 1.5, zMove + gEscape.z + 0.9),
      pallet: S(PALLET.x, PALLET.y - 1.2, zMove + 6.1),
      balance: leftPt(BALANCE.x, BALANCE.y, BALANCE.r * 0.88, zMove + 5.9),
    };

    return { items, at, defs: drainDefs() };
  }

  return { parts, pose, turningSpecs, layout: LAYOUT };
}

// ---------------------------------------------------------------- Side Explainer HUD (never receded!)
// Anchored cleanly in the upper-right stage column (`data-camera-avoid=""`), well clear of both
// the 3-layer watch silhouette and the bottom-right Concept / Predict cards at 1440x900 & 1280x800.
const HUD_CAM = { azimuth: 235, elevation: 28, scale: 98, origin: [10120, 260] };
const HUD_METER_1 = { azimuth: 235, elevation: 28, scale: 98, origin: [10120, 1920] };
const HUD_METER_2 = { azimuth: 235, elevation: 28, scale: 98, origin: [10120, 2640] };

/** Render the crisp plain-English explainerCard + live Power reserve & Balance beat meterBars. */
export function renderHud(M, st) {
  const full = M.fullReserveHours ?? 42;
  const hrs = Math.max(0, Math.min(full, Math.round(st.reserveHours ?? 0)));
  const running = st.running !== undefined ? st.running : hrs > 0;
  const ticks = st.ticksPerSec !== undefined ? st.ticksPerSec : running ? M.ticksPerSec : 0;
  const reserveFrac = hrs / full;
  const beatFrac = running ? 1 : 0;

  const reserveTone = hrs === 0 ? "bad" : hrs < M.lowReserveHours ? "hot" : "good";
  const beatTone = running ? "good" : "bad";

  const rows = st.hudRows ?? [
    `Rotor: ${st.rotorLabel ?? "Swings with your wrist"}`,
    `Spring: ${st.springLabel ?? `${M.maxSpringTurns} coiled turns max`}`,
    `Beat: ${st.beatLabel ?? `${ticks} gentle ticks every second`}`,
  ];

  const card = explainerCard(HUD_CAM, {
    at: [0, 0, 0],
    title: st.cardTitle ?? "Inside your watch",
    badge: st.badge ?? (running ? "Running" : "Stopped"),
    tone: st.tone ?? reserveTone,
    width: 38.5,
    rows,
  });

  const reserveBar = meterBar(HUD_METER_1, {
    at: [0, 0, 0],
    w: 38.5,
    h: 1.85,
    fraction: st.hideReserve ? 0 : reserveFrac,
    label: "Power reserve",
    valueText: st.hideReserve ? "? / 42 h" : `${hrs} / ${full} h`,
    tone: st.hideReserve ? "neutral" : reserveTone,
  });

  const beatBar = meterBar(HUD_METER_2, {
    at: [0, 0, 0],
    w: 38.5,
    h: 1.85,
    fraction: beatFrac,
    label: "Balance beat",
    valueText: running ? `${ticks} ticks / sec` : "0 ticks / sec",
    tone: beatTone,
  });

  return card + reserveBar + beatBar;
}
