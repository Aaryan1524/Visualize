#!/usr/bin/env node
// Screenshot a built page at a step or a time.
//
//   node scripts/shoot.mjs dist/lru.html --out shots/lru.png
//   node scripts/shoot.mjs dist/lru.html --out shots/lru-4.png --step 4 --width 390 --theme dark
//   node scripts/shoot.mjs dist/lru.html --out shots/mid.png --time 5200
//   node scripts/shoot.mjs dist/lru.html --out shots/stage.png --select .vz-stage
//   node scripts/shoot.mjs dist/lru.html --out shots/close.png --step 4 --select .vz-stage --scale 4   the 4× review
//   node scripts/shoot.mjs dist/attention.html --out shots/hover.png --step 6 --hover '[data-key="w-2-1"]'

import { resolve } from "node:path";
import { launch, openPage, settle } from "./lib/browser.mjs";

const args = process.argv.slice(2);
const opt = { width: 1280, height: 1000, theme: "light", reduced: false, select: null, step: null, time: null, hover: null, out: "shot.png", scale: 2 };
const file = resolve(args.shift() ?? "");
for (let i = 0; i < args.length; i++) {
  const k = args[i].replace(/^--/, "");
  if (k === "reduced") opt.reduced = true;
  else opt[k] = args[++i];
}

const browser = await launch();
try {
  const { page, errors } = await openPage(browser, file, {
    width: Number(opt.width),
    height: Number(opt.height),
    theme: opt.theme,
    reduced: opt.reduced,
    scale: Number(opt.scale),
  });
  if (opt.step !== null) await page.evaluate((k) => window.__viz.seekStep(k), Number(opt.step));
  if (opt.time !== null) await page.evaluate((t) => window.__viz.seek(t), Number(opt.time));
  await settle(page);
  if (opt.hover) {
    const target = await page.$(opt.hover);
    if (!target) throw new Error(`no element matches ${opt.hover}`);
    await target.hover();
    await settle(page);
  }
  if (opt.select) {
    const el = await page.$(opt.select);
    if (!el) throw new Error(`no element matches ${opt.select}`);
    await el.screenshot({ path: opt.out });
  } else await page.screenshot({ path: opt.out, fullPage: true });
  console.log(`wrote ${opt.out}`);
  if (errors.length) {
    console.log(errors.join("\n"));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
