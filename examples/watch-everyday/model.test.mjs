// node --test examples/watch-everyday/model.test.mjs
//
// Independent reference check for the everyday automatic watch model, plus spatial layout
// solver invariants (solveGearTrain, assertNoCollisions, checkCavityFill, composeExplodedLayers)
// and planted-fault tests proving broken physics or overlapping geometry fail immediately.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  DRAIN_PER_HOUR_STILL,
  FULL_RESERVE_HOURS,
  HOURS_PER_TURN,
  LAB_START_RESERVE_HOURS,
  MAX_SPRING_TURNS,
  MODELS,
  SWINGS_TO_FULL,
  TICKS_PER_SEC,
  WIND_GAIN_PER_HOUR_WORN,
  escapementAt,
  reservePct,
  simulateWatch,
  springTurns,
  swingsForHours,
} from "./model.mjs";
import {
  BALANCE,
  CAVITY_FILL,
  CAVITY_ITEMS,
  CAVITY_R,
  CLEARANCE_ITEMS,
  LAYERS,
  TRAIN,
  assertNoCollisions,
  checkCavityFill,
} from "./figure.mjs";

// Independent reference calculator (zero shared code with model.mjs)
function refReserve(start, worn, still) {
  const afterWear = Math.min(42, start + worn * 2);
  return Math.max(0, afterWear - still);
}

test("both daily-routine variants match independent reserve, turn, and swing references", () => {
  assert.equal(BASE, "active");
  assert.equal(FULL_RESERVE_HOURS, 42);
  assert.equal(MAX_SPRING_TURNS, 7);
  assert.equal(HOURS_PER_TURN, 6);
  assert.equal(SWINGS_TO_FULL, 840);
  assert.equal(TICKS_PER_SEC, 8);
  assert.equal(MAX_SPRING_TURNS * HOURS_PER_TURN, FULL_RESERVE_HOURS);

  assert.equal(MODELS.active.dayEndReserveHours, refReserve(18, 14, 10));
  assert.equal(MODELS.active.dayEndReserveHours, 32);
  assert.equal(MODELS.active.hoursWornDay + MODELS.active.hoursStillDay, 24, "active day spans 24 h");
  assert.equal(MODELS.active.rotorSwingsPerHour, 60);
  assert.ok(MODELS.active.netChangeHours > 0, "active day climbs");

  assert.equal(MODELS.nightstand.dayEndReserveHours, refReserve(36, 0, 24));
  assert.equal(MODELS.nightstand.dayEndReserveHours, 12);
  assert.ok(MODELS.nightstand.netChangeHours < 0, "nightstand drains");

  for (const [name, M] of Object.entries(MODELS)) {
    assert.equal(M.steps.length, 6, `${name} has 6 narrative steps after step 0`);
    assert.equal(swingsForHours(M.fullReserveHours), 840, `${name} swings to full`);
    assert.equal(springTurns(M.fullReserveHours), 7, `${name} full spring turns`);
    assert.equal(reservePct(M.fullReserveHours), 100, `${name} 100% reserve`);
  }
});

test("wear winding (+2 h/h capped at 42 h) vs nightstand drain (-1 h/h floored at 0 h)", () => {
  const M = MODELS.active;
  // Default lab case: start 18 + 6*2 - 8 = 22 h -> running strong (ok: true)
  const mid = simulateWatch(M, 6, 8, LAB_START_RESERVE_HOURS);
  assert.equal(mid.reserveHours, 22);
  assert.equal(mid.running, true);
  assert.equal(mid.ok, true);
  assert.equal(mid.ticksPerSec, 8);

  // Full wear caps at 42 h (slipping clutch protects spring — reachable directly from lab start 18 h!)
  const full = simulateWatch(M, 16, 0, LAB_START_RESERVE_HOURS);
  assert.equal(full.reserveHours, 42);
  assert.equal(full.clippedByClutch, true);
  assert.equal(full.turns, 7);
  assert.equal(full.ok, true);

  // 42 hours still from full wind stops cleanly at 0 hours
  const stopped = simulateWatch(M, 0, 42, 42);
  assert.equal(stopped.reserveHours, 0);
  assert.equal(stopped.running, false);
  assert.equal(stopped.ok, false);
  assert.equal(stopped.ticksPerSec, 0);

  // Low reserve (< 6 h) reports ok: false and tone: hot
  const low = simulateWatch(M, 0, 14, 18);
  assert.equal(low.reserveHours, 4);
  assert.equal(low.running, true);
  assert.equal(low.low, true);
  assert.equal(low.ok, false);
});

test("escapement kinematics stop cleanly when reserve hits 0", () => {
  const running = escapementAt(0.25, true);
  const still = escapementAt(0.25, false);
  assert.ok(Math.abs(running.forkDeg) > 0 || Math.abs(running.balDeg) > 0);
  assert.equal(still.balDeg, 0);
  assert.equal(still.forkDeg, 0);
  assert.equal(still.escDeg, 0);
});

test("spatial solvers: gear train tangency, zero balance/barrel collision, cavity fill >= 0.30, monotonic 3-layer stack", () => {
  // Center pinion & center wheel sit right at [0, 0]
  assert.equal(TRAIN.byName.centerPinion.x, 0);
  assert.equal(TRAIN.byName.centerPinion.y, 0);
  assert.equal(TRAIN.byName.centerWheel.x, 0);
  assert.equal(TRAIN.byName.centerWheel.y, 0);

  // Zero collision between balance wheel, barrel, center wheel, and escape wheel
  assert.doesNotThrow(() =>
    assertNoCollisions(CLEARANCE_ITEMS, { minGap: 1.0, ignorePairs: [["barrel", "centerWheel"]] }),
  );
  // Balance wheel clearly separated from barrel
  const barrel = TRAIN.byName.barrel;
  const distBalBarrel = Math.hypot(BALANCE.x - barrel.x, BALANCE.y - barrel.y);
  assert.ok(distBalBarrel > BALANCE.r + barrel.outerR + 2.0, `balance/barrel clearance too tight: ${distBalBarrel}`);

  // Cavity fill >= 0.30 and zero parts poking outside r = 32
  assert.equal(CAVITY_FILL.ok, true, `cavity fill failed: ${JSON.stringify(CAVITY_FILL)}`);
  assert.ok(CAVITY_FILL.ratio >= 0.30, `cavity fill ratio ${CAVITY_FILL.ratio.toFixed(3)} < 0.30`);
  assert.equal(CAVITY_FILL.outside, 0, `parts poke outside r=${CAVITY_R}`);

  // 3 exploded layers strictly ascending with clean vertical breathing gaps
  assert.ok(LAYERS.byName.rotor.z0 > LAYERS.byName.movement.z1 + 10);
  assert.ok(LAYERS.byName.dial.z0 > LAYERS.byName.rotor.z1 + 10);
});

test("planted faults: overwind bypass, non-stopping drain, or colliding balance fail immediately", () => {
  const verifyWatch = (sim) => {
    const over = sim(MODELS.active, 12, 0, 30);
    if (over.reserveHours > 42) throw new Error("fault: spring overwound past 42 hours");
    const dead = sim(MODELS.active, 0, 48, 42);
    if (dead.running || dead.reserveHours !== 0) throw new Error("fault: watch failed to stop at 0 hours");
  };
  verifyWatch(simulateWatch);

  const faultOverwind = (spec, w, s, st) => ({ ...simulateWatch(spec, w, s, st), reserveHours: st + w * 2 });
  assert.throws(() => verifyWatch(faultOverwind), /42 hours/);

  const faultNeverStops = (spec, w, s, st) => ({ ...simulateWatch(spec, w, s, st), running: true, reserveHours: 1 });
  assert.throws(() => verifyWatch(faultNeverStops), /stop at 0 hours/);

  // Planted geometric fault: moving balance wheel into the barrel triggers assertNoCollisions
  const badItems = CLEARANCE_ITEMS.map((it) =>
    it.name === "balance" ? { ...it, x: TRAIN.byName.barrel.x + 2, y: TRAIN.byName.barrel.y } : it,
  );
  assert.throws(() => assertNoCollisions(badItems, { minGap: 1.0, ignorePairs: [["barrel", "centerWheel"]] }), /Collision/);

  // Planted geometric fault: pushing a part outside r = 32 triggers checkCavityFill
  const pokedOut = [...CAVITY_ITEMS, { x: 28, y: 0, r: 7 }];
  assert.equal(checkCavityFill(CAVITY_R, pokedOut, 0.30).outside, 1);
  assert.equal(checkCavityFill(CAVITY_R, pokedOut, 0.30).ok, false);
});
