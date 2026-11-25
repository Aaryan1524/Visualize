#!/usr/bin/env node
// Cutaway Turbofan — Studio Director + Engine A (Three.js Architectural CAD) Benchmark
//
//   node examples/turbofan-studio/build.mjs [--out <page.html>]
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
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "turbofan-studio.html");

// Reuse the recorded Kokoro voiceover clips from examples/turbofan/voice.json
const voicePath = join(ROOT, "examples", "turbofan", "voice.json");
const VOICE = existsSync(voicePath) ? JSON.parse(readFileSync(voicePath, "utf8")) : null;
if (VOICE?.variants) {
  for (const tracks of Object.values(VOICE.variants)) {
    for (const tr of tracks) {
      if (typeof tr.text === "string") {
        tr.text = tr.text.replace(/Open Test the engine/g, "Open Tune below");
      }
    }
  }
}

// Single Source of Truth math model — reuses examples/turbofan/model.mjs formulas verbatim
const turbofanModelSrc = readFileSync(join(ROOT, "examples", "turbofan", "model.mjs"), "utf8");
const modelSrc = `${turbofanModelSrc}

function simModel(params, variant) {
  const spec = VARIANTS[variant] || VARIANTS[BASE];
  const throttlePct = params && params.throttlePct != null ? Number(params.throttlePct) : spec.cruiseThrottlePct;
  const bypassRatio = params && params.bypassRatio != null ? Number(params.bypassRatio) : spec.bypassRatio;
  return simulateEngine(spec, throttlePct, bypassRatio);
}
`;

// Bundle Engine A + Three.js + scene.mjs into one self-contained IIFE script
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
  "nacelle",
  "fan",
  "core_casing",
  "compressor",
  "combustor",
  "turbine",
  "shaft",
  "bypass_flow",
  "core_flow",
];

const CORE_ONLY_PARTS = [
  "fan",
  "core_casing",
  "compressor",
  "combustor",
  "turbine",
  "shaft",
  "core_flow",
];

const STEPS = [
  {
    step: 0,
    tab: "Overview",
    title: "Two air streams inside one cutaway",
    narration:
      "How does a modern jet engine push a huge airliner across the sky? Look inside the cutaway: a giant spinning front fan splits incoming air into two completely different paths around a compact burning core.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "hero", zoom: 1.02 },
    sim: { throttlePct: 85 },
    callouts: [
      { target: "fan", label: "Giant front fan" },
      { target: "combustor", label: "Burning core" },
    ],
    tryOut: null,
  },
  {
    step: 1,
    tab: "Giant fan",
    title: "Splitting incoming air into two paths",
    narration:
      "Start at the intake. The spinning giant front fan grabs an enormous river of air and splits it into two paths: eight parts sweep around the outside through the wide cool bypass duct, while just one part enters the inner metal core.",
    focus: ["fan", "bypass_flow"],
    accents: { fan: "orange", bypass_flow: "cobalt" },
    reveal: ALL_PARTS,
    camera: { preset: "intake", zoom: 1.24 },
    sim: { throttlePct: 85 },
    callouts: [
      { target: "fan", label: "18 wide-chord blades" },
      { target: "bypass_flow", label: "Cool outer bypass duct" },
    ],
    tryOut: null,
  },
  {
    step: 2,
    tab: "Bypass vs core",
    title: "Cool outer river vs blazing core jet",
    narration:
      "Now compare the two streams leaving the back: the wide cool bypass river around the outside, and the compact blazing exhaust inside the inner core. Which one produces most of an airliner's forward push?",
    focus: ["bypass_flow", "core_flow"],
    accents: { bypass_flow: "cobalt", core_flow: "ember" },
    reveal: ALL_PARTS,
    camera: { preset: "bypass_side", zoom: 1.06 },
    sim: { throttlePct: 85 },
    callouts: [
      { target: "bypass_flow", label: "Wide cool bypass river" },
      { target: "core_flow", label: "Compact hot core jet" },
    ],
    tryOut: null,
  },
  {
    step: 3,
    tab: "Cool push",
    title: "80% of thrust comes from cool bypass air",
    narration:
      "It is the cool air! Eighty percent of a modern airliner's forward push comes from the cool bypass stream pushed by the giant front fan, and only twenty percent from the hot core jet. Gently pushing a huge mass of air saves fuel and cuts noise.",
    focus: ["bypass_flow", "fan", "nacelle"],
    accents: { bypass_flow: "cobalt", fan: "cobalt", nacelle: "cobalt" },
    reveal: ALL_PARTS,
    camera: { preset: "bypass_cutaway", zoom: 1.18 },
    sim: { throttlePct: 85 },
    callouts: [
      { target: "bypass_flow", label: "80% cool fan thrust" },
      { target: "nacelle", label: "Wide bypass cowling" },
    ],
    tryOut: null,
  },
  {
    step: 4,
    tab: "Squeeze & burn",
    title: "30× compression and steady burning",
    narration:
      "Inside the core, tight spinning compressor blades squeeze the incoming air thirty times tighter. Then fuel sprays into the glowing annular burner ring, where it burns steadily and expands outward with huge force.",
    focus: ["compressor", "combustor", "core_flow"],
    accents: { compressor: "gold", combustor: "ember", core_flow: "ember" },
    // Progressive Reveal: peel back the outer bypass cowling for an unobstructed macro look at the core!
    reveal: CORE_ONLY_PARTS,
    camera: { preset: "core_burner", zoom: 1.52 },
    sim: { throttlePct: 100 },
    callouts: [
      { target: "compressor", label: "30× axial compressor" },
      { target: "combustor", label: "Steady annular burner" },
    ],
    tryOut: null,
  },
  {
    step: 5,
    tab: "Turbine shaft",
    title: "Hot exhaust powers the front fan",
    narration:
      "That rushing hot gas spins the rear turbine at the back. The turbine extracts eighty percent of the core's energy and sends it straight forward along the solid center drive shaft to keep the compressor and giant front fan spinning.",
    focus: ["turbine", "shaft", "fan"],
    accents: { turbine: "gold", shaft: "orange", fan: "orange" },
    reveal: CORE_ONLY_PARTS,
    camera: { preset: "turbine_shaft", zoom: 1.26 },
    sim: { throttlePct: 100 },
    callouts: [
      { target: "turbine", label: "Rear power turbine" },
      { target: "shaft", label: "Center drive shaft" },
    ],
    tryOut: null,
  },
  {
    step: 6,
    tab: "Airliner vs fighter",
    title: "Quiet bypass efficiency vs raw jet blast",
    narration:
      "Changing the bypass ratio trades quiet fuel savings for raw jet speed. An 8:1 airliner puts 80% of its push into cool bypass air, while a 1:1 fighter puts 65% into its blazing hot core jet. Try it live below.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "compare", zoom: 0.96 },
    sim: { throttlePct: 85 },
    callouts: [
      { target: "bypass_flow", label: "Cool bypass stream" },
      { target: "core_flow", label: "Hot core exhaust" },
    ],
    tryOut: {
      prompt:
        "Switch to Fighter (1:1) below and open Tune to push Throttle past 90% — watch the core jet take over thrust.",
      checkSrc: "(sim) => sim.bypassRatio <= 2 && sim.throttlePct >= 90",
      successText:
        "Verified! At 1:1 bypass and ≥90% throttle, the nacelle slims down and the blazing core jet delivers 65% of thrust.",
    },
  },
];

const html = studioPage({
  title: "How a Jet Engine Works",
  about: "High-bypass cutaway turbofan · Interactive 3D CAD studio",
  sceneId: "turbofan-studio",
  themeDefault: "light",
  variants: [
    { name: "airliner", label: "Airliner (8:1)", defaults: { bypassRatio: 8, throttlePct: 85 } },
    { name: "fighter", label: "Fighter (1:1)", defaults: { bypassRatio: 1, throttlePct: 85 } },
  ],
  controls: [
    { id: "throttlePct", label: "Throttle", min: 20, max: 100, step: 1, unit: "%" },
    { id: "bypassRatio", label: "Bypass ratio", min: 1, max: 10, step: 1, unit: ":1" },
  ],
  telemetry: [
    { id: "bypassRatio", label: "Bypass", formatSrc: "(s) => `${s.bypassRatio}:1`" },
    { id: "fanPushPct", label: "Fan push", formatSrc: "(s) => `${s.fanPushPct}%`" },
    { id: "corePushPct", label: "Core jet", formatSrc: "(s) => `${s.corePushPct}%`" },
    { id: "squeezeFactor", label: "Squeeze", formatSrc: "(s) => `${s.squeezeFactor}×`" },
  ],
  steps: STEPS,
  voice: VOICE,
  modelSrc,
  engineBundle,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Built ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
