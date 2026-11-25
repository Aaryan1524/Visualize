#!/usr/bin/env node
// Mandatory Fresh-Context Final Verifier Gate for Visualize Studio.
//
//   node scripts/studio-review.mjs brief <page.html> --shots <shotsDir> [--model <model.mjs>] [--out <review.json>] [--round <1|2>]
//   node scripts/studio-review.mjs verify <page.html> --review <review.json> [--shots <shotsDir>] [--model <model.mjs>]
//
// `brief` emits two ready-to-send fresh-context verifier prompts (Concept & Physics Auditor +
// Visual Design Director) bound to the exact SHA-256 of `<page.html>`, optional `<model.mjs>`,
// and every expected screenshot PNG.
// `verify` enforces independent metadata, live HTML/model/screenshot SHA-256 freshness,
// and zero open blockers (nits are logged cleanly without blocking shipping).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractStudioConfigFromHtml } from "./studio-voice.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF_SCRIPT = resolve(HERE, "studio-review.mjs");

export const MAX_REVIEW_ROUNDS = 2;
export const CHECK_STAMP_FILE = ".studio-check.json";

export const EXPECTED_SHOTS = Object.freeze([
  "step0-light.png",
  "step0-dark.png",
  "mid-focus.png",
  "final-step.png",
]);

/**
 * Compute lowercase hex SHA-256 hash of content (string or Buffer).
 * @param {string | Buffer} data
 * @returns {string}
 */
export function computeHtmlSha256(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
  return createHash("sha256").update(buf).digest("hex");
}

export function computeFileSha256(filePath) {
  return computeHtmlSha256(readFileSync(resolve(filePath)));
}

function inspectShots(shotsDir, htmlMtimeMs) {
  const results = [];
  const warnings = [];
  const shotSha256s = {};
  const absDir = shotsDir ? resolve(shotsDir) : null;

  for (const name of EXPECTED_SHOTS) {
    if (!absDir) {
      results.push({ name, path: null, exists: false, fresh: false, sha256: null, status: "missing" });
      warnings.push(`Missing screenshot "${name}" (no --shots directory provided).`);
      continue;
    }
    const fullPath = join(absDir, name);
    if (!existsSync(fullPath)) {
      results.push({ name, path: fullPath, exists: false, fresh: false, sha256: null, status: "missing" });
      warnings.push(`Missing screenshot: ${fullPath}`);
      continue;
    }
    const st = statSync(fullPath);
    const fresh = st.mtimeMs >= htmlMtimeMs;
    const sha256 = computeHtmlSha256(readFileSync(fullPath));
    const status = fresh ? "fresh" : "stale";
    shotSha256s[name] = sha256;
    results.push({ name, path: fullPath, exists: true, fresh, mtimeMs: st.mtimeMs, sha256, status });
    if (!fresh) {
      warnings.push(
        `Stale screenshot: ${fullPath} is older than HTML. Re-run check-studio.mjs --shots before dispatching verifiers.`,
      );
    }
  }

  return { shots: results, shotSha256s, warnings };
}

function summarizeSteps(config) {
  const steps = Array.isArray(config?.steps) ? config.steps : [];
  if (steps.length === 0) return ["  (no steps found in STUDIO_CONFIG)"];

  return steps.map((s, idx) => {
    const label = s.tab ? `${s.tab} — ${s.title || ""}` : s.title || `Step ${idx}`;
    const focus = Array.isArray(s.focus) ? s.focus.join(", ") : "all";
    const callouts = Array.isArray(s.callouts)
      ? s.callouts.map((c) => `${c.target}:"${c.label}"${c.place ? `(${c.place})` : ""}`).join("; ")
      : "none";
    const lines = [
      `  Step ${s.step ?? idx}: ${label}`,
      `    narration: ${JSON.stringify(s.narration ?? "")}`,
      `    sim: ${JSON.stringify(s.sim ?? {})} | focus: [${focus}] | callouts: ${callouts || "none"}`,
    ];
    if (s.tryOut) {
      lines.push(
        `    tryOut: prompt=${JSON.stringify(s.tryOut.prompt ?? "")} | checkSrc=${JSON.stringify(s.tryOut.checkSrc ?? "")} | success=${JSON.stringify(s.tryOut.successText ?? "")}`,
      );
    }
    return lines.join("\n");
  });
}

/**
 * Build a structured 2-Verifier Dispatch Packet for independent fresh-context subagents.
 *
 * @param {{ htmlPath: string, shotsDir?: string | null, modelPath?: string | null, outPath?: string | null, round?: number }} opts
 */
export function buildReviewBrief({
  htmlPath,
  shotsDir = null,
  modelPath = null,
  outPath = null,
  round = 1,
}) {
  if (!htmlPath) {
    throw new Error("htmlPath is required to build a Studio review brief.");
  }
  const absHtml = resolve(htmlPath);
  if (!existsSync(absHtml)) {
    throw new Error(`HTML file not found: ${absHtml}`);
  }

  const htmlBuf = readFileSync(absHtml);
  const htmlStr = htmlBuf.toString("utf8");
  const htmlStat = statSync(absHtml);
  const htmlSha256 = computeHtmlSha256(htmlBuf);
  const config = extractStudioConfigFromHtml(htmlStr);
  const sceneId = String(config.sceneId || "unknown");
  const title = String(config.title || sceneId);

  const absShotsDir = shotsDir ? resolve(shotsDir) : null;
  const absModelPath = modelPath ? resolve(modelPath) : null;
  const absOutPath = outPath ? resolve(outPath) : null;
  const reviewRound = Number.isInteger(Number(round)) && Number(round) >= 1 ? Number(round) : 1;

  const { shots, shotSha256s, warnings } = inspectShots(absShotsDir, htmlStat.mtimeMs);
  let modelSha256 = null;
  if (absModelPath) {
    if (!existsSync(absModelPath)) {
      warnings.push(`Specified --model file not found: ${absModelPath}`);
    } else {
      modelSha256 = computeFileSha256(absModelPath);
    }
  }

  if (absShotsDir) {
    const stampPath = join(absShotsDir, CHECK_STAMP_FILE);
    if (!existsSync(stampPath)) {
      warnings.push(
        `Missing check-studio pass stamp (${stampPath}). Run check-studio.mjs --shots ${absShotsDir} and ensure it passes before verifying.`,
      );
    } else {
      try {
        const stamp = JSON.parse(readFileSync(stampPath, "utf8"));
        if (stamp?.status !== "passed" || stamp?.htmlSha256 !== htmlSha256) {
          warnings.push(
            `Stale or non-passing check-studio stamp (${stampPath}). Re-run check-studio.mjs --shots ${absShotsDir} until it passes.`,
          );
        }
      } catch {
        warnings.push(`Unreadable check-studio pass stamp (${stampPath}). Re-run check-studio.mjs --shots ${absShotsDir}.`);
      }
    }
  }

  if (reviewRound > MAX_REVIEW_ROUNDS) {
    warnings.push(
      `Circuit breaker warning: round ${reviewRound} exceeds max_rounds (${MAX_REVIEW_ROUNDS}). Fix only genuine blockers and avoid infinite nit-picking loops.`,
    );
  }

  const schema = {
    reviewer: "independent",
    round: reviewRound,
    htmlSha256,
    modelSha256,
    shotSha256s,
    sceneId,
    conceptual: {
      status: "<pass|fail>",
      summary: "<1-2 sentence independent verdict from Verifier 1>",
      blockers: [],
      nits: [],
    },
    visual: {
      status: "<pass|fail>",
      summary: "<1-2 sentence independent verdict from Verifier 2>",
      blockers: [],
      nits: [],
    },
  };

  const variantsSummary = (config.variants || [])
    .map((v) => `${v.name} ("${v.label}", defaults=${JSON.stringify(v.defaults ?? {})})`)
    .join("; ");
  const controlsSummary = (config.controls || [])
    .map((c) => `${c.id} [${c.min}..${c.max}${c.unit ? c.unit : ""}]`)
    .join("; ");
  const telemetrySummary = (config.telemetry || [])
    .map((t) => `${t.id} ("${t.label}", formatSrc=${t.formatSrc ?? ""})`)
    .join("; ");

  const shotLines = shots.map((s) => {
    const tag = s.status === "fresh" ? "OK (fresh)" : s.status === "stale" ? "WARN (stale)" : "MISSING";
    const hashSuffix = s.sha256 ? ` [sha256:${s.sha256.slice(0, 12)}]` : "";
    return `  - [${tag}] ${s.name}: ${s.path ?? "(missing --shots)"}${hashSuffix}`;
  });

  const outDisplay = absOutPath ?? "<review.json>";
  const verifyFlags = [
    `--review ${outDisplay}`,
    absShotsDir ? `--shots ${absShotsDir}` : null,
    absModelPath ? `--model ${absModelPath}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const verifier1Prompt = [
    `You are VERIFIER 1 — End-to-End Concept & Physics Auditor (read-only, zero shared memory with the author).`,
    `Audit the Visualize Studio page "${title}" (sceneId: ${sceneId}, round ${reviewRound} of max ${MAX_REVIEW_ROUNDS}).`,
    "",
    "Inputs to inspect:",
    absModelPath
      ? `  - Simulation model: ${absModelPath} (sha256: ${modelSha256 ?? "missing"})`
      : `  - Embedded simModel inside: ${absHtml}`,
    `  - Live HTML SHA-256: ${htmlSha256}`,
    `  - STUDIO_CONFIG summary:`,
    `    Variants:  ${variantsSummary || "none"}`,
    `    Controls:  ${controlsSummary || "none"}`,
    `    Telemetry: ${telemetrySummary || "none"}`,
    "  Steps:",
    ...summarizeSteps(config),
    "",
    "Checklist:",
    "  1. Domain & physical/algorithmic accuracy: equations, causal mechanisms, labels, and units are scientifically and technically accurate.",
    "  2. simModel directionality & sanity: check min/max slider bounds and every variant; verify monotonic/expected signs and zero NaN/Infinity.",
    "  3. Exact agreement across narration text, telemetry readouts, and tryOut verification predicate (`checkSrc` matches `prompt` and `successText`).",
    "  4. End-to-end learner flow: stepping 0 -> N tells a coherent, progressively revealed story without unexplained jumps.",
    "",
    "Return JSON ONLY for the `conceptual` section:",
    '  { "status": "pass" | "fail", "summary": "...", "blockers": [...], "nits": [...] }',
    "Severity rule: put ONLY genuine factual/math/contract errors in `blockers[]` (and set status='fail'). Put optional minor wording/polish suggestions in `nits[]` — nits never block shipping.",
  ].join("\n");

  const verifier2Prompt = [
    `You are VERIFIER 2 — Visual Design Director (read-only, PNGs ONLY — ZERO CODE BIAS).`,
    `DO NOT read scene.mjs, model.mjs, build.mjs, or HTML — judge ONLY the rendered screenshots below for "${title}" (sceneId: ${sceneId}, round ${reviewRound} of max ${MAX_REVIEW_ROUNDS}).`,
    "",
    "Screenshots to inspect:",
    ...shots.map((s) => `  - ${s.path ?? s.name}`),
    "",
    "Studio Design Token Guidance (do NOT flag intentional tokens as defects):",
    "  - Engine A (3D Physical CAD): matte-clay cutaway solids with thin architectural contour edges, warm studio light paper / obsidian dark backdrop.",
    "  - Engine C (2D Tactile Conceptual): Braun/Rams hardware instrument aesthetic. In dark mode (`step0-dark.png`), light-faithful matte-ivory ceramic tiles on `#111317` dark obsidian is an INTENTIONAL high-contrast design token from studio-engines.md — do NOT flag matte-ivory tiles on dark obsidian as a dark-mode defect.",
    "",
    "Checklist:",
    "  1. Correct studio medium: 3D matte-clay CAD cutaway for physical objects (Engine A); Braun/Rams tactile instrument for conceptual topics (Engine C).",
    "  2. Recognizable silhouette, zero floating/disconnected parts, and zero clipping behind the subtitle, bottom dock, or floating challenge card.",
    "  3. Zero overlapping labels, leader lines, threads, or callouts (hard max 2 callouts per step).",
    "  4. Clean figure-ground contrast and crisp legibility in BOTH light (step0-light.png) and dark (step0-dark.png) modes.",
    "",
    "Return JSON ONLY for the `visual` section:",
    '  { "status": "pass" | "fail", "summary": "...", "blockers": [...], "nits": [...] }',
    "Severity rule: put ONLY real visual defects (overlap, clipping, unreadable text, wrong medium, broken geometry) in `blockers[]` (and set status='fail'). Put minor aesthetic taste preferences in `nits[]` — nits never block shipping.",
  ].join("\n");

  const lines = [
    "========================================================================",
    "VISUALIZE STUDIO — 2-VERIFIER FRESH-CONTEXT DISPATCH PACKET",
    "========================================================================",
    `Scene:        ${title} (sceneId: ${sceneId})`,
    `Round:        ${reviewRound} (max_rounds = ${MAX_REVIEW_ROUNDS})`,
    `HTML:         ${absHtml}`,
    `HTML SHA256:  ${htmlSha256}`,
    `Model:        ${absModelPath ?? "(embedded simModel inside HTML)"}`,
    `Model SHA256: ${modelSha256 ?? "null"}`,
    `Shots Dir:    ${absShotsDir ?? "(not provided)"}`,
    `Review Out:   ${outDisplay}`,
    "",
    "Screenshots Status:",
    ...shotLines,
  ];

  if (warnings.length > 0) {
    lines.push("", "WARNINGS:");
    for (const w of warnings) lines.push(`  ! ${w}`);
  }

  lines.push(
    "",
    "Dispatch 2 PARALLEL read-only fresh-context subagents:",
    "  - Claude Code: `Agent` (new subagent per verifier)",
    '  - Codex:       `spawn_agent` with `fork_turns="none"` (strict zero-context isolation)',
    "  - Antigravity: `invoke_subagent` (read-only research subagent)",
    "Note: studio-review.mjs verify enforces independent metadata, live HTML/model/screenshot SHA-256 freshness, and zero open blockers (dispatch fresh zero-context subagents per SKILL.md).",
    "",
    "=== COPY-PASTE PROMPT: VERIFIER 1 ===",
    verifier1Prompt,
    "=== END PROMPT: VERIFIER 1 ===",
    "",
    "=== COPY-PASTE PROMPT: VERIFIER 2 ===",
    verifier2Prompt,
    "=== END PROMPT: VERIFIER 2 ===",
    "",
    "------------------------------------------------------------------------",
    `REQUIRED REVIEW JSON SCHEMA (write merged verdict to ${outDisplay})`,
    "------------------------------------------------------------------------",
    JSON.stringify(schema, null, 2),
    "",
    "Then run the mandatory verification gate:",
    `  node ${SELF_SCRIPT} verify ${absHtml} ${verifyFlags}`,
  );

  return {
    htmlPath: absHtml,
    htmlSha256,
    modelPath: absModelPath,
    modelSha256,
    shotSha256s,
    round: reviewRound,
    sceneId,
    title,
    config,
    shots,
    warnings,
    schema,
    verifier1Prompt,
    verifier2Prompt,
    text: lines.join("\n"),
  };
}

function validateSection(name, section, errors, nitsOut) {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    errors.push(
      `Missing or invalid "${name}" section (expected object with { status, summary, blockers, nits }).`,
    );
    return;
  }
  if (section.status !== "pass") {
    errors.push(`"${name}.status" must be "pass" (got ${JSON.stringify(section.status)}).`);
  }

  const hasBlockers = Array.isArray(section.blockers);
  const hasLegacyFindings = Array.isArray(section.findings);

  if (!hasBlockers && !hasLegacyFindings) {
    errors.push(
      `"${name}.blockers" (or legacy "${name}.findings") must be an array (got blockers=${typeof section.blockers}, findings=${typeof section.findings}).`,
    );
  }

  if (hasBlockers) {
    for (let i = 0; i < section.blockers.length; i++) {
      const b = section.blockers[i];
      const msg = typeof b === "string" ? b : JSON.stringify(b);
      errors.push(`Open ${name} blocker [${i + 1}]: ${msg}`);
    }
  }

  if (hasLegacyFindings) {
    for (let i = 0; i < section.findings.length; i++) {
      const f = section.findings[i];
      const msg = typeof f === "string" ? f : JSON.stringify(f);
      errors.push(`Open ${name} finding [${i + 1}]: ${msg}`);
    }
  }

  if (section.nits !== undefined) {
    if (!Array.isArray(section.nits)) {
      errors.push(`"${name}.nits" must be an array when provided (got ${typeof section.nits}).`);
    } else {
      for (const nit of section.nits) {
        const msg = typeof nit === "string" ? nit : JSON.stringify(nit);
        nitsOut.push(`[${name}] ${msg}`);
      }
    }
  }
}

/**
 * Verify an independent review JSON against the live Studio HTML file (and optional model + shots).
 *
 * @param {string | { htmlPath: string, reviewPath: string, modelPath?: string | null, shotsDir?: string | null }} htmlPathOrOpts
 * @param {string} [reviewPathArg]
 * @param {{ modelPath?: string | null, shotsDir?: string | null }} [extraOpts]
 */
export function verifyReviewFile(htmlPathOrOpts, reviewPathArg, extraOpts = {}) {
  const isObj = typeof htmlPathOrOpts === "object" && htmlPathOrOpts !== null;
  const htmlPath = isObj ? htmlPathOrOpts.htmlPath : htmlPathOrOpts;
  const reviewPath = isObj ? htmlPathOrOpts.reviewPath : reviewPathArg;
  const modelPath = isObj ? htmlPathOrOpts.modelPath ?? null : extraOpts?.modelPath ?? null;
  const shotsDir = isObj ? htmlPathOrOpts.shotsDir ?? null : extraOpts?.shotsDir ?? null;

  const errors = [];
  const warnings = [];
  const nits = [];

  if (!htmlPath) {
    errors.push("Missing <page.html> path.");
    return { ok: false, sceneId: "unknown", htmlSha256: null, shortSha: "", errors, warnings, nits, review: null };
  }
  const absHtml = resolve(htmlPath);
  if (!existsSync(absHtml)) {
    errors.push(`HTML file not found: ${absHtml}`);
    return { ok: false, sceneId: "unknown", htmlSha256: null, shortSha: "", errors, warnings, nits, review: null };
  }

  const htmlBuf = readFileSync(absHtml);
  const htmlStat = statSync(absHtml);
  const liveHtmlSha256 = computeHtmlSha256(htmlBuf);
  const shortSha = liveHtmlSha256.slice(0, 12);

  let htmlSceneId = null;
  try {
    const cfg = extractStudioConfigFromHtml(htmlBuf.toString("utf8"));
    if (cfg && typeof cfg.sceneId === "string" && cfg.sceneId.trim()) {
      htmlSceneId = cfg.sceneId.trim();
    }
  } catch {
    // Allow verification on minimal HTML fixtures without STUDIO_CONFIG
  }

  if (!reviewPath) {
    errors.push("Missing --review <review.json> path.");
    return {
      ok: false,
      sceneId: htmlSceneId || "unknown",
      htmlSha256: liveHtmlSha256,
      shortSha,
      errors,
      warnings,
      nits,
      review: null,
    };
  }
  const absReview = resolve(reviewPath);
  if (!existsSync(absReview)) {
    errors.push(`Review file not found: ${absReview}`);
    return {
      ok: false,
      sceneId: htmlSceneId || "unknown",
      htmlSha256: liveHtmlSha256,
      shortSha,
      errors,
      warnings,
      nits,
      review: null,
    };
  }

  let review = null;
  try {
    review = JSON.parse(readFileSync(absReview, "utf8"));
  } catch (err) {
    errors.push(`Invalid JSON in review file ${absReview}: ${err?.message ?? err}`);
    return {
      ok: false,
      sceneId: htmlSceneId || "unknown",
      htmlSha256: liveHtmlSha256,
      shortSha,
      errors,
      warnings,
      nits,
      review: null,
    };
  }

  if (!review || typeof review !== "object" || Array.isArray(review)) {
    errors.push("Review JSON must be a top-level object.");
    return {
      ok: false,
      sceneId: htmlSceneId || "unknown",
      htmlSha256: liveHtmlSha256,
      shortSha,
      errors,
      warnings,
      nits,
      review,
    };
  }

  if (review.reviewer !== "independent") {
    errors.push(
      `Invalid reviewer metadata: reviewer must be "independent" (got ${JSON.stringify(review.reviewer)}). Dispatch fresh zero-context subagents per SKILL.md.`,
    );
  }

  if (review.round !== undefined) {
    if (!Number.isInteger(review.round) || review.round < 1) {
      errors.push(`Invalid "round": expected positive integer (got ${JSON.stringify(review.round)}).`);
    } else if (review.round > MAX_REVIEW_ROUNDS) {
      warnings.push(
        `Circuit breaker note: review round ${review.round} exceeds max_rounds (${MAX_REVIEW_ROUNDS}). Stop iterating on polish and ship once blockers are zero.`,
      );
    }
  }

  if (typeof review.htmlSha256 !== "string" || review.htmlSha256 !== liveHtmlSha256) {
    errors.push(
      `Stale or mismatched htmlSha256: review has ${JSON.stringify(review.htmlSha256)}, live HTML is ${liveHtmlSha256}. Re-run check-studio.mjs --shots and fresh-context verifiers after edits.`,
    );
  }

  if (modelPath) {
    const absModel = resolve(modelPath);
    if (!existsSync(absModel)) {
      errors.push(`Specified --model file not found: ${absModel}`);
    } else {
      const liveModelSha256 = computeFileSha256(absModel);
      if (typeof review.modelSha256 !== "string" || review.modelSha256 !== liveModelSha256) {
        errors.push(
          `Stale or mismatched modelSha256: review has ${JSON.stringify(review.modelSha256)}, live model ${absModel} is ${liveModelSha256}.`,
        );
      }
    }
  }

  if (shotsDir) {
    const absShots = resolve(shotsDir);
    const stampPath = join(absShots, CHECK_STAMP_FILE);
    if (!existsSync(stampPath)) {
      errors.push(
        `Missing check-studio pass stamp: ${stampPath}. Run check-studio.mjs ${absHtml} --shots ${absShots} until it exits 0.`,
      );
    } else {
      let stamp = null;
      try {
        stamp = JSON.parse(readFileSync(stampPath, "utf8"));
      } catch (err) {
        errors.push(`Invalid JSON in check-studio pass stamp ${stampPath}: ${err?.message ?? err}`);
      }
      if (stamp) {
        if (stamp.status !== "passed") {
          errors.push(
            `check-studio stamp ${stampPath} did not pass (status=${JSON.stringify(stamp.status)}). Fix check-studio failures first.`,
          );
        }
        if (typeof stamp.htmlSha256 !== "string" || stamp.htmlSha256 !== liveHtmlSha256) {
          errors.push(
            `Stale check-studio pass stamp: stamp has ${JSON.stringify(stamp.htmlSha256)}, live HTML is ${liveHtmlSha256}. Re-run check-studio.mjs --shots.`,
          );
        }
      }
    }

    const recordedShots =
      review.shotSha256s && typeof review.shotSha256s === "object" && !Array.isArray(review.shotSha256s)
        ? review.shotSha256s
        : null;

    if (!recordedShots) {
      errors.push(
        `Missing or invalid "shotSha256s" map in review JSON when verifying --shots ${absShots}. Re-run studio-review.mjs brief with --shots.`,
      );
    }

    const shotNames = new Set([...EXPECTED_SHOTS, ...Object.keys(recordedShots || {})]);
    for (const name of shotNames) {
      const fullPath = join(absShots, name);
      if (!existsSync(fullPath)) {
        errors.push(`Missing screenshot during verify: ${fullPath}`);
        continue;
      }
      const st = statSync(fullPath);
      if (st.mtimeMs < htmlStat.mtimeMs) {
        errors.push(
          `Stale screenshot "${name}": ${fullPath} is older than ${absHtml}. Re-run check-studio.mjs --shots before verifying.`,
        );
      }
      if (recordedShots) {
        const liveShotSha = computeFileSha256(fullPath);
        if (typeof recordedShots[name] !== "string" || recordedShots[name] !== liveShotSha) {
          errors.push(
            `Mismatched shotSha256s["${name}"]: review has ${JSON.stringify(recordedShots[name])}, live PNG is ${liveShotSha}.`,
          );
        }
      }
    }
  }

  if (htmlSceneId && review.sceneId && review.sceneId !== htmlSceneId) {
    errors.push(
      `Scene ID mismatch: review has ${JSON.stringify(review.sceneId)}, live HTML STUDIO_CONFIG has ${JSON.stringify(htmlSceneId)}.`,
    );
  }

  validateSection("conceptual", review.conceptual, errors, nits);
  validateSection("visual", review.visual, errors, nits);

  const sceneId = String(review.sceneId || htmlSceneId || "unknown");
  return {
    ok: errors.length === 0,
    sceneId,
    htmlSha256: liveHtmlSha256,
    shortSha,
    errors,
    warnings,
    nits,
    review,
  };
}

function parseCliArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help") {
    return { cmd: "help" };
  }

  let htmlPath = null;
  let shotsDir = null;
  let modelPath = null;
  let outPath = null;
  let reviewPath = null;
  let round = 1;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--shots") shotsDir = rest[++i] ?? null;
    else if (arg === "--model") modelPath = rest[++i] ?? null;
    else if (arg === "--out") outPath = rest[++i] ?? null;
    else if (arg === "--review") reviewPath = rest[++i] ?? null;
    else if (arg === "--round") round = Number(rest[++i] ?? 1);
    else if (arg === "-h" || arg === "--help") return { cmd: "help" };
    else if (!arg.startsWith("--") && !htmlPath) htmlPath = arg;
  }

  return { cmd, htmlPath, shotsDir, modelPath, outPath, reviewPath, round };
}

function printUsage(stream = process.stdout) {
  stream.write(
    [
      "Usage:",
      "  node scripts/studio-review.mjs brief <page.html> --shots <shotsDir> [--model <model.mjs>] [--out <review.json>] [--round <1|2>]",
      "  node scripts/studio-review.mjs verify <page.html> --review <review.json> [--shots <shotsDir>] [--model <model.mjs>]",
      "",
    ].join("\n"),
  );
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.cmd === "help") {
    printUsage(process.stdout);
    process.exit(0);
  }

  if (args.cmd === "brief") {
    if (!args.htmlPath || !args.shotsDir) {
      console.error("studio-review brief: requires <page.html> and --shots <shotsDir>.");
      printUsage(process.stderr);
      process.exit(1);
    }
    const brief = buildReviewBrief({
      htmlPath: args.htmlPath,
      shotsDir: args.shotsDir,
      modelPath: args.modelPath,
      outPath: args.outPath,
      round: args.round,
    });
    console.log(brief.text);
    process.exit(0);
  }

  if (args.cmd === "verify") {
    if (!args.htmlPath || !args.reviewPath) {
      console.error("studio-review verify: requires <page.html> and --review <review.json>.");
      printUsage(process.stderr);
      process.exit(1);
    }
    const res = verifyReviewFile({
      htmlPath: args.htmlPath,
      reviewPath: args.reviewPath,
      shotsDir: args.shotsDir,
      modelPath: args.modelPath,
    });
    if (!res.ok) {
      console.error(`studio-review: FAILED (${res.errors.length} violation${res.errors.length === 1 ? "" : "s"}):`);
      for (const err of res.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log(
      `studio-review: passed (${res.sceneId}, conceptual: pass, visual: pass, sha256: ${res.shortSha})`,
    );
    for (const warn of res.warnings) {
      console.warn(`studio-review: warning: ${warn}`);
    }
    if (res.nits.length > 0) {
      console.log(`studio-review: non-blocking nits (${res.nits.length}):`);
      for (const nit of res.nits) {
        console.log(`  - ${nit}`);
      }
    }
    process.exit(0);
  }

  console.error(`studio-review: unknown subcommand "${args.cmd}". Expected "brief" or "verify".`);
  printUsage(process.stderr);
  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(`studio-review: ${err?.message ?? err}`);
    process.exit(1);
  }
}
