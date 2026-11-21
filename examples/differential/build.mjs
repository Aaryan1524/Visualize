#!/usr/bin/env node
// Open Differential: builds the standalone Drawing page (dist/differential.html) and audit report
// (dist/differential.audit.json) on Visualize's shared player and 3D rig.
//
//   node examples/differential/build.mjs [--out <page.html>]

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DIFF, MODELS, VARIANTS } from "./model.mjs";
import { cameraFor, figure } from "./figure.mjs";
import { CLAIMS, COVERAGE, PRED_STEP, STEPS, captions, headings } from "./story.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const { buildSync } = createRequire(new URL("../../package.json", import.meta.url))("esbuild");
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "differential.html");

// ---------------------------------------------------------------- frame and scale
const VBW = 14200, VBH = 6550, FS = 150, LX = 3550, RX = 10550;
const BOX = { x: 3750, y: 500, w: 6600, h: 5200 };
const CLEAR = { x0: LX + 150, y0: 150, x1: RX - 150, y1: VBH - 150 };
const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;
const ratio = (a, b) => `${a}\u00a0:\u00a0${b}`;

// Callouts placed around the figure so leaders stay short, never cross, and clear the heading,
// title block, and #predict/#lab/#practice cards.
const label = (id, text, x, y, to, beats, anchor) => ({ id, text, at: [x, y], to, beats, anchor });
const LABELS = [
  label("pinion", "Drive pinion", 5700, 880, "pinion", [1, 2], "end"),
  label("spider", "Spider gears", 7050, 880, "spider", [1, 3, 4, 5, 6], "middle"),
  label("ring", "Ring gear", 8450, 880, "ring", [1, 2], "start"),
  label("carrier", "Carrier", 4850, 1620, "carrier", [1, 2, 3], "end"),
  label("wheelL", "Left wheel", LX, 3180, "wheelL", [1, 4, 6], "end"),
  label("ice", "Glare ice", LX, 4920, "ice", [6], "end"),
  label("axleL", "Left half-shaft", 5140, 5400, "axleL", [1], "middle"),
  label("sunL", "Left sun gear", 6850, 5350, "sunL", [1, 3, 4, 5], "middle"),
  label("sunR", "Right sun gear", 8250, 5350, "sunR", [1, 3, 4, 5], "middle"),
  label("axleR", "Right half-shaft", 9050, 4250, "axleR", [1], "middle"),
  label("wheelR", "Right wheel", RX, 2080, "wheelR", [1, 4], "start"),
];
const labelSvg = (l) =>
  `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

function skeleton(M) {
  const N = M.N, D = M.D;
  const x0 = 9880, x1 = VBW - 80, y0 = 4950, y1 = VBH - 80;
  let tb = `<g class="tblock" data-camera-avoid=""><path class="tb-frame" d="M${x0},${y0}H${x1}V${y1}H${x0}Z"/><path class="tb-rule" d="M${x0},${y0 + 360}H${x1}M${x0},${y1 - 300}H${x1}"/>`;
  tb += `<text class="tb-title" x="${x0 + 110}" y="${y0 + 240}">OPEN DIFFERENTIAL · ISOMETRIC · ${esc(M.v.label.toUpperCase())}</text><text class="tb-small" x="${x1 - 110}" y="${y0 + 240}" text-anchor="end">m / rpm</text>`;
  const facts = [
    `Final drive ${ratio(D.zRing, D.zPinion)} (${ratio(N.finalDrive.toFixed(2), 1)}) · bevel ${ratio(D.zSun, D.zSpider)} (${ratio(N.sunSpiderRatio.toFixed(1), 1)})`,
    `Track ${D.track.toFixed(1)} m · bend ${N.turnR.toFixed(2)} m · carrier ${Math.round(N.carrierRpm)} rpm`,
    `Rear housing cutaway open toward viewer; gear friction neglected.`,
  ];
  facts.forEach((t, i) => (tb += `<text class="tb-text" x="${x0 + 110}" y="${y0 + 590 + i * 200}">${esc(t)}</text>`));
  tb += `<g id="tbkey" data-x0="${x0 + 110}">`;
  for (const [cls, t] of [["k-orange", "Spider gears"], ["k-brass", "Sun gears"], ["k-blue", "Glare ice"]]) {
    tb += `<g class="tbk"><path class="${cls}" d="M0,${y1 - 140}h240"/><text class="tb-text tb-key" x="0" y="${y1 - 100}">${t}</text></g>`;
  }
  tb += "</g></g>";
  return `<defs id="rigDefs"></defs><g id="scene" data-camera=""></g><g id="labels">${LABELS.map(labelSvg).join("")}</g>${tb}`;
}

function variantData(name) {
  const M = MODELS[name], N = M.N;
  const tracks = VOICE?.variants?.[name] ?? null;
  return {
    name,
    label: VARIANTS[name].label,
    svg: skeleton(M),
    heads: headings(M),
    captions: captions(M),
    voice: tracks,
    explanation: `Each spider gear pivots freely on its cross-pin like a balance bar, forcing left and right wheel torque to stay equal. Because the icy left tire slips at ${Math.round(N.iceCapTorque)} N·m, the dry right wheel is capped at ${Math.round(N.iceCapTorque)} N·m too — delivering only ${Math.round(N.iceTotalTorque)} N·m total while ${Math.round(N.iceTrappedTorque)} N·m of dry grip sits unused.`,
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- the machine (runs in the page)
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz");
  const clamp = (u) => Math.max(0, Math.min(1, u));
  let V = null, model = null, cur = null, F = null, stage = null, defsEl = null, lastAt = null, lastFocus = { focus: null, lit: [] };
  const addDefs = (host, list) => list?.length && host.insertAdjacentHTML("beforeend", list.join(""));

  const OMEGA_C = 0.72; // carrier rad/s in the animation (pinion runs 3.73× faster)

  function stateAt(k, u, t) {
    const m = model;
    const carrierRad = 0.18 + OMEGA_C * t;
    if (k === 0) {
      const st = m.corner;
      return { ...m.anglesAt(carrierRad, st.deltaFrac), st, show: {} };
    }
    if (k === 1 || k === 2 || k === 3) {
      const st = m.straight;
      return { ...m.anglesAt(carrierRad, 0), st, show: {} };
    }
    if (k === 4) {
      const st = m.corner;
      return { ...m.anglesAt(carrierRad, st.deltaFrac), st, show: {} };
    }
    if (k === 5) {
      const st = m.corner;
      return { ...m.anglesAt(carrierRad, st.deltaFrac), st, wheelTorque: st.wheelTorque, show: { forces: true } };
    }
    const st = m.ice;
    return { ...m.anglesAt(carrierRad, st.deltaFrac), st, wheelTorque: st.wheelTorque, show: { ice: true, slip: true } };
  }

  const anim = (k) => (V.voice?.[k] ? Math.max(2.5, 0.85 * V.voice[k].duration) : 0.75 * DATA.plain);
  const POSE = [0.25, 0.2, 0.35, 0.25, 0.4, 0.3, 0.45];
  const at = (k, t, still, SEG) => {
    const tt = still ? POSE[k] * anim(k) : Math.max(0, t - SEG.lead);
    return { ...stateAt(k, clamp(tt / anim(k)), tt), k };
  };
  const stillAt = (k, SEG) => SEG.lead + POSE[k] * anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    F = FIG.figure(model, FIG.cameraFor(model, DATA.box));
    defsEl = $("rigDefs");
    defsEl.replaceChildren();
    $("scene").replaceChildren();
    stage = new FIG.RigStage($("scene"));
    for (const p of F.parts) stage.add(p.id, p.part, p.svg);
  }

  function render(state) {
    cur = state;
    const o = F.pose(state);
    addDefs(defsEl, o.defs);
    stage.apply(o.items);
    lastAt = o.at;
    focusParts();
    const st = state.st ?? model.straight;
    const sp = exactSpeedStrings(st.leftRpm, st.rightRpm, st.carrierRpm);
    $("r-left").textContent = sp.left;
    $("r-right").textContent = sp.right;
    $("r-spider").textContent = st.spiderRpm.toFixed(1);
    $("r-torque").textContent = String(Math.round(st.wheelTorque));
  }

  function focusParts() {
    const { focus, lit } = lastFocus, lab = root.hasAttribute("data-lab");
    stage?.focus((part) => ({
      recede: lit.length ? !lit.includes(part) : !lab && focus ? !focus.includes(part) : false,
      named: lit.includes(part),
    }));
  }
  const focus = (f) => ((lastFocus = f), focusParts());

  function boundsOf(names) {
    const scene = $("scene");
    if (!scene) return null;
    const inv = scene.getCTM().inverse();
    let b = null;
    const add = (x0, y0, x1, y1) =>
      (b = b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
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

  function lab(values) {
    const driveRpm = Number(values.rpm);
    const steer = Number(values.steer);
    const muLeft = Number(values.mu);
    const turnR = turnRadiusFromSteer(steer);
    const st = model.tractionState({ driveRpm, turnR, muLeft });
    const sp = exactSpeedStrings(st.leftRpm, st.rightRpm, st.carrierRpm);
    const verdict = st.slipping
      ? `Left tire slips (μ ${muLeft.toFixed(2)}): both wheels capped at ${Math.round(st.wheelTorque)} N·m, right wheel stalls.`
      : `Clean drive: left ${sp.left} rpm, right ${sp.right} rpm, ${Math.round(st.wheelTorque)} N·m each.`;
    return {
      ok: !st.slipping,
      verdict,
      rows: [
        `Speed sum: ${sp.left} + ${sp.right} = ${sp.sum} rpm (twice carrier ${sp.carrier} rpm).`,
        `Spider gear spin: ${st.spiderRpm.toFixed(1)} rpm on the cross-pin.`,
        `Torque balance: ${Math.round(st.torqueL)} N·m left and ${Math.round(st.torqueR)} N·m right (${Math.round(st.deliveredAxleTorque)} N·m total).`,
      ],
      state: {
        ...model.anglesAt(0.35, st.deltaFrac),
        st,
        wheelTorque: st.wheelTorque,
        show: { ice: muLeft < 0.25, slip: st.slipping, forces: !st.slipping },
        lab: true,
      },
    };
  }

  function question(n, r) {
    const m = model, N = m.N, kind = n % 3;
    if (kind === 0) {
      const delta = [20, 30, 40, 50][Math.floor(r() * 4)];
      const c = Math.round(N.carrierRpm);
      const inner = c - delta, outer = c + delta;
      return {
        q: `The carrier turns at ${c} rpm in a left bend, and the inner left wheel slows to ${inner} rpm. How fast does the outer right wheel turn?`,
        choices: [`${outer} rpm`, `${c} rpm`, `${inner} rpm`],
        explain: `Left and right wheel speeds always sum to twice the carrier speed (${2 * c} rpm): ${2 * c} − ${inner} = ${outer} rpm.`,
      };
    }
    if (kind === 1) {
      return {
        q: `The left wheel sits on glare ice (${Math.round(N.iceCapTorque)} N·m max grip) while the right wheel is on dry asphalt (${Math.round(N.dryCapTorque)} N·m max grip). How much torque reaches the dry right wheel?`,
        choices: [`${Math.round(N.iceCapTorque)} N·m`, `${Math.round(N.wheelTorque)} N·m`, `${Math.round(N.carrierTorque)} N·m`],
        explain: `An open differential's spider gears enforce equal torque on both half-shafts, so the dry wheel is capped at the icy wheel's ${Math.round(N.iceCapTorque)} N·m.`,
      };
    }
    return {
      q: `Driving straight ahead on uniform dry asphalt at ${Math.round(N.carrierRpm)} rpm carrier speed, how fast do the spider gears spin on their cross-pin?`,
      choices: ["0 rpm — they orbit with the carrier without spinning", `${Math.round(N.carrierRpm)} rpm`, `${Math.round(N.iceSpiderRpm)} rpm`],
      explain: `When both sun gears turn at the same speed as the carrier, there is zero relative motion across the spider teeth, so spider spin is 0 rpm.`,
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
    heading: (k) => V.heads[k] ?? null,
    info: () => (cur ? { carrierRad: cur.carrierRad, leftRpm: cur.st?.leftRpm, rightRpm: cur.st?.rightRpm, spiderRpm: cur.st?.spiderRpm, wheelTorque: cur.st?.wheelTorque } : {}),
  };
}

// ---------------------------------------------------------------- bundle & camera validation
const bundle = buildSync({
  entryPoints: [join(HERE, "figure.mjs")],
  bundle: true,
  format: "iife",
  globalName: "FIG",
  write: false,
  minify: true,
  legalComments: "none",
}).outputFiles[0].text;
if (/<\/script/i.test(bundle)) throw new Error("the figure bundle contains </script");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "") + "\nconst MODELS_IN_PAGE = MODELS;\n";
const M0 = MODELS.wide, std = VARIANT_DATA.wide;

// Verify every camera shot / voice link names a real part drawn by figure.mjs
function checkCameraNames() {
  const can = new Set();
  for (const M of Object.values(MODELS)) {
    const F = figure(M, cameraFor(M, BOX), { prefix: "df" });
    for (const p of F.parts) can.add(p.part);
    for (const it of F.pose({ ...M.anglesAt(0.2, 0), show: { forces: true, ice: true } }).items) {
      if (it.part) can.add(it.part);
    }
  }
  const bad = [];
  STEPS.forEach((st, k) => [...(st.shot ?? []), ...(st.around ?? []), ...(st.subject ?? [])].forEach((n) => can.has(n) || bad.push(`step ${k} names "${n}"`)));
  for (const [v, tracks] of Object.entries(VOICE?.variants ?? {})) {
    tracks.forEach((tr, k) => tr.links.forEach((l) => l.ids.forEach((n) => can.has(n) || bad.push(`voice ${v} step ${k} names "${n}"`))));
  }
  if (bad.length) throw new Error(`camera cannot frame: ${bad.join("; ")}`);
}
checkCameraNames();

const DATA = {
  box: BOX,
  plain: 8,
  base: "wide",
  steps: STEPS.map((s, k) => ({ heading: headings(M0)[k], focus: s.focus, ...(s.shot ? { shot: s.shot } : {}) })),
  camera: {
    clear: CLEAR,
    items: {},
    alias: {},
    around: Object.fromEntries(STEPS.flatMap((s, k) => (s.around ? [[k, s.around]] : []))),
    subject: Object.fromEntries(STEPS.flatMap((s, k) => (s.subject ? [[k, s.subject]] : []))),
  },
  alias: { forces: ["forces", "spider", "sunL", "sunR"] },
  predict: {
    step: PRED_STEP,
    question: `Next the left wheel hits glare ice (max ${Math.round(M0.N.iceCapTorque)} N·m of grip) while the right wheel stays on dry asphalt (${Math.round(M0.N.dryCapTorque).toLocaleString("en-US")} N·m). How much torque reaches the dry right wheel?`,
    choices: [
      `${Math.round(M0.N.iceCapTorque)} N·m — capped by the icy wheel`,
      `${Math.round(M0.N.wheelTorque)} N·m — half of the carrier's torque`,
      `${Math.round(M0.N.carrierTorque)} N·m — all of the carrier's torque`,
    ],
    answer: 0,
    explanation: Object.fromEntries(Object.entries(VARIANT_DATA).map(([k, v]) => [k, v.explanation])),
    locked: "Locked in. Press play to put the left wheel on ice.",
  },
  lab: {
    button: "Adjust it",
    title: "Test speed, steering and grip",
    heading: "How do the wheels split speed and torque?",
    intro: "Set driveshaft speed, steering sharpness, and left-tire road grip.",
    inputs: [
      { id: "rpm", label: "Driveshaft", min: 410, max: 1230, step: 41, value: 820, format: "{} rpm" },
      { id: "steer", label: "Steering", min: 0, max: 100, step: 10, value: 50, format: "{}%" },
      { id: "mu", label: "Left grip", min: 0.08, max: 0.85, step: 0.01, value: 0.85, format: "μ {}" },
    ],
  },
  variants: VARIANT_DATA,
};

// ---------------------------------------------------------------- CSS
const CSS = `
${readFileSync(join(ROOT, "src/rig/rig.css"), "utf8")}
#fig{shape-rendering:geometricPrecision;overflow:visible}
path,circle{vector-effect:non-scaling-stroke}
text{font-family:var(--sans);fill:var(--ink)}
.rig-part[data-slip]{--rig-graphite-lit:color-mix(in oklab,var(--t-bad) 35%,#868a91);--rig-graphite-dark:color-mix(in oklab,var(--t-bad) 28%,#1d1f23)}
@media (prefers-color-scheme:dark){.vz:not([data-theme="light"]) .rig-part[data-slip]{--rig-graphite-lit:color-mix(in oklab,var(--t-bad) 35%,#9a9ea5);--rig-graphite-dark:color-mix(in oklab,var(--t-bad) 28%,#232529)}}
.vz[data-theme="dark"] .rig-part[data-slip]{--rig-graphite-lit:color-mix(in oklab,var(--t-bad) 35%,#9a9ea5);--rig-graphite-dark:color-mix(in oklab,var(--t-bad) 28%,#232529)}
.force-halo{fill:none;stroke:var(--stage);stroke-width:9px;stroke-linecap:round}
.force{fill:none;stroke:var(--orange);stroke-width:3.2px;stroke-linecap:round}
.force-head{fill:var(--orange);stroke:var(--stage);stroke-width:1.4px;paint-order:stroke}
.force-text{font-size:${FS * 0.92}px;font-weight:600;fill:var(--orange);paint-order:stroke;stroke:var(--stage);stroke-width:46px;stroke-linejoin:round}
.label text{font-size:${FS}px;font-weight:500;fill:var(--ink);paint-order:stroke;stroke:var(--stage);stroke-width:48px;stroke-linejoin:round}
.leader{fill:none;stroke:var(--ink);stroke-width:.55}
.ldot{fill:var(--ink)}
.vz-step-heading{text-shadow:0 0 6px var(--stage),0 0 12px var(--stage),0 0 18px var(--stage)}
.vz-caption::before{content:"";position:absolute;z-index:-1;inset:-60px -70px -70px -60px;background:radial-gradient(closest-side,var(--stage) 62%,color-mix(in oklab,var(--stage) 0%,transparent))}
.vz[data-practice] #fig .label,.vz[data-lab] #fig .label{visibility:hidden}
.tb-frame{fill:var(--stage);stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.72}px;font-weight:600;letter-spacing:.05em}
.tb-text{font-size:${FS * 0.78}px}
.tb-key{font-size:${FS * 0.74}px}
.tb-small{font-size:${FS * 0.78}px;fill:var(--ink-2)!important}
.k-orange{stroke:var(--orange);stroke-width:2}.k-brass{stroke:#b8861c;stroke-width:2}.k-blue{stroke:var(--blue);stroke-width:2}
`;

// ---------------------------------------------------------------- audit & HTML output
const AUDIT = {
  models: Object.values(MODELS),
  facts: [410, 1230, 41, 100, 10, 50, 0.01, 0],
  allow: [
    { value: 1, why: "the 1 in ratios such as 3.73 : 1 and 1.6 : 1" },
    { value: 2, why: "two wheels, two spider gears, and the factor 2 in ωL + ωR = 2ωc" },
    { value: 90, why: "right-angle bevel mesh" },
  ],
  claims: CLAIMS,
  coverage: COVERAGE,
  reviewFile: join(HERE, "review.json"),
  report: out.replace(/\.html$/, ".audit.json"),
};

const HTML = drawingPage({
  title: "Open Differential",
  about: "One driveshaft turns two wheels at different speeds in a bend while splitting torque equally between them.",
  scene: "open-differential",
  steps: STEPS,
  stageLabel: "Open differential cutaway, drawn in isometric. Left and right arrows step through the explanation; space plays and pauses.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Isometric cutaway drawing of an automotive open differential with its drive pinion, ring gear, carrier, orange spider gears, brass sun gears, half-shafts, and wheels",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: std.captions[0],
  whatIf: { label: "Turn radius", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-left">${Math.round(M0.N.carrierRpm)}</b> rpm left</span>
            <span><b id="r-right">${Math.round(M0.N.carrierRpm)}</b> rpm right</span>
            <span><b id="r-spider">0.0</b> rpm spider</span>
            <span><b id="r-torque">${Math.round(M0.N.wheelTorque)}</b> N·m each</span>`,
  readoutNote: "Readouts are computed live by the model on this page",
  legend: [
    ["var(--orange)", "The part to follow: the spider (planet) gears and their equal-torque push"],
    ["#b8861c", "Brass left and right sun (side) gears splined to the half-shafts"],
    ["var(--blue)", "Glare ice under the left wheel in the traction-limit step"],
  ],
  facts: [
    `Final drive: ${DIFF.zPinion}-tooth drive pinion driving a ${DIFF.zRing}-tooth ring gear (${ratio(M0.N.finalDrive.toFixed(2), 1)} reduction). At ${DIFF.driveRpm} rpm and ${DIFF.driveTorque} N·m in, the carrier turns at ${Math.round(M0.N.carrierRpm)} rpm with ${Math.round(M0.N.carrierTorque)} N·m of torque.`,
    `Bevel core: ${DIFF.zSun}-tooth left and right sun gears meshing two ${DIFF.zSpider}-tooth spider gears (${ratio(M0.N.sunSpiderRatio.toFixed(1), 1)} ratio). In every state — straight, cornering, or wheelspin — wheel speeds obey left + right = twice carrier speed (${Math.round(M0.N.sumRpm)} rpm here).`,
    `Cornering geometry: track width ${DIFF.track.toFixed(1)} m, tire rolling radius ${DIFF.tireR.toFixed(2)} m, normal load ${DIFF.wheelLoad.toLocaleString("en-US")} N per driven wheel. Dry asphalt (μ = ${DIFF.muDry.toFixed(2)}) holds ${Math.round(M0.N.dryCapTorque).toLocaleString("en-US")} N·m per wheel; glare ice (μ = ${DIFF.muIce.toFixed(2)}) holds ${Math.round(M0.N.iceCapTorque)} N·m.`,
    `Not covered here: limited-slip and locking differentials (which add clutches, helical gears, or mechanical dogs to overcome the equal-torque limit) and hypoid pinion offset or gear tooth friction losses (modelled here as frictionless straight bevel gears so the pure kinematic and torque laws stay exact).`,
  ],
  css: CSS,
  modelSrc,
  scripts: bundle,
  machine,
  audit: AUDIT,
  data: DATA,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
