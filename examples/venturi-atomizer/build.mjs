#!/usr/bin/env node
// Perfume Venturi Atomizer — Studio Director + Engine A (Three.js 3D CAD Studio)
//
//   node examples/venturi-atomizer/build.mjs [--out <page.html>]
//
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { studioPage } from "../../src/studio/director.mjs";

const { buildSync } = createRequire(new URL("../../package.json", import.meta.url))("esbuild");
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "venturi-atomizer.html");

// Auto-load Kokoro voiceover clips if present
const voicePath = join(HERE, "voice.json");
const VOICE = existsSync(voicePath) ? JSON.parse(readFileSync(voicePath, "utf8")) : null;

// Single Source of Truth Bernoulli / Venturi Atomizer Physics Model
const modelSrc = `
const VARIANTS = {
  fine: { name: "fine", label: "Fine Perfume (0.4 mm)", nozzleWidthMm: 0.4, pumpSpeedPct: 76 },
  wide: { name: "wide", label: "Wide Sprayer (1.1 mm)", nozzleWidthMm: 1.1, pumpSpeedPct: 76 },
};

const AIR_DENSITY = 1.225;       // kg/m^3 at 20 C
const LIQUID_DENSITY = 860;      // kg/m^3 ethanol-water perfume
const GRAVITY = 9.81;            // m/s^2
const LIFT_HEIGHT_M = 0.075;     // 7.5 cm dip-tube vertical lift
const INLET_DIAM_MM = 4.2;       // upstream air duct diameter
const LIFT_THRESHOLD_KPA = (LIQUID_DENSITY * GRAVITY * LIFT_HEIGHT_M) / 1000; // 0.633 kPa hydrostatic lift

function simModel(params, variant) {
  const spec = VARIANTS[variant] || VARIANTS.fine;
  const pumpSpeedPct = Math.max(
    20,
    Math.min(100, Number(params && params.pumpSpeedPct != null ? params.pumpSpeedPct : spec.pumpSpeedPct)),
  );
  const nozzleWidthMm = Math.max(
    0.3,
    Math.min(1.2, Number(params && params.nozzleWidthMm != null ? params.nozzleWidthMm : spec.nozzleWidthMm)),
  );

  // Continuity + realistic viscous throat velocity scaling (m/s)
  const airSpeedMs = +(96 * (pumpSpeedPct / 100) * Math.pow(0.4 / nozzleWidthMm, 0.65)).toFixed(1);
  const areaRatio = Math.pow(nozzleWidthMm / INLET_DIAM_MM, 2);
  const upstreamSpeedMs = airSpeedMs * areaRatio;

  // Bernoulli pressure drop across Venturi throat: dP = 0.5 * rho * (v2^2 - v1^2)
  const pressureDropPa = 0.5 * AIR_DENSITY * (airSpeedMs * airSpeedMs - upstreamSpeedMs * upstreamSpeedMs);
  const pressureDropKpa = +(pressureDropPa / 1000).toFixed(2);
  const liftRatio = +(pressureDropKpa / LIFT_THRESHOLD_KPA).toFixed(2);

  // Aerodynamic Weber breakup Sauter Mean Diameter (micrometers)
  const rawSmd = 30 * Math.pow(nozzleWidthMm / 0.4, 0.55) * Math.pow(82 / Math.max(6, airSpeedMs), 0.85);
  const dropletSizeUm = Math.round(Math.max(18, Math.min(180, rawSmd)));

  const sprayMode =
    liftRatio < 1.0
      ? "No lift"
      : dropletSizeUm < 35
        ? "Fine mist"
        : dropletSizeUm < 65
          ? "Medium spray"
          : "Coarse jet";

  return {
    variant: spec.name,
    pumpSpeedPct: Math.round(pumpSpeedPct),
    plungerForcePct: Math.round(pumpSpeedPct),
    nozzleWidthMm: +nozzleWidthMm.toFixed(2),
    airSpeedMs,
    pressureDropKpa,
    dropletSizeUm,
    liftRatio,
    sprayMode,
  };
}
`;

// Bundle Engine A + Three.js + 3D Venturi Atomizer scene into one self-contained IIFE script
const bundleRes = buildSync({
  entryPoints: [join(HERE, "scene.mjs")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
});
const engineBundle = bundleRes.outputFiles[0].text;

const ALL_PARTS = [
  "air_pump",
  "venturi_throat",
  "reservoir",
  "dip_tube",
  "pressure_pocket",
  "airflow_streamlines",
  "liquid_rise",
  "mist_plume",
];

const DUCT_ONLY = ["air_pump", "venturi_throat", "airflow_streamlines"];
const THROAT_PRESSURE = [
  "air_pump",
  "venturi_throat",
  "airflow_streamlines",
  "pressure_pocket",
];
const LIFT_ASSEMBLY = [
  "air_pump",
  "venturi_throat",
  "reservoir",
  "dip_tube",
  "pressure_pocket",
  "airflow_streamlines",
  "liquid_rise",
];

const STEPS = [
  {
    step: 0,
    tab: "Overview",
    title: "Turning calm liquid into weightless mist",
    narration:
      "A classic perfume atomizer never touches the liquid with the pump. Instead, it shoots fast air across the top of a narrow straw, pulling perfume upward and shredding it into a floating cloud of micro-droplets.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "hero", zoom: 0.98 },
    sim: { pumpSpeedPct: 76 },
    callouts: [
      { target: "venturi_throat", label: "Venturi throat" },
      { target: "mist_plume", label: "Atomized mist cone" },
    ],
    tryOut: null,
  },
  {
    step: 1,
    tab: "Air squeeze",
    title: "Pushing air into a tight bottleneck",
    narration:
      "Start with the upper air passage alone. Squeezing the plunger pushes air rightward through the barrel. When the walls pinch inward into a narrow throat, the same volume of air must speed up dramatically to get through.",
    focus: ["air_pump", "airflow_streamlines"],
    accents: { air_pump: "orange", airflow_streamlines: "cobalt" },
    reveal: DUCT_ONLY,
    camera: { preset: "pump_duct", zoom: 1.32 },
    sim: { pumpSpeedPct: 76 },
    callouts: [
      { target: "air_pump", label: "Air plunger" },
      { target: "airflow_streamlines", label: "Accelerating air stream" },
    ],
    tryOut: null,
  },
  {
    step: 2,
    tab: "Pressure drop",
    title: "Fast air creates a suction pocket",
    narration:
      "Zoom into the bottleneck. By Bernoulli's principle, accelerating air spends its internal pressure energy to gain speed. Static pressure plunges right inside the narrow throat, turning it into a sharp low-pressure pocket.",
    focus: ["venturi_throat", "pressure_pocket", "airflow_streamlines"],
    accents: {
      venturi_throat: "orange",
      pressure_pocket: "cobalt",
      airflow_streamlines: "cobalt",
    },
    reveal: THROAT_PRESSURE,
    camera: { preset: "throat_macro", zoom: 1.72 },
    sim: { pumpSpeedPct: 82 },
    callouts: [
      { target: "venturi_throat", label: "Narrow throat" },
      { target: "pressure_pocket", label: "Low-pressure pocket" },
    ],
    tryOut: null,
  },
  {
    step: 3,
    tab: "Liquid lift",
    title: "Room air pushes perfume up the straw",
    narration:
      "Now connect the bottle and vertical dip tube. Full atmospheric pressure enters the collar vent and pushes down on the perfume surface, forcing liquid up the straw toward the lower pressure waiting in the throat.",
    focus: ["reservoir", "dip_tube", "liquid_rise"],
    accents: { reservoir: "gold", dip_tube: "teal", liquid_rise: "gold" },
    reveal: LIFT_ASSEMBLY,
    camera: { preset: "lift_focus", zoom: 1.18 },
    sim: { pumpSpeedPct: 78 },
    callouts: [
      { target: "reservoir", label: "Atmospheric push" },
      { target: "dip_tube", label: "Rising perfume column" },
    ],
    tryOut: null,
  },
  {
    step: 4,
    tab: "Atomization",
    title: "Air shear shreds liquid into fine mist",
    narration:
      "The moment rising perfume reaches the throat, the high-speed air stream hits it broadside. Intense aerodynamic shear tears the liquid into unstable waves and snaps them apart into tens of thousands of tiny mist droplets.",
    focus: ["venturi_throat", "pressure_pocket", "mist_plume"],
    accents: {
      venturi_throat: "orange",
      pressure_pocket: "cobalt",
      mist_plume: "orange",
    },
    reveal: ALL_PARTS,
    camera: { preset: "mist_focus", zoom: 1.28 },
    sim: { pumpSpeedPct: 84 },
    callouts: [
      { target: "venturi_throat", label: "Air shear breakup" },
      { target: "mist_plume", label: "Micro-droplet cloud" },
    ],
    tryOut: null,
  },
  {
    step: 5,
    tab: "Fine vs wide",
    title: "Nozzle width controls droplet fineness",
    narration:
      "Pinching down to a 0.4 mm perfume nozzle multiplies air speed and pressure drop, shattering the stream into a sub-35 µm weightless mist. Widening to a 1.1 mm nozzle drops air speed sharply and spits heavy coarse droplets.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "compare", zoom: 0.92 },
    sim: { pumpSpeedPct: 76 },
    callouts: [
      { target: "venturi_throat", label: "Throat diameter" },
      { target: "mist_plume", label: "Droplet fineness" },
    ],
    tryOut: {
      prompt:
        "Switch to Wide Sprayer (1.1 mm) below and open Tune to push Pump speed to 90% or higher — see why even near full power a wide nozzle stays a coarse jet (≥70 µm).",
      checkSrc: "(sim) => sim.nozzleWidthMm >= 1.0 && sim.pumpSpeedPct >= 90 && sim.liftRatio >= 1.0 && sim.dropletSizeUm >= 70",
      successText:
        "Verified! Even at ≥90% pump speed, a wide ≥1.0 mm nozzle keeps droplets at ≥70 µm (Coarse jet) — nozzle pinch matters more than brute pump force.",
    },
  },
];

const html = studioPage({
  title: "How a Venturi Atomizer Works",
  about: "Bernoulli pressure drop & mist breakup · 3D CAD Studio",
  hint: "Drag to orbit · Scroll to zoom",
  sceneId: "venturi-atomizer",
  themeDefault: "light",
  variants: [
    { name: "fine", label: "Fine Perfume (0.4 mm)", defaults: { nozzleWidthMm: 0.4, pumpSpeedPct: 76 } },
    { name: "wide", label: "Wide Sprayer (1.1 mm)", defaults: { nozzleWidthMm: 1.1, pumpSpeedPct: 76 } },
  ],
  controls: [
    { id: "pumpSpeedPct", label: "Pump speed", min: 20, max: 100, step: 1, unit: "%" },
    { id: "nozzleWidthMm", label: "Nozzle width", min: 0.3, max: 1.2, step: 0.1, unit: " mm" },
  ],
  telemetry: [
    { id: "airSpeedMs", label: "AIR", formatSrc: "(s) => `${s.airSpeedMs} m/s`" },
    { id: "pressureDropKpa", label: "ΔP", formatSrc: "(s) => `${s.pressureDropKpa} kPa`" },
    { id: "dropletSizeUm", label: "MIST", formatSrc: "(s) => (s.liftRatio < 1.0 ? '—' : `${s.dropletSizeUm} µm`)" },
    { id: "sprayMode", label: "MODE", formatSrc: "(s) => s.sprayMode" },
  ],
  steps: STEPS,
  voice: VOICE,
  modelSrc,
  engineBundle,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Built ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
