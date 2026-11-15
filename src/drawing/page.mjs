// The Drawing page: Visualize's card, step tabs, stage, readouts, controls and Details drawer
// around one machine's drawing, with the shared player (player.mjs) inlined. Build-time only;
// the page it writes has no dependencies.
//
//   import { drawingPage } from "../../src/drawing/page.mjs";
//   writeFileSync(out, drawingPage({ ... }));
//
// See references/drawing.md for what each field is for, and examples/escalator/build.mjs and
// examples/lock/build.mjs for two complete pages.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { player } from "./player.mjs";
import { audit, textsOf } from "../claims/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "../render/fonts");
const font = (f) => readFileSync(join(FONTS, f)).toString("base64");

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The shared page chrome: fonts, tokens, card, stage, cards, controls and drawer. */
export const chromeCss = () => readFileSync(join(HERE, "chrome.css"), "utf8").replace(/\$\{font\("([^"]+)"\)\}/g, (_, f) => font(f));

export const icon = {
  prev: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h2v12H3zM14 2v12L6 8z"/></svg>`,
  next: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2h2v12h-2zM2 2v12l8-6z"/></svg>`,
  play: `<svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z"/></svg>`,
  pause: `<svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>`,
  restart: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3a5 5 0 1 1-4.9 6h1.7A3.4 3.4 0 1 0 8 4.6V7L4.5 3.8 8 .6z"/></svg>`,
};

// The lab: the reader's own values in, the model's verdict out. It sits where Now you try sits.
function labPanel(lab) {
  if (!lab) return "";
  const row = (i) => `<label class="vz-lab-input"><span>${esc(i.label)}</span><input type="range" data-id="${i.id}" min="${i.min}" max="${i.max}" step="${i.step ?? 1}" value="${i.value}" aria-label="${esc(i.label)}"><b id="lab-v-${i.id}">${i.value}</b></label>`;
  return `
        <section class="vz-predict vz-practice vz-lab" id="lab" aria-label="${esc(lab.title)}" hidden><span class="vz-predict-kicker">${esc(lab.title)}</span><p>${esc(lab.intro)}</p><div class="vz-lab-inputs">${lab.inputs.map(row).join("")}</div><p class="vz-lab-verdict" id="lab-verdict" aria-live="polite"></p><ul class="vz-lab-rows" id="lab-rows"></ul></section>`;
}

/**
 * @param {object} o
 * @param {string} o.title        page and card title ("Escalator")
 * @param {string} o.about        one line under the title
 * @param {string} o.scene        data-scene name
 * @param {{tab: string|null}[]} o.steps   step 0 is the concept (no tab); every later step has a tab
 * @param {string} o.stageLabel   aria-label for the stage
 * @param {string} o.viewBox      the drawing's viewBox
 * @param {string} o.figLabel     aria-label for the drawing
 * @param {string} o.concept      the concept card on step 0 (the voice's first clip, or caption 0)
 * @param {string} o.setup        the first paragraph of the Details drawer
 * @param {{label: string, variants: [string, string][]}} o.whatIf   group label, [key, button label]
 * @param {string} o.totals       the readout row's HTML: <span><b id="r-...">0</b> unit</span> ...
 * @param {string} o.readoutNote  "Readouts follow the orange step"
 * @param {[string, string][]} o.legend   [css colour, meaning]
 * @param {string[]} o.facts      "How it is computed" bullets (HTML)
 * @param {string} o.css          the drawing's own CSS (line weights, accents)
 * @param {string} o.modelSrc     the model, inlined (export keywords removed)
 * @param {Function} o.machine    (DATA) => machine hooks, serialized into the page
 * @param {object} o.audit        the correctness audit (src/claims/audit.mjs): { models, claims, coverage,
 *                                facts?, allow?, reviewFile, report? }. Its result rides in the page as
 *                                __viz.audit, and check-drawing fails unless it is clean
 * @param {object} o.data         DATA for the player: steps, predict, variants, base, alias, and
 *                                optionally lab: { button, title, heading, intro, inputs: [{ id, label, min, max, step, value, format }] }
 */
/** Run the correctness audit over everything the page says. */
export function auditPage(o) {
  const strip = (h) => String(h).replace(/<[^>]+>/g, " ");
  const texts = [
    ...textsOf(o.data, "data"),
    ...[["about", o.about], ["setup", o.setup], ["concept", o.concept]].filter(([, t]) => t).map(([where, text]) => ({ where, text })),
    ...o.facts.map((f, i) => ({ where: `details.facts.${i}`, text: strip(f) })),
    ...o.legend.map(([, t], i) => ({ where: `details.legend.${i}`, text: t })),
    // the drawing's own words: callouts, the title block, detail titles
    ...Object.entries(o.data.variants ?? {}).flatMap(([name, v]) => [...String(v.svg ?? "").matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m, i) => ({ where: `drawing.${name}.${i}`, text: m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<") }))),
  ];
  const places = [...o.steps.map((_, k) => `step:${k}`).slice(1), "whatif", "practice", ...(o.data.lab ? ["lab"] : [])];
  const captions = Object.values(o.data.variants ?? {}).flatMap((v) => v.captions ?? []);
  const details = [o.setup, ...o.facts.map(strip), ...captions].join("\n");
  if (!o.audit) return { ok: false, problems: ["audit: this page declares no audit (claims, coverage, review)"], review: "missing", stamp: "", counts: {} };
  const r = audit({ texts, places, details, ...o.audit });
  if (o.audit.report) {
    writeFileSync(o.audit.report, JSON.stringify({ title: o.title, stamp: r.stamp, review: r.review, problems: r.problems, claims: o.audit.claims.map((c) => c.text), coverage: o.audit.coverage, texts }, null, 1));
  }
  return r;
}

export function drawingPage(o) {
  const n = o.steps.length - 1;
  const checked = auditPage(o);
  for (const p of checked.problems) console.warn(`audit: ${p}`);
  o = { ...o, data: { ...o.data, audit: { ok: checked.ok, review: checked.review, stamp: checked.stamp, counts: checked.counts, problems: checked.problems } } };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<style>
${chromeCss()}
${o.css}</style>
</head>
<body>
<div class="vz" id="vz" data-presentation="editorial" data-scene="${o.scene}">
<article class="vz-card">
  <header class="vz-head">
    <div class="vz-heading"><h1 class="vz-title">${esc(o.title)}</h1><p class="vz-about">${esc(o.about)}</p></div>
    <nav class="vz-chapters" aria-label="Chapters">
${o.steps.slice(1).map((s, i) => `      <button type="button"><span>${String(i + 1).padStart(2, "0")}</span> ${esc(s.tab)}</button>`).join("\n")}
    </nav>
    <div class="vz-utilities"><button class="vz-info" type="button" data-details aria-haspopup="dialog" aria-controls="details">Details</button><button class="vz-theme" id="theme" type="button">Dark</button></div>
  </header>
  <div class="vz-body" data-panels="1">
    <div class="vz-stage" id="stage" tabindex="0" role="group" aria-roledescription="step-through figure" aria-label="${esc(o.stageLabel)}">
      <svg id="fig" class="vz-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${o.viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(o.figLabel)}"></svg>
      <section class="vz-caption" aria-live="polite" aria-atomic="true"><h2 class="vz-step-heading" id="heading"></h2>
        <section class="vz-predict vz-practice" id="practice" aria-label="Now you try" hidden></section>${labPanel(o.data.lab)}</section>
      <div class="vz-cards">
        <p class="vz-concept" id="concept">${esc(o.concept)}</p>
        <section class="vz-predict" id="predict" aria-label="Predict the next step" hidden></section>
      </div>
    </div>
    <aside class="vz-panels" aria-label="Readouts">
      <section class="vz-panel">
        <h3>What if</h3>
        <div class="vz-panel-body">
          <div class="vz-whatif" role="group" aria-label="${esc(o.whatIf.label)}">${o.whatIf.variants.map(([k, label], i) => `<button type="button" data-variant="${k}" aria-pressed="${i === 0}">${esc(label)}</button>`).join("")}</div>
          <div class="vz-totals">
${o.totals}
          </div>
        </div>
      </section>
    </aside>
  </div>
  <div class="vz-controls" role="toolbar" aria-label="Playback">
    <button class="vz-btn" id="prev" type="button" aria-label="Previous step">${icon.prev}</button>
    <button class="vz-btn" id="play" type="button" aria-label="Play" data-primary data-state="play">${icon.play}${icon.pause}</button>
    <button class="vz-btn" id="next" type="button" aria-label="Next step">${icon.next}</button>
    <span class="vz-count" id="count">00 / ${String(n).padStart(2, "0")}</span>
    <div class="vz-scrub"><input class="vz-range" id="scrub" type="range" min="0" max="1" step="0.01" value="0" aria-label="Timeline of the explanation"><div id="marks"></div></div>
${o.data.lab ? `    <button class="vz-btn vz-try" id="labBtn" type="button" aria-pressed="false" aria-controls="lab">${esc(o.data.lab.button)}</button>\n` : ""}    <button class="vz-btn vz-try" id="try" type="button" aria-pressed="false">Now you try</button>
    <button class="vz-btn vz-voice" id="voice" type="button" aria-pressed="true" aria-label="Voice narration">Voice on</button>
    <button class="vz-btn" id="restart" type="button" aria-label="Restart">${icon.restart}</button>
  </div>
  <dialog class="vz-drawer" id="details" aria-labelledby="details-title">
    <div class="vz-drawer-head"><h2 id="details-title">Behind the figure</h2><button class="vz-info" type="button" data-details aria-label="Close details">Close ×</button></div>
    <div class="vz-drawer-body">
      <p class="vz-setup">${esc(o.setup)}</p>
      <h3>This step <span class="vz-count" id="d-count"></span></h3>
      <p class="vz-text" id="d-step"></p>
      <div class="vz-meta"><span class="vz-trust" title="Every position and readout is calculated by the model running on this page.">Computed live</span><span class="vz-readout">${esc(o.readoutNote)}</span></div>
      <h3>Colour</h3>
      <ul class="vz-legend">
${o.legend.map(([tone, text]) => `        <li><span class="vz-swatch" style="--tone:${tone}"></span>${esc(text)}</li>`).join("\n")}
      </ul>
      <h3>How it is computed</h3>
      <ul class="vz-facts">
${o.facts.map((f) => `        <li>${f}</li>`).join("\n")}
      </ul>
    </div>
  </dialog>
</article>
</div>
<script>
${o.modelSrc}
const DATA = ${JSON.stringify(o.data)};
(${player.toString()})(DATA, (${o.machine.toString()})(DATA));
</script>
</body>
</html>
`;
}
