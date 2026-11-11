#!/usr/bin/env node
// Check that figures embed: two in one React app, each themed on its own root,
// the host page's hash, globals and styles untouched, and unmounting cleans up.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "./lib/browser.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(ROOT, "shots/embed");
mkdirSync(out, { recursive: true });
const js = (await build({ entryPoints: [join(ROOT, "test/embed/app.tsx")], bundle: true, write: false, format: "iife", jsx: "automatic", minify: true, define: { "process.env.NODE_ENV": '"production"' } })).outputFiles[0].text;
const css = readFileSync(join(ROOT, "src/render/styles.css"), "utf8");
const file = join(out, "index.html");
writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;background:rgb(255, 0, 255)}</style><style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`);

const problems = [];
const browser = await launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewport({ width: 1440, height: 1800 });
  await page.goto(pathToFileURL(file).href + "#host=1");
  await page.waitForFunction(() => document.querySelectorAll(".vz").length === 2, { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 300));
  const s = await page.evaluate(() => ({
    figures: document.querySelectorAll(".vz").length,
    themes: [...document.querySelectorAll(".vz")].map((v) => v.dataset.theme),
    cards: [...document.querySelectorAll(".vz-card")].map((c) => getComputedStyle(c).backgroundColor),
    hash: location.hash,
    global: "__viz" in window,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    headingFont: getComputedStyle(document.getElementById("host-heading")).fontFamily,
    svgs: document.querySelectorAll(".vz-svg").length,
  }));
  if (s.figures !== 2 || s.svgs !== 2) problems.push(`expected 2 figures, found ${s.figures}`);
  if (s.themes.join() !== "light,dark") problems.push(`themes ${s.themes.join()}`);
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
  if (counts[0] === counts[1] && counts[0]?.startsWith("00")) problems.push(`stepping the first figure did not move it (${counts.join(" / ")})`);
  if (!counts[1]?.startsWith("00")) problems.push(`the second figure moved when the first was stepped (${counts.join(" / ")})`);
  await page.evaluate(() => window.__unmountSecond());
  await new Promise((r) => setTimeout(r, 200));
  const after = await page.evaluate(() => document.querySelectorAll(".vz").length);
  if (after !== 1) problems.push(`after unmounting, ${after} figures remain`);
  problems.push(...errors.map((e) => `console: ${e}`));
} finally {
  await browser.close();
}
console.log(problems.length ? `embed: FAILED\n${problems.map((p) => `  - ${p}`).join("\n")}` : "embed: passed (two figures, scoped themes, host untouched, step isolation, clean unmount)");
if (problems.length) process.exitCode = 1;
