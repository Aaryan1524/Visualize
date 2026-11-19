#!/usr/bin/env node
// Shoot every state a reader can reach on a Drawing page, so you look at the page as built, not at
// yesterday's: every step of every What if variant in light and dark, the lab at its starting values and
// at each input's ends, and Now you try. Each file is printed with its time.
//
//   node scripts/shoot-steps.mjs dist/<name>.html                 into dist/shots/<name>/
//   node scripts/shoot-steps.mjs dist/<name>.html --out <dir> --scale 2 --themes light
//   node scripts/shoot-steps.mjs dist/<name>.html --check-fresh   fail unless every shot is newer than the page
//
// Then open the images and look at each one. A check passes a frame that reads wrong (the camera's
// first version did); only looking catches that.

import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { drawingPageProblem, launch, openPage, settle } from "./lib/browser.mjs";
import { reportFreshness, stamp } from "./lib/fresh.mjs";

const args = process.argv.slice(2);
const page = args.find((a) => !a.startsWith("--") && !/^\d/.test(a) && a.endsWith(".html"));
if (!page) {
  console.error("usage: node scripts/shoot-steps.mjs <built page.html> [--out dir] [--scale n] [--themes light,dark] [--check-fresh]");
  process.exit(2);
}
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const name = basename(page, ".html");
const out = resolve(opt("out", join(dirname(page), "shots", name)));
if (args.includes("--check-fresh")) process.exit(reportFreshness(out, resolve(page)));

const scale = Number(opt("scale", 1)), themes = opt("themes", "light,dark").split(",");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith(".png")) rmSync(join(out, f)); // no old shots left to mislead
const browser = await launch();
{
  const problem = await drawingPageProblem(browser, page);
  if (problem) {
    console.log(`shoot-steps: ${problem}`);
    await browser.close();
    process.exit(2);
  }
}
let n = 0, first = null, last = null, failed = 0;
try {
  for (const theme of themes) {
    const { page: p, errors } = await openPage(browser, resolve(page), { width: 1440, height: 900, theme, scale });
    const shot = async (label) => {
      await settle(p);
      await new Promise((r) => setTimeout(r, 120));
      // a camera still easing (to the lab's framing) would shoot a frame nobody stops on
      await p.waitForFunction(() => !window.__viz.camera?.().blending, { timeout: 4000 }).catch(() => {});
      const file = join(out, `${label}-${theme}.png`);
      await p.screenshot({ path: file });
      const t = stamp(file);
      first ??= t;
      last = t;
      n++;
      console.log(`wrote ${file} at ${t}`);
    };
    const info = await p.evaluate(() => ({ steps: window.__viz.steps, variants: window.__viz.variants ?? [], inputs: window.__viz.labInputs?.() ?? [] }));
    for (const v of info.variants.length ? info.variants : [null]) {
      if (v) await p.evaluate((v) => window.__viz.variant(v), v);
      const tag = v ? `${v}-` : "";
      for (let k = 0; k < info.steps; k++) {
        await p.evaluate((k) => window.__viz.seekStep(k), k);
        await shot(`${tag}step-${k}`);
      }
      if (info.inputs.length) {
        await p.evaluate(() => window.__viz.lab({}));
        await shot(`${tag}lab`);
        for (const inp of info.inputs)
          for (const [end, val] of inp.type === "text" ? (inp.samples ?? []).map((s, i) => [`sample${i + 1}`, s]) : [["min", inp.min], ["max", inp.max]]) {
            await p.evaluate((id, val) => window.__viz.lab({ [id]: val }), inp.id, val);
            await shot(`${tag}lab-${inp.id}-${end}`);
            await p.evaluate((id, val) => window.__viz.lab({ [id]: val }), inp.id, inp.value);
          }
        await p.evaluate(() => window.__viz.closeLab());
      }
    }
    if (info.variants.length) await p.evaluate((v) => window.__viz.variant(v), info.variants[0]);
    await p.evaluate(() => window.__viz.practice(3));
    await shot("practice");
    if (errors.length) (failed++, console.log(`console errors (${theme}): ${[...new Set(errors)].join(" | ")}`));
    await p.close();
  }
} finally {
  await browser.close();
}
console.log(`shots: ${n} written to ${out}, ${first} to ${last}. Look at every one.`);
process.exit(failed ? 1 : reportFreshness(out, resolve(page), () => {}));
