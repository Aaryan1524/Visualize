#!/usr/bin/env node
// How a Jet Engine (Turbofan) Works (Everyday Edition): build the standalone HTML page.
//
//   node examples/turbofan/build.mjs [--out <page.html>]
//   node scripts/check-drawing.mjs dist/turbofan.html

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, MODELS, VARIANTS } from "./model.mjs";
import { CALLOUTS, SP, cameraFor, figure } from "./figure.mjs";
import { CLAIMS, COVERAGE, PRED_STEP, STEPS, captions, headings, prediction } from "./story.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const { buildSync } = createRequire(new URL("../../package.json", import.meta.url))("esbuild");
const HERE = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(HERE, "..", "..", "dist", "turbofan.html");

const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

const labelSvg = (l) =>
  `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

// #explainer lives outside [data-camera] with data-camera-avoid="" so it stays upright, crisp,
// never receded, and check-drawing guarantees no framed 3D subject ever overlaps it.
const skeleton = () =>
  `<defs id="rigDefs"></defs><g id="scene" data-camera=""></g><g id="explainer" data-camera-avoid=""></g><g id="labels">${CALLOUTS.map(labelSvg).join("")}</g>`;

// Build-time check: every part named in STEPS or VOICE exists in figure()
function verifyCameraNames() {
  const can = new Set();
  const F = figure(MODELS[BASE], cameraFor(SP.box), { prefix: "tf" });
  for (const p of F.parts) can.add(p.part);
  const sample = F.pose(MODELS[BASE].concept);
  for (const it of sample.items) if (it.part) can.add(it.part);
  const bad = [];
  STEPS.forEach((st, k) =>
    [...(st.shot ?? []), ...(st.subject ?? [])].forEach((n) => can.has(n) || bad.push(`step ${k} names "${n}"`)),
  );
  for (const [v, tracks] of Object.entries(VOICE?.variants ?? {})) {
    tracks.forEach((tr, k) =>
      tr.links.forEach((l) => l.ids.forEach((n) => can.has(n) || bad.push(`voice (${v}, step ${k}) names "${n}"`))),
    );
  }
  if (bad.length) throw new Error(`camera cannot frame: ${bad.join("; ")}`);
}
verifyCameraNames();

function variantData(name) {
  const M = MODELS[name];
  return {
    name,
    label: VARIANTS[name].label,
    svg: skeleton(),
    heads: headings(M),
    captions: captions(M),
    voice: VOICE?.variants?.[name] ?? null,
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- machine hooks (run in the page)
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz");
  const clamp = (u) => Math.max(0, Math.min(1, u));
  const ease = (u) => {
    const c = clamp(u);
    return c * c * (3 - 2 * c);
  };
  let V = null, model = null, cur = null, F = null, stage = null, defsEl = null, lastAt = null;
  let lastFocus = { focus: null, lit: [] };
  let lastHud = "";

  const anim = (k) => (V.voice?.[k] ? Math.max(2.4, 0.8 * V.voice[k].duration) : 0.78 * DATA.plain);

  function stateAt(k, u, tt) {
    if (k === 0) {
      const c = model.concept;
      const fanDeg = (tt * 55 * c.fanSpeed) % 360;
      return {
        ...c,
        fanDeg,
        coreDeg: (fanDeg * 1.45) % 360,
        k: 0,
      };
    }

    const s = model.steps[k - 1];
    const e = ease(clamp(u / 0.88));

    if (s.id === "giant-fan") {
      const fanDeg = (tt * 72 * s.fanSpeed) % 360;
      return { ...s, fanDeg, coreDeg: (fanDeg * 1.45) % 360, k };
    }

    if (s.id === "bypass-vs-core") {
      const fanDeg = (tt * 60 * s.fanSpeed) % 360;
      return { ...s, fanDeg, coreDeg: (fanDeg * 1.45) % 360, k };
    }

    if (s.id === "cool-push") {
      const fanDeg = (tt * 78 * s.fanSpeed) % 360;
      return { ...s, fanDeg, coreDeg: (fanDeg * 1.45) % 360, k };
    }

    if (s.id === "squeeze-and-burn") {
      const liveThrottle = Math.round(50 + 50 * e);
      const sim = simulateEngine(model, liveThrottle, model.bypassRatio);
      const fanDeg = (tt * 88 * sim.fanSpeed) % 360;
      return {
        ...s,
        ...sim,
        cardTitle: s.cardTitle,
        badge: `${sim.squeezeFactor}x squeeze`,
        hudRows: [
          `Compressor: Squeezes core air ${sim.squeezeFactor}x tighter`,
          `Burner: Fuel sprays and burns continuously`,
          `Throttle: Ramping up to ${sim.throttlePct}% power`,
        ],
        fanDeg,
        coreDeg: (fanDeg * 1.65) % 360,
        k,
      };
    }

    if (s.id === "turbine-shaft") {
      const fanDeg = (tt * 96 * s.fanSpeed) % 360;
      return { ...s, fanDeg, coreDeg: (fanDeg * 1.55) % 360, k };
    }

    // Step 6: Throttle & design — steady live cruise comparison
    const fanDeg = (tt * 74 * s.fanSpeed) % 360;
    return { ...s, fanDeg, coreDeg: (fanDeg * 1.45) % 360, k };
  }

  const at = (k, t, still, SEG) => {
    const dur = anim(k);
    const tt = still ? dur : Math.max(0, t - SEG.lead);
    return stateAt(k, clamp(tt / dur), tt);
  };
  const stillAt = (k, SEG) => SEG.lead + anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    lastHud = "";
    F = FIG.figure(model, FIG.cameraFor(DATA.box));
    $("scene").replaceChildren();
    defsEl = $("rigDefs");
    if (defsEl) defsEl.innerHTML = "";
    stage = new FIG.RigStage($("scene"));
    for (const p of F.parts) stage.add(p.id, p.part, p.svg);
  }

  function render(state) {
    cur = state;
    const o = F.pose(state);
    if (o.defs?.length && defsEl) {
      defsEl.insertAdjacentHTML("beforeend", o.defs.join(""));
    }
    stage.apply(o.items);
    lastAt = o.at;
    focusParts();

    const hudSvg = FIG.renderHud(model, state);
    if (hudSvg !== lastHud) {
      const el = $("explainer");
      if (el) el.innerHTML = hudSvg;
      lastHud = hudSvg;
    }

    const hide = Boolean(state.hidePushSplit);
    const b = state.bypassRatio ?? model.bypassRatio;
    const fanPct = state.fanPushPct ?? model.fanPushPct;
    const thr = state.throttlePct ?? model.cruiseThrottlePct;
    const sq = state.squeezeFactor ?? coreSqueezeAt(thr);
    $("r-bypass").textContent = `${b}:1`;
    $("r-fanpush").textContent = hide ? "?" : `${fanPct}%`;
    $("r-squeeze").textContent = `${sq}x`;
    $("r-throttle").textContent = `${thr}%`;
  }

  function focusParts() {
    const { focus, lit } = lastFocus;
    const lab = root.hasAttribute("data-lab") || root.hasAttribute("data-practice");
    const stepShot = !lab && cur?.k > 0 ? (DATA.steps[cur.k]?.shot ?? []) : [];
    const active = lit.length ? lit : stepShot;
    stage?.focus((part) => ({
      recede: active.length ? !active.includes(part) : !lab && focus ? !focus.includes(part) : false,
      named: active.includes(part),
    }));
  }
  const focus = (f) => ((lastFocus = f), focusParts());

  function boundsOf(names) {
    const scene = $("scene");
    if (!scene) return null;
    const inv = scene.getCTM().inverse();
    let b = null;
    const add = (x0, y0, x1, y1) =>
      (b = b
        ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) }
        : { x0, y0, x1, y1 });
    for (const n of names) {
      for (const el of scene.querySelectorAll(`[data-part="${n}"]`)) {
        if (el.style.display === "none") continue;
        const r = el.getBBox();
        if (!r.width && !r.height) continue;
        const m = inv.multiply(el.getCTM());
        const pts = [
          [r.x, r.y],
          [r.x + r.width, r.y],
          [r.x, r.y + r.height],
          [r.x + r.width, r.y + r.height],
        ].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
        add(
          Math.min(...pts.map((q) => q[0])),
          Math.min(...pts.map((q) => q[1])),
          Math.max(...pts.map((q) => q[0])),
          Math.max(...pts.map((q) => q[1])),
        );
      }
    }
    return b;
  }

  // Interactive Lab: Test the engine (Throttle 20..100%, Bypass ratio 1..10)
  function lab(values) {
    const throttle = Math.max(MIN_THROTTLE_PCT, Math.min(MAX_THROTTLE_PCT, Number(values.throttle ?? 85)));
    const bypass = Math.max(MIN_BYPASS, Math.min(MAX_BYPASS, Number(values.bypass ?? model.bypassRatio)));
    const res = simulateEngine(model, throttle, bypass);
    const verdict = res.highBypass
      ? `High-bypass ${bypass}:1 design: ${res.fanPushPct}% of forward push comes from cool fan air (${res.corePushPct}% from the hot core) — quiet and fuel-saving.`
      : res.lowBypass
        ? `Low-bypass ${bypass}:1 design: ${res.corePushPct}% of forward push comes from the blazing hot core jet (${res.fanPushPct}% fan) — compact and fast, but loud and thirsty.`
        : `Mid-bypass ${bypass}:1 design: ${res.fanPushPct}% cool fan push and ${res.corePushPct}% hot core jet — balancing speed with fuel savings.`;
    const bWord = bypass === 1 ? "1 part" : `${bypass} parts`;
    const rows = [
      `Air split: ${bWord} cool bypass to 1 part core (${res.bypassAirPct}% bypass air).`,
      `Push split at ${throttle}% throttle: ${res.fanPushPct}% cool fan, ${res.corePushPct}% hot core jet.`,
      `Core squeeze: ${res.squeezeFactor}x tighter air; rear turbine sends ${res.turbineExtractPct}% of core power back to the fan.`,
    ];
    return {
      ok: res.ok,
      verdict,
      rows,
      state: {
        ...res,
        cardTitle: `Test: ${bypass}:1 at ${throttle}%`,
        fanDeg: (throttle * 3 + bypass * 17) % 360,
        coreDeg: (throttle * 5 + bypass * 23) % 360,
        lab: true,
      },
    };
  }

  // While Lab or Now you try is open on top-left, frame the cutaway engine cleanly in SP.cardClear
  const cardShot = () => ["nacelle", "fan", "core", "turbine"];
  const cardClear = () => DATA.cardClear;

  function question(n, r) {
    const p = FIG.practice(n, r, model);
    return {
      q: p.q,
      choices: p.choices,
      explain: p.explain,
      state: {
        ...p.state,
        fanDeg: 22,
        coreDeg: 36,
      },
    };
  }

  return {
    model: (v) => MODELS_IN_PAGE[v.name],
    mount,
    at,
    stillAt,
    render,
    focus,
    anchors: () => lastAt,
    lab,
    question,
    boundsOf,
    clearArea: () => DATA.camera.clear,
    cardShot,
    cardClear,
    heading: (k) => V.heads[k] ?? null,
    info: () => (cur ? { bypassRatio: cur.bypassRatio, fanPushPct: cur.fanPushPct, throttlePct: cur.throttlePct } : {}),
  };
}

// ---------------------------------------------------------------- build page
const bundle = buildSync({
  entryPoints: [join(HERE, "figure.mjs")],
  bundle: true,
  format: "iife",
  globalName: "FIG",
  write: false,
  minify: true,
  legalComments: "none",
}).outputFiles[0].text;
if (/<\/script/i.test(bundle)) throw new Error("figure bundle contains </script");

const modelSrc =
  readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "") +
  "\nconst MODELS_IN_PAGE = MODELS;\n";
const M0 = MODELS[BASE];
const std = VARIANT_DATA[BASE];
const PREDICTIONS = Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, prediction(m)]));

const DATA = {
  box: SP.box,
  plain: 8,
  base: BASE,
  steps: STEPS.map((s, k) => ({
    heading: headings(M0)[k],
    focus: s.focus,
    ...(s.shot ? { shot: s.shot } : {}),
  })),
  camera: {
    clear: { x0: SP.clear.x0, y0: SP.clear.y0, x1: SP.clear.x1, y1: Math.min(SP.clear.y1, SP.predictClear.y1 - 470) },
    items: {},
    alias: {},
    around: {
      1: ["bypassLower", "coreFlow"],
      2: ["fan"],
      3: ["coreFlow"],
      4: ["fan", "shaft", "core", "coreFlow"],
      5: ["burner", "coreFlow"],
    },
    subject: Object.fromEntries(STEPS.flatMap((s, k) => (s.subject ? [[k, s.subject]] : []))),
  },
  cardClear: SP.cardClear,
  alias: {},
  predict: {
    step: PRED_STEP,
    question: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.question])),
    choices: PREDICTIONS[BASE].choices,
    answer: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.answer])),
    explanation: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.explanation])),
    locked: "Locked in. Press play or next to see which stream wins.",
  },
  lab: {
    button: "Test the engine",
    title: "Test the engine",
    heading: "Throttle and bypass ratio",
    intro: "Slide throttle power and bypass ratio to see the cool bypass push shift live from 35% fan push at 1:1 all the way up to 83% fan push at 10:1.",
    inputs: [
      { id: "throttle", label: "Throttle %", min: M0.minThrottlePct, max: M0.maxThrottlePct, step: 5, value: M0.defaultThrottlePct },
      { id: "bypass", label: "Bypass ratio", min: M0.minBypass, max: M0.maxBypass, step: 1, value: M0.airlinerBypass },
    ],
  },
  variants: VARIANT_DATA,
};

const CSS = `
${readFileSync(new URL("../../src/rig/rig.css", import.meta.url), "utf8")}
${SP.css}
.rig-part[data-part="shadow"][data-recede] .rig-shadow{display:initial}
`;

const HTML = drawingPage({
  title: "Turbofan Jet Engine",
  about: "How a modern jet engine pushes an airliner forward using mostly cool air, not just fire.",
  scene: "turbofan",
  steps: STEPS,
  stageLabel: "A horizontal 3D cutaway of a modern turbofan jet engine showing its silver outer nacelle, wide cool-blue bypass duct, spinning orange front fan with spinner cone, inner steel core casing, two-stage steel compressor, glowing amber-and-crimson burner ring, brass rear turbine linked by a central drive shaft, and hot exhaust nozzle. Use arrow keys to step and space to play.",
  viewBox: SP.viewBox.str,
  figLabel: "Horizontal cutaway turbofan jet engine along the X-axis: gleaming silver outer nacelle and compact inner steel core casing with 45-degree cutaway hatching; giant anodized-orange front fan spinning at the intake; multi-stage steel compressor squeezing core air; glowing amber-and-crimson burner ring; brass rear turbine driving a solid central brass shaft straight back to the front fan; cool cobalt-blue bypass air streamlines sweeping around the core and warm fiery core exhaust shooting out the rear; paired with an upper-right plain-English explainer card and live Cool fan push and Engine throttle meters.",
  concept: "A modern jet engine wraps a giant front fan and bypass duct around a compact burning core. Step through to see how those two air streams create forward push.",
  setup: `An ${M0.airlinerBypass}:1 high-bypass airliner turbofan sweeps ${M0.airlinerBypass} parts of cool bypass air around the outside for every ${M0.oneCorePart} part entering the core, producing ${M0.airlinerFanPct}% of forward push from the cool fan stream and ${M0.airlinerCorePct}% from the hot core jet. A ${M0.fighterBypass}:1 fighter shifts that split to ${M0.fighterFanPct}% fan push and ${M0.fighterCorePct}% hot core jet. Inside the core, spinning compressor blades squeeze air ${M0.coreSqueezeFull} times tighter at full throttle, while the rear turbine captures ${M0.airlinerTurbinePct}% of core power in an ${M0.airlinerBypass}:1 airliner (${M0.fighterTurbinePct}% in a ${M0.fighterBypass}:1 fighter) to drive the center shaft.`,
  whatIf: { label: "Engine design", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-bypass">${M0.bypassRatio}:1</b> bypass ratio</span>
            <span><b id="r-fanpush">?</b> cool fan push</span>
            <span><b id="r-squeeze">${M0.concept.squeezeFactor}x</b> core squeeze</span>
            <span><b id="r-throttle">${M0.cruiseThrottlePct}%</b> throttle</span>`,
  readoutNote: "Every push split, air share, and squeeze factor is calculated live by the model on this page",
  legend: [
    ["var(--orange)", "Giant front fan (pulls in and splits the incoming air)"],
    ["var(--blue)", "Cool bypass air stream (delivers most forward push in an airliner)"],
    ["var(--t-bad)", "Glowing burner and hot core exhaust (drives the rear turbine)"],
    ["#c69738", "Rear turbine and solid center drive shaft powering the front fan"],
  ],
  facts: [
    `In an ${M0.airlinerBypass}:1 high-bypass airliner engine, ${M0.airlinerBypass} parts of cool air sweep through the outer bypass duct for every ${M0.oneCorePart} part entering the core (${M0.bypassAirPct}% bypass air), giving ${M0.airlinerFanPct}% of forward push from the cool fan stream and ${M0.airlinerCorePct}% from the hot core jet.`,
    `In a compact ${M0.fighterBypass}:1 fighter turbofan, ${M0.fighterFanPct}% of forward push comes from the fan and ${M0.fighterCorePct}% from the blazing hot core jet — trading quiet fuel savings for compact size and high-speed exhaust.`,
    `At ${M0.maxThrottlePct}% throttle, multi-stage compressor blades squeeze core air ${M0.coreSqueezeFull} times tighter before steady fuel burning; the rear turbine captures ${M0.airlinerTurbinePct}% of hot gas power in an ${M0.airlinerBypass}:1 airliner (${M0.fighterTurbinePct}% in a ${M0.fighterBypass}:1 fighter) to drive the center shaft back to the compressor and giant front fan.`,
    "Not covered in detail here: nested twin-spool or triple-spool concentric shafts and variable stator guide vanes.",
  ],
  css: CSS,
  modelSrc,
  scripts: bundle,
  machine,
  audit: {
    models: Object.values(MODELS),
    allow: [],
    claims: CLAIMS,
    coverage: COVERAGE,
    reviewFile: join(HERE, "review.json"),
    report: out.replace(/\.html$/, ".audit.json"),
  },
  data: DATA,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
