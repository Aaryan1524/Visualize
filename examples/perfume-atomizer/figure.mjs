// Perfume Atomizer: 3D studio cutaway figure on Visualize's everyday-object rig (src/rig/objects.ts).
//
// Drawn once in `figure(M, cam)` (cutaway crystal glass bottle, metallic collar, studio plinth,
// cutaway pump barrel, check ball, spring coils, piston stem, pressable orange spray nozzle) and
// translated/swapped cheaply in `pose(state)` at 60 fps.
//
// Side explainer HUD (`explainerCard` + two `meterBar`s) is rendered via `renderHud(M, state)`
// into a fixed sibling `<g id="explainer" data-camera-avoid="">` so it stays crisp, un-receded,
// and clear of both the bottle and the bottom-right Predict/Concept cards at every zoom level.

import {
  OBJECT_VIEW,
  axesOf,
  dipTube,
  drawMesh,
  explainerCard,
  fitCamera,
  liquidColumn,
  meterBar,
  placeAt,
  plungerNozzle,
  rod,
  screenOf,
  sprayCone,
  turned,
  vesselShell,
} from "../../src/rig/index.ts";
export { RigStage, screenOf } from "../../src/rig/index.ts";
export { practice } from "./story.mjs";

export const VIEW = OBJECT_VIEW;
const UP = [0, 0, 1];

/** Shared physical dimensions (mm) for one bottle variant. */
export function geometry(M) {
  const ax = axesOf(VIEW.azimuth, VIEW.elevation);
  const right2 = [ax.right[0], ax.right[1]];
  const bodyTop = M.bottleH - M.shoulderH;
  const neckTop = M.bottleH + M.neckH;
  const liqR = M.bottleR - M.wall - 0.7;
  const liqMaxH = Math.max(8, bodyTop - M.wall - 1.6);
  // Bottom tip of the dip tube sits clearly above the shallow <5% puddle so the air gap is unmistakable
  const strawZ0 = M.wall + 5.8;
  const chamberZ0 = bodyTop + M.shoulderH * 0.28;
  const chamberH = neckTop - chamberZ0 + 1.8;
  const chamberR = Math.max(4.4, M.neckR - M.wall + 0.6);
  const nozzleR = M.neckR + 1.5;
  const nozzleH = 13.5;
  const spoutLen = 6.5;
  const nozzleRestZ = neckTop + 2.2 + M.strokeMm;
  const spoutZ = nozzleH * 0.56;
  const spoutTipDist = nozzleR + spoutLen;
  const mistLen = M.bottleR * 2.05;
  const baseR = M.bottleR + 12;
  return {
    ax,
    right2,
    bodyTop,
    neckTop,
    liqR,
    liqMaxH,
    strawZ0,
    chamberZ0,
    chamberH,
    chamberR,
    nozzleR,
    nozzleH,
    spoutLen,
    nozzleRestZ,
    spoutZ,
    spoutTipDist,
    mistLen,
    baseR,
  };
}

/** Fit the 3D camera so the bottle, pressable nozzle, and rightward mist cloud fill `box`. */
export function cameraFor(M, box) {
  const G = geometry(M);
  const r = M.bottleR;
  const zTop = G.nozzleRestZ + G.nozzleH + 4;
  const mistEnd = [
    G.right2[0] * (G.spoutTipDist + G.mistLen * 0.88),
    G.right2[1] * (G.spoutTipDist + G.mistLen * 0.88),
    G.nozzleRestZ + G.spoutZ,
  ];
  const pts = [
    [-r, -r, -4],
    [r, -r, -4],
    [r, r, -4],
    [-r, r, -4],
    [-r, -r, zTop],
    [r, r, zTop],
    mistEnd,
    [mistEnd[0], mistEnd[1], G.nozzleRestZ + G.spoutZ + 14],
    [mistEnd[0], mistEnd[1], G.nozzleRestZ + G.spoutZ - 14],
  ];
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/** Build the static 3D solids once and return `{ parts, pose, geom }`. */
export function figure(M, cam) {
  const G = geometry(M);
  const parts = [];
  const once = (id, part, svg) => parts.push({ id, part, svg });

  // 1. Subtle grounded studio display plinth (keeps scene bounds generous and realistic)
  const plinthMesh = turned(
    [0, 0, -4],
    UP,
    [
      [0, G.baseR * 0.96],
      [0.8, G.baseR],
      [3.4, G.baseR],
      [4, G.baseR * 0.96],
    ],
    44,
  );
  once("base", "base", drawMesh(plinthMesh, cam, { material: "steel", shine: false, crease: 38 }));

  // 2. Cutaway crystal glass perfume bottle + cutaway brushed metallic neck collar
  const glassBottle = vesselShell(cam, {
    r: M.bottleR,
    h: M.bottleH,
    neckR: M.neckR,
    neckH: M.neckH,
    shoulderH: M.shoulderH,
    wall: M.wall,
    cutaway: true,
    material: "glass",
    segments: 36,
  });
  const collar = vesselShell(cam, {
    r: M.neckR + 1.15,
    h: 5.8,
    neckR: M.neckR + 1.15,
    shoulderH: 0,
    neckH: 0,
    wall: 1.35,
    cutaway: true,
    material: "alloy",
    segments: 28,
  });
  once("bottle", "bottle", glassBottle);
  once("collar", "bottle", collar);

  // 3. Cutaway machined steel pump chamber inside the upper shoulder & neck
  const pumpShell = vesselShell(cam, {
    r: G.chamberR,
    h: G.chamberH,
    neckR: G.chamberR,
    shoulderH: 0,
    neckH: 0,
    wall: 1.15,
    cutaway: true,
    material: "steel",
    segments: 28,
  });
  once("chamberShell", "chamber", pumpShell);

  // 4. One-way bottom check ball (satin alloy sphere inside bottom of pump chamber)
  const ballR = 1.95;
  const ballProfile = [];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 8;
    ballProfile.push([ballR * (1 + Math.sin(a)), Math.max(0.18, ballR * Math.cos(a))]);
  }
  once("checkBall", "chamber", drawMesh(turned([0, 0, 0], UP, ballProfile, 18), cam, { material: "alloy", shine: true, crease: 45 }));

  // 5. Four steel return-spring coils translated vertically to compress cleanly (pure translate, no scale distortion)
  const springCoilR = Math.max(2.6, G.chamberR - 1.7);
  const coilMesh = turned(
    [0, 0, 0],
    UP,
    [
      [0, springCoilR - 0.25],
      [0.45, springCoilR],
      [0.9, springCoilR - 0.25],
    ],
    22,
  );
  const coilSvg = drawMesh(coilMesh, cam, { material: "steel", shine: true, crease: 40 });
  for (let i = 0; i < 4; i++) once(`spring${i}`, "chamber", coilSvg);

  // 6. Rubber piston seal + slender steel stem connecting the pump chamber to the spray cap
  const pistonR = Math.max(2.9, G.chamberR - 1.35);
  const pistonCup = turned(
    [0, 0, 0],
    UP,
    [
      [0, pistonR * 0.9],
      [0.5, pistonR],
      [2.4, pistonR],
      [2.8, pistonR * 0.88],
    ],
    24,
  );
  const stemTop = G.nozzleRestZ - (G.chamberZ0 + G.chamberH - 3.6) + 1.5;
  const stemRod = rod([0, 0, 2.5], [0, 0, stemTop], 1.55, 16);
  once(
    "piston",
    "chamber",
    drawMesh(pistonCup, cam, { material: "rubber", shine: false, crease: 40 }) +
      drawMesh(stemRod, cam, { material: "steel", shine: true, crease: 40 }),
  );

  // 7. Pressable orange spray cap & side nozzle orifice (the one signature `subject` part)
  once(
    "nozzle",
    "nozzle",
    plungerNozzle(cam, {
      r: G.nozzleR,
      h: G.nozzleH,
      spoutLen: G.spoutLen,
      spoutDir: G.right2,
      material: "subject",
    }),
  );

  // Caches for live-height liquid columns, straw segments, and quantized mist sprays (fast 60 fps)
  const liqCache = new Map();
  const chamberLiqCache = new Map();
  const strawCache = new Map();
  const mistCache = new Map();

  const cachedLiquid = (h) => {
    const q = Math.round(h * 2) / 2;
    if (q <= 0.2) return "";
    if (!liqCache.has(q)) {
      liqCache.set(q, liquidColumn(cam, { r: G.liqR, h: q, z0: M.wall, material: "liquid", segments: 28 }));
    }
    return liqCache.get(q);
  };

  const cachedChamberLiquid = (h) => {
    const q = Math.round(h * 2) / 2;
    if (q <= 0.3) return "";
    if (!chamberLiqCache.has(q)) {
      chamberLiqCache.set(
        q,
        liquidColumn(cam, { r: G.chamberR - 1.35, h: q, z0: G.chamberZ0 + 1.4, material: "liquid", segments: 22 }),
      );
    }
    return chamberLiqCache.get(q);
  };

  // Straw sits slightly toward camera inside the cutaway so it reads cleanly in front of the golden reservoir
  const strawOff = [G.ax.toward[0] * 1.4, G.ax.toward[1] * 1.4];
  const cachedStraw = (fillFrac) => {
    const q = Math.round(Math.max(0, Math.min(1, fillFrac)) * 20) / 20;
    if (!strawCache.has(q)) {
      const z0 = G.strawZ0;
      const z1 = G.chamberZ0 + 0.6;
      const zMid = z0 + (z1 - z0) * q;
      let svg = "";
      if (zMid - z0 > 0.3) {
        svg += dipTube(cam, { r: 2.35, z0, z1: zMid, offset: strawOff, material: "liquid" });
      }
      if (z1 - zMid > 0.3) {
        svg += dipTube(cam, { r: 2.15, z0: zMid, z1, offset: strawOff, material: "alloy" });
      }
      strawCache.set(q, svg);
    }
    return strawCache.get(q);
  };

  const cachedMist = (strength, sputtering) => {
    const q = Math.round(Math.max(0, Math.min(1, strength)) * 12) / 12;
    if (q <= 0.02) return "";
    const key = `${sputtering ? "s" : "m"}:${q}`;
    if (!mistCache.has(key)) {
      const dir = [G.right2[0], G.right2[1], sputtering ? -0.04 : 0.05];
      mistCache.set(
        key,
        sprayCone(cam, {
          origin: [G.right2[0] * (G.spoutTipDist + 0.6), G.right2[1] * (G.spoutTipDist + 0.6), 0],
          dir,
          length: sputtering ? G.mistLen * 0.42 : G.mistLen,
          spreadDeg: sputtering ? 13 : 26,
          intensity: q,
          seed: sputtering ? 19 : 7,
          droplets: sputtering ? 11 : 34,
        }),
      );
    }
    return mistCache.get(key);
  };

  /**
   * Pose the entire 3D perfume bottle for one frame.
   * state: { fillPct, strawFill, chamberFill, pressFrac, ballOpen, sprayStrength, sputtering }
   */
  function pose(st) {
    const items = [];
    const at = {};
    const pressMm = Math.max(0, Math.min(1, st.pressFrac ?? 0)) * M.strokeMm;
    const nozzleZ = G.nozzleRestZ - pressMm;
    const pistonZ = G.chamberZ0 + G.chamberH - 3.6 - pressMm;
    const pct = Math.max(0, Math.min(100, st.fillPct ?? 0));
    // Below 5% sputter threshold, keep the shallow puddle visibly below the straw tip (z = M.wall + 5.8);
    // at 5% and above, liquid rises cleanly above the straw tip up to liqMaxH.
    const liqH =
      pct <= 0
        ? 0
        : pct < M.sputterPct
          ? (pct / M.sputterPct) * 2.2
          : 7.0 + ((pct - M.sputterPct) / (100 - M.sputterPct)) * (G.liqMaxH - 7.0);
    const chamberAvail = Math.max(0, pistonZ - (G.chamberZ0 + 1.6));
    const chamberLiqH = Math.max(0, Math.min(1, st.chamberFill ?? 0)) * chamberAvail;

    // Painter's order from back to front
    items.push({ id: "base", key: 1, transform: null });
    items.push({ id: "bottle", key: 10, transform: null });
    items.push({ id: "collar", key: 12, transform: placeAt(cam, [0, 0, G.neckTop - 4.6]) });

    // Reservoir liquid column inside cutaway bottle
    const liqSvg = cachedLiquid(liqH);
    if (liqSvg) {
      items.push({ id: "liquid", key: 20, part: "liquid", transform: null, svg: liqSvg });
    } else {
      items.push({ id: "liquid", key: 20, part: "liquid", hidden: true });
    }

    // Dip tube straw (golden filled bottom + satin alloy air-filled top)
    items.push({ id: "straw", key: 30, part: "straw", transform: null, svg: cachedStraw(st.strawFill ?? 0) });

    // Pump chamber: cutaway steel barrel, internal liquid, return spring coils, check ball, piston
    items.push({ id: "chamberShell", key: 40, transform: placeAt(cam, [0, 0, G.chamberZ0]) });
    const cLiqSvg = cachedChamberLiquid(chamberLiqH);
    if (cLiqSvg) {
      items.push({ id: "chamberLiquid", key: 42, part: "chamber", transform: null, svg: cLiqSvg });
    } else {
      items.push({ id: "chamberLiquid", key: 42, part: "chamber", hidden: true });
    }

    // 4 spring coils compressed cleanly between chamber bottom and piston underside
    const spLo = G.chamberZ0 + 2.4;
    const spHi = Math.max(spLo + 2.2, pistonZ - 1.1);
    for (let i = 0; i < 4; i++) {
      const zCoil = spLo + ((spHi - spLo) * (i + 0.5)) / 4;
      items.push({ id: `spring${i}`, key: 43 + i * 0.1, transform: placeAt(cam, [0, 0, zCoil]) });
    }

    const ballZ = G.chamberZ0 + 1.3 + (st.ballOpen ? 2.5 : 0);
    items.push({ id: "checkBall", key: 45, transform: placeAt(cam, [0, 0, ballZ]) });
    items.push({ id: "piston", key: 46, transform: placeAt(cam, [0, 0, pistonZ]) });

    // Pressable orange spray cap & nozzle
    items.push({ id: "nozzle", key: 50, transform: placeAt(cam, [0, 0, nozzleZ]) });

    // Animated 3D mist spray cone emerging from the nozzle orifice
    const mistSvg = cachedMist(st.sprayStrength ?? 0, !!st.sputtering);
    if (mistSvg) {
      items.push({
        id: "mist",
        key: 60,
        part: "mist",
        transform: placeAt(cam, [0, 0, nozzleZ + G.spoutZ]),
        svg: mistSvg,
      });
    } else {
      items.push({ id: "mist", key: 60, part: "mist", hidden: true });
    }

    // Callout anchors (screen-space points on each part's left edge so leaders stay short & clean)
    const leftEdge = (r, z) => screenOf(cam, [-G.right2[0] * r, -G.right2[1] * r, z]);
    at.nozzle = leftEdge(G.nozzleR * 0.9, nozzleZ + G.nozzleH * 0.55);
    at.chamber = leftEdge(G.chamberR * 0.95, G.chamberZ0 + G.chamberH * 0.52);
    at.straw = screenOf(cam, [strawOff[0] - G.right2[0] * 1.5, strawOff[1] - G.right2[1] * 1.5, G.strawZ0 + (G.chamberZ0 - G.strawZ0) * 0.52]);
    at.liquid = leftEdge(G.liqR * 0.92, M.wall + Math.max(1.2, liqH * 0.52));
    at.bottle = leftEdge(M.bottleR * 0.95, M.bottleH * 0.45);
    at.mist = screenOf(cam, [
      G.right2[0] * (G.spoutTipDist + G.mistLen * 0.45),
      G.right2[1] * (G.spoutTipDist + G.mistLen * 0.45),
      nozzleZ + G.spoutZ,
    ]);
    const mistP0 = screenOf(cam, [G.right2[0] * G.spoutTipDist, G.right2[1] * G.spoutTipDist, nozzleZ + G.spoutZ]);
    const mistP1 = screenOf(cam, [
      G.right2[0] * (G.spoutTipDist + G.mistLen),
      G.right2[1] * (G.spoutTipDist + G.mistLen),
      nozzleZ + G.spoutZ + G.mistLen * 0.35,
    ]);
    const mistP2 = screenOf(cam, [
      G.right2[0] * (G.spoutTipDist + G.mistLen),
      G.right2[1] * (G.spoutTipDist + G.mistLen),
      nozzleZ + G.spoutZ - G.mistLen * 0.3,
    ]);
    at.mistBox = {
      x0: Math.min(mistP0[0], mistP1[0], mistP2[0]),
      y0: Math.min(mistP0[1], mistP1[1], mistP2[1]),
      x1: Math.max(mistP0[0], mistP1[0], mistP2[0]),
      y1: Math.max(mistP0[1], mistP1[1], mistP2[1]),
    };

    return { items, at };
  }

  return { parts, pose, geom: G };
}

// Fixed screen-space HUD camera for the side explainerCard + meterBars (upper-right of stage,
// cleanly separated from both the 3D bottle and the bottom-right Predict/Concept cards).
const HUD_CAM = { azimuth: 238, elevation: 22, scale: 105, origin: [9850, 260] };
const HUD_METER_1 = { azimuth: 238, elevation: 22, scale: 105, origin: [9850, 1960] };
const HUD_METER_2 = { azimuth: 238, elevation: 22, scale: 105, origin: [9850, 2680] };

/** Render the crisp, never-receded plain-English explainerCard + live meterBars for one state. */
export function renderHud(M, st) {
  const fillPct = Math.round(st.fillPct ?? 0);
  const volMl = st.volumeMl !== undefined ? st.volumeMl : +((M.capacityMl * fillPct) / 100).toFixed(1);
  const chamberPct = Math.round(Math.max(0, Math.min(1, st.chamberFill ?? 0)) * 100);
  const fillTone = fillPct < M.sputterPct ? "bad" : "good";
  const chamberTone = st.sputtering || fillPct === 0 ? "bad" : chamberPct >= 60 ? "good" : chamberPct > 0 ? "hot" : "neutral";

  const card = explainerCard(HUD_CAM, {
    at: [0, 0, 0],
    title: st.cardTitle ?? "Inside one spray",
    badge: st.badge ?? "Ready",
    tone: st.tone ?? "neutral",
    width: 39,
    rows: [
      `Chamber: ${st.chamberLabel ?? "Full of perfume"}`,
      `Straw: ${st.strawLabel ?? "Full of perfume"}`,
      `Spray: ${st.sprayLabel ?? "Fine mist"}`,
    ],
  });

  const fillBar = meterBar(HUD_METER_1, {
    at: [0, 0, 0],
    w: 39,
    h: 1.8,
    fraction: fillPct / 100,
    label: "Bottle fill",
    valueText: `${fillPct}% (${volMl} ml)`,
    tone: fillTone,
  });

  const chamberBar = meterBar(HUD_METER_2, {
    at: [0, 0, 0],
    w: 39,
    h: 1.8,
    fraction: chamberPct / 100,
    label: "Pump chamber",
    valueText: `${chamberPct}% full`,
    tone: chamberTone,
  });

  return card + fillBar + chamberBar;
}
