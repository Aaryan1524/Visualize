#!/usr/bin/env node
// Print the brief for a mandatory end-of-/visualize independent review of BOTH conceptual soundness
// (real domain model, physics/math, units, cause-and-effect) AND studio visual consistency (light &
// dark rendered screenshots against references/look.md).
//
//   node scripts/review-brief.mjs <name.audit.json> <review.json> [page.html] [--shots <dir>] [--model <model.mjs>] [--mode everyday|fast|technical|deep]
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
const VALID_MODES = new Set(["everyday", "fast", "technical", "deep"]);
const USAGE =
  "usage: node scripts/review-brief.mjs <name.audit.json> <review.json to write> [built page] [--shots <dir>] [--model <model.mjs>] [--mode everyday|fast|technical|deep]";

const argv = process.argv.slice(2);
const flags = new Map();
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--shots" || argv[i] === "--model" || argv[i] === "--mode") {
    const k = argv[i].slice(2);
    const val = argv[i + 1];
    if (!val || val.startsWith("--")) {
      console.error(`missing value for --${k}`);
      console.error(USAGE);
      process.exit(2);
    }
    flags.set(k, val);
    i++;
  } else if (argv[i].startsWith("--mode=")) {
    flags.set("mode", argv[i].slice("--mode=".length));
  } else {
    pos.push(argv[i]);
  }
}

const mode = flags.get("mode") ?? "everyday";
if (!VALID_MODES.has(mode)) {
  console.error(`invalid --mode "${mode}": expected one of everyday, fast, technical, deep`);
  console.error(USAGE);
  process.exit(2);
}

const [report, reviewFile, page] = pos;
if (!report || !reviewFile) {
  console.error(USAGE);
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

const shootFlags = mode === "fast" ? " --fast" : "";
const shotsSection = shotsPath
  ? `Inspect the rendered light & dark screenshots in ${shotsPath}${shotList.length ? ` (${shotList.length} images: ${shotList.slice(0, 8).join(", ")}${shotList.length > 8 ? ", …" : ""})` : ""}${page ? ` — or re-shoot fresh ones from ${resolve(page)} with:\n   node ${SHOOT} ${resolve(page)} --out ${shotsPath}${shootFlags}` : ""}.`
  : page
    ? mode === "fast"
      ? `Shoot the core light steps, dark sanity shot, and lab shot from ${resolve(page)} with:\n   node ${SHOOT} ${resolve(page)} --out <folder> --fast\n   and inspect every rendered image.`
      : `Shoot every step, light & dark theme, What if, lab end and Now you try from ${resolve(page)} with:\n   node ${SHOOT} ${resolve(page)} --out <folder>\n   and inspect every rendered image.`
    : `Open the built HTML page (or run node ${SHOOT} <page.html> --out <folder>${shootFlags}) and inspect BOTH light and dark screenshots.`;

const modelLead = modelPath
  ? `Read the executable model at ${modelPath}.`
  : "Inspect the page's executable model (model.mjs).";

const FULL_VISUAL_RUBRIC = `   Evaluate EVERY step in BOTH light and dark themes against the studio bar:
   - **3D contrast & materials:** tops and side walls clearly separate; no cream-on-cream flatness, no pitch-black CSS variable cycles, no washed-out dark mode.
   - **Geometry & clarity:** clean silhouettes, no bow-tie/self-intersecting cutouts or z-fighting; flat layered machines (watches, gearboxes, clutches) use an exploded vertical stack with centre lines instead of a squashed disc; no unexplained pillars or covers hiding the subject.
   - **Studio restraint & framing:** calm neutral stage with ONE signal colour (orange \`subject\`); the figure dominates; camera framing changes purposefully across steps; no title block, heading, card, or callout collisions; leader lines are short, non-crossing, and land squarely on the named part.
   - **Legibility:** printed values, indices, working strips, and equations read crisply in both themes.`;

const RUBRICS = {
  everyday: {
    intro: `You did NOT build this page. You are a demanding domain expert AND design director reviewing a
finished Visualize explanation in **everyday** mode (accessible college-level clarity backed by real physics/logic)
before it ships. Your job is to verify BOTH that the concept is genuinely sensible in plain English AND that
the visuals meet Visualize's studio baseline (${LOOK_REF}). Do NOT edit the page, model, or figure files — only write review.json.`,
    part1: `## Part 1 — Conceptual & domain sanity (everyday clarity & real physics)
1. ${modelLead} Verify it computes real domain physics, math, or algorithm mechanics — no hardcoded fake numbers, arbitrary curves, or wrong cause-and-effect.
2. Check every statement below against first principles and against the sources under Coverage.
   Specifically hunt for:
   - wrong physical direction or sign (what pushes, pulls, turns clockwise vs anticlockwise, grows vs shrinks);
   - wrong cause-and-effect or circular hand-waving ("just talking" without explaining the mechanism);
   - wrong real numbers or dishonest simplifications.
3. **Plain-English / College-Level Check:** Flag unnecessary engineering jargon or unrequested raw SI units/formulas (e.g., \`N·mm\`, \`µN·mm\`, \`isochronism\`, raw symbolic equations) that obscure intuition for an everyday or college-level learner. Simple plain English paired with real, concrete numbers from the model is required.
4. **Real-Object Representation Check:** If the subject is a real physical object or phenomenon (watch, perfume bottle, coffee maker, battery, syringe, wing, pump, lock, etc.), **FAIL** if the figure lazily shows abstract boxes/cells with numbers instead of the recognizable 3D object paired with a clean side explainer.
5. Check every claim tied to a test: is the sentence genuinely true in the field, not merely passing a weak test? Check Coverage: is anything essential to understanding this subject missing, or deferred without an honest reason?`,
    part2: `## Part 2 — Studio visual consistency (${LOOK_REF})
6. ${shotsSection}
${FULL_VISUAL_RUBRIC}`,
    part3: `## Part 3 — Cross-consistency
7. Verify headings, readouts, captions, narration, claims, What if variants, lab verdicts, practice
   questions, and the rendered pictures all agree with one another.`,
    visualRule: `Set "checks.visual" to "pass" ONLY if light and dark rendered shots meet the studio bar with no open visual findings; otherwise "fail".`,
  },
  fast: {
    intro: `You did NOT build this page. You are a focused reviewer running a quick sanity review of a
**fast**-mode Visualize explanation before it ships. Verify that the core mechanism is factually accurate,
the visual representation is recognizable and clean, and light + dark sanity shots have zero layout or
contrast failures. Do NOT edit the page, model, or figure files — only write review.json.

**Important (\`fast\` mode scope):** Do NOT fail this \`--fast\` page for simpler visual detail, fewer camera moves,
omitted What-if variants, or omitted recorded voice — those are intentionally lightweight in \`fast\` mode.`,
    part1: `## Part 1 — Conceptual & domain sanity (fast sanity check)
1. ${modelLead} Verify the core mechanism is factually accurate and computed by real physics/logic — no fake numbers, wrong sign/direction, or inverted cause-and-effect.
2. **Plain-English Check:** Verify the plain English reads cleanly and intuitively without opaque jargon or hand-waving.
3. **Real-Object Representation Check:** If the subject is a real physical object or phenomenon, **FAIL** if the figure lazily shows abstract boxes/cells with numbers instead of a recognizable 3D object.
4. Check core claims and Coverage for anything factually wrong or misleading (do not fail for omitted optional variants or concise scope).`,
    part2: `## Part 2 — Studio visual consistency (${LOOK_REF} — fast sanity shots)
5. ${shotsSection}
   Evaluate the light core-step shots, lab shot (if present), and dark sanity shot for blocking defects:
   - **Zero collisions or clipping:** no callout/card overlaps, no labels or lit parts clipped off-stage, no broken silhouettes.
   - **Light & dark contrast:** tops and walls separate cleanly and text/values are legible in BOTH light and dark sanity shots (no flat cream-on-cream or pitch-black CSS cycles).
   - **Non-crossing leaders:** leader lines point cleanly to their parts without tangling across the subject.
   - Remember: do **NOT** fail \`--fast\` pages for simpler visual detail, omitted What-if variants, or omitted voice.`,
    part3: `## Part 3 — Cross-consistency
6. Verify headings, readouts, captions, claims, lab verdicts (if present), and the rendered pictures agree with one another.`,
    visualRule: `Set "checks.visual" to "pass" ONLY if light + dark sanity shots have zero overlaps, clipping, or contrast failures and real objects are recognizable (do not fail for simpler fast-mode detail, omitted What-if variants, or omitted voice); otherwise "fail".`,
  },
  technical: {
    intro: `You did NOT build this page. You are a demanding senior domain engineer AND design director reviewing a
finished Visualize explanation in **technical** mode (full engineering rigor) before it ships. Your job is to
verify BOTH full quantitative/engineering accuracy AND Visualize's studio baseline (${LOOK_REF}). Do NOT edit
the page, model, or figure files — only write review.json.`,
    part1: `## Part 1 — Conceptual & domain sanity (full engineering rigor)
1. ${modelLead} Verify it computes real domain physics, math, or algorithm mechanics — not hardcoded fake curves, arbitrary magic numbers, or tautological mocks.
2. Check every statement, equation on stage, and readout against first principles and against the sources under Coverage.
   Specifically hunt for:
   - wrong physical direction or sign (what pushes, pulls, turns clockwise vs anticlockwise, grows vs shrinks);
   - wrong cause-and-effect or circular hand-waving ("just talking" without explaining the mechanism);
   - wrong numbers, exact magnitudes, tolerances, or SI/domain units (e.g., \`µN·mm\` vs \`mN·mm\`, \`N·mm\`, \`rad\` vs \`deg\`, \`ms\` vs \`s\`, \`Pa\` vs \`kPa\`);
   - missing equations on stage where quantitative relationships govern the step;
   - missing invariants, conservation laws, edge/failure cases, or dishonest simplifications;
   - multi-variant What-if rigor: verify every What-if variant solves the same underlying equations honestly and demonstrates meaningful parametric contrast.
3. Check every claim tied to a test: is the sentence genuinely true in the field, not merely passing a weak test?
4. Check Coverage: is anything essential to an engineering-grade understanding of this subject missing, or deferred without an honest reason?`,
    part2: `## Part 2 — Studio visual consistency (${LOOK_REF})
5. ${shotsSection}
${FULL_VISUAL_RUBRIC}`,
    part3: `## Part 3 — Cross-consistency
6. Verify headings, equations, SI units, readouts, captions, narration, claims, multi-variant What if states,
   lab verdicts, practice questions, and the rendered pictures all agree with one another.`,
    visualRule: `Set "checks.visual" to "pass" ONLY if light and dark rendered shots meet the studio bar with no open visual findings; otherwise "fail".`,
  },
  deep: {
    intro: `You did NOT build this page. You are a demanding domain expert, curriculum editor, AND design director
reviewing a finished Visualize explanation in **deep** mode (multi-chapter progressive mastery) before it ships.
Your job is to verify BOTH full multi-chapter conceptual soundness AND Visualize's studio baseline (${LOOK_REF}).
Do NOT edit the page, model, or figure files — only write review.json.`,
    part1: `## Part 1 — Conceptual & domain sanity (multi-chapter deep audit)
1. ${modelLead} Verify it computes real domain physics, math, or algorithm mechanics across every chapter and variant — not hardcoded fake curves, arbitrary magic numbers, or tautological mocks.
2. **Multi-Chapter Audit (4–6 chapters & progressive depth):** Verify the page is structured into 4–6 substantive chapters with genuine progressive depth — moving from **core mechanism → failure/edge cases → engineering trade-offs → real variants** — rather than stretching a single thin idea across extra steps.
3. **Per-Chapter Predict Checkpoints:** Verify that each chapter includes a meaningful Predict checkpoint before its reveal step, and that the reveal actually explains the mechanism rather than merely restating the answer.
4. Check every statement below against first principles and against the sources under Coverage.
   Specifically hunt for:
   - wrong physical direction or sign (what pushes, pulls, turns clockwise vs anticlockwise, grows vs shrinks);
   - wrong cause-and-effect or circular hand-waving ("just talking" without explaining the mechanism);
   - wrong numbers, magnitudes, or SI/domain units;
   - missing invariants, conservation laws, edge/failure cases, or dishonest simplifications.
5. Check every claim tied to a test and Coverage: is every chapter's core topic genuinely taught and verified against the model?`,
    part2: `## Part 2 — Studio visual consistency (${LOOK_REF})
6. ${shotsSection}
${FULL_VISUAL_RUBRIC}`,
    part3: `## Part 3 — Cross-consistency
7. Verify headings, chapter flow, per-chapter Predict checkpoints, readouts, captions, narration, claims,
   What if variants, lab verdicts, practice questions, and the rendered pictures all agree with one another.`,
    visualRule: `Set "checks.visual" to "pass" ONLY if light and dark rendered shots across all chapters meet the studio bar with no open visual findings; otherwise "fail".`,
  },
};

const r = RUBRICS[mode];

console.log(`# Independent review: ${a.title} (mode: ${mode})

${r.intro}

${r.part1}

${r.part2}

${r.part3}

## Write your verdict
Write JSON to ${reviewPath}:

{
  "stamp": "${a.stamp}",
  "mode": "${mode}",
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
- Set "checks.conceptual" to "pass" ONLY if the model and every explanation are domain-sound for \`${mode}\` mode with no open conceptual findings; otherwise "fail".
- ${r.visualRule}
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
