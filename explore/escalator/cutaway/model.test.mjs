// node --test explore/escalator/cutaway/model.test.mjs
//
// What "no interpenetration" means here. The drawing is a side elevation, so parts that sit
// in different planes across the width overlap on paper: the near rails cross the step side
// webs on the incline, for example. That is unavoidable for a rigid level step on two offset
// rails, and it is not a collision. What the tests do require:
//   1. neighbouring steps (body + both wheels) never overlap each other;
//   2. each wheel bears on its own rail: rim tangent, never inside it;
//   3. no step overlaps what the section plane cuts: comb plates, landing plates, truss
//      cross members, the sprocket shafts; passenger and return steps never meet.
// Draw order on the page follows the same idea: step webs, then rails, then wheels.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "./model.mjs";

const { P, STEP, PATH, LAND, STRUCT, SCHED } = M;
const deg = (r) => (r * 180) / Math.PI;
const SWEEP = Array.from({ length: 80 }, (_, i) => i * 5); // chain advance over one pitch, 5 mm apart

function bodies(poses) {
  return poses.map((p) => ({
    pose: p,
    body: M.placePolygon(p, M.STEP_OUTLINE),
    wc: [p.x, p.y],
    wt: M.toWorld(p, STEP.T),
  }));
}
const cc = (p, r, q, u) => Math.hypot(p[0] - q[0], p[1] - q[1]) - r - u;
// Smallest clearance between two placed steps: body/body, wheel/body both ways, wheel/wheel.
function stepGap(a, b) {
  return Math.min(
    M.convexGap(a.body, b.body),
    cc(a.wc, STEP.rc, b.wc, STEP.rc),
    cc(a.wc, STEP.rc, b.wt, STEP.rt),
    cc(a.wt, STEP.rt, b.wc, STEP.rc),
    cc(a.wt, STEP.rt, b.wt, STEP.rt),
    M.circlePolyGap(a.wc, STEP.rc, b.body),
    M.circlePolyGap(a.wt, STEP.rt, b.body),
    M.circlePolyGap(b.wc, STEP.rc, a.body),
    M.circlePolyGap(b.wt, STEP.rt, a.body),
  );
}
function segX(p, q, r, s) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-12) return false;
  const u = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  const v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return u > 0 && u < 1 && v > 0 && v < 1;
}

test("geometry: the stated numbers", () => {
  assert.equal(P.incline, 30);
  assert.equal(P.rise, 3000);
  assert.equal(PATH.L % P.pitch, 0, "loop is a whole number of steps");
  assert.equal(PATH.N, PATH.L / P.pitch);
  // sprocket pitch circle carries exactly `teeth` links
  assert.ok(Math.abs(2 * Math.PI * M.Rs - P.teeth * (P.pitch / P.links)) < 1e-9);
  // chain runs from the lower landing to the upper landing through exactly the rise
  assert.ok(Math.abs(M.chainPoint(PATH.by["upper landing"].s0)[1] - M.chainPoint(0)[1] - P.rise) < 1e-6);
  assert.ok(Math.abs(LAND.fflUp - LAND.fflLow - P.rise) < 1e-6, "floor to floor = rise");
  assert.equal(M.DRIVE.handrailSpeed.toFixed(6), P.speed.toFixed(6), "handrail matches the steps");
});

test("chain path is closed, continuous and tangent-continuous", () => {
  const a = M.chainPoint(0), b = M.chainPoint(PATH.L - 1e-6);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3);
  for (const g of PATH.segs) {
    const p0 = M.chainPoint(g.s0 - 1e-7), p1 = M.chainPoint(g.s0 + 1e-7);
    assert.ok(Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) < 1e-3, `gap at ${g.name}`);
    const t0 = M.chainTangent(g.s0 - 1e-6), t1 = M.chainTangent(g.s0 + 1e-6);
    assert.ok(t0[0] * t1[0] + t0[1] * t1[1] > 0.99999, `kink at ${g.name}`);
  }
});

test("step rise on the incline is pitch x sin 30 = 200 mm, going 346.4 mm", () => {
  const inc = PATH.by.incline;
  const s = inc.s0 + 1000;
  const a = M.stepPose(s), b = M.stepPose(s + P.pitch);
  assert.ok(Math.abs(b.y - a.y - 200) < 1e-6);
  assert.ok(Math.abs(b.x - a.x - 346.41) < 0.01);
});

// Independent check of the trailer track: put the chain wheel on the sampled chain polyline,
// find where a circle of radius |T| meets the sampled trailer polyline behind it, and measure
// the tread angle from that point alone. The orientation function is never consulted.
test("trailer track holds every tread level on the passenger run (< 0.5 deg)", () => {
  const ds = 2;
  const runS0 = SCHED.sD - PATH.L, runS1 = SCHED.sA;
  const trail = [];
  for (let s = runS0; s <= runS1; s += ds) trail.push(M.trailerPoint(s));
  const chain = [];
  for (let s = runS0; s <= runS1; s += ds) chain.push(M.chainPoint(s));
  const rT = Math.hypot(STEP.T[0], STEP.T[1]);
  const aT = Math.atan2(STEP.T[1], STEP.T[0]);
  let worst = 0, checked = 0;
  for (let i = 0; i < chain.length; i += 5) {
    const c = chain[i];
    const tan = chain[Math.min(i + 1, chain.length - 1)];
    const tx = tan[0] - c[0], ty = tan[1] - c[1];
    let best = null;
    for (let k = 0; k < trail.length - 1; k++) {
      const p = trail[k], q = trail[k + 1];
      const dp = Math.hypot(p[0] - c[0], p[1] - c[1]) - rT, dq = Math.hypot(q[0] - c[0], q[1] - c[1]) - rT;
      if (dp * dq > 0) continue;
      const u = dp / (dp - dq);
      const x = [p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])];
      if ((x[0] - c[0]) * tx + (x[1] - c[1]) * ty >= 0) continue; // the trailer trails
      best = x;
    }
    if (!best) continue; // near the run ends the trailer is already on the turnaround
    const phi = Math.atan2(best[1] - c[1], best[0] - c[0]) - aT;
    worst = Math.max(worst, Math.abs(deg(Math.atan2(Math.sin(phi), Math.cos(phi)))));
    checked++;
  }
  assert.ok(checked > 800, `checked ${checked}`);
  assert.ok(worst < 0.5, `worst tread angle ${worst.toFixed(3)} deg`);
});

test("tracks converge at the landings and are offset on the incline", () => {
  // vertical distance between the two wheel-centre lines at the same x
  const gapAtX = (x, sGuess) => {
    let lo = sGuess - 900, hi = sGuess + 900;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (M.trailerPoint(mid)[0] < x) lo = mid;
      else hi = mid;
    }
    return M.trailerPoint(lo)[1] - M.chainPoint(sGuess)[1];
  };
  const inc = PATH.by.incline, flat = PATH.by["upper landing"];
  const sI = inc.s0 + inc.len / 2, sF = flat.s0 + flat.len / 2;
  const dInc = gapAtX(M.chainPoint(sI)[0], sI);
  const dFlat = gapAtX(M.chainPoint(sF)[0], sF);
  const expectInc = -STEP.T[0] * Math.tan((30 * Math.PI) / 180) + STEP.T[1];
  assert.ok(Math.abs(dInc - expectInc) < 0.5, `incline offset ${dInc}`);
  assert.ok(Math.abs(dFlat - STEP.T[1]) < 0.5, `landing offset ${dFlat}`);
  assert.ok(dInc > 4 * dFlat);
});

test("treads are level and coplanar on each landing walkway (2-3 steps)", () => {
  for (const s0 of SWEEP) {
    const poses = M.stepPositions(s0);
    const up = poses.filter((p) => p.x + STEP.f - RISER() > PATH.xE && p.x + STEP.f < LAND.combUp && Math.abs(p.y - P.rise) < 1e-6);
    const low = poses.filter((p) => p.x - RISER() > LAND.combLow && p.x + STEP.f < PATH.by["lower transition"].s0 && Math.abs(p.y) < 1e-6);
    assert.ok(up.length >= 2 && up.length <= 3, `upper walkway steps ${up.length} at ${s0}`);
    assert.ok(low.length >= 2 && low.length <= 3, `lower walkway steps ${low.length} at ${s0}`);
    for (const p of [...up, ...low]) assert.equal(p.phi, 0);
  }
  function RISER() {
    return M.RISER_R - STEP.f;
  }
});

test("no two steps ever overlap (all pairs, chain advance swept over one pitch)", () => {
  let worst = Infinity, at = null;
  for (const s0 of SWEEP) {
    const B = bodies(M.stepPositions(s0));
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) {
        if (Math.hypot(B[i].wc[0] - B[j].wc[0], B[i].wc[1] - B[j].wc[1]) > 1100) continue;
        const g = stepGap(B[i], B[j]);
        if (g < worst) (worst = g), (at = [s0, i, j, M.segmentAt(B[i].pose.s)]);
      }
    }
  }
  assert.ok(worst > 2, `closest approach ${worst.toFixed(2)} mm at ${JSON.stringify(at)}`);
});

test("positive control: the overlap check fires when a step is pushed 20 mm", () => {
  const poses = M.stepPositions(0);
  const inc = poses.findIndex((p) => M.segmentAt(p.s) === "incline" && M.segmentAt(p.s - P.pitch) === "incline");
  const B = bodies(poses);
  const pushed = { ...poses[inc + 1], x: poses[inc + 1].x + 20 };
  const [b2] = bodies([pushed]);
  assert.ok(stepGap(B[inc], B[inc + 1]) > 0);
  assert.ok(stepGap(B[inc], b2) < 0, "a 20 mm push must register as an overlap");
});

test("each wheel bears on its own drawn rail and never cuts into it", () => {
  const R = M.rails();
  const runs = [
    { rail: R.chain.pass, wheel: "c", r: STEP.rc, s0: SCHED.sD - PATH.L + 60, s1: PATH.by["upper turn"].s0 - 60 },
    { rail: R.chain.ret, wheel: "c", r: STEP.rc, s0: PATH.by["return, upper"].s0 + 60, s1: PATH.by["lower turn"].s0 - 60 },
    { rail: R.trailer.pass, wheel: "t", r: STEP.rt, s0: SCHED.sD - PATH.L + 5, s1: SCHED.sA - 5 },
    { rail: R.trailer.ret, wheel: "t", r: STEP.rt, s0: SCHED.sB + 5, s1: SCHED.sC - 5 },
    { rail: R.trailer.upIn, wheel: "t", r: STEP.rt, s0: SCHED.sA + 5, s1: SCHED.sB - 5 },
    { rail: R.trailer.lowOut, wheel: "t", r: STEP.rt, s0: SCHED.sC + 5, s1: SCHED.sD - 5 },
  ];
  for (const run of runs) {
    for (let s = run.s0; s <= run.s1; s += 7) {
      const pose = M.stepPose(s);
      const c = run.wheel === "c" ? [pose.x, pose.y] : M.toWorld(pose, STEP.T);
      const d = M.pointPolylineDist(c, run.rail);
      assert.ok(Math.abs(d - run.r) < 0.6, `wheel ${run.wheel} at s=${s.toFixed(0)}: ${d.toFixed(2)} vs r ${run.r}`);
    }
  }
  // the guide side of each turnaround channel keeps its running clearance
  for (const [rail, s0, s1] of [[R.trailer.upOut, SCHED.sA, SCHED.sB], [R.trailer.lowIn, SCHED.sC, SCHED.sD]]) {
    for (let s = s0 + 5; s < s1 - 5; s += 7) {
      const d = M.pointPolylineDist(M.trailerPoint(s), rail);
      assert.ok(d > STEP.rt + 2, `guide clearance ${d.toFixed(2)}`);
    }
  }
});

test("trailer track is smooth: no cusp, no loop", () => {
  let minV = Infinity;
  for (let s = 0; s < PATH.L; s += 1) {
    const a = M.trailerPoint(s - 0.5), b = M.trailerPoint(s + 0.5);
    minV = Math.min(minV, Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  assert.ok(minV > 0.6, `trailer speed ratio dips to ${minV.toFixed(3)}`);
  const pts = M.sampleLocus((s) => M.trailerPoint(s), PATH, 25);
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 2; j < pts.length; j++) {
      if (i === 0 && j === pts.length - 1) continue;
      assert.ok(!segX(pts[i], pts[(i + 1) % pts.length], pts[j], pts[(j + 1) % pts.length]), `trailer locus crosses itself near ${i}, ${j}`);
    }
  }
});

test("steps clear everything the section cuts", () => {
  const fixed = [LAND.combPlateUp, LAND.combPlateLow, LAND.plateUp, LAND.plateLow, ...STRUCT.members];
  let worst = Infinity, what = null;
  for (let s = 0; s < PATH.L; s += 3) {
    const pose = M.stepPose(s);
    const [b] = bodies([pose]);
    for (const poly of fixed) {
      const g = Math.min(M.convexGap(b.body, poly), M.circlePolyGap(b.wc, STEP.rc, poly), M.circlePolyGap(b.wt, STEP.rt, poly));
      if (g < worst) (worst = g), (what = [s, M.segmentAt(s)]);
    }
    for (const sh of [STRUCT.shaftUp, STRUCT.shaftLow]) {
      const g = M.circlePolyGap(sh.c, sh.r, b.body);
      if (g < worst) (worst = g), (what = [s, "shaft"]);
    }
    // inner edge of the truss bottom chord
    for (const v of b.body) {
      const y = chordYAt(v[0]);
      if (y !== null && v[1] - y < worst) (worst = v[1] - y), (what = [s, "chord"]);
    }
  }
  assert.ok(worst > 2, `closest approach ${worst.toFixed(2)} mm at ${JSON.stringify(what)}`);
  function chordYAt(x) {
    const c = STRUCT.chordInner;
    for (let i = 0; i < c.length - 1; i++) {
      if (x >= c[i][0] && x <= c[i + 1][0]) return c[i][1] + ((x - c[i][0]) * (c[i + 1][1] - c[i][1])) / (c[i + 1][0] - c[i][0]);
    }
    return null;
  }
});

test("no step rises above the tread plane under the landing plates", () => {
  for (let s = 0; s < PATH.L; s += 2) {
    const body = M.placePolygon(M.stepPose(s), M.STEP_OUTLINE);
    for (const v of body) {
      if (v[0] > LAND.combUp + 70 && v[1] > LAND.treadUp - 600) assert.ok(v[1] <= LAND.treadUp + 0.5, `upper, s=${s}`);
      if (v[0] < LAND.combLow - 70 && v[1] > LAND.treadLow - 600 && v[1] < LAND.treadLow + 600) assert.ok(v[1] <= LAND.treadLow + 0.5, `lower, s=${s}`);
    }
  }
});
