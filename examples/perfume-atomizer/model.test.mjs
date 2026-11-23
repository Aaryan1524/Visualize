// node --test examples/perfume-atomizer/model.test.mjs
//
// Independent reference check for the perfume atomizer model, plus a planted-fault test
// confirming the checks catch broken pickup or spray math.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  LOW_FILL_PCT,
  MODELS,
  STORY_FILL_PCT,
  VARIANTS,
  buildModel,
  canPickup,
  simulatePresses,
  spraysLeft,
  totalSprays,
  volumeMl,
} from "./model.mjs";

// Independent reference calculator (no shared code with model.mjs)
function refSprays(ml, dose, pct) {
  return Math.round(((ml * pct) / 100) / dose);
}

test("both bottle variants match independent volume and spray-count references", () => {
  assert.equal(BASE, "standard");
  assert.equal(MODELS.standard.totalSprays, 500);
  assert.equal(MODELS.travel.totalSprays, 100);
  assert.equal(MODELS.standard.primingPresses, 2);
  assert.equal(MODELS.travel.primingPresses, 1);

  for (const [name, M] of Object.entries(MODELS)) {
    assert.equal(M.totalSprays, refSprays(M.capacityMl, M.doseMl, 100), `${name} full sprays`);
    assert.equal(M.storySpraysLeft, refSprays(M.capacityMl, M.doseMl, STORY_FILL_PCT), `${name} 80% sprays`);
    assert.equal(M.lowSpraysLeft, refSprays(M.capacityMl, M.doseMl, LOW_FILL_PCT), `${name} 3% sprays`);
    assert.equal(volumeMl(M.capacityMl, 50), +(M.capacityMl * 0.5).toFixed(1), `${name} half volume`);
    assert.equal(M.steps.length, 6, `${name} has 6 narrative steps after step 0`);
  }
});

test("priming progression: standard takes 2 priming presses and sprays on press 3; travel sprays on press 2", () => {
  const std = MODELS.standard;
  assert.equal(simulatePresses(std, 0, 100).mode, "new");
  assert.equal(simulatePresses(std, 1, 100).sprayed, false);
  assert.equal(simulatePresses(std, 1, 100).primed, false);
  assert.equal(simulatePresses(std, 1, 100).chamberFill, 0, "liquid cannot enter chamber before straw is full");
  assert.equal(simulatePresses(std, 2, 100).sprayed, false);
  assert.equal(simulatePresses(std, 2, 100).primed, true);
  assert.equal(simulatePresses(std, 3, 100).sprayed, true);
  assert.equal(simulatePresses(std, 3, 100).sprayStrength, 1);

  const trv = MODELS.travel;
  assert.equal(simulatePresses(trv, 1, 100).sprayed, false);
  assert.equal(simulatePresses(trv, 1, 100).primed, true);
  assert.equal(simulatePresses(trv, 2, 100).sprayed, true);
  assert.ok(trv.strawLenMm < std.strawLenMm);
  assert.ok(trv.primingPresses < std.primingPresses);
});

test("sputtering below 5% fill and completely dry at 0%", () => {
  for (const M of Object.values(MODELS)) {
    assert.equal(canPickup(M.sputterPct, M.sputterPct), true);
    assert.equal(canPickup(M.sputterPct - 1, M.sputterPct), false);

    const low = simulatePresses(M, 4, LOW_FILL_PCT);
    assert.equal(low.reachesStraw, false);
    assert.equal(low.sprayed, false);
    assert.equal(low.sputtering, true);
    assert.equal(low.tone, "bad");

    const dry = simulatePresses(M, 4, 0);
    assert.equal(dry.mode, "empty");
    assert.equal(dry.sprayStrength, 0);
    assert.equal(dry.spraysLeft, 0);
  }
});

test("planted fault: a broken atomizer claiming mist on press 1 or clean spray at 3% fails invariant checks", () => {
  // Verify the physical invariants that distinguish a real pump from a broken one
  const verifyAtomizer = (sim, spec) => {
    const press1 = sim(spec, 1, 100);
    if (press1.sprayed) throw new Error("fault: brand-new air-filled pump cannot spray mist on press 1");
    const low = sim(spec, 4, 3);
    if (low.sprayed) throw new Error("fault: upright straw above 3% liquid cannot spray clean mist");
  };

  // Real model passes
  verifyAtomizer(simulatePresses, VARIANTS.standard);
  verifyAtomizer(simulatePresses, VARIANTS.travel);

  // Planted fault 1: sprays immediately on press 1
  const faultPress1 = (spec, p, f) => ({ ...simulatePresses(spec, p, f), sprayed: p >= 1 });
  assert.throws(() => verifyAtomizer(faultPress1, VARIANTS.standard), /press 1/);

  // Planted fault 2: sprays cleanly below 5% fill
  const faultLow = (spec, p, f) => ({ ...simulatePresses(spec, p, f), sprayed: p > spec.primingPresses });
  assert.throws(() => verifyAtomizer(faultLow, VARIANTS.standard), /3% liquid/);
});

test("helper edge clamping", () => {
  assert.equal(totalSprays(50, 0.1), 500);
  assert.equal(spraysLeft(50, 0.1, -10), 0);
  assert.equal(spraysLeft(50, 0.1, 150), 500);
  const rebuilt = buildModel(VARIANTS.standard);
  assert.equal(rebuilt.steps[3].ballOpen, false);
  assert.equal(rebuilt.steps[4].ballOpen, true);
});
