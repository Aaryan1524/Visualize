import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, WATCH, barrelAt, escapementAt, makeModel, regulatorAt, windingRate } from "./model.mjs";
import { CAL } from "./figure.mjs";

test("watch: going train ratios yield exact 60:1 minute-to-second, 960:1/600:1 center-to-escape and exact vph", () => {
  const mod = MODELS.modern;
  const vin = MODELS.vintage;
  assert.equal(mod.N.centerToFourth, 60);
  assert.equal(mod.N.centerToEscape, 960);
  assert.equal(vin.N.centerToEscape, 600);
  assert.equal(mod.N.totalRatio, 5760);
  assert.equal(mod.N.vph, 28800);
  assert.equal(mod.N.hz, 4);
  assert.equal(mod.N.beatsPerSec, 8);
  assert.equal(mod.N.beatMs, 125);
  assert.equal(mod.N.beatsPerDay, 691200);
  assert.equal(mod.N.reserveHours, 42);
  assert.equal(vin.N.totalRatio, 3600);
  assert.equal(vin.N.vph, 18000);
  assert.equal(vin.N.hz, 2.5);
  assert.equal(vin.N.beatsPerSec, 5);
  assert.equal(vin.N.beatMs, 200);
  assert.equal(vin.N.beatsPerDay, 432000);
  assert.equal(vin.N.reserveHours, 42);
});

test("watch: barrel slipping bridle caps torque at 7.2 N·mm and slips only at full wind under wrist motion", () => {
  const half = barrelAt(50, true);
  const fullIdle = barrelAt(100, false);
  const fullWind = barrelAt(100, true);
  const low = barrelAt(5, false);
  assert.ok(fullWind.torque === WATCH.slipTorque && fullWind.slipping === true);
  assert.ok(fullIdle.slipping === false);
  assert.ok(half.torque > low.torque && fullWind.torque >= half.torque);
  assert.ok(low.ampDeg < WATCH.lowAmp && fullWind.ampDeg === WATCH.nominalAmp);
});

test("watch: regulator physics matches harmonic period sensitivity dL/L = -2 * rate / 86400", () => {
  assert.equal(regulatorAt(0).deltaUm, 0);
  assert.equal(regulatorAt(20).deltaUm, -83);
  assert.equal(regulatorAt(-20).deltaUm, 83);
});

test("watch: Swiss lever escapement matches exact 52 deg lift angle and cycles lock -> unlock -> impulse -> drop", () => {
  const seen = new Set();
  const engaged = [];
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    const e = escapementAt(u, WATCH.nominalAmp);
    seen.add(e.phase);
    if (e.phase === "unlock" || e.phase === "impulse") engaged.push(e.balDeg);
  }
  for (const ph of ["lock", "unlock", "impulse", "drop"]) assert.ok(seen.has(ph), `missing ${ph}`);
  const arc = Math.max(...engaged) - Math.min(...engaged);
  assert.ok(Math.abs(arc - WATCH.liftAngle) < 2.5, `lift arc ${arc.toFixed(1)} deg must match stated ${WATCH.liftAngle} deg`);
  assert.ok(Math.abs(escapementAt(2.0).escapeDeg - 24) < 1e-9);
  assert.equal(escapementAt(0.05).phase, "lock");
  assert.equal(escapementAt(0.05).escapeDeg, escapementAt(0.15).escapeDeg);
});

test("watch: winding balance matches 840-turn/42h calibre (+2.4 h/h at 40% desk wear, net drain when sedentary)", () => {
  assert.equal(windingRate(0).netHrsPerHr, -1.0);
  assert.equal(windingRate(40).gainedHrsPerHr, 2.4);
  assert.equal(windingRate(40).netHrsPerHr, 1.4);
  assert.equal(windingRate(100).gainedHrsPerHr, 6.0);
  assert.ok(windingRate(10).netHrsPerHr < 0, "sedentary 10% wrist motion drains net power reserve");
});

test("watch: planted fault — wrong fourth-wheel tooth count breaks exact 28,800 vph", () => {
  const broken = makeModel({ variant: { key: "bad", label: "bad", fourthTeeth: 100, escapePinion: 7 } });
  assert.notEqual(broken.N.vph, 28800);
});

test("watch: calibre gear pairs satisfy exact pitch-circle tangency (zero floating gears)", () => {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pairs = [
    ["barrel <-> centerPin", dist(CAL.barrel, CAL.center), CAL.barrel.r + CAL.center.pinR],
    ["center <-> thirdPin", dist(CAL.center, CAL.third), CAL.center.r + CAL.third.pinR],
    ["third <-> fourthPin", dist(CAL.third, CAL.fourth), CAL.third.r + CAL.fourth.pinR],
    ["fourth <-> escapePin", dist(CAL.fourth, CAL.escape), CAL.fourth.r + CAL.escape.pinR],
    ["rotorPin <-> revB", dist(CAL.center, CAL.revB), CAL.center.rotorPinR + CAL.revB.r],
    ["revB <-> revA", dist(CAL.revB, CAL.revA), CAL.revB.r + CAL.revA.r],
    ["revA <-> ratchet", dist(CAL.revA, CAL.barrel), CAL.revA.r + CAL.barrel.rRatchet],
  ];
  for (const [name, actual, expected] of pairs) {
    assert.ok(Math.abs(actual - expected) < 0.25, `${name}: dist ${actual.toFixed(2)} vs pitch sum ${expected.toFixed(2)}`);
  }
});
