// node --test examples/turbofan/model.test.mjs
//
// Verifies the everyday turbofan model against real turbofan bypass & thrust-split physics:
//   - Airliner 8:1 high-bypass: 80% cool fan push / 20% hot core push (89% bypass air, 80% shaft power)
//   - Fighter 1:1 low-bypass: 35% cool fan push / 65% hot core push (50% bypass air, 55% shaft power)
//   - Ultra-high 10:1 bypass: 83% cool fan push / 17% hot core push (82% shaft power)
//   - Monotonic thrust-split & turbine-extraction curves across bypass ratios 1..10
//   - Core squeeze scales smoothly with throttle from 6x at 20% to 30x at 100%
//   - Steps 0..2 hide the push split before the Step 3 reveal (zero Predict spoilers!)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AIRLINER_BYPASS,
  BASE,
  CORE_SQUEEZE_FULL,
  FIGHTER_BYPASS,
  MAX_BYPASS,
  MAX_THROTTLE_PCT,
  MIN_BYPASS,
  MIN_THROTTLE_PCT,
  MODELS,
  TURBINE_EXTRACT_AIRLINER_PCT,
  TURBINE_EXTRACT_FIGHTER_PCT,
  TURBINE_EXTRACT_MAX_PCT,
  bypassAirShare,
  corePushShare,
  coreSqueezeAt,
  fanPushShare,
  simulateEngine,
  turbineExtractShare,
} from "./model.mjs";

test("model: airliner 8:1, fighter 1:1, and 10:1 push & turbine extraction hit exact physical anchors", () => {
  assert.equal(BASE, "airliner");
  assert.equal(fanPushShare(AIRLINER_BYPASS), 80);
  assert.equal(corePushShare(AIRLINER_BYPASS), 20);
  assert.equal(bypassAirShare(AIRLINER_BYPASS), 89);
  assert.equal(turbineExtractShare(AIRLINER_BYPASS), TURBINE_EXTRACT_AIRLINER_PCT);
  assert.equal(TURBINE_EXTRACT_AIRLINER_PCT, 80);

  assert.equal(fanPushShare(FIGHTER_BYPASS), 35);
  assert.equal(corePushShare(FIGHTER_BYPASS), 65);
  assert.equal(bypassAirShare(FIGHTER_BYPASS), 50);
  assert.equal(turbineExtractShare(FIGHTER_BYPASS), TURBINE_EXTRACT_FIGHTER_PCT);
  assert.equal(TURBINE_EXTRACT_FIGHTER_PCT, 55);

  assert.equal(fanPushShare(MAX_BYPASS), 83);
  assert.equal(corePushShare(MAX_BYPASS), 17);
  assert.equal(turbineExtractShare(MAX_BYPASS), TURBINE_EXTRACT_MAX_PCT);
  assert.equal(TURBINE_EXTRACT_MAX_PCT, 82);
});

test("model: fan push share and turbine extraction increase monotonically from 1:1 to 10:1", () => {
  let prevFan = 0;
  let prevTurb = 0;
  for (let b = MIN_BYPASS; b <= MAX_BYPASS; b++) {
    const f = fanPushShare(b);
    const c = corePushShare(b);
    const t = turbineExtractShare(b);
    assert.equal(f + c, 100, `bypass ${b}:1 must conserve 100% total push`);
    assert.ok(f > prevFan, `bypass ${b}:1 fan push (${f}%) must exceed previous (${prevFan}%)`);
    assert.ok(t > prevTurb, `bypass ${b}:1 turbine extraction (${t}%) must exceed previous (${prevTurb}%)`);
    prevFan = f;
    prevTurb = t;
  }
});

test("model: compressor squeeze and throttle simulation scale monotonically without NaN", () => {
  assert.equal(coreSqueezeAt(MIN_THROTTLE_PCT), 6);
  assert.equal(coreSqueezeAt(MAX_THROTTLE_PCT), CORE_SQUEEZE_FULL);

  for (let t = MIN_THROTTLE_PCT; t <= MAX_THROTTLE_PCT; t += 10) {
    const sim = simulateEngine(MODELS.airliner, t, AIRLINER_BYPASS);
    assert.equal(sim.fanPushPct + sim.corePushPct, 100);
    assert.equal(sim.fanPushPoints + sim.corePushPoints, t);
    assert.equal(sim.turbineExtractPct, 80);
    assert.ok(sim.squeezeFactor >= 6 && sim.squeezeFactor <= 30);
    assert.ok(sim.burnerGlow > 0 && sim.burnerGlow <= 1);
    assert.ok(sim.fanSpeed > 0 && sim.fanSpeed <= 1);
  }
  const fighterSim = simulateEngine(MODELS.fighter, 90, FIGHTER_BYPASS);
  assert.equal(fighterSim.turbineExtractPct, 55);
});

test("model: every variant builds 6 distinct causal steps, hides push split before Step 3, and matches fighter Step 3 HUD", () => {
  for (const [name, M] of Object.entries(MODELS)) {
    assert.equal(M.steps.length, 6, `${name}: expected 6 narrative steps`);
    assert.equal(M.concept.step, 0);
    assert.equal(M.concept.hidePushSplit, true, `${name}: step 0 hides push split before Predict`);
    assert.equal(M.steps[0].hidePushSplit, true, `${name}: step 1 hides push split before Predict`);
    assert.equal(M.steps[1].hidePushSplit, true, `${name}: step 2 hides push split for Predict`);
    assert.equal(M.steps[2].hidePushSplit, false, `${name}: step 3 reveals push split`);
    assert.equal(M.steps[3].squeezeFactor, 30, `${name}: step 4 shows 30x core squeeze`);
    assert.equal(M.steps[4].turbineExtractPct, M.turbineExtractPct, `${name}: step 5 uses variant turbine extraction`);
    for (const s of [M.concept, ...M.steps]) {
      assert.ok(Array.isArray(s.hudRows) && s.hudRows.length === 3);
      assert.ok(Number.isFinite(s.fanPushPct) && Number.isFinite(s.throttlePct));
    }
  }
  assert.equal(MODELS.airliner.steps[2].hudRows[2], "Why: Gentle wide air uses far less fuel");
  assert.equal(MODELS.fighter.steps[2].hudRows[2], "Why: Compact fast jet favors raw speed");
});
