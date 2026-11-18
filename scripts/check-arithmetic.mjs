#!/usr/bin/env node
// Re-do every piece of arithmetic a page prints, from the printed numbers (src/claims/arithmetic.mjs).
//
//   node scripts/check-arithmetic.mjs dist/<name>.html     the page's words (its <name>.audit.json, written
//                                                          by the build), plus every Now you try question,
//                                                          and the lab's rows at each input's ends
//   node scripts/check-arithmetic.mjs dist/<name>.audit.json   the audited words alone, no browser
//
// Prints one line per problem, or "arithmetic: passed (N equations)". A page that prints no equation at
// all passes with 0; a sum must add up exactly as printed, a product or quotient within its rounding.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkArithmetic } from "../src/claims/arithmetic.mjs";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/check-arithmetic.mjs <built page .html | .audit.json>");
  process.exit(2);
}
const auditFile = arg.endsWith(".audit.json") ? arg : arg.replace(/\.html$/, ".audit.json");
if (!existsSync(auditFile)) {
  console.error(`check-arithmetic: no ${auditFile}; build the page first (drawingPage writes it when the audit names a report)`);
  process.exit(2);
}
const texts = JSON.parse(readFileSync(auditFile, "utf8")).texts ?? [];

if (arg.endsWith(".html")) {
  const { drawingPageProblem, launch, openPage } = await import("./lib/browser.mjs");
  const browser = await launch();
  const problem = await drawingPageProblem(browser, arg);
  if (problem) {
    console.log(`arithmetic: ${problem}`);
    await browser.close();
    process.exit(2);
  }
  try {
    const { page } = await openPage(browser, resolve(arg), { width: 1440, height: 900, scale: 1 });
    const more = await page.evaluate(() => {
      const v = window.__viz, out = [];
      const variants = v.variants?.length ? v.variants : [null];
      for (const name of variants) {
        if (name) v.variant(name);
        for (let n = 0; n < 8; n++) {
          const q = v.question?.(n);
          if (q) out.push({ where: `${name} practice ${n}`, text: [q.q, ...(q.choices ?? []), q.explain].join(" ") });
        }
        for (const inp of v.labInputs?.() ?? [])
          for (const end of ["min", "max"]) {
            const r = v.lab({ [inp.id]: inp[end] });
            if (r) out.push({ where: `${name} lab ${inp.id}=${inp[end]}`, text: [r.verdict, ...(r.rows ?? [])].join(" ") });
          }
        v.closeLab?.();
      }
      return out;
    });
    texts.push(...more);
  } finally {
    await browser.close();
  }
}

const { checked, problems } = checkArithmetic(texts);
for (const p of problems) console.log(p);
console.log(problems.length ? `arithmetic: ${problems.length} problem${problems.length > 1 ? "s" : ""} in ${checked} equations` : `arithmetic: passed (${checked} equations)`);
process.exit(problems.length ? 1 : 0);
