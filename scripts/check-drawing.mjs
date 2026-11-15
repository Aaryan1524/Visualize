#!/usr/bin/env node
// Check a built Drawing page (a technical cutaway, see references/drawing.md) in headless Chrome.
//
//   node scripts/check-drawing.mjs dist/escalator.html
//
// The page contract: window.__viz with steps, seekStep(k), seek(ms), state() and variant(name);
// #scrub (the story timeline), #play, #voice, #try and #predict; every callout is a
// <g class="label"> holding a <text>. Prints `drawing: passed` or each failure, one per line.

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

const browser = await launch();
try {
  for (const [w, h] of [[1440, 900], [1280, 800]]) {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    await wait(300);
    const at = `${w}×${h}`;

    const contract = await p.evaluate(() => ({
      viz: typeof window.__viz?.seekStep === "function" && typeof window.__viz?.state === "function",
      ids: ["scrub", "play", "voice", "try", "predict"].filter((id) => !document.getElementById(id)),
      voice: document.documentElement.innerHTML.includes("audio/"),
    }));
    if (!contract.viz) fail(`${at}: window.__viz with seekStep() and state() is missing`);
    if (contract.ids.length) fail(`${at}: missing #${contract.ids.join(", #")}`);
    if (!contract.voice) fail(`${at}: no recorded voice is embedded (run the example's voice script)`);
    if (!contract.viz) continue;

    const steps = await p.evaluate(() => window.__viz.steps);
    let lastT = -1;
    for (let k = 0; k < steps; k++) {
      await p.evaluate((k) => window.__viz.seekStep(k), k);
      await wait(120);
      const r = await p.evaluate(() => {
        const doc = document.documentElement;
        const stage = document.querySelector(".vz-stage")?.getBoundingClientRect();
        const boxes = [...document.querySelectorAll("g.label")]
          .filter((g) => getComputedStyle(g).display !== "none" && g.getBoundingClientRect().width > 0)
          .map((g) => {
            const t = g.querySelector("text");
            const b = t.getBoundingClientRect();
            return { text: t.textContent, x: b.left, y: b.top, r: b.right, b: b.bottom, px: parseFloat(getComputedStyle(t).fontSize) * (t.getScreenCTM()?.a ?? 1) };
          });
        return {
          scroll: doc.scrollHeight > innerHeight + 1 || doc.scrollWidth > innerWidth + 1,
          stage: stage && { x: stage.left, y: stage.top, r: stage.right, b: stage.bottom },
          boxes,
          T: Number(document.getElementById("scrub").value),
          step: window.__viz.state().step,
        };
      });
      const s = `${at} step ${k}`;
      if (r.step !== k) fail(`${s}: seekStep(${k}) landed on step ${r.step}`);
      if (r.scroll) fail(`${s}: the page scrolls; one desktop viewport must hold it`);
      if (r.T <= lastT) fail(`${s}: the timeline goes backwards (${r.T} after ${lastT}); it must run once, start to end`);
      lastT = r.T;
      for (const [i, a] of r.boxes.entries()) {
        if (a.px < MIN_TEXT - 0.25) fail(`${s}: "${a.text}" renders at ${a.px.toFixed(1)} px, under ${MIN_TEXT}`);
        if (r.stage && (a.x < r.stage.x - 1 || a.r > r.stage.r + 1 || a.y < r.stage.y - 1 || a.b > r.stage.b + 1)) fail(`${s}: "${a.text}" leaves the stage`);
        for (const b of r.boxes.slice(i + 1)) {
          if (a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b) fail(`${s}: "${a.text}" overlaps "${b.text}"`);
        }
      }
    }

    // The story plays forward on one timeline and stops at the end instead of looping.
    const max = await p.evaluate(() => Number(document.getElementById("scrub").max));
    await p.evaluate(() => document.getElementById("voice").getAttribute("aria-pressed") !== "false" && document.getElementById("voice").click());
    await p.evaluate((ms) => window.__viz.seek(ms), (max - 1) * 1000);
    await p.evaluate(() => document.getElementById("play").click());
    await wait(1800);
    const end = await p.evaluate(() => ({ T: Number(document.getElementById("scrub").value), running: window.__viz.state().running }));
    if (end.running || end.T < max - 0.1) fail(`${at}: play near the end did not stop at the end (at ${end.T.toFixed(2)} of ${max.toFixed(2)})`);

    if (errors.length) fail(`${at}: console errors: ${[...new Set(errors)].join(" | ")}`);
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
