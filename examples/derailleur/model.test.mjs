// node --test model.test.mjs
//
// The chain length is re-summed here independently of the model's belt formula: the path is
// walked as a fine polyline and its segments added up. The indexing verdict is checked against a
// separate reference (every click lands err x ratio off its cog). Planted faults prove the checks
// can fail.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DR, VARIANTS, MODELS, makeModel, pitchR, clickPull, beltPath, indexing, pathAt } from "./model.mjs";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b}`);

// Walk the path as points: each wrap sampled every 0.05 degrees (chord error under a micrometre), then its straight run.
function polyline(path) {
  const pts = [];
  path.circles.forEach((C, i) => {
    const w = path.wraps[i], n = Math.max(2, Math.ceil((w.w * 180) / Math.PI / 0.05));
    for (let j = 0; j <= n; j++) {
      const a = w.a0 + C.s * (w.w * j) / n;
      pts.push([C.c[0] + C.r * Math.cos(a), C.c[1] + C.r * Math.sin(a)]);
    }
    pts.push(path.runs[i].p1);
  });
  return pts;
}
const walk = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

test("the stated numbers", () => {
  near(pitchR(11), 22.54, 0.01, "an 11-tooth pitch radius");
  near(pitchR(28), 56.71, 0.01, "a 28-tooth pitch radius");
  near(clickPull() * DR.ratio, DR.pitch, 1e-12, "one click of cable times the ratio is one cog pitch");
  near(clickPull(), 2.671, 0.001, "one click pulls");
  for (const [name, M] of Object.entries(MODELS)) {
    assert.equal(M.n, 11, `${name}: eleven cogs`);
    assert.equal(M.links % 2, 0, `${name}: a chain is a whole number of link pairs`);
    near(M.zMax, 10 * DR.pitch, 1e-12);
    assert.ok(M.cogs.every((t, i) => i === 0 || t > M.cogs[i - 1]), "cogs grow inboard");
  }
});

for (const [name, M] of Object.entries(MODELS)) {
  test(`${name}: the loop closes in every gear, re-summed independently, and every run is tangent`, () => {
    for (let k = 0; k < M.n; k++) {
      const p = M.pose(M.pullFor(k), k);
      assert.ok(Number.isFinite(p.alpha), `gear ${k + 1}: the cage found an angle`);
      near(p.path.total, M.L, 0.01, `gear ${k + 1}: model length`);
      // independent sum: the whole path walked point to point
      const pts = polyline(p.path);
      const walked = walk(pts);
      near(walked, M.L, 0.01, `gear ${k + 1}: walked polyline`);
      // tangency: each run's ends lie on their circles, perpendicular to the radius
      p.path.runs.forEach((r, i) => {
        const a = p.path.circles[i], b = p.path.circles[(i + 1) % 4];
        near(Math.hypot(r.p0[0] - a.c[0], r.p0[1] - a.c[1]), a.r, 1e-9, "on circle a");
        near(Math.hypot(r.p1[0] - b.c[0], r.p1[1] - b.c[1]), b.r, 1e-9, "on circle b");
        near((r.p0[0] - a.c[0]) * r.t[0] + (r.p0[1] - a.c[1]) * r.t[1], 0, 1e-9, "tangent at a");
        near((r.p1[0] - b.c[0]) * r.t[0] + (r.p1[1] - b.c[1]) * r.t[1], 0, 1e-9, "tangent at b");
      });
    }
  });

  test(`${name}: through every shift, a quarter-cog at a time, the chain closes and stays inside the cage's swing`, () => {
    for (let q = 0; q <= 4 * M.last; q++) {
      const k = q / 4, p = M.pose(M.pullFor(Math.round(k)), k);
      assert.ok(Number.isFinite(p.alpha), `at ${k}`);
      assert.ok(p.alpha > DR.cageMin && p.alpha < DR.cageMax, `cage at ${p.alpha}`);
      near(p.path.total, M.L, 0.01);
      assert.ok(M.sane(p.path), `every wrap is a proper wrap at ${k}`);
    }
  });

  test(`${name}: the chain runs an S through the cage, so the two pulleys turn opposite ways`, () => {
    for (let k = 0; k < M.n; k++) {
      const p = M.pose(M.pullFor(k), k);
      const [, , guide, tension] = p.path.circles;
      assert.equal(guide.s * tension.s, -1);
      assert.ok(p.path.wraps[2].w > (15 * Math.PI) / 180, `gear ${k + 1}: the guide pulley carries the chain`);
      assert.ok(p.path.wraps[3].w > (60 * Math.PI) / 180, `gear ${k + 1}: the tension pulley carries the chain`);
      // the run between the pulleys crosses the line joining their centres (that is the S)
      const r = p.path.runs[2], G = guide.c, T = tension.c;
      const side = (q) => (T[0] - G[0]) * (q[1] - G[1]) - (T[1] - G[1]) * (q[0] - G[0]);
      assert.ok(side(r.p0) * side(r.p1) < 0, `gear ${k + 1}: the chain crosses between the pulleys`);
    }
  });

  test(`${name}: the guide pulley never touches a cog, the B-screw gap holds on the end cogs, and the slant keeps it close`, () => {
    for (let k = 0; k < M.n; k++) {
      const p = M.pose(M.pullFor(k), k);
      assert.ok(p.gap > 3 && p.gap < 14, `gear ${k + 1}: tip-to-tip gap ${p.gap}`);
    }
    near(M.pose(0, 0).gap, DR.gap, 1e-6, "smallest cog");
    near(M.pose(M.pullFor(M.last), M.last).gap, DR.gap, 1e-6, "largest cog");
    // planted fault: a parallelogram with no slant leaves the pulley on the small cog's line,
    // so the big cog's teeth run into it
    const flat = makeModel({ variant: M.v, dr: { dirBig: DR.dirSmall } });
    const G = flat.G0, R = flat.Rk[flat.last];
    assert.ok(Math.hypot(G[0], G[1]) - R - flat.r - 2 * DR.tipAdd < 0, "without the slant the teeth collide");
  });

  test(`${name}: the parallelogram is rigid: the guide pulley stays one link length from the fixed pivot, and moves steadily inboard`, () => {
    let prev = null;
    for (let i = 0; i <= 100; i++) {
      const z = (M.zMax * i) / 100, g = M.guide3(z);
      const d = Math.hypot(g[0] - M.centre[0], g[1] - M.centre[1], g[2] - M.centre[2]);
      near(d, M.link, 1e-6, `link length at ${z}`);
      near(-g[2], z, 1e-6, "lateral travel");
      if (prev) assert.ok(g[1] < prev[1] + 0.3, "the slant: down as it moves in (never back up by more than a hair)");
      prev = g;
    }
  });

  test(`${name}: the cage spring turns the cage BACK; the chain turns it FORWARD; they balance with the chain in tension`, () => {
    let prev = null;
    for (let q = 0; q <= 4 * M.last; q++) {
      const k = q / 4, p = M.pose(M.pullFor(Math.round(k)), k);
      assert.ok(p.spring < 0, `spring torque ${p.spring} at ${k}: back`);
      assert.ok(p.chainArm > 0, `chain torque per newton ${p.chainArm} at ${k}: forward`);
      assert.ok(p.tension > 0, `tension ${p.tension}`);
      // Independently, by virtual work: turning the cage forward shortens the path the chain needs,
      // so a chain under tension pulls it forward: torque per newton = -dL/dtheta.
      const R = M.cogR(k), h = 0.01;
      const dL = (M.lengthAt(R, p.G, p.alpha + h) - M.lengthAt(R, p.G, p.alpha - h)) / ((2 * h * Math.PI) / 180);
      near(-dL, p.chainArm, 0.01 * p.chainArm, `virtual work at ${k}`);
      // and turning it back would need more chain than there is: the spring takes up slack
      assert.ok(M.lengthAt(R, p.G, p.alpha - 2) > M.L && M.lengthAt(R, p.G, p.alpha + 2) < M.L, `slack at ${k}`);
      if (prev && Number.isInteger(k)) {
        assert.ok(-p.spring > -prev.spring, `the spring winds tighter on bigger cogs (${k})`);
        assert.ok(p.tension > prev.tension, `so the chain is held tighter (${k})`);
      }
      if (Number.isInteger(k)) prev = p;
    }
    // planted fault: a cage spring that turned the cage forward could never balance the chain
    const wrong = makeModel({ variant: M.v, dr: { springFree: 40 } });
    const pw = wrong.pose(0, 0);
    assert.ok(pw.spring > 0 && pw.tension < 0, "a forward spring leaves the chain pushing, not pulling");
  });

  test(`${name}: the chain only changes cog while it turns: it waits for a shift gate`, () => {
    for (let k = 0; k < M.last; k++) {
      assert.equal(M.shiftProgress(0, k), 0, "no pedalling, no shift");
      for (const ph of [0, 0.3, 0.99]) {
        assert.equal(M.shiftProgress(ph * M.gateSpacing(k) - 0.01, k, ph), 0, "before the gate comes round");
        assert.equal(M.shiftProgress(ph * M.gateSpacing(k) + DR.climb, k, ph), 1, "seated a climb after it");
      }
      // the longest wait is one gate spacing: a third of a turn of the cog
      near(M.gateSpacing(k) * DR.gates, M.cogs[k] * DR.p, 1e-9);
    }
    // while the chain waits, the guide pulley is already over the next cog and the chain still closes
    const p = M.pose(M.pullFor(4), 3);
    assert.ok(Number.isFinite(p.alpha) && Math.abs(p.z - M.cogZ(4)) < 1e-9 && p.chainE === -M.cogZ(3));
  });

  test(`${name}: walking the closed path by arc length lands on every circle and comes back round`, () => {
    const p = M.pose(M.pullFor(3), 3);
    const a = pathAt(p.path, 0).p, b = pathAt(p.path, p.path.total).p;
    near(Math.hypot(a[0] - b[0], a[1] - b[1]), 0, 1e-6);
    for (let s = 0; s < p.path.total; s += 7) {
      const q = pathAt(p.path, s), C = p.path.circles[q.i];
      if (!q.on.startsWith("run")) near(Math.hypot(q.p[0] - C.c[0], q.p[1] - C.c[1]), C.r, 1e-6);
    }
  });

  test(`${name}: moving to bigger cogs, the cage swings forward and the tension pulley moves forward`, () => {
    let prev = null;
    for (let k = 0; k < M.n; k++) {
      const p = M.pose(M.pullFor(k), k);
      if (prev) {
        assert.ok(p.alpha > prev.alpha, `gear ${k + 1}: cage forward`);
        assert.ok(p.T[0] > prev.T[0], `gear ${k + 1}: tension pulley forward`);
      }
      prev = p;
    }
    assert.ok(M.wrapLen(M.last) > M.wrapLen(0) + 50, "the big cog holds more chain");
  });

  test(`${name}: planted fault: a chain four links (two pairs) short cannot close on the biggest cog`, () => {
    const short = makeModel({ variant: M.v, links: M.links - 4 });
    const p = short.pose(short.pullFor(short.last), short.last);
    assert.ok(Number.isNaN(p.alpha), "the cage would have to swing past its stop");
  });
}

test("cable: the return spring takes it to the smallest cog, the limit screws stop both ends, and a backed-out L screw lets it into the spokes", () => {
  const M = MODELS.road;
  assert.equal(M.travel(0), M.cogZ(0));
  assert.equal(M.travel(-3), M.cogZ(0), "slack past the H screw: nothing moves out past the smallest cog");
  assert.equal(M.travel(M.pullFor(M.last) + 5), M.zMax, "the L screw stops it at the largest cog");
  for (let k = 0; k < M.n; k++) near(M.travel(M.pullFor(k)), M.cogZ(k), 1e-9, `click ${k}`);
  // the L screw backed out by the spoke gap: an over-pull reaches the spokes
  const x = indexing(M, 11, 7, DR.spokeGap);
  assert.ok(x.spokes && x.cls === "spokes");
  assert.equal(indexing(M, 11, 7, 0).cls, "quiet", "with the screw set, the same over-pull stops on the largest cog");
  assert.equal(indexing(M, 11, 7, 0).stopped, "low");
});

// Reference for the lab: every click lands err x ratio off its cog, clamped by the screws;
// the chain settles on the cog nearest the pulley.
function refIndex(gear, err, cogs = 11) {
  const k = gear - 1, zMax = (cogs - 1) * DR.pitch;
  const z = Math.max(0, Math.min(zMax, k * DR.pitch + err * DR.ratio));
  const on = Math.max(0, Math.min(cogs - 1, Math.round(z / DR.pitch)));
  const off = z - on * DR.pitch, a = Math.abs(off);
  return on !== k ? "wrong" : a <= 0.6 + 1e-9 ? "quiet" : a <= 1.3 + 1e-9 ? "rubs" : "skips";
}

test("the lab's whole range: every gear and cable error gives a finite pose and the reference verdict", () => {
  for (const M of Object.values(MODELS))
    for (let g = 1; g <= 11; g++)
      for (let e10 = -20; e10 <= 20; e10++) {
        const err = e10 / 10, x = indexing(M, g, err);
        assert.equal(x.cls, refIndex(g, err), `gear ${g}, err ${err}`);
        const p = M.pose(x.pull, x.on);
        assert.ok([p.alpha, p.z, p.off, p.gap, ...p.T, ...p.G].every(Number.isFinite), `gear ${g}, err ${err}`);
        if (x.on === x.k && g > 1 && g < 11) near(x.off, err * DR.ratio, 1e-9, "off by err x ratio");
      }
  // one millimetre of slack, mid-cassette: 1.4 mm outboard, past the rubbing band
  const s = indexing(MODELS.road, 6, -1);
  near(s.off, -1.4, 1e-9);
  assert.equal(s.cls, "skips");
});
