// Build each look sample into one standalone HTML file (fonts and code inline).
import { build } from "esbuild";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const FONTS = "/Users/aaryan/Documents/Projects/Visualize/src/render/fonts";
const font = (f) => readFileSync(`${FONTS}/${f}`).toString("base64");
const fontCss = `
@font-face { font-family: "Sample Sans"; font-weight: 400 700; src: url(data:font/woff2;base64,${font("manrope-latin.woff2")}) format("woff2"); }
@font-face { font-family: "Sample Mono"; font-weight: 500; src: url(data:font/woff2;base64,${font("ibm-plex-mono-latin-500.woff2")}) format("woff2"); }`;

const base = `
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { background: var(--page); color: var(--ink); font: 400 15px/1.5 "Sample Sans", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
#app { height: 100vh; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; padding: 22px 32px 18px; gap: 12px; max-width: 1500px; margin: 0 auto; }
.head .kicker { font-size: 12px; letter-spacing: .02em; color: var(--ink-2); }
.head h1 { margin: 2px 0 0; font-size: 28px; font-weight: 600; letter-spacing: -.025em; }
.stage { position: relative; border-radius: 18px; overflow: hidden; background: var(--stage); box-shadow: var(--stage-shadow); }
.stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.labels { position: absolute; inset: 0; pointer-events: none; }
.num { position: absolute; left: 0; top: 0; font: 600 17px "Sample Sans", sans-serif; font-variant-numeric: tabular-nums; color: var(--num); opacity: calc(1 - var(--gone, 0) * .72); transition: color .25s, transform 0s; white-space: nowrap; will-change: transform; }
.num.mid { color: var(--num-mid); }
.num.found { color: var(--num-found); font-size: 20px; }
.num.lit { color: var(--num-lit); text-shadow: var(--lit-glow); }
.marker { position: absolute; left: 0; top: 0; transition: opacity .35s; will-change: transform; }
.marker span { display: inline-block; font: 500 12px "Sample Mono", monospace; padding: 2px 8px; border-radius: 999px; background: var(--chip); color: var(--chip-ink); box-shadow: var(--chip-shadow); }
.marker-mid span { background: var(--accent); color: var(--accent-ink); }
.hud { position: absolute; right: 18px; top: 16px; display: flex; gap: 18px; font-size: 13px; color: var(--ink-2); transition: color .2s; }
.hud b { font: 600 22px "Sample Sans"; color: var(--ink); margin-right: 4px; font-variant-numeric: tabular-nums; }
.hud.lit b, .target.lit b { color: var(--num-lit); }
.target { position: absolute; left: 18px; top: 16px; font-size: 13px; color: var(--ink-2); padding: 6px 12px; border-radius: 10px; background: var(--chip); }
.target b { font-size: 18px; color: var(--ink); margin-left: 4px; }
.caption { min-height: 64px; display: flex; align-items: center; }
.say { margin: 0; font-size: 22px; line-height: 1.45; letter-spacing: -.01em; max-width: 60em; }
.say .linked { color: var(--link); text-decoration: underline; text-decoration-color: color-mix(in oklab, var(--link) 35%, transparent); text-underline-offset: 5px; cursor: default; }
.say .spoken { background: var(--spoken); border-radius: 4px; box-shadow: 0 0 0 3px var(--spoken); }
.controls { display: flex; align-items: center; gap: 10px; }
.controls button { font: 500 14px "Sample Sans"; color: var(--ink); background: var(--btn); border: 1px solid var(--hair); border-radius: 10px; padding: 9px 14px; cursor: pointer; }
.controls button.primary { background: var(--ink); color: var(--page); border-color: var(--ink); min-width: 132px; }
.controls .voice { margin-left: auto; }
.dots { display: flex; gap: 6px; list-style: none; margin: 0 0 0 10px; padding: 0; }
.dots button { padding: 6px 9px; font-size: 12px; color: var(--ink-2); background: transparent; border-color: transparent; }
.dots li[data-current] button { color: var(--ink); border-color: var(--hair); background: var(--btn); }
@media (max-width: 760px) { #app { padding: 14px; } .head h1 { font-size: 21px; } .say { font-size: 17px; } .dots span { display: none; } .dots button::after { content: "•"; } .num { font-size: 13px; } }`;

const voice = existsSync("voice/voice.json") ? readFileSync("voice/voice.json", "utf8") : null;
const looks = {
  clay: `:root { --page: #f4ece1; --stage: radial-gradient(120% 90% at 50% 20%, #fbf5ec 0%, #f0e4d4 100%); --stage-shadow: inset 0 0 0 1px #e6d6c1; --ink: #2f261f; --ink-2: #7a6a5b; --num: #3b3027; --num-mid: #fff8f2; --num-found: #fffaf3; --num-lit: #c4532e; --lit-glow: none; --chip: #fff8ef; --chip-ink: #5b4a3c; --chip-shadow: 0 1px 2px #8a6c4b33; --accent: #e0714c; --accent-ink: #fff; --link: #b4532f; --spoken: #ffd9c2; --btn: #fffaf3; --hair: #e3d3be; }`,
  glass: `:root { --page: #060b16; --stage: radial-gradient(110% 90% at 50% 10%, #12213d 0%, #070d1a 70%); --stage-shadow: inset 0 0 0 1px #1a2a47; --ink: #e8f1ff; --ink-2: #8ea4c6; --num: #eaf6ff; --num-mid: #ffd28a; --num-found: #9dffc9; --num-lit: #ffffff; --lit-glow: 0 0 12px #6fd8ff, 0 0 2px #fff; --chip: #0f1d36cc; --chip-ink: #bfe3ff; --chip-shadow: 0 0 0 1px #2a4c7a; --accent: #ffb547; --accent-ink: #1b1305; --link: #7fdcff; --spoken: #1f4a70; --btn: #0e1a31; --hair: #22385c; }
.num { text-shadow: 0 0 8px #4fd1ff88; }`,
  paper: `:root { --page: #ece6d8; --stage: #f6f1e6; --stage-shadow: 0 1px 0 #d7ccb6, 0 12px 30px -18px #5a4a2a55, inset 0 0 0 1px #e1d7c3; --ink: #25304a; --ink-2: #6d6a62; --num: #25304a; --num-mid: #2f5fb3; --num-found: #c63d2f; --num-lit: #c63d2f; --lit-glow: none; --chip: #fffdf6; --chip-ink: #25304a; --chip-shadow: 0 0 0 1px #25304a; --accent: #2f5fb3; --accent-ink: #fff; --link: #c63d2f; --spoken: #ffe9a8; --btn: #fffdf7; --hair: #d6ccb8; }
.head h1, .say { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-weight: 600; }
.marker span { font-family: "Sample Mono"; }`,
};

mkdirSync("dist", { recursive: true });
for (const [name, css] of Object.entries(looks).filter(([n]) => n !== "glass")) {
  const r = await build({ entryPoints: [`src/${name}.ts`], bundle: true, write: false, format: "iife", minify: true, target: "es2022" });
  const js = r.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Binary search · ${name}</title><style>${fontCss}${base}${css}</style></head><body><div id="app"></div>${voice ? `<script>window.__VOICE=${voice}</script>` : ""}<script>${js}</script></body></html>`;
  writeFileSync(`dist/${name}.html`, html);
  console.log(`dist/${name}.html ${(html.length / 1024).toFixed(0)} KB`);
}
