// Automatic mechanical watch movement on Visualize's rig (src/rig):
// True 3D horological cutaway calibre inside a sleek brushed-steel wristwatch case (smooth
// continuous cutaway back shell, sculpted 12 & 6 o'clock lugs, fluted 3 o'clock winding crown),
// stepped rhodium mainplate with perlage tracks, open-top mainspring barrel with depth-sorted
// blued-steel spiral ribbon & vermilion slipping bridle, 4-stage brass going train, sculpted
// chamfered steel bridges with flush brass-chaton ruby jewels & blued screws, Swiss lever
// escapement, poised balance wheel with breathing hairspring, meshing twin reversing wheels
// and ball-bearing oscillating rotor — paired with View A: a bevel-shaded 4.5:1 horological loupe.
//
// Zero-distortion contract: every cylindrical arbor, jewel, screw, bridge and pillar stays
// stationary; every turning wheel, rotor, balance, fork and hand is angle-binned across its
// symmetry period and placed by its mid-plane so affine shear stays strictly sub-pixel (< 0.25 px).

import {
  add, affineString, arcOutline, axesOf, chamferPlate, circlePoints, drawMesh, drawSpiralRibbon,
  escapeWheelOutline, fitCamera, gearOutline, keyLight, linesOn, moveInPlane, n1,
  pathThrough, planeOf, plate, plateShadow, RigStage, rod, roundedHull, scale, screenOf,
  spokedHoles, turned, turningPart,
} from "../../src/rig/index.ts";
export { RigStage, screenOf } from "../../src/rig/index.ts";

// Classic three-quarter horological cutaway angle: sleek calibre proportions with crisp 3D depth
export const VIEW = { azimuth: 230, elevation: 26 };
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const FLOOR = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
const FLOOR_AXES = { origin: [0, 0, 0], u: FLOOR.u, v: FLOOR.v, n: FLOOR.n };

// Solve exact circle-circle intersection for gear pitch-circle tangency
function circleIntersect(ax, ay, ra, bx, by, rb, side = 1) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  const a = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - a * a));
  const mx = ax + (a * dx) / d, my = ay + (a * dy) / d;
  return [mx - (side * h * dy) / d, my + (side * h * dx) / d];
}

// Calibre layout in movement-scale units: EVERY meshing gear pair satisfies hypot(dx,dy) === rA + rB!
const BARREL_POS = [-15.0, 14.0]; // dist to origin = 20.518
const REV_B_R = 6.5, REV_A_R = 6.5, ROTOR_PIN_R = 8.2, RATCHET_R = 8.2;
const REV_B_POS = [Math.cos(82 * RAD) * (ROTOR_PIN_R + REV_B_R), Math.sin(82 * RAD) * (ROTOR_PIN_R + REV_B_R)];
const REV_A_POS = circleIntersect(REV_B_POS[0], REV_B_POS[1], REV_B_R + REV_A_R, BARREL_POS[0], BARREL_POS[1], RATCHET_R + REV_A_R, -1);

// Compact, true-to-life mechanical calibre Z-stack (zero spindly stilts!)
export const CAL = {
  plateR: 48.5,
  caseR: 53.5,
  barrel:  { x: BARREL_POS[0], y: BARREL_POS[1], r: 15.2, rRatchet: RATCHET_R, z: 2.2 },
  center:  { x: 0, y: 0, r: 13.5, pinR: 5.32, rotorPinR: ROTOR_PIN_R, z: 5.8 },
  third:   { x: 16.4, y: 6.6, r: 11.4, pinR: 4.2, z: 9.2 },
  fourth:  { x: 24.5, y: -6.6, r: 11.05, pinR: 4.0, z: 6.8 },
  escape:  { x: 12.2, y: -14.4, r: 9.2, pinR: 3.5, z: 8.2 },
  fork:    { x: -0.6, y: -19.8, z: 8.6 },
  balance: { x: -18.2, y: -18.2, r: 14.2, z: 7.4 },
  revB:    { x: REV_B_POS[0], y: REV_B_POS[1], r: REV_B_R, z: 14.6 },
  revA:    { x: REV_A_POS[0], y: REV_A_POS[1], r: REV_A_R, z: 14.6 },
  rotor:   { x: 0, y: 0, rIn: 31.5, rOut: 46.5, z: 17.6 },
};

// Watch case orientation at azimuth 230 deg:
// 3 o'clock (screen-right) = (+0.766, -0.643), 12 o'clock (top-back) = (+0.643, +0.766)
const CROWN_ANG = Math.atan2(-0.643, 0.766); // -40 deg -> cleanly right on screen
const LUG12_ANG = CROWN_ANG + Math.PI / 2;   // +50 deg -> cleanly top-back
const LUG6_ANG  = CROWN_ANG - Math.PI / 2;   // -130 deg -> cleanly bottom-front

export function cameraFor(box) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (TAU * i) / 16;
    for (const z of [-6.0, 22.8]) pts.push([56 * Math.cos(a), 56 * Math.sin(a), z]);
  }
  pts.push([Math.cos(CROWN_ANG) * 65, Math.sin(CROWN_ANG) * 65, 5]);
  for (const ang of [LUG12_ANG + 0.38, LUG12_ANG - 0.38]) pts.push([Math.cos(ang) * 74, Math.sin(ang) * 74, 4]);
  for (const ang of [LUG6_ANG + 0.38, LUG6_ANG - 0.38]) pts.push([Math.cos(ang) * 67, Math.sin(ang) * 67, 0]);
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/** Crisp horological spoked wheel centered at origin on z = 0..th, rotated by `rot`. */
function wheelMesh(teeth, pitchR, th, spokes = 5, hubR = 3.0, rot = 0) {
  const outer = gearOutline(teeth, pitchR, { addendum: pitchR * 0.085, dedendum: pitchR * 0.1, rot });
  const holes = [circlePoints(hubR * 0.55, 14)];
  if (pitchR > 7.5 && spokes > 0) holes.push(...spokedHoles(hubR + 1.0, pitchR * 0.76, spokes, 0.17, rot, 8));
  return plate(FLOOR, { outer, holes }, 0, th);
}

/** Flush horological jewel bearing inside a golden brass chaton + steel pivot dot. */
function jewelSetting(cam, x, y, z, rOuter = 2.1, rRuby = 1.4) {
  return drawMesh(turned([x, y, z - 0.12], [0, 0, 1], [[0, rOuter], [0.35, rOuter], [0.5, rOuter * 0.85]], 18), cam, { material: "brass", shine: true })
    + drawMesh(turned([x, y, z + 0.25], [0, 0, 1], [[0, rRuby], [0.32, rRuby], [0.44, rRuby * 0.72]], 16), cam, { material: "ruby", shine: true })
    + drawMesh(turned([x, y, z + 0.5], [0, 0, 1], [[0, rRuby * 0.34], [0.2, rRuby * 0.34]], 10), cam, { material: "steel" });
}

/** Recessed slotted watchmaker screw head (blued steel or polished alloy). */
function watchScrew(cam, x, y, z, r = 1.55, mat = "cobalt", slotAng = 0.5) {
  const c = Math.cos(slotAng) * r * 0.82, s = Math.sin(slotAng) * r * 0.82;
  return drawMesh(turned([x, y, z - 0.1], [0, 0, 1], [[0, r], [0.45, r], [0.65, r * 0.86]], 16), cam, { material: mat, shine: true })
    + linesOn(cam, [[[x - c, y - s, z + 0.6], [x + c, y + s, z + 0.6]]], "rig-sil");
}

/** Build the complete isometric automatic watch movement figure. */
export function figure(M, cam, opts = {}) {
  const px = opts.prefix ?? "aw";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const S = (x, y, z) => screenOf(cam, [x, y, z], ax);
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
  const place = (theta, x, y, fromN, toN) => affineString(moveInPlane(cam, FLOOR_AXES, theta, [x, y], fromN, toN));
  // A thick part that turns: drawn per angle bin (through tpl), placed by the plane halfway through
  // everything it draws (n0..n1 along z, at rest), with enough bins to keep it under half a pixel;
  // each placement reports its exact error to the stage.
  const turning = (id, o) => turningPart(cam, FLOOR_AXES, { id, def: tpl, ...o });
  const turnedAt = (t, theta, x, y, shift) => {
    const r = t.place(theta, [x, y], shift);
    return { href: r.href, transform: r.transform, turnErrPx: r.turnErrPx };
  };
  // a soft shadow under a turning part that keeps its real outline (a C stays a C); it lies below
  // the part, so a part that carries one reaches down to shadowAway[2]
  const shadowAway = scale(keyLight(ax), -1.6);

  // ---- 1. Sleek Brushed-Steel Cutaway Watch Case (SMOOTH seamless back arc, sculpted 12 & 6 lugs, fluted 3 o'clock crown)
  // One continuous 44-step arc from 3:30 around 12:00 to 8:30 -> zero brick seams, silky metallic shading!
  const caseA0 = CROWN_ANG - 0.32;
  const caseA1 = caseA0 + Math.PI * 1.12;
  const backCaseWall = plate(FLOOR, { outer: arcOutline(CAL.plateR + 0.4, CAL.caseR, caseA0, caseA1, 44) }, -5.2, 13.0);
  const backBezelLip = plate(FLOOR, { outer: arcOutline(CAL.plateR - 0.7, CAL.caseR - 0.9, caseA0, caseA1, 44) }, 13.0, 14.8);

  // Sculpted watch lugs at 12 o'clock (extending gracefully out past the sleek case back) and 6 o'clock (framing the front cutaway base)
  const makeLug = (ang, z0, z1, len = 14.5) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const nx = -s, ny = c;
    const r0 = CAL.caseR - 3.0, r1 = CAL.caseR + len;
    const poly = [
      [c * r0 - nx * 4.5, s * r0 - ny * 4.5],
      [c * r1 - nx * 2.5, s * r1 - ny * 2.5],
      [c * r1 + nx * 2.5, s * r1 + ny * 2.5],
      [c * r0 + nx * 4.5, s * r0 + ny * 4.5],
    ];
    return drawMesh(chamferPlate(FLOOR, poly, z0, z1, 1.3), cam, { material: "frame", shine: true });
  };
  const backLugsSvg = makeLug(LUG12_ANG + 0.38, -4.5, 9.8, 22.0) + makeLug(LUG12_ANG - 0.38, -4.5, 9.8, 22.0);
  const frontLugsSvg = makeLug(LUG6_ANG + 0.38, -5.8, 1.4, 13.5) + makeLug(LUG6_ANG - 0.38, -5.8, 1.4, 13.5);

  // Fluted 3 o'clock Winding Crown & Stem entering the case band cleanly
  const crownDir = [Math.cos(CROWN_ANG), Math.sin(CROWN_ANG), 0];
  const crownBase = [Math.cos(CROWN_ANG) * (CAL.caseR - 1.5), Math.sin(CROWN_ANG) * (CAL.caseR - 1.5), 4.6];
  const crownTube = turned(crownBase, crownDir, [[0, 2.1], [3.4, 2.1]], 14);
  const crownHead = turned([crownBase[0] + crownDir[0] * 2.8, crownBase[1] + crownDir[1] * 2.8, 4.6], crownDir, [
    [0, 5.0], [0.9, 6.2], [5.4, 6.2], [6.4, 5.0], [6.8, 3.0],
  ], 18);
  const crownGrooves = [];
  for (let i = 0; i < 12; i++) {
    const phi = (TAU * i) / 12;
    const u1 = [-crownDir[1], crownDir[0], 0], u2 = [0, 0, 1];
    const off = add(scale(u1, Math.cos(phi) * 6.25), scale(u2, Math.sin(phi) * 6.25));
    crownGrooves.push([
      add(add(crownBase, scale(crownDir, 3.8)), off),
      add(add(crownBase, scale(crownDir, 8.2)), off),
    ]);
  }
  const crownSvg = drawMesh(crownTube, cam, { material: "steel" })
    + drawMesh(crownHead, cam, { material: "alloy", shine: true })
    + linesOn(cam, crownGrooves, "rig-crease");

  once("caseBack", "plate",
    backLugsSvg
    + drawMesh(backCaseWall, cam, { material: "steel", shine: true, crease: 52 })
    + drawMesh(backBezelLip, cam, { material: "alloy", shine: true, crease: 52 })
    + crownSvg,
  );

  // ---- 2. Stepped Horological Mainplate (German Silver / Rhodium with subtle perlage tracks)
  const caseBase = chamferPlate(FLOOR, circlePoints(CAL.caseR, 56), -6.0, -4.0, 0.75);
  const mainplate = chamferPlate(FLOOR, circlePoints(CAL.plateR, 56), -4.8, 2.0, 1.2);
  const perlage = [];
  for (const r of [16, 28, 39, 45.5]) {
    const ring = circlePoints(r, 48);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      perlage.push([[a[0], a[1], 2.06], [b[0], b[1], 2.06]]);
    }
  }
  // Delicate recessed circular perlage outline around the balance wheel recess (clean, never a heavy dark blob!)
  const balRing = circlePoints(CAL.balance.r + 1.0, 36, CAL.balance.x, CAL.balance.y);
  for (let i = 0; i < balRing.length; i++) {
    const a = balRing[i], b = balRing[(i + 1) % balRing.length];
    perlage.push([[a[0], a[1], 2.08], [b[0], b[1], 2.08]]);
  }
  // Short, realistic horological bridge pedestals (wide, solid, tucked strictly behind/outside wheels!)
  const trainFeet = [
    turned([32.5, 4.5, 2.0], [0, 0, 1], [[0, 3.0], [10.0, 3.0]], 16),
    turned([22.5, 16.0, 2.0], [0, 0, 1], [[0, 2.6], [10.0, 2.6]], 16),
    // Balance cock pedestal seated cleanly OUTSIDE the left edge of the balance rim (never intersecting the rim!)
    turned([-36.5, -14.5, 2.0], [0, 0, 1], [[0, 4.2], [9.8, 4.2]], 18),
  ].map((m) => drawMesh(m, cam, { material: "alloy", shine: true })).join("");

  once("mainplate", "plate",
    frontLugsSvg
    + drawMesh(caseBase, cam, { material: "steel", shine: false, crease: 38 })
    + drawMesh(mainplate, cam, { material: "frame", shine: false, crease: 38 })
    + linesOn(cam, perlage, "rig-deck-grid")
    + trainFeet,
  );

  // ---- 3. Stationary Vertical Steel Arbors & Pivots (compact calibre height, ZERO affine shear!)
  const arborsSvg = [
    turned([CAL.center.x, CAL.center.y, 2.0], [0, 0, 1], [[0, 2.4], [14.0, 2.4], [15.4, 3.8], [17.8, 3.8]], 18),
    turned([CAL.barrel.x, CAL.barrel.y, 2.2], [0, 0, 1], [[0, 3.5], [5.4, 5.4 > 0 ? 3.5 : 3.5], [6.2, 2.4], [13.5, 2.4]], 18),
    turned([CAL.third.x, CAL.third.y, 2.0], [0, 0, 1], [[0, 1.4], [10.8, 1.4]], 12),
    turned([CAL.fourth.x, CAL.fourth.y, 2.0], [0, 0, 1], [[0, 1.4], [11.2, 1.4]], 12),
    turned([CAL.escape.x, CAL.escape.y, 2.0], [0, 0, 1], [[0, 1.25], [8.2, 1.25]], 12),
    turned([CAL.fork.x, CAL.fork.y, 2.0], [0, 0, 1], [[0, 1.15], [8.2, 1.15]], 12),
    turned([CAL.balance.x, CAL.balance.y, 2.0], [0, 0, 1], [[0, 1.5], [10.8, 1.5]], 14),
    turned([CAL.revA.x, CAL.revA.y, 2.0], [0, 0, 1], [[0, 1.5], [14.0, 1.5]], 12),
    turned([CAL.revB.x, CAL.revB.y, 2.0], [0, 0, 1], [[0, 1.5], [14.0, 1.5]], 12),
  ].map((m) => drawMesh(m, cam, { material: "steel", shine: true })).join("");
  once("arbors", "train", arborsSvg);

  // ---- 4. Sculpted Horological Bridges (compact, bevel-chamfered, flush ruby jewels & blued screws!)
  const trainBridgeOuter = roundedHull([
    [CAL.third.x, CAL.third.y, 5.2],
    [CAL.fourth.x, CAL.fourth.y, 4.8],
    [32.8, 4.5, 5.2],
    [22.5, 16.0, 4.4],
  ]);
  const trainBridge = chamferPlate(FLOOR, trainBridgeOuter, 11.8, 13.8, 0.5);
  once("trainBridge", "train",
    drawMesh(trainBridge, cam, { material: "alloy", shine: true, crease: 38 })
    + jewelSetting(cam, CAL.third.x, CAL.third.y, 13.8, 2.4, 1.55)
    + jewelSetting(cam, CAL.fourth.x, CAL.fourth.y, 13.8, 2.3, 1.45)
    + watchScrew(cam, 32.5, 4.5, 13.8, 1.55, "cobalt", 0.4)
    + watchScrew(cam, 22.5, 16.0, 13.8, 1.4, "cobalt", -0.7),
  );

  // Sculpted Balance Cock: sweeps cleanly from outer-left pedestal (-36.5, -14.5) to balance pivot!
  const cockOuter = roundedHull([
    [CAL.balance.x, CAL.balance.y, 4.4],
    [-29.5, -17.0, 3.4],
    [-36.5, -14.5, 5.2],
  ]);
  const cock = chamferPlate(FLOOR, cockOuter, 11.6, 13.5, 0.48);
  once("balanceCock", "balance",
    drawMesh(cock, cam, { material: "alloy", shine: true, crease: 38 })
    + jewelSetting(cam, CAL.balance.x, CAL.balance.y, 13.5, 3.1, 1.95)
    + watchScrew(cam, -36.5, -14.5, 13.5, 1.75, "cobalt", 0.7),
  );

  // Sleek escape bridge cock grounding the escape wheel pivot cleanly
  const escBridgeOuter = roundedHull([[CAL.escape.x, CAL.escape.y, 2.8], [19.0, -22.5, 3.1]]);
  once("escBridge", "escapement",
    drawMesh(chamferPlate(FLOOR, escBridgeOuter, 10.0, 11.3, 0.35), cam, { material: "alloy", shine: true, crease: 38 })
    + jewelSetting(cam, CAL.escape.x, CAL.escape.y, 11.3, 1.95, 1.25)
    + watchScrew(cam, 19.0, -22.5, 11.3, 1.2, "cobalt", 1.1),
  );

  // ---- 5. Angle-Binned Turning Wheels & Subassemblies (Strictly < 0.25 px shear!)
  const binnedWheel = (name, teeth, r, th, spokes, hubR, mat, bins, period = spokes > 0 ? TAU / spokes : TAU / teeth) => {
    const t = turning(name, { period, n0: 0, n1: th, minBins: bins, draw: (rot) => drawMesh(wheelMesh(teeth, r, th, spokes, hubR, rot), cam, { material: mat, shine: true }) });
    t.drawAll();
    return (rad, x, y, z) => turnedAt(t, rad, x, y, z);
  };

  // Mainspring Barrel Drum: 30 crisp watchmaker teeth, open cutaway top showing coiled spring + vermilion bridle!
  const BARREL_TH = 4.6;
  once("barrelFloor", "barrel", drawMesh(plate(FLOOR, { outer: circlePoints(CAL.barrel.r - 1.8, 32, CAL.barrel.x, CAL.barrel.y), holes: [circlePoints(3.4, 14, CAL.barrel.x, CAL.barrel.y)] }, CAL.barrel.z, CAL.barrel.z + 0.75), cam, { material: "slate" }));
  const barrelTurn = turning("barrel", { period: TAU / 30, n0: 0, n1: BARREL_TH, minBins: 2, draw: (rot) => {
    const outer = gearOutline(30, CAL.barrel.r, { addendum: 0.92, dedendum: 1.0, rot });
    const drum = plate(FLOOR, { outer, holes: [circlePoints(CAL.barrel.r - 2.1, 36)] }, 0, BARREL_TH);
    return drawMesh(drum, cam, { material: "brass", shine: true });
  } });
  barrelTurn.drawAll();
  // Thin slipping bridle collar lining the front-left inner barrel rim (gleams vermilion at 100% wind, never obscures coils!)
  const bridleTpl = (slipping) => tpl(`bridle-${slipping ? 1 : 0}`, () => {
    const bridle = plate(FLOOR, { outer: arcOutline(CAL.barrel.r - 3.35, CAL.barrel.r - 2.15, -2.85, -0.55, 24) }, 0.9, 4.95);
    return drawMesh(bridle, cam, { material: slipping ? "subject" : "steel", shine: true });
  });
  // Blued-steel mainspring: a solid coiled strip, its coils hiding one another face by face
  const mainspringTpl = (level) => tpl(`mspr-${level}`, () => {
    const windF = level / 8;
    const turns = 3.2 + windF * 2.1;
    const r0 = 5.4 - windF * 1.6;
    const r1 = CAL.barrel.r - 3.5;
    return drawSpiralRibbon(cam, FLOOR, { r0, r1, turns, t0: 0.95, t1: 4.35, thick: 0.28, steps: 80, phase: 0.3 }, { material: "cobalt", shine: true, crease: 40 });
  });

  // Going train wheels + steel pinions (clean divisible tooth/spoke counts!)
  const placeCenterPin = binnedWheel("cpin", 10, CAL.center.pinR, 3.0, 0, 2.2, "steel", 2, TAU / 10);
  const placeCenter    = binnedWheel("center", 25, CAL.center.r, 1.6, 5, 3.2, "brass", 12);
  const placeThirdPin  = binnedWheel("tpin", 10, CAL.third.pinR, 2.8, 0, 1.5, "steel", 2, TAU / 10);
  const placeThird     = binnedWheel("third", 20, CAL.third.r, 1.5, 5, 2.6, "brass", 12);
  const placeFourthPin = binnedWheel("fpin", 10, CAL.fourth.pinR, 2.4, 0, 1.4, "steel", 2, TAU / 10);
  const placeFourth    = binnedWheel("fourth", 20, CAL.fourth.r, 1.5, 4, 2.5, "brass", 14);

  // Blued-steel sweep second hand mounted above fourth wheel jewel + brass hub cap
  const handTurn = turning("shand", { n0: 0, n1: 0.55, minBins: 36, draw: (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const nx = -s, ny = c;
    const L = CAL.fourth.r * 0.94, B = -3.4;
    const poly = [
      [c * B - nx * 0.65, s * B - ny * 0.65],
      [c * L - nx * 0.22, s * L - ny * 0.22],
      [c * L + nx * 0.22, s * L + ny * 0.22],
      [c * B + nx * 0.65, s * B + ny * 0.65],
    ];
    return drawMesh(plate(FLOOR, { outer: poly }, 0, 0.55), cam, { material: "cobalt", shine: true });
  } });
  handTurn.drawAll();
  once("secondCap", "train", drawMesh(turned([CAL.fourth.x, CAL.fourth.y, 14.3], [0, 0, 1], [[0, 1.15], [0.65, 1.15]], 12), cam, { material: "brass", shine: true }));

  // 15-tooth Swiss club-tooth escape wheel (3 spokes -> 120 deg symmetry, 18 bins!)
  const escTurn = turning("esc", { period: TAU / 3, n0: 0, n1: 1.3, minBins: 18, draw: (rot) => {
    const outer = escapeWheelOutline(15, CAL.escape.r, CAL.escape.r * 0.68, rot);
    const holes = [circlePoints(1.5, 12), ...spokedHoles(2.3, CAL.escape.r * 0.55, 3, 0.22, rot, 8)];
    return drawMesh(plate(FLOOR, { outer, holes }, 0, 1.3), cam, { material: "brass", shine: true });
  } });
  escTurn.drawAll();

  // Steel Pallet Fork with twin ruby stones, swinging +/- 6.5 deg (drawn every 3.25 deg or finer)
  const forkTurn = turning("fork", { n0: Math.min(0, shadowAway[2]), n1: 1.45, minBins: Math.ceil(360 / 3.25), draw: (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const rotP = ([x, y]) => [x * c - y * s, x * s + y * c];
    const arm = roundedHull([[-10.2, 0, 1.05], [0, 0, 2.0], [7.2, 4.2, 1.15]]).map(rotP);
    const arm2 = roundedHull([[0, 0, 1.85], [7.2, -4.2, 1.15]]).map(rotP);
    const stoneA = [[6.0, 3.0], [8.8, 3.8], [8.3, 5.2], [5.6, 4.3]].map(rotP);
    const stoneB = [[6.0, -4.3], [8.6, -5.0], [9.0, -3.5], [6.4, -2.8]].map(rotP);
    const arms = [plate(FLOOR, { outer: arm }, 0, 1.25), plate(FLOOR, { outer: arm2 }, 0, 1.25)];
    return arms.map((m) => plateShadow(m, cam, shadowAway)).join("")
      + arms.map((m) => drawMesh(m, cam, { material: "steel", shine: true })).join("")
      + drawMesh(plate(FLOOR, { outer: stoneA }, 0.1, 1.45), cam, { material: "ruby", shine: true })
      + drawMesh(plate(FLOOR, { outer: stoneB }, 0.1, 1.45), cam, { material: "ruby", shine: true });
  } });
  forkTurn.drawAll(-6.5 * RAD - forkTurn.step, 6.5 * RAD + forkTurn.step);

  // Poised Glucydur Balance Wheel (3 spokes + 6 timing screws -> 120 deg symmetry, 18 bins!)
  const balTurn = turning("bal", { period: TAU / 3, n0: 0, n1: 1.85, minBins: 18, draw: (rot) => {
    const r = CAL.balance.r;
    const rim = plate(FLOOR, { outer: circlePoints(r, 44), holes: [circlePoints(2.2, 14), ...spokedHoles(3.2, r - 2.3, 3, 0.18, rot + 0.2, 12)] }, 0, 1.85);
    let weights = "";
    for (let i = 0; i < 6; i++) {
      const a = rot + (TAU * i) / 6;
      weights += drawMesh(turned([Math.cos(a) * (r + 0.45), Math.sin(a) * (r + 0.45), 0.3], [0, 0, 1], [[0, 0.85], [1.15, 0.85]], 10), cam, { material: "alloy", shine: true });
    }
    return drawMesh(rim, cam, { material: "brass", shine: true }) + weights;
  } });
  balTurn.drawAll();

  // Breathing 3D Blued-Steel Hairspring Ribbon (9 breathing radii, depth-sorted, stationary!)
  const hairspringTpl = (bin) => tpl(`hspr-${bin}`, () => {
    const f = 0.88 + (bin / 8) * 0.24;
    return drawSpiralRibbon(cam, FLOOR, { r0: 2.3, r1: 9.6 * f, turns: 4.2, t0: 0, t1: 1.25, thick: 0.2, steps: 64, phase: 0.5 }, { material: "cobalt", shine: true, crease: 40 });
  });

  // Regulator index pointer arm (sweeps cleanly atop balance cock)
  // drawn every 5 deg or finer; its pin reaches 2.5 below the arm, so it is placed by the plane
  // halfway between the pin's foot and the arm's top
  const regTurn = turning("reg", { n0: -2.5, n1: 1.2, minBins: 72, draw: (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const rotP = ([x, y]) => [x * c - y * s, x * s + y * c];
    const arm = roundedHull([[0, 0, 2.0], [-14.0, 0, 0.92]]).map(rotP);
    const px0 = -10.2 * c, py0 = -10.2 * s;
    return drawMesh(plate(FLOOR, { outer: arm }, 0, 0.95), cam, { material: "subject", shine: true })
      + drawMesh(rod([px0, py0, -2.5], [px0, py0, 1.2], 0.52, 8), cam, { material: "brass", shine: true });
  } });
  regTurn.drawAll(-40 * RAD - regTurn.step, 40 * RAD + regTurn.step);

  // Coplanar Automatic Winding Train (bright machined alloy/steel gears + active teal click wheel!)
  const placeRotorPin = binnedWheel("rpin", 20, CAL.center.rotorPinR, 1.35, 4, 2.8, "alloy", 10);
  const placeRatchet  = binnedWheel("ratch", 20, CAL.barrel.rRatchet, 1.35, 4, 2.6, "alloy", 10);
  const placeRevTeal  = binnedWheel("rev-t", 16, CAL.revA.r, 1.45, 4, 2.0, "teal", 10);
  const placeRevSteel = binnedWheel("rev-s", 16, CAL.revA.r, 1.45, 4, 2.0, "alloy", 10);

  // ---- 6. Sculpted Ball-Bearing Oscillating Rotor (36 angle bins -> true rotating 3D light!)
  const rotorTurn = turning("rotor", { n0: Math.min(0, shadowAway[2]), n1: 3.1, minBins: 36, draw: (rot) => {
    const span = Math.PI * 0.47;
    const lowerArc = arcOutline(CAL.rotor.rIn, CAL.rotor.rOut, rot - span, rot + span, 28);
    const upperArc = arcOutline(CAL.rotor.rIn + 1.3, CAL.rotor.rOut - 1.1, rot - span + 0.03, rot + span - 0.03, 28);
    const lowerRim = plate(FLOOR, { outer: lowerArc }, 0, 1.75);
    const upperRim = plate(FLOOR, { outer: upperArc }, 1.75, 3.05);
    const ribs = [];
    for (let i = -4; i <= 4; i++) {
      const a = rot + i * 0.28;
      ribs.push([
        [Math.cos(a) * (CAL.rotor.rIn + 2.4), Math.sin(a) * (CAL.rotor.rIn + 2.4), 3.1],
        [Math.cos(a) * (CAL.rotor.rOut - 2.0), Math.sin(a) * (CAL.rotor.rOut - 2.0), 3.1],
      ]);
    }
    let arms = "";
    for (const da of [-1.06, 0, 1.06]) {
      const a = rot + da;
      const p1 = [Math.cos(a) * (CAL.rotor.rIn + 1.8), Math.sin(a) * (CAL.rotor.rIn + 1.8)];
      arms += drawMesh(plate(FLOOR, { outer: roundedHull([[0, 0, 4.7], [p1[0], p1[1], 1.9]]) }, 0.4, 1.65), cam, { material: "alloy", shine: true });
    }
    return plateShadow(lowerRim, cam, shadowAway)
      + arms
      + drawMesh(lowerRim, cam, { material: "steel", shine: true })
      + drawMesh(upperRim, cam, { material: "subject", shine: true })
      + linesOn(cam, ribs, "rig-crease");
  } });
  rotorTurn.drawAll();

  // Stationary Central Ball-Bearing Hub mounted flush onto the rotor shaft
  const rotorHubOuter = turned([0, 0, CAL.rotor.z - 0.2], [0, 0, 1], [[0, 6.0], [2.2, 6.0], [2.95, 5.0]], 28);
  const rotorHubInner = turned([0, 0, CAL.rotor.z + 2.2], [0, 0, 1], [[0, 2.9], [1.0, 2.9]], 18);
  let bearings = "";
  for (let i = 0; i < 5; i++) {
    const a = (TAU * i) / 5 + 0.3;
    bearings += drawMesh(turned([Math.cos(a) * 4.1, Math.sin(a) * 4.1, CAL.rotor.z + 2.3], [0, 0, 1], [[0, 0.7], [0.7, 0.7]], 10), cam, { material: "alloy", shine: true });
  }
  once("rotorHub", "rotor",
    drawMesh(rotorHubOuter, cam, { material: "steel", shine: true })
    + bearings
    + drawMesh(rotorHubInner, cam, { material: "ruby", shine: true }),
  );

  // Anchors for callout leaders — every dot lands squarely on its exposed physical component!
  const at = {
    rotor: S(Math.cos(22 * RAD) * 40, Math.sin(22 * RAD) * 40, CAL.rotor.z + 2.8),
    reversing: S(CAL.revA.x - 1.5, CAL.revA.y + 2.5, CAL.revA.z + 1.4),
    barrel: S(CAL.barrel.x - 14.0, CAL.barrel.y + 3.5, CAL.barrel.z + 4.0),
    // Lands directly on the bright vermilion slipping bridle rim lining the front-left of the barrel!
    bridle: S(CAL.barrel.x - 10.2, CAL.barrel.y - 7.5, CAL.barrel.z + 4.85),
    // Lands directly on the exposed golden brass center wheel rim in the open center window
    center: S(CAL.center.x + 6.5, CAL.center.y - 6.5, CAL.center.z + 1.5),
    fourth: S(CAL.fourth.x + 7.5, CAL.fourth.y - 5.5, CAL.fourth.z + 1.5),
    escape: S(CAL.escape.x + 5.0, CAL.escape.y - 5.0, CAL.escape.z + 1.4),
    fork: S(CAL.fork.x, CAL.fork.y - 3.2, CAL.fork.z + 1.3),
    balance: S(CAL.balance.x - 9.5, CAL.balance.y - 8.5, CAL.balance.z + 1.6),
    regulator: S(CAL.balance.x - 11.5, CAL.balance.y + 1.5, 14.5),
  };

  /** Compute one 60 fps frame for the movement state. */
  function pose(st) {
    const { rotorDeg, revDir, barrelDeg, windPct, slipping, trainDeg, esc, regRateDeg, hideRotor } = st;
    const items = [];

    items.push({ id: `${px}-caseBack`, key: 2 });
    items.push({ id: `${px}-mainplate`, key: 5 });
    items.push({ id: `${px}-arbors`, key: 8 });

    // Mainspring barrel drum + stationary slipping bridle + depth-sorted coiled mainspring ribbon
    const windLevel = Math.max(0, Math.min(8, Math.round((windPct / 100) * 8)));
    items.push({ id: `${px}-barrelFloor`, key: 11 });
    items.push({
      id: `${px}-barrel`, part: slipping ? "bridle" : "barrel", key: 12,
      ...turnedAt(barrelTurn, barrelDeg * RAD, CAL.barrel.x, CAL.barrel.y, CAL.barrel.z),
    });
    items.push({
      id: `${px}-mainspring`, part: "barrel", key: 13,
      href: mainspringTpl(windLevel),
      transform: place(0, CAL.barrel.x, CAL.barrel.y, 0, CAL.barrel.z),
    });
    items.push({
      id: `${px}-bridle`, part: slipping ? "bridle" : "barrel", key: 14,
      href: bridleTpl(slipping),
      transform: place(0, CAL.barrel.x, CAL.barrel.y, 0, CAL.barrel.z),
    });

    // Going train: meshing wheels alternate CW / CCW, every wheel binned for < 0.15 px accuracy!
    const centerRad = -trainDeg * 0.25 * RAD;
    const thirdRad = trainDeg * 0.8 * RAD;
    const fourthRad = -trainDeg * 2.4 * RAD;
    const escRad = esc.escapeDeg * RAD;

    items.push({ id: `${px}-cpin`, part: "train", key: 16, ...placeCenterPin(centerRad, CAL.center.x, CAL.center.y, CAL.center.z - 3.0) });
    items.push({ id: `${px}-center`, part: "train", key: 18, ...placeCenter(centerRad, CAL.center.x, CAL.center.y, CAL.center.z) });
    items.push({ id: `${px}-fpin`, part: "train", key: 19, ...placeFourthPin(fourthRad, CAL.fourth.x, CAL.fourth.y, CAL.fourth.z - 2.4) });
    items.push({ id: `${px}-fourth`, part: "train", key: 20, ...placeFourth(fourthRad, CAL.fourth.x, CAL.fourth.y, CAL.fourth.z) });
    items.push({ id: `${px}-tpin`, part: "train", key: 22, ...placeThirdPin(thirdRad, CAL.third.x, CAL.third.y, CAL.third.z - 2.8) });
    items.push({ id: `${px}-third`, part: "train", key: 23, ...placeThird(thirdRad, CAL.third.x, CAL.third.y, CAL.third.z) });

    // Swiss lever escapement: club-tooth escape wheel + ruby-stone pallet fork
    items.push({
      id: `${px}-escape`, part: "escapement", key: 25,
      ...turnedAt(escTurn, escRad, CAL.escape.x, CAL.escape.y, CAL.escape.z),
    });
    items.push({
      id: `${px}-fork`, part: "escapement", key: 27,
      ...turnedAt(forkTurn, esc.forkDeg * RAD, CAL.fork.x, CAL.fork.y, CAL.fork.z),
    });
    items.push({ id: `${px}-escBridge`, key: 28 });

    // Poised balance wheel + depth-sorted breathing hairspring
    const breathBin = Math.max(0, Math.min(8, Math.round(((esc.breath - 0.88) / 0.24) * 8)));
    items.push({
      id: `${px}-balance`, part: "balance", key: 30,
      ...turnedAt(balTurn, esc.balDeg * RAD, CAL.balance.x, CAL.balance.y, CAL.balance.z),
    });
    items.push({
      id: `${px}-hairspring`, part: "balance", key: 32,
      href: hairspringTpl(breathBin),
      transform: place(0, CAL.balance.x, CAL.balance.y, 0, CAL.balance.z + 2.0),
    });

    // Sculpted bridges + sweep second hand + regulator index
    items.push({ id: `${px}-trainBridge`, key: 35 });
    items.push({
      id: `${px}-secondHand`, part: "train", key: 36,
      ...turnedAt(handTurn, fourthRad, CAL.fourth.x, CAL.fourth.y, 14.4 - 0.275),
    });
    items.push({ id: `${px}-secondCap`, key: 37 });
    items.push({ id: `${px}-balanceCock`, key: 38 });
    const rDeg = Math.max(-40, Math.min(40, regRateDeg ?? 0));
    items.push({
      id: `${px}-regArm`, part: "regulator", key: 40,
      ...turnedAt(regTurn, rDeg * RAD, CAL.balance.x, CAL.balance.y, 14.3 - 0.475),
    });

    // Coplanar automatic winding train: rotor pinion <-> twin reversing wheels <-> barrel ratchet
    const rRad = rotorDeg * RAD;
    items.push({ id: `${px}-rotorPin`, part: "reversing", key: 42, ...placeRotorPin(rRad, CAL.center.x, CAL.center.y, CAL.revB.z) });
    items.push({ id: `${px}-ratchet`, part: "reversing", key: 43, ...placeRatchet(barrelDeg * RAD, CAL.barrel.x, CAL.barrel.y, CAL.revA.z) });
    items.push({ id: `${px}-revB`, part: "reversing", key: 44, ...(revDir < 0 ? placeRevTeal : placeRevSteel)(-rRad * 1.26, CAL.revB.x, CAL.revB.y, CAL.revB.z) });
    items.push({ id: `${px}-revA`, part: "reversing", key: 45, ...(revDir >= 0 ? placeRevTeal : placeRevSteel)(rRad * 1.26, CAL.revA.x, CAL.revA.y, CAL.revA.z) });

    // Ball-bearing oscillating rotor (36 angle bins -> true rotating 3D light!)
    items.push({
      id: `${px}-rotor`, part: "rotor", key: 50,
      hidden: !!hideRotor,
      ...turnedAt(rotorTurn, rRad, CAL.rotor.x, CAL.rotor.y, CAL.rotor.z),
    });
    items.push({ id: `${px}-rotorHub`, part: "rotor", key: 52, hidden: !!hideRotor });

    const liveRotorAt = S(Math.cos(rRad) * 40, Math.sin(rRad) * 40, CAL.rotor.z + 2.8);
    return { items, at: { ...at, rotor: liveRotorAt }, defs: drainDefs() };
  }

  return { parts, pose };
}

/**
 * Magnified 4.5 : 1 Horological Loupe (VIEW A) of the Swiss Lever Escapement.
 * Exact 2.5-pitch (60 deg) ruby pallet stone geometry, 52 deg lift angle, banking-pin contact,
 * and bevel-shaded watchmaker drafting craft.
 */
export function renderEscapementLoupe(inset, esc, M) {
  const [cx, cy] = inset.c;
  const R = inset.r;
  const ex = cx + R * 0.44, ey = cy;
  const fx = cx - R * 0.22, fy = cy;
  const bx = cx - R * 0.78, by = cy;
  const D = ex - fx;

  let ticks = "";
  for (let i = 0; i < 36; i++) {
    const a = (TAU * i) / 36;
    const len = i % 3 === 0 ? 70 : 38;
    const r0 = R - len, r1 = R - 10;
    ticks += `M${n1(cx + Math.cos(a) * r0)},${n1(cy + Math.sin(a) * r0)}L${n1(cx + Math.cos(a) * r1)},${n1(cy + Math.sin(a) * r1)}`;
  }

  const escR = R * 0.42, escRoot = escR * 0.68;
  const escRot = (esc.escapeDeg + 9.2) * RAD;
  const toothPts = escapeWheelOutline(15, escR, escRoot, escRot).map(([x, y]) => [ex + x, ey - y]);
  const escPath = pathThrough(toothPts, true);
  let escSpokes = "";
  for (let i = 0; i < 3; i++) {
    const a0 = escRot + (TAU * i) / 3 + 0.22;
    const a1 = a0 + TAU / 3 - 0.44;
    const pts = arcOutline(escR * 0.22, escR * 0.56, a0, a1, 10).map(([x, y]) => [ex + x, ey - y]);
    escSpokes += `<path class="loupe-hole" d="${pathThrough(pts, true)}"/>`;
  }

  const fRad = -esc.forkDeg * RAD;
  const rotF = (lx, ly) => [
    fx + lx * Math.cos(fRad) - ly * Math.sin(fRad),
    fy + lx * Math.sin(fRad) + ly * Math.cos(fRad),
  ];
  const stonePt = (rFrac, degYUp) => {
    const a = degYUp * RAD;
    return [D + escR * rFrac * Math.cos(a), -escR * rFrac * Math.sin(a)];
  };
  const entryStone = [
    stonePt(0.985, 144.0), stonePt(0.995, 150.0), stonePt(1.115, 151.5), stonePt(1.105, 145.5),
  ].map(([x, y]) => rotF(x, y));
  const exitStone = [
    stonePt(0.995, -150.0), stonePt(0.985, -144.0), stonePt(1.105, -145.5), stonePt(1.115, -151.5),
  ].map(([x, y]) => rotF(x, y));

  const armLen = R * 0.34;
  const eRoot = stonePt(1.07, 148.5), eOut = stonePt(1.13, 148.5);
  const xRoot = stonePt(1.07, -148.5), xOut = stonePt(1.13, -148.5);
  const forkPoly = [
    [-armLen * 1.04, -56], [-armLen * 0.86, -86], [-armLen * 0.86, -34],
    [0, -38], [eOut[0] - 40, eOut[1] - 10], [eRoot[0] + 15, eRoot[1] + 24], [armLen * 0.28, -32],
    [armLen * 0.28, 32], [xRoot[0] + 15, xRoot[1] - 24], [xOut[0] - 40, xOut[1] + 10],
    [0, 38], [-armLen * 0.86, 34], [-armLen * 0.86, 86], [-armLen * 1.04, 56],
  ].map(([x, y]) => rotF(x, y));

  const rolR = R * 0.25;
  const jAng = clampDeg(esc.balDeg, -140, 140) * RAD;
  const jx = bx + Math.cos(jAng) * (rolR * 0.86);
  const jy = by + Math.sin(jAng) * (rolR * 0.86);

  const bpX = fx - armLen * 0.56;
  const bpOffset = armLen * 0.56 * Math.sin(6.5 * RAD) + 36 + 30;
  const bpTop = [bpX, fy - bpOffset];
  const bpBot = [bpX, fy + bpOffset];

  const phLabel = esc.phase.toUpperCase();
  const isImp = esc.phase === "impulse";
  const isUnl = esc.phase === "unlock";
  const phCls = isImp ? "is-imp" : isUnl ? "is-unl" : "is-lock";

  return `<g class="loupe">`
    + `<path class="loupe-axis" d="M${n1(cx - R)},${n1(cy)}H${n1(cx + R)}M${n1(ex)},${n1(cy - R)}V${n1(cy + R)}${ticks}"/>`
    + `<circle class="loupe-sh" cx="${n1(bx + 18)}" cy="${n1(by + 24)}" r="${n1(rolR)}"/>`
    + `<circle class="loupe-roller" cx="${n1(bx)}" cy="${n1(by)}" r="${n1(rolR)}"/>`
    + `<circle class="loupe-bevel" cx="${n1(bx)}" cy="${n1(by)}" r="${n1(rolR * 0.88)}"/>`
    + `<circle class="loupe-chaton" cx="${n1(bx)}" cy="${n1(by)}" r="76"/>`
    + `<circle class="loupe-ruby" cx="${n1(bx)}" cy="${n1(by)}" r="52"/>`
    + `<circle class="loupe-pivot" cx="${n1(bx)}" cy="${n1(by)}" r="22"/>`
    + `<circle class="loupe-ruby${isImp || isUnl ? " is-hot" : ""}" cx="${n1(jx)}" cy="${n1(jy)}" r="54"/>`
    + `<circle class="loupe-spec" cx="${n1(jx - 16)}" cy="${n1(jy - 16)}" r="14"/>`
    + `<g transform="translate(18 24)"><path class="loupe-sh" d="${escPath}"/></g>`
    + `<path class="loupe-brass" d="${escPath}"/>${escSpokes}`
    + `<circle class="loupe-bevel" cx="${n1(ex)}" cy="${n1(ey)}" r="${n1(escRoot * 0.94)}"/>`
    + `<circle class="loupe-chaton" cx="${n1(ex)}" cy="${n1(ey)}" r="94"/>`
    + `<circle class="loupe-ruby" cx="${n1(ex)}" cy="${n1(ey)}" r="64"/>`
    + `<circle class="loupe-pivot" cx="${n1(ex)}" cy="${n1(ey)}" r="26"/>`
    + `<circle class="loupe-pin" cx="${n1(bpTop[0])}" cy="${n1(bpTop[1])}" r="30"/>`
    + `<circle class="loupe-pin" cx="${n1(bpBot[0])}" cy="${n1(bpBot[1])}" r="30"/>`
    + `<g transform="translate(14 20)"><path class="loupe-sh" d="${pathThrough(forkPoly, true)}"/></g>`
    + `<path class="loupe-steel" d="${pathThrough(forkPoly, true)}"/>`
    + `<path class="loupe-ruby${isImp ? " is-hot" : ""}" d="${pathThrough(entryStone, true)}"/>`
    + `<path class="loupe-ruby${isImp ? " is-hot" : ""}" d="${pathThrough(exitStone, true)}"/>`
    + `<circle class="loupe-chaton" cx="${n1(fx)}" cy="${n1(fy)}" r="64"/>`
    + `<circle class="loupe-pivot" cx="${n1(fx)}" cy="${n1(fy)}" r="34"/>`
    + `<rect class="loupe-badge ${phCls}" x="${n1(cx - 810)}" y="${n1(cy + R * 0.58)}" width="1620" height="270" rx="135"/>`
    + `<text class="loupe-badge-txt ${phCls}" x="${n1(cx)}" y="${n1(cy + R * 0.58 + 178)}" text-anchor="middle">${phLabel} · ${M.N.beatsPerSec} BEATS/S</text>`
    + `</g>`;
}

const clampDeg = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
