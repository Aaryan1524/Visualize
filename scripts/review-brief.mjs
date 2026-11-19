#!/usr/bin/env node
// Print the brief for an independent review of a page's words.
//
//   node scripts/review-brief.mjs dist/lock.audit.json examples/lock/review.json [page.html]
//
// Give the printed brief to a fresh agent that did not build the page (a subagent, a new session,
// or a person). It checks every statement against first principles and the cited sources, then
// writes review.json, stamped with the text it reviewed. The build's audit fails until a review of
// the current text exists with every finding fixed (or answered), so an edit after the review
// sends the page back for another.
//
// Why a fresh reviewer: the author's own review is anchored on its own reasoning. In round 5 a
// page shipped "the cage spring swings it forward" (it pulls the cage back) past every check, and
// the escalator said its two tracks "come together" (they converge to 30 mm apart).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// the shooting script by its absolute path: the reviewer runs from wherever it was started, not from
// the skill's folder
const SHOOT = join(dirname(fileURLToPath(import.meta.url)), "shoot-steps.mjs");

const [report, reviewFile, page] = process.argv.slice(2);
if (!report || !reviewFile) {
  console.error("usage: node scripts/review-brief.mjs <name.audit.json> <review.json to write> [built page]");
  process.exit(2);
}
const a = JSON.parse(readFileSync(report, "utf8"));
const byWhere = new Map();
for (const t of a.texts) {
  const k = t.where.replace(/\.\d+(\.text)?$/, "").replace(/^data\./, "");
  if (!byWhere.has(k)) byWhere.set(k, []);
  if (!byWhere.get(k).includes(t.text)) byWhere.get(k).push(t.text);
}

console.log(`# Independent review: ${a.title}

You did not build this page. Your job is to find what it says that is wrong, misleading or missing,
the way a demanding expert in the field would. Do not edit the page or its files.

## How to review
1. Read every statement below and check it against first principles and against the sources named
   under Coverage. Physical direction (what pushes, what pulls, which way a part moves), cause and
   effect, and every number with its unit are the most common errors.
2. Check each claim the author has tied to a test: is the sentence itself true, whatever the test says?
3. Check the topic list: is anything a reader would expect from a good reference on this subject
   missing, and is any deferral unreasonable?
4. Check that statements agree with each other (a heading and a readout, the intro and Details).${page ? `
5. Look at the page: open ${resolve(page)} in a browser, or shoot every step, theme, What if,
   lab end and Now you try with
   node ${SHOOT} ${resolve(page)} --out <folder>
   and read the images. Note anything the picture shows that the words contradict.` : ""}

## Write your verdict
Write JSON to ${resolve(reviewFile)}:

{
  "stamp": "${a.stamp}",
  "reviewer": "independent",
  "summary": "<one or two sentences>",
  "findings": [
    { "where": "<data path or step>", "text": "<the words at fault>", "severity": "wrong | misleading | missing",
      "finding": "<what is wrong and why, with the correct statement>", "resolved": false }
  ]
}

On a re-review, keep each earlier finding: mark it "fixed": true if the current text fixes it,
or "resolved": true with a "response" if you accept the author's reason to leave it; otherwise it
stays open. Use an empty findings list only if you found nothing. Keep "stamp" exactly as given: it identifies
the text you reviewed.

## Coverage (source: ${a.coverage?.source || "none given"})
${(a.coverage?.topics ?? []).map((t) => `- ${t.topic}: ${t.where}${t.why ? ` (${t.why})` : ""}${t.core === false ? " [optional]" : ""}`).join("\n")}

## Claims the author tested against the model
${a.claims.map((c) => `- "${c}"`).join("\n")}

## Everything the page says, by place
${[...byWhere].map(([k, v]) => `### ${k}\n${v.map((t) => `- ${t}`).join("\n")}`).join("\n\n")}
`);
