#!/usr/bin/env node
// One-command Visualize Studio project scaffolder (2-Engine Architecture).
//
//   node scripts/new-studio.mjs <slug> --topic "<prompt>" [--engine A|C|3d|2d] [--dir <folder>] [--force]
//
// Routes the topic to Engine A (3D Physical CAD Studio) or Engine C (2D Tactile Conceptual Studio),
// refuses silent low-confidence guessing unless --engine is explicitly provided,
// and generates a runnable starter project:
//   - model.mjs      (deterministic single-source-of-truth simModel)
//   - model.test.mjs (passing Node test suite for bounds & invariants)
//   - scene.mjs      (routed engine starter scene implementing globalThis.STUDIO_SCENE)
//   - build.mjs      (esbuild bundler + studioPage() standalone HTML emitter)

import { existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { routeTopic } from "../src/studio/router.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = realpathSync(resolve(HERE, ".."));

export function parseArgs(argv) {
  let slug = null;
  let topic = null;
  let engine = null;
  let dir = null;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--topic") topic = argv[++i] ?? null;
    else if (arg === "--engine") engine = argv[++i] ?? null;
    else if (arg === "--dir") dir = argv[++i] ?? null;
    else if (arg === "--force") force = true;
    else if (arg === "-h" || arg === "--help") {
      console.log(
        'Usage: node scripts/new-studio.mjs <slug> --topic "<prompt>" [--engine A|C|3d|2d] [--dir <folder>] [--force]',
      );
      process.exit(0);
    } else if (!arg.startsWith("--") && !slug) {
      slug = arg;
    }
  }
  return { slug, topic, engine, dir, force };
}

function sanitizeSlug(raw) {
  const cleaned = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) {
    throw new Error("A valid <slug> (e.g. `my-topic`) is required.");
  }
  return cleaned;
}

function titleFromSlugOrTopic(slug, topic) {
  const cleanTopic = String(topic ?? "").trim();
  if (cleanTopic.length >= 4 && cleanTopic.length <= 58) {
    return cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
  }
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function relImport(fromDir, targetAbs) {
  const rel = relative(fromDir, targetAbs).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function generateModelMjs(slug, route) {
  return `// Deterministic Single Source of Truth simulation model for "${slug}" (${route.name}).
// Imported by model.test.mjs and embedded verbatim into the standalone HTML via build.mjs.

export const VARIANTS = {
  baseline: { label: "Baseline", gain: 1.0, intensity: 60 },
  boosted: { label: "High-Output", gain: 1.45, intensity: 60 },
};

export const BASE_VARIANT = "baseline";

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Pure deterministic simulation model.
 * @param {{ intensity?: number, gain?: number }} [params]
 * @param {string} [variant]
 */
export function simModel(params = {}, variant = BASE_VARIANT) {
  const spec = VARIANTS[variant] || VARIANTS[BASE_VARIANT];
  const intensity = Math.round(clamp(params.intensity ?? spec.intensity, 10, 100));
  const gain = Number(clamp(params.gain ?? spec.gain, 0.5, 2.0).toFixed(2));
  const driveNorm = Number(((intensity - 10) / 90).toFixed(3));
  const outputPower = Number((intensity * gain * 1.2).toFixed(1));
  const efficiencyPct = Math.round(clamp(94 - Math.abs(intensity - 65) * 0.28 - (gain - 1) * 10, 42, 96));
  const flowSpeed = Number((0.45 + driveNorm * 1.15 * gain).toFixed(3));
  const activeStage = intensity < 40 ? "idle" : intensity < 80 ? "nominal" : "peak";

  return {
    variant: variant in VARIANTS ? variant : BASE_VARIANT,
    intensity,
    gain,
    driveNorm,
    outputPower,
    efficiencyPct,
    flowSpeed,
    activeStage,
  };
}
`;
}

function generateModelTestMjs(slug) {
  return `import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VARIANTS, simModel } from "./model.mjs";

describe("${slug} simulation model", () => {
  it("is deterministic and returns finite bounded outputs", () => {
    const a = simModel({ intensity: 60 }, "baseline");
    const b = simModel({ intensity: 60 }, "baseline");
    assert.deepEqual(a, b);
    for (const key of ["intensity", "gain", "driveNorm", "outputPower", "efficiencyPct", "flowSpeed"]) {
      assert.ok(Number.isFinite(a[key]), \`Expected finite \${key}, got \${a[key]}\`);
    }
    assert.ok(a.efficiencyPct >= 40 && a.efficiencyPct <= 100);
    assert.ok(a.driveNorm >= 0 && a.driveNorm <= 1);
  });

  it("clamps extreme or invalid inputs without NaN or Infinity", () => {
    const low = simModel({ intensity: -500, gain: -2 }, "baseline");
    const high = simModel({ intensity: 9999, gain: 99 }, "boosted");
    const bad = simModel({ intensity: Number.NaN, gain: Number.POSITIVE_INFINITY }, "unknown");
    for (const out of [low, high, bad]) {
      for (const [k, v] of Object.entries(out)) {
        if (typeof v === "number") {
          assert.ok(Number.isFinite(v), \`Non-finite \${k}: \${v}\`);
        }
      }
    }
    assert.equal(low.intensity, 10);
    assert.equal(high.intensity, 100);
  });

  it("scales output monotonically with intensity and separates variants", () => {
    const baseLow = simModel({ intensity: 30 }, "baseline");
    const baseHigh = simModel({ intensity: 90 }, "baseline");
    const boostHigh = simModel({ intensity: 90 }, "boosted");
    assert.ok(baseHigh.outputPower > baseLow.outputPower);
    assert.ok(boostHigh.outputPower > baseHigh.outputPower);
    assert.ok(VARIANTS.boosted.gain > VARIANTS.baseline.gain);
  });

  it("satisfies the interactive micro-challenge only when target state is reached", () => {
    const challenge = (sim) => sim.gain >= 1.4 && sim.intensity >= 85;
    assert.equal(challenge(simModel({ intensity: 60 }, "baseline")), false);
    assert.equal(challenge(simModel({ intensity: 90 }, "baseline")), false);
    assert.equal(challenge(simModel({ intensity: 90 }, "boosted")), true);
  });
});
`;
}

function generateSceneEngineA(kitImport, title) {
  return `import * as THREE from "three";
import {
  ACCENT_TOKENS,
  baseMount,
  createStudioStage,
  cutawayCylinder,
  flowRibbon,
  shaft,
} from "${kitImport}";

// Starter Engine A (3D Physical CAD Studio) scene for: ${title}
const CAMERA_PRESETS = {
  hero: { position: [-3.8, 2.9, 8.8], target: [0, -0.15, 0], zoom: 1.02 },
  focus: { position: [-1.4, 2.2, 7.6], target: [0.1, -0.1, 0], zoom: 1.32 },
  compare: { position: [-4.1, 3.1, 9.2], target: [-0.2, -0.2, 0], zoom: 0.96 },
};

export function mount(canvas, ctx = {}) {
  const stage = createStudioStage(canvas, {
    theme: ctx.theme === "dark" ? "dark" : "light",
    frustumSize: 5.6,
    cameraPresets: CAMERA_PRESETS,
    initialCamera: "hero",
    pixelRatioCap: 2,
  });

  const registeredIds = [];
  const register = (id, object, opts) => {
    registeredIds.push(id);
    stage.registerPart(id, object, opts);
  };

  stage.root.add(baseMount({ y: -1.85, radius: 3.4 }));

  // Outer cutaway housing
  const housing = cutawayCylinder({
    x0: -2.1,
    length: 4.2,
    rOuter: 1.35,
    rInner: 1.18,
    openDeg: 140,
    startDeg: -22,
    tone: "clayLight",
  });
  register("housing", housing, {
    anchor: [-0.8, 1.32, 0.35],
    accent: "cobalt",
  });

  // Inner coaxial rotor shaft
  const rotorGroup = new THREE.Group();
  const rotor = shaft({
    x0: -2.35,
    length: 4.7,
    r: 0.24,
    collars: 3,
    tone: "graphite",
  });
  rotorGroup.add(rotor);
  register("core", rotorGroup, {
    anchor: [0.25, 0.26, 0.25],
    accent: "orange",
  });

  // Live streamlines driven by simModel
  const stream = flowRibbon({
    curves: [
      [
        [-2.7, 0.65, 0.45],
        [-0.9, 0.72, 0.52],
        [0.9, 0.68, 0.48],
        [2.7, 0.56, 0.38],
      ],
      [
        [-2.7, -0.52, 0.58],
        [-0.8, -0.62, 0.62],
        [0.9, -0.58, 0.58],
        [2.7, -0.45, 0.44],
      ],
    ],
    radius: 0.032,
    color: "cobalt",
    speed: 0.65,
    particleCount: 24,
    opacity: 0.38,
  });
  register("flow", stream.group, {
    anchor: [1.65, 0.68, 0.45],
    accent: "cobalt",
  });

  return {
    engineKind: "A",
    getRegisteredIds() {
      return typeof stage.getRegisteredIds === "function"
        ? stage.getRegisteredIds()
        : [...registeredIds];
    },
    getCameraPresets() {
      return typeof stage.getCameraPresets === "function"
        ? stage.getCameraPresets()
        : Object.keys(CAMERA_PRESETS);
    },
    setFocus(ids, accents) {
      stage.setFocus(ids ?? null, accents || undefined);
    },
    setReveal(ids) {
      stage.setReveal(ids ?? null);
    },
    setCamera(preset, zoom) {
      stage.goToCamera(preset || "hero", zoom);
    },
    resetCamera() {
      stage.resetCamera();
    },
    setTheme(theme) {
      stage.setTheme(theme === "dark" ? "dark" : "light");
    },
    resize() {
      stage.resize();
    },
    getCalloutPos(targetId) {
      return stage.projectAnchor(targetId);
    },
    update(dt, sim = {}) {
      const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0.016;
      const speed = Number(sim.flowSpeed ?? 1.0);
      const boosted = Number(sim.gain ?? 1.0) >= 1.3;
      rotor.rotation.x += safeDt * (1.2 + speed * 2.1);
      stream.update(safeDt, {
        speedScale: 0.6 + speed * 0.7,
        opacityScale: 0.6 + Number(sim.driveNorm ?? 0.5) * 0.6,
        colorHex: boosted ? ACCENT_TOKENS.orange : ACCENT_TOKENS.cobalt,
      });
      stage.render(safeDt);
    },
  };
}

globalThis.STUDIO_SCENE = { mount };
`;
}

function generateSceneEngineC(kitImport, title) {
  return `import { createEditorialStage } from "${kitImport}";

// Starter Engine C (2D Tactile Conceptual Studio) scene for: ${title}
const CAMERA_PRESETS = {
  hero: { x: 500, y: 300, zoom: 1.0 },
  focus: { x: 500, y: 310, zoom: 1.14 },
  compare: { x: 500, y: 300, zoom: 0.96 },
};

const REGISTERED_IDS = [
  "housing",
  "core",
  "flow",
  "slot_A",
  "slot_B",
  "slot_C",
  "slot_D",
  "slot_A_top",
  "slot_B_top",
  "tile_A",
  "tile_B",
  "tile_C",
  "tile_A_bottom",
  "tile_B_bottom",
  "core_evict",
];

export function mount(canvas, ctx = {}) {
  const stage = createEditorialStage(canvas, {
    width: 1000,
    height: 600,
    theme: ctx.theme === "dark" ? "dark" : "light",
    cameraPresets: CAMERA_PRESETS,
    initialCamera: "hero",
  });

  return {
    engineKind: "C",
    getRegisteredIds() {
      return typeof stage.getRegisteredIds === "function"
        ? stage.getRegisteredIds()
        : [...REGISTERED_IDS];
    },
    getCameraPresets() {
      return typeof stage.getCameraPresets === "function"
        ? stage.getCameraPresets()
        : Object.keys(CAMERA_PRESETS);
    },
    setFocus(ids, accents) {
      stage.setFocus(ids ?? null, accents || undefined);
    },
    setReveal(ids) {
      stage.setReveal(ids ?? null);
    },
    setCamera(preset, zoom) {
      stage.goToCamera(preset || "hero", zoom);
    },
    resetCamera() {
      stage.resetCamera();
    },
    setTheme(theme) {
      stage.setTheme(theme === "dark" ? "dark" : "light");
    },
    resize() {
      stage.resize();
    },
    getCalloutPos(targetId) {
      return stage.projectAnchor(targetId);
    },
    update(dt, sim = {}) {
      const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0.016;
      const boosted = Number(sim.gain ?? 1.0) >= 1.3;
      const activeKey = boosted ? "B" : "A";
      const val = Math.round(Number(sim.intensity ?? 60));

      stage.strip("housing", {
        x: 312,
        y: 148,
        eyebrow: "INDEX",
        items: ["A", "B", "C", "D"].map((k) => ({
          id: \`slot_\${k}\`,
          key: k,
          occupied: k === "A" || k === "B" || k === "C",
          active: k === activeKey,
          accent: boosted ? "orange" : "cobalt",
        })),
      });

      stage.track("core", {
        x: 244,
        y: 364,
        eyebrow: "ACTIVE RAIL",
        slots: 4,
        evictEdge: true,
        tiles: [
          { id: "tile_A", key: "A", sublabel: String(val), state: activeKey === "A" ? "active" : "idle", accent: "cobalt" },
          { id: "tile_B", key: "B", sublabel: String(Math.round(val * 1.4)), state: activeKey === "B" ? "active" : "idle", accent: "orange" },
          { id: "tile_C", key: "C", sublabel: "24", state: "idle" },
        ],
      });

      stage.arcLink("flow", {
        from: \`slot_\${activeKey}\`,
        to: \`tile_\${activeKey}\`,
        active: true,
        pulse: true,
        accent: boosted ? "orange" : "cobalt",
      });

      stage.render(safeDt);
    },
  };
}

globalThis.STUDIO_SCENE = { mount };
`;
}

function generateStepsBlock(route, title) {
  if (route.engine === "C") {
    return `const STEPS = [
  {
    step: 0,
    tab: "Overview",
    title: "How ${title} works as one system",
    narration:
      "Start with the switchboard index above the active rail. Each key connects straight to its live slot without scanning.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "hero", zoom: 1.0 },
    sim: { intensity: 60 },
    callouts: [
      { target: "slot_A_top", label: "Direct key index", place: "top" },
    ],
    tryOut: null,
  },
  {
    step: 1,
    tab: "Mechanism",
    title: "Inside the active rail",
    narration:
      "Focus on the active rail. Raising input intensity updates tile values directly from the simulation model while keeping one clean active thread.",
    focus: ["core", "flow"],
    accents: { core: "orange", flow: "cobalt" },
    reveal: ALL_PARTS,
    camera: { preset: "focus", zoom: 1.14 },
    sim: { intensity: 75 },
    callouts: [
      { target: "tile_A_bottom", label: "Active rail tile", place: "bottom" },
    ],
    tryOut: null,
  },
  {
    step: 2,
    tab: "Compare & try",
    title: "Baseline vs high-output regime",
    narration:
      "Switch between Baseline and High-Output presets below, then open Tune to push intensity into the peak operating zone.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "compare", zoom: 0.96 },
    sim: { intensity: 60 },
    callouts: [
      { target: "core_evict", label: "Boundary edge", place: "bottom" },
    ],
    tryOut: {
      prompt: "Switch to High-Output below and raise Intensity to at least 85% in Tune.",
      checkSrc: "(sim) => sim.gain >= 1.4 && sim.intensity >= 85",
      successText: "Verified! High-Output mode at ≥85% intensity drives peak output power.",
    },
  },
];`;
  }

  return `const STEPS = [
  {
    step: 0,
    tab: "Overview",
    title: "How ${title} works as one system",
    narration:
      "Start with the full picture. The outer housing frames the core mechanism while live flow responds directly to the simulation model.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "hero", zoom: 1.02 },
    sim: { intensity: 60 },
    callouts: [
      { target: "housing", label: "Primary frame" },
      { target: "core", label: "Active core" },
    ],
    tryOut: null,
  },
  {
    step: 1,
    tab: "Mechanism",
    title: "Inside the active core",
    narration:
      "Focus on the core stage. Raising input intensity accelerates internal motion and increases total output power while shifting efficiency.",
    focus: ["core", "flow"],
    accents: { core: "orange", flow: "cobalt" },
    reveal: ALL_PARTS,
    camera: { preset: "focus", zoom: 1.24 },
    sim: { intensity: 75 },
    callouts: [
      { target: "core", label: "Core stage" },
      { target: "flow", label: "Live flow response" },
    ],
    tryOut: null,
  },
  {
    step: 2,
    tab: "Compare & try",
    title: "Baseline vs high-output regime",
    narration:
      "Switch between Baseline and High-Output presets below, then open Tune to push intensity into the peak operating zone.",
    focus: null,
    reveal: ALL_PARTS,
    camera: { preset: "compare", zoom: 0.98 },
    sim: { intensity: 60 },
    callouts: [
      { target: "housing", label: "System envelope" },
      { target: "flow", label: "Peak output stream" },
    ],
    tryOut: {
      prompt: "Switch to High-Output below and raise Intensity to at least 85% in Tune.",
      checkSrc: "(sim) => sim.gain >= 1.4 && sim.intensity >= 85",
      successText: "Verified! High-Output mode at ≥85% intensity drives peak output power.",
    },
  },
];`;
}

function generateBuildMjs({
  slug,
  title,
  route,
  directorImport,
  pkgJsonRel,
  repoRootAbs,
  insideRepoExamples,
}) {
  const subtitle = `${route.name} · Interactive Studio explainer`;
  const hint = route.engine === "A" ? "Drag to orbit · Scroll to zoom" : "";
  const defaultOutExpr = insideRepoExamples
    ? `join(REPO_ROOT, "dist", ${JSON.stringify(`${slug}.html`)})`
    : `join(HERE, "dist", ${JSON.stringify(`${slug}.html`)})`;

  return `#!/usr/bin/env node
// Standalone HTML Studio builder for "${slug}" (${route.name}).
//
//   node build.mjs [--out <page.html>]
//
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { studioPage } from "${directorImport}";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = ${JSON.stringify(repoRootAbs)};
const { buildSync } = createRequire(new URL("${pkgJsonRel}", import.meta.url))("esbuild");

const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? resolve(process.argv[outArg + 1]) : ${defaultOutExpr};

// Automatically embed offline Kokoro narration when voice.json exists beside build.mjs
const voicePath = join(HERE, "voice.json");
const VOICE = existsSync(voicePath) ? JSON.parse(readFileSync(voicePath, "utf8")) : null;

const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8");

const bundleRes = buildSync({
  entryPoints: [join(HERE, "scene.mjs")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  nodePaths: [join(REPO_ROOT, "node_modules")],
});
const engineBundle = bundleRes.outputFiles[0].text;

const ALL_PARTS = ["housing", "core", "flow"];

${generateStepsBlock(route, title)}

const html = studioPage({
  title: ${JSON.stringify(title)},
  about: ${JSON.stringify(subtitle)},
  hint: ${JSON.stringify(hint)},
  sceneId: ${JSON.stringify(slug)},
  themeDefault: "light",
  variants: [
    { name: "baseline", label: "Baseline", defaults: { gain: 1.0, intensity: 60 } },
    { name: "boosted", label: "High-Output", defaults: { gain: 1.45, intensity: 60 } },
  ],
  controls: [
    { id: "intensity", label: "Intensity", min: 10, max: 100, step: 1, unit: "%" },
  ],
  telemetry: [
    { id: "outputPower", label: "Output", formatSrc: "(s) => \`\${s.outputPower} W\`" },
    { id: "efficiencyPct", label: "Efficiency", formatSrc: "(s) => \`\${s.efficiencyPct}%\`" },
    { id: "activeStage", label: "Regime", formatSrc: "(s) => String(s.activeStage)" },
  ],
  steps: STEPS,
  voice: VOICE,
  modelSrc,
  engineBundle,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(\`Built \${out} (\${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)\`);
`;
}

export function scaffoldStudio({ slug: rawSlug, topic, engine, dir, force = false }) {
  const slug = sanitizeSlug(rawSlug);
  const prompt = String(topic ?? slug.replace(/-/g, " ")).trim();
  const route = routeTopic(prompt, engine ? { engine } : {});

  if (route.ambiguous && !engine) {
    const signals = route.matchedSignals.length > 0 ? route.matchedSignals.join(", ") : "none";
    throw new Error(
      `Low-confidence / ambiguous topic "${prompt}" (confidence ${Math.round(route.confidence * 100)}% < 60%, matchedSignals: ${signals}). Refusing to guess silently — re-run with --engine A (3D physical CAD) or --engine C (2D tactile conceptual).`,
    );
  }

  const targetDir = resolve(dir || join(ROOT, "examples", slug));

  if (existsSync(targetDir) && !force) {
    const entries = readdirSync(targetDir);
    if (entries.length > 0) {
      throw new Error(
        `Target directory is not empty: ${targetDir}. Pass --force to overwrite starter files.`,
      );
    }
  }

  mkdirSync(targetDir, { recursive: true });
  const realTargetDir = realpathSync(targetDir);
  const examplesRoot = join(ROOT, "examples");
  const insideRepoExamples =
    realTargetDir === examplesRoot || realTargetDir.startsWith(`${examplesRoot}${sep}`);

  const title = titleFromSlugOrTopic(slug, prompt);
  const kitImport = relImport(realTargetDir, join(ROOT, route.kitPath));
  const directorImport = relImport(realTargetDir, join(ROOT, "src", "studio", "director.mjs"));
  const pkgJsonRel = relImport(realTargetDir, join(ROOT, "package.json"));

  const sceneSrc =
    route.engine === "A"
      ? generateSceneEngineA(kitImport, title)
      : generateSceneEngineC(kitImport, title);

  const defaultOutPath = insideRepoExamples
    ? join(ROOT, "dist", `${slug}.html`)
    : join(realTargetDir, "dist", `${slug}.html`);

  const files = {
    "model.mjs": generateModelMjs(slug, route),
    "model.test.mjs": generateModelTestMjs(slug),
    "scene.mjs": sceneSrc,
    "build.mjs": generateBuildMjs({
      slug,
      title,
      route,
      directorImport,
      pkgJsonRel,
      repoRootAbs: ROOT,
      insideRepoExamples,
    }),
  };

  const written = [];
  for (const [name, content] of Object.entries(files)) {
    const fullPath = join(targetDir, name);
    writeFileSync(fullPath, content, "utf8");
    written.push(fullPath);
  }

  return { slug, title, prompt, route, targetDir, defaultOutPath, insideRepoExamples, files: written };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.slug) {
    console.error(
      'Usage: node scripts/new-studio.mjs <slug> --topic "<prompt>" [--engine A|C|3d|2d] [--dir <folder>] [--force]',
    );
    process.exit(1);
  }

  const res = scaffoldStudio(opts);
  const checkScript = join(ROOT, "scripts", "check-studio.mjs");
  const reviewScript = join(ROOT, "scripts", "studio-review.mjs");
  const voiceScript = join(ROOT, "scripts", "studio-voice.mjs");
  const htmlPath = res.defaultOutPath;
  const shotsDir = `/tmp/${res.slug}-shots`;
  const reviewPath = `/tmp/${res.slug}-review.json`;
  const modelPath = join(res.targetDir, "model.mjs");
  const modelTestPath = join(res.targetDir, "model.test.mjs");
  const buildPath = join(res.targetDir, "build.mjs");
  const voiceOutPath = join(res.targetDir, "voice.json");

  console.log(`Studio scaffold created: ${res.targetDir}`);
  console.log(`  Engine:     Engine ${res.route.engine} — ${res.route.name} (${res.route.kitPath})`);
  console.log(`  Confidence: ${Math.round(res.route.confidence * 100)}%`);
  console.log(`  Reason:     ${res.route.reason}`);
  console.log(`  Primitives: ${res.route.recommendedPrimitives.join(", ")}`);
  console.log("  Files:");
  for (const f of res.files) {
    console.log(`    - ${f}`);
  }
  console.log("  Next steps:");
  console.log(`    1. node --test ${modelTestPath}`);
  console.log(`    2. node ${buildPath}`);
  console.log(`    3. node ${checkScript} ${htmlPath} --shots ${shotsDir}`);
  console.log(
    `    4. node ${reviewScript} brief ${htmlPath} --shots ${shotsDir} --model ${modelPath} --out ${reviewPath}`,
  );
  console.log(
    `    5. node ${reviewScript} verify ${htmlPath} --review ${reviewPath} --shots ${shotsDir} --model ${modelPath}`,
  );
  console.log(
    `    6. node ${voiceScript} --from-html ${htmlPath} --out ${voiceOutPath}`,
  );
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(`new-studio: ${err?.message ?? err}`);
    process.exit(1);
  }
}
