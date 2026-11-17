#!/usr/bin/env node
// Screenshots of the derailleur page, including moments scripts/shoot.mjs cannot reach (the lab,
// an answered prediction, a time inside a step) and close-ups at 4x.
//
//   node examples/derailleur/shots.mjs                      every moment in MOMENTS, light and dark
//   node examples/derailleur/shots.mjs --only plain         the moments matched to the plain page's shots
//   node examples/derailleur/shots.mjs --step 5 --clip 380,150,520,580 --scale 4 --theme dark --name close
//   node examples/derailleur/shots.mjs --lab gear=11,err=2,lout=9 --name spokes
//   node examples/derailleur/shots.mjs --only step                every step, both What ifs, two camera moves
//   node examples/derailleur/shots.mjs --check-fresh              fail if any shot is older than the page
//
// Writes PNGs to examples/derailleur/shots/ (or --out <dir>) and prints each one's time. A shot older
// than the page it was taken of shows a page that no longer exists: --check-fresh lists those and fails.

import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openPage, settle } from "../../scripts/lib/browser.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const page = resolve(opt("page", join(HERE, "../../dist/derailleur.html")));
const outDir = resolve(opt("out", join(HERE, "shots")));
mkdirSync(outDir, { recursive: true });
// local time, as `ls -l` shows it
const stamp = (f) => new Date(statSync(f).mtimeMs - new Date().getTimezoneOffset() * 60000).toISOString().replace("T", " ").slice(0, 19);
if (args.includes("--check-fresh")) {
  const built = statSync(page).mtimeMs;
  const stale = readdirSync(outDir).filter((f) => f.endsWith(".png") && statSync(join(outDir, f)).mtimeMs < built);
  for (const f of stale) console.log(`stale: ${f} (${stamp(join(outDir, f))}) is older than ${page} (${stamp(page)})`);
  console.log(stale.length ? `shots: ${stale.length} older than the page; take them again` : `shots: all newer than the page (${stamp(page)})`);
  process.exit(stale.length ? 1 : 0);
}

// The stage at 1440 x 900 is about x 62..1378, y 148..748.
const STAGE = [62, 148, 1316, 600];
const MOMENTS = [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ name: `step-${k}`, step: k })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ name: `wide-step-${k}`, step: k, variant: "wide" })),
  // halfway through the first two voice-led camera moves
  { name: "step-move-1", move: 0 },
  { name: "step-move-2", move: 1 },
  { name: "step-5-answered", step: 5, answer: 0 },
  { name: "lab-slack-rubs", lab: { gear: 6, err: -1 } },
  { name: "lab-over-pull-held", lab: { gear: 11, err: 2, lout: 0 } },
  { name: "lab-l-screw-out-spokes", lab: { gear: 11, err: 3, lout: 6 } },
  { name: "practice", practice: 3 },
  // the plain page's six shots, at the same moments
  { name: "plain-01-overview", step: 1, group: "plain" },
  { name: "plain-02-cable-vs-spring", step: 3, group: "plain" },
  { name: "plain-03-cage-moved-chain-waits", step: 4, group: "plain" },
  { name: "plain-04-slack-smallest-cog", lab: { gear: 1, err: 0 }, group: "plain" },
  { name: "plain-05-slack-largest-cog", lab: { gear: 11, err: 0 }, group: "plain" },
  { name: "plain-06-L-screw-out-overtravel", lab: { gear: 11, err: 3, lout: 6 }, group: "plain" },
  // 4x close-ups of the figure
  { name: "close-parts", step: 1, clip: [430, 180, 420, 560], scale: 4 },
  { name: "close-slack", step: 5, clip: [430, 180, 420, 560], scale: 4, answer: 0 },
  { name: "close-viewA", step: 7, clip: [1010, 160, 330, 340], scale: 4 },
];

let list = MOMENTS;
if (args.includes("--step") || args.includes("--lab") || args.includes("--time")) {
  const lab = opt("lab") && Object.fromEntries(opt("lab").split(",").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)]));
  list = [{ name: opt("name", "shot"), step: opt("step") !== undefined ? Number(opt("step")) : null, time: opt("time") !== undefined ? Number(opt("time")) : null, lab, variant: opt("variant"), clip: opt("clip") && opt("clip").split(",").map(Number), scale: Number(opt("scale", 2)), answer: opt("answer") !== undefined ? Number(opt("answer")) : null }];
} else if (opt("only")) list = MOMENTS.filter((m) => m.group === opt("only") || m.name.includes(opt("only")));
const themes = opt("theme") ? [opt("theme")] : ["light", "dark"];

const browser = await launch();
try {
  for (const theme of themes)
    for (const m of list) {
      const { page: p, errors } = await openPage(browser, page, { width: 1440, height: 900, theme, scale: m.scale ?? 2 });
      if (m.variant) await p.evaluate((v) => window.__viz.variant(v), m.variant);
      if (m.answer !== undefined && m.answer !== null) await p.evaluate((a) => (window.__viz.seekStep(4), window.__viz.answer(a)), m.answer);
      if (m.step !== undefined && m.step !== null) await p.evaluate((k) => window.__viz.seekStep(k), m.step);
      if (m.time !== undefined && m.time !== null) await p.evaluate((t) => window.__viz.seek(t), m.time);
      if (m.move !== undefined) {
        const at = await p.evaluate((i) => {
          const mv = window.__viz.camera().tracks.flatMap((t) => t.moves).filter((x) => x.ids.length)[i];
          if (mv) window.__viz.seek((mv.t0 + mv.d / 2) * 1000);
          return mv && `${mv.t0 + mv.d / 2} s, to ${mv.ids.join(", ")}`;
        }, m.move);
        console.log(`${m.name}: ${at ?? "no such move"}`);
      }
      if (m.lab) await p.evaluate((v) => window.__viz.lab(v), m.lab);
      if (m.practice !== undefined) await p.evaluate((n) => window.__viz.practice(n), m.practice);
      await settle(p);
      await new Promise((r) => setTimeout(r, 120));
      const [x, y, w, h] = m.clip ?? [0, 0, 1440, 900];
      const file = join(outDir, `${m.name}${themes.length > 1 || theme === "dark" ? "-" + theme : ""}.png`);
      await p.screenshot({ path: file, clip: { x, y, width: w, height: h } });
      console.log(`wrote ${file} at ${stamp(file)}${errors.length ? "  ERRORS: " + errors.join(" | ") : ""}`);
      await p.close();
    }
} finally {
  await browser.close();
}
