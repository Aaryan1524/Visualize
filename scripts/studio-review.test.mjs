import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CHECK_STAMP_FILE,
  EXPECTED_SHOTS,
  MAX_REVIEW_ROUNDS,
  buildReviewBrief,
  computeFileSha256,
  computeHtmlSha256,
  verifyReviewFile,
} from "./studio-review.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const STUDIO_REVIEW = join(ROOT, "scripts", "studio-review.mjs");
const TMP_ROOT = mkdtempSync(join(tmpdir(), "viz-studio-review-test-"));

after(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

function makeFixtureHtml(sceneId = "perfume-atomizer", extraBody = "") {
  const cfg = {
    sceneId,
    title: "Perfume Venturi Atomizer",
    variants: [
      { name: "fine", label: "Fine Mist", defaults: { press: 70 } },
      { name: "coarse", label: "Coarse Spray", defaults: { press: 40 } },
    ],
    controls: [{ id: "press", label: "Thumb Force", min: 10, max: 100, unit: "%" }],
    telemetry: [{ id: "dropKpa", label: "Throat ΔP", formatSrc: "(s) => `${s.dropKpa} kPa`" }],
    steps: [
      {
        step: 0,
        tab: "Overview",
        title: "Press the nozzle",
        narration: "Pressing the pump pushes air over the dip tube throat.",
        focus: null,
        sim: { press: 70 },
        callouts: [{ target: "nozzle", label: "Venturi throat" }],
        tryOut: null,
      },
      {
        step: 1,
        tab: "Try",
        title: "Atomize the perfume",
        narration: "Increase thumb force past 80% to drop throat pressure below atmospheric.",
        focus: ["throat", "mist"],
        sim: { press: 85 },
        callouts: [{ target: "mist", label: "Atomized plume" }],
        tryOut: {
          prompt: "Raise Thumb Force to at least 85%.",
          checkSrc: "(sim) => sim.press >= 85",
          successText: "Verified!",
        },
      },
    ],
  };

  return `<!doctype html>
<html>
<body>
<script>
const STUDIO_CONFIG = ${JSON.stringify(cfg)};
</script>
${extraBody}
</body>
</html>
`;
}

function writeFreshShots(shotsDir, offsetMs = 2000, htmlForStamp = null) {
  mkdirSync(shotsDir, { recursive: true });
  const futureDate = new Date(Date.now() + offsetMs);
  const shas = {};
  for (let i = 0; i < EXPECTED_SHOTS.length; i++) {
    const name = EXPECTED_SHOTS[i];
    const p = join(shotsDir, name);
    const buf = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from(`shot-${i}-${name}`)]);
    writeFileSync(p, buf);
    utimesSync(p, futureDate, futureDate);
    shas[name] = computeHtmlSha256(buf);
  }
  if (htmlForStamp !== null) {
    writeFileSync(
      join(shotsDir, CHECK_STAMP_FILE),
      JSON.stringify({
        status: "passed",
        htmlSha256: computeHtmlSha256(htmlForStamp),
        timestamp: new Date().toISOString(),
      }),
      "utf8",
    );
  }
  return shas;
}

describe("scripts/studio-review.mjs fresh-context final verifier gate", () => {
  it("builds a 2-prompt Dispatch Packet with SHA-256 bindings, fork_turns guidance, and dark-mode tile token note", () => {
    const dir = join(TMP_ROOT, "brief-case");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "atomizer.html");
    const modelPath = join(dir, "model.mjs");
    const shotsDir = join(dir, "shots");
    const outPath = join(dir, "review.json");

    const html = makeFixtureHtml("perfume-atomizer");
    const modelSrc = "export function simModel() { return { press: 70, dropKpa: 12 }; }\n";
    writeFileSync(htmlPath, html, "utf8");
    writeFileSync(modelPath, modelSrc, "utf8");
    const expectedShotShas = writeFreshShots(shotsDir, 5000, html);

    const sha = computeHtmlSha256(html);
    const modelSha = computeFileSha256(modelPath);
    assert.equal(sha.length, 64);
    assert.equal(sha, computeHtmlSha256(Buffer.from(html, "utf8")));

    const brief = buildReviewBrief({ htmlPath, shotsDir, modelPath, outPath });
    assert.equal(brief.htmlSha256, sha);
    assert.equal(brief.modelSha256, modelSha);
    assert.deepEqual(brief.shotSha256s, expectedShotShas);
    assert.equal(brief.round, 1);
    assert.equal(brief.sceneId, "perfume-atomizer");
    assert.equal(brief.warnings.length, 0);
    assert.equal(brief.shots.length, 4);
    assert.ok(brief.shots.every((s) => s.exists && s.fresh && typeof s.sha256 === "string"));

    // Two clearly delimited ready-to-send verifier prompts
    assert.match(brief.text, /=== COPY-PASTE PROMPT: VERIFIER 1 ===/);
    assert.match(brief.text, /=== END PROMPT: VERIFIER 1 ===/);
    assert.match(brief.text, /=== COPY-PASTE PROMPT: VERIFIER 2 ===/);
    assert.match(brief.text, /=== END PROMPT: VERIFIER 2 ===/);
    assert.match(brief.text, /VERIFIER 1 — End-to-End Concept & Physics Auditor/);
    assert.match(brief.text, /VERIFIER 2 — Visual Design Director/);
    assert.match(brief.text, /ZERO CODE BIAS/);
    assert.match(brief.text, /fork_turns="none"/);
    assert.match(brief.text, /matte-ivory ceramic tiles on `#111317` dark obsidian/i);
    assert.doesNotMatch(brief.text, /self-review is blocked by/i);
    assert.match(brief.text, /verify enforces independent metadata, live HTML\/model\/screenshot SHA-256 freshness/i);
    assert.match(brief.text, new RegExp(sha));
    assert.match(brief.text, new RegExp(modelSha));
    assert.match(brief.text, /"reviewer": "independent"/);
    assert.match(brief.text, /"blockers": \[\]/);
    assert.match(brief.text, /"nits": \[\]/);
    assert.match(brief.text, /"shotSha256s":/);
    assert.match(brief.text, /studio-review\.mjs verify/);

    // CLI brief smoke check
    const cliOut = execFileSync(
      process.execPath,
      [STUDIO_REVIEW, "brief", htmlPath, "--shots", shotsDir, "--model", modelPath, "--out", outPath],
      { encoding: "utf8", cwd: ROOT },
    );
    assert.match(cliOut, /2-VERIFIER FRESH-CONTEXT DISPATCH PACKET/);
    assert.match(cliOut, /=== COPY-PASTE PROMPT: VERIFIER 1 ===/);
    assert.match(cliOut, /=== COPY-PASTE PROMPT: VERIFIER 2 ===/);
    assert.match(cliOut, new RegExp(sha));
  });

  it("warns clearly when screenshots are missing or stale", () => {
    const dir = join(TMP_ROOT, "stale-shots");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const shotsDir = join(dir, "shots");
    mkdirSync(shotsDir, { recursive: true });

    writeFileSync(htmlPath, makeFixtureHtml("stale-demo"), "utf8");
    const pastDate = new Date(Date.now() - 60_000);
    const stalePng = join(shotsDir, "step0-light.png");
    writeFileSync(stalePng, Buffer.from("89504e470d0a1a0a", "hex"));
    utimesSync(stalePng, pastDate, pastDate);

    const brief = buildReviewBrief({ htmlPath, shotsDir });
    assert.equal(brief.warnings.length, 5); // 1 stale + 3 missing + 1 missing check-studio stamp
    assert.ok(brief.warnings.some((w) => /Stale screenshot: .*step0-light\.png/.test(w)));
    assert.ok(brief.warnings.some((w) => /Missing screenshot: .*step0-dark\.png/.test(w)));
    assert.match(brief.text, /WARNINGS:/);
  });

  it("passes verification with blockers[]/nits[], shotSha256s, and modelSha256 — allowing non-blocking nits", () => {
    const dir = join(TMP_ROOT, "valid-pass-v2");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "atomizer.html");
    const modelPath = join(dir, "model.mjs");
    const shotsDir = join(dir, "shots");
    const reviewPath = join(dir, "review.json");

    const html = makeFixtureHtml("perfume-atomizer");
    writeFileSync(htmlPath, html, "utf8");
    writeFileSync(modelPath, "export function simModel() { return { press: 70 }; }\n", "utf8");
    const shotSha256s = writeFreshShots(shotsDir, 4000, html);
    const sha = computeHtmlSha256(html);
    const modelSha = computeFileSha256(modelPath);

    writeFileSync(
      reviewPath,
      JSON.stringify(
        {
          reviewer: "independent",
          round: 1,
          htmlSha256: sha,
          modelSha256: modelSha,
          shotSha256s,
          sceneId: "perfume-atomizer",
          conceptual: {
            status: "pass",
            summary: "Physics and telemetry match.",
            blockers: [],
            nits: ["Step 0 narration could trim 4 words for brevity."],
          },
          visual: {
            status: "pass",
            summary: "Clean 3D CAD in light and dark modes.",
            blockers: [],
            nits: ["Consider slightly warmer rim highlight in dark mode."],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const res = verifyReviewFile({ htmlPath, reviewPath, shotsDir, modelPath });
    assert.equal(res.ok, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.warnings.length, 0);
    assert.equal(res.nits.length, 2);
    assert.equal(res.sceneId, "perfume-atomizer");
    assert.equal(res.htmlSha256, sha);

    const stdout = execFileSync(
      process.execPath,
      [STUDIO_REVIEW, "verify", htmlPath, "--review", reviewPath, "--shots", shotsDir, "--model", modelPath],
      { encoding: "utf8", cwd: ROOT },
    );
    assert.match(
      stdout,
      new RegExp(`studio-review: passed \\(perfume-atomizer, conceptual: pass, visual: pass, sha256: ${sha.slice(0, 12)}\\)`),
    );
    assert.match(stdout, /non-blocking nits \(2\)/);
  });

  it("maintains backwards compatibility with legacy findings[] schema", () => {
    const dir = join(TMP_ROOT, "legacy-pass");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "atomizer.html");
    const reviewPath = join(dir, "review.json");

    const html = makeFixtureHtml("perfume-atomizer");
    writeFileSync(htmlPath, html, "utf8");
    const sha = computeHtmlSha256(html);

    writeFileSync(
      reviewPath,
      JSON.stringify(
        {
          reviewer: "independent",
          htmlSha256: sha,
          sceneId: "perfume-atomizer",
          conceptual: { status: "pass", summary: "Physics and telemetry match.", findings: [] },
          visual: { status: "pass", summary: "Clean 3D CAD in light and dark modes.", findings: [] },
        },
        null,
        2,
      ),
      "utf8",
    );

    const res = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(res.ok, true);
    assert.equal(res.errors.length, 0);

    const stdout = execFileSync(
      process.execPath,
      [STUDIO_REVIEW, "verify", htmlPath, "--review", reviewPath],
      { encoding: "utf8", cwd: ROOT },
    );
    assert.equal(
      stdout.trim(),
      `studio-review: passed (perfume-atomizer, conceptual: pass, visual: pass, sha256: ${sha.slice(0, 12)})`,
    );
  });

  it("rejects non-empty blockers[] even if status claims pass", () => {
    const dir = join(TMP_ROOT, "open-blockers");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const reviewPath = join(dir, "review.json");
    const html = makeFixtureHtml("open-blockers-demo");
    writeFileSync(htmlPath, html, "utf8");
    const sha = computeHtmlSha256(html);

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 1,
        htmlSha256: sha,
        modelSha256: null,
        shotSha256s: {},
        sceneId: "open-blockers-demo",
        conceptual: {
          status: "pass",
          summary: "Mostly good",
          blockers: ["Step 1 checkSrc disagrees with prompt threshold"],
          nits: [],
        },
        visual: {
          status: "pass",
          summary: "Overlap present",
          blockers: ["Callout clips subtitle in mid-focus.png"],
          nits: ["Tiny spacing polish"],
        },
      }),
      "utf8",
    );

    const res = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(res.ok, false);
    assert.equal(res.errors.length, 2);
    assert.ok(res.errors.some((e) => /Open conceptual blocker/.test(e)));
    assert.ok(res.errors.some((e) => /Open visual blocker/.test(e)));
  });

  it("detects shotSha256s tampering and stale screenshots during verify --shots", () => {
    const dir = join(TMP_ROOT, "shot-tamper");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const shotsDir = join(dir, "shots");
    const reviewPath = join(dir, "review.json");

    const html = makeFixtureHtml("shot-tamper-demo");
    writeFileSync(htmlPath, html, "utf8");
    const shotSha256s = writeFreshShots(shotsDir, 4000, html);
    const sha = computeHtmlSha256(html);

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 1,
        htmlSha256: sha,
        modelSha256: null,
        shotSha256s,
        sceneId: "shot-tamper-demo",
        conceptual: { status: "pass", summary: "ok", blockers: [], nits: [] },
        visual: { status: "pass", summary: "ok", blockers: [], nits: [] },
      }),
      "utf8",
    );

    // Passes initially
    assert.equal(verifyReviewFile({ htmlPath, reviewPath, shotsDir }).ok, true);

    // 1. Tamper PNG bytes -> SHA mismatch must fail
    const tamperedPath = join(shotsDir, "mid-focus.png");
    writeFileSync(tamperedPath, Buffer.from("89504e470d0a1a0a-tampered"));
    const futureDate = new Date(Date.now() + 6000);
    utimesSync(tamperedPath, futureDate, futureDate);
    const tampered = verifyReviewFile({ htmlPath, reviewPath, shotsDir });
    assert.equal(tampered.ok, false);
    assert.ok(tampered.errors.some((e) => /Mismatched shotSha256s\["mid-focus\.png"\]/.test(e)));

    // 2. Make step0-dark.png older than HTML -> stale screenshot must fail
    const stalePath = join(shotsDir, "step0-dark.png");
    const pastDate = new Date(Date.now() - 60_000);
    utimesSync(stalePath, pastDate, pastDate);
    const stale = verifyReviewFile({ htmlPath, reviewPath, shotsDir });
    assert.equal(stale.ok, false);
    assert.ok(stale.errors.some((e) => /Stale screenshot "step0-dark\.png"/.test(e)));
  });

  it("detects modelSha256 mismatch when model.mjs changes after review", () => {
    const dir = join(TMP_ROOT, "model-tamper");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const modelPath = join(dir, "model.mjs");
    const reviewPath = join(dir, "review.json");

    const html = makeFixtureHtml("model-tamper-demo");
    writeFileSync(htmlPath, html, "utf8");
    writeFileSync(modelPath, "export function simModel() { return { x: 1 }; }\n", "utf8");
    const sha = computeHtmlSha256(html);
    const modelSha = computeFileSha256(modelPath);

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 1,
        htmlSha256: sha,
        modelSha256: modelSha,
        shotSha256s: {},
        sceneId: "model-tamper-demo",
        conceptual: { status: "pass", summary: "ok", blockers: [], nits: [] },
        visual: { status: "pass", summary: "ok", blockers: [], nits: [] },
      }),
      "utf8",
    );

    assert.equal(verifyReviewFile({ htmlPath, reviewPath, modelPath }).ok, true);

    // Edit model.mjs -> must now fail
    writeFileSync(modelPath, "export function simModel() { return { x: 999 }; }\n", "utf8");
    const afterModelEdit = verifyReviewFile({ htmlPath, reviewPath, modelPath });
    assert.equal(afterModelEdit.ok, false);
    assert.ok(afterModelEdit.errors.some((e) => /Stale or mismatched modelSha256/i.test(e)));
  });

  it("emits circuit breaker warning when round exceeds max_rounds (2)", () => {
    assert.equal(MAX_REVIEW_ROUNDS, 2);
    const dir = join(TMP_ROOT, "round-warning");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const reviewPath = join(dir, "review.json");
    const html = makeFixtureHtml("round-demo");
    writeFileSync(htmlPath, html, "utf8");
    const sha = computeHtmlSha256(html);

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 3,
        htmlSha256: sha,
        modelSha256: null,
        shotSha256s: {},
        sceneId: "round-demo",
        conceptual: { status: "pass", summary: "ok", blockers: [], nits: [] },
        visual: { status: "pass", summary: "ok", blockers: [], nits: [] },
      }),
      "utf8",
    );

    const res = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(res.ok, true);
    assert.ok(res.warnings.some((w) => /exceeds max_rounds \(2\)/i.test(w)));
  });

  it("rejects missing or invalid JSON review files", () => {
    const dir = join(TMP_ROOT, "missing-review");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    writeFileSync(htmlPath, makeFixtureHtml("missing-demo"), "utf8");

    const missing = verifyReviewFile(htmlPath, join(dir, "does-not-exist.json"));
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((e) => /Review file not found/i.test(e)));

    const badJsonPath = join(dir, "bad.json");
    writeFileSync(badJsonPath, "{ not valid json", "utf8");
    const bad = verifyReviewFile(htmlPath, badJsonPath);
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => /Invalid JSON/i.test(e)));
  });

  it("rejects non-independent reviewer metadata via API and CLI", () => {
    const dir = join(TMP_ROOT, "self-review");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const reviewPath = join(dir, "review.json");
    const html = makeFixtureHtml("self-demo");
    writeFileSync(htmlPath, html, "utf8");

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "self",
        round: 1,
        htmlSha256: computeHtmlSha256(html),
        sceneId: "self-demo",
        conceptual: { status: "pass", summary: "ok", blockers: [], nits: [] },
        visual: { status: "pass", summary: "ok", blockers: [], nits: [] },
      }),
      "utf8",
    );

    const res = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /independent/i.test(e)));

    assert.throws(
      () =>
        execFileSync(process.execPath, [STUDIO_REVIEW, "verify", htmlPath, "--review", reviewPath], {
          stdio: "pipe",
          cwd: ROOT,
        }),
      (err) => err.status === 1 && /independent/i.test(String(err.stderr || "")),
    );
  });

  it("rejects stale SHA-256 after the HTML file is edited", () => {
    const dir = join(TMP_ROOT, "stale-sha");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const reviewPath = join(dir, "review.json");

    const htmlV1 = makeFixtureHtml("stale-sha-demo", "<!-- v1 -->");
    writeFileSync(htmlPath, htmlV1, "utf8");
    const shaV1 = computeHtmlSha256(htmlV1);

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 1,
        htmlSha256: shaV1,
        sceneId: "stale-sha-demo",
        conceptual: { status: "pass", summary: "ok", blockers: [], nits: [] },
        visual: { status: "pass", summary: "ok", blockers: [], nits: [] },
      }),
      "utf8",
    );

    assert.equal(verifyReviewFile(htmlPath, reviewPath).ok, true);

    // Edit HTML after review -> must now fail!
    writeFileSync(htmlPath, makeFixtureHtml("stale-sha-demo", "<!-- v2 tweaked -->"), "utf8");
    const afterEdit = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(afterEdit.ok, false);
    assert.ok(afterEdit.errors.some((e) => /Stale or mismatched htmlSha256/i.test(e)));
  });

  it("rejects failed conceptual or visual status", () => {
    const dir = join(TMP_ROOT, "failed-status");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const reviewPath = join(dir, "review.json");
    const html = makeFixtureHtml("fail-status-demo");
    writeFileSync(htmlPath, html, "utf8");
    const sha = computeHtmlSha256(html);

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 1,
        htmlSha256: sha,
        sceneId: "fail-status-demo",
        conceptual: { status: "fail", summary: "Sign error in delta-P", blockers: [], nits: [] },
        visual: { status: "pass", summary: "ok", blockers: [], nits: [] },
      }),
      "utf8",
    );
    const res1 = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(res1.ok, false);
    assert.ok(res1.errors.some((e) => /"conceptual\.status" must be "pass"/.test(e)));

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 1,
        htmlSha256: sha,
        sceneId: "fail-status-demo",
        conceptual: { status: "pass", summary: "ok", blockers: [], nits: [] },
        visual: { status: "fail", summary: "Label overlaps dock", blockers: [], nits: [] },
      }),
      "utf8",
    );
    const res2 = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(res2.ok, false);
    assert.ok(res2.errors.some((e) => /"visual\.status" must be "pass"/.test(e)));
  });

  it("rejects non-empty legacy findings[] even if status claims pass", () => {
    const dir = join(TMP_ROOT, "open-findings");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const reviewPath = join(dir, "review.json");
    const html = makeFixtureHtml("open-findings-demo");
    writeFileSync(htmlPath, html, "utf8");
    const sha = computeHtmlSha256(html);

    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        htmlSha256: sha,
        sceneId: "open-findings-demo",
        conceptual: {
          status: "pass",
          summary: "Mostly good",
          findings: ["Step 1 narration says kPa while telemetry displays Pa"],
        },
        visual: {
          status: "pass",
          summary: "Minor overlap",
          findings: ["Bottom callout clips subtitle bar in mid-focus.png"],
        },
      }),
      "utf8",
    );

    const res = verifyReviewFile(htmlPath, reviewPath);
    assert.equal(res.ok, false);
    assert.equal(res.errors.length, 2);
    assert.ok(res.errors.some((e) => /Open conceptual finding/.test(e)));
    assert.ok(res.errors.some((e) => /Open visual finding/.test(e)));
  });

  it("refuses copy-pasting the brief schema verbatim (uses <pass|fail> placeholders instead of pre-filled pass)", () => {
    const dir = join(TMP_ROOT, "anti-copy-paste");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const shotsDir = join(dir, "shots");
    const reviewPath = join(dir, "review.json");
    const html = makeFixtureHtml("anti-copy-demo");
    writeFileSync(htmlPath, html, "utf8");
    writeFreshShots(shotsDir, 4000, html);

    const brief = buildReviewBrief({ htmlPath, shotsDir, outPath: reviewPath });
    assert.equal(brief.schema.conceptual.status, "<pass|fail>");
    assert.equal(brief.schema.visual.status, "<pass|fail>");
    assert.doesNotMatch(JSON.stringify(brief.schema), /"status":"pass"/);
    assert.match(brief.text, /"status": "<pass\|fail>"/);

    // Copying brief.schema verbatim into review.json must FAIL verify!
    writeFileSync(reviewPath, JSON.stringify(brief.schema, null, 2), "utf8");
    const res = verifyReviewFile({ htmlPath, reviewPath, shotsDir });
    assert.equal(res.ok, false);
    assert.ok(res.errors.some((e) => /"conceptual\.status" must be "pass"/.test(e)));
    assert.ok(res.errors.some((e) => /"visual\.status" must be "pass"/.test(e)));
  });

  it("rejects verify --shots when check-studio pass stamp is missing, failed, or stale", () => {
    const dir = join(TMP_ROOT, "check-stamp-gate");
    mkdirSync(dir, { recursive: true });
    const htmlPath = join(dir, "page.html");
    const shotsDir = join(dir, "shots");
    const reviewPath = join(dir, "review.json");
    const html = makeFixtureHtml("stamp-demo");
    writeFileSync(htmlPath, html, "utf8");
    const sha = computeHtmlSha256(html);

    // Fresh screenshots WITHOUT a check-studio pass stamp (e.g. page failed check-studio!)
    const shotSha256s = writeFreshShots(shotsDir, 4000, null);
    writeFileSync(
      reviewPath,
      JSON.stringify({
        reviewer: "independent",
        round: 1,
        htmlSha256: sha,
        shotSha256s,
        sceneId: "stamp-demo",
        conceptual: { status: "pass", summary: "ok", blockers: [], nits: [] },
        visual: { status: "pass", summary: "ok", blockers: [], nits: [] },
      }),
      "utf8",
    );

    const missingStamp = verifyReviewFile({ htmlPath, reviewPath, shotsDir });
    assert.equal(missingStamp.ok, false);
    assert.ok(missingStamp.errors.some((e) => /Missing check-studio pass stamp/.test(e)));

    // Stale/wrong-hash pass stamp -> must still fail!
    writeFileSync(
      join(shotsDir, CHECK_STAMP_FILE),
      JSON.stringify({ status: "passed", htmlSha256: "0".repeat(64) }),
      "utf8",
    );
    const staleStamp = verifyReviewFile({ htmlPath, reviewPath, shotsDir });
    assert.equal(staleStamp.ok, false);
    assert.ok(staleStamp.errors.some((e) => /Stale check-studio pass stamp/.test(e)));

    // Valid matching pass stamp -> now passes!
    writeFileSync(
      join(shotsDir, CHECK_STAMP_FILE),
      JSON.stringify({ status: "passed", htmlSha256: sha }),
      "utf8",
    );
    const validStamp = verifyReviewFile({ htmlPath, reviewPath, shotsDir });
    assert.equal(validStamp.ok, true);
  });
});
