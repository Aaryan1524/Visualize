import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  auditStepMeta,
  checkCalloutChromeOverlap,
  checkVariantOverrideConflict,
  computeVariantKeys,
  isBadTelemetryValue,
  parseArgs,
  parseStudioConfigFromHtml,
} from "./check-studio.mjs";

describe("check-studio — Telemetry Hygiene (isBadTelemetryValue)", () => {
  it("catches blank, whitespace-only, question-mark placeholders, and NaN/undefined/Infinity", () => {
    assert.equal(isBadTelemetryValue(""), true);
    assert.equal(isBadTelemetryValue("   "), true);
    assert.equal(isBadTelemetryValue(null), true);
    assert.equal(isBadTelemetryValue(undefined), true);
    assert.equal(isBadTelemetryValue("?"), true);
    assert.equal(isBadTelemetryValue("? %"), true);
    assert.equal(isBadTelemetryValue("? ms"), true);
    assert.equal(isBadTelemetryValue("NaN"), true);
    assert.equal(isBadTelemetryValue("12.4 NaN kPa"), true);
    assert.equal(isBadTelemetryValue("undefined"), true);
    assert.equal(isBadTelemetryValue("Infinity"), true);
    assert.equal(isBadTelemetryValue("-Infinity"), true);
  });

  it("accepts clean formatted numeric and status telemetry strings", () => {
    assert.equal(isBadTelemetryValue("0"), false);
    assert.equal(isBadTelemetryValue("42.5 kPa"), false);
    assert.equal(isBadTelemetryValue("75%"), false);
    assert.equal(isBadTelemetryValue("HIT"), false);
    assert.equal(isBadTelemetryValue("3 / 4"), false);
  });

  it("fails auditStepMeta when telemetry has blank or ? % placeholder values", () => {
    const fails = auditStepMeta({
      step: 1,
      telemetry: [
        { id: "eff", label: "Efficiency", value: "? %" },
        { id: "rate", label: "Rate", value: "" },
        { id: "ok", label: "Flow", value: "12.0 L/s" },
      ],
    });
    assert.equal(fails.length, 2);
    assert.ok(fails.some((f) => /telemetry "eff"/.test(f)));
    assert.ok(fails.some((f) => /telemetry "rate"/.test(f)));
  });
});

describe("check-studio — Raw Callout Budget Enforcement (Engine A vs Engine C)", () => {
  it("fails Engine C when rawCalloutCount > 1 even if silently truncated to 1 or 2", () => {
    const fails = auditStepMeta(
      {
        step: 1,
        rawCalloutCount: 2,
        callouts: [{ target: "tile_a", label: "Tile A" }],
        visibleCallouts: [{ target: "tile_a", label: "Tile A", x: 100, y: 120, w: 90, h: 28 }],
      },
      { engine: "C", viewport: { width: 1440, height: 900 } },
    );
    assert.ok(fails.some((f) => /raw callout budget exceeded for Engine C/i.test(f)));
  });

  it("fails Engine A when rawCalloutCount > 2 even if silently truncated to 2", () => {
    const fails = auditStepMeta(
      {
        step: 2,
        rawCalloutCount: 3,
        callouts: [
          { target: "nozzle", label: "Nozzle" },
          { target: "throat", label: "Throat" },
        ],
        visibleCallouts: [
          { target: "nozzle", label: "Nozzle", x: 100, y: 120, w: 90, h: 28 },
          { target: "throat", label: "Throat", x: 300, y: 120, w: 90, h: 28 },
        ],
      },
      { engine: "A", viewport: { width: 1440, height: 900 } },
    );
    assert.ok(fails.some((f) => /raw callout budget exceeded for Engine A/i.test(f)));
  });

  it("passes valid Engine C (1 callout) and Engine A (2 callouts) budgets", () => {
    const okC = auditStepMeta(
      {
        step: 0,
        rawCalloutCount: 1,
        callouts: [{ target: "tile_a", label: "Tile A" }],
        visibleCallouts: [{ target: "tile_a", label: "Tile A", x: 120, y: 140, w: 96, h: 28 }],
        telemetry: [{ id: "hits", label: "Hits", value: "3 / 4" }],
      },
      { engine: "C", registeredIds: ["tile_a"], viewport: { width: 1440, height: 900 } },
    );
    assert.deepEqual(okC, []);

    const okA = auditStepMeta(
      {
        step: 0,
        rawCalloutCount: 2,
        callouts: [
          { target: "nozzle", label: "Nozzle" },
          { target: "throat", label: "Throat" },
        ],
        visibleCallouts: [
          { target: "nozzle", label: "Nozzle", x: 120, y: 140, w: 96, h: 28 },
          { target: "throat", label: "Throat", x: 420, y: 140, w: 96, h: 28 },
        ],
        telemetry: [{ id: "dp", label: "ΔP", value: "14.2 kPa" }],
      },
      { engine: "A", registeredIds: ["nozzle", "throat"], viewport: { width: 1440, height: 900 } },
    );
    assert.deepEqual(okA, []);
  });
});

describe("check-studio — Strict ID, Anchor & Camera Preset Validation", () => {
  it("fails on unknown focus, reveal, callout target, missing anchor, and unknown camera preset", () => {
    const fails = auditStepMeta(
      {
        step: 3,
        rawCalloutCount: 1,
        callouts: [{ target: "ghost_part", label: "Ghost" }],
        visibleCallouts: [],
        focus: ["nozzle", "typo_focus_id"],
        reveal: ["typo_reveal_id"],
        camera: { preset: "nonexistent_cam", zoom: 1.2 },
      },
      {
        engine: "A",
        registeredIds: ["nozzle", "throat", "bulb"],
        cameraPresets: ["hero", "overview", "closeup"],
        viewport: { width: 1440, height: 900 },
      },
    );

    assert.ok(fails.some((f) => /unknown focus ID "typo_focus_id"/.test(f)));
    assert.ok(fails.some((f) => /unknown reveal ID "typo_reveal_id"/.test(f)));
    assert.ok(fails.some((f) => /unknown callout target "ghost_part"/.test(f)));
    assert.ok(fails.some((f) => /expected 1 visible callout\(s\) but only 0/.test(f)));
    assert.ok(fails.some((f) => /unknown camera preset "nonexistent_cam"/.test(f)));
  });
});

describe("check-studio — Broken checkSrc & Trivially Pre-Solved Challenges", () => {
  it("fails when tryOut checkSrc fails to compile", () => {
    const fails = auditStepMeta({
      step: 4,
      hasTryOut: true,
      tryOutCompiledOk: false,
      challengeVerifiedOnArrival: false,
    });
    assert.ok(fails.some((f) => /tryOut checkSrc failed to compile/i.test(f)));
  });

  it("fails when tryOut challenge is already verified on initial arrival", () => {
    const fails = auditStepMeta({
      step: 4,
      hasTryOut: true,
      tryOutCompiledOk: true,
      challengeVerifiedOnArrival: true,
    });
    assert.ok(fails.some((f) => /already verified on initial arrival/i.test(f)));
  });
});

describe("check-studio — Callout vs Chrome Overlap (2px tolerance)", () => {
  const chrome = [
    { name: "#sd-subtitle", x: 420, y: 760, w: 600, h: 48 },
    { name: "#sd-challenge", x: 1060, y: 120, w: 340, h: 150 },
    { name: ".sd-dock", x: 440, y: 828, w: 560, h: 52 },
  ];

  it("detects callouts overlapping #sd-subtitle, #sd-challenge, and .sd-dock", () => {
    const badSub = checkCalloutChromeOverlap(
      [{ target: "a", label: "Low label", x: 500, y: 745, w: 120, h: 30 }],
      chrome,
      2,
    );
    assert.equal(badSub.length, 1);
    assert.equal(badSub[0].chromeName, "#sd-subtitle");

    const badChallenge = checkCalloutChromeOverlap(
      [{ target: "b", label: "Right label", x: 1020, y: 160, w: 110, h: 28 }],
      chrome,
      2,
    );
    assert.equal(badChallenge.length, 1);
    assert.equal(badChallenge[0].chromeName, "#sd-challenge");

    const badDock = checkCalloutChromeOverlap(
      [{ target: "c", label: "Dock label", x: 520, y: 816, w: 110, h: 28 }],
      chrome,
      2,
    );
    assert.equal(badDock.length, 1);
    assert.equal(badDock[0].chromeName, ".sd-dock");
  });

  it("allows callouts that clear chrome or brush within 2px tolerance", () => {
    const clear = checkCalloutChromeOverlap(
      [{ target: "a", label: "Clean", x: 500, y: 734, w: 120, h: 28 }], // overlaps by 2px at y=760..762 -> tolerated
      chrome,
      2,
    );
    assert.deepEqual(clear, []);
  });

  it("surfaces chrome overlap directly through auditStepMeta", () => {
    const fails = auditStepMeta(
      {
        step: 2,
        rawCalloutCount: 1,
        callouts: [{ target: "p1", label: "Blocked Label" }],
        visibleCallouts: [{ target: "p1", label: "Blocked Label", x: 1100, y: 140, w: 120, h: 28 }],
        chromeRects: chrome,
      },
      { engine: "A", viewport: { width: 1440, height: 900 } },
    );
    assert.ok(fails.some((f) => /overlaps #sd-challenge/.test(f)));
  });
});

describe("check-studio — Variant-Key Override Conflict (Pill Desync)", () => {
  it("catches step.sim explicitly setting a distinguishing variant key", () => {
    const variants = [
      { name: "perfume", defaults: { throatDiam: 1.6, viscosity: 1.0, pressure: 40 } },
      { name: "honey", defaults: { throatDiam: 1.6, viscosity: 8.5, pressure: 40 } },
    ];
    const vKeys = computeVariantKeys(variants);
    assert.deepEqual(vKeys, ["viscosity"]);

    const conflicts = checkVariantOverrideConflict(
      [
        { step: 0, sim: { pressure: 45 } },
        { step: 5, sim: { viscosity: 1.0, pressure: 60 } },
      ],
      vKeys,
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].step, 5);
    assert.equal(conflicts[0].key, "viscosity");
  });
});

describe("check-studio — HTML Config Fallback & CLI Flags", () => {
  it("parses embedded STUDIO_CONFIG JSON safely even with semicolons in narration strings", () => {
    const html = `<script>
const STUDIO_CONFIG = {"title":"Demo; Test","steps":[{"step":0,"narration":"A; B; {C}"}]};
(function(){})();
</script>`;
    const parsed = parseStudioConfigFromHtml(html);
    assert.equal(parsed.title, "Demo; Test");
    assert.equal(parsed.steps[0].narration, "A; B; {C}");
  });

  it("parses --shots, --fast, and --all-steps flags cleanly", () => {
    const args = parseArgs(["dist/demo.html", "--shots", "/tmp/shots", "--fast", "--all-steps"]);
    assert.deepEqual(args, {
      file: "dist/demo.html",
      shotsDir: "/tmp/shots",
      fast: true,
      allSteps: true,
    });
  });
});
