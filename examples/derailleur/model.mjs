// Rear derailleur, in millimetres, newtons and degrees. Pure and import-free: build.mjs inlines
// this file into the page, so the page and the tests run the same code.
//
// Side coordinates (drive side, front of the bike to the right): x forward, y up, rear axle at the
// origin. Lateral e: outboard positive, the smallest cog's centre plane at e = 0, bigger cogs
// inboard (negative e). The figure draws the three together in an isometric view.
//
// What the model computes, and never sets:
//  - sideways: the cable pulls the parallelogram inboard against its return spring. Each click of
//    the shifter pulls a fixed length of cable; the derailleur's actuation ratio turns it into one
//    cog pitch of sideways travel. The H and L limit screws stop the travel at the two end cogs.
//  - the parallelogram is rigid: its moving knuckle, and the guide pulley on it, travel on a
//    circular arc about the links' fixed pivots. The arc is slanted, so the guide pulley moves down
//    and back as it moves inboard, keeping the B-screw gap under every bigger cog.
//  - the cage pivots on the guide pulley's axle. Its spring turns it BACK (clockwise in this view),
//    taking up chain; the chain, wrapped round the tension pulley, pulls it FORWARD. The cage
//    settles where the chain's fixed length closes round ring, cog and both pulleys, and the chain
//    then carries exactly the spring's torque: that sets the chain's tension.
//  - the chain moves to another cog only while it turns: it climbs or drops where a shift gate
//    (a ramp and pin on the cog) comes round.
//
// Dimensions are representative of an 11-speed road drivetrain, not one maker's drawing.

export const DR = {
  p: 12.7, // chain pitch
  pitch: 3.74, // cog to cog, sideways (11-speed)
  ratio: 1.4, // actuation ratio: sideways pulley travel per mm of cable
  pulleyT: 11, // teeth on each jockey pulley
  ring: 50, // chainring teeth (one ring, to keep the story on the back)
  ringC: [404, -68], // chainring centre: a 410 mm chainstay, 68 mm bottom-bracket drop
  ringCog: 5, // the chainring lines up with this cog (the sixth): the chainline
  gap: 5.5, // guide pulley to cog, tooth tip to tooth tip, at both end cogs (set by the B screw)
  dirSmall: -115, // direction of the guide pulley from the axle on the smallest cog (degrees)
  dirBig: -124, // ... and on the largest cog
  mount: [-28, -30], // hanger bolt, the B-knuckle's pivot
  pOff: [4, 16], // parallelogram's moving (P) knuckle, from the guide pulley axle
  pLat: 40, // ... and outboard of the guide pulley
  bow: [0.15, 0.75, 0.66], // from the moving knuckle toward the fixed pivots: up and outboard
  link: 46, // parallelogram link length: the radius of the arc the moving knuckle travels on
  tipAdd: 3.2, // tooth tip beyond the pitch circle
  cageMin: -165, // the cage's swing is stopped here and here (degrees from forward)
  cageMax: -30,
  springK: 7, // cage spring rate, N·mm per degree
  springFree: -230, // the cage spring is unloaded here (degrees): past the back stop, so always preloaded
  gates: 3, // shift gates (ramps and pins) per cog
  climb: 38, // mm of chain travel from a gate to the chain seated on the next cog (three links)
  spokeGap: 4, // this far inboard of the largest cog's line, the chain and cage reach the spokes
  dropoutGap: 4, // this far outboard of the smallest cog's line, the chain comes off into the dropout
};

// The page's two drivetrains. Cogs from Shimano's 11-speed ranges; cage = pulley centre distance.
export const VARIANTS = {
  road: { label: "11–28, short cage", cogs: [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28], cage: 58 },
  wide: { label: "11–34, long cage", cogs: [11, 13, 15, 17, 19, 21, 23, 25, 27, 30, 34], cage: 76 },
};

export const pitchR = (n, p = DR.p) => p / (2 * Math.sin(Math.PI / n));
export const clickPull = (D = DR) => D.pitch / D.ratio;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
};
const unit3 = (a) => v3.mul(a, 1 / (v3.len(a) || 1));

// The straight run of a belt leaving circle a and meeting circle b. s = +1 when the chain
// travels counter-clockwise round that circle, -1 clockwise (y up). Returns the two tangent points
// and the unit direction of travel.
export function tangent(a, b) {
  const D = sub(b.c, a.c), d = len(D), u = [D[0] / d, D[1] / d], Ru = [u[1], -u[0]];
  const k = b.r * b.s - a.r * a.s, s = k / d;
  if (Math.abs(s) >= 1) return null;
  const c = Math.sqrt(1 - s * s);
  const t = [c * u[0] + s * Ru[0], c * u[1] + s * Ru[1]], Rt = [t[1], -t[0]];
  const p0 = [a.c[0] + a.r * a.s * Rt[0], a.c[1] + a.r * a.s * Rt[1]];
  const p1 = [b.c[0] + b.r * b.s * Rt[0], b.c[1] + b.r * b.s * Rt[1]];
  return { p0, p1, t, L: c * d };
}

// The chain's path round circles in travel order (closed). Each circle: { c, r, s, name }.
// Returns the runs, the wraps (angles in radians, from arrival to departure) and the total length.
export function beltPath(circles) {
  const n = circles.length, runs = [];
  for (let i = 0; i < n; i++) {
    const tg = tangent(circles[i], circles[(i + 1) % n]);
    if (!tg) return null;
    runs.push(tg);
  }
  const wraps = circles.map((C, i) => {
    const pin = runs[(i - 1 + n) % n].p1, pout = runs[i].p0;
    const a0 = Math.atan2(pin[1] - C.c[1], pin[0] - C.c[0]), a1 = Math.atan2(pout[1] - C.c[1], pout[0] - C.c[0]);
    let w = C.s > 0 ? a1 - a0 : a0 - a1;
    w = ((w % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return { a0, w, L: C.r * w, name: C.name };
  });
  const total = runs.reduce((a, r) => a + r.L, 0) + wraps.reduce((a, w) => a + w.L, 0);
  return { circles, runs, wraps, total };
}

export function makeModel(over = {}) {
  const D = { ...DR, ...(over.dr || {}) };
  const v = over.variant || VARIANTS.road;
  const cogs = v.cogs, n = cogs.length, last = n - 1;
  const Rk = cogs.map((t) => pitchR(t, D.p));
  const r = pitchR(D.pulleyT, D.p), Rring = pitchR(D.ring, D.p);
  const zMax = last * D.pitch; // the largest cog's line, where the L screw stops the travel
  const cogZ = (k) => k * D.pitch;
  const cogE = (k) => -cogZ(k);
  const ringE = cogE(D.ringCog);

  // ---- the parallelogram: the guide pulley travels on an arc of the link's length
  // End points from the B-screw gap on the two end cogs; [x, y, e].
  const reach = (R) => R + r + 2 * D.tipAdd + D.gap;
  const gEnd = (R, a) => [reach(R) * Math.cos(rad(a)), reach(R) * Math.sin(rad(a))];
  const G0s = gEnd(Rk[0], D.dirSmall), G1s = gEnd(Rk[last], D.dirBig);
  const A0 = [G0s[0], G0s[1], 0], A1 = [G1s[0], G1s[1], -zMax];
  const chord = v3.sub(A1, A0), cl = v3.len(chord), cu = unit3(chord);
  // The links reach from the moving knuckle up and outboard to their fixed pivots on the
  // B-knuckle (D.bow, made square to the chord): the arc's centre lies that way.
  const mid = v3.mul(v3.add(A0, A1), 0.5);
  const bowN = unit3(v3.sub(D.bow, v3.mul(cu, v3.dot(D.bow, cu))));
  const link = D.link, half = Math.sqrt(link * link - (cl / 2) ** 2);
  const centre = v3.add(mid, v3.mul(bowN, half));
  const theta0 = Math.asin(cl / 2 / link);
  // A point on the arc, theta from -theta0 (smallest cog) to +theta0 (largest).
  const arc = (th) => v3.add(centre, v3.add(v3.mul(bowN, -link * Math.cos(th)), v3.mul(cu, link * Math.sin(th))));
  // The arc angle for a lateral travel z (the lateral coordinate is monotonic along the arc).
  const thetaOf = (z) => {
    let lo = -theta0 - 0.35, hi = theta0 + 0.35;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (-arc(m)[2] < z) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const guide3 = (z) => arc(thetaOf(z));
  const guideAt = (z) => guide3(z).slice(0, 2);
  const G0 = guideAt(0), G1 = guideAt(zMax);
  const slantDeg = deg(Math.atan2(G0[1] - G1[1], G0[0] - G1[0]));
  // the link swings through this angle from the smallest to the largest cog
  const linkSwing = deg(2 * theta0);

  // Wrap radius for a chain part-way across (k between cogs while it climbs): interpolated.
  const cogR = (k) => {
    const i = Math.max(0, Math.min(last, Math.floor(k))), j = Math.min(last, i + 1), f = Math.max(0, Math.min(1, k - i));
    return Rk[i] + (Rk[j] - Rk[i]) * f;
  };
  const circlesFor = (R, G, alpha, cage = v.cage) => [
    { c: D.ringC, r: Rring, s: 1, name: "ring" },
    { c: [0, 0], r: R, s: 1, name: "cog" },
    { c: G, r, s: -1, name: "guide" },
    { c: [G[0] + cage * Math.cos(rad(alpha)), G[1] + cage * Math.sin(rad(alpha))], r, s: 1, name: "tension" },
  ];
  const lengthAt = (R, G, alpha, cage) => beltPath(circlesFor(R, G, alpha, cage))?.total ?? NaN;
  // Chain length: the shortest whole number of link pairs that lets the cage sit at -38 degrees on
  // the largest cog (the "big-big plus a margin" rule, done with the cage instead of by counting).
  const links = over.links ?? 2 * Math.ceil(lengthAt(Rk[last], G1, -38, v.cage) / (2 * D.p));
  const L = links * D.p;
  // A path is real only if every wrap is a proper wrap (a wrap near a full turn means a pulley
  // has swung through the chain).
  const sane = (pth) => !!pth && pth.wraps.every((w) => w.w > 0.05 && w.w < 1.5 * Math.PI);
  // Solve the cage angle that closes the loop. The chain the path needs falls as the cage turns
  // forward (towards cageMax), so scan back from the forward stop for the first bracket, then bisect.
  function cageAngle(R, G) {
    const f = (a) => {
      const pth = beltPath(circlesFor(R, G, a, v.cage));
      return sane(pth) ? pth.total - L : NaN;
    };
    let hi = D.cageMax, fh = f(hi);
    for (let a = D.cageMax - 2.5; a >= D.cageMin - 1e-9; a -= 2.5) {
      const fa = f(a);
      if (fh <= 0 && fa >= 0) {
        let lo = a;
        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2, fm = f(m);
          if (fm > 0) lo = m;
          else hi = m;
        }
        return (lo + hi) / 2;
      }
      hi = a;
      fh = fa;
    }
    return NaN; // the chain cannot close inside the cage's swing
  }

  // ---- the cage's two torques about its pivot (N·mm; positive turns it forward, counter-clockwise)
  // The spring's torque, from its wind-up; negative: it always turns the cage back.
  const springTorque = (alpha) => -D.springK * (alpha - D.springFree);
  // The chain's torque per newton of chain tension: the chain pulls the tension pulley along both
  // runs that leave it (back up the S to the guide pulley, and forward to the chainring). The
  // guide pulley's own pull passes through the pivot, so only the tension pulley's counts.
  function chainArm(path) {
    const G = path.circles[2].c, T = path.circles[3].c;
    const into = path.runs[2].t, out = path.runs[3].t; // travel guide -> tension, tension -> ring
    const F = [out[0] - into[0], out[1] - into[1]]; // unit tension along each run, away from the pulley
    return { arm: cross(sub(T, G), F), F };
  }

  // ---- sideways travel: cable pull (mm, from the smallest cog's position) to pulley travel,
  // stopped by the limit screws. lOut: how far the L screw is backed out from its setting (mm of travel).
  const travel = (pull, lOut = 0, hOut = 0) => Math.max(0 - hOut, Math.min(zMax + lOut, D.ratio * pull)) + 0;
  // Where a chain settles for a pulley at z: on the nearest cog (past the largest, it stays on it
  // until the cage reaches the spokes).
  const settle = (z) => Math.max(0, Math.min(last, Math.round(z / D.pitch)));

  // Everything about one moment. pull: cable pulled (mm, effective); chainK: the cog the chain is
  // on (fractional while it climbs); lOut: the L screw backed out (mm).
  function pose(pull, chainK, lOut = 0) {
    const z = travel(pull, lOut);
    if (chainK === undefined) chainK = settle(z);
    const G = guideAt(z), R = cogR(chainK);
    const alpha = cageAngle(R, G);
    const circles = circlesFor(R, G, alpha);
    const path = beltPath(circles);
    const T = circles[3].c;
    const P = [G[0] + D.pOff[0], G[1] + D.pOff[1]];
    const gapNow = len(G) - R - r - 2 * D.tipAdd; // tip to tip
    const near = settle(z);
    const sp = springTorque(alpha);
    const ca = path ? chainArm(path) : { arm: NaN, F: [NaN, NaN] };
    return {
      pull, z, e: -z, chainK, chainE: -cogZ(chainK), G, T, P, R, alpha, path, gap: gapNow, cog: near, off: z - cogZ(near), teeth: cogs[Math.round(chainK)],
      theta: thetaOf(z),
      spring: sp, // N·mm, negative: back
      chainArm: ca.arm, // N·mm per N, positive: forward
      chainForce: ca.F,
      tension: -sp / ca.arm, // N, at balance
      spokes: z >= zMax + D.spokeGap - 1e-9,
    };
  }
  // Where a shift gate meets the chain: the chain moves to the next cog only after the cassette
  // has turned far enough to bring a gate round (travel in mm of chain), then over `climb` mm.
  // phase: how far round (0..1 of a gate spacing) the next gate is when the cable moves.
  const gateSpacing = (k) => (cogs[k] * D.p) / D.gates;
  const shiftProgress = (travelMM, k, phase = 0.5) => { const f = (travelMM - phase * gateSpacing(k)) / D.climb; return f <= 0 ? 0 : f >= 1 - 1e-9 ? 1 : f; };

  const wrapLen = (k) => pose(k * clickPull(D), k).path.wraps[1].L;
  // The chain held inside the cage (guide wrap, the S between the pulleys, tension wrap) on a cog.
  const inCage = (k) => {
    const pth = pose(k * clickPull(D), k).path;
    return pth.wraps[2].L + pth.runs[2].L + pth.wraps[3].L;
  };
  // The whole derailleur turned `deg` degrees about its mounting bolt (the B screw's motion, in the
  // side view; positive is counter-clockwise): the gap, tooth tip to tooth tip, in gear k.
  const bGap = (k, deg) => {
    const G = guideAt(cogZ(k)), c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
    const d = [G[0] - D.mount[0], G[1] - D.mount[1]];
    return len([D.mount[0] + c * d[0] - s * d[1], D.mount[1] + s * d[0] + c * d[1]]) - Rk[k] - r - 2 * D.tipAdd;
  };
  const p0 = pose(0, 0), p1 = pose(last * clickPull(D), last);
  const gaps = cogs.map((_, k) => pose(k * clickPull(D), k).gap);
  // Plain numbers the page states (factsFrom reads plain data, so they are stored, not computed).
  const N = {
    swing: p1.alpha - p0.alpha, // degrees the cage turns forward, smallest to largest cog
    alpha0: p0.alpha,
    alpha1: p1.alpha,
    forward: p1.T[0] - p0.T[0], // mm the tension pulley moves forward
    extraWrap: wrapLen(last) - wrapLen(0), // mm more chain round the largest cog
    halfWrap: ((cogs[last] - cogs[0]) / 2) * D.p, // the half-wrap rule's estimate
    takeUp: inCage(0) - inCage(last), // mm the cage gives up, smallest to largest cog
    tension0: p0.tension,
    tension1: p1.tension,
    spring0: -p0.spring,
    spring1: -p1.spring,
    gapMax: Math.max(...gaps),
    gapMin: Math.min(...gaps),
    slant: Math.abs(slantDeg),
    linkSwing,
    big: cogs[last],
    small: cogs[0],
    spokeTravel: zMax + D.spokeGap,
    halfPitch: D.pitch / 2,
    // where the extra chain on the largest cog comes from, smallest to largest cog: the loop through
    // the cage gives up takeUp; the rest of the loop gives up restShort, chiefly the lower run to the chainring
    restShort: wrapLen(last) - wrapLen(0) - (inCage(0) - inCage(last)),
    lowerShort: p0.path.runs[3].L - p1.path.runs[3].L,
    // the rest of the loop, piece by piece (the S between the pulleys does not change): the lower run and the
    // chainring's wrap give up chain; the top run to the cog and the run from the cog to the guide pulley take it back
    ringShort: p0.path.wraps[0].L - p1.path.wraps[0].L,
    topLonger: p1.path.runs[0].L - p0.path.runs[0].L,
    cogRunLonger: p1.path.runs[1].L - p0.path.runs[1].L,
    spokePull: D.spokeGap / D.ratio, // mm of cable past the largest cog's pull that carries the guide pulley spokeGap past it
  };
  return {
    D, v, cogs, n, last, Rk, r, Rring, zMax, G0, G1, slantDeg, links, L, ringE, N,
    centre, link, theta0, guide3, thetaOf, cogE,
    guideAt, cogR, sane, travel, cogZ, settle, cageAngle, pose, lengthAt, circlesFor, springTorque, chainArm,
    gateSpacing, shiftProgress, wrapLen, inCage, bGap,
    clickPull: clickPull(D),
    pullFor: (k) => k * clickPull(D),
  };
}

/**
 * The extra chain on the largest cog and where it comes from, printed so every sum on the page adds up:
 * extra = cage + rest, and rest = lower + ring - top - run. Each figure is rounded on its own, so the
 * page prints them to the fewest decimals at which both sums hold exactly (the road cassette needs none;
 * the wide one needs two).
 */
export function shares(M) {
  const N = M.N, near = (a, b) => Math.abs(a - b) < 1e-9;
  for (let dec = 0; dec <= 3; dec++) {
    const f = (v) => +v.toFixed(dec);
    if (near(f(N.extraWrap), f(N.takeUp) + f(N.restShort)) && near(f(N.restShort), f(N.lowerShort) + f(N.ringShort) - f(N.topLonger) - f(N.cogRunLonger))) {
      const t = (v) => v.toFixed(dec);
      return { dec, extra: t(N.extraWrap), cage: t(N.takeUp), rest: t(N.restShort), lower: t(N.lowerShort), ring: t(N.ringShort), top: t(N.topLonger), run: t(N.cogRunLonger) };
    }
  }
  throw new Error("the shares of the extra chain do not add up at any precision");
}

export const MODELS = Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, makeModel({ variant: v })]));

// Indexing with a cable that is off by err mm (negative: slack, as from stretch or settled
// housing). Every click lands err x ratio off its cog. Verdict bands (representative, for an
// 11-speed chain): quiet within 0.6 mm, rubbing the next cog to 1.3 mm, skipping up to half a
// pitch, past that the chain sits on the neighbouring cog. lOut: the L screw backed out (mm).
export const BANDS = { quiet: 0.6, rubs: 1.3 };
export function indexing(M, gear, err, lOut = 0, hOut = 0) {
  const k = gear - 1, pull = M.pullFor(k) + err, z = M.travel(pull, lOut, hOut), on = M.settle(z), off = z - M.cogZ(on);
  const want = M.cogZ(k), a = Math.abs(off);
  const raw = M.D.ratio * pull;
  const stopped = raw < -hOut - 1e-9 ? "high" : raw > M.zMax + lOut + 1e-9 ? "low" : null;
  const spokes = z >= M.zMax + M.D.spokeGap - 1e-9;
  const dropout = z <= -M.D.dropoutGap + 1e-9; // thrown outboard off the smallest cog, into the dropout
  const over = z > M.zMax + 1e-9; // past the largest cog's line
  const cls = spokes ? "spokes" : dropout ? "dropout" : over ? "over" : on !== k ? "wrong" : a <= BANDS.quiet + 1e-9 ? "quiet" : a <= BANDS.rubs + 1e-9 ? "rubs" : "skips";
  return { k, pull, z, on, off, want, cls, stopped, over, spokes, dropout, side: off > 1e-9 ? "inboard" : off < -1e-9 ? "outboard" : "on" };
}

// ---------------------------------------------------------------- outlines, for drawing
// A sprocket's outline: N teeth on pitch radius R, tips tip beyond it, roller seats below it.
export function toothPts(N, R, tip = DR.tipAdd, rot = 0) {
  const pts = [], s = (2 * Math.PI) / N, root = R - 3.0;
  for (let j = 0; j < N; j++) {
    const a = rot + j * s;
    for (const [f, rr] of [[-0.5, root], [-0.3, root + 0.5], [-0.09, R + tip], [0.09, R + tip], [0.3, root + 0.5]]) pts.push([rr * Math.cos(a + f * s), rr * Math.sin(a + f * s)]);
  }
  return pts;
}
// The chain's centre line as points (arcs every 1.5 degrees), starting on the chainring.
export function chainPts(path, stepDeg = 1.5) {
  const pts = [];
  path.circles.forEach((C, i) => {
    const w = path.wraps[i], n = Math.max(1, Math.ceil((w.w * 180) / Math.PI / stepDeg));
    for (let j = 0; j <= n; j++) {
      const a = w.a0 + C.s * (w.w * j) / n;
      pts.push([C.c[0] + C.r * Math.cos(a), C.c[1] + C.r * Math.sin(a)]);
    }
  });
  pts.push(pts[0]);
  return pts;
}
// The point at arc length s along the closed path (from the start of the ring's wrap), with the
// segment it lies on: "ring", "cog", "guide", "tension" for a wrap, or "run0".."run3".
export function pathAt(path, s) {
  const n = path.circles.length;
  s = ((s % path.total) + path.total) % path.total;
  for (let i = 0; i < n; i++) {
    const C = path.circles[i], w = path.wraps[i];
    if (s <= w.L) {
      const a = w.a0 + (C.s * s) / C.r;
      return { p: [C.c[0] + C.r * Math.cos(a), C.c[1] + C.r * Math.sin(a)], on: C.name, i, f: s / w.L };
    }
    s -= w.L;
    const run = path.runs[i];
    if (s <= run.L) return { p: [run.p0[0] + run.t[0] * s, run.p0[1] + run.t[1] * s], on: "run" + i, i, f: s / run.L };
    s -= run.L;
  }
  return { p: path.runs[n - 1].p1, on: "run" + (n - 1), i: n - 1, f: 1 };
}
