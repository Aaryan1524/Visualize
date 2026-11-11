#!/usr/bin/env node
// Bundle each scene into one standalone HTML file that opens from disk.
//
//   node scripts/build.mjs                      every examples/*/scene.ts
//   node scripts/build.mjs examples/lru         one scene directory
//   node scripts/build.mjs path --out dir       write somewhere else (default dist/)

import { build } from "esbuild";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLAYER = join(ROOT, "src/render/player.ts");
const CSS = join(ROOT, "src/render/styles.css");
const KATEX_DIR = join(ROOT, "node_modules/katex/dist");

const args = process.argv.slice(2);
let outDir = join(ROOT, "dist");
const dirs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") outDir = resolve(args[++i]);
  else dirs.push(resolve(args[i]));
}
if (dirs.length === 0) {
  const ex = join(ROOT, "examples");
  if (existsSync(ex)) {
    for (const name of readdirSync(ex).sort()) {
      if (existsSync(join(ex, name, "scene.ts"))) dirs.push(join(ex, name));
    }
  }
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** KaTeX's stylesheet with only the woff2 fonts, inlined as data URIs. */
function katexCss() {
  const css = readFileSync(join(KATEX_DIR, "katex.min.css"), "utf8");
  return css.replace(/src:([^;}]+)/g, (whole, list) => {
    const m = /url\(fonts\/([^)]+\.woff2)\)/.exec(list);
    if (!m) return whole;
    const data = readFileSync(join(KATEX_DIR, "fonts", m[1])).toString("base64");
    return `src:url(data:font/woff2;base64,${data}) format("woff2")`;
  });
}

async function buildOne(dir) {
  const scenePath = join(dir, "scene.ts");
  const mod = await import(pathToFileURL(scenePath).href);
  const scene = mod.default;
  if (!scene || typeof scene.trace !== "function") throw new Error(`${relative(ROOT, scenePath)}: default export is not a scene`);
  const files = mod.variants ?? { [scene.id]: scene };

  const { compile } = await import(pathToFileURL(join(ROOT, "src/core/scene.ts")).href);
  const written = [];

  for (const [name, variant] of Object.entries(files)) {
    const exportName = name === scene.id ? "default" : `variants[${JSON.stringify(name)}]`;
    const entry = `import * as m from ${JSON.stringify(scenePath)};
import { mount } from ${JSON.stringify(PLAYER)};
const scene = ${exportName === "default" ? "m.default" : `m.${exportName}`};
mount(document.getElementById("app"), scene);`;

    const result = await build({
      stdin: { contents: entry, resolveDir: dir, loader: "ts", sourcefile: "entry.ts" },
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2022",
      minify: true,
      write: false,
      metafile: true,
      legalComments: "none",
    });
    const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
    const usesKatex = Object.keys(result.metafile.inputs).some((p) => p.includes("node_modules/katex"));
    const css = readFileSync(CSS, "utf8") + (usesKatex ? "\n" + katexCss() : "");

    // A text version of every step for readers without scripts.
    const compiled = compile(variant);
    const steps = compiled.steps
      .map((s) => `<li>${escapeHtml(s.caption)}${s.readout ? ` (${escapeHtml(s.readout)})` : ""}</li>`)
      .join("");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>${escapeHtml(variant.title)}</title>
<meta name="description" content="${escapeHtml(variant.question)}">
<style>${css}</style>
</head>
<body>
<main id="app"></main>
<noscript><h1>${escapeHtml(variant.question)}</h1><ol start="0">${steps}</ol></noscript>
<script>${js}</script>
</body>
</html>
`;
    mkdirSync(outDir, { recursive: true });
    const out = join(outDir, `${name}.html`);
    writeFileSync(out, html);
    written.push({ name, title: variant.title, question: variant.question, out, bytes: Buffer.byteLength(html) });
  }
  return written;
}

const all = [];
for (const dir of dirs) {
  const written = await buildOne(dir);
  for (const w of written) {
    console.log(`built ${relative(ROOT, w.out)}  ${(w.bytes / 1024).toFixed(0)} KB`);
    all.push(w);
  }
}

if (all.length > 1 || (all.length && outDir === join(ROOT, "dist"))) {
  const css = readFileSync(CSS, "utf8");
  const cards = all
    .map((w) => `<li><a href="${escapeHtml(basename(w.out))}"><strong>${escapeHtml(w.title)}</strong><span>${escapeHtml(w.question)}</span></a></li>`)
    .join("");
  writeFileSync(
    join(outDir, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Visualize examples</title><style>${css}
.gallery{max-width:760px;margin:0 auto}.gallery h1{font-size:22px;font-weight:600}.gallery ul{list-style:none;padding:0;display:grid;gap:12px}
.gallery a{display:grid;gap:4px;padding:16px 18px;border:1px solid var(--hair);border-radius:12px;background:var(--card);color:var(--ink);text-decoration:none}
.gallery a:hover{border-color:var(--ink-2)}.gallery span{color:var(--ink-2);font-size:14px}</style></head>
<body><main class="gallery"><h1>Visualize examples</h1><ul>${cards}</ul></main></body></html>
`,
  );
}

if (all.length === 0) {
  console.error("nothing to build: no scene directories found");
  process.exit(1);
}
