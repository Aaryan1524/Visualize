// node --test examples/differential/model.test.mjs
//
// Physics, kinematics, and traction-limit tests for the Open Differential model,
// verified against independent arc-length & power-conservation references plus planted faults.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIFF,
  MODELS,
  anglesAt,
  cornerKinematics,
  exactSpeedStrings,
  gripTorque,
  makeModel,
  tractionState,
  turnRadiusFromSteer,
} from "./model.mjs";

const near = (a, b, tol = 1e-9, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ? msg + ": " : ""}${a} vs ${b}`);

/** Independent reference: compute outer & inner wheel rpm directly from circular arc distance per turn. */
function refArcWheelSpeeds(driveRpm, turnR) {
  const carrierRpm = (driveRpm * DIFF.zPinion) / DIFF.zRing;
  const vCenter = (carrierRpm / 60) * 2 * Math.PI * DIFF.tireR;
  if (!Number.isFinite(turnR)) return { carrierRpm, leftRpm: carrierRpm, rightRpm: carrierRpm };
  // Yaw rate of the car about the turn center: yaw = vCenter / turnR
  const yaw = vCenter / turnR;
  const vInner = yaw * (turnR - DIFF.track / 2);
  const vOuter = yaw * (turnR + DIFF.track / 2);
  const toRpm = (v) => (v / (2 * Math.PI * DIFF.tireR)) * 60;
  return { carrierRpm, leftRpm: toRpm(vInner), rightRpm: toRpm(vOuter) };
}

for (const [name, M] of Object.entries(MODELS)) {
  test(`${name}: final drive ratio 41/11 gives exact 220 rpm carrier and 410 N·m carrier torque`, () => {
    near(M.finalDrive, 41 / 11, 1e-12);
    near(M.N.carrierRpm, 220, 1e-12);
    near(M.N.carrierTorque, 410, 1e-12);
    near(M.N.wheelTorque, 205, 1e-12);
    // Power conservation across the final drive: T_in * w_in === T_out * w_out
    near(M.N.driveTorque * M.N.driveRpm, M.N.carrierTorque * M.N.carrierRpm, 1e-9, "final-drive power");
  });

  test(`${name}: straight ahead gives equal wheel speeds and zero spider gear spin`, () => {
    const s = M.straight;
    near(s.leftRpm, s.carrierRpm);
    near(s.rightRpm, s.carrierRpm);
    near(s.leftRpm + s.rightRpm, 2 * s.carrierRpm);
    near(s.spiderRpm, 0);
    near(s.spiderSpinRpm, 0);
    assert.equal(s.slipping, false);
    near(s.torqueL, s.torqueR);
    near(s.torqueL + s.torqueR, s.carrierTorque);
  });

  test(`${name}: cornering wheel speeds match independent arc-length reference and satisfy ωL + ωR = 2ωc`, () => {
    const c = M.corner;
    const ref = refArcWheelSpeeds(M.D.driveRpm, M.v.turnR);
    near(c.leftRpm, ref.leftRpm, 1e-9, "inner wheel rpm");
    near(c.rightRpm, ref.rightRpm, 1e-9, "outer wheel rpm");
    near(c.leftRpm + c.rightRpm, 2 * c.carrierRpm, 1e-9, "fundamental sum constraint");
    near(c.rightRpm / c.leftRpm, (M.v.turnR + M.D.track / 2) / (M.v.turnR - M.D.track / 2), 1e-12, "path ratio");
    // Spider spin speed exact formula: ((wR - wL) / 2) * (zSun / zSpider)
    near(c.spiderRpm, ((c.rightRpm - c.leftRpm) / 2) * (M.D.zSun / M.D.zSpider), 1e-9, "spider spin");
    assert.ok(c.spiderRpm > 0, "spider must spin in a turn");
    // Power conservation during cornering: T_L * w_L + T_R * w_R === T_c * w_c
    near(c.torqueL * c.leftRpm + c.torqueR * c.rightRpm, c.carrierTorque * c.carrierRpm, 1e-9, "corner power balance");
  });

  test(`${name}: open-differential torque balance enforces TL = TR even when speeds differ`, () => {
    const c = M.corner;
    near(c.torqueL, c.torqueR);
    near(c.torqueL, c.carrierTorque / 2);
    assert.ok(c.rightRpm > c.leftRpm, "speeds differ while torques stay equal");
  });

  test(`${name}: the ice trap caps dry-wheel torque at icy grip (96 N·m), stops dry wheel, and doubles icy wheel speed`, () => {
    const ice = M.ice;
    assert.equal(ice.slipping, true);
    assert.equal(ice.slipSide, "left");
    near(ice.maxLeftTorque, 96, 1e-9, "ice grip cap");
    near(ice.maxRightTorque, 1020, 1e-9, "dry asphalt grip");
    near(ice.torqueL, 96, 1e-9);
    near(ice.torqueR, 96, 1e-9, "dry wheel capped at icy wheel torque");
    near(ice.deliveredAxleTorque, 192, 1e-9, "total axle torque = 2 × 96");
    assert.ok(ice.deliveredAxleTorque < ice.carrierTorque, "delivered torque below demand");
    near(ice.rightRpm, 0, 1e-9, "dry wheel stalls");
    near(ice.leftRpm, 2 * ice.carrierRpm, 1e-9, "icy wheel spins at 2ωc");
    near(ice.leftRpm + ice.rightRpm, 2 * ice.carrierRpm, 1e-9, "sum constraint still holds on ice");
    near(ice.spiderRpm, ice.carrierRpm * (M.D.zSun / M.D.zSpider), 1e-9, "spider spins at 352 rpm");
    near(ice.spiderRpm, 352, 1e-9);
  });

  test(`${name}: kinematic angles preserve θL + θR = 2θc and exact spider-to-sun mesh velocity`, () => {
    for (const delta of [0, M.corner.deltaFrac, -1, 1]) {
      const a0 = M.anglesAt(0.3, delta);
      const a1 = M.anglesAt(0.3 + 0.01, delta);
      near(a1.leftRad + a1.rightRad, 2 * a1.carrierRad, 1e-12);
      const dC = a1.carrierRad - a0.carrierRad;
      const dL = a1.leftRad - a0.leftRad;
      const dR = a1.rightRad - a0.rightRad;
      const dS = a1.spiderRad - a0.spiderRad;
      // Exact pitch-circle velocity match at left and right sun meshes:
      // R_sun * dR = R_sun * dC + R_spider * dS, R_sun * dL = R_sun * dC - R_spider * dS
      const ratio = M.D.zSpider / M.D.zSun;
      near(dC - dS * ratio, dL, 1e-12, "left sun pitch match");
      near(dC + dS * ratio, dR, 1e-12, "right sun pitch match");
    }
  });
}

test("variant contrast: tight turn (3.75 m) produces exactly double the speed split and spider spin of wide bend (7.5 m)", () => {
  const wide = MODELS.wide.N;
  const tight = MODELS.tight.N;
  near(wide.turnLeftRpm, 198);
  near(wide.turnRightRpm, 242);
  near(wide.turnSpiderRpm, 35.2);
  near(tight.turnLeftRpm, 176);
  near(tight.turnRightRpm, 264);
  near(tight.turnSpiderRpm, 70.4);
  near(tight.outerToInner, 1.5);
  near(tight.turnDeltaRpm, 2 * wide.turnDeltaRpm);
  near(tight.turnSpiderRpm, 2 * wide.turnSpiderRpm);
});

test("lab sweep: every slider combination satisfies ωL + ωR = 2ωc, TL = TR, and exact printed sum digits", () => {
  let checked = 0;
  for (let driveRpm = 410; driveRpm <= 1230; driveRpm += 41) {
    for (let steerPct = 0; steerPct <= 100; steerPct += 10) {
      for (const muLeft of [0.08, 0.15, 0.17, 0.18, 0.35, 0.85]) {
        const st = tractionState({ driveRpm, turnR: turnRadiusFromSteer(steerPct), muLeft });
        near(st.leftRpm + st.rightRpm, 2 * st.carrierRpm, 1e-9);
        near(st.torqueL, st.torqueR, 1e-9);
        const s = exactSpeedStrings(st.leftRpm, st.rightRpm, st.carrierRpm);
        near(Number(s.left) + Number(s.right), Number(s.sum), 1e-9, `printed sum at ${driveRpm}/${steerPct}/${muLeft}`);
        near(2 * Number(s.carrier), Number(s.sum), 1e-9);
        checked++;
      }
    }
  }
  assert.ok(checked > 1000, `checked ${checked} lab states`);
});

test("planted faults: violating the differential sum constraint or equal-torque split is caught", () => {
  // Fault 1: a broken kinematic relation where outer speeds up without inner slowing down
  const M = MODELS.tight;
  const badLeft = M.corner.carrierRpm; // stayed at carrier speed instead of slowing by -delta
  const badRight = M.corner.rightRpm;
  assert.ok(Math.abs(badLeft + badRight - 2 * M.corner.carrierRpm) > 10, "violated ωL + ωR = 2ωc must be detected");

  // Fault 2: pretending an open diff sends dry-asphalt torque to the right wheel while left is on ice
  const ice = M.ice;
  const fakeLockedTotal = ice.maxLeftTorque + ice.maxRightTorque;
  assert.ok(fakeLockedTotal > ice.deliveredAxleTorque * 5, "open diff cannot use the dry tire's stranded grip");

  // Fault 3: flipping spider spin sign breaks pitch-circle mesh matching at both sun gears
  const a0 = anglesAt(0, M.corner.deltaFrac);
  const a1 = anglesAt(0.1, M.corner.deltaFrac);
  const wrongSpider = -(a1.spiderRad - a0.spiderRad);
  const dC = a1.carrierRad - a0.carrierRad;
  const dR = a1.rightRad - a0.rightRad;
  const ratio = DIFF.zSpider / DIFF.zSun;
  assert.ok(Math.abs(dC + wrongSpider * ratio - dR) > 0.01, "reversed spider spin must mismatch sun pitch speed");
});
