// node --test scripts/new-figure.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW_FIG = resolve(HERE, "new-figure.mjs");

test("new-figure rejects invalid --kind and invalid --mode with exit code 2", () => {
  assert.throws(
    () => execFileSync(process.execPath, [NEW_FIG, "demo-pump", "--kind", "widget", "--no-voice"], { encoding: "utf8", stdio: "pipe" }),
    (err) => err.status === 2 && /usage:/i.test(err.stderr),
  );
  assert.throws(
    () => execFileSync(process.execPath, [NEW_FIG, "demo-pump", "--kind", "object", "--mode", "turbo", "--no-voice"], { encoding: "utf8", stdio: "pipe" }),
    (err) => err.status === 2 && /invalid --mode/i.test(err.stderr),
  );
  assert.throws(
    () => execFileSync(process.execPath, [NEW_FIG, "demo-pump", "--kind", "object", "--mode"], { encoding: "utf8", stdio: "pipe" }),
    (err) => err.status === 2 && /missing value for --mode/i.test(err.stderr),
  );
});

test("new-figure --kind object --mode fast scaffolds, passes model/claims tests, and builds clean HTML + audit", () => {
  const tmp = mkdtempSync(join(tmpdir(), "vz-new-object-"));
  const dir = join(tmp, "spring-pump");
  try {
    // --mode fast skips voice automatically without needing --no-voice
    const stdout = execFileSync(
      process.execPath,
      [NEW_FIG, "spring-pump", "--kind", "object", "--mode", "fast", "--dir", dir, "--title", "Spring Pump"],
      { encoding: "utf8", stdio: "pipe" },
    );
    assert.match(stdout, /check-drawing\.mjs .* --fast/);
    assert.match(stdout, /shoot-steps\.mjs .* --fast/);
    assert.match(stdout, /review-brief\.mjs .* --mode fast/);
    assert.ok(!existsSync(join(dir, "voice.json")), "--mode fast must skip voice recording");

    // Verify template substitutions
    const buildSrc = readFileSync(join(dir, "build.mjs"), "utf8");
    assert.ok(!buildSrc.includes("__ROOT__") && !buildSrc.includes("__NAME__") && !buildSrc.includes("__TITLE__") && !buildSrc.includes("__MODE__"));
    assert.match(buildSrc, /Spring Pump/);
    assert.match(buildSrc, /mode: fast/);

    // Run generated unit & claims tests
    execFileSync(process.execPath, ["--test", join(dir, "model.test.mjs"), join(dir, "claims.test.mjs")], {
      cwd: dir,
      encoding: "utf8",
      stdio: "pipe",
    });

    // Build the standalone HTML page + .audit.json
    execFileSync(process.execPath, [join(dir, "build.mjs")], {
      cwd: dir,
      encoding: "utf8",
      stdio: "pipe",
    });

    const htmlPath = join(dir, "dist", "spring-pump.html");
    const auditPath = join(dir, "dist", "spring-pump.audit.json");
    assert.ok(existsSync(htmlPath), "built HTML page should exist");
    assert.ok(existsSync(auditPath), "built .audit.json should exist");

    const html = readFileSync(htmlPath, "utf8");
    assert.match(html, /<title>Spring Pump<\/title>/);
    assert.match(html, /rig-vessel/);
    assert.match(html, /rig-explainer/);
    assert.match(html, /rig-meter/);

    const audit = JSON.parse(readFileSync(auditPath, "utf8"));
    assert.equal(audit.review, "missing");
    assert.equal(
      audit.problems.filter((p) => !p.startsWith("review:")).length,
      0,
      `unexpected non-review audit problems: ${JSON.stringify(audit.problems)}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("new-figure prints --mode <mode> without --fast for non-fast modes", () => {
  const tmp = mkdtempSync(join(tmpdir(), "vz-new-everyday-"));
  const dir = join(tmp, "everyday-pump");
  try {
    const stdout = execFileSync(
      process.execPath,
      [NEW_FIG, "everyday-pump", "--kind", "object", "--mode", "technical", "--dir", dir, "--no-voice"],
      { encoding: "utf8", stdio: "pipe" },
    );
    assert.match(stdout, /review-brief\.mjs .* --mode technical/);
    assert.doesNotMatch(stdout, /check-drawing\.mjs .* --fast/);
    assert.doesNotMatch(stdout, /shoot-steps\.mjs .* --fast/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
