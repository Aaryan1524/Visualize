// node --test scripts/review-brief.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIEF = resolve(HERE, "review-brief.mjs");

test("review-brief includes conceptual sanity, studio visual rubric, auto-detected model & shots, and structured schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "vz-brief-"));
  const auditFile = join(dir, "demo.audit.json");
  const reviewFile = join(dir, "review.json");
  const modelFile = join(dir, "model.mjs");
  const shotsDir = join(dir, "shots");
  mkdirSync(shotsDir, { recursive: true });
  writeFileSync(modelFile, "export const x = 1;\n");
  writeFileSync(join(shotsDir, "step-00-light.png"), "");
  writeFileSync(join(shotsDir, "step-00-dark.png"), "");
  writeFileSync(
    auditFile,
    JSON.stringify({
      title: "Demo Gear",
      stamp: "abc12345def67890",
      coverage: { source: "Shigley", topics: [{ topic: "gear ratio", where: "step:1" }] },
      claims: ["torque rises as speed falls"],
      texts: [{ where: "data.steps.0.heading", text: "How do gears trade speed for force?" }],
    }),
  );

  const out = execFileSync(process.execPath, [BRIEF, auditFile, reviewFile], { encoding: "utf8" });
  assert.match(out, /Part 1 — Conceptual & domain sanity/);
  assert.match(out, /Part 2 — Studio visual consistency/);
  assert.match(out, /Part 3 — Cross-consistency/);
  assert.ok(out.includes(modelFile), "auto-detected model.mjs should appear in the brief");
  assert.ok(out.includes(shotsDir), "auto-detected shots dir should appear in the brief");
  assert.match(out, /step-00-dark\.png/);
  assert.match(out, /"reviewer": "independent"/);
  assert.match(out, /"conceptual": "pass \| fail"/);
  assert.match(out, /"visual": "pass \| fail"/);
  assert.match(out, /"stamp": "abc12345def67890"/);
});
