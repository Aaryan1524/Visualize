// Escalator kinematics. Millimetres; x points in the direction of up-travel, y points up.
// Pure and import-free: build.mjs inlines this file into the page, so the page and the
// tests run the same code. makeModel(p) builds one escalator; the named exports below are
// the standard one (30 degrees, 3000 mm rise).

const DEG = Math.PI / 180;

export const BASE = {
  pitch: 400, // chain pitch per step (3 links of 133.33 mm)
  links: 3,
  incline: 30, // degrees
  rise: 3000, // floor to floor
  speed: 500, // chain speed, mm/s
  teeth: 16, // step-chain sprocket teeth (both sprockets)
  rLow: 1000, // lower transition radius of the chain pitch line
  rUp: 1500, // upper transition radius
  flatLow: 1350, // lower sprocket top to start of the lower transition
  combUpBack: 350, // upper comb tip sits this far before the drive sprocket axis
  combLowAhead: 120, // lower comb tip sits this far past the tension sprocket axis
  floorAboveTread: 30, // finished floor level above the tread plane
  plateThick: 15, // landing floor plate thickness
  width: 1000, // step width (stated, not drawn)
  // Upper turnaround: rotation starts dA after the chain meets the sprocket and
  // finishes dB after it leaves. Lower: starts dC before, finishes dD before the top.
  dA: 0,
  dB: 200,
  dC: 200,
  dD: 0,
};

// The escalators the page can show. Both inclines are standard; 35 degrees is allowed up to
// a 6 m rise at 0.5 m/s.
export const VARIANTS = {
  standard: { incline: 30, rise: 3000, label: "30° standard" },
  steep: { incline: 35, rise: 3000, label: "35° steep" },
};

// Step, in its own frame: origin at the chain-wheel axle, tread level when phi = 0.
const BASE_STEP = {
  t: 270, // tread surface above the chain-wheel axle
  f: 45, // tread nose ahead of the axle
  gap: 8, // tread-to-riser running clearance
  tread: 32, // tread plate depth (cleats + plate)
  cleat: 9, // cleat (groove) depth
  T: [-240, 30], // trailer-wheel axle
  rc: 50, // chain wheel radius (dia 100)
  rt: 38, // trailer wheel radius (dia 76)
  hubC: 26,
  hubT: 22,
};

// ---------- pure geometry ----------

export const rot = (phi, v) => [v[0] * Math.cos(phi) - v[1] * Math.sin(phi), v[0] * Math.sin(phi) + v[1] * Math.cos(phi)];
export function toWorld(pose, v) {
  const r = rot(pose.phi, v);
  return [pose.x + r[0], pose.y + r[1]];
}
export function placePolygon(pose, poly) {
  return poly.map((v) => toWorld(pose, v));
}
export function arcPts(c, r, a0deg, a1deg, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0deg + ((a1deg - a0deg) * i) / n) * DEG;
    pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return pts;
}
export function convexHull(points) {
  const pts = points.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper); // counter-clockwise
}
function project(poly, ax) {
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) {
    const d = p[0] * ax[0] + p[1] * ax[1];
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo, hi];
}
// Separation between two convex polygons: > 0 apart (lower bound on the gap), <= 0 overlapping.
export function convexGap(a, b) {
  let best = -Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ex = q[0] - p[0], ey = q[1] - p[1];
      const m = Math.hypot(ex, ey);
      if (m < 1e-9) continue;
      const ax = [ey / m, -ex / m];
      const [a0, a1] = project(a, ax), [b0, b1] = project(b, ax);
      const gap = Math.max(b0 - a1, a0 - b1);
      if (gap > best) best = gap;
    }
  }
  return best;
}
export function pointSegDist(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  let u = L2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2 : 0;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vy);
}
export function pointPolylineDist(p, line, closed = false) {
  let d = Infinity;
  const n = line.length;
  for (let i = 0; i < n - 1 + (closed ? 1 : 0); i++) d = Math.min(d, pointSegDist(p, line[i], line[(i + 1) % n]));
  return d;
}
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Signed gap from a circle to a polygon: > 0 clear.
export function circlePolyGap(c, r, poly) {
  const d = pointPolylineDist(c, poly, true);
  return pointInPolygon(c, poly) ? -d - r : d - r;
}

// ---------- the chain pitch line: lines and arcs, arc-length parameterised ----------

function lineSeg(p0, dir, len, name) {
  return { kind: "line", p0, dir, len, name };
}
function arcSeg(c, r, a0, sweep, name) {
  return { kind: "arc", c, r, a0, sweep, len: Math.abs(sweep) * r, name };
}
function segPoint(g, u) {
  if (g.kind === "line") return [g.p0[0] + g.dir[0] * u, g.p0[1] + g.dir[1] * u];
  const a = g.a0 + Math.sign(g.sweep) * (u / g.r);
  return [g.c[0] + g.r * Math.cos(a), g.c[1] + g.r * Math.sin(a)];
}
function segTangent(g, u) {
  if (g.kind === "line") return g.dir;
  const sg = Math.sign(g.sweep);
  const a = g.a0 + sg * (u / g.r);
  return [-Math.sin(a) * sg, Math.cos(a) * sg];
}
export const sprocketRadius = (p) => (p.teeth * (p.pitch / p.links)) / (2 * Math.PI);

export function buildPath(p = BASE) {
  const Rs = sprocketRadius(p), D = 2 * Rs;
  const th = p.incline * DEG;
  const segs = [];
  const add = (g) => (segs.push(g), segPoint(g, g.len));
  const k = 1 - Math.cos(th);
  const Linc = (p.rise - (p.rLow + p.rUp) * k) / Math.sin(th);
  // Loop length must be a whole number of steps: solve the upper flat for it.
  const fixed = 2 * (p.flatLow + Linc) + 2 * th * (p.rLow + p.rUp) + 2 * Math.PI * Rs;
  const N = Math.ceil((fixed + 2 * 1480) / p.pitch);
  const flatUp = (N * p.pitch - fixed) / 2;

  let q = add(lineSeg([0, 0], [1, 0], p.flatLow, "lower landing"));
  q = add(arcSeg([q[0], p.rLow], p.rLow, -Math.PI / 2, th, "lower transition"));
  q = add(lineSeg(q, [Math.cos(th), Math.sin(th)], Linc, "incline"));
  const cUp = [q[0] + p.rUp * Math.sin(th), q[1] - p.rUp * Math.cos(th)];
  q = add(arcSeg(cUp, p.rUp, Math.PI / 2 + th, -th, "upper transition"));
  const xE = q[0];
  q = add(lineSeg(q, [1, 0], flatUp, "upper landing"));
  const S_up = [q[0], p.rise - Rs];
  q = add(arcSeg(S_up, Rs, Math.PI / 2, -Math.PI, "upper turn"));
  q = add(lineSeg(q, [-1, 0], flatUp, "return, upper"));
  q = add(arcSeg(cUp, p.rUp - D, Math.PI / 2, th, "return, upper transition"));
  q = add(lineSeg(q, [-Math.cos(th), -Math.sin(th)], Linc, "return, incline"));
  q = add(arcSeg([p.flatLow, p.rLow], p.rLow + D, -Math.PI / 2 + th, -th, "return, lower transition"));
  q = add(lineSeg(q, [-1, 0], p.flatLow, "return, lower"));
  const S_low = [0, -Rs];
  add(arcSeg(S_low, Rs, -Math.PI / 2, -Math.PI, "lower turn"));

  let s = 0;
  for (const g of segs) {
    g.s0 = s;
    s += g.len;
  }
  const L = s;
  const by = Object.fromEntries(segs.map((g) => [g.name, g]));
  return { segs, by, L, N, flatUp, Linc, S_up, S_low, cUp, xE, th, Rs, D };
}

function locate(s, path) {
  const L = path.L;
  s = ((s % L) + L) % L;
  const segs = path.segs;
  let i = segs.length - 1;
  for (let j = 0; j < segs.length; j++) {
    if (s < segs[j].s0 + segs[j].len) {
      i = j;
      break;
    }
  }
  return [segs[i], s - segs[i].s0, s];
}
const smoother = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 + u * (-15 + 6 * u)));

// Plain numbers a reader can check by hand.
export const stepRise = (p) => p.pitch * Math.sin(p.incline * DEG);
export const stepGoing = (p) => p.pitch * Math.cos(p.incline * DEG);

// ---------- one escalator ----------

export function makeModel(over = {}) {
  const P = { ...BASE, ...over };
  // The riser must reach down past the tread below at this incline (plus a margin).
  const STEP = { ...BASE_STEP, riserTo: 180 + P.incline + 4 };
  const PATH = buildPath(P);
  const { Rs, D } = PATH;
  const RISER_R = P.pitch - STEP.gap;

  const chainPoint = (s) => {
    const [g, u] = locate(s, PATH);
    return segPoint(g, u);
  };
  const chainTangent = (s) => {
    const [g, u] = locate(s, PATH);
    return segTangent(g, u);
  };
  const segmentAt = (s) => locate(s, PATH)[0].name;

  // ----- step orientation through the turnarounds -----
  const up = PATH.by["upper turn"], low = PATH.by["lower turn"];
  const SCHED = { sA: up.s0 + P.dA, sB: up.s0 + up.len + P.dB, sC: low.s0 - P.dC, sD: low.s0 + low.len - P.dD };
  // phi in radians, continuous along the loop: 0 on the passenger run, -pi on the return.
  const orientation = (s) => {
    const L = PATH.L, sc = SCHED;
    s = ((s % L) + L) % L;
    if (s < sc.sA) return 0;
    if (s <= sc.sB) return -Math.PI * smoother((s - sc.sA) / (sc.sB - sc.sA));
    if (s < sc.sC) return -Math.PI;
    if (s <= sc.sD) return -Math.PI - Math.PI * smoother((s - sc.sC) / (sc.sD - sc.sC));
    return -2 * Math.PI;
  };
  const stepPose = (s) => {
    const [x, y] = chainPoint(s);
    return { s, x, y, phi: orientation(s) };
  };
  const trailerPoint = (s) => toWorld(stepPose(s), STEP.T);
  // Positions of every step for a chain advance of `travel` mm. Step 0 is the followed step.
  const stepPositions = (travel) => {
    const out = [];
    for (let i = 0; i < PATH.N; i++) out.push(stepPose(travel - i * P.pitch));
    return out;
  };

  // ----- step shape (local frame) -----
  const STEP_OUTLINE = (() => {
    const { t, f, riserTo } = STEP;
    const riser = arcPts([f, t], RISER_R, 180, riserTo, 24);
    const pts = [[f, t], [f, t - STEP.tread - 4], [f - 6, t - STEP.tread - 14]];
    pts.push(...riser);
    pts.push(...arcPts(STEP.T, STEP.hubT, 90, 300, 10));
    pts.push(...arcPts([0, 0], STEP.hubC, 180, 400, 12));
    return convexHull(pts);
  })();

  // ----- sampled loci and rails -----
  const sampleLocus = (fn, ds = 10) => {
    const n = Math.ceil(PATH.L / ds);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(fn((i * PATH.L) / n));
    return pts;
  };
  // Offset of a sampled open run of a locus [s0, s1] to the right (+1) or left (-1) of travel.
  const offsetRun = (fn, s0, s1, dist, side, ds = 8) => {
    const n = Math.max(2, Math.ceil((s1 - s0) / ds));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      const a = fn(s - 0.5), b = fn(s + 0.5);
      const tx = b[0] - a[0], ty = b[1] - a[1];
      const m = Math.hypot(tx, ty) || 1;
      const nx = (ty / m) * side, ny = (-tx / m) * side;
      const c = fn(s);
      out.push([c[0] + nx * dist, c[1] + ny * dist]);
    }
    return out;
  };
  // The two tracks as the rails a wheel bears on: below the wheel on both straight runs,
  // a closed guide channel (both sides) through each turnaround.
  const rails = () => {
    const L = PATH.L, sc = SCHED, clr = 6;
    return {
      chain: {
        pass: offsetRun(chainPoint, low.s0 + low.len - L + 40, up.s0 - 40, STEP.rc, +1),
        ret: offsetRun(chainPoint, up.s0 + up.len + 40, low.s0 - 40, STEP.rc, -1),
      },
      trailer: {
        pass: offsetRun(trailerPoint, sc.sD - L, sc.sA, STEP.rt, +1),
        ret: offsetRun(trailerPoint, sc.sB, sc.sC, STEP.rt, -1),
        upIn: offsetRun(trailerPoint, sc.sA, sc.sB, STEP.rt, +1),
        upOut: offsetRun(trailerPoint, sc.sA, sc.sB, STEP.rt + clr, -1),
        lowIn: offsetRun(trailerPoint, sc.sC, sc.sD, STEP.rt + clr, +1),
        lowOut: offsetRun(trailerPoint, sc.sC, sc.sD, STEP.rt, -1),
      },
    };
  };

  // ----- fixed structure the section plane cuts -----
  const LAND = (() => {
    const xS = PATH.S_up[0];
    const upT = P.rise + STEP.t, lowT = STEP.t, ffl = P.floorAboveTread;
    const combUp = xS - P.combUpBack, combLow = P.combLowAhead;
    return {
      treadUp: upT,
      treadLow: lowT,
      fflUp: upT + ffl,
      fflLow: lowT + ffl,
      combUp,
      combLow,
      // comb plates: solid wedge above the tread plane (the teeth run on into the grooves)
      combPlateUp: [[combUp, upT + 3], [combUp + 70, upT + 3], [combUp + 130, upT + ffl], [combUp + 70, upT + ffl]],
      combPlateLow: [[combLow, lowT + 3], [combLow - 70, lowT + 3], [combLow - 130, lowT + ffl], [combLow - 70, lowT + ffl]],
      plateUp: [[combUp + 70, upT + ffl - P.plateThick], [xS + 2050, upT + ffl - P.plateThick], [xS + 2050, upT + ffl], [combUp + 70, upT + ffl]],
      plateLow: [[-1250, lowT + ffl - P.plateThick], [combLow - 70, lowT + ffl - P.plateThick], [combLow - 70, lowT + ffl], [-1250, lowT + ffl]],
    };
  })();

  // ----- truss: bottom chord and the cross members the section cuts -----
  const STRUCT = (() => {
    const th = PATH.th;
    const ret = PATH.by["return, incline"];
    const Q = chainPoint(ret.s0);
    const dir = [Math.cos(th), Math.sin(th)];
    const below = [Math.sin(th), -Math.cos(th)];
    const chordGap = 500, chordDepth = 140; // inner edge of the bottom chord below the return chain line
    const yLowIn = -1130, yUpIn = 1560; // inner edge of the bottom chord at the two ends
    const q0 = [Q[0] + below[0] * chordGap, Q[1] + below[1] * chordGap];
    const xAtY = (y) => q0[0] + ((y - q0[1]) * dir[0]) / dir[1];
    const xL = xAtY(yLowIn), xU = xAtY(yUpIn);
    const xS = PATH.S_up[0];
    const xEndLow = -1050, xEndUp = xS + 1950;
    // the upper knee gets a short chamfer, clear of the convex return transition
    const inner = [[xEndLow, yLowIn], [xL, yLowIn], [xU - 260, yUpIn - (260 * dir[1]) / dir[0]], [xU + 220, yUpIn], [xEndUp, yUpIn]];
    const members = [];
    const panel = 1150;
    let acc = 0;
    for (let i = 0; i < inner.length - 1; i++) {
      const a = inner[i], b = inner[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let u = acc === 0 ? 300 : panel - acc;
      while (u < len) {
        const x = a[0] + ((b[0] - a[0]) * u) / len, y = a[1] + ((b[1] - a[1]) * u) / len;
        members.push([[x - 50, y - 120], [x + 50, y - 120], [x + 50, y - 20], [x - 50, y - 20]]);
        u += panel;
      }
      acc = len - (u - panel);
    }
    return {
      chordInner: inner,
      chordOuter: inner.map(([x, y]) => [x, y - chordDepth]),
      members,
      shaftUp: { c: PATH.S_up, r: 95 },
      shaftLow: { c: PATH.S_low, r: 80 },
      xEndLow,
      xEndUp,
    };
  })();

  // ----- drive train and handrail -----
  const DRIVE = (() => {
    const omega = P.speed / Rs; // rad/s of the main drive shaft
    const shaftRpm = (omega * 60) / (2 * Math.PI);
    const motorRpm = 1450;
    const zOut = 19, zMain = 47; // duplex drive chain: gearbox output -> main shaft
    const gearRatio = motorRpm / (shaftRpm * (zMain / zOut));
    // handrail: main-shaft sprocket zH1 drives the newel sheave sprocket zH2
    const zH1 = 43, zH2 = 38;
    const wheelR = (Rs * zH2) / zH1; // sheave radius that makes the handrail match the steps
    const handrailSpeed = omega * (zH1 / zH2) * wheelR;
    return { omega, shaftRpm, motorRpm, zOut, zMain, gearRatio, zH1, zH2, wheelR, handrailSpeed };
  })();

  // Time on the steps from comb to comb, along the chain path.
  const rideLength = (() => {
    // the followed step is "on the walkway" from when its nose clears the lower comb
    // to when its nose reaches the upper comb
    const sLow = LAND.combLow - STEP.f; // x of the axle; the lower flat starts at x = 0, s = 0
    const sUp = PATH.by["upper landing"].s0 + (LAND.combUp - STEP.f - PATH.xE);
    return sUp - sLow;
  })();

  return {
    P, STEP, PATH, Rs, D, RISER_R, SCHED, LAND, STRUCT, DRIVE, STEP_OUTLINE,
    chainPoint, chainTangent, segmentAt, orientation, stepPose, trailerPoint, stepPositions,
    sampleLocus, offsetRun, rails,
    stepRise: stepRise(P), stepGoing: stepGoing(P), rideLength, rideTime: rideLength / P.speed,
    // pure helpers, so one object carries everything a caller needs
    toWorld, placePolygon, convexGap, circlePolyGap, pointPolylineDist, pointInPolygon, arcPts, rot,
  };
}

export const MODELS = Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, makeModel({ incline: v.incline, rise: v.rise })]));

// The standard escalator, as named exports.
export const DEFAULT = MODELS.standard;
export const { P, STEP, PATH, Rs, D, RISER_R, SCHED, LAND, STRUCT, DRIVE, STEP_OUTLINE, chainPoint, chainTangent, segmentAt, orientation, stepPose, trailerPoint, stepPositions, sampleLocus, offsetRun, rails } = DEFAULT;
