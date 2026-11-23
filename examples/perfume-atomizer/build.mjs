#!/usr/bin/env node
// Perfume Atomizer: build the standalone HTML page (`--kind object`, Everyday mode).
//
//   node examples/perfume-atomizer/build.mjs [--out <page.html>]
//   node scripts/check-drawing.mjs dist/perfume-atomizer.html

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, MODELS, VARIANTS } from "./model.mjs";
import { CLAIMS, COVERAGE, PRED_STEP, STEPS, captions, headings, prediction } from "./story.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const { buildSync } = createRequire(new URL("../../package.json", import.meta.url))("esbuild");
const HERE = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(HERE, "..", "..", "dist", "perfume-atomizer.html");

// Stage geometry: 14200 x 6550 units (~11 units/px at 1440x900).
// Left column LX holds step-0 anatomy callouts (below the heading).
// Center clear zone CLEAR holds the 3D bottle + spray cone, strictly clear of #heading (left),
// #explainer (upper-right), and #concept/#predict (bottom-right) at both 1440x900 and 1280x800.
const VBW = 14200, VBH = 6550, FS = 152, LX = 2850;
const BOX = { x: 3450, y: 450, w: 5150, h: 5500 };
const CLEAR = { x0: 3250, y0: 200, x1: 8780, y1: 6250 };
const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

const label = (id, text, x, y, to, beats, anchor) => ({ id, text, at: [x, y], to, beats, anchor });
const LABELS = [
  label("nozzle", "Spray cap", LX, 1800, "nozzle", [0], "end"),
  label("chamber", "Pump chamber", LX, 2900, "chamber", [0], "end"),
  label("straw", "Dip tube straw", LX, 4150, "straw", [0], "end"),
  label("liquid", "Perfume", LX, 5250, "liquid", [0], "end"),
];
const labelSvg = (l) =>
  `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

// #explainer lives outside [data-camera] with data-camera-avoid="" so it stays upright, crisp,
// never receded, and check-drawing guarantees no framed 3D subject ever overlaps it.
const skeleton = () =>
  `<defs id="rigDefs"></defs><g id="scene" data-camera=""></g><g id="explainer" data-camera-avoid=""></g><g id="labels">${LABELS.map(labelSvg).join("")}</g>`;

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
  let V = null, model = null, cur = null, F = null, stage = null, lastAt = null;
  let lastFocus = { focus: null, lit: [] };
  let lastHud = "";

  function stateAt(k, u) {
    if (k === 0) {
      const c = model.concept;
      const pulse = 0.72 + 0.14 * Math.sin(u * Math.PI);
      return { ...c, pressFrac: pulse, sprayStrength: 0.92, k: 0 };
    }
    const s = model.steps[k - 1];
    const e = ease(clamp(u / 0.82));
    if (s.id === "new") {
      return { ...s, k };
    }
    if (s.id === "first-press") {
      return { ...s, pressFrac: e, k };
    }
    if (s.id === "prime") {
      return {
        ...s,
        pressFrac: 1 - e,
        strawFill: e,
        chamberFill: ease(clamp((u - 0.18) / 0.68)),
        ballOpen: u > 0.08,
        k,
      };
    }
    if (s.id === "spray") {
      const spray = ease(clamp((u - 0.18) / 0.55));
      return {
        ...s,
        pressFrac: e,
        chamberFill: 1 - 0.32 * e,
        sprayStrength: spray,
        k,
      };
    }
    if (s.id === "refill") {
      return {
        ...s,
        pressFrac: 1 - e,
        chamberFill: 0.68 + 0.32 * e,
        ballOpen: u > 0.1,
        k,
      };
    }
    // step 6: nearly empty sputtering
    return {
      ...s,
      pressFrac: 0.25 + 0.6 * e,
      sprayStrength: s.sprayStrength * ease(clamp((u - 0.2) / 0.55)),
      k,
    };
  }

  const anim = (k) => (V.voice?.[k] ? Math.max(2, 0.78 * V.voice[k].duration) : 0.75 * DATA.plain);
  const at = (k, t, still, SEG) => {
    const tt = still ? anim(k) : Math.max(0, t - SEG.lead);
    return stateAt(k, clamp(tt / anim(k)));
  };
  const stillAt = (k, SEG) => SEG.lead + anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    lastHud = "";
    F = FIG.figure(model, FIG.cameraFor(model, DATA.box));
    $("scene").replaceChildren();
    stage = new FIG.RigStage($("scene"));
    for (const p of F.parts) stage.add(p.id, p.part, p.svg);
  }

  function render(state) {
    cur = state;
    const o = F.pose(state);
    stage.apply(o.items);
    lastAt = o.at;
    focusParts();

    const hudSvg = FIG.renderHud(model, state);
    if (hudSvg !== lastHud) {
      const el = $("explainer");
      if (el) el.innerHTML = hudSvg;
      lastHud = hudSvg;
    }

    const fillPct = Math.round(state.fillPct ?? 0);
    const left = state.spraysLeft !== undefined ? state.spraysLeft : spraysLeft(model.capacityMl, model.doseMl, fillPct);
    const chPct = Math.round(Math.max(0, Math.min(1, state.chamberFill ?? 0)) * 100);
    $("r-fill").textContent = `${fillPct}%`;
    $("r-chamber").textContent = `${chPct}%`;
    $("r-sprays").textContent = state.hideSprays ? "?" : String(left);
    $("r-status").textContent = state.practice ? "Your turn" : (state.badge ?? "Ready");
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
      let hit = false;
      for (const el of scene.querySelectorAll(`[data-part="${n}"]`)) {
        if (el.style.display === "none") continue;
        const r = el.getBBox();
        if (!r.width && !r.height) continue;
        hit = true;
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
      if (!hit && n === "mist" && lastAt?.mistBox) {
        const mb = lastAt.mistBox;
        add(mb.x0, mb.y0, mb.x1, mb.y1);
      }
    }
    return b;
  }

  // Interactive Lab: Try the sprayer (Pump presses 0..5, Bottle fill 0..100%)
  function lab(values) {
    const presses = Math.max(0, Math.min(model.maxLabPresses, Number(values.presses ?? 3)));
    const fill = Math.max(0, Math.min(100, Number(values.fill ?? model.storyFillPct)));
    const res = simulatePresses(model, presses, fill);
    const ok = res.tone !== "bad";
    let verdict;
    if (res.mode === "empty") {
      verdict = `Bottle is empty (0 ml left) — pressing only pushes dry air.`;
    } else if (res.mode === "sputter" || res.mode === "low-idle") {
      verdict = `Too low at ${fill}% (under ${model.sputterPct}%) — the straw tip sits above the liquid, so it pulls air and sputters.`;
    } else if (res.mode === "new") {
      verdict = `Brand-new bottle at ${fill}% fill — press the cap to push air out of the straw and chamber.`;
    } else if (res.mode === "priming") {
      verdict = res.primed
        ? `Primed after ${presses} ${presses === 1 ? "press" : "presses"} — the chamber is full of perfume and ready to spray mist on the next press.`
        : `Priming press ${presses} of ${model.primingPresses} — clearing air and pulling perfume up the straw.`;
    } else {
      verdict = `Clean fine mist! Each press delivers ${model.doseMl} ml across ${model.mistReachCm} cm.`;
    }
    const rows = [
      `Bottle holds ${res.volumeMl} ml (${res.spraysLeft} sprays left in this ${model.capacityMl} ml bottle).`,
      `Pump chamber: ${res.chamberLabel}. Straw: ${res.strawLabel}.`,
      `Priming needed for this bottle: ${model.primingPresses} ${model.primingPresses === 1 ? "press" : "presses"} (${model.strawLenMm} mm straw).`,
    ];
    return {
      ok,
      verdict,
      rows,
      state: { ...res, cardTitle: `Try: ${presses} ${presses === 1 ? "press" : "presses"}`, lab: true },
    };
  }

  // When Lab or Now you try is open on the top-left, frame the bottle cleanly between the card and #explainer
  const cardShot = () => ["bottle", "liquid", "straw", "chamber", "nozzle", "mist"];
  const cardClear = () => DATA.cardClear;

  function question(n, r) {
    const p = FIG.practice(n, r, model);
    return { q: p.q, choices: p.choices, explain: p.explain, state: p.state };
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
    info: () => (cur ? { fillPct: cur.fillPct, chamberFill: cur.chamberFill, sprayed: !!cur.sprayed } : {}),
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
  box: BOX,
  plain: 8,
  base: BASE,
  steps: STEPS.map((s, k) => ({
    heading: headings(M0)[k],
    focus: s.focus,
    ...(s.shot ? { shot: s.shot } : {}),
  })),
  camera: {
    clear: CLEAR,
    items: {},
    alias: {},
    around: { 1: ["chamber", "nozzle"] },
    subject: Object.fromEntries(STEPS.flatMap((s, k) => (s.subject ? [[k, s.subject]] : []))),
  },
  // While Lab or Now you try is open on the top-left, keep the bottle cleanly centered between
  // the left card (ends ~5200) and #explainer (starts at 9850).
  cardClear: { x0: 5400, y0: 200, x1: 9550, y1: 6250 },
  alias: {},
  predict: {
    step: PRED_STEP,
    question: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.question])),
    choices: PREDICTIONS[BASE].choices,
    answer: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.answer])),
    explanation: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.explanation])),
    locked: "Locked in. Press play or next to see what happens.",
  },
  lab: {
    button: "Try the sprayer",
    title: "Try the sprayer",
    heading: "Pump presses and bottle fill",
    intro: "Change the number of presses and how full the bottle is to watch priming, misting, and sputtering live.",
    inputs: [
      { id: "presses", label: "Presses", min: 0, max: M0.maxLabPresses, step: 1, value: 3 },
      { id: "fill", label: "Bottle %", min: 0, max: 100, step: 1, value: M0.storyFillPct },
    ],
  },
  variants: VARIANT_DATA,
};

const CSS = `
${readFileSync(new URL("../../src/rig/rig.css", import.meta.url), "utf8")}
.label text{font-size:${FS}px;font-weight:500;fill:var(--ink);paint-order:stroke;stroke:var(--stage);stroke-width:48px;stroke-linejoin:round}
.leader{fill:none;stroke:var(--ink);stroke-width:.7px;vector-effect:non-scaling-stroke}
.ldot{fill:var(--ink)}
.vz-step-heading{text-shadow:0 0 6px var(--stage),0 0 12px var(--stage),0 0 18px var(--stage)}
#fig{overflow:visible}
.vz[data-practice] #fig .label,.vz[data-lab] #fig .label,.vz[data-practice] .vz-step-heading{visibility:hidden}
`;

const HTML = drawingPage({
  title: "Perfume Bottle",
  about: "How pressing a tiny cap turns bottled liquid into a fine mist cloud.",
  scene: "perfume-atomizer",
  steps: STEPS,
  stageLabel: "A 3D cutaway glass perfume bottle showing its golden liquid, dip tube straw, spring pump chamber, orange spray cap, and mist cloud. Use arrow keys to step and space to play.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Cutaway crystal glass perfume bottle with golden perfume inside, vertical dip tube straw, cutaway metal pump chamber with spring and check ball, pressable orange spray cap, animated mist spray fan, and a side explainer card with live fill meters.",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: `A hand-pump perfume atomizer holds ${M0.capacityMl} ml (${M0.totalSprays} sprays at ${M0.doseMl} ml each), uses ${M0.primingPresses} priming presses to clear air from its ${M0.strawLenMm} mm straw, and sprays a ${M0.mistReachCm} cm fine mist through a ${M0.pinholeMm} mm pinhole.`,
  whatIf: { label: "Bottle size", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-fill">80%</b> bottle fill</span>
            <span><b id="r-chamber">78%</b> pump chamber</span>
            <span><b id="r-sprays">400</b> sprays left</span>
            <span><b id="r-status">Fine mist</b> spray status</span>`,
  readoutNote: "Every level and spray state is calculated live by the model on this page",
  legend: [
    ["var(--orange)", "Pressable spray cap (the part your finger moves)"],
    ["#d69324", "Golden perfume inside the bottle, straw, and pump chamber"],
    ["var(--t-good)", "Primed and spraying clean mist"],
    ["var(--t-bad)", "Nearly empty or sputtering (air in the pump)"],
  ],
  facts: [
    `A full ${M0.capacityMl} ml bottle holds ${M0.totalSprays} sprays of ${M0.doseMl} ml each; a compact ${MODELS.travel.capacityMl} ml travel bottle holds ${MODELS.travel.totalSprays} sprays and primes in ${MODELS.travel.primingPresses} press thanks to its shorter ${MODELS.travel.strawLenMm} mm straw.`,
    `Two one-way seals keep flow moving in one direction: the bottom check ball closes when you press down (so liquid shoots out the ${M0.pinholeMm} mm pinhole instead of slipping back down the straw) and lifts on release (while the top nozzle seal blocks outside air).`,
    `Below ${M0.sputterPct}% fill when held upright, the liquid surface drops below the bottom tip of the straw, so the pump pulls air and sputters until you tilt the bottle.`,
    "Not covered in detail here: tiny swirl grooves inside the nozzle cap that help spread the droplets evenly.",
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
