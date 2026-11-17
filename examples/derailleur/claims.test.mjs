// node --test examples/derailleur/claims.test.mjs
//
// What the page says about the derailleur, checked against the model (the independent reviewer's
// findings): the direction of the chain the cage pays out, which cogs a slack cable leaves short,
// the thresholds as cable and as distance off line, the barrel adjuster rule both ways, both limit
// screws' failures, the B screw's gap, and that only forward pedalling shifts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, makeModel, indexing, BANDS, shares } from "./model.mjs";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b}`);

for (const [name, M] of Object.entries(MODELS)) {
  test(`${name}: the cage pays out chain going up the cassette and takes it back coming down; the rest comes from the lower run`, () => {
    for (let k = 1; k < M.n; k++) assert.ok(M.inCage(k) < M.inCage(k - 1), `the cage holds less chain on cog ${k + 1} than on cog ${k}`);
    // the extra chain on the largest cog is supplied by the cage's loop and by the rest of the loop
    near(M.N.takeUp + M.N.restShort, M.N.extraWrap, 1e-9, "the two shares add up to the extra wrap");
    assert.ok(M.N.takeUp > 0 && M.N.restShort > 0);
    // the rest of the loop gives up chain chiefly at the lower run, which shortens as the tension pulley moves forward
    assert.ok(M.N.lowerShort > M.N.restShort, "the lower run shortens by more than the whole remainder");
    assert.ok(M.N.forward > 0);
    // independent: the whole path is the same length in every gear (the chain cannot stretch)
    for (const k of [0, 5, M.last]) near(M.pose(M.pullFor(k), k).path.total, M.L, 0.01);
  });

  test(`${name}: the H screw holds the smallest cog on its line, so a slack cable leaves every other cog 1.4 mm outboard`, () => {
    const D = M.D;
    for (let g = 1; g <= M.n; g++) {
      const slack = indexing(M, g, -1), tight = indexing(M, g, 1);
      if (g === 1) {
        assert.equal(slack.off, 0, "the smallest cog does not move with a slack cable");
        assert.equal(slack.stopped, "high", "the H screw stops it");
        assert.equal(slack.cls, "quiet");
      } else {
        near(slack.off, -D.ratio, 1e-9, `cog ${g}: slack lands outboard`);
        assert.equal(slack.side, "outboard");
      }
      if (g < M.n) {
        near(tight.off, D.ratio, 1e-9, `cog ${g}: tight lands inboard`);
        assert.equal(tight.side, "inboard");
      }
    }
  });

  test(`${name}: the extra chain adds up as printed (extra = cage + rest, rest = lower + ring - top - run), and the lower run is measured independently`, () => {
    const x = shares(M), n = Number;
    near(n(x.extra), n(x.cage) + n(x.rest), 1e-9, "extra = cage + rest, as printed");
    near(n(x.rest), n(x.lower) + n(x.ring) - n(x.top) - n(x.run), 1e-9, "rest = lower + ring - top - run, as printed");
    // the printed figures are the model's, each to the printed precision
    const tol = 0.5 * 10 ** -x.dec + 1e-9;
    near(n(x.extra), M.N.extraWrap, tol); near(n(x.cage), M.N.takeUp, tol); near(n(x.rest), M.N.restShort, tol);
    near(n(x.lower), M.N.lowerShort, tol); near(n(x.ring), M.N.ringShort, tol); near(n(x.top), M.N.topLonger, tol); near(n(x.run), M.N.cogRunLonger, tol);
    // exact, unrounded
    near(M.N.restShort, M.N.lowerShort + M.N.ringShort - M.N.topLonger - M.N.cogRunLonger, 1e-9);
    // the chain gives up at the lower run and the ring, and takes back at the top run and the run to the guide pulley
    assert.ok(M.N.lowerShort > 0 && M.N.ringShort > 0 && M.N.topLonger > 0 && M.N.cogRunLonger > 0);
    // the lower run, from the pulley and ring geometry alone: an external tangent, sqrt(d^2 - (R - r)^2)
    const run = (k) => { const p = M.pose(M.pullFor(k), k), d = Math.hypot(M.D.ringC[0] - p.T[0], M.D.ringC[1] - p.T[1]); return Math.sqrt(d * d - (M.Rring - M.r) ** 2); };
    near(run(0) - run(M.last), M.N.lowerShort, 1e-6, "the lower run, measured from the pulley and ring positions");
    // and no figure was ever printed as a lone rounded sum: the precision is the fewest decimals at which both sums hold
    if (x.dec > 0) {
      const f = (v) => +v.toFixed(x.dec - 1);
      assert.ok(Math.abs(f(M.N.extraWrap) - f(M.N.takeUp) - f(M.N.restShort)) > 1e-9 || Math.abs(f(M.N.restShort) - f(M.N.lowerShort) - f(M.N.ringShort) + f(M.N.topLonger) + f(M.N.cogRunLonger)) > 1e-9, "one decimal fewer would not add up");
    }
  });

  test(`${name}: a tight cable is held by the L screw at the largest cog, a slack one by the H screw at the smallest; every other cog lands 1.4 mm off`, () => {
    for (let g = 1; g <= M.n; g++) {
      const tight = indexing(M, g, 1), slack = indexing(M, g, -1);
      near(Math.abs(tight.off), g === M.n ? 0 : M.D.ratio, 1e-9, `tight, cog ${g}`);
      near(Math.abs(slack.off), g === 1 ? 0 : M.D.ratio, 1e-9, `slack, cog ${g}`);
    }
    assert.equal(indexing(M, M.n, 1).stopped, "low");
    assert.equal(indexing(M, 1, -1).stopped, "high");
  });

  test(`${name}: the thresholds, as cable and as distance off line, and the side the chain rubs on`, () => {
    const D = M.D, g = 6;
    // quiet to rub at 0.6 mm off line = 0.43 mm of cable; rub to skip at 1.3 mm = 0.93 mm;
    // skip to the wrong cog at half a cog = 1.34 mm
    for (const [off, below, above] of [[BANDS.quiet, "quiet", "rubs"], [BANDS.rubs, "rubs", "skips"], [D.pitch / 2, "skips", "wrong"]]) {
      const cable = off / D.ratio;
      assert.equal(indexing(M, g, -(cable - 0.01)).cls, below, `${off} mm off line is ${cable.toFixed(2)} mm of cable`);
      assert.equal(indexing(M, g, -(cable + 0.01)).cls, above);
      assert.equal(indexing(M, g, cable - 0.01).cls, below, "a tight cable has the same bands");
    }
    near(BANDS.quiet / D.ratio, 0.43, 0.005);
    near(BANDS.rubs / D.ratio, 0.93, 0.005);
    near(D.pitch / 2 / D.ratio, 1.34, 0.005);
    // slack rubs the next smaller cog (outboard), tight the next larger (inboard)
    assert.equal(indexing(M, g, -0.6).side, "outboard");
    assert.equal(indexing(M, g, 0.6).side, "inboard");
  });

  test(`${name}: the barrel adjuster rule, both ways: slack hesitates going up (turn out), tight hesitates going down (turn in)`, () => {
    for (let g = 2; g < M.n; g++) {
      // too slack: the chain stays on the next smaller cog going up; too tight: on the next larger going down
      assert.equal(indexing(M, g, -1.5).on, g - 2, `cog ${g}: slack, the chain stays on the next smaller cog`);
      assert.equal(indexing(M, g, 1.5).on, g, `cog ${g}: tight, the chain stays on the next larger cog`);
      // out takes up slack, in takes up a tight cable: an equal and opposite correction zeroes the error
      near(indexing(M, g, -1 + 1).off, 0, 1e-9);
      near(indexing(M, g, 1 - 1).off, 0, 1e-9);
    }
  });

  test(`${name}: the H screw backed out lets the return spring throw the chain into the dropout; the L screw backed out lets a pull reach the spokes`, () => {
    const D = M.D;
    // H: cable slack enough that the spring pulls the guide pulley dropoutGap outboard of the smallest cog
    assert.ok(indexing(M, 1, -3, 0, D.dropoutGap).dropout);
    assert.ok(!indexing(M, 1, -3, 0, D.dropoutGap - 0.1).dropout, "a screw out less than that holds it");
    assert.ok(!indexing(M, 1, -3, 0, 0).dropout, "with the screw set, no cable error reaches the dropout");
    assert.equal(indexing(M, 1, -3, 0, D.dropoutGap).cls, "dropout");
    // L: it takes a screw out by spokeGap and a pull of spokeGap / ratio past the largest cog's pull
    assert.ok(indexing(M, M.n, M.N.spokePull + 1e-6, D.spokeGap).spokes);
    assert.ok(!indexing(M, M.n, M.N.spokePull - 0.05, D.spokeGap).spokes, "a smaller pull falls short");
    assert.ok(!indexing(M, M.n, 9, D.spokeGap - 0.1).spokes, "a screw out less than that holds it");
    // 2 mm of extra pull is 2.8 mm of travel: stopped on the largest cog's line with the screw set, and
    // still short of the spokes with the screw out 4 mm
    near(2 * D.ratio, 2.8, 1e-9);
    assert.ok(2 * D.ratio < D.spokeGap);
    assert.equal(indexing(M, M.n, 2, 0).stopped, "low");
    assert.ok(!indexing(M, M.n, 2, D.spokeGap).spokes);
    near(M.N.spokePull, 2.857, 0.001);
  });

  test(`${name}: the B screw turns the whole body about its bolt, moving the guide pulley toward or away from every cog together; the gap sets the chain's free run`, () => {
    const up = M.cogs.map((_, k) => M.bGap(k, 1) - M.bGap(k, 0)), down = M.cogs.map((_, k) => M.bGap(k, -1) - M.bGap(k, 0));
    assert.ok(up.every((d) => d < -0.05) || up.every((d) => d > 0.05), "one turn changes every gap the same way");
    assert.ok(down.every((d, k) => d * up[k] < 0), "the other turn changes them the other way");
    near(M.bGap(3, 0), M.pose(M.pullFor(3), 3).gap, 1e-9, "no turn is the model's own gap");
    // set with the chain on the largest cog, as close as it can run: the gap there is the set gap,
    // and no cog has a smaller one
    near(M.pose(M.pullFor(M.last), M.last).gap, M.D.gap, 1e-9);
    assert.ok(M.cogs.every((_, k) => M.pose(M.pullFor(k), k).gap >= M.D.gap - 1e-9));
    // too close: the guide pulley's teeth reach the largest cog's; too far: a longer unsupported run
    const close = makeModel({ variant: M.v, dr: { gap: 0 } }), far = makeModel({ variant: M.v, dr: { gap: M.D.gap + 5 } });
    near(close.pose(close.pullFor(close.last), close.last).gap, 0, 1e-6);
    const run = (m) => m.pose(m.pullFor(m.last), m.last).path.runs[1].L;
    assert.ok(run(far) > run(M) && run(M) > run(close), "the free run grows with the gap");
  });

  test(`${name}: only forward pedalling shifts: coasting and backpedalling move the chain no further`, () => {
    for (let k = 0; k < M.last; k++) {
      assert.equal(M.shiftProgress(0, k), 0, "coasting: no chain travel");
      for (const back of [-1, -30, -300]) assert.equal(M.shiftProgress(back, k), 0, "backpedalling: negative travel");
      assert.equal(M.shiftProgress(M.D.climb + M.gateSpacing(k), k), 1, "forward pedalling does");
    }
  });
}
