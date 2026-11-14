#!/usr/bin/env node
// Check that figures embed: two in one React app, each themed on its own root,
// the host page's hash, globals and styles untouched, and unmounting cleans up.
import { build } from "esbuild";
import { bundledStyles } from "./lib/styles.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(ROOT, "shots/embed");
mkdirSync(out, { recursive: true });
const js = (await build({ entryPoints: [join(ROOT, "test/embed/app.tsx")], bundle: true, write: false, format: "iife", jsx: "automatic", minify: true, define: { "process.env.NODE_ENV": '"production"' } })).outputFiles[0].text;
const css = await bundledStyles();
// Maths scenes also need KaTeX's stylesheet (with its fonts beside it).
const katex = pathToFileURL(join(ROOT, "node_modules/katex/dist/katex.min.css")).href;
const plant = process.argv.includes("--plant-page") ? "page" : "";
const file = join(out, plant ? "planted.html" : "index.html");
writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;background:rgb(255, 0, 255)}</style><link rel="stylesheet" href="${katex}"><style>${css}</style><script>window.__plant=${JSON.stringify(plant)}</script></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`);

const problems = [];
const browser = await launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewport({ width: 1440, height: 1800 });
  await page.goto(pathToFileURL(file).href + "#host=1");
  const expected = plant ? 4 : 3;
  await page.waitForFunction((n) => document.querySelectorAll(".vz").length === n, { timeout: 5000 }, expected);
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.fonts.ready);
  const s = await page.evaluate(() => ({
    figures: document.querySelectorAll(".vz").length,
    themes: [...document.querySelectorAll(".vz")].map((v) => v.dataset.theme),
    cards: [...document.querySelectorAll(".vz-card")].map((c) => getComputedStyle(c).backgroundColor),
    hash: location.hash,
    global: "__viz" in window,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    headingFont: getComputedStyle(document.getElementById("host-heading")).fontFamily,
    fonts: [...document.fonts].filter(f => /^Visualize/.test(f.family.replace(/["']/g, ""))).map(f => ({family:f.family,status:f.status})),
    svgs: document.querySelectorAll(".vz-svg").length,
    maths: [...document.querySelectorAll(".vz .katex-html")].filter((k) => k.getBoundingClientRect().width > 20).length,
    katexFont: (() => { const k = document.querySelector(".vz .katex"); return k ? getComputedStyle(k).fontFamily : ""; })(),
  }));
  // Sans and Mono must load; the display face (titles) loads only when a figure shows a title.
  const need = ["Visualize Sans", "Visualize Mono"];
  const ok = need.every((n) => s.fonts.some((f) => f.family.replace(/["']/g, "") === n && f.status === "loaded"));
  if (!ok || s.fonts.length < 2 || s.fonts.some((f) => /Sans|Mono/.test(f.family) && f.status !== "loaded")) problems.push("bundled figure fonts did not load");
  if (s.figures !== expected || s.svgs !== expected) problems.push(`expected ${expected} figures, found ${s.figures}`);
  if (s.themes.slice(0, 3).join() !== "light,dark,light") problems.push(`themes ${s.themes.join()}`);
  if (s.maths < 1) problems.push("the attention figure's equations did not render");
  if (!/KaTeX/.test(s.katexFont)) problems.push(`equations are not using KaTeX fonts (${s.katexFont})`);
  if (s.cards[0] === s.cards[1]) problems.push("both figures have the same card colour; themes are not scoped");
  if (s.hash !== "#host=1") problems.push(`host hash changed to ${s.hash}`);
  if (s.global) problems.push("window.__viz was published by an embedded figure");
  if (s.bodyBg !== "rgb(255, 0, 255)") problems.push(`host body background changed to ${s.bodyBg}`);
  if (!/Georgia/.test(s.headingFont)) problems.push(`host heading font changed to ${s.headingFont}`);
  await page.screenshot({ path: join(out, "two-figures.png"), fullPage: true });
  // Step the first figure with its own controls; the second must not move.
  await page.click(".vz:nth-of-type(1) [data-action='next']");
  await new Promise((r) => setTimeout(r, 1600));
  const counts = await page.evaluate(() => [...document.querySelectorAll(".vz-count")].map((c) => c.textContent));
  if (!counts[0]?.startsWith("01")) problems.push(`stepping the first figure did not move it to step 01 (${counts.join(" / ")})`);
  if (!counts[1]?.startsWith("00")) problems.push(`the second figure moved when the first was stepped (${counts.join(" / ")})`);
  await page.evaluate(() => window.__unmountSecond());
  await new Promise((r) => setTimeout(r, 200));
  const after = await page.evaluate(() => document.querySelectorAll(".vz").length);
  if (after !== expected - 1) problems.push(`after unmounting one, ${after} figures remain (expected ${expected - 1})`);
  problems.push(...errors.map((e) => `console: ${e}`));
} finally {
  await browser.close();
}
console.log(problems.length ? `embed${plant ? " (planted page mode)" : ""}: FAILED\n${problems.map((p) => `  - ${p}`).join("\n")}` : "embed: passed (three figures incl. maths, scoped themes, host untouched, step isolation, clean unmount)");
if (problems.length) process.exitCode = 1;
