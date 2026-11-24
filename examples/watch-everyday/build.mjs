#!/usr/bin/env node
// How an Automatic Watch Works (Everyday Edition): build the standalone HTML page.
//
//   node examples/watch-everyday/build.mjs [--out <page.html>]
//   node scripts/check-drawing.mjs dist/watch-everyday.html

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, MODELS, VARIANTS, escapementAt } from "./model.mjs";
import { cameraFor, figure } from "./figure.mjs";
import { CLAIMS, COVERAGE, PRED_STEP, STEPS, captions, headings, prediction } from "./story.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const { buildSync } = createRequire(new URL("../../package.json", import.meta.url))("esbuild");
const HERE = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(HERE, "..", "..", "dist", "watch-everyday.html");

// Stage geometry: 14200 x 6550 units (~10 units/px at 1440x900).
// Left column LX holds the 5 step-0 anatomy callouts in strict top-to-bottom monotonic order,
// cleanly below #heading. Center clear zone CLEAR frames the 3-layer exhibition watch, strictly
// clear of #heading (top-left), #explainer (upper-right), and #concept/#predict (bottom-right).
const VBW = 14200, VBH = 6550, FS = 152, LX = 2780, RX = 9500;
const BOX = { x: 3300, y: 340, w: 5150, h: 5820 };
const CLEAR = { x0: 3500, y0: 960, x1: 8100, y1: 6180 };
const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

const label = (id, text, x, y, to, beats, anchor = "end") => ({ id, text, at: [x, y], to, beats, anchor });
const LABELS = [
  label("dial", "Exhibition dial", LX, 1780, "dial", [0], "end"),
  label("rotor", "Weighted rotor", LX, 2940, "rotor", [0], "end"),
  label("barrel", "Mainspring barrel", LX, 4120, "barrel", [0], "end"),
  label("balance", "Balance wheel", LX, 5360, "balance", [0], "end"),
  label("third", "Gear train", RX, 3560, "third", [0], "start"),
];
const labelSvg = (l) =>
  `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

// #explainer lives outside [data-camera] with data-camera-avoid="" so it stays upright, crisp,
// never receded, and check-drawing guarantees no framed 3D subject ever overlaps it.
const skeleton = () =>
  `<defs id="rigDefs"></defs><g id="scene" data-camera=""></g><g id="explainer" data-camera-avoid=""></g><g id="labels">${LABELS.map(labelSvg).join("")}</g>`;

// Build-time check: every part named in STEPS or VOICE exists in figure()
function verifyCameraNames() {
  const can = new Set();
  const F = figure(MODELS[BASE], cameraFor(BOX), { prefix: "we" });
  for (const p of F.parts) can.add(p.part);
  const sample = F.pose({ reserveHours: 30, rotorDeg: 140, centerDeg: 0, esc: escapementAt(0.25, true) });
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
    const tRun = tt;
    if (k === 0) {
      const c = model.concept;
      const rotorDeg = c.rotorSwinging
        ? 145 + 32 * Math.sin(u * Math.PI * 2)
        : 168;
      const esc = escapementAt(tRun, c.running);
      return {
        ...c,
        rotorDeg,
        centerDeg: c.running ? -tRun * 4.5 : 0,
        useEscDrive: true,
        esc,
        hourDeg: 148 - tRun * 0.2,
        minuteDeg: 28 - tRun * 2.4,
        secondDeg: -45 - tRun * 36,
        k: 0,
      };
    }

    const s = model.steps[k - 1];
    const e = ease(clamp(u / 0.85));

    if (s.id === "wrist-motion") {
      // Heavy orange half-moon rotor swings briskly and finishes wide open in front (162 deg)
      const rotorDeg = 162 - 88 * Math.cos(u * Math.PI * 1.5);
      const liveReserve = Math.round(18 + 12 * e);
      return {
        ...s,
        reserveHours: liveReserve,
        turns: springTurns(liveReserve),
        rotorDeg,
        centerDeg: -tRun * 5,
        useEscDrive: true,
        esc: escapementAt(tRun, true),
        hourDeg: 148,
        minuteDeg: 28 - tRun * 2.2,
        secondDeg: -45 - tRun * 36,
        k,
      };
    }

    if (s.id === "wound-spring") {
      // Park rotor cleanly on the upper-left/back-left (118 deg) so it never touches #explainer
      // on the right while leaving the brass barrel & blued spring completely clear below!
      const liveReserve = Math.round(24 + 18 * e);
      return {
        ...s,
        reserveHours: liveReserve,
        turns: springTurns(liveReserve),
        rotorDeg: 118,
        centerDeg: -e * 22,
        useEscDrive: false,
        esc: escapementAt(tRun, true),
        hourDeg: 148,
        minuteDeg: 28,
        secondDeg: -45 - tRun * 24,
        k,
      };
    }

    if (s.id === "ticking-brake") {
      // Focus on balance wheel swinging & pallet fork releasing one escape tooth per beat!
      // Park rotor at back-center-right (18 deg) so top-left heading sits in 100% pure whitespace!
      const esc = escapementAt(tRun * 1.15, true);
      return {
        ...s,
        rotorDeg: 18,
        centerDeg: -tRun * 3.5,
        useEscDrive: true,
        esc,
        hourDeg: 148,
        minuteDeg: 28,
        secondDeg: -45 - tRun * 36,
        k,
      };
    }

    if (s.id === "gear-train") {
      // Negative centerDeg drives centerWheel & fourthWheel CW (matching the hands) and
      // escapePinion/escapeWheel CCW (matching the club-tooth rake and escapement beats!)
      const centerDeg = -e * 54;
      return {
        ...s,
        rotorDeg: 118,
        centerDeg,
        useEscDrive: false,
        esc: escapementAt(tRun, true),
        hourDeg: 148 - e * 4,
        minuteDeg: 28 - e * 48,
        secondDeg: -45 - e * 220,
        k,
      };
    }

    if (s.id === "watch-hands") {
      // Concentric center shafts sweep the three hands above the open-heart exhibition dial
      return {
        ...s,
        rotorDeg: 155,
        centerDeg: -e * 28,
        useEscDrive: true,
        esc: escapementAt(tRun, true),
        hourDeg: 148 - e * 14,
        minuteDeg: 28 - e * 72,
        secondDeg: -45 - e * 260,
        k,
      };
    }

    // Step 6: Off the wrist — reserve drains down to 0 hours and balance wheel rests completely still
    const liveReserve = Math.round(12 * (1 - ease(clamp(u / 0.65))));
    const stillRunning = liveReserve > 0;
    const liveTurns = springTurns(liveReserve);
    return {
      ...s,
      reserveHours: liveReserve,
      turns: liveTurns,
      running: stillRunning,
      ticksPerSec: stillRunning ? model.ticksPerSec : 0,
      badge: stillRunning ? "Draining" : "Stopped",
      tone: stillRunning ? "hot" : "bad",
      hudRows: stillRunning
        ? [
            `Nightstand: Drains ${model.drainPerHourStill} h per hour still`,
            `Spring: ${liveTurns} of ${model.maxSpringTurns} coiled turns left`,
            "Beat: Still ticking — draining down",
          ]
        : s.hudRows,
      rotorDeg: 118,
      centerDeg: stillRunning ? -tRun * 2 : 0,
      useEscDrive: true,
      esc: escapementAt(tRun, stillRunning),
      hourDeg: 134,
      minuteDeg: -44,
      secondDeg: 55,
      k,
    };
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

    const hrs = Math.max(0, Math.min(model.fullReserveHours, Math.round(state.reserveHours ?? 0)));
    const turns = state.turns !== undefined ? state.turns : springTurns(hrs);
    const running = state.running !== undefined ? state.running : hrs > 0;
    const ticks = state.ticksPerSec !== undefined ? state.ticksPerSec : running ? model.ticksPerSec : 0;
    $("r-reserve").textContent = state.hideReserve ? "?" : `${hrs} h`;
    $("r-turns").textContent = state.hideReserve ? "?" : `${turns} / ${model.maxSpringTurns}`;
    $("r-beat").textContent = `${ticks} / sec`;
    $("r-status").textContent = state.practice ? "Your turn" : (state.badge ?? (running ? "Running" : "Stopped"));
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

  // Interactive Lab: Try the watch (Hours worn 0..12, Hours on nightstand 0..48)
  function lab(values) {
    const worn = Math.max(0, Math.min(model.maxLabWornHours, Number(values.worn ?? 6)));
    const still = Math.max(0, Math.min(model.maxLabNightstandHours, Number(values.nightstand ?? 8)));
    const res = simulateWatch(model, worn, still, model.labStartReserveHours);
    let verdict;
    if (!res.running) {
      verdict = `Stopped at 0 hours — sitting still for ${still} hours completely unwound the spring. Pick it up to wind it back up.`;
    } else if (res.low) {
      verdict = `Running low at ${res.reserveHours} hours (${res.turns} coiled turns left) — wear it soon before it stops.`;
    } else if (res.reserveHours >= model.fullReserveHours) {
      verdict = `Fully wound at ${res.reserveHours} hours (${res.turns} tight turns) — slipping clutch protects the spring from overwinding.`;
    } else {
      verdict = `Running strong with ${res.reserveHours} hours of power reserve (${res.turns} of ${model.maxSpringTurns} coiled turns).`;
    }
    const rows = [
      `Started at ${res.startHours} h -> after ${worn} h worn (+${worn * model.windGainPerHourWorn} h): ${res.afterWearHours} h${res.clippedByClutch ? " (capped at 42 h)" : ""}.`,
      `After ${still} h on nightstand (-${still} h): ${res.reserveHours} h left (${res.pct}% full).`,
      `Balance wheel: ${res.running ? `${res.ticksPerSec} gentle ticks every second` : "resting still (0 ticks / sec)"}.`,
    ];
    return {
      ok: res.ok,
      verdict,
      rows,
      state: {
        ...res,
        cardTitle: `Try: ${worn} h worn, ${still} h still`,
        rotorDeg: worn > 0 ? 132 + ((worn * 19) % 45) : 172,
        centerDeg: -res.reserveHours * 1.4,
        useEscDrive: true,
        esc: escapementAt(res.running ? 0.35 : 0, res.running),
        hourDeg: 145 - (worn + still) * 2,
        minuteDeg: 25 - (worn * 15) % 360,
        secondDeg: -40 - (still * 7) % 360,
        lab: true,
      },
    };
  }

  // While Lab or Now you try is open on top-left, frame the 3-layer watch cleanly between the left card & #explainer
  const cardShot = () => ["dial", "rotor", "barrel", "center", "balance"];
  const cardClear = () => DATA.cardClear;

  function question(n, r) {
    const p = FIG.practice(n, r, model);
    return {
      q: p.q,
      choices: p.choices,
      explain: p.explain,
      state: {
        ...p.state,
        centerDeg: 0,
        useEscDrive: true,
        esc: escapementAt(0.35, true),
        hourDeg: 148,
        minuteDeg: 28,
        secondDeg: -45,
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
    info: () => (cur ? { reserveHours: cur.reserveHours, running: !!cur.running } : {}),
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
    around: {
      2: ["balance", "third"],
      3: ["center", "fourth"],
      4: ["barrel", "balance"],
    },
    subject: Object.fromEntries(STEPS.flatMap((s, k) => (s.subject ? [[k, s.subject]] : []))),
  },
  // While Lab or Now you try is open on top-left, keep the watch centered between left card (~5200) and #explainer (9850)
  cardClear: { x0: 5400, y0: 200, x1: 9550, y1: 6250 },
  alias: {},
  predict: {
    step: PRED_STEP,
    question: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.question])),
    choices: PREDICTIONS[BASE].choices,
    answer: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.answer])),
    explanation: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.explanation])),
    locked: "Locked in. Press play or next to see what stops it.",
  },
  lab: {
    button: "Try the watch",
    title: "Try the watch",
    heading: "Hours worn and hours on nightstand",
    intro: "Slide how long you wear the watch and how long it rests on a nightstand to watch the mainspring coil, power reserve, and balance beat respond live.",
    inputs: [
      { id: "worn", label: "Hours worn", min: 0, max: M0.maxLabWornHours, step: 1, value: 6 },
      { id: "nightstand", label: "Nightstand h", min: 0, max: M0.maxLabNightstandHours, step: 1, value: 8 },
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
  title: "Automatic Watch",
  about: "How flicking your wrist powers a mechanical watch with zero battery.",
  scene: "watch-everyday",
  steps: STEPS,
  stageLabel: "A 3-layer exhibition cutaway of an automatic mechanical watch showing its metal base plate, brass gear train, coiled blued mainspring, ruby-jeweled rocking pallet brake, balance wheel, orange weighted half-moon rotor, and open-cutaway dial with sweeping hands. Use arrow keys to step and space to play.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "3-layer exploded exhibition automatic watch: metal base plate with meshed brass gear train, open mainspring barrel with blued steel spring, steel escape wheel, ruby-jeweled pallet lever, and brass balance wheel below; anodized-orange weighted half-moon rotor on the center shaft in the middle; sleek rimless open-cutaway dial and sweeping hands on top; plus a plain-English side explainer card with live Power reserve and Balance beat meters.",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: `An automatic mechanical watch stores up to ${M0.fullReserveHours} hours of power across ${M0.maxSpringTurns} coiled spring turns (${M0.hoursPerTurn} hours per turn), winds full in about ${M0.swingsToFull} wrist swings, ticks ${M0.ticksPerSec} times every second, adds +${M0.windGainPerHourWorn} hours of reserve per hour worn, and drains ${M0.drainPerHourStill} hour per hour sitting still.`,
  whatIf: { label: "Daily routine", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-reserve">${M0.dayEndReserveHours} h</b> power reserve</span>
            <span><b id="r-turns">${M0.dayEndTurns} / 7</b> coiled turns</span>
            <span><b id="r-beat">8 / sec</b> balance beat</span>
            <span><b id="r-status">Climbing</b> watch state</span>`,
  readoutNote: "Every reserve level, spring coil count, and beat state is calculated live by the model on this page",
  legend: [
    ["var(--orange)", "Weighted half-moon rotor (swings with your wrist)"],
    ["#c69738", "Mainspring barrel, meshed brass gears, and balance wheel"],
    ["#355b99", "Blued-steel coiled springs and sweeping watch hands"],
    ["#c4284e", "Synthetic ruby bearings and rocking lever stones"],
  ],
  facts: [
    `A full wind stores ${M0.fullReserveHours} hours of power across ${M0.maxSpringTurns} coiled turns (${M0.hoursPerTurn} hours per turn). About ${M0.swingsToFull} rotor swings wind the watch from empty to full.`,
    `Wearing the watch on an active day adds +${M0.windGainPerHourWorn} net hours of reserve per hour worn (capped safely at ${M0.fullReserveHours} hours by a slipping clutch), while sitting still on a nightstand drains ${M0.drainPerHourStill} hour per hour until it rests cleanly at ${M0.zeroHours} hours.`,
    `The oscillating balance wheel and tiny ruby-jeweled rocking lever release ${M0.oneTooth} tooth at a time — ${M0.ticksPerSec} gentle ticks every second (${M0.ticksPerMin} ticks a minute) — giving mechanical watches their smooth sweeping seconds hand.`,
    "Not covered in detail here: temperature-compensated alloy hairsprings and manual crown hand-setting gears.",
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
