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

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), "vz-brief-mode-"));
  const auditFile = join(dir, "demo.audit.json");
  const reviewFile = join(dir, "review.json");
  writeFileSync(
    auditFile,
    JSON.stringify({
      title: "Mechanical Watch",
      stamp: "1122334455667788",
      coverage: { source: "Watchmaking", topics: [{ topic: "escapement", where: "step:1" }] },
      claims: ["balance wheel regulates release"],
      texts: [{ where: "data.steps.0.heading", text: "How does a watch keep steady time?" }],
    }),
  );
  return { auditFile, reviewFile };
}

test("review-brief defaults to everyday mode with plain-English and real-object checks", () => {
  const { auditFile, reviewFile } = makeFixture();
  const outDefault = execFileSync(process.execPath, [BRIEF, auditFile, reviewFile], { encoding: "utf8" });
  const outExplicit = execFileSync(process.execPath, [BRIEF, auditFile, reviewFile, "--mode", "everyday"], { encoding: "utf8" });
  assert.equal(outDefault, outExplicit);
  assert.match(outDefault, /# Independent review: Mechanical Watch \(mode: everyday\)/);
  assert.match(outDefault, /"mode": "everyday"/);
  assert.match(outDefault, /Plain-English \/ College-Level Check/);
  assert.match(outDefault, /N·mm/);
  assert.match(outDefault, /Real-Object Representation Check/);
  assert.match(outDefault, /abstract boxes\/cells/);
  assert.match(outDefault, /Part 2 — Studio visual consistency/);
  assert.match(outDefault, /"reviewer": "independent"/);
});

test("review-brief --mode fast focuses on sanity checks and waives fast-mode omissions", () => {
  const { auditFile, reviewFile } = makeFixture();
  const out = execFileSync(process.execPath, [BRIEF, auditFile, reviewFile, "--mode", "fast"], { encoding: "utf8" });
  assert.match(out, /# Independent review: Mechanical Watch \(mode: fast\)/);
  assert.match(out, /"mode": "fast"/);
  assert.match(out, /fast sanity check/i);
  assert.match(out, /Real-Object Representation Check/);
  assert.match(out, /Do NOT fail/i);
  assert.match(out, /omitted What-if variants/);
  assert.match(out, /omitted (?:recorded )?voice/);
  assert.match(out, /"reviewer": "independent"/);
});

test("review-brief --mode technical demands full engineering rigor", () => {
  const { auditFile, reviewFile } = makeFixture();
  const out = execFileSync(process.execPath, [BRIEF, auditFile, reviewFile, "--mode", "technical"], { encoding: "utf8" });
  assert.match(out, /# Independent review: Mechanical Watch \(mode: technical\)/);
  assert.match(out, /"mode": "technical"/);
  assert.match(out, /full engineering rigor/i);
  assert.match(out, /SI\/domain units/);
  assert.match(out, /conservation laws/);
  assert.match(out, /multi-variant What-if/i);
  assert.match(out, /"reviewer": "independent"/);
});

test("review-brief --mode deep audits multi-chapter structure and per-chapter Predict checkpoints", () => {
  const { auditFile, reviewFile } = makeFixture();
  const out = execFileSync(process.execPath, [BRIEF, auditFile, reviewFile, "--mode", "deep"], { encoding: "utf8" });
  assert.match(out, /# Independent review: Mechanical Watch \(mode: deep\)/);
  assert.match(out, /"mode": "deep"/);
  assert.match(out, /4–6 substantive chapters/);
  assert.match(out, /Per-Chapter Predict Checkpoints/);
  assert.match(out, /core mechanism → failure\/edge cases → engineering trade-offs → real variants/);
  assert.match(out, /"reviewer": "independent"/);
});

test("review-brief enforces ruthless visual design director guardrails across all 4 modes", () => {
  const { auditFile, reviewFile } = makeFixture();
  for (const mode of ["everyday", "fast", "technical", "deep"]) {
    const out = execFileSync(process.execPath, [BRIEF, auditFile, reviewFile, "--mode", mode], { encoding: "utf8" });
    assert.match(out, /No Closed Opaque Step 0/i, `${mode}: must reject closed opaque Step 0`);
    assert.match(out, /Empty Ashtray/i, `${mode}: must reject floating/unmeshed parts and empty ashtray interiors`);
    assert.match(out, /No Impossible Layering or Part Collisions/i, `${mode}: must reject impossible layering or collisions`);
    assert.match(out, /No Clunky Decorative Straps\/Stands/i, `${mode}: must reject chunky straps/lugs/stands`);
    assert.match(out, /composeExplodedLayers/, `${mode}: must require clean vertical separation for flat layered machines`);
  }
});

test("review-brief rejects invalid --mode with exit code 2", () => {
  const { auditFile, reviewFile } = makeFixture();
  assert.throws(
    () => execFileSync(process.execPath, [BRIEF, auditFile, reviewFile, "--mode", "invalid"], { encoding: "utf8", stdio: "pipe" }),
    (err) => err.status === 2 && /invalid --mode/i.test(err.stderr),
  );
  assert.throws(
    () => execFileSync(process.execPath, [BRIEF, auditFile, reviewFile, "--mode"], { encoding: "utf8", stdio: "pipe" }),
    (err) => err.status === 2 && /missing value for --mode/i.test(err.stderr),
  );
});
