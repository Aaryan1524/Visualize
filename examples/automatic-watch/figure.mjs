// Automatic mechanical watch movement on Visualize's upgraded rig (src/rig):
// Cutaway isometric calibre (Mainplate, Mainspring Barrel with coiled spring & slipping bridle,
// 4-wheel Going Train, Swiss Lever Escapement, Balance Wheel & breathing Hairspring, Twin
// Reversing Wheels and Oscillating Rotor), paired with View A: a magnified 4.5:1 horological
// loupe of the Swiss lever escapement cycling Lock -> Unlock -> Impulse -> Drop at 60 fps.
//
// Performance contract: every turning wheel, rotor, fork and balance assembly is drawn ONCE
// into <defs> and placed every frame with one exact affine transform via moveInPlane().

import {
  affineString, angleBin, arcOutline, axesOf, chamferPlate, circlePoints, contactShadow, drawMesh,
  escapeWheelOutline, fitCamera, gearOutline, keyLight, linesOn, moveInPlane, n1, pathThrough,
  planeOf, plate, RigStage, rod, roundedHull, scale, screenOf, spiralPoints, spokedHoles,
  tube, turned,
} from "../../src/rig/index.ts";
export { RigStage, screenOf } from "../../src/rig/index.ts";

export const VIEW = { azimuth: 236, elevation: 34 };
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const FLOOR = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]); // horizontal movement plane, normal +z
const FLOOR_AXES = { origin: [0, 0, 0], u: FLOOR.u, v: FLOOR.v, n: FLOOR.n };

// Calibre layout in movement-scale units (25.6 mm calibre scaled ~3.8x for crisp geometry)
// Every meshing pair distance equals R_a + R_b (exact pitch-circle tangency!)
export const CAL = {
  plateR: 50,
  barrel: { x: -20, y: 12, r: 16.5, rRatchet: 8.2, z: 5 },
  center: { x: 0, y: 0, r: 14.5, pinR: 6.8, rotorPinR: 9.3, z: 9.5 },
  third:  { x: 18.5, y: 12.5, r: 12.5, pinR: 4.4, z: 13.5 },
  fourth: { x: 26, y: -8, r: 11.5, pinR: 4.0, z: 10.5 },
  escape: { x: 9.5, y: -23, r: 9.8, pinR: 3.4, z: 13.5 },
  fork:   { x: -5.5, y: -24.5, z: 14.2 },
  balance:{ x: -22.5, y: -21.5, r: 15.2, z: 16.5 },
  // Exact pitch-circle tangency: center rotor pinion (9.3) <-> revB (7.2) <-> revA (7.4) <-> barrel ratchet (8.2)
  revB:   { x: 1.5, y: 16.5, r: 7.2, z: 19.6 },
  revA:   { x: -10.8, y: 24.5, r: 7.4, z: 19.6 },
  rotor:  { x: 0, y: 0, rIn: 31, rOut: 47.5, z: 26.5 },
};

export function cameraFor(box) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (TAU * i) / 16;
    for (const z of [-2, 32]) pts.push([52 * Math.cos(a), 52 * Math.sin(a), z]);
  }
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/** Draw a watchmaker spoked brass wheel centered at origin on z = 0..th. */
function wheelMesh(teeth, pitchR, th, spokes = 5, hubR = 3.2) {
  const outer = gearOutline(teeth, pitchR, { addendum: pitchR * 0.085, dedendum: pitchR * 0.1 });
  const holes = [circlePoints(hubR * 0.55, 16)];
  if (pitchR > 8.5) holes.push(...spokedHoles(hubR + 1.2, pitchR * 0.77, spokes, 0.15, 0, 8));
  return plate(FLOOR, { outer, holes }, 0, th);
}

/** Build the complete isometric watch movement figure. */
export function figure(M, cam, opts = {}) {
  const px = opts.prefix ?? "aw";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const L = keyLight(ax);
  const shOff = scale(L, -2.2);
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
  const place = (theta, x, y, z) => affineString(moveInPlane(cam, FLOOR_AXES, theta, [x, y], 0, z));

  // ---- Static calibre foundation: chamfered mainplate, jewel bearings & cutaway bridges
  const mainplate = chamferPlate(FLOOR, circlePoints(CAL.plateR, 56), -4, 3.6, 1.3);
  const bezel = plate(FLOOR, { outer: circlePoints(CAL.plateR + 2.4, 56), holes: [circlePoints(CAL.plateR - 1.5, 48)] }, -3.2, 5.2);
  const jewels = [CAL.center, CAL.third, CAL.fourth, CAL.escape, CAL.fork, CAL.balance, CAL.revA, CAL.revB]
    .map((p) => drawMesh(turned([p.x, p.y, 3.6], [0, 0, 1], [[0, 2.2], [0.9, 2.2], [1.2, 1.4]], 18), cam, { material: "ruby", shine: true }))
    .join("");
  // Subtle circular perlage rings etched on the mainplate + 12 crisp hour index ticks on bezel
  const perlage = [];
  for (const r of [18, 32, 43]) {
    const ring = circlePoints(r, 40);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      perlage.push([[a[0], a[1], 3.7], [b[0], b[1], 3.7]]);
    }
  }
  const hourTicks = [];
  for (let i = 0; i < 12; i++) {
    const a = (TAU * i) / 12;
    const r0 = i % 3 === 0 ? CAL.plateR - 1.3 : CAL.plateR - 0.7;
    hourTicks.push([[Math.cos(a) * r0, Math.sin(a) * r0, 5.25], [Math.cos(a) * (CAL.plateR + 1.9), Math.sin(a) * (CAL.plateR + 1.9), 5.25]]);
  }
  once("mainplate", "plate",
    contactShadow(mainplate, cam, shOff)
    + drawMesh(mainplate, cam, { material: "frame", shine: false, crease: 25 })
    + drawMesh(bezel, cam, { material: "steel", shine: true })
    + linesOn(cam, perlage, "rig-deck-grid")
    + linesOn(cam, hourTicks, "rig-sil")
    + jewels,
  );

  // Train bridge (cutaway steel arc holding center, third & fourth pivots)
  const bridgeOutline = roundedHull([[CAL.third.x, CAL.third.y, 6.2], [CAL.fourth.x, CAL.fourth.y, 5.8], [34, 4, 5.2]]);
  const bridge = plate(FLOOR, { outer: bridgeOutline, holes: [circlePoints(2.2, 16, CAL.third.x, CAL.third.y), circlePoints(2.2, 16, CAL.fourth.x, CAL.fourth.y)] }, 16.2, 18.2);
  once("trainBridge", "train",
    contactShadow(bridge, cam, shOff)
    + drawMesh(bridge, cam, { material: "alloy", shine: true })
    + drawMesh(turned([CAL.third.x, CAL.third.y, 18.2], [0, 0, 1], [[0, 2.0], [0.8, 2.0]], 16), cam, { material: "ruby", shine: true })
    + drawMesh(turned([CAL.fourth.x, CAL.fourth.y, 18.2], [0, 0, 1], [[0, 2.0], [0.8, 2.0]], 16), cam, { material: "ruby", shine: true }),
  );

  // Balance cock bridge holding the balance shock jewel & regulator pivot
  const cockOutline = roundedHull([[CAL.balance.x, CAL.balance.y, 4.4], [-38, -28, 5.4], [-42, -14, 4.6]]);
  const cock = plate(FLOOR, { outer: cockOutline, holes: [circlePoints(2.2, 16, CAL.balance.x, CAL.balance.y)] }, 20.6, 22.4);
  once("balanceCock", "balance",
    contactShadow(cock, cam, shOff)
    + drawMesh(cock, cam, { material: "alloy", shine: true })
    + drawMesh(turned([CAL.balance.x, CAL.balance.y, 22.4], [0, 0, 1], [[0, 2.5], [1.0, 2.5], [1.3, 1.5]], 20), cam, { material: "ruby", shine: true }),
  );

  // ---- Reusable drawn-once turning wheels (binned across symmetry where thick)
  const barrelDrumTpl = (slipping) => tpl(`barrel-${slipping ? 1 : 0}`, () => {
    const outer = gearOutline(44, CAL.barrel.r, { addendum: 1.0, dedendum: 1.1 });
    const drum = plate(FLOOR, { outer, holes: [circlePoints(CAL.barrel.r - 2.3, 36)] }, 0, 5.4);
    const floorDisc = plate(FLOOR, { outer: circlePoints(CAL.barrel.r - 1.8, 32), holes: [circlePoints(3.2, 16)] }, 0, 1.1);
    const arbor = turned([0, 0, 0], [0, 0, 1], [[0, 3.3], [6.4, 3.3], [7.0, 2.4]], 20);
    // Slipping bridle lining the inner barrel rim (lights vermilion when slipping at 100% wind!)
    const bridle = plate(FLOOR, { outer: arcOutline(CAL.barrel.r - 3.3, CAL.barrel.r - 2.35, -1.8, 1.6, 24) }, 1.2, 4.8);
    return drawMesh(floorDisc, cam, { material: "slate" })
      + drawMesh(drum, cam, { material: "brass", shine: true })
      + drawMesh(bridle, cam, { material: slipping ? "subject" : "steel", shine: true })
      + drawMesh(arbor, cam, { material: "steel", shine: true });
  });

  // Coiled mainspring templates quantized across wind levels (0..8):
  // Outer coil stays pressed firmly against the slipping bridle (r1 fixed), while inner coils tighten around the arbor!
  const mainspringTpl = (level) => tpl(`mspr-${level}`, () => {
    const windF = level / 8;
    const turns = 3.2 + windF * 2.2;
    const r0 = 5.6 - windF * 2.0;
    const r1 = CAL.barrel.r - 3.35; // always seated against inner face of slipping bridle!
    const pts = spiralPoints(FLOOR, r0, r1, turns, 84, 3.0, 3.0, 0);
    return drawMesh(tube(pts, 0.55, 8), cam, { material: "cobalt", shine: true });
  });

  // Coaxial steel barrel ratchet wheel (meshes directly with revA to wind the mainspring arbor)
  const ratchetTpl = tpl("ratchet", () =>
    drawMesh(wheelMesh(26, CAL.barrel.rRatchet, 1.4, 4, 2.4), cam, { material: "steel", shine: true })
    + drawMesh(turned([0, 0, 1.4], [0, 0, 1], [[0, 2.4], [0.9, 2.4]], 16), cam, { material: "alloy", shine: true }),
  );
  // Center rotor driving wheel (coaxial on rotor hub, meshes directly with revB)
  const rotorPinionTpl = tpl("rotorPinion", () =>
    drawMesh(wheelMesh(28, CAL.center.rotorPinR, 1.4, 5, 3.0), cam, { material: "steel", shine: true }),
  );

  const centerTpl = tpl("center", () =>
    drawMesh(wheelMesh(38, CAL.center.r, 1.6, 5, 3.6), cam, { material: "brass", shine: true })
    + drawMesh(plate(FLOOR, { outer: gearOutline(12, CAL.center.pinR, { addendum: 0.7, dedendum: 0.7 }), holes: [circlePoints(1.8, 14)] }, -4.0, 0), cam, { material: "steel", shine: true })
    + drawMesh(turned([0, 0, 1.6], [0, 0, 1], [[0, 2.2], [3.6, 2.2]], 18), cam, { material: "steel", shine: true }),
  );
  const thirdTpl = tpl("third", () =>
    drawMesh(wheelMesh(34, CAL.third.r, 1.5, 5, 2.8), cam, { material: "brass", shine: true })
    + drawMesh(plate(FLOOR, { outer: gearOutline(10, CAL.third.pinR, { addendum: 0.55, dedendum: 0.6 }), holes: [circlePoints(1.3, 12)] }, -3.4, 0), cam, { material: "steel", shine: true }),
  );
  const fourthTpl = tpl("fourth", () =>
    drawMesh(wheelMesh(32, CAL.fourth.r, 1.5, 5, 2.6), cam, { material: "brass", shine: true })
    + drawMesh(plate(FLOOR, { outer: gearOutline(10, CAL.fourth.pinR, { addendum: 0.5, dedendum: 0.55 }), holes: [circlePoints(1.2, 12)] }, -2.8, 0), cam, { material: "steel", shine: true })
    + drawMesh(plate(FLOOR, { outer: [[-2.5, -0.45], [CAL.fourth.r * 0.92, -0.2], [CAL.fourth.r * 0.92, 0.2], [-2.5, 0.45]] }, 1.6, 2.3), cam, { material: "cobalt", shine: true }),
  );
  const escapeTpl = tpl("escape", () => {
    const outer = escapeWheelOutline(15, CAL.escape.r, CAL.escape.r * 0.68);
    const holes = [circlePoints(1.6, 14), ...spokedHoles(2.5, CAL.escape.r * 0.56, 3, 0.2, 0, 8)];
    return drawMesh(plate(FLOOR, { outer, holes }, 0, 1.3), cam, { material: "brass", shine: true })
      + drawMesh(turned([0, 0, -2.5], [0, 0, 1], [[0, 2.1], [4.2, 2.1]], 16), cam, { material: "steel", shine: true });
  });

  // Pallet fork (centered at fork pivot, rocking +/- 6.5 deg)
  const forkTpl = tpl("fork", () => {
    // Anchor arms reaching toward escape wheel (+x) and lever arm toward balance wheel (-x)
    const arm = roundedHull([[-11, 0, 1.1], [0, 0, 2.1], [7.5, 4.4, 1.2]]);
    const arm2 = roundedHull([[0, 0, 1.9], [7.5, -4.4, 1.2]]);
    const stoneA = plate(FLOOR, { outer: [[6.2, 3.2], [9.0, 4.0], [8.5, 5.4], [5.8, 4.5]] }, 0.1, 1.5);
    const stoneB = plate(FLOOR, { outer: [[6.2, -4.5], [8.8, -5.2], [9.2, -3.7], [6.6, -3.0]] }, 0.1, 1.5);
    return drawMesh(plate(FLOOR, { outer: arm }, 0, 1.3), cam, { material: "steel", shine: true })
      + drawMesh(plate(FLOOR, { outer: arm2 }, 0, 1.3), cam, { material: "steel", shine: true })
      + drawMesh(stoneA, cam, { material: "ruby", shine: true })
      + drawMesh(stoneB, cam, { material: "ruby", shine: true });
  });

  // Poised balance wheel (spoked brass rim + timing screws)
  const balanceTpl = tpl("balance", () => {
    const r = CAL.balance.r;
    const rim = plate(FLOOR, { outer: circlePoints(r, 44), holes: [circlePoints(2.2, 16), ...spokedHoles(3.2, r - 2.4, 3, 0.17, 0.3, 12)] }, 0, 1.9);
    const hub = turned([0, 0, -1.6], [0, 0, 1], [[0, 2.4], [4.2, 2.4]], 18);
    // Timing poise weights around rim
    let weights = "";
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6;
      weights += drawMesh(turned([Math.cos(a) * (r + 0.5), Math.sin(a) * (r + 0.5), 0.3], [0, 0, 1], [[0, 0.9], [1.2, 0.9]], 10), cam, { material: "alloy", shine: true });
    }
    return drawMesh(rim, cam, { material: "brass", shine: true }) + drawMesh(hub, cam, { material: "steel", shine: true }) + weights;
  });

  // Breathing hairspring templates (quantized into 9 breathing radii so zero mesh rebuilds at 60fps!)
  const hairspringTpl = (bin) => tpl(`hspr-${bin}`, () => {
    const f = 0.88 + (bin / 8) * 0.24; // 0.88..1.12 breathing scale
    const pts = spiralPoints(FLOOR, 2.6, 10.6 * f, 4.2, 72, 2.4, 2.4, 0.4);
    return drawMesh(tube(pts, 0.32, 7), cam, { material: "cobalt", shine: true });
  });

  // Regulator index pointer arm (turns slightly around balance pivot to lengthen/shorten active spring)
  const regArmTpl = tpl("regArm", () => {
    const arm = roundedHull([[0, 0, 2.2], [-14.5, 0, 1.0]]);
    const pin = rod([-10.5, 0, -1.6], [-10.5, 0, 1.6], 0.65, 10);
    return drawMesh(plate(FLOOR, { outer: arm }, 0, 1.1), cam, { material: "subject", shine: true })
      + drawMesh(pin, cam, { material: "brass", shine: true });
  });

  // Twin reversing click wheels (bidirectional rotor -> unidirectional barrel winding)
  const revTpl = (mat) => tpl(`rev-${mat}`, () =>
    drawMesh(wheelMesh(22, CAL.revA.r, 1.5, 4, 2.2), cam, { material: mat, shine: true })
    + drawMesh(turned([0, 0, 1.5], [0, 0, 1], [[0, 1.8], [1.0, 1.8]], 14), cam, { material: "alloy", shine: true }),
  );

  // Weighted semicircular Oscillating Rotor (drawn at 12 angle bins so thick rim bevel stays razor-sharp)
  const ROTOR_BINS = 12;
  const rotorTpl = (bin) => tpl(`rotor-${bin}`, () => {
    const rot = (bin * TAU) / ROTOR_BINS;
    const weightArc = arcOutline(CAL.rotor.rIn, CAL.rotor.rOut, rot - Math.PI * 0.48, rot + Math.PI * 0.48, 32);
    const weight = chamferPlate(FLOOR, weightArc, 0, 3.0, 0.7);
    // Open-worked inner skeleton arm so you see the gears turning beneath the rotor!
    const armAngles = [rot - 1.15, rot, rot + 1.15];
    let arms = "";
    for (const a of armAngles) {
      const p1 = [Math.cos(a) * (CAL.rotor.rIn + 2.5), Math.sin(a) * (CAL.rotor.rIn + 2.5)];
      arms += drawMesh(plate(FLOOR, { outer: roundedHull([[0, 0, 4.6], [p1[0], p1[1], 2.2]]) }, 0.6, 2.0), cam, { material: "alloy", shine: true });
    }
    const hub = turned([0, 0, -0.5], [0, 0, 1], [[0, 6.4], [2.4, 6.4], [3.0, 5.2]], 28);
    const cap = turned([0, 0, 2.5], [0, 0, 1], [[0, 2.8], [1.0, 2.8]], 18);
    return contactShadow(weight, cam, shOff)
      + arms
      + drawMesh(weight, cam, { material: "subject", shine: true })
      + drawMesh(hub, cam, { material: "steel", shine: true })
      + drawMesh(cap, cam, { material: "ruby", shine: true });
  });

  // Anchors for callout leaders
  const at = {
    rotor: S(CAL.rotor.rOut * 0.85, -16, CAL.rotor.z + 2),
    reversing: S(CAL.revA.x - 3, CAL.revA.y + 3, CAL.revA.z + 1.5),
    barrel: S(CAL.barrel.x - 15.8, CAL.barrel.y + 4, CAL.barrel.z + 4),
    // Lands directly on the bright vermilion slipping bridle lining the barrel inner rim
    bridle: S(CAL.barrel.x - 13.7, CAL.barrel.y - 3.0, CAL.barrel.z + 4.8),
    center: S(CAL.center.x + 10, CAL.center.y + 4, CAL.center.z + 2),
    fourth: S(CAL.fourth.x + 11, CAL.fourth.y - 4, CAL.fourth.z + 2),
    escape: S(CAL.escape.x + 7, CAL.escape.y - 6, CAL.escape.z + 2),
    fork: S(CAL.fork.x, CAL.fork.y - 5, CAL.fork.z + 2),
    balance: S(CAL.balance.x - 12, CAL.balance.y - 6, CAL.balance.z + 2),
    regulator: S(CAL.balance.x - 14, CAL.balance.y + 6, CAL.balance.z + 5),
  };

  /** Compute one 60 fps frame for the movement state. */
  function pose(st) {
    const { rotorDeg, revDir, barrelDeg, windPct, slipping, trainDeg, esc, regRateDeg, hideRotor } = st;
    const items = [];

    // Strict layer-by-layer painter's order (bottom mainplate -> barrel -> going train -> escapement -> bridges -> rotor)
    items.push({ id: `${px}-mainplate`, key: 5 });

    // Mainspring barrel + coiled mainspring inside
    const windLevel = Math.max(0, Math.min(8, Math.round((windPct / 100) * 8)));
    items.push({
      id: `${px}-barrel`, part: slipping ? "bridle" : "barrel", key: 12,
      href: barrelDrumTpl(slipping),
      transform: place(barrelDeg * RAD, CAL.barrel.x, CAL.barrel.y, CAL.barrel.z),
    });
    items.push({
      id: `${px}-mainspring`, part: "barrel", key: 14,
      href: mainspringTpl(windLevel),
      transform: place(barrelDeg * RAD, CAL.barrel.x, CAL.barrel.y, CAL.barrel.z),
    });

    // Going train: meshing wheels alternate CW / CCW!
    const centerRad = -trainDeg * 0.25 * RAD;
    const thirdRad = trainDeg * 0.8 * RAD;
    const fourthRad = -trainDeg * 2.4 * RAD;
    const escRad = esc.escapeDeg * RAD;

    items.push({ id: `${px}-center`, part: "train", key: 18, href: centerTpl, transform: place(centerRad, CAL.center.x, CAL.center.y, CAL.center.z) });
    items.push({ id: `${px}-fourth`, part: "train", key: 20, href: fourthTpl, transform: place(fourthRad, CAL.fourth.x, CAL.fourth.y, CAL.fourth.z) });
    items.push({ id: `${px}-third`, part: "train", key: 23, href: thirdTpl, transform: place(thirdRad, CAL.third.x, CAL.third.y, CAL.third.z) });
    items.push({ id: `${px}-escape`, part: "escapement", key: 25, href: escapeTpl, transform: place(escRad, CAL.escape.x, CAL.escape.y, CAL.escape.z) });
    items.push({ id: `${px}-fork`, part: "escapement", key: 27, href: forkTpl, transform: place(esc.forkDeg * RAD, CAL.fork.x, CAL.fork.y, CAL.fork.z) });

    // Balance wheel + breathing hairspring + bridges + regulator index
    const balRad = esc.balDeg * RAD;
    const breathBin = Math.max(0, Math.min(8, Math.round(((esc.breath - 0.88) / 0.24) * 8)));
    items.push({ id: `${px}-balance`, part: "balance", key: 30, href: balanceTpl, transform: place(balRad, CAL.balance.x, CAL.balance.y, CAL.balance.z) });
    items.push({ id: `${px}-hairspring`, part: "balance", key: 32, href: hairspringTpl(breathBin), transform: place(0, CAL.balance.x, CAL.balance.y, CAL.balance.z) });
    items.push({ id: `${px}-trainBridge`, key: 35 });
    items.push({ id: `${px}-balanceCock`, key: 38 });
    items.push({
      id: `${px}-regArm`, part: "regulator", key: 40,
      href: regArmTpl,
      transform: place((regRateDeg ?? 0) * RAD, CAL.balance.x, CAL.balance.y, CAL.balance.z + 5.2),
    });

    // Twin reversing wheels + meshing rotor drive wheel + barrel ratchet wheel (zero floating gears!)
    const rRad = rotorDeg * RAD;
    items.push({
      id: `${px}-rotorPin`, part: "reversing", key: 42,
      href: rotorPinionTpl,
      transform: place(rRad, CAL.center.x, CAL.center.y, CAL.revB.z),
    });
    items.push({
      id: `${px}-ratchet`, part: "reversing", key: 43,
      href: ratchetTpl,
      transform: place(barrelDeg * RAD, CAL.barrel.x, CAL.barrel.y, CAL.revA.z),
    });
    items.push({
      id: `${px}-revB`, part: "reversing", key: 44,
      href: revTpl(revDir < 0 ? "teal" : "steel"),
      transform: place(-rRad * 1.3, CAL.revB.x, CAL.revB.y, CAL.revB.z),
    });
    items.push({
      id: `${px}-revA`, part: "reversing", key: 45,
      href: revTpl(revDir >= 0 ? "teal" : "steel"),
      transform: place(rRad * 1.3, CAL.revA.x, CAL.revA.y, CAL.revA.z),
    });

    // Oscillating Rotor on top (binned every 30 deg + exact rest transform)
    const rb = angleBin(rRad, TAU, ROTOR_BINS);
    items.push({
      id: `${px}-rotor`, part: "rotor", key: 52,
      hidden: !!hideRotor,
      href: rotorTpl(rb.bin),
      transform: place(rb.rest, CAL.rotor.x, CAL.rotor.y, CAL.rotor.z),
    });

    // Track rotor weight live with callout leader
    const liveRotorAt = S(Math.cos(rRad) * 41, Math.sin(rRad) * 41, CAL.rotor.z + 2.5);
    return { items, at: { ...at, rotor: liveRotorAt }, defs: drainDefs() };
  }

  return { parts, pose };
}

/**
 * Magnified 4.5 : 1 Horological Loupe (VIEW A) of the Swiss Lever Escapement.
 * Shows exact club teeth engaging the entry & exit ruby pallet stones, impulse jewel kicking
 * inside the fork slot, banking pins and live phase readout (LOCK / UNLOCK / IMPULSE / DROP).
 */
export function renderEscapementLoupe(inset, esc, M) {
  const [cx, cy] = inset.c;
  const R = inset.r;
  // Exact Swiss lever escapement geometry (2.5-pitch = 60 deg pallet span at +/- 150 deg around escape wheel):
  // Escape wheel right, pallet fork pivot center-left, balance roller left.
  const ex = cx + R * 0.44, ey = cy;
  const fx = cx - R * 0.22, fy = cy;
  const bx = cx - R * 0.78, by = cy;
  const D = ex - fx;

  // 15-tooth Swiss club-tooth escape wheel: +esc.escapeDeg rotates CCW on screen (club tips leading forward)
  // Phase offset (+9.2 deg) aligns tooth #5 club tip right against entry locking face at Beat 0 (0 deg)
  // and tooth #7 right against exit locking face at Beat 1 (12 deg), with exact 2.5-pitch (60 deg) span!
  const escR = R * 0.42, escRoot = escR * 0.68;
  const escRot = (esc.escapeDeg + 9.2) * RAD;
  const toothPts = escapeWheelOutline(15, escR, escRoot, escRot)
    .map(([x, y]) => [ex + x, ey - y]);
  const escPath = pathThrough(toothPts, true);
  let escSpokes = "";
  for (let i = 0; i < 3; i++) {
    const a0 = escRot + (TAU * i) / 3 + 0.22;
    const a1 = a0 + TAU / 3 - 0.44;
    const pts = arcOutline(escR * 0.22, escR * 0.56, a0, a1, 10).map(([x, y]) => [ex + x, ey - y]);
    escSpokes += `<path class="loupe-hole" d="${pathThrough(pts, true)}"/>`;
  }

  // Pallet fork rotated by esc.forkDeg about (fx, fy) in SVG screen coords (y down):
  // forkDeg = -6.5 deg -> fRad = +6.5 deg (CW on screen) -> entry (upper) stone swings DOWN/IN to lock (~0.92 * escR),
  //   exit (lower) stone swings DOWN/OUT clear of wheel (> 1.05 * escR).
  // forkDeg = +6.5 deg -> fRad = -6.5 deg (CCW on screen) -> exit (lower) stone swings UP/IN to lock (~0.92 * escR),
  //   entry (upper) stone swings UP/OUT clear of wheel (> 1.05 * escR).
  const fRad = -esc.forkDeg * RAD;
  const rotF = (lx, ly) => [
    fx + lx * Math.cos(fRad) - ly * Math.sin(fRad),
    fy + lx * Math.sin(fRad) + ly * Math.cos(fRad),
  ];
  // Construct exact stone coordinates at neutral (forkDeg = 0) on r_mid = 0.99 * escR at +/- 149 deg from escape wheel:
  // In fork-local coords (x right toward escape wheel, y down):
  //   from (ex, ey), point at angle alpha (y-up) is (D + r*cos(alpha), -r*sin(alpha)) relative to (fx, fy).
  const stonePt = (rFrac, degYUp) => {
    const a = degYUp * RAD;
    return [D + escR * rFrac * Math.cos(a), -escR * rFrac * Math.sin(a)];
  };
  // Entry stone (upper) & Exit stone (lower): symmetric around 180 deg, calibrated so in their LOCKED
  // positions (+/- 6.5 deg fork swing) their locking faces sit exactly 2.5 tooth pitches (60.0 deg) apart
  // at 146.7 deg and 206.4 deg, while the idle stone clears > 1.08 * escR!
  const entryStone = [
    stonePt(0.985, 144.0),
    stonePt(0.995, 150.0),
    stonePt(1.115, 151.5),
    stonePt(1.105, 145.5),
  ].map(([x, y]) => rotF(x, y));
  const exitStone = [
    stonePt(0.995, -150.0),
    stonePt(0.985, -144.0),
    stonePt(1.105, -145.5),
    stonePt(1.115, -151.5),
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

  // Balance roller disc + ruby impulse jewel at true balance angle (enters fork notch inside +/- 26 deg lift angle)
  const rolR = R * 0.25;
  const jAng = clampDeg(esc.balDeg, -140, 140) * RAD;
  const jx = bx + Math.cos(jAng) * (rolR * 0.86);
  const jy = by + Math.sin(jAng) * (rolR * 0.86);

  // Banking pins positioned for exact contact with lever edge at forkDeg = +/- 6.5 deg
  const bpX = fx - armLen * 0.56;
  const bpOffset = armLen * 0.56 * Math.sin(6.5 * RAD) + 36 + 30;
  const bpTop = [bpX, fy - bpOffset];
  const bpBot = [bpX, fy + bpOffset];

  const phLabel = esc.phase.toUpperCase();
  const isImp = esc.phase === "impulse";
  const isUnl = esc.phase === "unlock";
  const phCls = isImp ? "is-imp" : isUnl ? "is-unl" : "is-lock";

  return `<g class="loupe">`
    + `<path class="loupe-axis" d="M${n1(cx - R)},${n1(cy)}H${n1(cx + R)}M${n1(ex)},${n1(cy - R)}V${n1(cy + R)}"/>`
    + `<circle class="loupe-roller" cx="${n1(bx)}" cy="${n1(by)}" r="${n1(rolR)}"/>`
    + `<circle class="loupe-pivot" cx="${n1(bx)}" cy="${n1(by)}" r="50"/>`
    + `<circle class="loupe-ruby${isImp || isUnl ? " is-hot" : ""}" cx="${n1(jx)}" cy="${n1(jy)}" r="54"/>`
    + `<path class="loupe-brass" d="${escPath}"/>${escSpokes}`
    + `<circle class="loupe-pivot" cx="${n1(ex)}" cy="${n1(ey)}" r="60"/>`
    + `<circle class="loupe-pin" cx="${n1(bpTop[0])}" cy="${n1(bpTop[1])}" r="30"/>`
    + `<circle class="loupe-pin" cx="${n1(bpBot[0])}" cy="${n1(bpBot[1])}" r="30"/>`
    + `<path class="loupe-steel" d="${pathThrough(forkPoly, true)}"/>`
    + `<path class="loupe-ruby${isImp ? " is-hot" : ""}" d="${pathThrough(entryStone, true)}"/>`
    + `<path class="loupe-ruby${isImp ? " is-hot" : ""}" d="${pathThrough(exitStone, true)}"/>`
    + `<circle class="loupe-pivot" cx="${n1(fx)}" cy="${n1(fy)}" r="48"/>`
    + `<rect class="loupe-badge ${phCls}" x="${n1(cx - 810)}" y="${n1(cy + R * 0.58)}" width="1620" height="270" rx="135"/>`
    + `<text class="loupe-badge-txt ${phCls}" x="${n1(cx)}" y="${n1(cy + R * 0.58 + 178)}" text-anchor="middle">${phLabel} · ${M.N.beatsPerSec} BEATS/S</text>`
    + `</g>`;
}

const clampDeg = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
