// How a Jet Engine (Turbofan) Works (Everyday Edition): Horizontal Axial Cutaway.
//
// Built 100% on Visualize v2.0's spread("axial-cutaway") + universal physical primitives:
//   - layoutFlowSpine({ axis: "x" }) : zero hand-guessed stage X-coordinates
//   - axialHousing()                 : gleaming silver outer nacelle & darker steel inner core
//                                      with camera-facing 140-deg cutaway + 45-deg section hatch
//   - turbineRotor() + turningPart() : giant anodized-orange front fan (with aerodynamic nose
//                                      spinner), 2-stage steel compressor, and brass rear turbine
//   - glowing combustor ring         : 3-tier throttle-responsive amber/crimson burner core
//   - visible central drive shaft    : segmented gilt-brass shaft linking rear turbine -> fan
//   - flowArrow3D()                  : bold cobalt-blue bypass air & fiery orange/crimson core jet
//   - distributeCallouts()           : zero-crossing Step 0 anatomy callouts on spread rails
//   - renderHudStack(SP, ...)        : crisp upper-right studio explainerCard + 2 live meterBars

import {
  RigStage,
  axesOf,
  axialHousing,
  circlePoints,
  distributeCallouts,
  drawMesh,
  fitCamera,
  flowArrow3D,
  layoutFlowSpine,
  moveInPlane,
  planeOf,
  plate,
  renderHudStack,
  rod,
  screenOf,
  softShadow,
  spread,
  stepOf,
  turbineRotor,
  turned,
  turningPart,
} from "../../src/rig/index.ts";

export { RigStage, screenOf } from "../../src/rig/index.ts";
export { practice } from "./story.mjs";

export const SP = spread("axial-cutaway");
export const VIEW = SP.view;

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const X_AXIS = [1, 0, 0];
const UP = [0, 0, 1];
const ROTOR_PL = planeOf([0, 0, 0], X_AXIS, UP);
const ROTOR_AXES = { origin: [0, 0, 0], u: ROTOR_PL.u, v: ROTOR_PL.v, n: ROTOR_PL.n };

// ---------------------------------------------------------------- 1. Axial Flow Spine (layout.ts)
// Every stage along +X is snapped sequentially via layoutFlowSpine() — ZERO hand-guessed X coords!
export const SPINE_SPECS = [
  { name: "intake", length: 9.5, r: 23.6, gap: 0 },
  { name: "fan", length: 12.0, r: 22.8, gap: 4.5 },
  { name: "comp1", length: 10.0, r: 12.6, gap: 2.5 },
  { name: "comp2", length: 9.0, r: 11.4, gap: 4.5 },
  { name: "burner", length: 15.0, r: 11.8, gap: 4.5 },
  { name: "turbine", length: 11.0, r: 12.2, gap: 3.0 },
  { name: "nozzle", length: 14.5, r: 10.0, gap: 0 },
];
export const SPINE = layoutFlowSpine(SPINE_SPECS, { axis: "x", origin: [0, 0, 0] });

// Outer nacelle extends from intake mouth to just past the burner (exposing rear core & nozzle,
// just like a modern high-bypass GE90 / Trent / LEAP turbofan!)
export const NACELLE_X0 = SPINE.intake.z0;
export const NACELLE_X1 = SPINE.burner.z1 + 3.5;
export const NACELLE_R_FRONT = 24.6;
export const NACELLE_R_REAR = 21.8;

export const CORE_X0 = SPINE.comp1.z0 - 2.2;
export const CORE_X1 = SPINE.turbine.z1 + 1.8;
export const NOZZLE_X0 = CORE_X1;
export const NOZZLE_X1 = SPINE.nozzle.z1;

// Step-0 anatomy callouts: base rails via distributeCallouts(SP, ...), with Compressor routed
// cleanly from the open top-center gap and Burner from tighter lower-center so zero leaders
// slash across the front fan blades or double bypass arrows at both 1440x900 and 1280x800!
const BASE_CALLOUTS = distributeCallouts(SP, [
  { id: "bypass", text: "Bypass duct", to: "bypassUpper", side: "left", beats: [0] },
  { id: "fan", text: "Front fan", to: "fan", side: "left", beats: [0] },
  { id: "compressor", text: "Compressor", to: "compressor", side: "left", beats: [0] },
  { id: "turbine", text: "Rear turbine", to: "turbine", side: "right", beats: [0] },
]);
export const CALLOUTS = [
  ...BASE_CALLOUTS.map((c) =>
    c.id === "compressor"
      ? { ...c, at: [6250, 560], anchor: "middle" }
      : c,
  ),
  { id: "burner", text: "Burner", at: [7280, 4880], to: "burner", beats: [0], anchor: "end" },
];

/** Fit the orthographic camera so the full horizontal cutaway turbofan fills `box` cleanly. */
export function cameraFor(box = SP.box) {
  const xLo = NACELLE_X0 - 7.5;
  const xHi = NOZZLE_X1 + 10.5;
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (TAU * i) / 12;
    const ca = Math.cos(a), sa = Math.sin(a);
    pts.push([xLo, NACELLE_R_FRONT * ca, NACELLE_R_FRONT * sa]);
    pts.push([NACELLE_X1, NACELLE_R_REAR * ca, NACELLE_R_REAR * sa]);
    pts.push([xHi, 11.5 * ca, 11.5 * sa]);
  }
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/**
 * Draw the glowing annular combustor flame core inside the burner liner.
 * Pre-rendered at 3 throttle glow tiers (0 = low/idle, 1 = mid/cruise, 2 = high/full).
 */
function drawCombustorFlame(cam, level) {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const xMid = SPINE.burner.mid[0];
  const len = 7.6 + level * 1.8;
  const x0 = xMid - len * 0.48;
  const rInner = 4.6;
  const rOuter = 8.2 + level * 0.55;
  const ringPts = 12;
  const flames = [];

  // Continuous glowing amber inner flame ring nestled cleanly inside the burner liner
  const coreRingSvg = axialHousing(cam, {
    x0: x0 + 0.6,
    length: len - 1.2,
    rOuter: rOuter * 0.92,
    rInner: rInner * 1.08,
    cutaway: true,
    hatch: false,
    material: "amber",
    finish: "metal",
    segments: 18,
  });

  // Sculpted ruby & amber flame tongues flickering rearward around the glowing ring
  for (let i = 0; i < ringPts; i++) {
    const ang = (TAU * i) / ringPts + 0.14;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const cy = ((rInner + rOuter) * 0.52) * ca;
    const cz = ((rInner + rOuter) * 0.52) * sa;
    const lobeR = (rOuter - rInner) * (0.36 + 0.06 * (i % 2));
    const hot = i % 2 === 0;
    const lobeMesh = turned(
      [x0, cy, cz],
      X_AXIS,
      [
        [0, lobeR * 0.3],
        [len * 0.24, lobeR * 0.92],
        [len * 0.66, lobeR * 0.72],
        [len, lobeR * 0.18],
      ],
      10,
      UP,
    );
    const depth = nearnessOf(cam, [xMid, cy, cz], ax);
    flames.push({
      depth,
      svg: drawMesh(lobeMesh, cam, {
        material: hot ? "ruby" : "subject",
        finish: "metal",
        shine: true,
        crease: 48,
      }),
    });
  }

  // Fuel injector nozzles at the front face of the combustor ring
  const injectors = [];
  for (let i = 0; i < 6; i++) {
    const ang = (TAU * i) / 6 + 0.4;
    const rInj = 7.0;
    const iy = rInj * Math.cos(ang);
    const iz = rInj * Math.sin(ang);
    const injMesh = rod([x0 - 2.4, iy, iz], [x0 + 0.5, iy, iz], 0.52, 8);
    injectors.push({
      depth: nearnessOf(cam, [x0 - 1.0, iy, iz], ax),
      svg: drawMesh(injMesh, cam, { material: "brass", finish: "metal", shine: true, crease: 45 }),
    });
  }

  const all = [...flames, ...injectors].sort((a, b) => a.depth - b.depth);
  return `<g class="tf-flame-ring">${coreRingSvg}${all.map((f) => f.svg).join("")}</g>`;
}

function nearnessOf(cam, p, ax) {
  return p[0] * ax.toward[0] + p[1] * ax.toward[1] + p[2] * ax.toward[2];
}

/**
 * Draw bold 3D cool cobalt-blue bypass air streamlines (`flowArrow3D`) split cleanly into
 * upper (`side = "upper"`) and lower (`side = "lower"`) ducts so each stream has focused camera bounds.
 */
function drawBypassHalf(cam, side, tier, highThrottle) {
  const wScale = highThrottle ? 1.08 : 0.88;
  const hScale = highThrottle ? 1.05 : 0.9;
  const xIn = NACELLE_X0 - 5.5;
  const xFan = SPINE.fan.mid[0];
  const xMid = SPINE.comp2.mid[0];
  const xExit = NACELLE_X1 + 8.5;
  const isUp = side === "upper";

  const main = flowArrow3D(cam, {
    points: isUp
      ? [
          [xIn, 0, 17.4],
          [xFan, 0, 18.2],
          [xMid, 0, 17.5],
          [NACELLE_X1, 0, 16.4],
          [xExit, 0, 15.8],
        ]
      : [
          [xIn, -4.5, -16.8],
          [xFan, -4.5, -17.4],
          [xMid, -4.5, -16.8],
          [NACELLE_X1, -4.5, -15.6],
          [xExit, -4.5, -14.8],
        ],
    width: (tier === "high" ? 3.8 : tier === "mid" ? 2.9 : 2.1) * wScale,
    headSize: (tier === "high" ? 130 : tier === "mid" ? 106 : 86) * hScale,
    tone: "cool",
  });

  if (tier !== "high") {
    return `<g class="tf-bypass-arrows">${main}</g>`;
  }

  // High-bypass (6:1..10:1, e.g., Airliner 8:1): companion streamline showing the massive cool bypass river
  const companion = flowArrow3D(cam, {
    points: isUp
      ? [
          [xIn + 1.8, -9.2, 13.6],
          [xFan, -10.2, 14.5],
          [xMid, -9.8, 14.2],
          [NACELLE_X1, -9.0, 13.0],
          [xExit - 2.0, -8.4, 12.2],
        ]
      : [
          [xIn + 1.8, -11.4, -11.2],
          [xFan, -12.2, -12.0],
          [xMid, -11.6, -11.5],
          [NACELLE_X1, -10.5, -10.4],
          [xExit - 2.0, -9.8, -9.8],
        ],
    width: 3.1 * wScale,
    headSize: 110 * hScale,
    tone: "cool",
  });

  return `<g class="tf-bypass-arrows">${main}${companion}</g>`;
}

/**
 * Draw bold 3D core airflow streamlines (`flowArrow3D`): cool air entering the core ->
 * squeezed warm orange air entering the burner -> blazing crimson hot exhaust shooting out!
 */
function drawCoreArrows(cam, tier, highThrottle) {
  const jetBoost = tier === "low" ? 1.32 : tier === "mid" ? 1.12 : 0.94;
  const wScale = (highThrottle ? 1.06 : 0.86) * jetBoost;
  const hScale = (highThrottle ? 1.05 : 0.9) * jetBoost;

  // 1. Front split into inner core compressor (cool blue -> squeezed warm)
  const coreIn = flowArrow3D(cam, {
    points: [
      [SPINE.fan.mid[0] + 3.0, -3.5, 7.6],
      [SPINE.comp1.mid[0], -3.8, 7.4],
      [SPINE.comp2.mid[0] + 3.2, -3.6, 6.8],
    ],
    width: 2.3 * (highThrottle ? 1.05 : 0.9),
    headSize: 82,
    tone: "cool",
  });

  // 2. Compressed warm air rushing into the burner
  const compToBurner = flowArrow3D(cam, {
    points: [
      [SPINE.comp2.mid[0] - 1.5, -3.8, -6.8],
      [SPINE.burner.z0 + 1.5, -4.0, -6.8],
      [SPINE.burner.mid[0] + 3.5, -4.0, -6.4],
    ],
    width: 2.6 * wScale,
    headSize: 90 * hScale,
    tone: "subject",
  });

  // 3. Hot fiery exhaust expanding through the rear turbine and blasting cleanly out the nozzle
  const exhaustLen = tier === "low" ? 10.5 : tier === "mid" ? 8.5 : 6.5;
  const hotMain = flowArrow3D(cam, {
    points: [
      [SPINE.burner.mid[0] + 1.5, -3.2, 5.2],
      [SPINE.turbine.mid[0], -2.8, 5.0],
      [NOZZLE_X1 - 2.0, -2.0, 2.8],
      [NOZZLE_X1 + exhaustLen, -1.2, 1.4],
    ],
    width: 3.3 * wScale,
    headSize: 112 * hScale,
    tone: "bad",
  });

  // In low/mid bypass (Fighter 1:1), add a second roaring crimson core exhaust plume
  const hotLower =
    tier === "high"
      ? ""
      : flowArrow3D(cam, {
          points: [
            [SPINE.burner.mid[0] + 1.5, -3.4, -5.2],
            [SPINE.turbine.mid[0], -3.0, -5.0],
            [NOZZLE_X1 - 2.0, -2.2, -3.2],
            [NOZZLE_X1 + exhaustLen - 1.0, -1.4, -2.0],
          ],
          width: 3.1 * wScale,
          headSize: 108 * hScale,
          tone: "bad",
        });

  return `<g class="tf-core-arrows">${coreIn}${compToBurner}${hotMain}${hotLower}</g>`;
}

/** Build the complete 3D cutaway turbofan figure once and return `{ parts, pose, turningSpecs, spine }`. */
export function figure(M, cam, opts = {}) {
  const px = opts.prefix ?? "tf";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const S = (x, y, z) => screenOf(cam, [x, y, z], ax);
  const XSTEP = stepOf(cam, X_AXIS, ax);
  const xShift = (x) => `translate(${(XSTEP[0] * x).toFixed(2)} ${(XSTEP[1] * x).toFixed(2)})`;

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
  const turningSpecs = [];
  const turning = (id, o) => {
    const t = turningPart(cam, ROTOR_AXES, { id, def: tpl, maxErrPx: 0.45, unitsPerPx: 10, ...o });
    turningSpecs.push({ id, bins: t.bins, worstErrPx: t.worstErrPx });
    return t;
  };
  const turnedAt = (t, theta, x) => {
    const r = t.place(theta, [0, 0], x);
    return { href: r.href, transform: r.transform, turnErrPx: r.turnErrPx };
  };

  // ================================================================ 1. Grounding Studio Shadow
  const shadowFootprint = plate(
    planeOf([0, 0, -25.8], UP, X_AXIS),
    {
      outer: [
        [NACELLE_X0 + 4, -18],
        [NACELLE_X1 - 2, -16],
        [NOZZLE_X1 - 4, -9],
        [NOZZLE_X1 - 4, 9],
        [NACELLE_X1 - 2, 16],
        [NACELLE_X0 + 4, 18],
      ],
    },
    0,
    0.2,
  );
  once("groundShadow", "shadow", softShadow(shadowFootprint, cam, [2.0, -2.5, -1.8]));

  // ================================================================ 2. Outer Cutaway Nacelle & Bypass Struts
  // Gleaming brushed-alloy tapered outer cowling with 140-deg camera-facing cutaway & 45-deg hatch
  const nacelleSvg = axialHousing(cam, {
    x0: NACELLE_X0,
    length: NACELLE_X1 - NACELLE_X0,
    rOuter: NACELLE_R_FRONT,
    rInner: NACELLE_R_FRONT - 1.8,
    rOuterEnd: NACELLE_R_REAR,
    rInnerEnd: NACELLE_R_REAR - 1.6,
    cutaway: true,
    hatch: true,
    material: "alloy",
    finish: "metal",
    segments: 28,
  });
  // Structural radial bypass guide struts anchoring the inner core cleanly inside the outer nacelle
  const xStrut = SPINE.comp1.z0 + 0.5;
  const strutAngles = [Math.PI * 0.52, -Math.PI * 0.42, Math.PI * 0.14];
  const strutsSvg = strutAngles
    .map((ang) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const m = rod([xStrut, 13.0 * ca, 13.0 * sa], [xStrut, 22.0 * ca, 22.0 * sa], 0.85, 10);
      return drawMesh(m, cam, { material: "steel", finish: "metal", shine: true, crease: 38 });
    })
    .join("");
  once("nacelle", "nacelle", nacelleSvg + strutsSvg);

  // ================================================================ 3. Inner Cutaway Core & Nozzle
  // Compact darker-steel inner core casing separating the spacious cool bypass duct from the hot core
  const coreCasingSvg = axialHousing(cam, {
    x0: CORE_X0,
    length: CORE_X1 - CORE_X0,
    rOuter: 13.6,
    rInner: 12.2,
    rOuterEnd: 13.0,
    rInnerEnd: 11.7,
    cutaway: true,
    hatch: true,
    material: "steel",
    finish: "metal",
    segments: 24,
  });
  const nozzleCasingSvg = axialHousing(cam, {
    x0: NOZZLE_X0,
    length: NOZZLE_X1 - NOZZLE_X0,
    rOuter: 13.0,
    rInner: 11.7,
    rOuterEnd: 9.2,
    rInnerEnd: 8.1,
    cutaway: true,
    hatch: true,
    material: "slate",
    finish: "metal",
    segments: 22,
  });
  // Tapered dark-steel exhaust tail cone centered inside the rear nozzle
  const tailConeMesh = turned(
    [SPINE.turbine.mid[0] + 2.8, 0, 0],
    X_AXIS,
    [
      [0, 5.1],
      [5.5, 4.3],
      [14.0, 2.3],
      [21.5, 0.35],
    ],
    20,
    UP,
  );
  const tailConeSvg = drawMesh(tailConeMesh, cam, {
    material: "obsidian",
    finish: "metal",
    shine: true,
    crease: 38,
  });
  once("coreCasing", "core", coreCasingSvg);
  once("nozzleCasing", "core", nozzleCasingSvg);
  once("tailCone", "core", tailConeSvg);

  // ================================================================ 4. Visible Central Drive Shaft
  // Segmented gleaming gilt-brass drive shaft linking rear turbine straight back to compressor & front fan
  const shaftSeg = (id, xStart, xEnd, r = 2.15) => {
    const m = rod([xStart, 0, 0], [xEnd, 0, 0], r, 16);
    const collar = turned(
      [(xStart + xEnd) * 0.5 - 0.8, 0, 0],
      X_AXIS,
      [
        [0, r * 1.18],
        [1.6, r * 1.18],
      ],
      14,
      UP,
    );
    once(
      id,
      "shaft",
      drawMesh(m, cam, { material: "gilt", finish: "metal", shine: true, crease: 38 }) +
        drawMesh(collar, cam, { material: "brass", finish: "metal", shine: true, crease: 38 }),
    );
  };
  shaftSeg("shaftRear", SPINE.burner.mid[0] + 2.5, SPINE.turbine.mid[0] - 1.5, 2.2);
  shaftSeg("shaftMid", SPINE.comp2.mid[0] + 1.2, SPINE.burner.mid[0] + 3.0, 2.15);
  shaftSeg("shaftComp", SPINE.comp1.mid[0] + 1.2, SPINE.comp2.mid[0] - 1.0, 2.2);
  shaftSeg("shaftFront", SPINE.fan.mid[0] + 2.4, SPINE.comp1.mid[0] - 1.2, 2.35);

  // ================================================================ 5. Glowing Combustor Ring
  // Perforated dark-graphite burner liner + 3 throttle-responsive glowing flame templates
  const burnerLinerSvg = axialHousing(cam, {
    x0: SPINE.burner.z0 + 0.6,
    length: SPINE.burner.z1 - SPINE.burner.z0 - 1.2,
    rOuter: 10.7,
    rInner: 9.8,
    cutaway: true,
    hatch: false,
    material: "graphite",
    finish: "metal",
    segments: 20,
  });
  once("burnerLiner", "burner", burnerLinerSvg);

  const flameTpl = (level) => tpl(`flame-${level}`, () => drawCombustorFlame(cam, level));
  for (let lvl = 0; lvl <= 2; lvl++) flameTpl(lvl);

  // ================================================================ 6. Turning Rotors (turningPart)
  // Rear Turbine (brass blades + gilt hub, opposite pitch so hot exhaust gas drives it!)
  const turbineTurn = turning("turbine", {
    period: TAU / 16,
    n0: -1.9,
    n1: 1.9,
    minBins: 2,
    draw: (rot) =>
      turbineRotor(cam, {
        origin: [0, 0, 0],
        axis: X_AXIS,
        rHub: 5.1,
        rTip: 11.2,
        blades: 16,
        bladeWidth: 2.8,
        bladeThick: 0.56,
        twistDeg: -34,
        rotRad: rot,
        material: "brass",
        hubMaterial: "gilt",
      }),
  });
  turbineTurn.drawAll();

  // Compressor Stage 2 (tighter high-pressure gleaming alloy/steel blades)
  const comp2Turn = turning("comp2", {
    period: TAU / 18,
    n0: -1.6,
    n1: 1.6,
    minBins: 2,
    draw: (rot) =>
      turbineRotor(cam, {
        origin: [0, 0, 0],
        axis: X_AXIS,
        rHub: 5.3,
        rTip: 10.3,
        blades: 18,
        bladeWidth: 2.2,
        bladeThick: 0.48,
        twistDeg: 40,
        rotRad: rot,
        material: "alloy",
        hubMaterial: "steel",
      }),
  });
  comp2Turn.drawAll();

  // Compressor Stage 1 (larger front compressor stage)
  const comp1Turn = turning("comp1", {
    period: TAU / 16,
    n0: -1.8,
    n1: 1.8,
    minBins: 2,
    draw: (rot) =>
      turbineRotor(cam, {
        origin: [0, 0, 0],
        axis: X_AXIS,
        rHub: 4.9,
        rTip: 11.4,
        blades: 16,
        bladeWidth: 2.5,
        bladeThick: 0.52,
        twistDeg: 36,
        rotRad: rot,
        material: "steel",
        hubMaterial: "alloy",
      }),
  });
  comp1Turn.drawAll();

  // Giant Anodized-Orange Front Fan (turbineRotor with aerodynamic ogive spinner nose cone!)
  const fanTurn = turning("fan", {
    period: TAU / 14,
    n0: -12.0,
    n1: 3.1,
    minBins: 4,
    draw: (rot) =>
      turbineRotor(cam, {
        origin: [0, 0, 0],
        axis: X_AXIS,
        rHub: 6.1,
        rTip: 21.8,
        blades: 14,
        bladeWidth: 4.8,
        bladeThick: 0.85,
        twistDeg: 32,
        noseLen: 9.0,
        rotRad: rot,
        material: "subject",
        hubMaterial: "steel",
      }),
  });
  fanTurn.drawAll();

  // ================================================================ 7. 3D Airflow Streamlines
  const bypassUpTpl = (tier, highT) =>
    tpl(`bflow-up-${tier}-${highT ? 1 : 0}`, () => drawBypassHalf(cam, "upper", tier, highT));
  const bypassLoTpl = (tier, highT) =>
    tpl(`bflow-lo-${tier}-${highT ? 1 : 0}`, () => drawBypassHalf(cam, "lower", tier, highT));
  const coreTpl = (tier, highT) =>
    tpl(`cflow-${tier}-${highT ? 1 : 0}`, () => drawCoreArrows(cam, tier, highT));
  for (const tier of ["low", "mid", "high"]) {
    for (const highT of [false, true]) {
      bypassUpTpl(tier, highT);
      bypassLoTpl(tier, highT);
      coreTpl(tier, highT);
    }
  }

  /** Compute one 60 fps frame for the horizontal cutaway turbofan. */
  function pose(st) {
    const throttlePct = st.throttlePct ?? 85;
    const bypassTier = st.bypassTier ?? "high";
    const fanDeg = st.fanDeg ?? 18;
    const coreDeg = st.coreDeg ?? fanDeg * 1.45;
    const highThrottle = throttlePct >= 55;
    const flameLevel = throttlePct >= 80 ? 2 : throttlePct >= 45 ? 1 : 0;

    // Painter's order along +X under AXIAL_VIEW (azimuth 234, elevation 22):
    //   +X goes FARTHER and RIGHT; -X (front fan) is NEARER and LEFT!
    //   So rear parts get LOWER `key` (painted first/behind) and front parts get HIGHER `key`!
    const items = [
      // Ground shadow & open cutaway outer nacelle shell
      { id: `${px}-groundShadow`, key: 1, transform: null },
      { id: `${px}-nacelle`, key: 4, transform: null },

      // Rear converging exhaust nozzle + tailcone + inner core cutaway casing
      { id: `${px}-nozzleCasing`, key: 8, transform: null },
      { id: `${px}-tailCone`, key: 10, transform: null },
      { id: `${px}-coreCasing`, key: 12, transform: null },

      // Rear turbine -> shaft -> glowing combustor -> shaft -> compressor 2 -> shaft -> compressor 1 -> shaft
      { id: `${px}-turbine`, part: "turbine", key: 16, ...turnedAt(turbineTurn, coreDeg * RAD, SPINE.turbine.mid[0]) },
      { id: `${px}-shaftRear`, key: 19, transform: null },
      { id: `${px}-burnerLiner`, key: 22, transform: null },
      { id: `${px}-flame`, part: "burner", key: 24, href: flameTpl(flameLevel), transform: null },
      { id: `${px}-shaftMid`, key: 27, transform: null },
      { id: `${px}-comp2`, part: "compressor", key: 30, ...turnedAt(comp2Turn, coreDeg * RAD, SPINE.comp2.mid[0]) },
      { id: `${px}-shaftComp`, key: 33, transform: null },
      { id: `${px}-comp1`, part: "compressor", key: 36, ...turnedAt(comp1Turn, coreDeg * RAD, SPINE.comp1.mid[0]) },
      { id: `${px}-shaftFront`, key: 39, transform: null },

      // Giant anodized-orange front fan & spinner nose cone at the front intake
      { id: `${px}-fan`, part: "fan", key: 44, ...turnedAt(fanTurn, fanDeg * RAD, SPINE.fan.mid[0]) },

      // Bold 3D airflow streamlines (cool blue upper/lower bypass air + fiery core air)
      { id: `${px}-coreFlow`, part: "coreFlow", key: 50, href: coreTpl(bypassTier, highThrottle), transform: null },
      { id: `${px}-bypassUpper`, part: "bypassUpper", key: 54, href: bypassUpTpl(bypassTier, highThrottle), transform: null },
      { id: `${px}-bypassLower`, part: "bypassLower", key: 56, href: bypassLoTpl(bypassTier, highThrottle), transform: null },
    ];

    // Live projected screen-space callout anchors pointing directly onto each real 3D part (zero crossings!)
    const at = {
      bypassUpper: S(SPINE.comp1.mid[0] - 4, 0, 17.8),
      bypassLower: S(SPINE.comp1.mid[0] - 4, -4.5, -17.0),
      fan: S(SPINE.fan.mid[0] - 2, 12.5, -9.5),
      compressor: S(SPINE.comp1.mid[0] + 6, 0, 8.2),
      burner: S(SPINE.burner.mid[0] - 1, -2.8, -6.2),
      turbine: S(SPINE.turbine.mid[0], -2.8, -4.8),
      shaft: S(SPINE.comp2.mid[0] + 6, 0, -1.8),
      core: S(SPINE.nozzle.mid[0], 0, 0),
      coreFlow: S(NOZZLE_X1 + 3, -1.6, 2.0),
      nacelle: S(SPINE.fan.z1 + 2, 0, NACELLE_R_FRONT - 1),
    };

    return { items, at, defs: drainDefs() };
  }

  return { parts, pose, turningSpecs, spine: SPINE };
}

/**
 * Render the crisp upper-right studio HUD stack locked directly into `SP.hud` via `renderHudStack()`:
 * plain-English explainerCard + live Cool fan push % & Throttle % meterBars.
 */
export function renderHud(M, st) {
  const hideSplit = Boolean(st.hidePushSplit);
  const fanPct = st.fanPushPct ?? M.fanPushPct;
  const throttlePct = st.throttlePct ?? M.cruiseThrottlePct;
  const tone = st.tone ?? (fanPct >= 65 ? "good" : "hot");

  const card = {
    title: st.cardTitle ?? "Inside the turbofan",
    badge: st.badge ?? `${st.bypassRatio ?? M.bypassRatio}:1 bypass`,
    tone,
    rows: st.hudRows ?? [
      `Air split: ${st.bypassRatio ?? M.bypassRatio} parts bypass to 1 core`,
      `Forward push: ${hideSplit ? "?" : `${fanPct}% cool fan, ${100 - fanPct}% hot jet`}`,
      `Throttle: ${throttlePct}% power`,
    ],
  };

  const meters = [
    {
      label: "Cool fan push",
      fraction: hideSplit ? 0 : fanPct / 100,
      valueText: hideSplit ? "? % of push" : `${fanPct}% of push`,
      tone: hideSplit ? "neutral" : fanPct >= 65 ? "good" : "hot",
    },
    {
      label: "Engine throttle",
      fraction: throttlePct / 100,
      valueText: `${throttlePct}%`,
      tone: throttlePct >= 80 ? "hot" : "good",
    },
  ];

  return renderHudStack(SP, card, meters);
}
