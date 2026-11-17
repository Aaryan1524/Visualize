#!/usr/bin/env node
// An independent check of every sum, difference, product and ratio the page prints: it reads the page's own
// words (dist/derailleur.audit.json, written by the build), plus every practice question for both cassettes and
// the lab's rows, and re-does each piece of arithmetic from what is printed. It does not use the model's code.
//
//   node examples/derailleur/build.mjs && node examples/derailleur/arithmetic.mjs
//
// Prints one line per problem, or "arithmetic: passed (N checks)".

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openPage } from "../../scripts/lib/browser.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const report = JSON.parse(readFileSync(join(ROOT, "dist", "derailleur.audit.json"), "utf8"));
const RATIO = 1.4, PITCH = 3.74, SPOKE = 4;
const num = "(\\d+(?:\\.\\d+)?)";
const dec = (s) => (s.split(".")[1] ?? "").length;
const half = (s) => 0.5 * 10 ** -dec(s) + 1e-9;
let checks = 0;
const problems = [];
const bad = (where, msg, text) => problems.push(`${where}: ${msg}   "…${text.slice(0, 160)}…"`);
const eq = (where, label, got, want, tol, text) => {
  checks++;
  if (Math.abs(got - want) > tol) bad(where, `${label}: printed ${want}, but the parts give ${+got.toFixed(4)}`, text);
};

function scan(where, text) {
  const t = text.replace(/\s+/g, " ");
  // sums and differences: "29 + 12 − 5 − 10 = 26", exact at the printed precision
  for (const m of t.matchAll(new RegExp(`${num}((?: [+−-] ${num})+) = ${num}`, "g"))) {
    const terms = [m[1], ...[...m[2].matchAll(new RegExp(`([+−-]) ${num}`, "g"))].map((x) => (x[1] === "+" ? "" : "-") + x[2])];
    const sum = terms.reduce((a, x) => a + Number(x), 0);
    eq(where, `${m[0]}`, sum, Number(m[m.length - 1]), half(m[m.length - 1]) / 1e9, t);
  }
  // products and quotients: "2.67 × 1.4 = 3.74", "3.74 ÷ 1.4 = 2.671"
  for (const m of t.matchAll(new RegExp(`${num} × ${num} = ${num}`, "g"))) eq(where, m[0], Number(m[1]) * Number(m[2]), Number(m[3]), half(m[3]) + 0.001, t);
  for (const m of t.matchAll(new RegExp(`${num} ÷ ${num} = ${num}`, "g"))) eq(where, m[0], Number(m[1]) / Number(m[2]), Number(m[3]), half(m[3]) + 0.0005, t);
  // distance off line and its cable equivalent
  for (const m of t.matchAll(new RegExp(`${num} mm off line \\(${num} mm of cable\\)`, "g"))) eq(where, m[0], Number(m[1]) / RATIO, Number(m[2]), half(m[2]) + 0.001, t);
  for (const m of t.matchAll(new RegExp(`half a cog off line \\(${num} mm, ${num} mm of cable\\)`, "g"))) {
    eq(where, `${m[0]} (half a cog)`, PITCH / 2, Number(m[1]), half(m[1]) + 0.001, t);
    eq(where, `${m[0]} (cable)`, Number(m[1]) / RATIO, Number(m[2]), half(m[2]) + 0.001, t);
  }
  // an over-pull and its travel; the cable that reaches the spokes or the dropout
  for (const m of t.matchAll(new RegExp(`${num} mm of extra pull \\(${num} mm of travel\\)`, "g"))) eq(where, m[0], Number(m[1]) * RATIO, Number(m[2]), half(m[2]) + 0.001, t);
  for (const m of t.matchAll(new RegExp(`(?:slack by|pulled at least) ${num} mm`, "g"))) eq(where, m[0], SPOKE / RATIO, Number(m[1]), half(m[1]) + 0.001, t);
  // the shares of the extra chain: total = cage + rest
  for (const m of t.matchAll(new RegExp(`wraps ${num} mm more chain than the \\d+, .*?: ${num} mm from the loop through the cage, and the other ${num} mm`, "g")))
    eq(where, `${m[1]} = ${m[2]} + ${m[3]}`, Number(m[2]) + Number(m[3]), Number(m[1]), half(m[1]) / 1e9, t);
  for (const m of t.matchAll(new RegExp(`of the ${num} mm the \\d+ wraps more than the \\d+, the loop through the cage gives up ${num} mm and the rest of the loop the other ${num} mm`, "g")))
    eq(where, `${m[1]} = ${m[2]} + ${m[3]}`, Number(m[2]) + Number(m[3]), Number(m[1]), half(m[1]) / 1e9, t);
  for (const m of t.matchAll(new RegExp(`With the \\d+: ${num} mm, ${num} mm and ${num} mm; the rest is ${num} \\+ ${num} − ${num} − ${num}`, "g"))) {
    eq(where, `${m[1]} = ${m[2]} + ${m[3]}`, Number(m[2]) + Number(m[3]), Number(m[1]), half(m[1]) / 1e9, t);
    eq(where, `${m[3]} = ${m[4]} + ${m[5]} − ${m[6]} − ${m[7]}`, Number(m[4]) + Number(m[5]) - Number(m[6]) - Number(m[7]), Number(m[3]), half(m[3]) / 1e9, t);
  }
  for (const m of t.matchAll(new RegExp(`cog wraps ${num} mm more chain, .*?The cage gives up ${num} mm of the chain it holds; the rest of the loop gives up the other ${num} mm`, "g")))
    eq(where, `${m[1]} = ${m[2]} + ${m[3]}`, Number(m[2]) + Number(m[3]), Number(m[1]), half(m[1]) / 1e9, t);
  for (const m of t.matchAll(new RegExp(`wraps ${num} mm more chain round the cog.*?\\(${num} mm of it\\) and from the rest of the loop \\(${num} mm\\)`, "g")))
    eq(where, `${m[1]} = ${m[2]} + ${m[3]}`, Number(m[2]) + Number(m[3]), Number(m[1]), half(m[1]) / 1e9, t);
  // clicks: "7 clicks of 3.74 ÷ 1.4 = 2.671 mm each: 18.70 mm of cable, ... into 26.18 mm"
  for (const m of t.matchAll(new RegExp(`(\\d+) clicks of ${num} ÷ ${num} = ${num} mm each: ${num} mm of cable, which the parallelogram turns into ${num} mm`, "g"))) {
    // the per-click figure is itself rounded (half a unit in the last place, times the number of clicks)
    eq(where, `${m[1]} clicks of ${m[4]}`, Number(m[1]) * Number(m[4]), Number(m[5]), Number(m[1]) * 0.0005 + 0.005 + 1e-9, t);
    eq(where, `${m[1]} clicks of ${m[2]}`, Number(m[1]) * Number(m[2]), Number(m[6]), 0.005 + 1e-9, t);
  }
}

for (const { where, text } of report.texts) scan(where, text);

// the practice questions and the lab, as the page makes them
const browser = await launch();
try {
  const { page } = await openPage(browser, join(ROOT, "dist", "derailleur.html"), { width: 1440, height: 900, scale: 1 });
  for (const v of ["road", "wide"]) {
    await page.evaluate((v) => window.__viz.variant(v), v);
    for (let n = 0; n < 60; n++) {
      const q = await page.evaluate((n) => window.__viz.question(n), n);
      const text = `${q.q} ${q.choices[0]} ${q.explain}`;
      scan(`${v} question ${n}`, text);
      // "The cable is X mm too slack/tight ... every cog land, except the one a limit screw holds": the explanation names the screw that holds it
      const m = q.q.match(new RegExp(`The cable is ${num} mm too (slack|tight)`));
      if (m) {
        checks++;
        const screw = m[2] === "slack" ? "H screw holds the smallest" : "L screw holds the largest";
        if (!q.explain.includes(screw)) bad(`${v} question ${n}`, `the exempt cog is not the ${m[2] === "slack" ? "smallest" : "largest"}`, q.explain);
        eq(`${v} question ${n}`, "the right answer", Number(m[1]) * RATIO, Number(q.choices[0].replace(" mm", "")), 0.006, q.explain);
      }
    }
    for (const [gear, err, lout] of [[6, -1, 0], [11, 3, 6], [1, -2, 0], [3, 1.5, 0]]) {
      const out = await page.evaluate((vals) => window.__viz.lab(vals), { gear, err, lout });
      scan(`${v} lab ${gear}/${err}/${lout}`, `${out.verdict} ${out.rows.join(" ")}`);
    }
    await page.evaluate(() => window.__viz.closeLab());
  }
} finally {
  await browser.close();
}

if (problems.length) {
  for (const p of problems) console.log(p);
  console.log(`arithmetic: ${problems.length} problem${problems.length > 1 ? "s" : ""} in ${checks} checks`);
  process.exit(1);
}
console.log(`arithmetic: passed (${checks} checks)`);
