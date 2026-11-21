// Open Differential: 3D cutaway mechanical figure built on Visualize's rig (src/rig & src/rig/mech.ts).
//
// World frame [x, y, z]:
//   +X  axle axis, left wheel (-X) to right wheel (+X)
//   +Y  longitudinal axis toward the front of the car (incoming driveshaft)
//   +Z  up
//
// Every fixed-axis turning solid (drive pinion, ring gear, carrier flanges, left & right sun gears,
// left & right wheel hubs + timing lugs) is placed by turningPart() with worst-case error < 0.45 px.
// The two bevel spider gears both orbit about X with the carrier and spin about their radial cross-pin,
// so they are projected directly in true 3D each frame (0.00 px distortion, ~0.2 ms per frame).

import {
  add,
  along,
  arbor,
  axesOf,
  bridge,
  centreLines,
  chamferPlate,
  circlePoints,
  cross,
  cutawayShell,
  dot,
  drawMesh,
  drawPart,
  facingCamera,
  fitCamera,
  gearProfile,
  keyLight,
  linesOn,
  n1,
  nearness,
  partPoints,
  pathThrough,
  pinion,
  planeOf,
  plate,
  plateShadow,
  pointOn,
  readableTeeth,
  RigStage,
  rod,
  roundedRect,
  scale,
  screenOf,
  screw,
  spokedHoles,
  spokedWheel,
  sub,
  turned,
  turningPart,
  unit,
} from "../../src/rig/index.ts";
export { RigStage, screenOf, nearness } from "../../src/rig/index.ts";

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

// Three-quarter cutaway view looking into the open rear (-Y) of the differential housing.
// +X runs screen-right, +Y runs upper-left-back (incoming driveshaft), +Z runs straight up.
export const VIEW = { azimuth: 245, elevation: 27 };

// Exact mechanical geometry in world units (1 unit ≈ 4.5 mm real axle scale).
// Mating bevel pairs share identical gear modules so their pitch circles touch tangentially:
//   Final drive: 11T pinion (R = 6.976) <-> 41T ring gear (R = 26.0), module = 52/41 = 1.2683
//   Bevel core:  16T sun gears (R = 11.2) <-> 10T spider gears (R = 7.0), module = 1.40
export const GEO = {
  rRing: 26.0,
  rPinion: (26.0 * 11) / 41, // 6.9756...
  xRing: 20.5,               // ring gear mid-plane (spans 18.5..22.5)
  ringThick: 4.0,
  xPinion: 20.5 - (26.0 * 11) / 41, // 13.5244 -> +X pitch circle touches x = 20.5!
  yPinion: 26.0,             // pinion mid-plane (spans 22.4..29.6) -> matches R_ring = 26.0!
  pinionLen: 7.2,
  rSun: 11.2,
  rSpider: 7.0,
  xSun: 7.0,                 // bevel pitch planes at x = ±7.0 = ±rSpider
  sunThick: 3.8,
  spiderThick: 3.6,
  rCarrier: 16.0,
  rStrut: 14.4,
  xCarrierL: -16.0,          // spans -17.6..-14.4
  xCarrierR: 16.0,           // spans +14.4..+17.6
  rHousing: 33.6,
  xWheelL: -53.0,
  xWheelR: 53.0,
  rWheel: 22.0,
  wheelThick: 5.0,
};

// Reference planes for turningPart():
//   AXLE_PL:   normal [-1, 0, 0], u = [0, 0, 1] (+Z), v = [0, 1, 0] (+Y).
//              +theta rolls the top of the axle forward toward +Y (engine).
//              Normal coordinate t = -x (so x = -t).
//   PINION_PL: normal [0, 1, 0], u = [1, 0, 0] (+X), v = [0, 0, -1] (-Z).
//              +theta moves its +X pitch edge (x = xRing) in -Z, matching the ring gear's +theta_c!
export const AXLE_PL = planeOf([0, 0, 0], [-1, 0, 0], [0, 0, 1]);
export const AXLE_AXES = { origin: [0, 0, 0], u: AXLE_PL.u, v: AXLE_PL.v, n: AXLE_PL.n };
export const PINION_PL = planeOf([GEO.xPinion, GEO.yPinion, 0], [0, 1, 0], [1, 0, 0]);
export const PINION_AXES = { origin: [GEO.xPinion, GEO.yPinion, 0], u: PINION_PL.u, v: PINION_PL.v, n: PINION_PL.n };
const FLOOR = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);

/** Outward radial unit vector of spider gear 1 on the cross-pin at carrier angle `carrierRad`. */
export function pinDir(carrierRad) {
  return [0, Math.sin(carrierRad), Math.cos(carrierRad)];
}

/** Exact 3D contact point where spider gear `sign` (+1 or -1) meets sun gear `side` (-1 left, +1 right). */
export function spiderSunContact(carrierRad, side, sign = 1) {
  const p = pinDir(carrierRad);
  return [side * GEO.rSpider, sign * GEO.rSun * p[1], sign * GEO.rSun * p[2]];
}

/** Exact 3D contact point where the 11T drive pinion meets the 41T ring gear. */
export const PINION_RING_CONTACT = [GEO.xRing, GEO.yPinion, 0];

/** Fit the orthographic camera cleanly to the entire cutaway axle assembly. */
export function cameraFor(M, box) {
  const pts = [];
  // Left & right wheel envelopes + ice patch below left wheel
  for (const x of [GEO.xWheelL - 4, GEO.xWheelR + 4]) {
    for (let i = 0; i < 16; i++) {
      const a = (TAU * i) / 16;
      pts.push([x, GEO.rWheel * Math.cos(a), GEO.rWheel * Math.sin(a)]);
    }
  }
  pts.push([GEO.xWheelL - 8, -16, -26.5], [GEO.xWheelL + 8, 16, -26.5]);
  // Cutaway housing envelope
  for (const x of [-30, 34]) {
    for (let i = 0; i < 16; i++) {
      const a = (TAU * i) / 16;
      pts.push([x, GEO.rHousing * Math.cos(a), GEO.rHousing * Math.sin(a)]);
    }
  }
  // Driveshaft input envelope
  pts.push([GEO.xPinion - 7, 50, -7], [GEO.xPinion + 7, 50, 7]);
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/** Build one bevel spider gear in true 3D at carrier angle `carrierRad`, spin `spiderRad`, side `sign` (+1/-1). */
function spiderSvg(cam, carrierRad, spiderRad, sign = 1) {
  const p = pinDir(carrierRad);
  const axis = [sign * p[0], sign * p[1], sign * p[2]];
  // Tangential basis perpendicular to `axis`: x_hat = [1, 0, 0], t_hat = cross(axis, x_hat)
  // At sign = +1: axis = +p, cross(+p, +x) = +t (matches model.mjs positive spiderRad!).
  // At sign = -1: axis = -p, cross(-p, +x) = -t (matches Spider 2 spinning by +spiderRad about -p!).
  const center = scale(axis, GEO.rSun);
  const pl = planeOf(center, axis, [1, 0, 0]);
  const halfT = GEO.spiderThick / 2;

  // 10-tooth involute spider pinion in the single signal colour (subject orange)
  const toothOuter = gearProfile(10, GEO.rSpider, { form: "involute", kind: "pinion", rot: spiderRad });
  const body = plate(pl, { outer: toothOuter, holes: [circlePoints(2.2, 14)] }, -halfT, halfT);

  // Raised machined steel/alloy boss + bold radial timing bar on the outer cap so spin reads at a glance
  const boss = turned(pointOn(pl, 0, 0, halfT - 0.1), pl.n, [[0, 4.1], [0.75, 4.1], [1.05, 3.6]], 18, pl.u);
  const c = Math.cos(spiderRad), s = Math.sin(spiderRad);
  const rot2 = ([x, y]) => [x * c - y * s, x * s + y * c];
  const barPoly = [
    [-3.7, -0.78], [4.3, -0.78], [4.3, 0.78], [-3.7, 0.78],
  ].map(rot2);
  const pointer = plate(pl, { outer: barPoly }, halfT + 0.65, halfT + 1.35);

  return (
    drawMesh(body, cam, { material: "subject", shine: true, crease: 45, sort: "face" }) +
    drawMesh(boss, cam, { material: "alloy", shine: true }) +
    drawMesh(pointer, cam, { material: "steel", shine: true })
  );
}

/** Build the rotating cross-pin connecting the two spider gears inside the carrier. */
function crossPinSvg(cam, carrierRad) {
  const p = pinDir(carrierRad);
  const a = scale(p, -15.6);
  const b = scale(p, 15.6);
  return drawMesh(rod(a, b, 2.05, 16), cam, { material: "steel", shine: true });
}

/** Build symmetric equal-torque balance arrows on Step 5 (Equal torque). */
function torqueArrowsSvg(cam, ax, carrierRad, torqueNm) {
  const p = pinDir(carrierRad);
  const tDir = [0, Math.cos(carrierRad), -Math.sin(carrierRad)]; // forward tangent at spider 1
  const out = [];
  const makeArrow = (side, label) => {
    const base = [side * (GEO.rSpider + 0.6), GEO.rSun * p[1], GEO.rSun * p[2]];
    const start = along(base, tDir, -6.5);
    const tip = along(base, tDir, 9.5);
    const p0 = screenOf(cam, start, ax);
    const p1 = screenOf(cam, tip, ax);
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const hw = 95, hl = 210;
    const head = `M${n1(p1[0])} ${n1(p1[1])}L${n1(p1[0] - ux * hl + nx * hw)} ${n1(p1[1] - uy * hl + ny * hw)}L${n1(p1[0] - ux * hl - nx * hw)} ${n1(p1[1] - uy * hl - ny * hw)}Z`;
    const tx = p1[0] + (side < 0 ? -120 : 120);
    const ty = p1[1] - 110;
    const anchor = side < 0 ? "end" : "start";
    out.push(
      `<path class="force-halo" d="M${n1(p0[0])} ${n1(p0[1])}L${n1(p1[0] - ux * hl * 0.7)} ${n1(p1[1] - uy * hl * 0.7)}"/>` +
      `<path class="force" d="M${n1(p0[0])} ${n1(p0[1])}L${n1(p1[0] - ux * hl * 0.7)} ${n1(p1[1] - uy * hl * 0.7)}"/>` +
      `<path class="force-head" d="${head}"/>` +
      `<text class="force-text" x="${n1(tx)}" y="${n1(ty)}" text-anchor="${anchor}">${label}</text>`,
    );
  };
  const txt = `${Math.round(torqueNm)} N·m`;
  makeArrow(-1, txt);
  makeArrow(1, txt);
  return out.join("");
}

/** Build the complete isometric cutaway differential figure (drawn once, placed every frame). */
export function figure(M, cam, opts = {}) {
  const px = opts.prefix ?? "df";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const S = (v) => screenOf(cam, v, ax);
  const shadowAway = scale(keyLight(ax), -1.8);

  // Enforce readability rule from src/rig/mech.ts at page scale (~10 SVG units per screen px)
  const pxPerUnit = cam.scale / 10;
  const maxRingTeeth = readableTeeth(GEO.rRing, pxPerUnit, 8);
  const maxSunTeeth = readableTeeth(GEO.rSun, pxPerUnit, 8);
  const maxSpiderTeeth = readableTeeth(GEO.rSpider, pxPerUnit, 8);
  if (M.D.zRing > maxRingTeeth || M.D.zSun > maxSunTeeth || M.D.zSpider > maxSpiderTeeth) {
    throw new Error(`teeth exceed readableTeeth at ${pxPerUnit.toFixed(2)} px/unit`);
  }

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

  // Every fixed-axis turning solid uses turningPart() with worst-case error strictly under 0.45 px.
  const turningAxle = (id, o) => turningPart(cam, AXLE_AXES, { id, def: tpl, maxErrPx: 0.45, unitsPerPx: 10, ...o });
  const turningPinion = (id, o) => turningPart(cam, PINION_AXES, { id, def: tpl, maxErrPx: 0.45, unitsPerPx: 10, ...o });
  const placedTurn = (t, theta, shift = 0, to = [0, 0]) => {
    const r = t.place(theta, to, shift);
    return { href: r.href, transform: r.transform, turnErrPx: r.turnErrPx };
  };

  // ---- 1. Cutaway Differential Housing (mech.ts: cutawayShell + facingCamera + bridge + screw)
  // openAngle = 192° opens cleanly toward the camera so the back & bottom hemisphere stays strictly behind
  // all internal gears (stage: -1) with 45°-hatched section walls and zero occlusion of any lit gear!
  const shellMount = { at: [30.0, 0, 0], axis: [-1, 0, 0], uHint: [0, 0, 1] };
  const housingShell = cutawayShell({
    ...shellMount,
    r: GEO.rHousing,
    h: 57.5,
    wall: 3.4,
    floor: 3.4,
    openAngle: 192 * RAD,
    facing: facingCamera(cam, shellMount),
    material: "slate",
    hatch: true,
  });
  // Right & left axle tube sleeves + pinion nose collar
  const rightTube = turned([30.0, 0, 0], [1, 0, 0], [[0, 10.5], [2.2, 10.5], [3.5, 7.6], [11.5, 7.6], [12.5, 6.8]], 24, [0, 0, 1]);
  const leftTube = turned([-27.5, 0, 0], [-1, 0, 0], [[0, 10.5], [2.2, 10.5], [3.5, 7.6], [11.5, 7.6], [12.5, 6.8]], 24, [0, 0, 1]);
  const noseCollar = turned([GEO.xPinion, 31.0, 0], [0, 1, 0], [[0, 10.4], [2.0, 10.4], [3.6, 8.2], [11.2, 8.2], [12.4, 7.2]], 24, [1, 0, 0]);
  // Carrier bearing cap bridges bolted to the cutaway shell ends (mech.ts: bridge + screw!)
  const capL = bridge({ points: [[0, -10.5], [0, 10.5]], width: 5.8 }, 2.6, {
    at: [-24.5, 0, 0],
    axis: [-1, 0, 0],
    uHint: [0, 0, 1],
    screwHoles: [[0, -10.5], [0, 10.5]],
    screwR: 1.5,
    material: "alloy",
    screwMaterial: "blued",
  });
  const capR = bridge({ points: [[0, -10.5], [0, 10.5]], width: 5.8 }, 2.6, {
    at: [25.8, 0, 0],
    axis: [-1, 0, 0],
    uHint: [0, 0, 1],
    screwHoles: [[0, -10.5], [0, 10.5]],
    screwR: 1.5,
    material: "alloy",
    screwMaterial: "blued",
  });

  once("housingRight", "housing", drawMesh(rightTube, cam, { material: "slate", shine: true }) + drawPart(capR, cam));
  once("housingBack", "housing", drawPart(housingShell, cam) + drawMesh(noseCollar, cam, { material: "slate", shine: true }));
  once("housingLeft", "housing", drawMesh(leftTube, cam, { material: "slate", shine: true }) + drawPart(capL, cam));

  // ---- 2. Input Driveshaft & 11-Tooth Drive Pinion (mech.ts: arbor + pinion + turningPart)
  const driveshaft = arbor(3.3, 22.5, {
    at: [GEO.xPinion, 29.5, 0],
    axis: [0, 1, 0],
    uHint: [1, 0, 0],
    pivotR: 2.4,
    pivotLength: 2.2,
    material: "steel",
  });
  once("driveshaft", "pinion", drawPart(driveshaft, cam));

  // Turning 11-tooth drive pinion (period = TAU / 11 -> tiny bin count, < 0.45 px!)
  const pinionHalf = GEO.pinionLen / 2;
  const pinionTurn = turningPinion("pinion", {
    period: TAU / M.D.zPinion,
    n0: -pinionHalf,
    n1: pinionHalf,
    minBins: 3,
    draw: (rot) => {
      const p = pinion(M.D.zPinion, GEO.rPinion, GEO.pinionLen, {
        at: [GEO.xPinion, GEO.yPinion - pinionHalf, 0],
        axis: [0, 1, 0],
        uHint: [1, 0, 0],
        form: "involute",
        rot,
        material: "steel",
        pxPerUnit,
      });
      return drawPart(p, cam);
    },
  });
  pinionTurn.drawAll();

  // Thin rotating timing collar on the input driveshaft so the 3.73× faster input spin is unmistakable
  const shaftMarkTurn = turningPinion("shaftMark", {
    period: TAU,
    n0: 14.0,
    n1: 16.0,
    minBins: 10,
    draw: (rot) => {
      const c = Math.cos(rot), s = Math.sin(rot);
      const rot2 = ([x, y]) => [x * c - y * s, x * s + y * c];
      const flange = plate(PINION_PL, { outer: circlePoints(5.8, 24), holes: [circlePoints(3.3, 14)] }, 14.0, 15.6);
      const lug = plate(PINION_PL, { outer: [[3.2, -1.1], [6.6, -1.1], [6.6, 1.1], [3.2, 1.1]].map(rot2) }, 14.0, 16.0);
      return drawMesh(flange, cam, { material: "alloy", shine: true }) + drawMesh(lug, cam, { material: "brass", shine: true });
    },
  });
  shaftMarkTurn.drawAll();

  // ---- 3. 41-Tooth Ring Gear (mech.ts: spokedWheel + screw + turningPart)
  // Split into 41-tooth rim (period = TAU/41 -> 2 bins!) and 6-bolt carrier flange ring (period = TAU/6 -> 6 bins!)
  const ringHalf = GEO.ringThick / 2;
  const ringTeethTurn = turningAxle("ringTeeth", {
    period: TAU / M.D.zRing,
    n0: -GEO.xRing - ringHalf,
    n1: -GEO.xRing + ringHalf,
    minBins: 2,
    draw: (rot) => {
      const w = spokedWheel(M.D.zRing, GEO.rRing, GEO.ringThick, {
        at: [GEO.xRing + ringHalf, 0, 0],
        axis: [-1, 0, 0],
        uHint: [0, 0, 1],
        form: "involute",
        spokes: 0,
        hubR: 15.8,
        colletR: 0,
        rot,
        material: "steel",
        pxPerUnit,
      });
      return drawPart(w, cam);
    },
  });
  ringTeethTurn.drawAll();

  const ringBoltsTurn = turningAxle("ringBolts", {
    period: TAU / 6,
    n0: -GEO.xRing + ringHalf,
    n1: -GEO.xRing + ringHalf + 1.25,
    minBins: 5,
    draw: (rot) => {
      let svg = "";
      for (let i = 0; i < 6; i++) {
        const a = rot + (TAU * i) / 6;
        const at = pointOn(AXLE_PL, 19.6 * Math.cos(a), 19.6 * Math.sin(a), -GEO.xRing + ringHalf);
        const sc = screw(1.75, { at, axis: [-1, 0, 0], uHint: [0, 0, 1], height: 1.15, slotAngle: a + 0.4, material: "blued" });
        svg += drawPart(sc, cam);
      }
      return svg;
    },
  });
  ringBoltsTurn.drawAll();

  // ---- 4. Rotating Carrier / Cage (left & right flanges via turningPart + 2 translating tie-bars!)
  const carrierFlange = (name, xCenter) => {
    const half = 1.6;
    const t = turningAxle(name, {
      period: TAU / 2,
      n0: -xCenter - half,
      n1: -xCenter + half,
      minBins: 8,
      draw: (rot) => {
        const holes = [circlePoints(4.5, 20), ...spokedHoles(6.4, 12.2, 2, 0.35, rot + Math.PI / 2, 10)];
        const m = plate(AXLE_PL, { outer: circlePoints(GEO.rCarrier, 32), holes }, -xCenter - half, -xCenter + half);
        return drawMesh(m, cam, { material: "alloy", shine: true, sort: "face" });
      },
    });
    t.drawAll();
    return t;
  };
  const carrierRightTurn = carrierFlange("carrierR", GEO.xCarrierR);
  const carrierLeftTurn = carrierFlange("carrierL", GEO.xCarrierL);

  // Cylindrical cage tie-bar parallel to X: invariant under YZ orbit, so pure translate (0.00 px error!)
  const tieBarSvg = drawMesh(
    rod([GEO.xCarrierL + 1.2, 0, 0], [GEO.xCarrierR - 1.2, 0, 0], 1.65, 14),
    cam,
    { material: "alloy", shine: true },
  );
  const tieBarTpl = tpl("tieBar", () => tieBarSvg);
  const originScreen = S([0, 0, 0]);
  const translateFromOrigin = (p3) => {
    const p2 = S(p3);
    return `translate(${(p2[0] - originScreen[0]).toFixed(2)} ${(p2[1] - originScreen[1]).toFixed(2)})`;
  };

  // ---- 5. 16-Tooth Left & Right Sun Gears (mech.ts: spokedWheel + turningPart, warm brass!)
  // Split into 16-tooth bevel sun gear (period = TAU/16 -> 2 bins!) + thin rotating timing stripe (period = TAU -> 10 bins!)
  const sunPart = (name, xCenter, faceDir) => {
    const half = GEO.sunThick / 2;
    const teeth = turningAxle(`${name}Teeth`, {
      period: TAU / M.D.zSun,
      n0: -xCenter - half,
      n1: -xCenter + half,
      minBins: 2,
      draw: (rot) => {
        const w = spokedWheel(M.D.zSun, GEO.rSun, GEO.sunThick, {
          at: [xCenter + half, 0, 0],
          axis: [-1, 0, 0],
          uHint: [0, 0, 1],
          form: "involute",
          spokes: 0,
          hubR: 5.0,
          colletR: 0,
          rot,
          material: "brass",
          pxPerUnit,
        });
        return drawPart(w, cam);
      },
    });
    teeth.drawAll();

    // Crisp radial index bar on the camera-facing side (-X side, t = -xCenter + half)
    const markT0 = -xCenter + (faceDir > 0 ? half : -half - 0.9);
    const markT1 = markT0 + 0.9;
    const mark = turningAxle(`${name}Mark`, {
      period: TAU,
      n0: markT0,
      n1: markT1,
      minBins: 10,
      draw: (rot) => {
        const c = Math.cos(rot), s = Math.sin(rot);
        const rot2 = ([x, y]) => [x * c - y * s, x * s + y * c];
        const bar = [[4.2, -1.05], [9.2, -1.05], [9.2, 1.05], [4.2, 1.05]].map(rot2);
        return drawMesh(plate(AXLE_PL, { outer: bar }, markT0, markT1), cam, { material: "steel", shine: true });
      },
    });
    mark.drawAll();
    return { teeth, mark };
  };
  // Both sun gears span x = ±(rSpider .. rSpider + sunThick) so their inner faces meet the spider pitch circles at x = ±7.0!
  const sunL = sunPart("sunL", -(GEO.rSpider + GEO.sunThick / 2), 1);
  const sunR = sunPart("sunR", +(GEO.rSpider + GEO.sunThick / 2), 1);

  // ---- 6. Left & Right Half-Shafts (mech.ts: arbor with `inside` cutouts where flanges/gears sit!)
  const axleL = arbor(3.1, 41.5, {
    at: [-10.6, 0, 0],
    axis: [-1, 0, 0],
    uHint: [0, 0, 1],
    pivotR: 2.4,
    pivotLength: 1.5,
    inside: [[3.6, 7.2]], // hidden cleanly inside left carrier flange
    material: "steel",
  });
  const axleR = arbor(3.1, 41.5, {
    at: [10.6, 0, 0],
    axis: [1, 0, 0],
    uHint: [0, 0, 1],
    pivotR: 2.4,
    pivotLength: 1.5,
    inside: [[3.6, 12.2]], // hidden cleanly inside right carrier flange & ring gear
    material: "steel",
  });
  once("axleRInner", "axleR", drawPart({ ...axleR, pieces: [axleR.pieces[0]] }, cam));
  once("axleROuter", "axleR", drawPart({ ...axleR, pieces: [axleR.pieces[1]] }, cam));
  once("axleLInner", "axleL", drawPart({ ...axleL, pieces: [axleL.pieces[0]] }, cam));
  once("axleLOuter", "axleL", drawPart({ ...axleL, pieces: [axleL.pieces[1]] }, cam));

  // ---- 7. Left & Right Wheels / Hubs (graphite tire + alloy 5-spoke rim + brass timing spoke lug via turningPart)
  const makeWheel = (name, xCenter) => {
    const half = GEO.wheelThick / 2;
    const rim = turningAxle(`${name}Rim`, {
      period: TAU / 5,
      n0: -xCenter - half,
      n1: -xCenter + half,
      minBins: 6,
      draw: (rot) => {
        const tire = plate(
          AXLE_PL,
          { outer: circlePoints(GEO.rWheel, 36), holes: [circlePoints(16.2, 32)] },
          -xCenter - half,
          -xCenter + half,
        );
        const spokes = plate(
          AXLE_PL,
          { outer: circlePoints(16.4, 32), holes: [circlePoints(4.2, 16), ...spokedHoles(5.6, 14.5, 5, 0.24, rot, 8)] },
          -xCenter - half + 0.7,
          -xCenter + half - 0.7,
        );
        return (
          plateShadow(tire, cam, shadowAway) +
          drawMesh(tire, cam, { material: "graphite", shine: true, crease: 42, sort: "face" }) +
          drawMesh(spokes, cam, { material: "alloy", shine: true, crease: 40, sort: "face" })
        );
      },
    });
    rim.drawAll();

    // Bold brass index spoke marker (period = TAU) so revolution count & wheelspin read instantly!
    const lugT0 = -xCenter + half - 0.75;
    const lugT1 = -xCenter + half + 0.55;
    const lug = turningAxle(`${name}Lug`, {
      period: TAU,
      n0: lugT0,
      n1: lugT1,
      minBins: 10,
      draw: (rot) => {
        const c = Math.cos(rot), s = Math.sin(rot);
        const rot2 = ([x, y]) => [x * c - y * s, x * s + y * c];
        const bar = [[5.2, -1.65], [15.4, -1.65], [15.4, 1.65], [5.2, 1.65]].map(rot2);
        const cap = turned(pointOn(AXLE_PL, 0, 0, lugT0), AXLE_PL.n, [[0, 4.4], [1.2, 4.4], [1.45, 3.8]], 16, AXLE_PL.u);
        return (
          drawMesh(plate(AXLE_PL, { outer: bar }, lugT0, lugT1), cam, { material: "brass", shine: true }) +
          drawMesh(cap, cam, { material: "steel", shine: true })
        );
      },
    });
    lug.drawAll();
    return { rim, lug };
  };
  const wheelL = makeWheel("wheelL", GEO.xWheelL);
  const wheelR = makeWheel("wheelR", GEO.xWheelR);

  // ---- 8. Glare Ice Patch under Left Wheel (Step 6 & low-grip Lab!)
  const iceSlab = chamferPlate(FLOOR, roundedRect(20.0, 34.0, 3.8, GEO.xWheelL, 0), -26.2, -23.0, 0.55);
  const iceGlints = [
    [[GEO.xWheelL - 5.5, -10.0, -22.92], [GEO.xWheelL + 4.5, -2.0, -22.92]],
    [[GEO.xWheelL - 4.0, 3.0, -22.92], [GEO.xWheelL + 5.5, 10.5, -22.92]],
    [[GEO.xWheelL - 6.0, -1.5, -22.92], [GEO.xWheelL - 0.5, 4.5, -22.92]],
  ];
  once("icePatch", "ice", drawMesh(iceSlab, cam, { material: "cobalt", shine: true, crease: 38 }) + linesOn(cam, iceGlints, "rig-shine"));

  // ---- 9. Engineering Centre Lines (mech.ts: centreLines)
  once(
    "centreLines",
    "axes",
    centreLines(cam, [
      [[-64, 0, 0], [64, 0, 0]],
      [[GEO.xPinion, 18, 0], [GEO.xPinion, 54, 0]],
    ]),
  );

  // Expose turningPart instances for rigorous sub-pixel budget testing in figure.test.mjs
  const turningParts = {
    pinion: pinionTurn,
    shaftMark: shaftMarkTurn,
    ringTeeth: ringTeethTurn,
    ringBolts: ringBoltsTurn,
    carrierR: carrierRightTurn,
    carrierL: carrierLeftTurn,
    sunLTeeth: sunL.teeth,
    sunLMark: sunL.mark,
    sunRTeeth: sunR.teeth,
    sunRMark: sunR.mark,
    wheelLRim: wheelL.rim,
    wheelLLug: wheelL.lug,
    wheelRRim: wheelR.rim,
    wheelRLug: wheelR.lug,
  };

  /** Pose one 60 fps frame from the model's exact kinematic angles and flags. */
  function pose(st) {
    const carrierRad = st.carrierRad ?? 0.18;
    const pinionRad = st.pinionRad ?? carrierRad * M.finalDrive;
    const leftRad = st.leftRad ?? carrierRad;
    const rightRad = st.rightRad ?? carrierRad;
    const spiderRad = st.spiderRad ?? ((rightRad - leftRad) / 2) * M.sunSpiderRatio;
    const show = st.show ?? {};

    // Dynamic depth keys for parts orbiting around the axle (center key = 28)
    const depthKey = (v) => 28 + 0.45 * nearness(cam, v, ax);

    const p = pinDir(carrierRad);
    const s1Pos = scale(p, GEO.rSun);
    const s2Pos = scale(p, -GEO.rSun);
    // Cage tie-bars sit ±90° away from the cross-pin in YZ
    const strutDir = [0, Math.cos(carrierRad), -Math.sin(carrierRad)];
    const st1Pos = scale(strutDir, GEO.rStrut);
    const st2Pos = scale(strutDir, -GEO.rStrut);

    const items = [
      // Background right side (farther along +X)
      { id: `${px}-wheelRRim`, part: "wheelR", key: 1, ...placedTurn(wheelR.rim, rightRad) },
      { id: `${px}-wheelRLug`, part: "wheelR", key: 2, ...placedTurn(wheelR.lug, rightRad) },
      { id: `${px}-axleROuter`, part: "axleR", key: 4 },
      { id: `${px}-housingRight`, part: "housing", key: 6 },
      { id: `${px}-housingBack`, part: "housing", key: 8 },
      { id: `${px}-driveshaft`, part: "pinion", key: 10 },
      { id: `${px}-shaftMark`, part: "pinion", key: 11, ...placedTurn(shaftMarkTurn, pinionRad) },
      { id: `${px}-pinion`, part: "pinion", key: 12, ...placedTurn(pinionTurn, pinionRad) },
      { id: `${px}-ringTeeth`, part: "ring", key: 15, ...placedTurn(ringTeethTurn, carrierRad) },
      { id: `${px}-ringBolts`, part: "ring", key: 16, ...placedTurn(ringBoltsTurn, carrierRad) },
      { id: `${px}-carrierR`, part: "carrier", key: 18, ...placedTurn(carrierRightTurn, carrierRad) },
      { id: `${px}-axleRInner`, part: "axleR", key: 19 },

      // Center bevel gearset (depth-sorted live by nearness so orbiting parts pass smoothly behind & in front!)
      { id: `${px}-sunRTeeth`, part: "sunR", key: depthKey([GEO.rSpider + 1.9, 0, 0]), ...placedTurn(sunR.teeth, rightRad) },
      { id: `${px}-sunRMark`, part: "sunR", key: depthKey([GEO.rSpider + 1.9, 0, 0]) + 0.05, ...placedTurn(sunR.mark, rightRad) },
      { id: `${px}-crossPin`, part: "carrier", key: 28, svg: crossPinSvg(cam, carrierRad), transform: null },
      { id: `${px}-spider1`, part: "spider", key: depthKey(s1Pos), svg: spiderSvg(cam, carrierRad, spiderRad, 1), transform: null },
      { id: `${px}-spider2`, part: "spider", key: depthKey(s2Pos), svg: spiderSvg(cam, carrierRad, spiderRad, -1), transform: null },
      { id: `${px}-strut1`, part: "carrier", key: depthKey(st1Pos), href: tieBarTpl, transform: translateFromOrigin(st1Pos) },
      { id: `${px}-strut2`, part: "carrier", key: depthKey(st2Pos), href: tieBarTpl, transform: translateFromOrigin(st2Pos) },
      { id: `${px}-sunLTeeth`, part: "sunL", key: depthKey([-(GEO.rSpider + 1.9), 0, 0]), ...placedTurn(sunL.teeth, leftRad) },
      { id: `${px}-sunLMark`, part: "sunL", key: depthKey([-(GEO.rSpider + 1.9), 0, 0]) + 0.05, ...placedTurn(sunL.mark, leftRad) },

      // Foreground left side (nearer along -X)
      { id: `${px}-axleLInner`, part: "axleL", key: 40 },
      { id: `${px}-carrierL`, part: "carrier", key: 42, ...placedTurn(carrierLeftTurn, carrierRad) },
      { id: `${px}-housingLeft`, part: "housing", key: 44 },
      { id: `${px}-axleLOuter`, part: "axleL", key: 46 },
      { id: `${px}-icePatch`, part: "ice", key: 49, hidden: !show.ice },
      { id: `${px}-wheelLRim`, part: "wheelL", key: 52, flags: { slip: !!show.slip }, ...placedTurn(wheelL.rim, leftRad) },
      { id: `${px}-wheelLLug`, part: "wheelL", key: 53, flags: { slip: !!show.slip }, ...placedTurn(wheelL.lug, leftRad) },
      { id: `${px}-centreLines`, part: "axes", key: 58 },
    ];

    if (show.forces) {
      items.push({
        id: `${px}-forces`,
        part: "forces",
        key: 64,
        svg: torqueArrowsSvg(cam, ax, carrierRad, st.wheelTorque ?? M.N.wheelTorque),
        transform: null,
      });
    } else {
      items.push({ id: `${px}-forces`, part: "forces", key: 64, hidden: true });
    }

    // Callout anchors: every anchor sits directly on the visible surface of its part!
    const topSpider = nearness(cam, s1Pos, ax) >= nearness(cam, s2Pos, ax) ? s1Pos : s2Pos;
    const fMid = along(s1Pos, strutDir, 1.5);
    const at = {
      pinion: S([GEO.xPinion, GEO.yPinion + 4, 4.5]),
      ring: S([GEO.xRing, -8, GEO.rRing - 2]),
      carrier: S([GEO.xCarrierL, 0, GEO.rCarrier - 1.5]),
      spider: S(add(topSpider, [0, 0, 1.5])),
      sunL: S([-(GEO.rSpider + 1.9), -5.0, -4.5]),
      sunR: S([+(GEO.rSpider + 1.9), -5.0, 6.5]),
      axleL: S([-39.0, 0, 2.5]),
      axleR: S([39.0, 0, 2.5]),
      wheelL: S([GEO.xWheelL, -8, 12]),
      wheelR: S([GEO.xWheelR, -8, 12]),
      housing: S([2.0, 20, -GEO.rHousing + 4]),
      ice: S([GEO.xWheelL, -10, -23.0]),
      forces: S(fMid),
    };

    return { items, at, defs: drainDefs() };
  }

  return { parts, pose, turningParts, cam };
}
