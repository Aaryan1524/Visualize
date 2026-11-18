#!/usr/bin/env node
// Bloom filter: the page. Built the way every Drawing page is (references/figures.md), from the concept
// scaffold (scripts/new-figure.mjs --kind concept): a model, a rig figure of parts drawn once and moved,
// a camera shot per step, a recorded narration, the audit's claims and topics, a lab and Now you try.
//
//   node examples/bloom/build.mjs [--out <page.html>]     then: node scripts/check-drawing.mjs dist/bloom.html

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, MODELS, VARIANTS } from "./model.mjs";
import { STEPS, PRED_STEP, headings, captions, prediction, CLAIMS, COVERAGE } from "./story.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const { buildSync } = createRequire(new URL("../../package.json", import.meta.url))("esbuild");
const HERE = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(HERE, "..", "..", "dist", "bloom.html");

// The drawing's units: about 10 to a screen pixel at 1440 x 900. The figure fills BOX, between the two
// columns of callouts (LX, RX), clear of the heading on the left and the cards on the right.
const VBW = 14200, VBH = 6550, FS = 150, LX = 3000, RX = 10560;
// the board fills the clear area on the overview steps (step 0, and a step with no shot), as the
// derailleur's figure does; it stays inside it, so a wide subject can still be framed (the camera never
// zooms out past the whole figure). The callouts' column (LX) sits further left than a machine's.
const BOX = { x: 3300, y: 350, w: 7000, h: 4200 };
// The clear area stops above the cards that open at the stage's lower right (the prediction, the
// concept): a framed word, its working and its bits never sit under them, at 1280 x 800 either.
const CLEAR = { x0: LX + 150, y0: 150, x1: RX - 150, y1: 4650 };
const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

// Callouts, on the concept step only (the overview); later steps are framed close and name their bits
// in the heading. Text in the columns, a leader drawn live to the part's anchor (figure.mjs `at`).
const label = (id, text, x, y, to, beats, anchor) => ({ id, text, at: [x, y], to, beats, anchor });
const LABELS = [
  label("rail", "Bit array", LX, 1900, "rail", [0], "end"),
  label("index", "Bit index", LX, 4300, "index", [0], "end"),
];
const labelSvg = (l) => `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;
const skeleton = () => `<defs id="rigDefs"></defs><g id="scene" data-camera=""></g><g id="labels">${LABELS.map(labelSvg).join("")}</g>`;

function variantData(name) {
  const M = MODELS[name];
  return { name, label: VARIANTS[name].label, svg: skeleton(), heads: headings(M), captions: captions(M), voice: VOICE?.variants?.[name] ?? null };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- the machine hooks (run in the page)
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz");
  const clamp = (u) => Math.max(0, Math.min(1, u));
  let V = null, model = null, cur = null, F = null, stage = null, lastAt = null, lastFocus = { focus: null, lit: [] }, storyK = 0;

  // The filter t seconds into step k (u: 0..1 through the step's motion): the word's hash arrows land
  // one by one, and on an add or a delete each bit changes as its arrow reaches it.
  function stateAt(k, u) {
    if (k === 0) return { bits: Array(model.m).fill(0), word: null, picked: [], shown: [], changed: [], checked: [], members: 0 };
    const st = model.steps[k - 1], e = st.event, n = e.working.length;
    const landed = Math.min(n, Math.floor(clamp(u / 0.75) * n + 1e-9) + (u >= 0.75 ? 0 : 0));
    const shown = e.working.slice(0, Math.max(u > 0.02 ? 1 : 0, landed));
    const reached = new Set(e.working.slice(0, landed).map((w) => w.bit));
    const bits = st.prev.bits.map((b, i) => (reached.has(i) && e.type !== "ask" ? st.state.bits[i] : b));
    const changed = e.type === "add" ? e.newly.filter((b) => reached.has(b)) : e.type === "clear" ? e.cleared.filter((b) => reached.has(b)) : [];
    const checked = e.type === "clear" ? [] : [...reached].filter((b) => !changed.includes(b));
    return { bits, word: e.word, picked: e.picked, shown, working: e.working, changed, checked, members: (landed >= n ? st.state : st.prev).members.length };
  }
  const anim = (k) => (V.voice?.[k] ? Math.max(2, 0.8 * V.voice[k].duration) : 0.75 * DATA.plain);
  const at = (k, t, still, SEG) => {
    const tt = still ? anim(k) : Math.max(0, t - SEG.lead);
    return { ...stateAt(k, clamp(tt / anim(k))), k };
  };
  const stillAt = (k, SEG) => SEG.lead + anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    F = FIG.figure(model, FIG.cameraFor(model, DATA.box));
    $("scene").replaceChildren();
    stage = new FIG.RigStage($("scene"));
    for (const p of F.parts) stage.add(p.id, p.part, p.svg);
  }
  function render(state) {
    cur = state;
    if (!state.lab && !state.practice && state.k !== undefined) storyK = state.k;
    const o = F.pose(state);
    stage.apply(o.items);
    lastAt = o.at;
    focusParts();
    const on = state.bits.reduce((a, b) => a + b, 0);
    $("r-set").textContent = String(on);
    $("r-words").textContent = String(state.members ?? 0);
    // this run's chance (the bits these words happened to set) beside the expected rate for this many
    // hash functions (averaged over every way the words could land): What if compares the second
    $("r-fp").textContent = (100 * fpFromFill(on / model.m, model.k)).toFixed(1) + "%";
    $("r-exp").textContent = (100 * fpRateTrue(model.m, model.k, state.members ?? 0)).toFixed(1) + "%";
  }
  // "hashed" lights the bits this word's hashes pick, whichever they are this step; the card lights its
  // arrows with it (they are framed apart, so the card's bounds stay the card and its working). Whatever
  // else is lit, the current operation lights its word and every bit it touches: check-drawing then holds
  // each of them fully in frame and clear of the cards.
  const expand = (names) => names.flatMap((n) => (n === "hashed" ? (cur?.picked ?? []).map((b) => `bit${b}`) : [n]));
  function focusParts() {
    const op = cur?.word && !cur.practice ? ["card", "hashed"] : [];
    const { focus } = lastFocus, lit = [...new Set(expand([...lastFocus.lit, ...op]).flatMap((n) => (n === "card" ? ["card", "arrows"] : [n])))], lab = root.hasAttribute("data-lab");
    stage?.focus((part) => ({ recede: lit.length ? !lit.includes(part) : !lab && focus ? !focus.includes(part) : false, named: lit.includes(part) }));
  }
  const focus = (f) => ((lastFocus = f), focusParts());

  // What the camera can frame: a part (data-part), or "hashed", the bits the word's hashes pick.
  function boundsOf(names) {
    const scene = $("scene");
    if (!scene) return null;
    const inv = scene.getCTM().inverse();
    let b = null;
    const add = (x0, y0, x1, y1) => (b = b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
    for (const n of expand(names)) {
      for (const el of scene.querySelectorAll(`[data-part="${n}"]`)) {
        if (el.style.display === "none") continue;
        const r = el.getBBox();
        if (!r.width && !r.height) continue;
        const m = inv.multiply(el.getCTM());
        const pts = [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
        add(Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1])));
      }
    }
    return b;
  }

  // The lab: the reader's own word, asked of the filter the step on screen shows (its tab stays lit),
  // and said so in the first row.
  const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  function lab(values) {
    const m = model, k = storyK, st = k ? m.steps[k - 1].state : { bits: Array(m.m).fill(0), members: [] };
    const done = m.ops.slice(0, k), added = done.filter((o) => o.op === "add").map((o) => o.word), deleted = done.filter((o) => o.op === "clear").map((o) => o.word);
    const on = st.bits.reduce((a, b) => a + b, 0);
    const which = !added.length ? `The empty filter of step ${k}` : `The filter of step ${k}, after adding ${list(added)}${deleted.length ? ` and deleting ${list(deleted)}` : ""}`;
    const head = `${which}: ${on} of ${m.m} bits set.`;
    const word = String(values.word ?? "").trim().toLowerCase().slice(0, 16);
    const base = { bits: st.bits, word: null, picked: [], shown: [], changed: [], checked: [], members: st.members.length, lab: true };
    if (!word) return { ok: true, verdict: "Type a word to ask the filter about it.", rows: [head], state: base };
    const w = workingFor(st.bits, m.k, word), picked = [...new Set(w.map((x) => x.bit))].sort((a, b) => a - b);
    const zero = w.find((x) => x.was === 0), member = st.members.includes(word), gone = deleted.includes(word);
    const verdict = zero
      ? member ? `Definitely not, yet ${word} was added: a false negative, because a delete cleared bit ${zero.bit}, which it shared.` : gone ? `Definitely not: bit ${zero.bit} is 0, and ${word} was deleted.` : `Definitely not: bit ${zero.bit} is 0, so ${word} was never added.`
      : member ? `Maybe in the set, and rightly: ${word} was added.` : gone ? `Maybe in the set, though ${word} was deleted: other words still set its bits.` : `Maybe in the set, but ${word} was never added: a false positive.`;
    return {
      ok: true, verdict,
      rows: [head, ...w.map((x) => `h${x.fn}(${word}) = ${x.hash.toLocaleString("en-US")}; ${x.hash.toLocaleString("en-US")} mod ${m.m} = ${x.bit}; bit ${x.bit} is ${x.was}.`)],
      state: { ...base, word, picked, shown: w, checked: picked },
    };
  }
  // While the lab or Now you try is open, the camera frames the whole filter and the word right of the
  // card they open in, so no bit the word touches sits under it.
  const cardShot = () => ["card", ...Array.from({ length: model.m }, (_, i) => `bit${i}`)];
  const cardClear = () => DATA.cardClear;

  // Now you try: a fresh filter of three words and one to ask about; the model decides the answer, and
  // the stage draws that filter and that word, so the picture is the question's.
  function question(n, r) {
    // the third choice is the answer a Bloom filter can never give: a yes it is sure of
    const p = FIG.practice(n, r, model.k), wrong = p.answer === "Definitely not" ? "Maybe in the set" : "Definitely not";
    const state = { bits: p.bits, word: p.ask, picked: p.its, shown: p.working, changed: [], checked: [], members: 3, practice: true };
    return { q: p.q, choices: [p.answer, wrong, "Definitely in the set"], explain: `${p.explain} A Bloom filter never answers definitely in the set: other words may have set every bit.`, state };
  }

  return {
    model: (v) => MODELS_IN_PAGE[v.name],
    mount, at, stillAt, render, focus, anchors: () => lastAt, lab, question, boundsOf, clearArea: () => DATA.camera.clear, cardShot, cardClear,
    heading: (k) => V.heads[k] ?? null,
    info: () => (cur ? { word: cur.word, bits: cur.bits.join("") } : {}),
  };
}

// ---------------------------------------------------------------- page
const bundle = buildSync({ entryPoints: [join(HERE, "figure.mjs")], bundle: true, format: "iife", globalName: "FIG", write: false, minify: true, legalComments: "none", define: { "process.env.VIZ_PLANT": JSON.stringify(process.env.VIZ_PLANT ?? "") } }).outputFiles[0].text;
if (/<\/script/i.test(bundle)) throw new Error("the figure bundle contains </script");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "") + "\nconst MODELS_IN_PAGE = MODELS;\n";
const M0 = MODELS[BASE], std = VARIANT_DATA[BASE];
// The prediction, built for each variant from its own model (story.mjs `prediction`).
const PREDICTIONS = Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, prediction(m)]));
// VIZ_PLANT=card-only-shot frames only the word card on every step: the bits the operation lights leave
// the frame, which check-drawing must fail
const PLANT_CARD_ONLY = process.env.VIZ_PLANT === "card-only-shot";

const DATA = {
  box: BOX, plain: 8,
  base: BASE,
  steps: STEPS.map((s, k) => ({ heading: headings(M0)[k], focus: s.focus, ...(s.shot ? { shot: PLANT_CARD_ONLY ? ["card"] : s.shot } : {}) })),
  camera: { clear: CLEAR, items: {}, alias: {}, around: {}, subject: Object.fromEntries(STEPS.flatMap((s, k) => (s.subject ? [[k, PLANT_CARD_ONLY ? ["card"] : s.subject]] : []))) },
  // right of the lab and Now you try cards, which open at the stage's top left
  cardClear: { x0: 4900, y0: 150, x1: RX - 150, y1: VBH - 150 },
  alias: {},
  predict: {
    step: PRED_STEP,
    question: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.question])),
    choices: ["Definitely not", "Maybe in the set"],
    answer: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.answer])),
    explanation: Object.fromEntries(Object.entries(PREDICTIONS).map(([k, p]) => [k, p.explanation])),
    locked: "Locked in. Press play to ask the filter.",
  },
  lab: {
    button: "Try a word",
    title: "Ask about your own word",
    heading: "Is your word in the set?",
    intro: "Type any word to ask the filter on the stage, as the step you were on left it.",
    inputs: [{ id: "word", label: "Word", type: "text", value: "emu", maxlength: 16, samples: ["emu", "cat", "a", "hippopotamuses"] }],
  },
  variants: VARIANT_DATA,
};

const CSS = `
${readFileSync(new URL("../../src/rig/rig.css", import.meta.url), "utf8")}
.label text{font-size:${FS}px;font-weight:500;fill:var(--ink);paint-order:stroke;stroke:var(--stage);stroke-width:48px;stroke-linejoin:round}
.leader{fill:none;stroke:var(--ink);stroke-width:.5}
.ldot{fill:var(--ink)}
.vz-step-heading{text-shadow:0 0 6px var(--stage),0 0 12px var(--stage),0 0 18px var(--stage)}
#fig{overflow:visible}
.vz[data-practice] #fig .label{visibility:hidden}
.rig-arrow{--rig-arrow:var(--orange)}
`;

const HTML = drawingPage({
  title: "Bloom Filter",
  about: "Answers “maybe” or “definitely not” from a row of bits.",
  scene: "bloom",
  steps: STEPS,
  stageLabel: "A Bloom filter's sixteen bits, drawn as solid cells. Left and right arrows step through the explanation; space plays and pauses.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Two rows of eight bit cells on a board, a word card in front of them, and one arrow for each hash function to the bit it picks, with each function's working (hash, mod 16, bit) beside the card",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: `A Bloom filter keeps ${M0.m} bits and ${M0.k} hash functions. It adds three words, answers four questions and attempts one delete.`,
  whatIf: { label: "Hash functions", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-set">0</b> bits set</span>
            <span><b id="r-words">0</b> words added</span>
            <span><b id="r-fp">0.0%</b> this run's chance of a false positive</span>
            <span><b id="r-exp">0.0%</b> expected with this many hash functions</span>`,
  readoutNote: "Readouts are computed by the model on this page",
  legend: [
    ["var(--orange)", "Changed by this word"],
    ["var(--t-good)", "A bit this word checks, found 1"],
    ["var(--t-bad)", "A bit this word checks, found 0"],
  ],
  facts: [
    `The filter has m = ${M0.m} bits, so small that every bit can be drawn; real filters have thousands to billions of bits.`,
    "Each hash function is 32-bit FNV-1a applied to the word with its own prefix (\"1:cat\", \"2:cat\"…), then reduced mod m. Real filters often use MurmurHash, or derive all k positions from two hashes (double hashing): how the hash functions are built (double hashing) is not covered here.",
    "Only the bits are stored. The list of added words appears here only so the page can tell a right answer from a false positive.",
    "Every rate here assumes independent, uniform hash functions. The expected rate is the average of (X/m)^k over X, the number of bits the words set, computed exactly by counting; Bloom's classic estimate, (1 − (1 − 1/m)^(kn))^k, treats the k bits as independent and is a little low for two or more hash functions, and (1 − e^(−kn/m))^k approximates it for large m. The bits one run actually sets can differ from the average either way, so this run's chance and the expected rate are shown side by side.",
    "Delete is shown only as the naive attempt (clearing bits) that a plain Bloom filter does not allow. A counting Bloom filter, which supports deletion, is described in words, not drawn.",
  ],
  css: CSS,
  modelSrc,
  scripts: bundle,
  machine,
  audit: {
    models: Object.values(MODELS),
    allow: [
      { value: 32, why: "the hash width in bits (32-bit FNV-1a), a property of the hash function, not of the run" },
      { value: 4, why: "a counting Bloom filter's usual counter width in bits and its space cost over plain bits (Fan et al. 2000), not quantities of this run" },
    ],
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
