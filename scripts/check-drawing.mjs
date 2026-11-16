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
// - playback: every frame of the whole story, at 60 fps, for every What if variant, is timed from
//   the frame's start to its layout being done. The 95th percentile must stay under 8 ms (half a
//   frame, leaving the rest for paint), and no frame outside a step change may take a whole frame
//   (16.7 ms). A slow frame is timed again, and its best time counts, so a stray pause of the
//   machine running the check does not fail a page.

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
  for (const [w, h] of [[1440, 900], [1280, 800]]) {
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

  // Playback: every frame of the story, for every variant, at 1440 x 900.
  {
    const p = await browser.newPage();
    await p.setViewport({ width: 1440, height: 900 });
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
        const chunk = await p.evaluate((t0, max) => {
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
            if (ms > 1000 / 60 && !step && retries-- > 0) for (let r = 0; r < 2; r++) (frame(t - 1000 / 60), (ms = Math.min(ms, frame(t))));
            out.push({ ms, t, step });
          }
          return out;
        }, t0, max);
        for (const f of chunk) {
          times.push(f.ms);
          if (!f.step && f.ms > worst.ms) worst = f;
        }
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
      const s = `playback ${v ?? ""}`.trim();
      console.log(`${s}: ${times.length} frames, median ${(times[times.length >> 1] ?? 0).toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, worst outside a step change ${worst.ms.toFixed(1)} ms`);
      if (p95 > 8) fail(`${s}: the 95th-percentile frame takes ${p95.toFixed(1)} ms, over the 8 ms budget; draw parts once and move them (references/drawing.md, "Isometric machine figures")`);
      if (worst.ms > 1000 / 60) fail(`${s}: a frame at ${(worst.t / 1000).toFixed(2)} s takes ${worst.ms.toFixed(1)} ms, longer than a frame at 60 fps`);
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
