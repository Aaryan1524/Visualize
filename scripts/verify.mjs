#!/usr/bin/env node
// Check that a built scene shows what its model computed, at every step.
//
//   node scripts/verify.mjs                   every examples/* scene
//   node scripts/verify.mjs examples/lru      one scene directory (all its variants)
//   node scripts/verify.mjs --quick           skip screenshots and contact sheets
//   node scripts/verify.mjs <dir> --shots out  write screenshots to out/ (default: next to the scene)
//   node scripts/verify.mjs --controls        planted faults: each must be caught
//
// Every check has a planted fault in --controls, including editorial checks.
//
// The model is run here, in Node, independently of the page. Observations,
// captions and readouts from that run are compared with what the browser
// actually draws. Exits non-zero on any problem.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, settle } from "./lib/browser.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKS = readFileSync(join(ROOT, "scripts/lib/checks.js"), "utf8");

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const quick = flags.has("--quick");
const plantArg = argv.find((a, i) => argv[i - 1] === "--plant");
const shotsArg = argv.find((a, i) => argv[i - 1] === "--shots");
let dirs = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--plant" && argv[i - 1] !== "--shots").map((d) => resolve(d));

const { compile } = await import(pathToFileURL(join(ROOT, "src/core/scene.ts")).href);

// ---- Planted faults ------------------------------------------------------------
// Each one breaks the page in a specific way after it loads. Used by --controls
// to prove the checks can fail (see the coverage note at the top).
const PLANTS = {
  "detached-surface": () => {
    window.addEventListener("load", () => {
      const v=window.__viz, seek=v.seek;
      v.seek=t=>{seek(t);v.stage.svg.querySelectorAll(".vz-surface").forEach(e=>e.setAttribute("transform","translate(30 -30)"));};
      v.seekStep=k=>v.seek(v.compiled.restTime(k));
    });
  },
  "missing-surface": () => {
    window.addEventListener("load", () => {
      const v=window.__viz, seek=v.seek;
      v.seek=t=>{seek(t);v.stage.svg.querySelectorAll(".vz-surface").forEach(e=>e.replaceChildren());};
      v.seekStep=k=>v.seek(v.compiled.restTime(k));
    });
  },
  "desktop-scroll": () => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "body{min-height:1600px!important}";
      document.head.append(s);
    });
  },
  "copy-budget": () => {
    window.addEventListener("load", () => {
      const v = window.__viz, seek = v.seek;
      v.seek = t => {
        seek(t);
        v.root.querySelector('[data-role="action"]').textContent = "This paragraph adds far too many unnecessary words to a screen that should explain each change through its moving diagram.";
      };
      v.seekStep = k => v.seek(v.compiled.restTime(k));
    });
  },
  drawer: () => {
    document.addEventListener("click", e => {
      if (e.target.closest?.('[aria-haspopup="dialog"]')) e.stopImmediatePropagation();
    }, true);
  },
  prediction: () => {
    document.addEventListener("click",e=>{
      if (e.target.closest?.(".vz-predict-options")) e.stopImmediatePropagation();
    },true);
  },
  "outside-card": () => {
    document.addEventListener("DOMContentLoaded",()=>{
      const s=document.createElement("style");
      s.textContent=".vz-solid-label{transform:translateX(3000px)!important}";
      document.head.append(s);
    });
  },
  composition: () => {
    document.addEventListener("DOMContentLoaded",()=>{
      const s=document.createElement("style");
      s.textContent=".vz-stage{width:25%!important}";
      document.head.append(s);
    });
  },
  semantics: () => {
    document.addEventListener("DOMContentLoaded",()=>{
      const s=document.createElement("style");
      s.textContent=".vz-swatch{background:#ff00ff!important}";
      document.head.append(s);
    });
  },
  callouts: () => {
    window.addEventListener("load",()=>{
      const v=window.__viz, seek=v.seek;
      v.seek=t=>{seek(t);v.stage.svg.querySelectorAll(".vz-leader").forEach(e=>e.setAttribute("x2","3000"));};
      v.seekStep=k=>v.seek(v.compiled.restTime(k));
    });
  },
  // Paint solids in reverse depth order after every seek.
  depth: () => {
    const wrap = () => {
      const v = window.__viz;
      const seek = v.seek;
      v.seek = (t) => {
        seek(t);
        const layer = v.stage.svg.querySelector('[data-layer="solids"]');
        [...layer.children].reverse().forEach((c) => layer.append(c));
      };
      v.seekStep = (k) => v.seek(v.compiled.restTime(k));
    };
    window.addEventListener("load", wrap);
  },
  // Leave history-dependent state behind after a seek.
  determinism: () => {
    window.addEventListener("load", () => {
      const v = window.__viz;
      const seek = v.seek;
      let n = 0;
      v.seek = (t) => {
        seek(t);
        v.stage.svg.setAttribute("data-seeks", String(++n));
      };
      v.seekStep = (k) => v.seek(v.compiled.restTime(k));
    });
  },
  // Text too small to read.
  "text-size": () => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".vz-readout{font-size:8px!important}";
      document.head.append(s);
    });
  },
  // Caption nearly the colour of the card.
  contrast: () => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".vz-text{color:#e9e6df!important}";
      document.head.append(s);
    });
  },
  // Caption drawn from somewhere other than the model.
  caption: () => {
    window.addEventListener("load", () => {
      const v = window.__viz;
      const seek = v.seek;
      v.seek = (t) => {
        seek(t);
        v.root.querySelector('[data-role="caption"]').textContent = "Something else happened.";
      };
      v.seekStep = (k) => v.seek(v.compiled.restTime(k));
    });
  },
  // An uncaught error.
  console: () => {
    window.addEventListener("load", () => setTimeout(() => {
      throw new Error("planted failure");
    }));
  },
  // The page ignores #step= and always opens at the start.
  "step-link": () => {
    window.addEventListener("load", () => window.__viz.seek(0));
  },
  // The page never learns that the reader asked for reduced motion.
  "reduced-motion": () => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes("reduced-motion") ? { ...real("(min-width: 0px)"), matches: false, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
  },
  // Something wider than a phone.
  layout: () => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".vz-card::after{content:'';display:block;width:900px;height:1px}";
      document.head.append(s);
    });
  },
  // Caption nearly the colour of the card, in the dark theme only.
  "contrast-dark": () => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "@media (prefers-color-scheme: dark){.vz-text{color:#2a2d33!important}}";
      document.head.append(s);
    });
  },
  // Content under the stage grows with the step, so the stage shrinks.
  "layout-shift": () => {
    window.addEventListener("load", () => {
      const v = window.__viz;
      const seek = v.seek;
      v.seek = (t) => {
        seek(t);
        v.stage.svg.style.maxHeight = `${420 - v.shownIndex() * 12}px`;
      };
      v.seekStep = (k) => v.seek(v.compiled.restTime(k));
    });
  },
  // The renderer stops hiding labels that do not fit their face.
  "show-unfit-labels": () => {
    window.addEventListener("load", () => {
      const v = window.__viz;
      const seek = v.seek;
      v.seek = (t) => {
        seek(t);
        for (const l of v.stage.svg.querySelectorAll(".vz-solid-label[display]")) l.removeAttribute("display");
      };
      v.seekStep = (k) => v.seek(v.compiled.restTime(k));
    });
  },
  // Pointing at a linked element lights nothing.
  linking: () => {
    window.addEventListener("pointerover", (e) => e.stopImmediatePropagation(), true);
  },
  // Keyboard does nothing.
  keyboard: () => {
    window.addEventListener("keydown", (e) => e.stopImmediatePropagation(), true);
  },
};

const CONTROLS = [
  { variant:"editorial", plant:"detached-surface", expect:"surface finish" },
  { variant:"editorial", plant:"missing-surface", expect:"surface finish" },
  { variant:"editorial", plant:"desktop-scroll", expect:"desktop viewport" },
  { variant:"editorial", plant:"copy-budget", expect:"copy budget" },
  { variant:"editorial", plant:"drawer", expect:"details drawer" },
  { plant: "outside-card", expect: "labels" },
  { variant:"editorial", plant:"composition", expect:"composition" },
  { variant:"editorial", plant:"semantics", expect:"semantics" },
  { variant:"editorial", plant:"callouts", expect:"callouts" },
  { variant:"editorial", plant:"prediction", expect:"prediction" },
  { variant:"wrong-tone", expect:"observations" },
  { plant: "depth", expect: "depth order" },
  { plant: "determinism", expect: "determinism" },
  { plant: "text-size", expect: "text size" },
  { plant: "contrast", expect: "contrast" },
  { plant: "caption", expect: "captions" },
  { plant: "console", expect: "console" },
  { plant: "keyboard", expect: "keyboard" },
  { plant: "linking", expect: "linking" },
  { plant: "layout-shift", expect: "layout shift" },
  { variant: "label-on-part", expect: "labels" },
  { variant: "hidden-value", expect: "observations" },
  { variant: "loose-cable", expect: "mounts" },
  { variant: "wrong-value", expect: "observations" },
  { variant: "crowded-labels", expect: "labels" },
  { variant: "intersecting", expect: "depth order" },
  { variant: "hidden-behind", expect: "observations" },
  { variant: "wrong-size", expect: "observations" },
  { variant: "wrong-order", expect: "observations" },
  { variant: "unlit", expect: "observations" },
  { variant: "wide-label", plant: "show-unfit-labels", expect: "labels" },
  { variant: "covered-label", expect: "labels" },
  { plant: "step-link", expect: "step link" },
  { plant: "reduced-motion", expect: "reduced motion" },
  { plant: "layout", expect: "layout" },
  { plant: "contrast-dark", expect: "contrast dark" },
];

// ---- Helpers ------------------------------------------------------------------
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function sceneDirs() {
  const ex = join(ROOT, "examples");
  if (!existsSync(ex)) return [];
  return readdirSync(ex)
    .sort()
    .map((n) => join(ex, n))
    .filter((d) => existsSync(join(d, "scene.ts")));
}

async function variantsOf(dir) {
  const mod = await import(pathToFileURL(join(dir, "scene.ts")).href);
  return mod.variants ?? { [mod.default.id]: mod.default };
}

function buildTo(dir, out) {
  execFileSync(process.execPath, [join(ROOT, "scripts/build.mjs"), dir, "--out", out], { stdio: "pipe" });
}

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

class Report {
  constructor(name) {
    this.name = name;
    this.rows = [];
  }
  add(check, detail, problems = []) {
    this.rows.push({ check, detail, problems });
  }
  get failed() {
    return this.rows.filter((r) => r.problems.length > 0);
  }
  print() {
    console.log(`\n${this.name}`);
    for (const r of this.rows) {
      const mark = r.problems.length ? "FAIL" : "ok  ";
      console.log(`  ${mark} ${r.check.padEnd(15)} ${r.detail}`);
      for (const p of r.problems.slice(0, 6)) console.log(`         - ${p}`);
      if (r.problems.length > 6) console.log(`         … ${r.problems.length - 6} more`);
    }
    const n = this.failed.reduce((s, r) => s + r.problems.length, 0);
    console.log(n ? `  ${this.name}: FAILED (${n} problems in ${this.failed.length} checks)` : `  ${this.name}: passed`);
  }
}

// ---- One page -------------------------------------------------------------------
async function verifyPage(browser, { name, scene, file, shotsDir, plant }) {
  const report = new Report(name);
  const compiled = compile(scene);
  const steps = compiled.steps;
  const last = steps.length - 1;
  const tl = compiled.timeline;

  const openWithPlant = async (opts) => {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`exception: ${e.message ?? e}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
    if (plant) await page.evaluateOnNewDocument(PLANTS[plant]);
    await page.setViewport({ width: opts.width ?? 1280, height: opts.height ?? 1000, deviceScaleFactor: opts.scale ?? 1 });
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: opts.theme ?? "light" },
      { name: "prefers-reduced-motion", value: opts.reduced ? "reduce" : "no-preference" },
    ]);
    await page.goto(pathToFileURL(file).href + (opts.hash ?? ""), { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.__viz), { timeout: 5000 });
    await page.evaluate(CHECKS);
    await settle(page);
    return { page, errors };
  };

  const allErrors = [];

  // Mounts: every cable end sits on a standing part (within 1.5 units of its
  // footprint and height), checked on the model-driven marks at every step.
  {
    const problems = [];
    const standing = (m) => (m.kind === "box" || m.kind === "cylinder") && (m.kind === "box" ? m.at[2] + m.size[2] : m.at[2] + m.height) > 1e-6 && m.role !== "foundation";
    const bounds = (m) => m.kind === "box"
      ? [m.at, [m.at[0] + m.size[0], m.at[1] + m.size[1], m.at[2] + m.size[2]]]
      : [[m.at[0] - m.radius, m.at[1] - m.radius, m.at[2]], [m.at[0] + m.radius, m.at[1] + m.radius, m.at[2] + m.height]];
    const near = (p, [lo, hi]) => [0, 1, 2].every((i) => p[i] >= lo[i] - 1.5 && p[i] <= hi[i] + 1.5);
    let ends = 0;
    steps.forEach((st, k) => {
      const solids = st.marks.filter(standing).map(bounds);
      for (const m of st.marks) {
        if (m.kind !== "link" || !m.cable || m.transient || m.leaving) continue;
        for (const [name, p] of [["start", m.from], ["end", m.to]]) {
          ends++;
          if (!solids.some((b) => near(p, b))) problems.push(`step ${k}: cable ${m.key} ${name} at (${p.map((n) => n.toFixed(1)).join(", ")}) is not on a part`);
        }
      }
    });
    report.add("mounts", `${ends} cable ends checked against standing parts`, [...new Set(problems)].slice(0, 20));
  }

  // -- Desktop, light: model agreement, depth, determinism, text ---------------
  {
    const { page, errors } = await openWithPlant({ width: 1280, height: 1000 });

    const obsProblems = [];
    const capProblems = [];
    let obsCount = 0;
    for (let k = 0; k <= last; k++) {
      await page.evaluate((k) => window.__viz.seekStep(k), k);
      const s = steps[k];
      obsCount += s.observations.length;
      const fails = await page.evaluate((list) => window.__vzCheck.observe(list), s.observations);
      for (const f of fails) obsProblems.push(`step ${k}: ${f}`);
      const shown = await page.evaluate(() => window.__vzCheck.shown());
      if (shown.caption !== norm(s.caption)) capProblems.push(`step ${k}: caption "${shown.caption}" ≠ model "${norm(s.caption)}"`);
      if (shown.readout !== norm(s.readout)) capProblems.push(`step ${k}: readout "${shown.readout}" ≠ model "${norm(s.readout)}"`);
      if (shown.trust !== s.trust) capProblems.push(`step ${k}: trust "${shown.trust}" ≠ "${s.trust}"`);
      if (s.teaching && shown.action !== norm(s.teaching.heading)) capProblems.push(`step ${k}: action differs from the teaching beat`);
    }
    report.add("observations", `${obsCount} declared across ${steps.length} steps`, obsProblems);
    if (obsCount === 0) report.rows.at(-1).problems.push("the scene declares no observations, so nothing ties the picture to the model");
    report.add("captions", `caption, readout and trust at ${steps.length} steps`, capProblems);

    // Layout stability: the stage keeps one size at every step, so nothing
    // jumps and the camera fit never depends on what was seen before.
    {
      const sizes = [];
      for (let k = 0; k <= last; k++) {
        await page.evaluate((k) => window.__viz.seekStep(k), k);
        await settle(page);
        sizes.push(await page.evaluate(() => { const r = window.__viz.stage.svg.getBoundingClientRect(); return [r.width, r.height]; }));
      }
      const [w0, h0] = sizes[0];
      const shifts = sizes.map(([w, h], k) => (Math.abs(w - w0) > 0.5 || Math.abs(h - h0) > 0.5 ? `step ${k}: stage ${w.toFixed(1)}×${h.toFixed(1)}, step 0 ${w0.toFixed(1)}×${h0.toFixed(1)}` : null)).filter(Boolean);
      report.add("layout shift", "the stage keeps one size at every step", shifts);
    }

    // Depth: every rest state and four instants inside every transition.
    const instants = [];
    for (let k = 0; k <= last; k++) {
      instants.push({ label: `step ${k}`, t: compiled.restTime(k) });
      if (k > 0) for (const p of [0.2, 0.4, 0.6, 0.8]) instants.push({ label: `step ${k - 1}→${k} at ${p}`, t: tl.start[k] + tl.duration[k] * p });
    }
    let samples = 0;
    const depthProblems = [];
    const surfaceProblems = new Set();
    const conflictSet = new Set();
    for (const { label, t } of instants) {
      await page.evaluate((t) => window.__viz.seek(t), t);
      const d = await page.evaluate(() => window.__vzCheck.depth());
      for (const p of await page.evaluate(() => window.__vzCheck.surfaces())) surfaceProblems.add(`${label}: ${p}`);
      samples += d.samples;
      for (const w of d.wrong.slice(0, 2)) depthProblems.push(`${label}: at ${w.at} ${w.expected} is nearer but ${w.painted} is painted on top`);
      for (const [a, b] of d.conflicts) conflictSet.add(`${a} and ${b} intersect (${label})`);
    }
    report.add("depth order", `${instants.length} instants · ${samples} overlap samples ray-cast`, [...depthProblems, ...[...conflictSet].slice(0, 8)]);

    report.add("surface finish", "rendered details stay on their owning solids at rest and during motion", [...surfaceProblems]);

    // Determinism: the same time shows the same page whatever was seen before.
    const r = rng(1234);
    const detProblems = [];
    const trials = 12;
    for (let i = 0; i < trials; i++) {
      const t = r() * tl.total;
      await page.evaluate((t) => window.__viz.seek(t), t);
      const a = await page.evaluate(() => window.__vzCheck.snapshot());
      for (let j = 0; j < 4; j++) await page.evaluate((t) => window.__viz.seek(t), r() * tl.total);
      await page.evaluate((t) => window.__viz.seek(t), t);
      const b = await page.evaluate(() => window.__vzCheck.snapshot());
      if (a !== b) detProblems.push(`t=${t.toFixed(0)} ms differs after seeking elsewhere and back`);
    }
    report.add("determinism", `${trials} times, each revisited after 4 random seeks`, detProblems);

    // Text and labels at every rest state.
    const small = new Set(), faint = new Set(), labelProblems = new Set();
    for (let k = 0; k <= last; k++) {
      await page.evaluate((k) => window.__viz.seekStep(k), k);
      const tx = await page.evaluate(() => window.__vzCheck.text());
      tx.small.forEach((s) => small.add(`step ${k}: ${s}`));
      tx.faint.forEach((s) => faint.add(s));
      const lb = await page.evaluate(() => window.__vzCheck.labels());
      for (const list of [lb.overlaps, lb.spill, lb.hidden, lb.clipped, lb.panels, lb.onParts]) list.forEach((s) => labelProblems.add(`step ${k}: ${s}`));
    }
    report.add("text size", "every visible text node, at every step (11 px minimum)", [...small]);
    report.add("contrast", "WCAG ratio against the face or card behind each text, light theme", [...faint]);
    report.add("labels", "no overlaps, no spill off faces, not covered, inside the card, panels fit", [...labelProblems]);
    if (scene.presentation === "editorial") {
      const issues={composition:new Set(),semantics:new Set(),callouts:new Set()};
      for (const theme of ["light","dark"]) for (const width of [1280,390]) {
        await page.emulateMediaFeatures([{name:"prefers-color-scheme",value:theme}]);
        await page.setViewport({width,height:1000,deviceScaleFactor:1});
        await settle(page);
        for (let k=0;k<=last;k++) {
          await page.evaluate(k=>window.__viz.seekStep(k),k);
          const result=await page.evaluate(()=>window.__vzCheck.design());
          for (const name of Object.keys(issues)) result[name].forEach(p=>issues[name].add(`${theme} ${width}px step ${k}: ${p}`));
        }
      }
      await page.setViewport({width:1280,height:1000,deviceScaleFactor:1});
      await page.emulateMediaFeatures([{name:"prefers-color-scheme",value:"light"}]);
      await settle(page);
      for (const [name,problems] of Object.entries(issues)) report.add(name,"every step at desktop and phone widths, both themes",[...problems]);

      const viewportProblems = new Set(), copyProblems = new Set(), drawerProblems = [];
      for (const theme of ["light", "dark"]) for (const [width, height] of [[1440, 900], [1920, 1080]]) {
        await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        await settle(page);
        for (let k = 0; k <= last; k++) {
          await page.evaluate(k => window.__viz.seekStep(k), k);
          const result = await page.evaluate(() => window.__vzCheck.desktop());
          result.viewport.forEach(p => viewportProblems.add(`${theme} ${width}×${height} step ${k}: ${p}`));
          result.copy.forEach(p => copyProblems.add(`step ${k}: ${p}`));
          if (steps[k].teaching?.prediction) {
            await page.click(".vz-predict-options button");
            const answered = await page.evaluate(() => window.__vzCheck.desktop());
            answered.viewport.forEach(p => viewportProblems.add(`${theme} ${width}×${height} feedback: ${p}`));
            answered.copy.forEach(p => copyProblems.add(`feedback: ${p}`));
          }
        }
        for (let k = 1; k <= last; k++) for (const p of [.2, .4, .6, .8]) {
          await page.evaluate(t => window.__viz.seek(t), tl.start[k] + tl.duration[k] * p);
          const result = await page.evaluate(() => window.__vzCheck.desktop());
          result.viewport.forEach(problem => viewportProblems.add(`${theme} ${width}×${height} move ${k} at ${p}: ${problem}`));
        }
      }
      report.add("desktop viewport", "1440×900 and 1920×1080, both themes: no page scroll; stage, controls, prediction and feedback fit; 4 samples per move", [...viewportProblems]);
      report.add("copy budget", "short title, action, prediction and feedback; paragraphs confined to Details", [...copyProblems]);

      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      await settle(page);
      await page.evaluate(() => window.__viz.seekStep(1));
      const beforeDetails = await page.evaluate(() => ({ width: document.scrollingElement.scrollWidth, height: document.scrollingElement.scrollHeight, step: window.__viz.shownIndex() }));
      await page.click('[aria-haspopup="dialog"]');
      const opened = await page.$eval(".vz-drawer", e => e.open);
      if (!opened) drawerProblems.push("Details did not open");
      else {
        const focus = await page.evaluate(() => document.querySelector(".vz-drawer").contains(document.activeElement));
        if (!focus) drawerProblems.push("focus did not enter the dialog");
        await page.keyboard.press("End");
        if (await page.evaluate(() => window.__viz.shownIndex()) !== beforeDetails.step) drawerProblems.push("dialog keyboard input changed the underlying scene");
        await page.evaluate(() => document.querySelectorAll(".vz-drawer details").forEach(e => e.open = true));
        const expanded = await page.evaluate(() => {
          const body = document.querySelector(".vz-drawer-body"), r = body.getBoundingClientRect();
          return { width: document.scrollingElement.scrollWidth, height: document.scrollingElement.scrollHeight, internal: body.scrollHeight > body.clientHeight, scrollable: ["auto","scroll"].includes(getComputedStyle(body).overflowY), fits: r.bottom <= innerHeight && r.top >= 0 };
        });
        if (expanded.width !== beforeDetails.width || expanded.height !== beforeDetails.height) drawerProblems.push("opening Details resized the main page");
        if (!expanded.scrollable || !expanded.fits) drawerProblems.push("expanded transcript does not fit in an internally scrolling drawer");
        await page.keyboard.press("Escape");
        if (await page.$eval(".vz-drawer", e => e.open)) drawerProblems.push("Escape did not close Details");
        if (!await page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup") === "dialog")) drawerProblems.push("closing Details did not restore focus to its button");
      }
      report.add("details drawer", "contained transcript, modal focus, Escape, focus restoration; underlying timeline stays fixed", drawerProblems);
      await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
      await settle(page);
    }

    // Linked highlighting: pointing at a linked element lights exactly the
    // related elements (one's ids contain the other's), across stage and panels.
    {
      const linkProblems = [];
      let tried = 0;
      for (let k = 0; k <= last && tried < 12; k++) {
        await page.evaluate((k) => window.__viz.seekStep(k), k);
        await settle(page);
        // Point from both sides: panel elements (grid cells, equation terms) and stage marks.
        const targets = [...(await page.$$(".vz-panel [data-link]")).slice(0, 2), ...(await page.$$(".vz-svg [data-link]")).slice(0, 2)];
        for (const el of targets) {
          const box = await el.boundingBox();
          if (!box || box.width < 2) continue;
          tried++;
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          const res = await page.evaluate((x, y) => {
            const hovered = document.elementFromPoint(x, y)?.closest("[data-link]");
            if (!hovered) return { skipped: true };
            // Related means one element's ids contain the other's.
            const ids = hovered.getAttribute("data-link").split(/\s+/).filter(Boolean);
            const all = [...document.querySelectorAll("[data-link]")];
            const shares = (e) => {
              const other = e.getAttribute("data-link").split(/\s+/).filter(Boolean);
              return ids.every((id) => other.includes(id)) || other.every((id) => ids.includes(id));
            };
            return {
              ids: [...ids],
              missing: all.filter((e) => shares(e) && !e.classList.contains("is-linked")).length,
              extra: all.filter((e) => !shares(e) && e.classList.contains("is-linked")).length,
              lit: all.filter((e) => e.classList.contains("is-linked")).length,
            };
          }, box.x + box.width / 2, box.y + box.height / 2);
          if (res.skipped) continue;
          if (res.missing) linkProblems.push(`step ${k}: pointing at ${res.ids.join(" ")} left ${res.missing} related elements unlit`);
          if (res.extra) linkProblems.push(`step ${k}: pointing at ${res.ids.join(" ")} lit ${res.extra} unrelated elements`);
        }
      }
      await page.mouse.move(1, 1);
      if (tried) report.add("linking", `${tried} linked elements pointed at`, linkProblems);
    }

    // Keyboard.
    const keyProblems = [];
    await page.evaluate(() => window.__viz.seekStep(0));
    await page.focus(".vz-stage");
    await page.keyboard.press("ArrowRight");
    const reached = await page
      .waitForFunction((t) => window.__viz.time() === t, { timeout: 4000 }, compiled.restTime(1))
      .then(() => true, () => false);
    if (!reached) keyProblems.push("ArrowRight from the start did not arrive at step 1");
    else {
      await page.keyboard.press("ArrowLeft");
      const back = await page.waitForFunction(() => window.__viz.time() === 0, { timeout: 4000 }).then(() => true, () => false);
      if (!back) keyProblems.push("ArrowLeft from step 1 did not return to the start");
    }
    await page.keyboard.press("End");
    if ((await page.evaluate(() => window.__viz.shownIndex())) !== last) keyProblems.push("End did not show the last step");
    await page.keyboard.press("Home");
    if ((await page.evaluate(() => window.__viz.shownIndex())) !== 0) keyProblems.push("Home did not show the first step");
    await page.keyboard.press(" ");
    await new Promise((r) => setTimeout(r, 250));
    const advanced = await page.evaluate(() => window.__viz.time());
    await page.keyboard.press(" ");
    const paused = await page.evaluate(() => window.__viz.time());
    await new Promise((r) => setTimeout(r, 200));
    const stillPaused = await page.evaluate(() => window.__viz.time());
    if (!(advanced > 0)) keyProblems.push("Space did not start playback");
    if (paused !== stillPaused) keyProblems.push("Space did not pause playback");
    report.add("keyboard", "arrows step and animate, Home/End, Space plays and pauses", keyProblems);
    if (scene.teaching) {
      const problems=[];
      for (const [k,info] of steps.entries()) {
        const prompt=info.teaching?.prediction;
        if (!prompt) continue;
        await page.evaluate(k=>window.__viz.seekStep(k),k);
        await page.focus(".vz-stage");
        await page.keyboard.press("ArrowRight");
        if (await page.evaluate(()=>window.__viz.root.hasAttribute("data-playing"))) problems.push(`step ${k}: next bypassed the prediction`);
        const choices=await page.$$(".vz-predict-options button");
        if (choices.length!==prompt.choices.length) problems.push(`step ${k}: missing choices`);
        const wrong=prompt.choices.findIndex(c=>c!==prompt.answer);
        await choices[Math.max(0,wrong)].focus();
        await page.keyboard.press("Enter");
        const feedback=await page.$eval(".vz-predict-feedback",e=>e.textContent);
        if (!feedback.includes(prompt.answer) || !feedback.includes(prompt.explanation)) problems.push(`step ${k}: feedback does not explain the model answer`);
        await page.keyboard.press("ArrowRight");
        const advanced=await page.waitForFunction(t=>window.__viz.time()===t,{timeout:4000},compiled.restTime(k+1)).then(()=>true,()=>false);
        if (!advanced) problems.push(`step ${k}: cannot continue after answering`);
        await page.evaluate(k=>{window.__viz.seekStep(k-1);window.__viz.play();},k);
        const paused=await page.waitForFunction(t=>window.__viz.time()===t && !window.__viz.root.hasAttribute("data-playing"),{timeout:6000},compiled.restTime(k)).then(()=>true,()=>false);
        if (!paused) problems.push(`step ${k}: playback did not pause before the prediction`);
        await page.evaluate(()=>window.__viz.pause());
      }
      if (steps.some(s=>s.teaching?.prediction)) report.add("prediction","keyboard answers, explanatory feedback, gated next, automatic pause",problems);
    }

    allErrors.push(...errors);
    await page.close();
  }

  // -- Reduced motion: every instant shows a step at rest ------------------------
  {
    const { page, errors } = await openWithPlant({ reduced: true });
    const problems = [];
    const rest = [];
    for (let k = 0; k <= last; k++) {
      await page.evaluate((k) => window.__viz.seekStep(k), k);
      rest.push(await page.evaluate(() => window.__vzCheck.snapshot()));
    }
    for (let k = 1; k <= last; k++) {
      for (const p of [0.3, 0.7]) {
        await page.evaluate((t) => window.__viz.seek(t), tl.start[k] + tl.duration[k] * p);
        const s = await page.evaluate(() => window.__vzCheck.snapshot());
        if (!rest.includes(s)) problems.push(`step ${k - 1}→${k} at ${p} shows an in-between frame`);
      }
    }
    await page.evaluate(() => window.__viz.seekStep(0));
    await page.focus(".vz-stage");
    await page.keyboard.press("ArrowRight");
    await settle(page);
    if ((await page.evaluate(() => window.__viz.time())) !== compiled.restTime(1)) problems.push("ArrowRight did not cut straight to step 1");
    report.add("reduced motion", "no in-between frames; stepping cuts", problems);
    allErrors.push(...errors);
    await page.close();
  }

  // -- Step links -----------------------------------------------------------------
  {
    const k = Math.min(2, last);
    const { page, errors } = await openWithPlant({ hash: `#step=${k}` });
    const got = await page.evaluate(() => window.__viz.shownIndex());
    report.add("step link", `#step=${k} opens at step ${k}`, got === k ? [] : [`opened at step ${got}`]);
    allErrors.push(...errors);
    await page.close();
  }

  // -- Phone and dark: layout, contrast, screenshots ---------------------------------
  const shots = [];
  {
    const layoutProblems = [];
    const darkFaint = new Set();
    for (const theme of ["light", "dark"]) {
      for (const width of [1280, 390]) {
        const { page, errors } = await openWithPlant({ width, height: width < 600 ? 860 : 1000, theme, scale: 2 });
        await page.evaluate((k) => window.__viz.seekStep(k), last);
        await settle(page);
        const scroll = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
        if (scroll > 0) layoutProblems.push(`${width}px ${theme}: page scrolls sideways by ${scroll}px`);
        if (width < 600) {
          for (let k = 0; k <= last; k++) {
            await page.evaluate((k) => window.__viz.seekStep(k), k);
            const lb = await page.evaluate(() => window.__vzCheck.labels());
            for (const list of [lb.overlaps, lb.spill, lb.hidden, lb.clipped, lb.panels, lb.onParts]) list.forEach((s) => layoutProblems.push(`390px step ${k}: ${s}`));
            const tx = await page.evaluate(() => window.__vzCheck.text());
            tx.small.forEach((s) => layoutProblems.push(`390px step ${k}: ${s}`));
          }
          await page.evaluate((k) => window.__viz.seekStep(k), last);
        }
        if (theme === "dark") {
          for (let k = 0; k <= last; k++) {
            await page.evaluate((k) => window.__viz.seekStep(k), k);
            (await page.evaluate(() => window.__vzCheck.text())).faint.forEach((s) => darkFaint.add(s));
          }
          await page.evaluate((k) => window.__viz.seekStep(k), last);
        }
        if (!quick) {
          await settle(page);
          const out = join(shotsDir, `${width < 600 ? "phone" : "desktop"}-${theme}.png`);
          await page.screenshot({ path: out, fullPage: true });
          shots.push(out);
        }
        allErrors.push(...errors);
        await page.close();
      }
    }
    report.add("layout", "1280 and 390 px, both themes: no sideways scroll; labels and text at 390 px", [...new Set(layoutProblems)]);
    report.add("contrast dark", "WCAG ratio, dark theme", [...darkFaint]);
  }

  // -- Contact sheets ----------------------------------------------------------------
  if (!quick) {
    const { page, errors } = await openWithPlant({ width: 1280, height: 1000, scale: 1 });
    const stage = await page.$(".vz-stage");
    const tiles = [];
    for (let k = 0; k <= last; k++) {
      await page.evaluate((k) => window.__viz.seekStep(k), k);
      await settle(page);
      tiles.push({ label: `${k}. ${norm(steps[k].caption)}`, img: await stage.screenshot({ encoding: "base64" }) });
    }
    const motion = [];
    for (let k = 1; k <= last; k++) {
      const row = [];
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        await page.evaluate((t) => window.__viz.seek(t), tl.start[k] + tl.duration[k] * p);
        await settle(page);
        row.push({ label: `${k - 1}→${k} · ${p}`, img: await stage.screenshot({ encoding: "base64" }) });
      }
      motion.push(row);
    }
    allErrors.push(...errors);
    await page.close();

    const sheet = async (title, rows, cols, out, tileWidth) => {
      const p = await browser.newPage();
      await p.setViewport({ width: cols * (tileWidth + 12) + 24, height: 400, deviceScaleFactor: 1 });
      const cells = rows
        .flat()
        .map((t) => `<figure><img src="data:image/png;base64,${t.img}"><figcaption>${t.label.replace(/</g, "&lt;")}</figcaption></figure>`)
        .join("");
      await p.setContent(`<style>body{margin:12px;font:12px/1.35 ui-sans-serif,system-ui;background:#fff;color:#222}
        h1{font-size:14px;margin:0 0 10px}main{display:grid;grid-template-columns:repeat(${cols},${tileWidth}px);gap:12px}
        figure{margin:0}img{width:100%;border:1px solid #ddd;border-radius:6px;background:#fbfaf6}figcaption{margin-top:4px}</style>
        <h1>${title}</h1><main>${cells}</main>`);
      await p.screenshot({ path: out, fullPage: true });
      await p.close();
      shots.push(out);
    };
    await sheet(`${name}: every step at rest`, [tiles], 4, join(shotsDir, "steps.png"), 300);
    await sheet(`${name}: every transition at 0, ¼, ½, ¾, 1`, motion, 5, join(shotsDir, "motion.png"), 220);
  }

  report.add("console", "no errors or uncaught exceptions on any page", [...new Set(allErrors)]);
  if (shots.length) report.add("screenshots", shots.map((s) => relative(ROOT, s)).join(", "));
  return report;
}

// ---- Main ------------------------------------------------------------------------
const browser = await launch();
let failedReports = 0;
try {
  if (flags.has("--controls")) {
    const fixture = join(ROOT, "test/fixtures/faults");
    const variants = await variantsOf(fixture);
    const out = join(ROOT, "shots/controls");
    mkdirSync(out, { recursive: true });
    buildTo(fixture, out);
    const results = [];
    for (const c of CONTROLS) {
      const name = c.variant ?? "clean";
      const scene = variants[name];
      if (!scene) throw new Error(`fixture variant ${name} missing`);
      const report = await verifyPage(browser, {
        name: c.plant ? `planted ${c.plant}` : `variant ${c.variant}`,
        scene,
        file: join(out, `${name}.html`),
        shotsDir: out,
        plant: c.plant,
      });
      const caught = report.failed.some((r) => r.check === c.expect);
      results.push({ control: c.plant ?? c.variant, expect: c.expect, caught, failing: report.failed.map((r) => r.check) });
    }
    // The clean fixture itself must pass, or the controls prove nothing.
    const clean = await verifyPage(browser, { name: "clean fixture", scene: variants.clean, file: join(out, "clean.html"), shotsDir: out });
    const editorial = await verifyPage(browser,{name:"clean editorial fixture",scene:variants.editorial,file:join(out,"editorial.html"),shotsDir:out});
    console.log("\nplanted-fault controls");
    for (const r of results) {
      console.log(`  ${r.caught ? "caught " : "MISSED "} ${r.control.padEnd(16)} expected "${r.expect}"; failing: ${r.failing.join(", ") || "none"}`);
    }
    clean.print();
    editorial.print();
    const missed = results.filter((r) => !r.caught).length;
    if (missed || clean.failed.length || editorial.failed.length) {
      console.log(`\ncontrols: ${missed} missed${clean.failed.length ? ", clean fixture failed" : ""}`);
      process.exitCode = 1;
    } else console.log(`\ncontrols: all ${results.length} planted faults caught; clean fixture passes`);
  } else {
    if (dirs.length === 0) dirs = sceneDirs();
    if (dirs.length === 0) throw new Error("no scenes to verify");
    for (const dir of dirs) {
      const variants = await variantsOf(dir);
      // Screenshots go under the skill's shots/ for its own examples, and next to
      // the scene (<parent>/shots/<name>) for scenes in another project.
      const inside = !relative(join(ROOT, "examples"), dir).startsWith("..");
      const out = shotsArg ? resolve(shotsArg) : inside ? join(ROOT, "shots", relative(join(ROOT, "examples"), dir).replace(/[\\/]/g, "-")) : join(dirname(dir), "shots", basename(dir));
      mkdirSync(out, { recursive: true });
      buildTo(dir, out);
      for (const [name, scene] of Object.entries(variants)) {
        const shotsDir = join(out, name);
        mkdirSync(shotsDir, { recursive: true });
        const report = await verifyPage(browser, { name, scene, file: join(out, `${name}.html`), shotsDir, plant: plantArg });
        report.print();
        writeFileSync(join(shotsDir, "report.json"), JSON.stringify(report.rows, null, 2));
        if (report.failed.length) failedReports++;
      }
    }
    if (failedReports) process.exitCode = 1;
  }
} finally {
  await browser.close();
}
