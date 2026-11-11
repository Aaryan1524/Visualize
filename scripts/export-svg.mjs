#!/usr/bin/env node
// Export one step of a built page as a standalone SVG file.
//
//   node scripts/export-svg.mjs dist/retries.html --step 8 --out retries-8.svg [--theme dark] [--diff diff.png]
//   node scripts/export-svg.mjs dist/retries.html --step 8 --out x.svg --plant drop-text   must fail
//
// Every style the page resolves at runtime (theme tokens, label ink and size,
// facet light) is written onto the elements, so the file needs no stylesheet.
// The export is then checked: the SVG is opened alone in Chrome and compared
// pixel by pixel with the live stage, ignoring one-pixel antialiasing shifts
// and the HTML heading laid over the stage. Exits non-zero above 0.3%.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launch, openPage, settle } from "./lib/browser.mjs";

const args = process.argv.slice(2);
const file = resolve(args.shift() ?? "");
const opt = { step: null, out: null, diff: null, theme: "light", width: 1440, height: 900, tolerance: 0.3, plant: null };
for (let i = 0; i < args.length; i++) opt[args[i].replace(/^--/, "")] = args[++i];
if (!opt.out) throw new Error("--out is required");

const PROPS = [
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "stroke-linecap", "stroke-dasharray",
  "opacity", "display", "visibility", "filter", "paint-order", "vector-effect",
  "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor", "dominant-baseline",
];

const browser = await launch();
try {
  const { page } = await openPage(browser, file, { width: Number(opt.width), height: Number(opt.height), theme: opt.theme, scale: 2 });
  if (opt.step !== null) await page.evaluate((k) => window.__viz.seekStep(k), Number(opt.step));
  await settle(page);

  const { svg, width, height } = await page.evaluate((PROPS, plant) => {
    const source = window.__viz.stage.svg;
    const copy = source.cloneNode(true);
    const a = [source, ...source.querySelectorAll("*")];
    const b = [copy, ...copy.querySelectorAll("*")];
    a.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const style = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
      b[i].setAttribute("style", style);
      b[i].removeAttribute("class");
    });
    // Drop what only the browser needs: the hidden ruler and pointer-only parts.
    for (const r of copy.querySelectorAll('[data-layer="ruler"]')) r.remove();
    // Planted fault for the comparison itself: an export that loses its text must fail.
    if (plant === "drop-text") for (const t of copy.querySelectorAll("text")) t.remove();
    const rect = source.getBoundingClientRect();
    const card = getComputedStyle(source.closest(".vz-stage") ?? document.body).backgroundColor;
    const [x, y, w, h] = source.getAttribute("viewBox").split(/\s+/).map(Number);
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    // The stage letterboxes its viewBox, so the background must fill the whole viewport.
    for (const [k, v] of Object.entries({ x: x - 10 * w, y: y - 10 * h, width: 21 * w, height: 21 * h, fill: card })) bg.setAttribute(k, String(v));
    copy.insertBefore(bg, copy.firstChild);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", String(rect.width));
    copy.setAttribute("height", String(rect.height));
    copy.removeAttribute("style");
    return { svg: new XMLSerializer().serializeToString(copy), width: rect.width, height: rect.height };
  }, PROPS, opt.plant);
  writeFileSync(opt.out, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);

  // Check: the file on its own must look like the live stage.
  // The step heading is HTML laid over the stage, not part of the figure.
  await page.evaluate(() => { for (const e of document.querySelectorAll(".vz-caption")) e.style.visibility = "hidden"; });
  const live = await (await page.$(".vz-svg")).screenshot({ encoding: "base64" });
  const alone = await browser.newPage();
  await alone.setViewport({ width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: 2 });
  await alone.goto(pathToFileURL(resolve(opt.out)).href);
  const exported = await alone.screenshot({ encoding: "base64", clip: { x: 0, y: 0, width, height } });
  // Compare on a plain HTML page: an SVG document has no HTML canvas.
  const cmp = await browser.newPage();
  await cmp.setContent("<!doctype html><title>compare</title>");
  const diff = await cmp.evaluate(async (a, b) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${src}`; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const [da, db] = [px(ia), px(ib)];
    let off = 0;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const out = c.getContext("2d").createImageData(w, h);
    // A pixel differs only if no pixel within one pixel of it in the other image
    // matches: real export errors survive, one-pixel antialiasing shifts do not.
    const close = (i, j) => Math.abs(da[i] - db[j]) + Math.abs(da[i + 1] - db[j + 1]) + Math.abs(da[i + 2] - db[j + 2]) <= 60;
    for (let i = 0; i < da.length; i += 4) {
      const p = i / 4, x = p % w, y = (p - x) / w;
      let bad = true;
      for (let dy = -1; dy <= 1 && bad; dy++)
        for (let dx = -1; dx <= 1 && bad; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && close(i, (yy * w + xx) * 4)) bad = false;
        }
      if (bad) off++;
      out.data[i] = bad ? 255 : da[i] * 0.3 + 178; out.data[i + 1] = bad ? 0 : da[i + 1] * 0.3 + 178; out.data[i + 2] = bad ? 0 : da[i + 2] * 0.3 + 178; out.data[i + 3] = 255;
    }
    c.getContext("2d").putImageData(out, 0, 0);
    return { percent: (100 * off) / (w * h), image: c.toDataURL("image/png").split(",")[1] };
  }, live, exported).then((r) => {
    if (opt.diff) writeFileSync(opt.diff, Buffer.from(r.image, "base64"));
    return r.percent;
  });
  // Structure: the file must carry the same drawn text, in order, and the same shapes.
  const inventory = (root) => ({
    text: [...root.querySelectorAll("text")].filter((t) => t.textContent.trim() && t.getAttribute("display") !== "none" && !/display:\s*none/.test(t.getAttribute("style") ?? "")).map((t) => t.textContent.trim()),
    shapes: root.querySelectorAll("polygon, polyline, path, line, circle, ellipse").length,
  });
  const liveInv = await page.evaluate(`(${inventory.toString()})(window.__viz.stage.svg)`);
  const fileInv = await cmp.evaluate((xml, fn) => (0, eval)(`(${fn})`)(new DOMParser().parseFromString(xml, "image/svg+xml").documentElement), svg, inventory.toString());
  const missingText = liveInv.text.filter((t, i) => fileInv.text[i] !== t);
  const structural = [];
  if (missingText.length || liveInv.text.length !== fileInv.text.length) structural.push(`text differs: live ${liveInv.text.length} labels, file ${fileInv.text.length}`);
  if (fileInv.shapes < liveInv.shapes) structural.push(`file has ${fileInv.shapes} shapes, live stage ${liveInv.shapes}`);
  const ok = diff <= Number(opt.tolerance) && structural.length === 0;
  console.log(`wrote ${opt.out} · ${(svg.length / 1024).toFixed(0)} KB · ${liveInv.text.length} labels, ${fileInv.shapes} shapes · differs from the live stage at ${diff.toFixed(2)}% of pixels${diff > Number(opt.tolerance) ? ` (max ${opt.tolerance}%)` : ""}`);
  for (const p of structural) console.log(`  ${p}`);
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}
