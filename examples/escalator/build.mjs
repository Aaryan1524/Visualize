// node examples/escalator/build.mjs  ->  dist/escalator.html (or --out <file>).
// No dependencies. The page runs the same model.mjs the tests run (inlined below).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS, VARIANTS, arcPts as modelArcPts } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");

// ---------------------------------------------------------------- helpers
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const pt = (p) => `${f1(p[0])},${f1(-p[1])}`; // world (y up) -> svg (y down)
const poly = (pts, close = true) => "M" + pts.map(pt).join("L") + (close ? "Z" : "");
const line = (a, b) => `M${pt(a)}L${pt(b)}`;
const circ = (c, r) => `M${f1(c[0] - r)},${f1(-c[1])}a${f1(r)},${f1(r)} 0 1,0 ${f1(2 * r)},0a${f1(r)},${f1(r)} 0 1,0 ${f1(-2 * r)},0Z`;
const arcPts = (c, r, a0, a1, n = 48) => modelArcPts(c, r, a0, a1, n);
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// 45-degree section hatching for any simple polygon (even-odd), as explicit segments.
function hatch(polygon, spacing = 70, angle = 45) {
  const a = (angle * Math.PI) / 180;
  const ca = Math.cos(-a), sa = Math.sin(-a);
  const r = polygon.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
  const ys = r.map((p) => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const out = [];
  const start = Math.ceil(lo / spacing) * spacing;
  for (let y = start; y <= hi; y += spacing) {
    const xs = [];
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length];
      if ((p[1] > y) !== (q[1] > y)) xs.push(p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
    }
    xs.sort((u, v) => u - v);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const back = ([x, yy]) => [x * Math.cos(a) - yy * Math.sin(a), x * Math.sin(a) + yy * Math.cos(a)];
      out.push(line(back([xs[i], y]), back([xs[i + 1], y])));
    }
  }
  return out.join("");
}

// Clip a convex polygon by the half-plane n.x <= d (Sutherland-Hodgman).
function clipHalf(polygon, n, d) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = n[0] * p[0] + n[1] * p[1] - d, dq = n[0] * q[0] + n[1] * q[1] - d;
    if (dp <= 0) out.push(p);
    if (dp * dq < 0) {
      const u = dp / (dp - dq);
      out.push([p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])]);
    }
  }
  return out;
}
// Inset a convex counter-clockwise polygon by d.
function inset(polygon, d) {
  let out = polygon;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const m = Math.hypot(ex, ey);
    if (m < 1e-6) continue;
    const n = [ey / m, -ex / m]; // outward normal for CCW
    out = clipHalf(out, n, n[0] * p[0] + n[1] * p[1] - d);
  }
  return out;
}
const offsetPolyline = (pts, d) =>
  pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1];
    const m = Math.hypot(tx, ty) || 1;
    return [p[0] + (ty / m) * d, p[1] - (tx / m) * d];
  });

// ---------------------------------------------------------------- frame of the drawing (mm), shared by every variant
const VB = { x0: -2450, x1: 11750, y0: -1700, y1: 4850 };
const viewBox = `${VB.x0} ${-VB.y1} ${VB.x1 - VB.x0} ${VB.y1 - VB.y0}`;
const FS = 150; // label font size in mm (about 12 px in the 1440 x 900 stage)

// Everything drawn for one escalator. Called once per variant; the page swaps between them.
function makeDrawing(M) {
const { P, STEP, PATH, LAND, STRUCT, DRIVE, Rs } = M;

// ---------------------------------------------------------------- the step symbol (local frame)
const { t, f, rc, rt } = STEP;
const RR = M.RISER_R;
const hull = M.STEP_OUTLINE;
const treadBot = t - STEP.tread;
function stepSymbol() {
  const parts = [];
  parts.push(`<path class="st-body" d="${poly(hull)}"/>`);
  // tread plate underside, from riser to nose
  const yb = treadBot;
  const xr = f - Math.sqrt(RR * RR - (t - yb) ** 2);
  parts.push(`<path class="st-line" d="${line([xr, yb], [f, yb])}"/>`);
  // cleat root line on the tread and on the riser
  const yc = t - STEP.cleat;
  const xrc = f - Math.sqrt(RR * RR - (t - yc) ** 2);
  let cleats = line([xrc, yc], [f, yc]);
  for (let x = xrc + 10; x < f - 4; x += 17) cleats += line([x, yc], [x, t]);
  const riserIn = arcPts([f, t], RR - STEP.cleat, 181, STEP.riserTo - 1, 20);
  cleats += "M" + riserIn.map(pt).join("L");
  for (let a = 183; a < STEP.riserTo - 1; a += 2.6) {
    const r0 = M.arcPts([f, t], RR - STEP.cleat, a, a, 1)[0], r1 = M.arcPts([f, t], RR, a, a, 1)[0];
    cleats += line(r0, r1);
  }
  parts.push(`<path class="st-fine fine" d="${cleats}"/>`);
  // side web: inset frame split by a diagonal rib from the axle boss to the upper back
  const web = clipHalf(inset(hull, 34), [0, 1], yb - 22);
  const ribA = [-6, 30], ribB = [-300, yb - 22];
  const rn = [ribB[1] - ribA[1], -(ribB[0] - ribA[0])];
  const rm = Math.hypot(rn[0], rn[1]);
  const n = [rn[0] / rm, rn[1] / rm];
  const dmid = n[0] * ribA[0] + n[1] * ribA[1];
  const w1 = clipHalf(web, n, dmid - 22);
  const w2 = clipHalf(web, [-n[0], -n[1]], -(dmid + 22));
  for (const w of [w1, w2]) if (w.length > 2) parts.push(`<path class="st-web" d="${poly(w)}"/>`);
  // axle bosses
  parts.push(`<path class="st-line fine" d="${circ([0, 0], STEP.hubC)}${circ(STEP.T, STEP.hubT)}"/>`);
  return parts.join("");
}
function wheelSymbol(r, hub) {
  return `<circle class="wh-rim" r="${r}"/><circle class="wh-tyre" r="${r - 9}"/><circle class="wh-hub" r="${hub}"/><path class="wh-mark" d="M0,${-hub}V${-(r - 9)}"/>`;
}

// ---------------------------------------------------------------- profiles
const sUp0 = PATH.by["upper turn"].s0;
const passenger = [];
for (let s = 0; s <= sUp0; s += 20) passenger.push(M.chainPoint(s));
// the step-nose line, extended flat past both landings
function profile(dy, xa = VB.x0, xb = VB.x1) {
  const pts = passenger.map(([x, y]) => [x + f, y + t + dy]);
  const out = [[xa, pts[0][1]], ...pts.filter((p) => p[0] > xa && p[0] < xb), [xb, pts[pts.length - 1][1]]];
  return out;
}
function yOn(polyline, x) {
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i], b = polyline[i + 1];
    if (x >= a[0] && x <= b[0]) return a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0] || 1);
  }
  return x < polyline[0][0] ? polyline[0][1] : polyline[polyline.length - 1][1];
}
const nose = profile(0);
const xS = PATH.S_up[0], yS = PATH.S_up[1];

// ---------------------------------------------------------------- building: slabs and pits (cut)
const BLD = (() => {
  const ffl0 = LAND.fflLow, ffl1 = LAND.fflUp, th = 250;
  const k = Math.tan(PATH.th);
  const knee = STRUCT.chordInner[1][0];
  const bedTop = (x) => -1300 + (x - knee) * k;
  const xBedTop = knee + (ffl0 + 1300) / k;
  const xBedBot = knee + (ffl0 - th + 1589) / k;
  const xFlatBot = knee + (-1550 + 1589) / k;
  const lower = [[VB.x0, ffl0], [-1250, ffl0], [-1250, -1300], [knee, -1300], [xBedTop, ffl0], [VB.x1, ffl0], [VB.x1, ffl0 - th], [xBedBot, ffl0 - th], [xFlatBot, -1550], [-1500, -1550], [-1500, ffl0 - th], [VB.x0, ffl0 - th]];
  const pitWall = xS + 2050;
  const xSlab = VB.x1 - 640; // the upper slab stops short: the rise is dimensioned beyond it
  const upper = [[xS - 1360, 1380], [pitWall, 1380], [pitWall, ffl1], [xSlab, ffl1], [xSlab, ffl1 - th], [pitWall + th, ffl1 - th], [pitWall + th, 1130], [xS - 1360, 1130]];
  return { lower, upper, bedTop, xBedTop, pitWall, ffl0, ffl1, th, xSlab };
})();

function breakLine(x, y0, y1) {
  // zig-zag break symbol across a cut slab end
  const m = (y0 + y1) / 2, a = 70;
  return `M${pt([x, y0 + 40])}L${pt([x, m + a])}L${pt([x - 60, m + 20])}L${pt([x + 60, m - 20])}L${pt([x, m - a])}L${pt([x, y1 - 40])}`;
}

// ---------------------------------------------------------------- truss (far side, in elevation)
const TRUSS = (() => {
  const top = profile(0, STRUCT.xEndLow, STRUCT.xEndUp);
  const topIn = top.map(([x, y]) => [x, y - 110]);
  const chordIn = STRUCT.chordInner, chordOut = STRUCT.chordOuter;
  const chordY = (x) => yOn(chordIn, x);
  const xs = [];
  for (let x = STRUCT.xEndLow + 40; x <= STRUCT.xEndUp - 40; x += 980) xs.push(x);
  xs.push(STRUCT.xEndUp - 40);
  let web = "";
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    web += line([x, chordY(x)], [x, yOn(topIn, x)]);
    if (i + 1 < xs.length) {
      const x2 = xs[i + 1];
      web += i % 2 ? line([x, chordY(x)], [x2, yOn(topIn, x2)]) : line([x, yOn(topIn, x)], [x2, chordY(x2)]);
    }
  }
  const topBand = [...top, ...topIn.slice().reverse()];
  const botBand = [...chordIn, ...chordOut.slice().reverse()];
  return { topBand, botBand, web };
})();

// ---------------------------------------------------------------- rails and chain band
const RAILS = M.rails();
const pl = (pts) => "M" + pts.map(pt).join("L");
const chainLoop = M.sampleLocus((s) => M.chainPoint(s), 12);
const chainBand = (() => {
  const n = chainLoop.length;
  const off = (d) =>
    chainLoop.map((p, i) => {
      const a = chainLoop[(i - 1 + n) % n], b = chainLoop[(i + 1) % n];
      const tx = b[0] - a[0], ty = b[1] - a[1];
      const m = Math.hypot(tx, ty);
      return [p[0] + (ty / m) * d, p[1] - (tx / m) * d];
    });
  return pl(off(17)) + "Z" + pl(off(-17)) + "Z";
})();

// ---------------------------------------------------------------- sprocket symbol (centred, svg frame)
function sprocketSymbol() {
  const N = P.teeth, seat = 17, tip = Rs + 34, root = Rs - seat;
  const pts = [];
  for (let k = 0; k < N; k++) {
    const a0 = (k * 2 * Math.PI) / N;
    const half = Math.PI / N;
    const sa = Math.asin(seat / Rs);
    // seat (a circular pocket at the pitch point), then a straight flank to the tip
    for (let i = 0; i <= 8; i++) {
      const u = -Math.PI / 2 + (Math.PI * i) / 8;
      const c = [Rs * Math.cos(a0), Rs * Math.sin(a0)];
      const dir = a0 + Math.PI + u; // pocket opens outward
      pts.push([c[0] + seat * Math.cos(dir), c[1] + seat * Math.sin(dir)]);
    }
    void sa;
    pts.push([tip * Math.cos(a0 + half * 0.72), tip * Math.sin(a0 + half * 0.72)]);
    pts.push([tip * Math.cos(a0 + half * 1.28), tip * Math.sin(a0 + half * 1.28)]);
  }
  // pocket points were generated clockwise per tooth; order them by angle
  const ordered = pts.map((p) => [p, Math.atan2(p[1], p[0])]).sort((a, b) => a[1] - b[1]).map((q) => q[0]);
  void root;
  let d = "M" + ordered.map(([x, y]) => `${f1(x)},${f1(y)}`).join("L") + "Z";
  let holes = "";
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    holes += circ([205 * Math.cos(a), -205 * Math.sin(a)], 52);
  }
  return `<path class="sp-outline" d="${d}"/><path class="sp-line" d="${holes}${circ([0, 0], 135)}"/>` +
    `<path class="sp-line" d="${circ([0, 0], Rs)}" stroke-dasharray="none" style="stroke-dasharray:10 6 2 6;opacity:.7"/>`;
}

// ---------------------------------------------------------------- drive unit (upper pit)
const DRV = (() => {
  const G = [xS + 1000, 2500];
  const rOut = 38.1 / (2 * Math.sin(Math.PI / DRIVE.zOut));
  const rMain = 38.1 / (2 * Math.sin(Math.PI / DRIVE.zMain));
  // external tangents of two circles
  const tangents = (c1, r1, c2, r2) => {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx), a = Math.acos((r1 - r2) / d);
    return [1, -1].map((sg) => {
      const n = base + sg * a;
      return [[c1[0] + r1 * Math.cos(n), c1[1] + r1 * Math.sin(n)], [c2[0] + r2 * Math.cos(n), c2[1] + r2 * Math.sin(n)]];
    });
  };
  const chain = tangents(PATH.S_up, rMain, G, rOut);
  const yW = G[1] + 180; // worm axis
  const box = [[G[0] - 240, G[1] - 260], [G[0] + 270, G[1] - 260], [G[0] + 270, G[1] + 330], [G[0] - 240, G[1] + 330]];
  const motor = [[G[0] + 330, yW - 190], [G[0] + 860, yW - 190], [G[0] + 860, yW + 190], [G[0] + 330, yW + 190]];
  const fan = [[G[0] + 860, yW - 165], [G[0] + 950, yW - 150], [G[0] + 950, yW + 150], [G[0] + 860, yW + 165]];
  const brake = [[G[0] + 270, yW - 140], [G[0] + 330, yW - 140], [G[0] + 330, yW + 140], [G[0] + 270, yW + 140]];
  const tbox = [[G[0] + 520, yW + 190], [G[0] + 680, yW + 190], [G[0] + 680, yW + 270], [G[0] + 520, yW + 270]];
  let fins = "";
  for (let x = G[0] + 370; x < G[0] + 840; x += 34) fins += line([x, yW - 190], [x, yW - 150]) + line([x, yW + 150], [x, yW + 190]);
  // bedframe: two channel legs, a top beam and a brace, standing on the truss bottom chord
  const yb = G[1] - 260, xl = G[0] - 200, xr = G[0] + 860;
  const frame = [[xl, 1560], [xl + 90, 1560], [xl + 90, yb - 110], [xr - 90, yb - 110], [xr - 90, 1560], [xr, 1560], [xr, yb], [xl, yb]];
  const frameWeb = line([xl + 90, 1600], [xr - 90, yb - 150]) + line([xl + 90, 1640], [xr - 130, yb - 110]) + line([xl + 40, 1560], [xl + 40, yb - 110]) + line([xr - 40, 1560], [xr - 40, yb - 110]);
  return { G, rOut, rMain, chain, box, motor, fan, brake, tbox, fins, frame, frameWeb, yW };
})();

// ---------------------------------------------------------------- handrail and balustrade
const HR = (() => {
  const hrY = 980, rN = DRIVE.wheelR, band = 22; // sheave radius set by the drive ratio
  const xnU = LAND.combUp + 650, xnL = LAND.combLow - 650;
  const Cu = [xnU, P.rise + t + hrY - rN], Cl = [xnL, t + hrY - rN];
  const top = profile(hrY, xnL, xnU);
  const loop = [...top, ...arcPts(Cu, rN, 90, -90, 40).slice(1), ...top.map(([x, y]) => [x, y - 2 * rN]).reverse().slice(1), ...arcPts(Cl, rN, -90, -270, 40).slice(1, -1)];
  // arc-length table
  const cum = [0];
  for (let i = 1; i <= loop.length; i++) {
    const a = loop[i - 1], b = loop[i % loop.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const n = loop.length;
  const off = (d) =>
    loop.map((p, i) => {
      const a = loop[(i - 1 + n) % n], b = loop[(i + 1) % n];
      const tx = b[0] - a[0], ty = b[1] - a[1];
      const m = Math.hypot(tx, ty);
      return [p[0] + (ty / m) * d, p[1] - (tx / m) * d];
    });
  const outer = off(-band), inner = off(band);
  // balustrade panel: under the handrail, down to the deck, round the newels to the floor
  const topEdge = profile(hrY - band - 18, xnL, xnU);
  const panel =
    pl([...arcPts(Cl, rN + 40, 180, 90, 20), ...topEdge, ...arcPts(Cu, rN + 40, 90, 0, 20)]) +
    line([Cu[0] + rN + 40, Cu[1]], [Cu[0] + rN + 40, LAND.fflUp]) +
    line([Cl[0] - rN - 40, Cl[1]], [Cl[0] - rN - 40, LAND.fflLow]) +
    pl(profile(150, xnL - rN - 40, xnU + rN + 40));
  return { hrY, rN, band, xnU, xnL, Cu, Cl, loop, cum, outer, inner, panel, length: cum[cum.length - 1] };
})();
// handrail drive chain: main shaft sprocket (hidden behind the step sprocket) to the newel sheave sprocket
const HRD = (() => {
  const r1 = 25.4 / (2 * Math.sin(Math.PI / DRIVE.zH1)), r2 = 25.4 / (2 * Math.sin(Math.PI / DRIVE.zH2));
  const c1 = PATH.S_up, c2 = HR.Cu;
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx), a = Math.acos((r1 - r2) / d);
  const tl = [1, -1].map((sg) => {
    const n = base + sg * a;
    return [[c1[0] + r1 * Math.cos(n), c1[1] + r1 * Math.sin(n)], [c2[0] + r2 * Math.cos(n), c2[1] + r2 * Math.sin(n)]];
  });
  return { r1, r2, tl };
})();

// ---------------------------------------------------------------- detail A
const DET = (() => {
  const k = 2.6, R = 1380;
  const sIn = PATH.by.incline.s0 + 1560;
  const c0 = M.chainPoint(sIn);
  const src = [c0[0] + 20, c0[1] + 225];
  const at = [2100, 3440];
  return { k, R, r: R / k, src, at, sIn };
})();
const toA = (p) => [DET.at[0] + DET.k * (p[0] - DET.src[0]), DET.at[1] + DET.k * (p[1] - DET.src[1])];

// ---------------------------------------------------------------- labels (world mm), per beat
const retInc = PATH.by["return, incline"];
const retAt = (x) => {
  // point on the return incline chain line at a given x
  const a = M.chainPoint(retInc.s0), b = M.chainPoint(retInc.s0 + retInc.len);
  const u = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + u * (b[1] - a[1])];
};
const passRailAt = (rail, x) => [x, yOn(rail, x)];
const RC = xS + 1320; // right column, above the upper floor
const LABELS = [
  // beat 1: the loop
  { id: "dchain", text: "Drive chain", at: [RC, 4600], to: DRV.chain[0][0].map((v, i) => (v + DRV.chain[0][1][i]) / 2), beats: [1] },
  { id: "gear", text: "Gearbox", at: [RC, 4370], to: [DRV.G[0] + 120, DRV.G[1] + 330], beats: [1] },
  { id: "motor", text: "Drive motor", at: [RC, 4140], to: [DRV.G[0] + 820, DRV.yW + 150], beats: [1, 5] },
  { id: "chain", text: "Step chain", at: [xS - 2060, 560], to: null, beats: [1] },
  { id: "dsprocket", text: "Drive sprocket", at: [xS - 1160, 900], to: [xS - Rs * 0.5, yS - Rs * 0.87], beats: [1], anchor: "end" },
  { id: "truss", text: "Truss", at: [-2380, -1250], to: null, beats: [1] },
  { id: "tsprocket", text: "Tension sprocket", at: [-2380, -760], to: [-Rs * 0.7, -Rs - Rs * 0.72], beats: [1, 4] },
  // beat 3: the landing
  { id: "converge", text: "Tracks converge", at: [xS - 1660, 4700], to: null, beats: [3], anchor: "end" },

  // beat 4: turn and return

  { id: "inverted", text: "Return run, steps upside down", at: [xS - 2060, 560], to: null, beats: [4] },
  // beat 5: the handrail
  { id: "balustrade", text: "Balustrade", at: [4300, 4560], to: null, beats: [5], anchor: "end" },
  { id: "handrail", text: "Handrail", at: [4300, 4250], to: null, beats: [5], anchor: "end" },
  { id: "sheave", text: "Handrail sheave", at: [RC, 4600], to: [HR.Cu[0] + HR.rN * 0.72, HR.Cu[1] + HR.rN * 0.66], beats: [5] },
  { id: "hrchain", text: "Handrail drive chain", at: [RC, 4370], to: null, beats: [5] },
];
function D() {
  return M.D;
}
// targets that need the rails or other derived geometry
{
  const L = Object.fromEntries(LABELS.map((l) => [l.id, l]));
  // trailer guide round the lower sprocket, leftmost point
  const lowOut = RAILS.trailer.lowOut;
  const left = lowOut.reduce((m, p) => (p[0] < m[0] ? p : m), lowOut[0]);
  void left;
  L.chain.to = (() => { const q = retAt(5600); return [q[0], q[1] - 17]; })();
  L.truss.to = [-700, STRUCT.chordOuter[0][1]];
  const upOut = RAILS.trailer.upOut;
  void upOut;
  // convergence: the trailer rail in the upper transition
  const tp = RAILS.trailer.pass;
  L.converge.to = passRailAt(tp, xS - 1430);
  // an inverted step on the return incline: its tread underside
  const sRet = retInc.s0 + 2400;
  const pose = M.stepPose(sRet);
  L.inverted.to = M.toWorld(pose, [-150, t - 4]);
  L.handrail.to = [4450, yOn(HR.outer.filter((p, i) => i < HR.loop.length / 2), 4450) - 2];
  L.balustrade.to = [4900, yOn(profile(640), 4900)];
  const [a, b] = HRD.tl[0];
  L.hrchain.to = [a[0] + 0.62 * (b[0] - a[0]), a[1] + 0.62 * (b[1] - a[1])];
}

// ---------------------------------------------------------------- the SVG
// Leaders are drawn in the page, from the measured text box to the dot on the part.
function labelSvg(l) {
  const [x, y] = l.at;
  return `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-to="${f1(l.to[0])},${f1(-l.to[1])}"><path class="leader"/><circle class="ldot" cx="${f1(l.to[0])}" cy="${f1(-l.to[1])}" r="24"/><text x="${f1(x)}" y="${f1(-y)}" text-anchor="${l.anchor || "start"}">${esc(l.text)}</text></g>`;
}
function arrow(at, dir) {
  // small filled arrowhead, tip at `at`, pointing along unit `dir`
  const L = 95, W = 26;
  const b = [at[0] - dir[0] * L, at[1] - dir[1] * L];
  const n = [-dir[1], dir[0]];
  return `M${pt(at)}L${pt([b[0] + n[0] * W, b[1] + n[1] * W])}L${pt([b[0] - n[0] * W, b[1] - n[1] * W])}Z`;
}
function dims() {
  let s = "";
  // rise, at the right edge: from the lower floor up to the upper floor level, carried out past the slab end
  const xd = VB.x1 - 300;
  const y0 = LAND.fflLow, y1 = LAND.fflUp;
  s += `<path class="dim" d="${line([xd, y0 + 4], [xd, y1 - 4])}${line([BLD.xSlab + 50, y1], [xd + 160, y1])}"/>`;
  s += `<path class="dimhead" d="${arrow([xd, y1], [0, 1])}${arrow([xd, y0], [0, -1])}"/>`;
  s += `<text class="dimtext" transform="translate(${f1(xd - 60)},${f1(-(y0 + y1) / 2)}) rotate(-90)" text-anchor="middle">${P.rise} rise</text>`;
  // level marks
  const level = (x, y, txt, anchor = "start") =>
    `<path class="dim" d="M${pt([x - 55, y + 95])}L${pt([x + 55, y + 95])}L${pt([x, y])}Z"/>` +
    `<text class="lvltext" x="${f1(x + (anchor === "start" ? 110 : -110))}" y="${f1(-(y + 40))}" text-anchor="${anchor}">${txt}</text>`;
  s += level(-1700, y0, "±0 lower floor");
  s += `<text class="lvltext" x="${f1(BLD.xSlab + 60)}" y="${f1(-(y1 + 50))}">+${P.rise}</text>`;
  // 30 degrees, at the upper knee of the handrail, in open air above the balustrade
  const th = PATH.th;
  const yu = HR.Cu[1] + HR.rN; // upper handrail flat (centre line)
  const pe = M.chainPoint(PATH.by.incline.s0 + PATH.by.incline.len);
  const pInc = [pe[0] + f, pe[1] + t + HR.hrY];
  const K = [pInc[0] + (yu - pInc[1]) / Math.tan(th), yu];
  const R = 900, E = R + 260;
  s += `<path class="dim" d="${line([K[0] - 40, yu], [K[0] - E, yu])}"/>`;
  const arc = arcPts(K, R, 180, 210, 30).map(([x, y]) => [x, y]);
  s += `<path class="dim" d="M${arc.map(pt).join("L")}"/>`;
  s += `<path class="dimhead" d="${arrow(arc[0], [0, 1])}${arrow(arc[30], [Math.sin(th), -Math.cos(th)])}"/>`;
  const tp = [K[0] - (R + 170) * Math.cos(th / 2), K[1] - (R + 170) * Math.sin(th / 2)];
  s += `<text class="dimtext" x="${f1(tp[0])}" y="${f1(-tp[1] + 45)}" text-anchor="end">${P.incline}°</text>`;
  return s;
}
function titleBlock() {
  const x0 = 6750, x1 = VB.x1 - 60, y1 = -170, y0 = -1640;
  let s = `<g class="tblock"><path class="tb-frame" d="${poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])}"/>`;
  s += `<path class="tb-rule" d="${line([x0, y1 - 400], [x1, y1 - 400])}${line([x0, y1 - 1080], [x1, y1 - 1080])}"/>`;
  s += `<text class="tb-title" x="${x0 + 110}" y="${-(y1 - 260)}">ESCALATOR · SIDE ELEVATION, CUTAWAY</text>`;
  s += `<text class="tb-small" x="${x1 - 110}" y="${-(y1 - 260)}" text-anchor="end">dimensions in mm</text>`;
  const facts = [
    `Rise ${P.rise} · incline ${P.incline}° · step pitch ${P.pitch} · step rise ${P.pitch} sin ${P.incline}° = ${M.stepRise.toFixed(1).replace(/\.0$/, "")} · going ${M.stepGoing.toFixed(1)}`,
    `${PATH.N} steps · step width 1000 (not drawn) · steps and handrail at 0.5 m/s`,
    `Sprockets ${P.teeth} T, pitch Ø ${(2 * Rs).toFixed(0)} · main shaft ${DRIVE.shaftRpm.toFixed(2)} rpm · near-side truss removed`,
  ];
  facts.forEach((txt, i) => (s += `<text class="tb-text" x="${x0 + 110}" y="${-(y1 - 600 - i * 200)}">${esc(txt)}</text>`));
  const key = [["k-blue", "Chain and chain-wheel track"], ["k-teal", "Trailer-wheel track"], ["k-orange", "Followed step"]];
  s += `<g id="tbkey" data-x0="${x0 + 110}" data-x1="${x1 - 110}">`;
  for (const [cls, txt] of key) s += `<g class="tbk"><path class="${cls}" d="M0,${-(y1 - 1290)}h240"/><text class="tb-text tb-key" x="0" y="${-(y1 - 1330)}">${txt}</text></g>`;
  return s + "</g></g>";
}

// Tension carriage: the lower shaft rides in a slide, held back by a compression spring.
function tensionCarriage() {
  const y = -Rs, x0 = -Rs - 450, x1 = -1180;
  let d = poly([[x0 + 70, y - 70], [x0 - 10, y - 70], [x0 - 10, y + 70], [x0 + 70, y + 70]]); // spring seat on the slide
  d += line([x0 + 70, y], [-110, y]); // pull rod to the bearing block
  d += poly([[-110, y - 60], [110, y - 60], [110, y + 60], [-110, y + 60]]).replace("Z", "Z");
  const n = 9, w = (x0 - 10 - (x1 + 60)) / n;
  let z = `M${pt([x0 - 10, y])}`;
  for (let i = 0; i < n; i++) z += `L${pt([x0 - 10 - w * (i + 0.5), y + (i % 2 ? -60 : 60)])}`;
  z += `L${pt([x1 + 60, y])}`;
  d += z + poly([[x1 + 60, y - 95], [x1, y - 95], [x1, y + 95], [x1 + 60, y + 95]]);
  return d;
}

function scene() {
  const S = [];
  S.push(`<g class="part" data-part="truss"><path class="tr-chord" d="${poly(TRUSS.topBand)}${poly(TRUSS.botBand)}"/><path class="tr-web" d="${TRUSS.web}"/></g>`);
  S.push(`<g class="part" data-part="balustrade"><path class="bal" d="${HR.panel}"/></g>`);
  S.push(`<g class="part" data-part="hrdrive"><path class="hidden" d="${circ(PATH.S_up, HRD.r1)}"/><path class="drv-chain" d="${line(...HRD.tl[0])}${line(...HRD.tl[1])}"/><path class="drv-line" d="${circ(HR.Cu, HRD.r2)}"/></g>`);
  S.push(`<g class="part" data-part="steps" id="steps"></g>`);
  S.push(`<g class="part" data-part="sprockets">` +
    `<g id="spUp" transform="translate(${f1(xS)},${f1(-yS)})"><g class="rot"><use href="#sprocket"/></g><path class="shaft" d="${circ([0, 0], STRUCT.shaftUp.r)}"/><path class="hatch" d="${hatch(arcPts([0, 0], STRUCT.shaftUp.r, 0, 360, 36), 28)}"/></g>` +
    `<g id="spLow" transform="translate(${f1(PATH.S_low[0])},${f1(-PATH.S_low[1])})"><g class="rot"><use href="#sprocket"/></g><path class="shaft" d="${circ([0, 0], STRUCT.shaftLow.r)}"/><path class="hatch" d="${hatch(arcPts([0, 0], STRUCT.shaftLow.r, 0, 360, 36), 28)}"/></g>` +
    `<path class="hidden" d="${circ(PATH.S_up, DRV.rMain)}"/>` +
    `<path class="tension" d="${tensionCarriage()}"/>` +
    `</g>`);
  S.push(`<g class="part" data-part="chaintrack"><path class="rail-blue" d="${pl(RAILS.chain.pass)}${pl(RAILS.chain.ret)}"/></g>`);
  const tr = RAILS.trailer;
  S.push(`<g class="part" data-part="trailertrack"><path class="rail-teal" d="${pl(tr.pass)}${pl(tr.ret)}${pl(tr.upIn)}${pl(tr.upOut)}${pl(tr.lowIn)}${pl(tr.lowOut)}"/></g>`);
  S.push(`<g class="part" data-part="chain"><path class="chain-band" d="${chainBand}"/><g id="pins"></g></g>`);
  S.push(`<g class="part" data-part="twheels" id="wheelsT"></g><g class="part" data-part="cwheels" id="wheelsC"></g>`);
  S.push(`<g class="part" data-part="handrail"><path class="hr-band" d="${poly(HR.outer)}${poly(HR.inner)}" fill-rule="evenodd"/><g id="hrticks"></g></g>` +
    `<g class="part" data-part="sheaves"><g id="sheaveU" transform="translate(${f1(HR.Cu[0])},${f1(-HR.Cu[1])})"><g class="rot"><use href="#sheave"/></g></g>` +
    `<g id="sheaveL" transform="translate(${f1(HR.Cl[0])},${f1(-HR.Cl[1])})"><g class="rot"><use href="#sheave"/></g></g></g>`);
  S.push(`<g class="part" data-part="drive"><path class="drv-frame" d="${poly(DRV.frame)}${DRV.frameWeb}"/>` +
    `<path class="drv-body" d="${poly(DRV.box)}${poly(DRV.motor)}${poly(DRV.fan)}${poly(DRV.brake)}${poly(DRV.tbox)}"/>` +
    `<path class="drv-line" d="${DRV.fins}${line([DRV.G[0] - 240, DRV.G[1] + 180 - 40], [DRV.G[0] + 270, DRV.G[1] + 180 - 40])}${circ(DRV.G, DRV.rOut)}${circ(DRV.G, 40)}"/>` +
    `<path class="drv-chain" d="${line(...DRV.chain[0])}${line(...DRV.chain[1])}"/>` +
    `<path class="centre" d="${line([DRV.G[0] + 230, DRV.yW], [DRV.G[0] + 1010, DRV.yW])}"/></g>`);
  const teeth = (x, y, dir) => line([x, y + 3], [x + dir * 60, y - 7]);
  S.push(`<g class="part" data-part="landing"><path class="solid" d="${poly(LAND.plateUp)}${poly(LAND.plateLow)}${poly(LAND.combPlateUp)}${poly(LAND.combPlateLow)}"/>` +
    `<path class="st-line" d="${teeth(LAND.combUp, LAND.treadUp, -1)}${teeth(LAND.combLow, LAND.treadLow, 1)}"/></g>`);
  S.push(`<g class="part" data-part="building"><path class="slab" d="${poly(BLD.lower)}${poly(BLD.upper)}"/>` +
    `<path class="hatch" d="${hatch(BLD.lower, 70)}${hatch(BLD.upper, 70)}"/>` +
    `<path class="brk" d="${breakLine(VB.x0 + 2, BLD.ffl0 - BLD.th, BLD.ffl0)}${breakLine(VB.x1 - 2, BLD.ffl0 - BLD.th, BLD.ffl0)}${breakLine(BLD.xSlab - 2, BLD.ffl1 - BLD.th, BLD.ffl1)}"/></g>`);
  S.push(`<g class="part" data-part="truss"><path class="slab" d="${STRUCT.members.map((m) => poly(m)).join("")}"/><path class="hatch" d="${STRUCT.members.map((m) => hatch(m, 30)).join("")}"/></g>`);
  return S.join("\n");
}

function defs() {
  return `<defs>
<symbol id="stepSym" overflow="visible">${stepSymbol()}</symbol>
<symbol id="wheelC" overflow="visible">${wheelSymbol(rc, 13)}</symbol>
<symbol id="wheelT" overflow="visible">${wheelSymbol(rt, 10)}</symbol>
<symbol id="sprocket" overflow="visible">${sprocketSymbol()}</symbol>
<symbol id="sheave" overflow="visible"><circle class="sh-rim" r="${HR.rN - HR.band}"/><circle class="sh-line" r="${HR.rN - 70}"/><circle class="sh-line" r="70"/>${[0, 60, 120].map((a) => `<path class="sh-line" d="M${f1(70 * Math.cos((a * Math.PI) / 180))},${f1(70 * Math.sin((a * Math.PI) / 180))}L${f1((HR.rN - 70) * Math.cos((a * Math.PI) / 180))},${f1((HR.rN - 70) * Math.sin((a * Math.PI) / 180))}M${f1(-70 * Math.cos((a * Math.PI) / 180))},${f1(-70 * Math.sin((a * Math.PI) / 180))}L${f1(-(HR.rN - 70) * Math.cos((a * Math.PI) / 180))},${f1(-(HR.rN - 70) * Math.sin((a * Math.PI) / 180))}"/>`).join("")}</symbol>
<clipPath id="clipA"><circle cx="${f1(DET.at[0])}" cy="${f1(-DET.at[1])}" r="${DET.R}"/></clipPath>
</defs>`;
}

// Three magnified views share one inset slot: A (a step on the incline, beat 2), B (the comb
// and the upper landing, beat 3), C (the upper turnaround, beat 4). Each is a live <use> of the
// scene, so it can never disagree with the main view.
const DETAILS = [
  { id: "A", src: DET.src, k: DET.k, full: [2], dim: [1, 5], leader: true },
  { id: "B", src: [LAND.combUp - 120, LAND.treadUp - 90], k: 2.6, full: [3], dim: [], leader: false, title: "upper landing" },
  { id: "C", src: [xS + 130, yS + 10], k: 1.6, full: [4], dim: [], leader: false, title: "upper turnaround" },
];
// label slots beside the inset: two on the right (r1 above r2), two on the left (l1 above l2)
const SLOT = { r1: [DET.at[0] + DET.R + 230, 4520], r2: [DET.at[0] + DET.R + 230, 4220], l1: [DET.at[0] - DET.R - 230, 2720], l2: [DET.at[0] - DET.R - 230, 2400] };
const toD = (d, p) => [DET.at[0] + d.k * (p[0] - d.src[0]), DET.at[1] + d.k * (p[1] - d.src[1])];
function detailGroup(d) {
  const { at, R } = DET;
  const { src, k } = d;
  const r = R / k;
  let lead = "";
  if (d.leader) {
    const v = [at[0] - src[0], at[1] - src[1]], m = Math.hypot(v[0], v[1]), u = [v[0] / m, v[1] / m];
    lead = line([src[0] + u[0] * r, src[1] + u[1] * r], [at[0] - u[0] * R, at[1] - u[1] * R]);
  }
  const tagAt = d.id === "A" ? [src[0] + r * 0.74 + 40, src[1] - r * 0.74 - 120] : [src[0] - r * 0.72 - 200, src[1] + r * 0.72 + 40];
  return `<g id="detail${d.id}" class="detail" data-full="${d.full.join(" ")}" data-dim="${d.dim.join(" ")}">
<path class="det-src" d="${circ(src, r)}${lead}"/>
<text class="det-tag" x="${f1(tagAt[0])}" y="${f1(-tagAt[1])}">${d.id}</text>
<circle class="det-bg" cx="${f1(at[0])}" cy="${f1(-at[1])}" r="${R}"/>
<g clip-path="url(#clipA)"><use href="#scene" transform="translate(${f1(at[0])},${f1(-at[1])}) scale(${k}) translate(${f1(-src[0])},${f1(src[1])})"/></g>
<circle class="det-ring" cx="${f1(at[0])}" cy="${f1(-at[1])}" r="${R}"/>
${d.id === "A" ? `<rect id="detailFrame" x="${f1(at[0] - R - 1500)}" y="${f1(-(at[1] + R + 60))}" width="${f1(2 * R + 3300)}" height="${f1(2 * R + 420)}" fill="none" stroke="none"/>` : ""}
<text class="det-title" x="${f1(at[0] + 550)}" y="${f1(-(at[1] - R - 230))}" text-anchor="end">DETAIL ${d.id}  ·  ${k} : 1${d.title ? `  ·  ${d.title.toUpperCase()}` : ""}</text>
${d.id === "A" ? `<g id="detLive"></g>` : ""}
${detailLabels(d)}
</g>`;
}
function detailLabels(d) {
  const one = (id, text, at, to, anchor, beat) => labelSvg({ id, text, at, to, anchor, beats: [beat] });
  if (d.id === "A") {
    const c0 = M.chainPoint(DET.sIn);
    const blue = toD(d, [c0[0] + 230, yOn(RAILS.chain.pass, c0[0] + 230)]);
    const teal = toD(d, [c0[0] - 330, yOn(RAILS.trailer.pass, c0[0] - 330)]);
    return one("dct", "Chain-wheel track", SLOT.r1, blue, "start", 2) + one("dtt", "Trailer-wheel track", SLOT.l2, teal, "end", 2);
  }
  if (d.id === "B") {
    const comb = toD(d, [LAND.combUp + 80, LAND.treadUp + 18]);
    const plate = toD(d, [LAND.combUp + 330, LAND.fflUp - 7]);
    const blue = toD(d, [LAND.combUp - 300, yOn(RAILS.chain.pass, LAND.combUp - 300)]);
    const teal = toD(d, [LAND.combUp - 520, yOn(RAILS.trailer.pass, LAND.combUp - 520)]);
    return one("bcomb", "Comb plate", SLOT.r1, comb, "start", 3) + one("bplate", "Floor plate", SLOT.r2, plate, "start", 3) +
      one("btt", "Trailer-wheel track", SLOT.l1, teal, "end", 3) + one("bct", "Chain-wheel track", SLOT.l2, blue, "end", 3);
  }
  const sp = toD(d, [xS - Rs * 0.2, yS - Rs * 1.08]);
  const upOut = RAILS.trailer.upOut;
  const g = toD(d, upOut.reduce((m, p) => (p[0] > m[0] ? p : m), upOut[0]));
  const shaft = toD(d, [xS - 60, yS + 70]);
  return one("csp", "Drive sprocket", SLOT.l2, sp, "end", 4) + one("cguide", "Trailer-wheel guide", SLOT.r1, g, "start", 4) +
    one("cshaft", "Main shaft (cut)", SLOT.l1, shaft, "end", 4);
}

const inner = `${defs()}
<g id="scene">
${scene()}
</g>
<g id="dims">${dims()}</g>
<g id="labels">${LABELS.map(labelSvg).join("")}</g>
${DETAILS.map(detailGroup).join("\n")}
${titleBlock()}`;
return { inner, DET, HR, SLOT, xS };
}


// ---------------------------------------------------------------- the story, per variant
const STEPS = [
  { tab: null, heading: "How does a moving staircase keep every step level?", focus: null },
  { tab: "The loop", heading: "One endless chain carries every step.", focus: ["chain", "sprockets", "drive"] },
  { tab: "Two wheels", heading: "Two wheels on two tracks keep each tread level.", focus: ["steps", "cwheels", "twheels", "chaintrack", "trailertrack"] },
  { tab: "The landing", heading: "The tracks meet, and the stairs flatten.", focus: ["steps", "cwheels", "twheels", "chaintrack", "trailertrack", "landing"] },
  { tab: "Turn and return", heading: "Each step turns over and rides back underneath.", focus: ["steps", "cwheels", "twheels", "chaintrack", "trailertrack", "chain", "sprockets"] },
  { tab: "The handrail", heading: "The handrail is its own loop, at the same speed.", focus: ["handrail", "sheaves", "hrdrive", "balustrade", "drive"] },
];
// Longer captions for the Details drawer, with the numbers taken from the model.
function captions(M) {
  const P = M.P, off = -M.STEP.T[0] * Math.tan((P.incline * Math.PI) / 180) + M.STEP.T[1];
  return [
    `An escalator is a staircase that never stops: ${M.PATH.N} steps ride one endless loop, up the slope, round the top and back underneath. This one rises ${P.rise} mm at ${P.incline}° and runs at ${P.speed / 1000} m/s.`,
    `The step chain is an endless loop of ${(P.pitch / P.links).toFixed(1)} mm links wrapped round a ${P.teeth}-tooth sprocket at each end. The motor drives the upper sprocket through a ${M.DRIVE.gearRatio.toFixed(1)} : 1 gearbox and a duplex chain, so the main shaft turns at ${M.DRIVE.shaftRpm.toFixed(2)} rpm and the chain moves at ${P.speed / 1000} m/s. The lower sprocket rides on a spring-loaded tension carriage.`,
    `Each step has a chain wheel on its front axle and a trailer wheel ${-M.STEP.T[0]} mm behind it. On the incline the trailer-wheel track runs ${off.toFixed(1)} mm higher than the chain-wheel track, which lifts the back of the step by exactly the slope over that wheelbase, so the tread stays level. Neighbouring treads are ${M.stepRise.toFixed(1)} mm apart in height and ${M.stepGoing.toFixed(1)} mm apart along the floor.`,
    `Through the upper curve the trailer-wheel track comes down to ${M.STEP.T[1]} mm above the chain-wheel track, the same as the wheels' own height difference. The rise between neighbouring treads falls to zero, two or three treads lie flat as a walkway, and they pass under the comb plate, whose teeth run in the tread grooves.`,
    `Past the comb the chain wraps the drive sprocket. The trailer wheel runs in a closed guide that eases each step through half a turn, so it travels back under the passenger run upside down and turns upright again round the tension sprocket.`,
    `The handrail runs over a sheave in each newel and back inside the balustrade. A chain from the main shaft (${M.DRIVE.zH1} to ${M.DRIVE.zH2} teeth) turns the upper sheave, whose radius is chosen so the rail moves at the same ${P.speed / 1000} m/s as the steps.`,
  ];
}

const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

function variantData(name) {
  const v = VARIANTS[name], M = MODELS[name];
  const dr = makeDrawing(M);
  const by = M.PATH.by, L = M.PATH.L, v0 = M.P.speed;
  const sIn = dr.DET.sIn;
  const comb = by["upper landing"].s0 + (M.LAND.combUp + 60 - M.STEP.f - M.PATH.xE);
  const turnMid = by["upper turn"].s0 + by["upper turn"].len / 2;
  const back = by["return, incline"].s0 + 2926;
  // from: where the beat starts on continuous play. pose: the still frame a link or a screenshot
  // shows. key and frac: on the narrated tour, the moment the voice should meet on screen.
  const beats = [
    { from: by["lower turn"].s0 - 233, pose: 800, key: 800, frac: 0.75 },
    { from: by.incline.s0 + 126, pose: sIn, key: sIn, frac: 0.55 },
    { from: by["upper transition"].s0 - 1000, pose: comb, key: comb, frac: 0.8 },
    { from: by["upper turn"].s0 - 33, pose: turnMid, key: turnMid, frac: 0.5 },
    { from: by["return, incline"].s0 + 626, pose: back, key: back, frac: 0.5 },
  ];
  const tracks = VOICE?.variants?.[name] ?? null;
  const tour = [];
  if (tracks) {
    beats.forEach((b, i) => {
      const tr = tracks[i + 1];
      // the moment to meet on screen is when the voice names the orange step, if it does
      const named = tr.links.find((l) => l.ids.includes("followed"));
      const at = named ? named.start + 0.4 : b.frac * tr.duration;
      tour[i + 1] = b.key - v0 * at;
    });
    tour[0] = tour[1] - v0 * (tracks[0].duration + 0.6);
  }
  const hr = { pts: dr.HR.loop.map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]), cum: dr.HR.cum.map((c) => +c.toFixed(1)), len: +dr.HR.length.toFixed(1), band: dr.HR.band, rN: dr.HR.rN };
  return {
    name, label: v.label, over: { incline: v.incline, rise: v.rise },
    svg: dr.inner,
    det: { at: dr.DET.at, src: dr.DET.src, k: dr.DET.k, r: dr.DET.r, R: dr.DET.R, slot: dr.SLOT },
    hr, beats, tour, L, start: beats[0].from,
    captions: captions(M),
    voice: tracks,
    readout: { rise: M.stepRise, going: M.stepGoing, N: M.PATH.N, rpm: M.DRIVE.shaftRpm, ride: M.rideTime },
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- runtime (runs in the page)
function runtime(DATA) {
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const root = $("vz"), fig = $("fig"), stage = $("stage");
  const fx = (v) => v.toFixed(1);
  const DEGR = 180 / Math.PI;
  const pad2 = (n) => String(n).padStart(2, "0");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STEPS = DATA.steps, LAST = STEPS.length - 1;
  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const S = { variant: null, step: -1, T: 0, pinPose: true, travel: 0, running: false, touring: false, voiceOn: true, armed: false, answer: null, last: 0, lit: [], heard: -1 };
  let V = null, model = null, E = null;

  // ------------------------------------------------ one drawing per variant
  function mount(name) {
    V = DATA.variants[name];
    S.variant = name;
    model = makeModel(V.over);
    fig.innerHTML = V.svg;
    E = { steps: [], wc: [], wt: [], pins: [], ticks: [] };
    const N = model.PATH.N, links = model.P.links;
    for (let i = N - 1; i >= 0; i--) E.steps[i] = mk("use", { href: "#stepSym", class: i === 0 ? "step followed" : "step" }, $("steps"));
    for (let i = N - 1; i >= 0; i--) {
      E.wt[i] = mk("use", { href: "#wheelT", class: i === 0 ? "followed" : "" }, $("wheelsT"));
      E.wc[i] = mk("use", { href: "#wheelC", class: i === 0 ? "followed" : "" }, $("wheelsC"));
    }
    for (let k = 0; k < N * links; k++) if (k % links) E.pins.push([k, mk("circle", { class: "pin", r: 13 }, $("pins"))]);
    E.nTicks = Math.floor(V.hr.len / 300);
    E.tickGap = V.hr.len / E.nTicks;
    for (let j = 0; j < E.nTicks; j++) E.ticks.push(mk("path", { class: "tick" }, $("hrticks")));
    E.rotUp = fig.querySelector("#spUp .rot");
    E.rotLow = fig.querySelector("#spLow .rot");
    E.shU = fig.querySelector("#sheaveU .rot");
    E.shL = fig.querySelector("#sheaveL .rot");
    E.live = $("detLive");
    E.parts = [...fig.querySelectorAll("#scene .part")];
    E.details = [...fig.querySelectorAll(".detail")];
    E.labels = [...fig.querySelectorAll(".label")];
    layoutText();
    document.fonts.ready.then(layoutText);
    for (const b of document.querySelectorAll(".vz-whatif button")) b.setAttribute("aria-pressed", String(b.dataset.variant === name));
    $("r-rise").textContent = V.readout.rise.toFixed(0);
    $("r-steps").textContent = String(V.readout.N);
    $("r-speed").textContent = String(model.P.speed / 1000);
    SEG = timeline();
    scrub.max = String(SEG.total);
    marks.replaceChildren(...SEG.s.slice(1, LAST + 1).map((t) => {
      const m = document.createElement("span");
      m.style.left = `${(t / SEG.total) * 100}%`;
      return m;
    }));
  }

  // Leaders run from the measured text box to the dot on the part, and the title-block key is
  // laid out by measured widths; both wait for the web fonts, or they measure the fallback face.
  function layoutText() {
    for (const g of E.labels) {
      const bb = g.querySelector("text").getBBox();
      const [tx, ty] = g.dataset.to.split(",").map(Number);
      const cy = bb.y + bb.height * 0.56;
      const right = tx > bb.x + bb.width / 2;
      const ax = right ? bb.x + bb.width + 45 : bb.x - 45, ex = ax + (right ? 110 : -110);
      g.querySelector(".leader").setAttribute("d", `M${fx(ax)},${fx(cy)}L${fx(ex)},${fx(cy)}L${fx(tx)},${fx(ty)}`);
    }
    const key = fig.querySelector("#tbkey");
    let x = +key.dataset.x0;
    for (const g of key.querySelectorAll(".tbk")) {
      const t = g.querySelector("text");
      t.setAttribute("x", "300");
      g.setAttribute("transform", `translate(${fx(x)},0)`);
      x += 300 + t.getComputedTextLength() + 170;
    }
  }

  // ------------------------------------------------ drawing one moment
  function hrAt(u) {
    const c = V.hr.cum, p = V.hr.pts, len = V.hr.len;
    u = ((u % len) + len) % len;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] <= u) lo = m;
      else hi = m;
    }
    const a = p[lo], b = p[(lo + 1) % p.length];
    const seg = (c[lo + 1] ?? len) - c[lo] || 1;
    const w = (u - c[lo]) / seg;
    const tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    return [a[0] + w * tx, a[1] + w * ty, ty / m, -tx / m];
  }
  const A = (p) => [V.det.at[0] + V.det.k * (p[0] - V.det.src[0]), V.det.at[1] + V.det.k * (p[1] - V.det.src[1])];
  const P2 = (p) => `${fx(p[0])},${fx(-p[1])}`;
  function arrowD(at, dir) {
    const L = 95, W = 26, b = [at[0] - dir[0] * L, at[1] - dir[1] * L], n = [-dir[1], dir[0]];
    return `M${P2(at)}L${P2([b[0] + n[0] * W, b[1] + n[1] * W])}L${P2([b[0] - n[0] * W, b[1] - n[1] * W])}Z`;
  }
  const WHERE = { "lower landing": "lower landing", "lower transition": "lower curve", incline: "incline", "upper transition": "upper curve", "upper landing": "upper landing", "upper turn": "turning over", "lower turn": "turning over" };
  function render(travel) {
    const N = model.PATH.N, pitch = model.P.pitch, ST = model.STEP;
    for (let i = 0; i < N; i++) {
      const s = travel - i * pitch;
      const p = model.stepPose(s);
      const tr = `translate(${fx(p.x)},${fx(-p.y)})`;
      E.steps[i].setAttribute("transform", `${tr} rotate(${(-p.phi * DEGR).toFixed(2)})`);
      E.wc[i].setAttribute("transform", `${tr} rotate(${(((s / ST.rc) * DEGR) % 360).toFixed(1)})`);
      const q = model.toWorld(p, ST.T);
      E.wt[i].setAttribute("transform", `translate(${fx(q[0])},${fx(-q[1])}) rotate(${(((s / ST.rt) * DEGR) % 360).toFixed(1)})`);
    }
    const lp = pitch / model.P.links;
    for (const [k, el] of E.pins) {
      const c = model.chainPoint(travel - k * lp);
      el.setAttribute("cx", fx(c[0]));
      el.setAttribute("cy", fx(-c[1]));
    }
    const by = model.PATH.by, Rs = model.Rs;
    E.rotUp.setAttribute("transform", `rotate(${(-90 + ((travel - by["upper turn"].s0) / Rs) * DEGR).toFixed(2)})`);
    E.rotLow.setAttribute("transform", `rotate(${(90 + ((travel - by["lower turn"].s0) / Rs) * DEGR).toFixed(2)})`);
    const hrRot = `rotate(${(((travel / V.hr.rN) * DEGR) % 360).toFixed(2)})`;
    E.shU.setAttribute("transform", hrRot);
    E.shL.setAttribute("transform", hrRot);
    const b = V.hr.band - 4;
    for (let j = 0; j < E.nTicks; j++) {
      const [x, y, nx, ny] = hrAt(travel + j * E.tickGap);
      E.ticks[j].setAttribute("d", `M${fx(x - nx * b)},${fx(-(y - ny * b))}L${fx(x + nx * b)},${fx(-(y + ny * b))}`);
    }
    renderLive(travel);
    readouts(travel);
  }
  // Detail A: dimension the step in the window (the followed one while it passes); name its wheels in chapter 2
  function renderLive(travel) {
    const N = model.PATH.N, pitch = model.P.pitch, ST = model.STEP;
    let i0 = 0, best = Infinity;
    for (let i = 0; i < N; i++) {
      const q = model.stepPose(travel - i * pitch);
      const d = Math.hypot(q.x + 20 - V.det.src[0], q.y + 225 - V.det.src[1]);
      if (d < best) (best = d), (i0 = i);
    }
    const p0 = model.stepPose(travel - i0 * pitch);
    const p1 = model.stepPose(travel - (i0 - 1) * pitch); // the step ahead, one riser higher
    const onIncline = Math.abs(p1.y - p0.y - model.stepRise) < 0.5;
    // only a step that sits squarely in the window gets dimensioned, so no figure is cut by the ring
    const inView = best < V.det.r * (i0 === 0 ? 0.5 : 0.22) && onIncline && (i0 === 0 || !S.running);
    E.live.style.opacity = inView ? 1 : 0;
    if (!inView) return;
    const k = V.det.k, c = A([p0.x, p0.y]), tw = A(model.toWorld(p0, ST.T));
    const nose0 = A([p0.x + ST.f, p0.y + ST.t]), nose1 = A([p1.x + ST.f, p1.y + ST.t]);
    const back0 = A([p0.x + ST.f - model.RISER_R, p0.y + ST.t]);
    const xd = back0[0] - 170, yA = nose1[1], yB = nose0[1], yg = yA + 240;
    const lab = (txt, to, at, anchor) => {
      const dir = anchor === "end" ? 1 : -1;
      const a1 = [at[0] + dir * 50, at[1] + DATA.FS * 0.33], e1 = [a1[0] + dir * 110, a1[1]];
      return `<path class="leader" d="M${P2(a1)}L${P2(e1)}L${P2(to)}"/><circle class="ldot" cx="${fx(to[0])}" cy="${fx(-to[1])}" r="24"/><text class="ltext" x="${fx(at[0])}" y="${fx(-at[1])}" text-anchor="${anchor}">${txt}</text>`;
    };
    let s = `<g clip-path="url(#clipA)">`;
    s += `<path class="dim" d="M${P2([back0[0] - 40, yB])}L${P2([xd - 110, yB])}M${P2([nose1[0] - (model.RISER_R) * k - 40, yA])}L${P2([xd - 110, yA])}M${P2([xd, yB + 4])}L${P2([xd, yA - 4])}"/>`;
    s += `<path class="dimhead" d="${arrowD([xd, yA], [0, 1])}${arrowD([xd, yB], [0, -1])}"/>`;
    s += `<text class="dimtext" x="${fx(xd + 60)}" y="${fx(-(yA + yB) / 2 + 45)}">${model.stepRise.toFixed(0)}</text>`;
    s += `<path class="dim" d="M${P2([nose0[0], yB + 40])}L${P2([nose0[0], yg + 90])}M${P2([nose1[0], yA + 40])}L${P2([nose1[0], yg + 90])}M${P2([nose0[0] + 4, yg])}L${P2([nose1[0] - 4, yg])}"/>`;
    s += `<path class="dimhead" d="${arrowD([nose0[0], yg], [-1, 0])}${arrowD([nose1[0], yg], [1, 0])}"/>`;
    s += `<text class="dimtext" x="${fx((nose0[0] + nose1[0]) / 2)}" y="${fx(-(yg + 50))}" text-anchor="middle">${model.stepGoing.toFixed(0)}</text></g>`;
    if (S.step === 2 && i0 === 0) {
      s += lab("Chain wheel", [c[0] + ST.rc * 0.5 * k, c[1] - ST.rc * 0.6 * k], V.det.slot.r2, "start");
      s += lab("Trailer wheel", [tw[0] - ST.rt * 0.55 * k, tw[1] - ST.rt * 0.6 * k], V.det.slot.l1, "end");
    }
    E.live.innerHTML = s;
  }
  // Readouts, all measured from the model for the followed step.
  const R = {};
  const setText = (id, v) => {
    if (R[id] !== v) ((R[id] = v), ($(id).textContent = v));
  };
  function readouts(travel) {
    const p = model.stepPose(travel), ST = model.STEP;
    // tilt from the two wheel centres alone, against their angle in a level step
    const c = [p.x, p.y], t = model.toWorld(p, ST.T);
    let a = (Math.atan2(t[1] - c[1], t[0] - c[0]) - Math.atan2(ST.T[1], ST.T[0])) * DEGR;
    a = Math.abs(((a % 360) + 540) % 360 - 180);
    setText("r-tilt", `${a.toFixed(1)}°`);
    const tread = model.toWorld(p, [ST.f - 196, ST.t])[1] - model.LAND.treadLow;
    setText("r-height", (tread / 1000).toFixed(2));
    setText("r-where", WHERE[model.segmentAt(travel)] ?? "return run");
  }

  // ------------------------------------------------ focus, and the parts the voice names
  function applyFocus() {
    const focus = STEPS[S.step]?.focus;
    const lit = S.lit;
    for (const el of E.parts) {
      const part = el.dataset.part;
      let o = !focus || focus.includes(part) ? 1 : 0.35;
      if (lit.length) o = lit.includes(part) || (lit.includes("followed") && ["steps", "cwheels", "twheels"].includes(part)) ? 1 : 0.2;
      el.style.opacity = String(o);
      el.classList.toggle("lit", lit.includes(part));
    }
    const only = lit.includes("followed");
    for (const u of [...E.steps, ...E.wc, ...E.wt]) u.style.opacity = only && !u.classList.contains("followed") ? "0.25" : "";
  }
  function light(ids) {
    const key = ids.join(" ");
    if (key === S.lit.join(" ")) return;
    S.lit = ids;
    applyFocus();
  }

  // ------------------------------------------------ steps
  const tabs = [...document.querySelectorAll(".vz-chapters button")];
  const heading = $("heading"), count = $("count"), concept = $("concept");
  const predict = $("predict"), practice = $("practice");
  const scrub = $("scrub"), marks = $("marks"), playBtn = $("play"), voiceBtn = $("voice"), tryBtn = $("try");
  // The story timeline: one pass from the concept to the last step, each step as long as its
  // narration (or a fixed time without a voice). The bar shows story time, never the machine's loop.
  const LEAD = 0.3, GAP = 0.6, PLAIN = 8;
  let SEG = null;
  function timeline() {
    const d = [];
    for (let k = 0; k <= LAST; k++) {
      const tr = V.voice?.[k];
      d.push(tr ? LEAD + tr.duration + GAP : PLAIN);
    }
    const s = [0];
    d.forEach((x, i) => s.push(s[i] + x));
    return { d, s, total: s[LAST + 1] };
  }
  const segOf = (T) => {
    let k = 0;
    for (let i = 1; i <= LAST; i++) if (T >= SEG.s[i] - 1e-6) k = i;
    return k;
  };
  const baseOf = (k) => (V.tour?.length ? V.tour[k] : k === 0 ? V.beats[0].from - DATA.speed * PLAIN : V.beats[k - 1].from);
  const leadOf = () => (V.tour?.length ? LEAD : 0);
  const travelAt = (T) => {
    const k = segOf(T);
    return reduced ? poseOf(k) : baseOf(k) + DATA.speed * (T - SEG.s[k] - leadOf());
  };
  // The still frame of a step sits inside its stretch of the bar, at the moment the voice meets it.
  const poseT = (k) => {
    if (k === 0) return 0;
    const t = SEG.s[k] + leadOf() + (poseOf(k) - baseOf(k)) / DATA.speed;
    return Math.min(SEG.s[k + 1] - 0.01, Math.max(SEG.s[k], t));
  };
  function setStep(k) {
    if (k === S.step) return;
    S.step = k;
    S.heard = -1;
    root.dataset.step = String(k);
    root.toggleAttribute("data-opening", k === 0);
    heading.textContent = STEPS[k].heading;
    count.textContent = `${pad2(k)} / ${pad2(LAST)}`;
    tabs.forEach((t, i) => (i + 1 === k ? t.setAttribute("aria-current", "step") : t.removeAttribute("aria-current")));
    for (const g of E.labels) g.style.display = g.dataset.beats.split(" ").includes(String(k)) ? "" : "none";
    for (const g of E.details) {
      const full = g.dataset.full.split(" ").includes(String(k)), dim = g.dataset.dim.split(" ").includes(String(k)) || k === 0 && g.id === "detailA";
      g.classList.toggle("dim", dim && !full);
      g.classList.toggle("off", !full && !dim);
    }
    S.lit = [];
    applyFocus();
    showPredict();
    $("d-step").textContent = V.captions[k];
    $("d-count").textContent = `${pad2(k)} / ${pad2(LAST)}`;
    scrub.setAttribute("aria-valuetext", `${count.textContent}: ${STEPS[k].heading}`);
    try {
      history.replaceState(null, "", `#step=${k}${S.variant !== "standard" ? `&what=${S.variant}` : ""}`);
    } catch {
      /* sandboxed frames */
    }
  }
  const poseOf = (k) => (k === 0 ? V.beats[0].pose : V.beats[k - 1].pose);
  function draw() {
    S.travel = travelAt(S.T);
    if (reduced || S.pinPose) S.travel = poseOf(segOf(S.T));
    render(S.travel);
    scrub.value = String(S.T);
  }
  // Go to a step: paused, show its still frame; running, start the beat from its beginning.
  function goTo(k, how = {}) {
    k = Math.max(0, Math.min(LAST, k));
    setStep(k);
    S.T = S.running && !how.pose ? SEG.s[k] : poseT(k);
    S.pinPose = !S.running || !!how.pose;
    draw();
    if (how.speak !== false) speakNav(k);
  }
  const unanswered = () => S.step === 2 && S.answer === null;

  // ------------------------------------------------ time
  let stillTimer = 0;
  function setRunning(on) {
    S.running = on && !reduced;
    playBtn.dataset.state = on ? "pause" : "play";
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    clearInterval(stillTimer);
    // Reduced motion: no continuous movement; play moves from one still pose to the next.
    if (on && reduced && !S.touring) {
      S.stillOn = true;
      stillTimer = setInterval(() => {
        if (unanswered()) return stop(true);
        if (S.step >= LAST) return setRunning(false);
        goTo(S.step + 1, { pose: true, speak: false });
      }, 4000);
    } else S.stillOn = false;
    if (S.running) {
      S.last = performance.now();
      requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    if (!S.running) return;
    const dt = Math.min(0.1, (now - S.last) / 1000);
    S.last = now;
    S.pinPose = false;
    if (S.touring) {
      // The voice moves the story on; within a step the bar runs with it and waits at the step's end.
      S.T = Math.min(S.T + dt, SEG.s[S.step + 1] - 1e-3);
    } else {
      S.T += dt;
      const k = segOf(S.T);
      // The prediction holds the story: stop where the landing step would begin.
      if (S.step <= 2 && k >= 3 && S.answer === null) {
        S.T = SEG.s[3] - 1e-3;
        draw();
        return stop(true);
      }
      if (S.T >= SEG.total) {
        S.T = SEG.total - 1e-3;
        draw();
        return setRunning(false);
      }
      if (k !== S.step) setStep(k);
    }
    draw();
    requestAnimationFrame(tick);
  }
  // Continuous play runs the beat from its start if the machine is elsewhere (after a tour, say).
  function startPlain() {
    if (S.pinPose || segOf(S.T) !== S.step) S.T = SEG.s[S.step];
    S.pinPose = false;
    setRunning(true);
  }
  function stop(toPredict) {
    stopTour();
    setRunning(false);
    if (toPredict) predict.querySelector("button")?.focus();
  }

  // ------------------------------------------------ voice: recorded narration that lights what it names
  let clip = null, clipRaf = 0, tourTimer = 0, navTimer = 0;
  const hasVoice = () => !!(V && V.voice);
  const fadeOut = (el) => {
    if (!el || el.paused || el.ended) return;
    const t0 = performance.now(), v0 = el.volume;
    const f = () => {
      const u = (performance.now() - t0) / 200;
      if (u >= 1) return el.pause();
      el.volume = v0 * (1 - u);
      requestAnimationFrame(f);
    };
    f();
  };
  function stopClip() {
    clearTimeout(navTimer);
    cancelAnimationFrame(clipRaf);
    fadeOut(clip);
    clip = null;
    light([]);
  }
  function playClip(k, then) {
    stopClip();
    const track = V.voice?.[k];
    if (!track || !S.voiceOn) return false;
    const el = new Audio(`data:${track.type};base64,${track.audio}`);
    clip = el;
    el.onended = () => {
      cancelAnimationFrame(clipRaf);
      if (clip === el) light([]);
      S.heard = k;
      then?.();
    };
    const follow = () => {
      if (clip !== el) return;
      const at = el.currentTime;
      light(track.links.find((l) => at >= l.start - 0.05 && at < l.end + 0.25)?.ids ?? []);
      clipRaf = requestAnimationFrame(follow);
    };
    el.play().then(follow).catch(() => {});
    return true;
  }
  // Each step the reader goes to is spoken once the move settles (after the first gesture).
  function speakNav(k) {
    if (S.touring || !S.armed || !S.voiceOn || !hasVoice()) return;
    stopClip();
    navTimer = setTimeout(() => playClip(k), 650);
  }
  // With the voice on, play is the narrated tour: a step moves on only when its clip has ended.
  function tourAt(k) {
    setStep(k);
    S.T = SEG.s[k];
    S.pinPose = false;
    draw();
    setRunning(true);
    playBtn.dataset.state = "pause";
    tourTimer = setTimeout(() => {
      const ok = playClip(k, () => {
        if (!S.touring) return;
        if (k === 2 && S.answer === null) return stop(true);
        tourTimer = setTimeout(() => (k < LAST ? tourAt(k + 1) : stopTour(true)), GAP * 1000);
      });
      if (!ok) tourTimer = setTimeout(() => (k < LAST && S.touring ? tourAt(k + 1) : stopTour(true)), PLAIN * 1000);
    }, LEAD * 1000);
  }
  function startTour(from) {
    S.touring = true;
    S.armed = true;
    tourAt(from);
  }
  function stopTour(andMachine) {
    if (!S.touring) return;
    S.touring = false;
    clearTimeout(tourTimer);
    stopClip();
    if (andMachine) setRunning(false);
    playBtn.dataset.state = S.running ? "pause" : "play";
  }

  playBtn.addEventListener("click", () => {
    S.armed = true;
    if (S.touring || S.running || S.stillOn) return stop(false);
    if (unanswered()) return predict.querySelector("button")?.focus();
    if (S.voiceOn && hasVoice()) return startTour(S.step >= LAST ? 0 : S.heard === S.step ? S.step + 1 : S.step);
    if (S.step >= LAST && S.T >= SEG.total - 0.01) goTo(0, { speak: false });
    startPlain();
  });
  voiceBtn.addEventListener("click", () => {
    S.voiceOn = !S.voiceOn;
    S.armed = true;
    voiceBtn.setAttribute("aria-pressed", String(S.voiceOn));
    voiceBtn.textContent = S.voiceOn ? "Voice on" : "Voice off";
    if (!S.voiceOn) {
      const wasTour = S.touring;
      stopTour(false);
      stopClip();
      if (wasTour) startPlain(); // keep the machine running, now without narration
    } else if (!S.touring) speakNav(S.step);
  });
  const nav = (k) => {
    S.armed = true;
    if (S.touring) stopTour(true);
    goTo(k);
  };
  $("prev").addEventListener("click", () => nav(S.step - 1));
  $("next").addEventListener("click", () => (unanswered() ? predict.querySelector("button")?.focus() : nav(S.step + 1)));
  $("restart").addEventListener("click", () => {
    stop(false);
    S.answer = null;
    goTo(0, { speak: false });
  });
  tabs.forEach((t, i) => t.addEventListener("click", () => nav(i + 1)));
  scrub.addEventListener("input", () => {
    S.armed = true;
    stopTour(false);
    S.T = Number(scrub.value);
    S.pinPose = false;
    setStep(segOf(S.T));
    draw();
  });

  // ------------------------------------------------ predict before the landing
  const PRED = DATA.predict;
  function showPredict() {
    const k = S.step;
    const show = !practiceOpen && (k === 2 || (k === 3 && S.answer !== null));
    predict.hidden = !show;
    concept.hidden = !(k === 0 && !practiceOpen);
    syncCards();
    if (!show) return;
    const reveal = k === 3;
    predict.replaceChildren();
    const kicker = Object.assign(document.createElement("span"), { className: "vz-predict-kicker", textContent: reveal ? "Your prediction" : "Predict" });
    const q = Object.assign(document.createElement("p"), { textContent: PRED.question });
    const opts = Object.assign(document.createElement("div"), { className: "vz-predict-options" });
    const fb = Object.assign(document.createElement("p"), { className: "vz-predict-feedback" });
    fb.setAttribute("aria-live", "polite");
    PRED.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.setAttribute("aria-pressed", String(S.answer === i));
      if (reveal) b.dataset.correct = String(i === PRED.answer);
      b.addEventListener("click", () => {
        if (reveal) return;
        S.answer = i;
        S.armed = true;
        for (const o of opts.children) o.setAttribute("aria-pressed", String(o === b));
        fb.textContent = "Locked in. Press play to watch the orange step reach the top.";
      });
      opts.append(b);
    });
    if (reveal) fb.textContent = (S.answer === PRED.answer ? "Right. " : "Not quite. ") + PRED.explanation;
    else if (S.answer !== null) fb.textContent = "Locked in. Press play to watch the orange step reach the top.";
    predict.append(kicker, q, opts, fb);
  }
  // A card sits over the title block's corner; while one is up, the title block steps aside.
  const syncCards = () => root.toggleAttribute("data-card", !predict.hidden || !concept.hidden);

  // ------------------------------------------------ now you try: questions made from the model
  let practiceOpen = false, seed = 7, right = 0, tried = 0;
  const rng = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
  const shuffle = (r, xs) => xs.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const rad = (d) => (d * Math.PI) / 180;
  function question(n) {
    const r = rng(n * 2654435761);
    const kind = n % 4;
    const th = pick(r, [30, 35]), H = pick(r, [3000, 4500, 6000]);
    if (kind === 0) {
      const m = makeModel({ incline: th });
      const v = m.stepRise, wrong = [m.stepGoing, m.P.pitch * Math.tan(rad(th))];
      return { q: `At a ${th}° incline with a ${m.P.pitch} mm step pitch, how high is each step?`, choices: [v, ...wrong].map((x) => `${x.toFixed(0)} mm`), explain: `Steps are one pitch apart along the slope: ${m.P.pitch} × sin ${th}° = ${v.toFixed(1)} mm. ${m.stepGoing.toFixed(0)} mm is the going (cos).` };
    }
    if (kind === 1) {
      const m = makeModel({ incline: th, rise: H });
      const v = m.rideTime, slopeOnly = H / Math.sin(rad(th)) / m.P.speed, upOnly = H / m.P.speed;
      return { q: `An escalator rises ${H} mm at ${th}° and runs at 0.5 m/s. About how long is the ride from comb to comb?`, choices: [v, slopeOnly, upOnly].map((x) => `${x.toFixed(1)} s`), explain: `From comb to comb the chain path, curves and landings included, is ${(m.rideLength / 1000).toFixed(2)} m. At 0.5 m/s that is ${v.toFixed(1)} s.` };
    }
    if (kind === 2) {
      const m = makeModel({ incline: th });
      const T = m.STEP.T, v = -T[0] * Math.tan(rad(th)) + T[1], flat = T[1], noLift = -T[0] * Math.sin(rad(th));
      return { q: `The trailer wheel sits ${-T[0]} mm behind the chain wheel and ${T[1]} mm higher. On a ${th}° slope, how much higher must its track run to keep the tread level?`, choices: [v, flat, noLift].map((x) => `${x.toFixed(0)} mm`), explain: `${-T[0]} × tan ${th}° = ${(-T[0] * Math.tan(rad(th))).toFixed(1)} mm for the slope, plus the ${T[1]} mm the wheel already sits higher: ${v.toFixed(1)} mm. On the flat only ${T[1]} mm is left, so the tracks converge.` };
    }
    const teeth = pick(r, [14, 16, 18, 20]);
    const m = makeModel({ teeth });
    const v = m.DRIVE.shaftRpm, perSec = m.P.speed / (2 * Math.PI * m.Rs), radps = m.P.speed / m.Rs;
    return { q: `A drive sprocket with ${teeth} teeth on a ${(m.P.pitch / m.P.links).toFixed(1)} mm chain pitch moves the chain at 0.5 m/s. How fast does the main shaft turn?`, choices: [v, perSec, radps].map((x) => `${x.toFixed(2)} rpm`), explain: `One turn moves ${teeth} links, ${(teeth * m.P.pitch / m.P.links / 1000).toFixed(3)} m of chain, so 0.5 m/s is ${(m.P.speed / (teeth * m.P.pitch / m.P.links)).toFixed(4)} turns a second: ${v.toFixed(2)} rpm.` };
  }
  function renderPractice() {
    const Q = question(seed);
    const r = rng(seed * 31 + 7);
    const order = shuffle(r, [0, 1, 2]);
    practice.replaceChildren();
    const kicker = Object.assign(document.createElement("span"), { className: "vz-predict-kicker", textContent: "Now you try" });
    const q = Object.assign(document.createElement("p"), { textContent: Q.q });
    const opts = Object.assign(document.createElement("div"), { className: "vz-predict-options" });
    const fb = Object.assign(document.createElement("p"), { className: "vz-predict-feedback" });
    fb.setAttribute("aria-live", "polite");
    const foot = Object.assign(document.createElement("div"), { className: "vz-practice-foot" });
    const score = Object.assign(document.createElement("span"), { className: "vz-practice-score", textContent: tried ? `${right} of ${tried} right` : "Worked from the model on this page" });
    const another = Object.assign(document.createElement("button"), { type: "button", className: "vz-practice-next", textContent: "New question" });
    another.addEventListener("click", () => {
      seed += 1;
      renderPractice();
      practice.querySelector(".vz-predict-options button")?.focus();
    });
    let done = false;
    for (const i of order) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = Q.choices[i];
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        if (done) return;
        done = true;
        tried += 1;
        if (i === 0) right += 1;
        for (const o of opts.children) o.dataset.correct = String(o === opts.children[order.indexOf(0)]);
        b.setAttribute("aria-pressed", "true");
        fb.textContent = (i === 0 ? "Right. " : "Not quite. ") + Q.explain;
        score.textContent = `${right} of ${tried} right`;
      });
      opts.append(b);
    }
    foot.append(score, another);
    practice.append(kicker, q, opts, fb, foot);
  }
  tryBtn.addEventListener("click", () => {
    practiceOpen = !practiceOpen;
    root.toggleAttribute("data-practice", practiceOpen);
    tryBtn.setAttribute("aria-pressed", String(practiceOpen));
    practice.hidden = !practiceOpen;
    if (practiceOpen) renderPractice();
    showPredict();
    syncCards();
    if (practiceOpen) practice.querySelector(".vz-predict-options button")?.focus();
  });

  // ------------------------------------------------ what if
  for (const b of document.querySelectorAll(".vz-whatif button")) {
    b.addEventListener("click", () => {
      if (b.dataset.variant === S.variant) return;
      const k = S.step;
      stop(false);
      stopClip();
      mount(b.dataset.variant);
      S.step = -1;
      goTo(k, { pose: true, speak: false });
    });
  }

  // ------------------------------------------------ details, theme, keyboard
  const drawer = $("details");
  for (const b of document.querySelectorAll("[data-details]")) b.addEventListener("click", () => (drawer.open ? drawer.close() : drawer.showModal()));
  const themeBtn = $("theme");
  const applyTheme = (th) => {
    root.dataset.theme = th;
    document.body.dataset.theme = th;
    themeBtn.textContent = th === "dark" ? "Light" : "Dark";
    themeBtn.setAttribute("aria-label", `Switch to ${th === "dark" ? "light" : "dark"} theme`);
  };
  applyTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  themeBtn.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark"));
  document.addEventListener("keydown", (e) => {
    if (drawer.open || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (e.target instanceof HTMLButtonElement && (k === " " || k === "Enter")) return;
    if (e.target instanceof HTMLInputElement && k !== " ") return;
    if (k === "ArrowRight") $("next").click();
    else if (k === "ArrowLeft") $("prev").click();
    else if (k === "Home") nav(0);
    else if (k === "End") nav(LAST);
    else if (k === " ") playBtn.click();
    else return;
    e.preventDefault();
  });

  // ------------------------------------------------ start
  const hash = new URLSearchParams(location.hash.slice(1));
  const what = DATA.variants[hash.get("what")] ? hash.get("what") : "standard";
  const first = Math.max(0, Math.min(LAST, Number(hash.get("step") ?? 0) || 0));
  mount(what);
  goTo(first, { pose: true, speak: false });
  setRunning(false);
  window.__viz = {
    steps: LAST + 1,
    seekStep(k) {
      root.classList.add("instant");
      stop(false);
      goTo(Number(k) || 0, { pose: true, speak: false });
    },
    seek(ms) {
      root.classList.add("instant");
      stop(false);
      S.T = Math.min(SEG.total, Number(ms) / 1000);
      S.pinPose = false;
      setStep(segOf(S.T));
      draw();
    },
    variant(name) {
      document.querySelector(`.vz-whatif button[data-variant="${name}"]`)?.click();
    },
    practice(n) {
      if (n !== undefined) seed = n;
      if (!practiceOpen) tryBtn.click();
      else renderPractice();
    },
    state: () => ({ step: S.step, travel: S.travel, running: S.running, touring: S.touring, voiceOn: S.voiceOn, answer: S.answer, variant: S.variant, lit: S.lit.slice() }),
  };
}

// ---------------------------------------------------------------- page
const font = (f) => readFileSync(join(ROOT, "src/render/fonts", f)).toString("base64");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const PREDICT = {
  question: "The two tracks meet near the top. What happens to the steps?",
  choices: ["They tip forward", "They flatten out", "They stop"],
  answer: 1,
  explanation: "With both wheels at the same height, each tread lines up with its neighbours: a flat walkway before the comb.",
};

const DATA = {
  speed: BASE_SPEED(),
  FS,
  steps: STEPS.map(({ heading, focus }) => ({ heading, focus })),
  predict: PREDICT,
  variants: VARIANT_DATA,
};
function BASE_SPEED() {
  return MODELS.standard.P.speed;
}

// Visualize tokens (src/render/tokens.css, editorial presentation) and the player's page chrome
// (src/render/styles.css), followed by the drawing's own line weights.
const CSS = `
@font-face{font-family:"Visualize Sans";font-style:normal;font-weight:400 700;font-display:block;src:url(data:font/woff2;base64,${font("manrope-latin.woff2")}) format("woff2")}
@font-face{font-family:"Visualize Mono";font-style:normal;font-weight:500;font-display:block;src:url(data:font/woff2;base64,${font("ibm-plex-mono-latin-500.woff2")}) format("woff2")}
@font-face{font-family:"Visualize Display";font-style:normal;font-weight:700;font-display:block;src:url(data:font/woff2;base64,${font("playfair-display-sc-latin-700.woff2")}) format("woff2")}
.vz{--radius-card:16px;--radius-stage:10px;--stage:#fffefa;--paper:#f7f5ef;--card:#fffefa;--ink:#262521;--ink-2:#625f58;--hair:#e5e1d8;--focus:#262521;
  --t-good:#317b6c;--t-bad:#b34d49;
  --step:#ebe7dd;--slab:#fffefa;--blue:#2563eb;--teal:#0f9488;--orange:#e4572e;--orange-tint:#f7dccf;
  --sans:"Visualize Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"Visualize Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;color-scheme:light}
@media (prefers-color-scheme:dark){.vz:not([data-theme="light"]){--stage:#121212;--card:#121212;--ink:#f1f0eb;--ink-2:#b6b4ae;--hair:#30302e;--focus:#f1f0eb;--t-good:#74beaa;--t-bad:#e4928a;--step:#1f2328;--slab:#151719;--orange-tint:#3a2219;color-scheme:dark}}
.vz[data-theme="dark"]{--stage:#121212;--card:#121212;--ink:#f1f0eb;--ink-2:#b6b4ae;--hair:#30302e;--focus:#f1f0eb;--t-good:#74beaa;--t-bad:#e4928a;--step:#1f2328;--slab:#151719;--orange-tint:#3a2219;color-scheme:dark}
html,body{margin:0}
body{padding:24px 32px;background:#f7f5ef;overflow:hidden}
@media (prefers-color-scheme:dark){body:not([data-theme="light"]){background:#090909}}
body[data-theme="dark"]{background:#090909}body[data-theme="light"]{background:#f7f5ef}
.vz,.vz *,.vz *::before,.vz *::after{box-sizing:border-box}
.vz{color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;max-width:1640px;margin:0 auto;height:calc(100dvh - 48px)}
.vz-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--radius-card);padding:22px 28px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;height:100%}
.vz-head{display:flex;align-items:center;justify-content:space-between;gap:24px;margin:0 0 18px}
.vz-heading{min-width:0}
.vz-title{margin:0;font:700 34px/1.1 "Visualize Display","Playfair Display SC",Georgia,serif;letter-spacing:.01em;color:var(--ink)}
.vz-about{margin:4px 0 0;font:400 14px/1.45 var(--sans);color:var(--ink-2)}
.vz-chapters{display:flex;gap:22px}
.vz-chapters button{appearance:none;background:none;border:0;border-bottom:2px solid transparent;padding:10px 0;color:var(--ink-2);font:500 12px var(--sans);cursor:pointer}
.vz-chapters button span{font:11px var(--mono);margin-right:5px}
.vz-chapters button[aria-current]{color:var(--ink);border-bottom-color:var(--ink)}
.vz-chapters button:hover{color:var(--ink)}
.vz-utilities{display:flex;align-items:center;gap:8px}
.vz-info,.vz-theme{border:1px solid var(--hair);border-radius:7px;padding:7px 12px;background:var(--card);color:var(--ink-2);font:500 12px var(--sans);cursor:pointer}
.vz-info:hover,.vz-theme:hover{color:var(--ink);border-color:var(--ink-2)}
.vz-body{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;min-height:0}
.vz-stage{position:relative;min-height:0;border:1px solid var(--hair);border-radius:var(--radius-stage);background:var(--stage);outline:none;overflow:hidden}
.vz-stage:focus-visible{outline:2px solid var(--focus);outline-offset:4px}
.vz-svg{position:absolute;inset:0;width:100%;height:100%;display:block;padding:10px 14px}
.vz-caption{position:absolute;left:26px;top:24px;width:min(262px,21%);z-index:2;pointer-events:none}
.vz[data-practice] .vz-caption{width:min(400px,32%)}
.vz-practice{margin-top:16px;pointer-events:auto}
.vz[data-practice] #fig .detail{visibility:hidden}
.vz-step-heading{margin:0;font:500 21px/1.35 var(--sans);letter-spacing:-.025em;text-wrap:balance}
.vz-cards{position:absolute;right:22px;bottom:20px;width:min(410px,35%);z-index:3;display:grid;gap:10px}
.vz-predict{padding:13px 15px;border:1px solid var(--hair);border-radius:10px;background:var(--stage)}
.vz-predict[hidden],.vz-concept[hidden]{display:none}
.vz-predict-kicker{font-size:11px;color:var(--ink-2)}
.vz-predict p{margin:5px 0 9px;font-size:14px;line-height:1.45}
.vz-predict-options{display:flex;flex-wrap:wrap;gap:8px}
.vz-predict button{font:600 13px var(--sans);color:var(--ink);background:var(--card);border:1px solid var(--hair);padding:6px 11px;border-radius:6px;cursor:pointer;text-align:left}
.vz[data-card] #fig .tblock{visibility:hidden}
.vz-predict button:hover{border-color:var(--ink-2)}
.vz-predict button[aria-pressed="true"]{border-color:var(--ink)}
.vz-predict button[data-correct="true"]{background:color-mix(in oklab,var(--t-good) 14%,var(--card));border-color:var(--t-good)}
.vz-predict button[data-correct="false"][aria-pressed="true"]{background:color-mix(in oklab,var(--t-bad) 10%,var(--card));border-color:var(--t-bad)}
.vz-predict .vz-predict-feedback{font-size:12px;color:var(--ink-2);margin:10px 0 0}
.vz-predict-feedback:empty{display:none}
.vz-practice-foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12px;color:var(--ink-2)}
.vz-practice-foot button{font:600 13px var(--sans);text-align:center;padding:6px 14px}
.vz-concept{margin:0;padding:14px 16px;border-radius:12px;background:color-mix(in oklab,var(--card) 92%,transparent);border:1px solid var(--hair);font:400 14px/1.55 var(--sans);color:var(--ink)}
.vz-panels{display:block;padding:14px 4px 12px;min-width:0}
.vz-panel{display:flex;align-items:center;gap:20px}
.vz-panel h3{flex:0 0 auto;font:500 11px var(--sans);margin:0;color:var(--ink)}
.vz-panel-body{display:flex;align-items:center;justify-content:space-between;gap:24px;flex:1;min-width:0}
.vz-whatif{display:flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--ink-2)}
.vz-whatif button{font:500 12px var(--sans);color:var(--ink);background:var(--card);border:1px solid var(--hair);border-radius:999px;padding:4px 11px;cursor:pointer}
.vz-whatif button[aria-pressed="true"]{background:var(--ink);color:var(--card);border-color:var(--ink)}
.vz-totals{display:flex;flex-wrap:wrap;gap:18px;margin:0;color:var(--ink-2);font-size:12px;justify-content:flex-end}
.vz-totals b{color:var(--ink);font:500 19px var(--mono);margin-right:3px}
.vz-controls{display:flex;align-items:center;gap:8px;border-top:1px solid var(--hair);padding-top:14px}
.vz-btn{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:9px;border:1px solid var(--hair);background:var(--card);color:var(--ink);cursor:pointer;padding:0;flex:0 0 auto}
.vz-btn:hover{border-color:var(--ink-2)}
.vz-btn:focus-visible,.vz-info:focus-visible,.vz-theme:focus-visible,.vz-chapters button:focus-visible,.vz-predict button:focus-visible,.vz-whatif button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.vz-btn[data-primary]{background:var(--ink);color:var(--card);border-color:var(--ink)}
.vz-btn svg{width:16px;height:16px;fill:currentColor}
#play[data-state="play"] .i-pause,#play[data-state="pause"] .i-play{display:none}
.vz-count{font:500 11px var(--mono);color:var(--ink-2);margin:0 10px;white-space:nowrap}
.vz-scrub{flex:1;min-width:0;position:relative;height:36px;display:flex;align-items:center}
.vz-range{width:100%;accent-color:var(--ink);margin:0}
#marks{position:absolute;left:8px;right:8px;top:27px;height:4px;pointer-events:none}
#marks span{position:absolute;top:0;width:1px;height:4px;background:var(--ink-2);opacity:.6}
.vz-btn.vz-try,.vz-btn.vz-voice{width:auto;min-width:0;padding:0 14px;white-space:nowrap;font:500 13px var(--sans);color:var(--ink)}
.vz-btn.vz-voice[aria-pressed="false"]{color:var(--ink-2)}
.vz-btn.vz-try[aria-pressed="true"]{background:var(--ink);color:var(--card);border-color:var(--ink)}
.vz-drawer{width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 48px);margin:24px 24px 24px auto;padding:0;border:1px solid var(--hair);border-radius:14px;background:var(--card);color:var(--ink);box-shadow:0 20px 100px #0003}
.vz-drawer[open]{display:flex;flex-direction:column}
.vz-drawer::backdrop{background:#10181455}
.vz-drawer-head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:22px 24px;border-bottom:1px solid var(--hair)}
.vz-drawer-head h2{margin:0;font:550 19px var(--sans)}
.vz-drawer-body{padding:24px;overflow:auto;overscroll-behavior:contain}
.vz-drawer-body h3{font:550 13px var(--sans);margin:24px 0 10px}
.vz-setup,.vz-text{margin:0;font:400 15px/1.65 var(--sans);color:var(--ink-2)}
.vz-meta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-top:14px}
.vz-trust{font:11px var(--sans);padding:4px 8px;border-radius:999px;border:1px solid var(--ink-2);color:var(--ink-2)}
.vz-readout{font:11px var(--sans);color:var(--ink)}
.vz-legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin:0;padding:0;list-style:none;font-size:11px;color:var(--ink-2)}
.vz-legend li{display:inline-flex;align-items:center;gap:7px}
.vz-swatch{width:8px;height:8px;border-radius:50%;background:var(--tone)}
.vz-facts{margin:0;padding:0;list-style:none;font:400 13px/1.7 var(--sans);color:var(--ink-2)}
.vz-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* ---- the drawing: line weights in screen pixels, three accents, one meaning each ---- */
path,circle,rect,line,polyline,polygon,ellipse{vector-effect:non-scaling-stroke}
#fig{shape-rendering:geometricPrecision}
text{font-family:var(--sans);fill:var(--ink)}
.part{transition:opacity .45s ease}
.instant .part,.instant .detail,.instant #detLive{transition:none}
#fig > #scene{--fine:none}
.fine,.st-web,.wh-tyre{display:var(--fine,inline)}
.step{--sink:var(--ink);--sfill:var(--step)}
.followed{--sink:var(--orange);--sfill:var(--orange-tint)}
.st-body{fill:var(--sfill);stroke:var(--sink);stroke-width:1.5;stroke-linejoin:round}
.st-web{fill:var(--stage);stroke:var(--sink);stroke-width:.9}
.st-line{fill:none;stroke:var(--sink,var(--ink));stroke-width:.9}
.st-fine{fill:none;stroke:var(--sink);stroke-width:.5}
.wh-rim{fill:var(--stage);stroke:var(--sink,var(--ink));stroke-width:1.5}
.wh-tyre{fill:none;stroke:var(--sink,var(--ink));stroke-width:.5}
.wh-hub{fill:var(--sink,var(--ink))}
.wh-mark{stroke:var(--sink,var(--ink));stroke-width:.9}
.rail-blue{fill:none;stroke:var(--blue);stroke-width:1.5}
.rail-teal{fill:none;stroke:var(--teal);stroke-width:1.5}
.lit .rail-blue,.lit .rail-teal{stroke-width:2.6}
.chain-band{fill:none;stroke:var(--blue);stroke-width:.9}
.lit .chain-band{stroke-width:1.6}
.pin{fill:var(--blue)}
.sp-outline{fill:none;stroke:var(--ink);stroke-width:1.5;stroke-linejoin:round}
.sp-line{fill:none;stroke:var(--ink);stroke-width:.9}
.shaft{fill:var(--slab);stroke:var(--ink);stroke-width:1.5}
.hatch{fill:none;stroke:var(--ink);stroke-width:.5}
.slab{fill:var(--slab);stroke:var(--ink);stroke-width:1.5;stroke-linejoin:miter}
.solid{fill:var(--ink);stroke:var(--ink);stroke-width:.9}
.brk{fill:none;stroke:var(--ink);stroke-width:.9}
.tr-chord,.tr-web{fill:none;stroke:var(--ink);stroke-width:.9}
.bal{fill:none;stroke:var(--ink);stroke-width:.9}
.hr-band{fill:var(--slab);stroke:var(--ink);stroke-width:1.5}
.lit .hr-band{stroke-width:2.4}
.tick{stroke:var(--ink);stroke-width:.9}
.sh-rim{fill:none;stroke:var(--ink);stroke-width:1.5}
.sh-line{fill:none;stroke:var(--ink);stroke-width:.9}
.drv-body{fill:var(--slab);stroke:var(--ink);stroke-width:1.5}
.drv-line,.drv-frame,.drv-chain,.tension{fill:none;stroke:var(--ink);stroke-width:.9}
.hidden{fill:none;stroke:var(--ink);stroke-width:.9;stroke-dasharray:5 3}
.centre{fill:none;stroke:var(--ink);stroke-width:.5;stroke-dasharray:14 3 2 3}
.leader{fill:none;stroke:var(--ink);stroke-width:.5}
.ldot{fill:var(--ink)}
.label text,.ltext{font-size:${FS}px;font-weight:500}
.dim{fill:none;stroke:var(--ink);stroke-width:.5}
.dimhead{fill:var(--ink)}
.dimtext{font-size:${FS}px;font-weight:500;font-variant-numeric:tabular-nums}
.lvltext{font-size:${FS * 0.88}px;fill:var(--ink-2)!important}
.label text,.ltext,.dimtext,.lvltext,.det-tag{paint-order:stroke;stroke:var(--stage);stroke-width:32px;stroke-linejoin:round}
.detail{transition:opacity .45s ease}
.detail.off{opacity:0;visibility:hidden}.detail.dim{opacity:.35}
.det-bg{fill:var(--stage)}
.det-ring{fill:none;stroke:var(--ink);stroke-width:1.5}
.det-src{fill:none;stroke:var(--ink);stroke-width:.5}
.det-title{font-size:${FS * 0.88}px;letter-spacing:.08em;font-weight:600}
.det-tag{font-size:${FS * 1.1}px;font-weight:600}
#detLive{transition:opacity .3s ease}
.tb-frame{fill:none;stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.84}px;font-weight:600;letter-spacing:.06em}
.tb-text{font-size:${FS * 0.8}px}
.tb-key{font-size:${FS * 0.76}px}
.tb-small{font-size:${FS * 0.78}px;fill:var(--ink-2)!important}
.k-blue{stroke:var(--blue);stroke-width:1.5}.k-teal{stroke:var(--teal);stroke-width:1.5}.k-orange{stroke:var(--orange);stroke-width:1.5}
@media (prefers-reduced-motion:reduce){.part,.detail,#detLive{transition:none}}
`;

const icon = {
  prev: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h2v12H3zM14 2v12L6 8z"/></svg>`,
  next: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2h2v12h-2zM2 2v12l8-6z"/></svg>`,
  play: `<svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z"/></svg>`,
  pause: `<svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>`,
  restart: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3a5 5 0 1 1-4.9 6h1.7A3.4 3.4 0 1 0 8 4.6V7L4.5 3.8 8 .6z"/></svg>`,
};
const std = VARIANT_DATA.standard;
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escalator</title>
<style>${CSS}</style>
</head>
<body>
<div class="vz" id="vz" data-presentation="editorial" data-scene="escalator">
<article class="vz-card">
  <header class="vz-head">
    <div class="vz-heading"><h1 class="vz-title">Escalator</h1><p class="vz-about">One chain, two wheel tracks: how every step stays level on the slope.</p></div>
    <nav class="vz-chapters" aria-label="Chapters">
${STEPS.slice(1).map((s, i) => `      <button type="button"><span>${String(i + 1).padStart(2, "0")}</span> ${esc(s.tab)}</button>`).join("\n")}
    </nav>
    <div class="vz-utilities"><button class="vz-info" type="button" data-details aria-haspopup="dialog" aria-controls="details">Details</button><button class="vz-theme" id="theme" type="button">Dark</button></div>
  </header>
  <div class="vz-body" data-panels="1">
    <div class="vz-stage" id="stage" tabindex="0" role="group" aria-roledescription="step-through figure" aria-label="Escalator. Left and right arrows step through the explanation; space plays and pauses.">
      <svg id="fig" class="vz-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Side elevation of an escalator, cut away to show the step chain, the two wheel tracks, the sprockets, the drive and the handrail"></svg>
      <section class="vz-caption" aria-live="polite" aria-atomic="true"><h2 class="vz-step-heading" id="heading"></h2>
        <section class="vz-predict vz-practice" id="practice" aria-label="Now you try" hidden></section></section>
      <div class="vz-cards">
        <p class="vz-concept" id="concept">${esc(std.voice ? std.voice[0].text : std.captions[0])}</p>
        <section class="vz-predict" id="predict" aria-label="Predict the next step" hidden></section>
      </div>
    </div>
    <aside class="vz-panels" aria-label="Readouts for the followed step">
      <section class="vz-panel">
        <h3>What if</h3>
        <div class="vz-panel-body">
          <div class="vz-whatif" role="group" aria-label="Incline">${Object.entries(VARIANTS).map(([k, v]) => `<button type="button" data-variant="${k}" aria-pressed="${k === "standard"}">${esc(v.label)}</button>`).join("")}</div>
          <div class="vz-totals">
            <span><b id="r-rise">200</b> mm step rise</span>
            <span><b id="r-tilt">0.0°</b> tread tilt</span>
            <span><b id="r-height">0.00</b> m tread height</span>
            <span><b id="r-where">incline</b> orange step</span>
            <span><b id="r-speed">0.5</b> m/s</span>
            <span><b id="r-steps">53</b> steps</span>
          </div>
        </div>
      </section>
    </aside>
  </div>
  <div class="vz-controls" role="toolbar" aria-label="Playback">
    <button class="vz-btn" id="prev" type="button" aria-label="Previous step">${icon.prev}</button>
    <button class="vz-btn" id="play" type="button" aria-label="Play" data-primary data-state="play">${icon.play}${icon.pause}</button>
    <button class="vz-btn" id="next" type="button" aria-label="Next step">${icon.next}</button>
    <span class="vz-count" id="count">00 / ${String(STEPS.length - 1).padStart(2, "0")}</span>
    <div class="vz-scrub"><input class="vz-range" id="scrub" type="range" min="0" max="1" step="0.01" value="0" aria-label="Timeline of the explanation"><div id="marks"></div></div>
    <button class="vz-btn vz-try" id="try" type="button" aria-pressed="false">Now you try</button>
    <button class="vz-btn vz-voice" id="voice" type="button" aria-pressed="true" aria-label="Voice narration">Voice on</button>
    <button class="vz-btn" id="restart" type="button" aria-label="Restart">${icon.restart}</button>
  </div>
  <dialog class="vz-drawer" id="details" aria-labelledby="details-title">
    <div class="vz-drawer-head"><h2 id="details-title">Behind the figure</h2><button class="vz-info" type="button" data-details aria-label="Close details">Close ×</button></div>
    <div class="vz-drawer-body">
      <p class="vz-setup">${esc(std.captions[0])}</p>
      <h3>This step <span class="vz-count" id="d-count"></span></h3>
      <p class="vz-text" id="d-step"></p>
      <div class="vz-meta"><span class="vz-trust" title="Every position and readout is calculated by the model running on this page.">Computed live</span><span class="vz-readout">Readouts follow the orange step</span></div>
      <h3>Colour</h3>
      <ul class="vz-legend">
        <li><span class="vz-swatch" style="--tone:var(--blue)"></span>Step chain and chain-wheel track</li>
        <li><span class="vz-swatch" style="--tone:var(--teal)"></span>Trailer-wheel track</li>
        <li><span class="vz-swatch" style="--tone:var(--orange)"></span>The followed step</li>
        <li><span class="vz-swatch" style="--tone:var(--ink)"></span>Everything else, in ink</li>
      </ul>
      <h3>How it is computed</h3>
      <ul class="vz-facts">
        <li>The chain path is lines and arcs, with ${MODELS.standard.PATH.N} steps at 400 mm along it.</li>
        <li>Each step is a rigid body. The trailer-wheel track is the path the trailer wheel traces while the tread is held level; it is computed, not drawn by hand.</li>
        <li>Tests sweep the chain through a whole pitch, 5 mm at a time, for both inclines. They check that no two steps touch, that each wheel stays on its own rail, that every tread is level within 0.5° on the slope, and that the treads are flat at the landings.</li>
        <li>Step width 1000 mm (not drawn). Dimensions in mm.</li>
      </ul>
    </div>
  </dialog>
</article>
</div>
<script>
${modelSrc}
(${runtime.toString()})(${JSON.stringify(DATA)});
</script>
</body>
</html>
`;

// node examples/escalator/build.mjs [--out <file>]; the page goes to dist/escalator.html by default.
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "escalator.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
