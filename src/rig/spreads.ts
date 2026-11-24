// Figma-style 6-spread page design system for Visualize's 14200 x 6550 stage.
//
// Every spread archetype locks in proven studio camera angles, overview fit box,
// zoomed camera clear zones (standard, Predict-open, and Lab/Practice-open),
// left/right callout rails, upper-right HUD stack cameras, and explicit UI safe
// zones verified to have zero overlap at both 1440x900 and 1280x800.

import type { Box } from "./camera.ts";
import { explainerCard, meterBar, OBJECT_VIEW, type CardTone } from "./objects.ts";
import { CONCEPT_VIEW } from "./parts.ts";

export type { Box };

export type SpreadKind =
  | "cutaway-vessel"
  | "exploded-stack"
  | "axial-cutaway"
  | "linked-train"
  | "concept-plate"
  | "system-tiers";

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface HudCam {
  azimuth: number;
  elevation: number;
  scale: number;
  origin: [number, number];
}

export interface SpreadSpec {
  kind: SpreadKind;
  label: string;
  description: string;
  view: { azimuth: number; elevation: number };
  viewBox: { w: number; h: number; str: string };
  fs: number;
  box: Box;
  clear: Rect;
  predictClear: Rect;
  cardClear: Rect;
  safeZones: {
    heading: Rect;
    hud: Rect;
    predict: Rect;
    lab: Rect;
  };
  rails: {
    lx: number;
    rx: number;
    yMin: number;
    yMax: number;
  };
  hud: {
    cardCam: HudCam;
    cardWidth: number;
    meterCams: HudCam[];
    meterWidth: number;
  };
  css: string;
}

const VIEWBOX = { w: 14200, h: 6550, str: "0 0 14200 6550" } as const;

// Shared chrome safe zones in canonical 14200 x 6550 stage units (worst-case union
// across 1440x900 and 1280x800 viewports matching src/drawing/chrome.css).
const HEADING_ZONE: Rect = { x0: 150, y0: 150, x1: 3220, y1: 1600 };
const PREDICT_ZONE: Rect = { x0: 9000, y0: 4650, x1: 14080, y1: 6450 };
const LAB_ZONE: Rect = { x0: 250, y0: 700, x1: 5050, y1: 5900 };

function makeStageCss(fs: number): string {
  return [
    `.label text{font-size:${fs}px;font-weight:500;fill:var(--ink);paint-order:stroke;stroke:var(--stage);stroke-width:48px;stroke-linejoin:round}`,
    `.leader{fill:none;stroke:var(--ink);stroke-width:.7px;vector-effect:non-scaling-stroke}`,
    `.ldot{fill:var(--ink)}`,
    `.vz-step-heading{text-shadow:0 0 6px var(--stage),0 0 12px var(--stage),0 0 18px var(--stage)}`,
    `#fig{overflow:visible}`,
    `.vz[data-practice] #fig .label,.vz[data-lab] #fig .label{visibility:hidden}`,
    `.vz[data-practice] .vz-step-heading{visibility:hidden}`,
  ].join("\n");
}

function makeHud(
  view: { azimuth: number; elevation: number },
  x: number,
  scale: number,
  width: number,
  meterY: [number, number],
): SpreadSpec["hud"] {
  return {
    cardCam: { azimuth: view.azimuth, elevation: view.elevation, scale, origin: [x, 260] },
    cardWidth: width,
    meterCams: [
      { azimuth: view.azimuth, elevation: view.elevation, scale, origin: [x, meterY[0]] },
      { azimuth: view.azimuth, elevation: view.elevation, scale, origin: [x, meterY[1]] },
    ],
    meterWidth: width,
  };
}

const CUTAWAY_VIEW = { azimuth: OBJECT_VIEW.azimuth, elevation: OBJECT_VIEW.elevation };
const STACK_VIEW = { azimuth: 236, elevation: 27 };
const AXIAL_VIEW = { azimuth: 234, elevation: 22 };
const TRAIN_VIEW = { azimuth: 240, elevation: 28 };
const PLATE_VIEW = { azimuth: CONCEPT_VIEW.azimuth, elevation: CONCEPT_VIEW.elevation };
const TIERS_VIEW = { azimuth: 235, elevation: 26 };

export const SPREADS: Record<SpreadKind, SpreadSpec> = {
  "cutaway-vessel": {
    kind: "cutaway-vessel",
    label: "Cutaway Vessel",
    description:
      "Vertical bottle, chamber, battery, or syringe shown in open-front cutaway with internal fluid or mechanism.",
    view: CUTAWAY_VIEW,
    viewBox: { ...VIEWBOX },
    fs: 152,
    box: { x: 3450, y: 450, w: 5150, h: 5500 },
    clear: { x0: 3280, y0: 200, x1: 9600, y1: 6250 },
    predictClear: { x0: 3280, y0: 200, x1: 8800, y1: 6250 },
    cardClear: { x0: 5400, y0: 200, x1: 9550, y1: 6250 },
    safeZones: {
      heading: { ...HEADING_ZONE },
      hud: { x0: 9800, y0: 200, x1: 14050, y1: 3250 },
      predict: { ...PREDICT_ZONE },
      lab: { ...LAB_ZONE },
    },
    rails: { lx: 2850, rx: 9400, yMin: 1800, yMax: 5600 },
    hud: makeHud(CUTAWAY_VIEW, 9850, 105, 39, [1960, 2680]),
    css: makeStageCss(152),
  },

  "exploded-stack": {
    kind: "exploded-stack",
    label: "Exploded Stack",
    description:
      "Coaxial vertical stack such as a watch movement, camera lens, clutch, or loudspeaker separated along Z.",
    view: STACK_VIEW,
    viewBox: { ...VIEWBOX },
    fs: 152,
    box: { x: 3300, y: 340, w: 5150, h: 5820 },
    clear: { x0: 3450, y0: 240, x1: 9800, y1: 6200 },
    predictClear: { x0: 3450, y0: 240, x1: 8800, y1: 6200 },
    cardClear: { x0: 5400, y0: 200, x1: 9750, y1: 6250 },
    safeZones: {
      heading: { ...HEADING_ZONE },
      hud: { x0: 10020, y0: 200, x1: 14050, y1: 3200 },
      predict: { ...PREDICT_ZONE },
      lab: { ...LAB_ZONE },
    },
    rails: { lx: 2780, rx: 9500, yMin: 1780, yMax: 5500 },
    hud: makeHud(STACK_VIEW, 10100, 98, 38.5, [1920, 2640]),
    css: makeStageCss(152),
  },

  "axial-cutaway": {
    kind: "axial-cutaway",
    label: "Axial Cutaway",
    description:
      "Horizontal machine laid out along the X-axis such as a jet engine, differential, lock cylinder, or spool valve.",
    view: AXIAL_VIEW,
    viewBox: { ...VIEWBOX },
    fs: 150,
    box: { x: 3350, y: 550, w: 6450, h: 3950 },
    clear: { x0: 3300, y0: 240, x1: 9850, y1: 6150 },
    predictClear: { x0: 3300, y0: 240, x1: 9850, y1: 4520 },
    cardClear: { x0: 5300, y0: 300, x1: 9820, y1: 6100 },
    safeZones: {
      heading: { ...HEADING_ZONE },
      hud: { x0: 10020, y0: 200, x1: 14050, y1: 3200 },
      predict: { ...PREDICT_ZONE },
      lab: { ...LAB_ZONE },
    },
    rails: { lx: 2950, rx: 10050, yMin: 1800, yMax: 5400 },
    hud: makeHud(AXIAL_VIEW, 10100, 98, 38.5, [1920, 2640]),
    css: makeStageCss(150),
  },

  "linked-train": {
    kind: "linked-train",
    label: "Linked Train",
    description:
      "Meshed mechanical linkages and gear trains such as a gearbox, derailleur, or clock escapement.",
    view: TRAIN_VIEW,
    viewBox: { ...VIEWBOX },
    fs: 150,
    box: { x: 3350, y: 450, w: 5450, h: 5450 },
    clear: { x0: 3300, y0: 220, x1: 9700, y1: 6200 },
    predictClear: { x0: 3300, y0: 220, x1: 8820, y1: 6200 },
    cardClear: { x0: 5350, y0: 240, x1: 9680, y1: 6200 },
    safeZones: {
      heading: { ...HEADING_ZONE },
      hud: { x0: 9880, y0: 200, x1: 14050, y1: 3220 },
      predict: { ...PREDICT_ZONE },
      lab: { ...LAB_ZONE },
    },
    rails: { lx: 2900, rx: 9550, yMin: 1800, yMax: 5500 },
    hud: makeHud(TRAIN_VIEW, 9950, 100, 39, [1940, 2660]),
    css: makeStageCss(150),
  },

  "concept-plate": {
    kind: "concept-plate",
    label: "Concept Plate",
    description:
      "Abstract data structure or algorithm built from 3D cells, rails, rings, and tokens such as a Bloom filter, hash table, or B-tree.",
    view: PLATE_VIEW,
    viewBox: { ...VIEWBOX },
    fs: 150,
    box: { x: 3320, y: 380, w: 6520, h: 4140 },
    clear: { x0: 3280, y0: 180, x1: 9860, y1: 6150 },
    predictClear: { x0: 3280, y0: 180, x1: 9860, y1: 4520 },
    cardClear: { x0: 5320, y0: 220, x1: 9840, y1: 6150 },
    safeZones: {
      heading: { ...HEADING_ZONE },
      hud: { x0: 10020, y0: 200, x1: 14050, y1: 3200 },
      predict: { ...PREDICT_ZONE },
      lab: { ...LAB_ZONE },
    },
    rails: { lx: 3000, rx: 10050, yMin: 1820, yMax: 5200 },
    hud: makeHud(PLATE_VIEW, 10100, 98, 38.5, [1920, 2640]),
    css: makeStageCss(150),
  },

  "system-tiers": {
    kind: "system-tiers",
    label: "System Tiers",
    description:
      "Multi-plane architectural stack such as multi-agent orchestration, microservices, or transformer layers.",
    view: TIERS_VIEW,
    viewBox: { ...VIEWBOX },
    fs: 150,
    box: { x: 3320, y: 460, w: 5500, h: 5440 },
    clear: { x0: 3280, y0: 200, x1: 9660, y1: 6250 },
    predictClear: { x0: 3280, y0: 200, x1: 8820, y1: 6250 },
    cardClear: { x0: 5350, y0: 220, x1: 9640, y1: 6250 },
    safeZones: {
      heading: { ...HEADING_ZONE },
      hud: { x0: 9840, y0: 200, x1: 14050, y1: 3220 },
      predict: { ...PREDICT_ZONE },
      lab: { ...LAB_ZONE },
    },
    rails: { lx: 2820, rx: 9450, yMin: 1800, yMax: 5600 },
    hud: makeHud(TIERS_VIEW, 9900, 100, 39, [1940, 2660]),
    css: makeStageCss(150),
  },
};

function cloneHudCam(cam: HudCam): HudCam {
  return {
    azimuth: cam.azimuth,
    elevation: cam.elevation,
    scale: cam.scale,
    origin: [cam.origin[0], cam.origin[1]],
  };
}

/** Return a safe deep copy of a spread preset, or throw RangeError for an unknown spread kind. */
export function spread(kind: SpreadKind): SpreadSpec {
  const s = SPREADS[kind];
  if (!s) {
    const valid = Object.keys(SPREADS).join(", ");
    throw new RangeError(`Unknown spread "${String(kind)}". Valid spreads: ${valid}`);
  }
  return {
    kind: s.kind,
    label: s.label,
    description: s.description,
    view: { ...s.view },
    viewBox: { ...s.viewBox },
    fs: s.fs,
    box: { ...s.box },
    clear: { ...s.clear },
    predictClear: { ...s.predictClear },
    cardClear: { ...s.cardClear },
    safeZones: {
      heading: { ...s.safeZones.heading },
      hud: { ...s.safeZones.hud },
      predict: { ...s.safeZones.predict },
      lab: { ...s.safeZones.lab },
    },
    rails: { ...s.rails },
    hud: {
      cardCam: cloneHudCam(s.hud.cardCam),
      cardWidth: s.hud.cardWidth,
      meterCams: s.hud.meterCams.map(cloneHudCam),
      meterWidth: s.hud.meterWidth,
    },
    css: s.css,
  };
}

function distributeY(count: number, lo: number, hi: number): number[] {
  if (count <= 0) return [];
  if (lo >= hi) {
    const mid = Math.round((lo + hi) / 2);
    return Array.from({ length: count }, () => mid);
  }
  if (count === 1) return [Math.round((lo + hi) / 2)];
  return Array.from({ length: count }, (_, i) => Math.round(lo + ((hi - lo) * i) / (count - 1)));
}

/**
 * Evenly distribute anatomy callouts along the spread's left (`rails.lx`, anchor `"end"`) and
 * right (`rails.rx`, anchor `"start"`) rails. Left callouts stay below `safeZones.heading.y1`;
 * right callouts stay strictly between `safeZones.hud.y1` and `safeZones.predict.y0`.
 */
export function distributeCallouts(
  spec: SpreadSpec,
  items: { id: string; text: string; to: string; side?: "left" | "right"; beats?: number[] }[],
): { id: string; text: string; at: [number, number]; to: string; beats: number[]; anchor: "end" | "start" }[] {
  const leftIdx: number[] = [];
  const rightIdx: number[] = [];
  items.forEach((item, idx) => {
    if (item.side === "right") rightIdx.push(idx);
    else leftIdx.push(idx);
  });

  const leftLo = Math.max(spec.rails.yMin, spec.safeZones.heading.y1 + Math.round(spec.fs * 1.1));
  const leftHi = spec.rails.yMax;
  const leftYs = distributeY(leftIdx.length, leftLo, leftHi);

  const rightLo = Math.max(spec.rails.yMin, spec.safeZones.hud.y1 + Math.round(spec.fs * 1.25));
  const rightHi = Math.min(spec.rails.yMax, spec.safeZones.predict.y0 - Math.round(spec.fs * 1.0));
  const rightYs = distributeY(rightIdx.length, rightLo, rightHi);

  const out: { id: string; text: string; at: [number, number]; to: string; beats: number[]; anchor: "end" | "start" }[] =
    new Array(items.length);

  leftIdx.forEach((origIdx, slot) => {
    const item = items[origIdx]!;
    out[origIdx] = {
      id: item.id,
      text: item.text,
      at: [spec.rails.lx, leftYs[slot]!],
      to: item.to,
      beats: [...(item.beats ?? [0])],
      anchor: "end",
    };
  });

  rightIdx.forEach((origIdx, slot) => {
    const item = items[origIdx]!;
    out[origIdx] = {
      id: item.id,
      text: item.text,
      at: [spec.rails.rx, rightYs[slot]!],
      to: item.to,
      beats: [...(item.beats ?? [0])],
      anchor: "start",
    };
  });

  return out;
}

/**
 * Render the spread's upper-right studio HUD stack (`explainerCard` + up to 2 stacked `meterBar`s)
 * cleanly locked into `spec.hud`.
 */
export function renderHudStack(
  spec: SpreadSpec,
  card: { title: string; rows: string[]; badge?: string; tone?: CardTone },
  meters?: { label: string; fraction: number; valueText?: string; tone?: CardTone }[],
): string {
  const cardSvg = explainerCard(spec.hud.cardCam, {
    at: [0, 0, 0],
    title: card.title,
    rows: card.rows,
    ...(card.badge !== undefined ? { badge: card.badge } : {}),
    ...(card.tone !== undefined ? { tone: card.tone } : {}),
    width: spec.hud.cardWidth,
  });

  const maxMeters = Math.min(meters?.length ?? 0, spec.hud.meterCams.length, 2);
  let metersSvg = "";
  for (let i = 0; i < maxMeters; i++) {
    const m = meters![i]!;
    const cam = spec.hud.meterCams[i]!;
    metersSvg += meterBar(cam, {
      at: [0, 0, 0],
      w: spec.hud.meterWidth,
      h: 1.85,
      fraction: m.fraction,
      label: m.label,
      ...(m.valueText !== undefined ? { valueText: m.valueText } : {}),
      ...(m.tone !== undefined ? { tone: m.tone } : {}),
    });
  }

  return cardSvg + metersSvg;
}
