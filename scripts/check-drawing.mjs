#!/usr/bin/env node
// Check a built Drawing page (a technical cutaway, see references/drawing.md) in headless Chrome.
//
//   node scripts/check-drawing.mjs dist/escalator.html
//
// The page contract: window.__viz with steps, predictStep, variants, seekStep(k), seek(ms), state(),
// variant(name), answer(i), practice(n), question(n), lab(values), labInputs() and closeLab();
// #scrub (the story timeline), #play, #voice, #try, #labBtn, #lab and #predict; every callout is a
// <g class="label"> holding a <text>. Prints `drawing: passed` or each failure, one per line.
//
// What it does, at 1440×900 and 1280×800:
// - every step of every What if variant: no scroll, the step lands, the timeline runs forward,
//   callouts are readable, inside the stage, apart from each other and clear of any open card;
// - the prediction: asked on its step, answered on the next, with the callouts clear of the card;
// - Now you try: eight questions, each with distinct choices and a worked explanation;
// - the lab: every input at its minimum and its maximum, with a verdict and no callout under it;
// - the arrow key on a fresh page, before anything has focus;
// - play: the narrated tour (with a stand-in for audio) stops at the prediction, and play near
//   the end stops at the end;
// - no text anywhere reads NaN, undefined or Infinity, and nothing logs a console error;
// - the camera, on a page whose steps name a `shot` (src/drawing/camera.mjs): at each step's still
//   frame and as each spoken [phrase|part] begins, every named part has bounds (a name the figure
//   cannot frame fails), sits in the clear area, off the cards, the heading and anything marked
//   [data-camera-avoid], and is at least 6% of the stage's shorter side, and its callout points at it
//   on the stage and off the cards; a shot's subject is centred (the middle half of the clear area),
//   spans 15% of it and outweighs the other parts in focus; nothing clips the figure but the stage;
//   every name's bounds are smaller than the figure and hold its anchor; a step's camera is the same by seekStep and by its tab, and a
//   time's the same by seek and by playing up to it; through the whole story, frame by frame, the
//   picture never moves faster than 2 clear-area short sides a second and every shot it stops on is
//   held at least 0.8 s, and the eased move a tab click makes keeps to the same speed;
// - playback: every frame of the whole story, at 60 fps, for every What if variant, is timed from
//   the frame's start to its layout being done. The 95th percentile must stay under 8 ms (half a
//   frame, leaving the rest for paint), and no frame outside a step change may take a whole frame
//   (16.7 ms). A slow frame is timed again, and its best time counts, so a stray pause of the
//   machine running the check does not fail a page. Both limits scale with the machine: first a
//   fixed reference workload (a few hundred transformed <g>/<use> parts and a layout read a frame,
//   the work the rig does) is timed in the same browser, and the limits are multiplied by
//   max(1, measured / reference), capped at 3. Set VIZ_CPU_THROTTLE=2.5 to run the check as if on
//   a machine 2.5 times slower (Chrome's CPU throttling applies to the reference and the page alike).
//   A page that is clearly over its limit stops being timed once 800 frames of a variant have been,
//   so a failing page fails in seconds. VIZ_ONLY_PLAYBACK=1 skips every other check, to time a page alone;
//   VIZ_ONLY_CAMERA=1 runs only the camera's checks.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";

const page = process.argv[2];
if (!page) {
  console.error("usage: node scripts/check-drawing.mjs <built page>");
  process.exit(2);
}
const url = pathToFileURL(resolve(page)).href;
const fails = [];
const fail = (msg) => fails.push(msg);
const MIN_TEXT = 11; // px, rendered, at 1280×800 and above
// Playback: the median frame of the reference workload (below) on the machine the budgets were set on:
// a MacBook (Apple silicon) running Chrome 1440 x 900, no CPU throttling, measured as the median of the
// calibration's own median over 20 runs (0.27 to 0.29 ms; the same workload runs at 0.71 ms under 2.5x CPU throttling). The check multiplies its limits by max(1, measured / REFERENCE_MS).
const REFERENCE_MS = 0.28;
const MAX_SCALE = 3;
const THROTTLE = Number(process.env.VIZ_CPU_THROTTLE || 1);
const ONLY_PLAYBACK = !!process.env.VIZ_ONLY_PLAYBACK;
const ONLY_CAMERA = !!process.env.VIZ_ONLY_CAMERA;
const throttle = async (page) => THROTTLE > 1 && (await (await page.createCDPSession()).send("Emulation.setCPUThrottlingRate", { rate: THROTTLE }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Measure what a reader sees right now: scroll, callouts, open cards, and any broken number.
const measure = () => {
  const doc = document.documentElement;
  const box = (e) => {
    const b = e.getBoundingClientRect();
    return { x: b.left, y: b.top, r: b.right, b: b.bottom };
  };
  const shown = (e) => e && !e.hidden && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0;
  const stage = document.querySelector(".vz-stage");
  const labels = [...document.querySelectorAll("g.label")]
    .filter((g) => shown(g) && shown(g.querySelector("text")))
    .map((g) => {
      const t = g.querySelector("text");
      return { text: t.textContent, ...box(t), px: parseFloat(getComputedStyle(t).fontSize) * (t.getScreenCTM()?.a ?? 1) };
    });
  const cards = ["concept", "predict", "practice", "lab"].map((id) => document.getElementById(id)).filter(shown).map((e) => ({ id: e.id, ...box(e) }));
  const text = document.querySelector(".vz").innerText;
  return {
    scroll: doc.scrollHeight > innerHeight + 1 || doc.scrollWidth > innerWidth + 1,
    stage: stage && box(stage),
    labels,
    cards,
    broken: (text.match(/\b(NaN|undefined|Infinity)\b/g) || []).length,
    T: Number(document.getElementById("scrub").value),
    step: window.__viz.state().step,
  };
};
const hit = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
function judge(at, r) {
  if (r.scroll) fail(`${at}: the page scrolls; one desktop viewport must hold it`);
  if (r.broken) fail(`${at}: text on the page reads NaN, undefined or Infinity`);
  for (const [i, a] of r.labels.entries()) {
    if (a.px < MIN_TEXT - 0.25) fail(`${at}: "${a.text}" renders at ${a.px.toFixed(1)} px, under ${MIN_TEXT}`);
    if (r.stage && (a.x < r.stage.x - 1 || a.r > r.stage.r + 1 || a.y < r.stage.y - 1 || a.b > r.stage.b + 1)) fail(`${at}: "${a.text}" leaves the stage`);
    for (const b of r.labels.slice(i + 1)) if (hit(a, b)) fail(`${at}: "${a.text}" overlaps "${b.text}"`);
    for (const c of r.cards) if (hit(a, c)) fail(`${at}: "${a.text}" is under the #${c.id} card`);
  }
}

// Narration without sound: a stand-in Audio that "plays" each clip in 40 ms.
const fakeAudio = () => {
  window.Audio = class {
    constructor() {
      this.currentTime = 0;
      this.volume = 1;
      this.paused = true;
      this.ended = false;
    }
    play() {
      this.paused = false;
      this._t = setTimeout(() => {
        this.ended = true;
        this.paused = true;
        this.onended?.();
      }, 40);
      return Promise.resolve();
    }
    pause() {
      clearTimeout(this._t);
      this.paused = true;
    }
  };
};

const browser = await launch();
try {
  for (const [w, h] of ONLY_PLAYBACK || ONLY_CAMERA ? [] : [[1440, 900], [1280, 800]]) {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h });
    await p.evaluateOnNewDocument(fakeAudio);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    await wait(300);
    const at = `${w}×${h}`;

    const contract = await p.evaluate(() => {
      const v = window.__viz;
      const fns = ["seekStep", "seek", "state", "variant", "answer", "practice", "question", "lab", "labInputs", "closeLab"];
      return {
        missingFns: v ? fns.filter((f) => typeof v[f] !== "function") : fns,
        steps: v?.steps, pred: v?.predictStep, variants: v?.variants,
        ids: ["scrub", "play", "voice", "try", "labBtn", "lab", "predict"].filter((id) => !document.getElementById(id)),
        voice: document.documentElement.innerHTML.includes("audio/"),
      };
    });
    if (contract.missingFns.length) fail(`${at}: window.__viz is missing ${contract.missingFns.join(", ")}`);
    // The correctness audit ran at build time (src/claims/audit.mjs); the page carries its result.
    const au = await p.evaluate(() => window.__viz?.audit ?? null);
    if (!au) fail(`${at}: the page carries no correctness audit; build it with drawingPage({ audit })`);
    else if (!au.ok) for (const q of au.problems) fail(`audit: ${q}`);
    if (contract.ids.length) fail(`${at}: missing #${contract.ids.join(", #")}`);
    if (!contract.voice) fail(`${at}: no recorded voice is embedded (run the example's voice script)`);
    // A rig figure without the rig's look draws every solid black, and every other check still passes
    // (the scaffold's first build did): its material tokens must resolve.
    const look = await p.evaluate(() => {
      const solid = document.querySelector("#fig .rig-solid");
      return solid ? getComputedStyle(solid).getPropertyValue("--rig-lit").trim() : null;
    });
    if (look === "") fail(`${at}: the figure's solids have no material colours; put src/rig/rig.css in the page's CSS`);
    if (contract.missingFns.includes("seekStep") || contract.missingFns.includes("state")) continue;
    const has = (f) => !contract.missingFns.includes(f);

    // A fresh page: the right arrow moves the story before anything has been clicked.
    await p.keyboard.press("ArrowRight");
    await wait(150);
    const afterKey = await p.evaluate(() => window.__viz.state().step);
    if (afterKey !== 1) fail(`${at}: on a fresh page the right arrow did not reach step 1 (it is on ${afterKey})`);

    const { steps, pred } = contract;
    const variants = contract.variants ?? (await p.evaluate(() => [...document.querySelectorAll(".vz-whatif button")].map((b) => b.dataset.variant)));
    if (!(pred >= 1 && pred < steps - 1)) fail(`${at}: the prediction step (${pred}) must sit before the step that answers it`);
    if (variants.length < 2) fail(`${at}: What if needs at least two real variants, found ${variants.length}`);

    // Every step of every variant.
    for (const v of variants.length ? variants : [null]) {
      if (v && has("variant")) await p.evaluate((v) => window.__viz.variant(v), v);
      let lastT = -1;
      for (let k = 0; k < steps; k++) {
        await p.evaluate((k) => window.__viz.seekStep(k), k);
        await wait(120);
        const r = await p.evaluate(measure);
        const s = `${at} ${v} step ${k}`;
        if (r.step !== k) fail(`${s}: seekStep(${k}) landed on step ${r.step}`);
        if (r.T <= lastT) fail(`${s}: the timeline goes backwards (${r.T} after ${lastT}); it must run once, start to end`);
        lastT = r.T;
        judge(s, r);
      }
      if (!has("answer") || !has("labInputs") || !has("lab")) continue;
      // The prediction, answered, on the step that reveals it.
      await p.evaluate((pred) => {
        window.__viz.seekStep(pred);
        window.__viz.answer(0);
        window.__viz.seekStep(pred + 1);
      }, pred);
      await wait(120);
      const r = await p.evaluate(measure);
      const reveal = await p.evaluate(() => {
        const c = document.getElementById("predict");
        return !c.hidden && /^(Right|Not quite)\./.test(c.querySelector(".vz-predict-feedback")?.textContent ?? "");
      });
      if (!reveal) fail(`${at} ${v}: the answered prediction is not revealed with its explanation on step ${pred + 1}`);
      judge(`${at} ${v} answered prediction`, r);
      await p.evaluate(() => window.__viz.answer(null));

      // The lab, every input at its minimum and at its maximum.
      const inputs = await p.evaluate(() => window.__viz.labInputs());
      if (!inputs.length) fail(`${at}: the page has no lab (DATA.lab), so the reader cannot try values of their own`);
      for (const inp of inputs) {
        for (const end of ["min", "max"]) {
          const out = await p.evaluate((id, val) => window.__viz.lab({ [id]: val }), inp.id, inp[end]);
          await wait(80);
          const r = await p.evaluate(measure);
          const s = `${at} ${v} lab ${inp.id}=${inp[end]}`;
          if (!out || !out.verdict || !Array.isArray(out.rows)) fail(`${s}: the lab gave no verdict`);
          judge(s, r);
          await p.evaluate((id, val) => window.__viz.lab({ [id]: val }), inp.id, inp.value);
        }
      }
      if (inputs.length) await p.evaluate(() => window.__viz.closeLab());
    }
    if (variants.length && has("variant")) await p.evaluate((v) => window.__viz.variant(v), variants[0]);
    if (contract.missingFns.length) {
      if (errors.length) fail(`${at}: console errors: ${[...new Set(errors)].join(" | ")}`);
      await p.close();
      continue;
    }

    // The lab survives a What if switch (its heading and panel stay) and closes when the reader
    // drags the timeline, so the story frame is never drawn under a stale lab.
    if (variants.length > 1) {
      const labHead = await p.evaluate(() => (window.__viz.lab({}), document.getElementById("heading").textContent));
      await p.evaluate((v) => window.__viz.variant(v), variants[1]);
      const kept = await p.evaluate(() => ({ open: !document.getElementById("lab").hidden && !!window.__viz.state().lab, head: document.getElementById("heading").textContent }));
      if (!kept.open || kept.head !== labHead) fail(`${at}: switching What if with the lab open lost the lab (open: ${kept.open}, heading "${kept.head}")`);
      await p.evaluate(() => {
        const s = document.getElementById("scrub");
        s.value = String(Number(s.max) / 2);
        s.dispatchEvent(new Event("input"));
      });
      const closed = await p.evaluate(() => document.getElementById("lab").hidden && !window.__viz.state().lab);
      if (!closed) fail(`${at}: dragging the timeline left the lab open over the story`);
      await p.evaluate((v) => window.__viz.variant(v), variants[0]);
    }

    // Now you try: eight questions from the model.
    for (let n = 0; n < 8; n++) {
      const q = await p.evaluate((n) => window.__viz.question(n), n);
      const s = `${at} question ${n}`;
      if (!q || !q.q || !q.explain) fail(`${s}: no question or no worked explanation`);
      else if (q.choices.length < 3 || new Set(q.choices).size !== q.choices.length) fail(`${s}: needs three or more distinct choices, got ${JSON.stringify(q.choices)}`);
      else if (/\b(NaN|undefined|Infinity)\b/.test(q.q + q.explain + q.choices.join(" "))) fail(`${s}: reads NaN, undefined or Infinity`);
    }
    await p.evaluate(() => window.__viz.practice(3));
    await wait(120);
    judge(`${at} Now you try`, await p.evaluate(measure));
    await p.evaluate(() => document.getElementById("try").click());

    // The narrated tour (stand-in audio) runs step to step and stops at the prediction.
    await p.evaluate(() => {
      window.__viz.answer(null);
      window.__viz.seekStep(0);
      if (document.getElementById("voice").getAttribute("aria-pressed") === "false") document.getElementById("voice").click();
      document.getElementById("play").click();
    });
    const tourEnd = Date.now() + 15000;
    let st = null;
    while (Date.now() < tourEnd) {
      await wait(200);
      st = await p.evaluate(() => window.__viz.state());
      if (!st.touring) break;
    }
    if (st.touring || st.step !== pred) fail(`${at}: the narrated tour did not stop at the prediction (step ${st.step} of ${steps - 1}, ${st.touring ? "still touring" : "stopped"})`);

    // Play near the end, voice off, stops at the end instead of looping.
    const max = await p.evaluate(() => Number(document.getElementById("scrub").max));
    await p.evaluate(() => document.getElementById("voice").getAttribute("aria-pressed") !== "false" && document.getElementById("voice").click());
    await p.evaluate(() => window.__viz.answer(0));
    await p.evaluate((ms) => window.__viz.seek(ms), (max - 1) * 1000);
    await p.evaluate(() => document.getElementById("play").click());
    await wait(1800);
    const end = await p.evaluate(() => ({ T: Number(document.getElementById("scrub").value), running: window.__viz.state().running }));
    if (end.running || end.T < max - 0.1) fail(`${at}: play near the end did not stop at the end (at ${end.T.toFixed(2)} of ${max.toFixed(2)})`);

    if (errors.length) fail(`${at}: console errors: ${[...new Set(errors)].join(" | ")}`);
    await p.close();
  }

  // The camera (a page whose steps name shots, src/drawing/camera.mjs): framing, voice sync,
  // determinism and calm. Pages without one are not touched.
  if (!ONLY_PLAYBACK) {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.evaluateOnNewDocument(fakeAudio);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    await wait(300);
    const cam0 = await p.evaluate(() => window.__viz.camera?.() ?? null);
    if (cam0?.active) {
      const variants = await p.evaluate(() => window.__viz.variants ?? []);
      const near = (a, b) => Math.abs(a.s - b.s) < 1e-6 && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
      const show = (m) => `s ${m.s.toFixed(4)} x ${m.x.toFixed(1)} y ${m.y.toFixed(1)}`;
      // how far the picture moves from camera a to camera b: the largest move of the figure points
      // under the clear area's corners, in the clear area's shorter side (as the camera reckons speed)
      const moved = (a, b, c) => {
        let d = 0;
        for (const m of [a, b])
          for (const [sx, sy] of [[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1]]) {
            const q = [(sx - m.x) / m.s, (sy - m.y) / m.s];
            d = Math.max(d, Math.hypot((a.s - b.s) * q[0] + a.x - b.x, (a.s - b.s) * q[1] + a.y - b.y));
          }
        return d / Math.min(c.x1 - c.x0, c.y1 - c.y0);
      };

      // Framing: where a step's shot or a spoken link names parts, each named part is inside the clear
      // area, clear of the cards, the heading and whatever the figure marks [data-camera-avoid], and at
      // least 6% of the stage's shorter side. Its callout, if it has one, points at it on the stage and
      // off the cards; a shot's callouts are all shown (a spoken name's callout may hide, when the point
      // it marks is out of the picture while the part itself is framed).
      const framing = (names, k, shot) => {
        const v = window.__viz, fig = document.getElementById("fig");
        const box = (b) => ({ x: b.left, y: b.top, r: b.right, b: b.bottom });
        const shown = (e) => e && !e.hidden && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" && e.getBoundingClientRect().width > 0;
        const stage = box(document.querySelector(".vz-stage").getBoundingClientRect());
        const ctm = fig.getScreenCTM(), c = v.camera().clear;
        const c0 = new DOMPoint(c.x0, c.y0).matrixTransform(ctm), c1 = new DOMPoint(c.x1, c.y1).matrixTransform(ctm);
        const clear = { x: c0.x, y: c0.y, r: c1.x, b: c1.y };
        const head = document.getElementById("heading"), range = document.createRange();
        range.selectNodeContents(head);
        const covers = [
          ...["concept", "predict", "practice", "lab"].map((id) => document.getElementById(id)).filter(shown).map((e) => ({ what: `the #${e.id} card`, ...box(e.getBoundingClientRect()) })),
          ...(shown(head) && head.textContent.trim() ? [{ what: "the step heading", ...box(range.getBoundingClientRect()) }] : []),
          ...[...document.querySelectorAll("[data-camera-avoid]")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ what: `#${e.id || e.getAttribute("class")}`, ...box(e.getBoundingClientRect()) })),
        ];
        const hit = (a, b) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
        const short = Math.min(stage.r - stage.x, stage.b - stage.y);
        const out = [];
        for (const n of names) {
          const r = v.partsOnScreen([n]);
          if (!r) {
            out.push(`"${n}" is not in the figure (it has no bounds)`);
            continue;
          }
          if (r.x < clear.x - 1 || r.r > clear.r + 1 || r.y < clear.y - 1 || r.b > clear.b + 1) out.push(`"${n}" (${r.x.toFixed(0)},${r.y.toFixed(0)}..${r.r.toFixed(0)},${r.b.toFixed(0)}) leaves the clear area (${clear.x.toFixed(0)},${clear.y.toFixed(0)}..${clear.r.toFixed(0)},${clear.b.toFixed(0)})`);
          for (const cv of covers) if (hit(r, cv)) out.push(`"${n}" is under ${cv.what}`);
          const size = Math.max(r.r - r.x, r.b - r.y);
          if (size < 0.06 * short - 0.5) out.push(`"${n}" is ${size.toFixed(0)} px, under 6% of the stage's shorter side (${(0.06 * short).toFixed(0)} px)`);
          const g = [...document.querySelectorAll(`g.label[data-label="${n}"]`)].find((g) => (g.dataset.beats ?? "").split(" ").includes(String(k)) && g.style.display !== "none");
          if (g) {
            const dot = g.querySelector(".ldot"), d = dot && new DOMPoint(Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))).matrixTransform(ctm);
            if (g.getAttribute("visibility") === "hidden") shot && out.push(`the callout for "${n}" is hidden`);
            else if (d && (d.x < stage.x || d.x > stage.r || d.y < stage.y || d.y > stage.b)) out.push(`the callout for "${n}" points off the stage`);
            else if (d) for (const cv of covers.filter((x) => x.what.endsWith("card"))) if (d.x > cv.x && d.x < cv.r && d.y > cv.y && d.y < cv.b) out.push(`the callout for "${n}" points under ${cv.what}`);
          }
        }
        return out;
      };
      // The subject of a shot (a step's shot at its still frame, or a voice-led shot once it arrives):
      // its centre is in the middle half of the clear area, both ways; it spans at least 15% of the clear
      // area's shorter side; and the parts lit with it (data-named) take more of the frame than every other
      // part still in focus (not receded) put together, so nothing else reads as the subject.
      const subject = (names) => {
        const v = window.__viz, fig = document.getElementById("fig"), ctm = fig.getScreenCTM(), c = v.camera().clear;
        const c0 = new DOMPoint(c.x0, c.y0).matrixTransform(ctm), c1 = new DOMPoint(c.x1, c.y1).matrixTransform(ctm);
        const cl = { x: c0.x, y: c0.y, r: c1.x, b: c1.y }, cw = cl.r - cl.x, ch = cl.b - cl.y;
        const r = v.partsOnScreen(names);
        if (!r) return { out: [`"${names.join(", ")}" has no bounds`] };
        const out = [], cx = (r.x + r.r) / 2, cy = (r.y + r.b) / 2;
        const fx = (cx - cl.x) / cw, fy = (cy - cl.y) / ch;
        if (fx < 0.25 || fx > 0.75 || fy < 0.25 || fy > 0.75) out.push(`the subject's centre sits at ${(fx * 100).toFixed(0)}% across and ${(fy * 100).toFixed(0)}% down the clear area, outside its middle half`);
        const span = Math.max(r.r - r.x, r.b - r.y) / Math.min(cw, ch);
        if (span < 0.15) out.push(`the subject spans ${(span * 100).toFixed(0)}% of the clear area's shorter side, under 15%`);
        const inFrame = (e) => {
          const b = e.getBoundingClientRect(), w = Math.max(0, Math.min(b.right, cl.r) - Math.max(b.left, cl.x)), h = Math.max(0, Math.min(b.bottom, cl.b) - Math.max(b.top, cl.y));
          return w * h;
        };
        let lit = 0, rest = 0, biggest = { a: 0, part: "" }, litBox = null;
        for (const g of fig.querySelectorAll("[data-camera] .rig-part")) {
          if (g.style.display === "none" || g.hasAttribute("data-recede")) continue;
          const a = inFrame(g);
          if (g.hasAttribute("data-named") && a > 0) {
            const b = g.getBoundingClientRect();
            litBox = litBox ? { x: Math.min(litBox.x, b.left), y: Math.min(litBox.y, b.top), r: Math.max(litBox.r, b.right), b: Math.max(litBox.b, b.bottom) } : { x: b.left, y: b.top, r: b.right, b: b.bottom };
          }
          if (g.hasAttribute("data-named")) lit += a;
          else {
            rest += a;
            if (a > biggest.a) biggest = { a, part: g.dataset.part };
          }
        }
        // and what is lit is the subject: the lit parts cover most of the subject's box
        const ov = litBox ? Math.max(0, Math.min(litBox.r, r.r) - Math.max(litBox.x, r.x)) * Math.max(0, Math.min(litBox.b, r.b) - Math.max(litBox.y, r.y)) : 0;
        if (ov < 0.5 * (r.r - r.x) * (r.b - r.y)) out.push(`what is lit is not the subject (the lit parts cover ${Math.round((100 * ov) / Math.max(1, (r.r - r.x) * (r.b - r.y)))}% of its box)`);
        if (rest > lit) out.push(`parts in focus but not the subject take more of the frame (${Math.round(rest)} px², the largest "${biggest.part}") than the subject (${Math.round(lit)} px²)`);
        return { out, fx, fy, span, share: lit / Math.max(1, lit + rest) };
      };
      // Nothing clips the camera's figure but the stage: no clip-path or mask on it or between it and the
      // drawing, and the drawing itself does not clip to its own box inside the stage.
      const crop = () => {
        const fig = document.getElementById("fig"), out = [];
        for (let e = fig.querySelector("[data-camera]"); e && e !== fig.parentElement; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (e.getAttribute("clip-path") || (cs.clipPath && cs.clipPath !== "none")) out.push(`<${e.tagName.toLowerCase()}${e.id ? " #" + e.id : ""}> clips it (clip-path)`);
          if (e.getAttribute("mask") || (cs.mask && cs.mask !== "none" && e !== fig)) out.push(`<${e.tagName.toLowerCase()}${e.id ? " #" + e.id : ""}> masks it`);
        }
        const sb = document.querySelector(".vz-stage").getBoundingClientRect(), fb = fig.getBoundingClientRect(), pad = parseFloat(getComputedStyle(fig).paddingLeft) + parseFloat(getComputedStyle(fig).paddingTop);
        if (getComputedStyle(fig).overflow !== "visible" && (pad > 0 || fb.left > sb.left + 1 || fb.top > sb.top + 1 || fb.right < sb.right - 1 || fb.bottom < sb.bottom - 1)) out.push("the drawing clips it to a box inside the stage (set overflow: visible on #fig)");
        return out;
      };
      // A name's bounds are smaller than the whole figure and hold the point its callouts mark.
      const sanity = (names) => {
        const v = window.__viz, g = document.querySelector("#fig [data-camera]"), F = g.getBBox(), out = [], seen = [];
        if (!v.boundsOf || !v.anchors) return { out: ["the page has no __viz.boundsOf or __viz.anchors, so its bounds cannot be checked"], seen };
        const A = v.anchors();
        for (const n of names) {
          const b = v.boundsOf([n]);
          if (!b) {
            out.push(`"${n}" has no bounds`);
            continue;
          }
          const w = b.x1 - b.x0, h = b.y1 - b.y0;
          if (w * h > 0.5 * F.width * F.height || w >= F.width || h >= F.height) out.push(`"${n}" has bounds ${w.toFixed(0)}×${h.toFixed(0)}, as big as the whole figure (${F.width.toFixed(0)}×${F.height.toFixed(0)})`);
          const a = A[n], tol = 0.02 * Math.max(F.width, F.height);
          if (a && (a[0] < b.x0 - tol || a[0] > b.x1 + tol || a[1] < b.y0 - tol || a[1] > b.y1 + tol)) out.push(`"${n}" has bounds (${b.x0.toFixed(0)},${b.y0.toFixed(0)}..${b.x1.toFixed(0)},${b.y1.toFixed(0)}) that miss its own anchor (${a[0].toFixed(0)},${a[1].toFixed(0)})`);
          seen.push(`${n} ${w.toFixed(0)}×${h.toFixed(0)}${a ? " ⊃ anchor" : ""}`);
        }
        return { out, seen };
      };
      let shots = 0, spoken = 0, led = 0;
      const subjects = [], boundsSeen = new Map();
      for (const [w, h] of [[1440, 900], [1280, 800]]) {
        await p.setViewport({ width: w, height: h });
        await wait(150);
        for (const v of variants.length ? variants : [null]) {
          if (v) await p.evaluate((v) => window.__viz.variant(v), v);
          const cam = await p.evaluate(() => window.__viz.camera());
          for (let k = 0; k < cam.tracks.length; k++) {
            const names = cam.shots[k] ?? [];
            const at = `${w}×${h} ${v} step ${k}`;
            await p.evaluate((k) => window.__viz.seekStep(k), k);
            for (const f of await p.evaluate(framing, names, k, true)) fail(`${at}, its shot: ${f}`);
            for (const f of await p.evaluate(crop)) fail(`${at}: a hard crop: ${f}`);
            const used = [...new Set([...names, ...(cam.around?.[k] ?? []), ...(cam.links[k] ?? []).flatMap((l) => l.ids)])];
            const sn = await p.evaluate(sanity, used);
            for (const f of sn.out) fail(`${at}, bounds: ${f}`);
            if (w === 1440 && v === variants[0]) for (const s of sn.seen) boundsSeen.set(s.split(" ")[0], s);
            if (names.length) {
              const sj = await p.evaluate(subject, names);
              for (const f of sj.out) fail(`${at}, its shot (${names.join(", ")}): ${f}`);
              if (w === 1440) subjects.push(`${v} ${k} centre ${(sj.fx * 100).toFixed(0)}%,${(sj.fy * 100).toFixed(0)}% span ${(sj.span * 100).toFixed(0)}% lit ${(sj.share * 100).toFixed(0)}%`);
            }
            shots++;
            // each spoken link, at the moment its words begin
            for (const l of cam.links[k] ?? []) {
              const T = cam.starts[k] + cam.lead + l.start;
              await p.evaluate((ms) => window.__viz.seek(ms), T * 1000 + 1);
              for (const f of await p.evaluate(framing, l.ids, k, false)) fail(`${at}, the voice at ${T.toFixed(2)} s ("${l.ids.join(", ")}"): ${f}`);
              spoken++;
            }
            // each voice-led shot, once it has arrived and its words are lit
            for (const mv of cam.tracks[k].moves.filter((m) => m.ids.length)) {
              const l = (cam.links[k] ?? []).find((l) => mv.ids.some((id) => l.ids.includes(id)) && cam.starts[k] + cam.lead + l.start >= mv.t0 + mv.d - 1e-6);
              const T = Math.max(mv.t0 + mv.d, l ? cam.starts[k] + cam.lead + l.start : 0) + 0.01;
              await p.evaluate((ms) => window.__viz.seek(ms), T * 1000);
              const sj = await p.evaluate(subject, mv.ids);
              for (const f of sj.out) fail(`${at}, the voice-led shot of "${mv.ids.join(", ")}" at ${T.toFixed(2)} s: ${f}`);
              led++;
            }
          }
        }
      }
      console.log(`camera framing: ${shots} step shots, ${spoken} spoken names and ${led} voice-led shots, at 1440×900 and 1280×800, every What if`);
      console.log(`camera subjects (1440×900; centre across, down the clear area; span of its shorter side; lit share of the parts in focus): ${subjects.join(" | ")}`);
      console.log(`camera bounds (figure units, ${variants[0] ?? ""}): ${[...boundsSeen.values()].join(", ")}`);
      await p.setViewport({ width: 1440, height: 900 });
      await wait(150);
      if (variants.length) await p.evaluate((v) => window.__viz.variant(v), variants[0]);

      // Determinism: a step's camera is the same by seekStep and by its tab, once the tab's move settles;
      // a time's camera is the same by seek and by playing up to it.
      const cam = await p.evaluate(() => window.__viz.camera());
      await p.evaluate(() => document.getElementById("voice").getAttribute("aria-pressed") !== "false" && document.getElementById("voice").click());
      await p.evaluate(() => window.__viz.answer(0));
      const settle = async () => {
        for (let i = 0; i < 60 && (await p.evaluate(() => window.__viz.camera().blending)); i++) await wait(50);
      };
      for (let k = 1; k < cam.tracks.length; k++) {
        const a = await p.evaluate((k) => (window.__viz.seekStep(k), window.__viz.camera().m), k);
        await p.evaluate((k) => window.__viz.seekStep(k === 1 ? 2 : k - 1), k);
        await p.evaluate((k) => document.querySelectorAll(".vz-chapters button")[k - 1].click(), k);
        await settle();
        const b = await p.evaluate(() => window.__viz.camera().m);
        if (!near(a, b)) fail(`camera: step ${k} by seekStep is ${show(a)}, by its tab ${show(b)}`);
      }
      // play through every move of the camera (into each step, and each voice-led shot) and compare
      // the camera at each moment with the camera a seek to the same time gives
      const moves = cam.tracks.flatMap((t) => t.moves);
      const seen = [];
      for (const mv of moves) {
        await p.evaluate((ms) => window.__viz.seek(ms), Math.max(0, mv.t0 - 0.25) * 1000);
        await p.evaluate(() => document.getElementById("play").click());
        const end = Date.now() + (mv.d + 0.6) * 1000;
        while (Date.now() < end) {
          seen.push(await p.evaluate(() => {
            const c = window.__viz.camera();
            return { T: c.T, m: c.m, running: c.running };
          }));
          await wait(70);
        }
        await p.evaluate(() => window.__viz.state().running && document.getElementById("play").click());
      }
      let checked = 0;
      for (const s of seen.filter((s) => s.running)) {
        const m = await p.evaluate((ms) => (window.__viz.seek(ms), window.__viz.camera().m), s.T * 1000);
        checked++;
        if (!near(m, s.m)) fail(`camera: at ${s.T.toFixed(3)} s, playing gives ${show(s.m)}, a seek ${show(m)}`);
      }
      if (!checked) fail("camera: playing never ran, so play and seek could not be compared");
      console.log(`camera determinism: ${cam.tracks.length - 1} steps by seekStep and by tab, ${checked} moments while playing through ${moves.length} moves against a seek to the same time`);

      // Calm: through the whole story, frame by frame at 60 fps, the picture never moves faster than
      // 2 clear-area short sides a second, and every shot it stops on is held at least 0.8 s.
      const SPEED = 2.0, HOLD = 0.8;
      for (const v of variants.length ? variants : [null]) {
        if (v) await p.evaluate((v) => window.__viz.variant(v), v);
        const c = await p.evaluate(() => window.__viz.camera());
        const total = await p.evaluate(() => Number(document.getElementById("scrub").max));
        const ms = await p.evaluate((total) => {
          const out = [];
          for (let t = 0; t <= total * 1000; t += 1000 / 60) {
            window.__viz.seek(t);
            out.push(window.__viz.camera().m);
          }
          return out;
        }, total);
        let fastest = { v: 0, t: 0 }, still = 0, stillFrom = 0, moving = false, holds = [];
        for (let i = 1; i < ms.length; i++) {
          const t = (i * 1000) / 60 / 1000, sp = moved(ms[i - 1], ms[i], c.clear) * 60;
          if (sp > fastest.v) fastest = { v: sp, t };
          if (sp > 1e-4) {
            if (!moving && i > 1 && stillFrom > 0) holds.push({ from: stillFrom, d: still });
            moving = true;
            still = 0;
          } else {
            if (moving) (stillFrom = t), (moving = false);
            still += 1 / 60;
          }
        }
        const short = holds.filter((h) => h.d < HOLD - 1 / 60 - 1e-9);
        console.log(`camera calm ${v ?? ""}: ${c.tracks.flatMap((t) => t.moves).length} moves, fastest ${fastest.v.toFixed(2)} short sides/s at ${fastest.t.toFixed(2)} s (limit ${SPEED}), shortest hold ${holds.length ? Math.min(...holds.map((h) => h.d)).toFixed(2) : "-"} s (at least ${HOLD})`);
        if (fastest.v > SPEED) fail(`camera ${v}: at ${fastest.t.toFixed(2)} s the picture moves ${fastest.v.toFixed(2)} short sides a second, over ${SPEED}`);
        for (const h of short) fail(`camera ${v}: the shot reached at ${h.from.toFixed(2)} s is held ${h.d.toFixed(2)} s, under ${HOLD}`);
      }
      if (variants.length) await p.evaluate((v) => window.__viz.variant(v), variants[0]);
      // and the eased move a tab click makes, timed frame by frame in the page
      let tabTop = 0;
      for (let k = 1; k < cam.tracks.length; k++) {
        await p.evaluate((k) => window.__viz.seekStep(k - 1), k);
        const fr = await p.evaluate(
          (k) =>
            new Promise((done) => {
              const out = [];
              document.querySelectorAll(".vz-chapters button")[k - 1].click();
              const t0 = performance.now();
              const step = (now) => {
                out.push({ t: now, m: window.__viz.camera().m });
                if (now - t0 < 2500 && (window.__viz.camera().blending || now - t0 < 200)) requestAnimationFrame(step);
                else done(out);
              };
              requestAnimationFrame(step);
            }),
          k,
        );
        let top = 0;
        for (let i = 1; i < fr.length; i++) {
          const dt = (fr[i].t - fr[i - 1].t) / 1000;
          if (dt > 0.004) top = Math.max(top, moved(fr[i - 1].m, fr[i].m, cam.clear) / dt);
        }
        // a frame's clock is coarse, so a tenth over the limit is allowed here
        if (top > SPEED * 1.1) fail(`camera: the move to step ${k} by its tab reaches ${top.toFixed(2)} short sides a second, over ${SPEED}`);
        tabTop = Math.max(tabTop, top);
      }
      console.log(`camera calm by tab: the fastest of ${cam.tracks.length - 1} tab moves reaches ${tabTop.toFixed(2)} short sides/s`);
      if (errors.length) fail(`camera: console errors: ${[...new Set(errors)].join(" | ")}`);
    }
    await p.close();
  }
  // Playback: every frame of the story, for every variant, at 1440 x 900.
  if (!ONLY_CAMERA) {
    // The machine: the same kind of work as a frame of the rig (set a transform on a few hundred <g>
    // holding a <use>, read the layout), timed here, in a blank page of the same browser and size.
    const cal = await browser.newPage();
    await cal.setViewport({ width: 1440, height: 900 });
    await throttle(cal);
    await cal.setContent(`<svg id="s" width="1440" height="900" viewBox="0 0 1440 900"><defs><g id="d">${Array.from({ length: 24 }, (_, i) => `<path d="M${i} 0L${i + 20} 0L${i + 20} 10L${i} 10Z"/>`).join("")}</g></defs></svg>`);
    const medians = [];
    for (let run = 0; run < 3; run++) {
      medians.push(await cal.evaluate(() => {
        const svg = document.getElementById("s"), gs = [];
        for (let i = 0; i < 300; i++) {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g"), u = document.createElementNS("http://www.w3.org/2000/svg", "use");
          u.setAttribute("href", "#d");
          g.append(u);
          svg.append(g);
          gs.push(g);
        }
        let sink = 0;
        const frame = (f) => {
          for (let i = 0; i < gs.length; i++) gs[i].setAttribute("transform", `matrix(1 0 0 1 ${(i * 4 + f) % 1400} ${(i * 3 + f * 2) % 880})`);
          for (let i = 0; i < 4000; i++) sink += Math.sin(i * 0.01 + f) * Math.cos(i * 0.02 - f); // the model's arithmetic
          document.body.getBoundingClientRect();
        };
        for (let f = 0; f < 30; f++) frame(f); // warm-up
        // batches of 10 frames, so a coarse clock still resolves a fraction of a millisecond
        const batches = [];
        for (let b = 0; b < 20; b++) {
          const a = performance.now();
          for (let f = 0; f < 10; f++) frame(30 + b * 10 + f);
          batches.push((performance.now() - a) / 10);
        }
        batches.sort((x, y) => x - y);
        return batches[batches.length >> 1] + (sink > 1e18 ? 1 : 0);
      }));
    }
    await cal.close();
    const measured = Math.min(...medians);
    const scale = Math.min(MAX_SCALE, Math.max(1, measured / REFERENCE_MS));
    const P95 = 8 * scale, WORST = (1000 / 60) * scale;
    console.log(`playback: reference workload ${measured.toFixed(2)} ms a frame (reference ${REFERENCE_MS.toFixed(2)}), machine is ${(measured / REFERENCE_MS).toFixed(1)}x the reference; limits ${P95.toFixed(1)} ms (95th percentile) and ${WORST.toFixed(1)} ms (any frame outside a step change)${measured / REFERENCE_MS > MAX_SCALE ? `, scale capped at ${MAX_SCALE}` : ""}`);
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await throttle(p);
    await p.evaluateOnNewDocument(fakeAudio);
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    await wait(300);
    const variants = await p.evaluate(() => window.__viz?.variants ?? [...document.querySelectorAll(".vz-whatif button")].map((b) => b.dataset.variant));
    for (const v of variants.length ? variants : [null]) {
      if (v) await p.evaluate((v) => window.__viz.variant(v), v);
      const max = await p.evaluate(() => Number(document.getElementById("scrub").max) * 1000);
      const times = [];
      let worst = { ms: 0, t: 0 };
      // in chunks, so a slow page cannot outlast one call to the browser
      for (let t0 = 0; t0 < max; t0 += 400 * (1000 / 60)) {
        const chunk = await p.evaluate((t0, max, WORST) => {
          const count = document.getElementById("count"), out = [];
          let retries = 12;
          const frame = (t) => {
            const a = performance.now();
            window.__viz.seek(t);
            document.body.getBoundingClientRect();
            return performance.now() - a;
          };
          for (let i = 0, t = t0; i < 400 && t < max; i++, t += 1000 / 60) {
            const before = count.textContent;
            let ms = frame(t);
            const step = count.textContent !== before;
            // a frame over budget: step back and time the same move again, twice; the best time
            // counts (only a few per chunk, so an always-slow page does not take three times as long)
            if (ms > WORST && !step && retries-- > 0) for (let r = 0; r < 2; r++) (frame(t - 1000 / 60), (ms = Math.min(ms, frame(t))));
            out.push({ ms, t, step });
          }
          return out;
        }, t0, max, WORST);
        for (const f of chunk) {
          times.push(f.ms);
          if (!f.step && f.ms > worst.ms) worst = f;
        }
        // clearly over: the 95th percentile of 800 frames or more is already past its limit
        if (times.length >= 800 && [...times].sort((x, y) => x - y)[Math.floor(times.length * 0.95)] > P95) {
          console.log(`${v ?? ""}: over the limit after ${times.length} frames; the rest are not timed`);
          break;
        }
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
      const s = `playback ${v ?? ""}`.trim();
      console.log(`${s}: ${times.length} frames, median ${(times[times.length >> 1] ?? 0).toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, worst outside a step change ${worst.ms.toFixed(1)} ms`);
      if (p95 > P95) fail(`${s}: the 95th-percentile frame takes ${p95.toFixed(1)} ms, over the ${P95.toFixed(1)} ms budget; draw parts once and move them (references/drawing.md, "Isometric machine figures")`);
      if (worst.ms > WORST) fail(`${s}: a frame at ${(worst.t / 1000).toFixed(2)} s takes ${worst.ms.toFixed(1)} ms, longer than ${WORST.toFixed(1)} ms (a frame at 60 fps, on this machine)`);
    }
    await p.close();
  }
} finally {
  await browser.close();
}

if (fails.length) {
  for (const f of [...new Set(fails)]) console.log(f);
  console.log(`drawing: ${fails.length} failure${fails.length > 1 ? "s" : ""}`);
  process.exit(1);
}
console.log("drawing: passed");
