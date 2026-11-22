#!/usr/bin/env node
// Print the brief for a mandatory end-of-/visualize independent review of BOTH conceptual soundness
// (real domain model, physics/math, units, cause-and-effect) AND studio visual consistency (light &
// dark rendered screenshots against references/look.md).
//
//   node scripts/review-brief.mjs <name.audit.json> <review.json> [page.html] [--shots <dir>] [--model <model.mjs>]
//
// Give the printed brief to a fresh agent that did NOT build the page (Claude Code Agent tool,
// Codex spawn_agent / fresh codex exec, Antigravity/Gemini invoke_subagent / fresh swarm worker,
// or a human reviewer). Self-review is forbidden: src/claims/audit.mjs rejects any review without
// "reviewer": "independent", rejects stale stamps after any edit, and fails open findings or
// failing conceptual/visual checks.
//
// Why a fresh reviewer: the author's own review is anchored on its own reasoning. In round 5 a
// page shipped "the cage spring swings it forward" (it pulls the cage back) past every check;
// in CP2 independent reviewers caught a 1,000x SI torque error, a bow-tie spoke cutout, a
// self-referential dark-mode CSS cycle, and a mis-aimed leader line — all after automated checks passed.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Absolute paths to skill scripts & references: the fresh reviewer runs from wherever it was started.
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOOT = join(SKILL_ROOT, "scripts", "shoot-steps.mjs");
const LOOK_REF = join(SKILL_ROOT, "references", "look.md");

const argv = process.argv.slice(2);
const flags = new Map();
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if ((argv[i] === "--shots" || argv[i] === "--model") && argv[i + 1]) {
    flags.set(argv[i].slice(2), argv[++i]);
  } else {
    pos.push(argv[i]);
  }
}

const [report, reviewFile, page] = pos;
if (!report || !reviewFile) {
  console.error("usage: node scripts/review-brief.mjs <name.audit.json> <review.json to write> [built page] [--shots <dir>] [--model <model.mjs>]");
  process.exit(2);
}

const reviewPath = resolve(reviewFile);
const reviewDir = dirname(reviewPath);
const detectedModel = join(reviewDir, "model.mjs");
const modelPath = flags.has("model") ? resolve(flags.get("model")) : existsSync(detectedModel) ? detectedModel : null;
const detectedShots = join(reviewDir, "shots");
const shotsPath = flags.has("shots") ? resolve(flags.get("shots")) : existsSync(detectedShots) ? detectedShots : null;

let shotList = [];
if (shotsPath && existsSync(shotsPath)) {
  try {
    shotList = readdirSync(shotsPath).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f)).sort();
  } catch {
    shotList = [];
  }
}

const a = JSON.parse(readFileSync(report, "utf8"));
const byWhere = new Map();
for (const t of a.texts) {
  const k = t.where.replace(/\.\d+(\.text)?$/, "").replace(/^data\./, "");
  if (!byWhere.has(k)) byWhere.set(k, []);
  if (!byWhere.get(k).includes(t.text)) byWhere.get(k).push(t.text);
}

const shotsSection = shotsPath
  ? `Inspect the rendered light & dark screenshots in ${shotsPath}${shotList.length ? ` (${shotList.length} images: ${shotList.slice(0, 8).join(", ")}${shotList.length > 8 ? ", …" : ""})` : ""}${page ? ` — or re-shoot fresh ones from ${resolve(page)} with:\n   node ${SHOOT} ${resolve(page)} --out ${shotsPath}` : ""}.`
  : page
    ? `Shoot every step, light & dark theme, What if, lab end and Now you try from ${resolve(page)} with:\n   node ${SHOOT} ${resolve(page)} --out <folder>\n   and inspect every rendered image.`
    : `Open the built HTML page (or run node ${SHOOT} <page.html> --out <folder>) and inspect BOTH light and dark screenshots.`;

console.log(`# Independent review: ${a.title}

You did NOT build this page. You are a demanding domain expert AND design director reviewing a
finished Visualize explanation before it ships. Your job is to verify BOTH that the concept is
genuinely sensible (not hand-waved or technically wrong) AND that the visuals meet Visualize's
studio baseline (${LOOK_REF}). Do NOT edit the page, model, or figure files — only write review.json.

## Part 1 — Conceptual & domain sanity (is it actually sensible?)
1. ${modelPath ? `Read the executable model at ${modelPath}.` : "Inspect the page's executable model (model.mjs)."} Verify it computes real domain physics, math, or algorithm mechanics — not hardcoded fake curves, arbitrary magic numbers, or tautological mocks.
2. Check every statement below against first principles and against the sources under Coverage.
   Specifically hunt for:
   - wrong physical direction or sign (what pushes, pulls, turns clockwise vs anticlockwise, grows vs shrinks);
   - wrong cause-and-effect or circular hand-waving ("just talking" without explaining the mechanism);
   - wrong numbers, magnitudes, or SI/domain units (e.g., µN·mm vs mN·mm, rad vs deg, ms vs s);
   - missing invariants, conservation laws, edge/failure cases, or dishonest simplifications.
3. Check every claim tied to a test: is the sentence genuinely true in the field, not merely passing a weak test?
4. Check Coverage: is anything essential to understanding this subject missing, or deferred without an honest reason?

## Part 2 — Studio visual consistency (${LOOK_REF})
5. ${shotsSection}
   Evaluate EVERY step in BOTH light and dark themes against the studio bar:
   - **3D contrast & materials:** tops and side walls clearly separate; no cream-on-cream flatness, no pitch-black CSS variable cycles, no washed-out dark mode.
   - **Geometry & clarity:** clean silhouettes, no bow-tie/self-intersecting cutouts or z-fighting; flat layered machines (watches, gearboxes, clutches) use an exploded vertical stack with centre lines instead of a squashed disc; no unexplained pillars or covers hiding the subject.
   - **Studio restraint & framing:** calm neutral stage with ONE signal colour (orange \`subject\`); the figure dominates; camera framing changes purposefully across steps; no title block, heading, card, or callout collisions; leader lines are short, non-crossing, and land squarely on the named part.
   - **Legibility:** printed values, indices, working strips, and equations read crisply in both themes.

## Part 3 — Cross-consistency
6. Verify headings, readouts, captions, narration, claims, What if variants, lab verdicts, practice
   questions, and the rendered pictures all agree with one another.

## Write your verdict
Write JSON to ${reviewPath}:

{
  "stamp": "${a.stamp}",
  "reviewer": "independent",
  "checks": {
    "conceptual": "pass | fail",
    "visual": "pass | fail"
  },
  "summary": "<two sentences: one on conceptual/domain soundness, one on studio visual consistency>",
  "findings": [
    {
      "where": "<data path, step, or model.mjs>",
      "category": "conceptual | visual | consistency",
      "text": "<the words or visual element at fault>",
      "severity": "wrong | misleading | missing",
      "finding": "<what is wrong and why, with the exact correction>",
      "resolved": false
    }
  ]
}

Rules for your verdict:
- Set "checks.conceptual" to "pass" ONLY if the model and every explanation are domain-sound with no open conceptual findings; otherwise "fail".
- Set "checks.visual" to "pass" ONLY if light and dark rendered shots meet the studio bar with no open visual findings; otherwise "fail".
- On a re-review, keep every earlier finding: mark it "fixed": true if the current build fixes it, or "resolved": true with a "response" if you accept the author's reason to leave it; otherwise it stays open.
- Use an empty findings list ONLY if you genuinely found nothing wrong.
- Keep "stamp" exactly as given ("${a.stamp}"): it hashes the text you reviewed.

## Coverage (source: ${a.coverage?.source || "none given"})
${(a.coverage?.topics ?? []).map((t) => `- ${t.topic}: ${t.where}${t.why ? ` (${t.why})` : ""}${t.core === false ? " [optional]" : ""}`).join("\n")}

## Claims the author tested against the model
${a.claims.map((c) => `- "${c}"`).join("\n")}

## Everything the page says, by place
${[...byWhere].map(([k, v]) => `### ${k}\n${v.map((t) => `- ${t}`).join("\n")}`).join("\n\n")}
`);
