// node explore/escalator/cutaway/build.mjs  ->  escalator-cutaway.html next to this file.
// No dependencies. The page runs the same model.mjs the tests run (inlined below).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const { P, STEP, PATH, LAND, STRUCT, DRIVE, Rs } = M;

// ---------------------------------------------------------------- helpers
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const pt = (p) => `${f1(p[0])},${f1(-p[1])}`; // world (y up) -> svg (y down)
const poly = (pts, close = true) => "M" + pts.map(pt).join("L") + (close ? "Z" : "");
const line = (a, b) => `M${pt(a)}L${pt(b)}`;
const circ = (c, r) => `M${f1(c[0] - r)},${f1(-c[1])}a${f1(r)},${f1(r)} 0 1,0 ${f1(2 * r)},0a${f1(r)},${f1(r)} 0 1,0 ${f1(-2 * r)},0Z`;
const arcPts = (c, r, a0, a1, n = 48) => M.arcPts(c, r, a0, a1, n);
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

// ---------------------------------------------------------------- frame of the drawing (mm)
const VB = { x0: -2450, x1: 11750, y0: -1700, y1: 4850 };
const viewBox = `${VB.x0} ${-VB.y1} ${VB.x1 - VB.x0} ${VB.y1 - VB.y0}`;
const FS = 128; // label font size in mm (about 12.5 px at 1440 wide)

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
  const upper = [[7400, 1380], [pitWall, 1380], [pitWall, ffl1], [VB.x1, ffl1], [VB.x1, ffl1 - th], [pitWall + th, ffl1 - th], [pitWall + th, 1130], [7400, 1130]];
  return { lower, upper, bedTop, xBedTop, pitWall, ffl0, ffl1, th };
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
const chainLoop = M.sampleLocus((s) => M.chainPoint(s), PATH, 12);
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
  const k = 2.6, R = 1450;
  const sIn = PATH.by.incline.s0 + 1560;
  const c0 = M.chainPoint(sIn);
  const src = [c0[0] - 40, c0[1] + 225];
  const at = [930, 3360];
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
const RC = 10080; // right column, above the upper floor
const LABELS = [
  // beat 1: the loop
  { id: "dchain", text: "Drive chain", at: [RC, 4600], to: DRV.chain[0][0].map((v, i) => (v + DRV.chain[0][1][i]) / 2), beats: [1] },
  { id: "gear", text: "Gearbox", at: [RC, 4370], to: [DRV.G[0] + 120, DRV.G[1] + 330], beats: [1] },
  { id: "motor", text: "Drive motor", at: [RC, 4140], to: [DRV.G[0] + 720, DRV.yW + 190], beats: [1, 5] },
  { id: "chain", text: "Step chain", at: [6700, 560], to: null, beats: [1] },
  { id: "dsprocket", text: "Drive sprocket", at: [7600, 900], to: [xS - Rs * 0.5, yS - Rs * 0.87], beats: [1], anchor: "end" },
  { id: "truss", text: "Truss", at: [-2380, -1250], to: null, beats: [1] },
  { id: "tsprocket", text: "Tension sprocket", at: [-2380, -760], to: [-Rs * 0.7, -Rs - Rs * 0.72], beats: [1, 4] },
  // beat 3: the landing
  { id: "converge", text: "Tracks converge", at: [7100, 4700], to: null, beats: [3], anchor: "end" },

  // beat 4: turn and return

  { id: "inverted", text: "Return run, steps upside down", at: [6700, 560], to: null, beats: [4] },
  // beat 5: the handrail
  { id: "balustrade", text: "Balustrade", at: [3600, 4300], to: null, beats: [5], anchor: "end" },
  { id: "handrail", text: "Handrail", at: [3600, 3990], to: null, beats: [5], anchor: "end" },
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
  L.converge.to = passRailAt(tp, 7330);
  // an inverted step on the return incline: its tread underside
  const sRet = retInc.s0 + 2400;
  const pose = M.stepPose(sRet);
  L.inverted.to = M.toWorld(pose, [-150, t - 4]);
  L.handrail.to = [4250, yOn(HR.outer.filter((p, i) => i < HR.loop.length / 2), 4250) - 2];
  L.balustrade.to = [4750, yOn(profile(640), 4750)];
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
  // rise 3000, at the left edge, between the two finished floor levels
  const xd = -2160;
  const y0 = LAND.fflLow, y1 = LAND.fflUp;
  s += `<path class="dim" d="${line([xd, y0 + 4], [xd, y1 - 4])}${line([xd - 160, y1], [-1500, y1])}"/>`;
  s += `<path class="dimhead" d="${arrow([xd, y1], [0, 1])}${arrow([xd, y0], [0, -1])}"/>`;
  s += `<text class="dimtext" transform="translate(${f1(xd - 50)},${f1(-(y0 + y1) / 2)}) rotate(-90)" text-anchor="middle">3000 rise</text>`;
  // level marks
  const level = (x, y, txt, anchor = "start") =>
    `<path class="dim" d="M${pt([x - 55, y + 95])}L${pt([x + 55, y + 95])}L${pt([x, y])}Z"/>` +
    `<text class="lvltext" x="${f1(x + (anchor === "start" ? 110 : -110))}" y="${f1(-(y + 40))}" text-anchor="${anchor}">${txt}</text>`;
  s += level(-1700, y0, "±0 lower floor");
  s += level(-1900, y1, "+3000 upper floor");
  s += level(11520, y1, "+3000", "end");
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
  s += `<text class="dimtext" x="${f1(tp[0])}" y="${f1(-tp[1] + 45)}" text-anchor="end">30°</text>`;
  return s;
}
function titleBlock() {
  const x0 = 6900, x1 = VB.x1 - 60, y1 = -170, y0 = -1640;
  let s = `<g class="tblock"><path class="tb-frame" d="${poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])}"/>`;
  s += `<path class="tb-rule" d="${line([x0, y1 - 400], [x1, y1 - 400])}${line([x0, y1 - 1080], [x1, y1 - 1080])}"/>`;
  s += `<text class="tb-title" x="${x0 + 110}" y="${-(y1 - 260)}">ESCALATOR · SIDE ELEVATION, CUTAWAY</text>`;
  s += `<text class="tb-small" x="${x1 - 110}" y="${-(y1 - 260)}" text-anchor="end">dimensions in mm</text>`;
  const facts = [
    `Rise 3000 · incline 30° · step pitch 400 · step rise 400 sin 30° = 200 · going 346.4`,
    `${PATH.N} steps · step width 1000 (not drawn) · steps and handrail at 0.5 m/s`,
    `Sprockets ${P.teeth} T, pitch Ø ${(2 * Rs).toFixed(0)} · main shaft ${DRIVE.shaftRpm.toFixed(2)} rpm · near-side truss removed`,
  ];
  facts.forEach((txt, i) => (s += `<text class="tb-text" x="${x0 + 110}" y="${-(y1 - 600 - i * 200)}">${esc(txt)}</text>`));
  const key = [["k-blue", "Step chain and chain-wheel track"], ["k-teal", "Trailer-wheel track"], ["k-orange", "Followed step"]];
  s += `<g id="tbkey" data-x0="${x0 + 110}" data-x1="${x1 - 110}">`;
  for (const [cls, txt] of key) s += `<g class="tbk"><path class="${cls}" d="M0,${-(y1 - 1290)}h260"/><text class="tb-text" x="0" y="${-(y1 - 1330)}">${txt}</text></g>`;
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
  S.push(`<g class="part" data-part="wheels" id="wheels"></g>`);
  S.push(`<g class="part" data-part="handrail"><path class="hr-band" d="${poly(HR.outer)}${poly(HR.inner)}" fill-rule="evenodd"/><g id="hrticks"></g>` +
    `<g id="sheaveU" transform="translate(${f1(HR.Cu[0])},${f1(-HR.Cu[1])})"><g class="rot"><use href="#sheave"/></g></g>` +
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
    `<path class="brk" d="${breakLine(VB.x0 + 2, BLD.ffl0 - BLD.th, BLD.ffl0)}${breakLine(VB.x1 - 2, BLD.ffl0 - BLD.th, BLD.ffl0)}${breakLine(VB.x1 - 2, BLD.ffl1 - BLD.th, BLD.ffl1)}"/></g>`);
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
${d.id === "A" ? `<rect id="detailFrame" x="${f1(-2450)}" y="${f1(-(at[1] + R + 60))}" width="${f1(at[0] + R + 2250 + 2450)}" height="${f1(2 * R + 420)}" fill="none" stroke="none"/>` : ""}
<text class="det-title" x="${f1(at[0])}" y="${f1(-(at[1] - R - 230))}" text-anchor="middle">DETAIL ${d.id}  ·  ${k} : 1${d.title ? `  ·  ${d.title.toUpperCase()}` : ""}</text>
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
    return one("dct", "Chain-wheel track", [2600, 2960], blue, "start", 2) + one("dtt", "Trailer-wheel track", [-720, 2380], teal, "end", 2);
  }
  if (d.id === "B") {
    const comb = toD(d, [LAND.combUp + 80, LAND.treadUp + 18]);
    const plate = toD(d, [LAND.combUp + 330, LAND.fflUp - 7]);
    const blue = toD(d, [LAND.combUp - 300, yOn(RAILS.chain.pass, LAND.combUp - 300)]);
    const teal = toD(d, [LAND.combUp - 520, yOn(RAILS.trailer.pass, LAND.combUp - 520)]);
    return one("bcomb", "Comb plate", [2600, 2640], comb, "start", 3) + one("bplate", "Landing floor plate", [2600, 2960], plate, "start", 3) +
      one("btt", "Trailer-wheel track", [-720, 2700], teal, "end", 3) + one("bct", "Chain-wheel track", [-720, 2380], blue, "end", 3);
  }
  const sp = toD(d, [xS - Rs * 0.2, yS - Rs * 1.08]);
  const upOut = RAILS.trailer.upOut;
  const g = toD(d, upOut.reduce((m, p) => (p[0] > m[0] ? p : m), upOut[0]));
  const shaft = toD(d, [xS - 60, yS + 70]);
  return one("csp", "Drive sprocket", [-720, 2380], sp, "end", 4) + one("cguide", "Trailer-wheel guide", [2600, 2640], g, "start", 4) +
    one("cshaft", "Main shaft (cut)", [-720, 2700], shaft, "end", 4);
}

const SVG = `<svg id="fig" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Side elevation of an escalator, cut away to show the step chain, the two wheel tracks, the sprockets, the drive and the handrail">
${defs()}
<g id="scene">
${scene()}
</g>
<g id="dims" class="part" data-part="dims">${dims()}</g>
<g id="labels">${LABELS.map(labelSvg).join("")}</g>
${DETAILS.map(detailGroup).join("\n")}
${titleBlock()}
</svg>`;

// ---------------------------------------------------------------- story
const sIn = DET.sIn;
const BEATS = [
  { tab: "The loop", from: 19900, pose: 800, focus: ["chain", "sprockets", "drive"],
    cap: "An endless chain carries the steps around a closed loop, and a motor turns the top sprocket that pulls it." },
  { tab: "Two wheels, two tracks", from: 2000, pose: sIn, focus: ["steps", "wheels", "chaintrack", "trailertrack"],
    cap: "Each step rides on a chain wheel and a trailer wheel running on separate tracks, and the offset between them keeps the tread level on the slope." },
  { tab: "The landing", from: 6200, pose: 9150, focus: ["steps", "wheels", "chaintrack", "trailertrack", "landing"],
    cap: "Near the top the two tracks come together, so the steps flatten into a walkway and slide under the comb plate." },
  { tab: "Turn and return", from: 9500, pose: 10066, focus: ["steps", "wheels", "chaintrack", "trailertrack", "chain", "sprockets"],
    cap: "Around the drive sprocket the steps turn over and travel back underneath, upside down." },
  { tab: "The handrail", from: 13200, pose: 15500, focus: ["handrail", "hrdrive", "balustrade", "drive"],
    cap: "The handrail is a separate loop driven from the same main shaft, so it moves at the same 0.5 m/s as the steps." },
];
const S_START = BEATS[0].from;
const tauOf = (s) => (((s - S_START) % PATH.L) + PATH.L) % PATH.L / P.speed;
const focusCss = BEATS.map((b, i) => b.focus.map((p) => `#fig[data-beat="${i + 1}"] .part[data-part="${p}"]`).join(",\n") + "{opacity:1}").join("\n");

// handrail loop, decimated for the runtime
const hrPts = [], hrCum = [];
for (let i = 0; i < HR.loop.length; i += 1) (hrPts.push(HR.loop[i].map((v) => +v.toFixed(1))), hrCum.push(+HR.cum[i].toFixed(1)));

const DATA = {
  N: PATH.N, L: PATH.L, pitch: P.pitch, links: P.links, speed: P.speed, Rs,
  sUp0: PATH.by["upper turn"].s0, sLow0: PATH.by["lower turn"].s0,
  T: PATH.L / P.speed,
  beats: BEATS.map((b) => ({ from: tauOf(b.from), pose: tauOf(b.pose), cap: b.cap, focus: b.focus })),
  det: { at: DET.at, src: DET.src, k: DET.k, r: DET.r, R: DET.R },
  hr: { pts: hrPts, cum: hrCum, len: +HR.length.toFixed(1), band: HR.band, rN: HR.rN },
  rc, rt, t, f, FS,
};

// ---------------------------------------------------------------- runtime (runs in the page)
function runtime(D) {
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const fig = $("fig");
  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const DEGR = 180 / Math.PI;
  const fx = (v) => v.toFixed(1);
  // dynamic parts
  const stepEls = [], wcEls = [], wtEls = [], pinEls = [], tickEls = [];
  for (let i = D.N - 1; i >= 0; i--) {
    stepEls[i] = mk("use", { href: "#stepSym", class: i === 0 ? "step followed" : "step" }, $("steps"));
  }
  for (let i = D.N - 1; i >= 0; i--) {
    wtEls[i] = mk("use", { href: "#wheelT", class: i === 0 ? "followed" : "" }, $("wheels"));
    wcEls[i] = mk("use", { href: "#wheelC", class: i === 0 ? "followed" : "" }, $("wheels"));
  }
  for (let k = 0; k < D.N * D.links; k++) if (k % D.links) pinEls.push([k, mk("circle", { class: "pin", r: 13 }, $("pins"))]);
  const TICK = 300, nTicks = Math.floor(D.hr.len / TICK), tickGap = D.hr.len / nTicks;
  for (let j = 0; j < nTicks; j++) tickEls.push(mk("path", { class: "tick" }, $("hrticks")));
  const rotUp = document.querySelector("#spUp .rot"), rotLow = document.querySelector("#spLow .rot");
  const shU = document.querySelector("#sheaveU .rot"), shL = document.querySelector("#sheaveL .rot");
  const live = $("detLive");

  function hrAt(u) {
    const c = D.hr.cum, p = D.hr.pts;
    u = ((u % D.hr.len) + D.hr.len) % D.hr.len;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] <= u) lo = m;
      else hi = m;
    }
    const a = p[lo], b = p[(lo + 1) % p.length];
    const seg = (c[lo + 1] ?? D.hr.len) - c[lo] || 1;
    const w = (u - c[lo]) / seg;
    const tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
    return [a[0] + w * tx, a[1] + w * ty, ty / m, -tx / m];
  }
  const A = (p) => [D.det.at[0] + D.det.k * (p[0] - D.det.src[0]), D.det.at[1] + D.det.k * (p[1] - D.det.src[1])];
  const P2 = (p) => `${fx(p[0])},${fx(-p[1])}`;

  function render(travel) {
    for (let i = 0; i < D.N; i++) {
      const s = travel - i * D.pitch;
      const p = stepPose(s);
      const tr = `translate(${fx(p.x)},${fx(-p.y)})`;
      stepEls[i].setAttribute("transform", `${tr} rotate(${(-p.phi * DEGR).toFixed(2)})`);
      wcEls[i].setAttribute("transform", `${tr} rotate(${((s / D.rc) * DEGR % 360).toFixed(1)})`);
      const q = toWorld(p, STEP.T);
      wtEls[i].setAttribute("transform", `translate(${fx(q[0])},${fx(-q[1])}) rotate(${((s / D.rt) * DEGR % 360).toFixed(1)})`);
    }
    const lp = D.pitch / D.links;
    for (const [k, el] of pinEls) {
      const c = chainPoint(travel - k * lp);
      el.setAttribute("cx", fx(c[0]));
      el.setAttribute("cy", fx(-c[1]));
    }
    rotUp.setAttribute("transform", `rotate(${(-90 + ((travel - D.sUp0) / D.Rs) * DEGR).toFixed(2)})`);
    rotLow.setAttribute("transform", `rotate(${(90 + ((travel - D.sLow0) / D.Rs) * DEGR).toFixed(2)})`);
    const hrRot = `rotate(${(((travel / D.hr.rN) * DEGR) % 360).toFixed(2)})`;
    shU.setAttribute("transform", hrRot);
    shL.setAttribute("transform", hrRot);
    const b = D.hr.band - 4;
    for (let j = 0; j < nTicks; j++) {
      const [x, y, nx, ny] = hrAt(travel + j * tickGap);
      tickEls[j].setAttribute("d", `M${fx(x - nx * b)},${fx(-(y - ny * b))}L${fx(x + nx * b)},${fx(-(y + ny * b))}`);
    }
    // Detail A: name the followed step's wheels and dimension its rise while it is in view
    // the followed step while it is in the window; when paused, whichever step sits in the window
    let i0 = 0, best = Infinity;
    for (let i = 0; i < D.N; i++) {
      const q = stepPose(travel - i * D.pitch);
      const d = Math.hypot(q.x + 40 - D.det.src[0], q.y + 225 - D.det.src[1]);
      if (d < best) (best = d), (i0 = i);
    }
    const p0 = stepPose(travel - i0 * D.pitch);
    const onIncline = Math.abs(stepPose(travel - (i0 - 1) * D.pitch).y - p0.y - 200) < 0.5;
    const inView = best < D.det.r * 0.5 && onIncline && (i0 === 0 || !state.playing);
    live.style.opacity = inView ? 1 : 0;
    if (inView) {
      const p1 = stepPose(travel - (i0 - 1) * D.pitch); // the step ahead, one riser higher
      const c = A([p0.x, p0.y]), tw = A(toWorld(p0, STEP.T));
      const nose0 = A([p0.x + D.f, p0.y + D.t]), nose1 = A([p1.x + D.f, p1.y + D.t]);
      const back0 = A([p0.x + D.f - 392, p0.y + D.t]);
      const xd = back0[0] - 170;
      const R = D.det.R, at = D.det.at;
      const lab = (txt, to, tx, ty, anchor) => {
        const dir = anchor === "end" ? 1 : -1;
        const a1 = [tx + dir * 50, ty + D.FS * 0.33], e1 = [a1[0] + dir * 110, a1[1]];
        return `<path class="leader" d="M${P2(a1)}L${P2(e1)}L${P2(to)}"/><circle class="ldot" cx="${fx(to[0])}" cy="${fx(-to[1])}" r="26"/><text class="ltext" x="${fx(tx)}" y="${fx(-ty)}" text-anchor="${anchor}">${txt}</text>`;
      };
      const yA = nose1[1], yB = nose0[1];
      let s = `<g clip-path="url(#clipA)">`;
      s += `<path class="dim" d="M${P2([back0[0] - 40, yB])}L${P2([xd - 110, yB])}M${P2([nose1[0] - 392 * D.det.k - 40, yA])}L${P2([xd - 110, yA])}M${P2([xd, yB + 4])}L${P2([xd, yA - 4])}"/>`;
      s += `<path class="dimhead" d="${arrowD([xd, yA], [0, 1])}${arrowD([xd, yB], [0, -1])}"/>`;
      s += `<text class="dimtext" x="${fx(xd + 60)}" y="${fx(-(yA + yB) / 2 + 45)}">200</text>`;
      const yg = yA + 240;
      s += `<path class="dim" d="M${P2([nose0[0], yB + 40])}L${P2([nose0[0], yg + 90])}M${P2([nose1[0], yA + 40])}L${P2([nose1[0], yg + 90])}M${P2([nose0[0] + 4, yg])}L${P2([nose1[0] - 4, yg])}"/>`;
      s += `<path class="dimhead" d="${arrowD([nose0[0], yg], [-1, 0])}${arrowD([nose1[0], yg], [1, 0])}"/>`;
      s += `<text class="dimtext" x="${fx((nose0[0] + nose1[0]) / 2)}" y="${fx(-(yg + 50))}" text-anchor="middle">346</text></g>`;
      if (state.beat === 2 && i0 === 0) s += lab("Chain wheel", [c[0] + D.rc * 0.5 * D.det.k, c[1] - D.rc * 0.6 * D.det.k], 2600, 2640, "start");
      if (state.beat === 2 && i0 === 0) s += lab("Trailer wheel", [tw[0] - D.rt * 0.55 * D.det.k, tw[1] - D.rt * 0.6 * D.det.k], -720, 2700, "end");
      live.innerHTML = s;
    }
  }
  function arrowD(at, dir) {
    const L = 95, W = 26, b = [at[0] - dir[0] * L, at[1] - dir[1] * L], n = [-dir[1], dir[0]];
    return `M${P2(at)}L${P2([b[0] + n[0] * W, b[1] + n[1] * W])}L${P2([b[0] - n[0] * W, b[1] - n[1] * W])}Z`;
  }

  // ------------------------------------------------ story state and controls
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { tau: 0, playing: !reduced, beat: 1, last: 0 };
  const tabs = [...document.querySelectorAll(".tab")];
  const labels = [...document.querySelectorAll("#fig .label")];
  const parts = [...document.querySelectorAll("#scene .part")];
  const details = [...document.querySelectorAll("#fig .detail")];
  // leaders: from the measured text box to the dot on the part
  for (const g of labels) {
    const bb = g.querySelector("text").getBBox();
    const [tx, ty] = g.dataset.to.split(",").map(Number);
    const cy = bb.y + bb.height * 0.56;
    const right = tx > bb.x + bb.width / 2;
    const ax = right ? bb.x + bb.width + 45 : bb.x - 45, ex = ax + (right ? 110 : -110);
    g.querySelector(".leader").setAttribute("d", `M${fx(ax)},${fx(cy)}L${fx(ex)},${fx(cy)}L${fx(tx)},${fx(ty)}`);
  }
  {
    const key = $("tbkey");
    let x = +key.dataset.x0;
    for (const g of key.querySelectorAll(".tbk")) {
      const t = g.querySelector("text");
      t.setAttribute("x", "330");
      g.setAttribute("transform", `translate(${fx(x)},0)`);
      x += 330 + t.getComputedTextLength() + 210;
    }
  }
  const scrub = $("scrub"), playBtn = $("play"), count = $("count"), cap = $("cap");
  const beatAt = (tau) => {
    let k = 1;
    D.beats.forEach((b, i) => (tau >= b.from - 1e-6 ? (k = i + 1) : 0));
    return k;
  };
  function setBeat(k) {
    if (k === state.beat && fig.dataset.beat) return;
    state.beat = k;
    fig.dataset.beat = String(k);
    tabs.forEach((t, i) => t.setAttribute("aria-selected", String(i + 1 === k)));
    cap.textContent = D.beats[k - 1].cap;
    count.textContent = `${k} / ${D.beats.length}`;
    for (const l of labels) l.style.display = l.dataset.beats.split(" ").includes(String(k)) ? "" : "none";
    for (const g of details) {
      const full = g.dataset.full.split(" ").includes(String(k)), dim = g.dataset.dim.split(" ").includes(String(k));
      g.classList.toggle("dim", dim && !full);
      g.classList.toggle("off", !full && !dim);
    }
    const focus = D.beats[k - 1].focus;
    for (const el of parts) el.style.opacity = focus.includes(el.dataset.part) ? "1" : "0.35";
  }
  function draw() {
    render(D.beats[0] ? (state.tau * D.speed + startS) : 0);
    scrub.value = String(state.tau);
  }
  const startS = __S_START__;
  function seekTau(tau, beat) {
    state.tau = ((tau % D.T) + D.T) % D.T;
    setBeat(beat ?? beatAt(state.tau));
    draw();
  }
  // Paused (and reduced motion, and screenshots): jump to the beat's key pose.
  // Playing: start at the beginning of the beat so it plays out in full.
  function seekBeat(k) {
    k = Math.max(1, Math.min(D.beats.length, k));
    const b = D.beats[k - 1];
    seekTau(state.playing && !reduced ? b.from + 0.01 : b.pose, k);
  }
  function setPlaying(on) {
    state.playing = on;
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    playBtn.dataset.state = on ? "pause" : "play";
    if (on && !reduced) {
      state.last = performance.now();
      requestAnimationFrame(tick);
    }
  }
  let reducedTimer = null;
  function tick(now) {
    if (!state.playing || reduced) return;
    const dt = Math.min(0.1, (now - state.last) / 1000);
    state.last = now;
    state.tau = (state.tau + dt) % D.T;
    setBeat(beatAt(state.tau));
    draw();
    requestAnimationFrame(tick);
  }
  playBtn.addEventListener("click", () => {
    if (reduced) {
      if (reducedTimer) (clearInterval(reducedTimer), (reducedTimer = null), setPlaying(false));
      else (setPlaying(true), (reducedTimer = setInterval(() => seekBeat((state.beat % D.beats.length) + 1), 4000)));
      return;
    }
    setPlaying(!state.playing);
  });
  $("prev").addEventListener("click", () => seekBeat(state.beat - 1));
  $("next").addEventListener("click", () => seekBeat(state.beat + 1));
  tabs.forEach((t, i) => t.addEventListener("click", () => seekBeat(i + 1)));
  scrub.max = String(D.T);
  scrub.addEventListener("input", () => seekTau(+scrub.value));
  addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT" && e.key !== " ") return;
    if (e.key === "ArrowRight") (seekBeat(state.beat + 1), e.preventDefault());
    else if (e.key === "ArrowLeft") (seekBeat(state.beat - 1), e.preventDefault());
    else if (e.key === " ") (playBtn.click(), e.preventDefault());
  });
  // theme: follow the system until the toggle is used
  const themeBtn = $("theme");
  const sysDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const applyTheme = (th) => {
    document.documentElement.dataset.theme = th;
    themeBtn.textContent = th === "dark" ? "Light" : "Dark";
    themeBtn.setAttribute("aria-label", `Switch to ${th === "dark" ? "light" : "dark"} theme`);
  };
  applyTheme(sysDark ? "dark" : "light");
  themeBtn.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  // beat marks under the scrubber
  const marks = $("marks");
  D.beats.forEach((b) => {
    const m = document.createElement("span");
    m.style.left = `${(b.from / D.T) * 100}%`;
    marks.appendChild(m);
  });

  seekTau(0, 1);
  setPlaying(state.playing);
  window.__viz = {
    beats: D.beats.length,
    seekStep(k) {
      fig.classList.add("instant");
      setPlaying(false);
      seekBeat(Number(k) || 1);
    },
    seek(ms) {
      fig.classList.add("instant");
      setPlaying(false);
      seekTau(Number(ms) / 1000);
    },
    state: () => ({ ...state }),
  };
}

// ---------------------------------------------------------------- page
const font = readFileSync(join(ROOT, "src/render/fonts/playfair-display-sc-latin-700.woff2")).toString("base64");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const CSS = `
@font-face{font-family:"Playfair Display SC";font-weight:700;font-style:normal;font-display:block;src:url(data:font/woff2;base64,${font}) format("woff2")}
:root{--paper:#f6f4ee;--ink:#1d232b;--step:#ebe7dd;--slab:#ffffff;--blue:#2563eb;--teal:#0f9488;--orange:#e4572e;--orange-tint:#f6dccf;
  --muted:color-mix(in srgb,var(--ink) 64%,var(--paper));--rule:color-mix(in srgb,var(--ink) 20%,var(--paper));color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#121417;--ink:#e2dfd6;--step:#1e2227;--slab:#16191d;--orange-tint:#3a2219;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#121417;--ink:#e2dfd6;--step:#1e2227;--slab:#16191d;--orange-tint:#3a2219;color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;overflow:hidden;-webkit-font-smoothing:antialiased}
header{display:flex;align-items:flex-end;justify-content:space-between;padding:16px 28px 10px}
h1{font-family:"Playfair Display SC",Georgia,serif;font-weight:700;font-size:31px;line-height:1;margin:0;letter-spacing:.01em}
.sub{margin:6px 0 0;font-size:13.5px;color:var(--muted)}
.btn{height:30px;min-width:32px;padding:0 10px;border:1px solid var(--rule);background:transparent;color:var(--ink);font:500 12.5px system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;border-radius:0}
.btn:hover{border-color:var(--ink)}
.btn:focus-visible,.tab:focus-visible,input:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.btn svg{width:12px;height:12px;fill:currentColor}
nav{display:flex;padding:0 28px;border-bottom:1px solid var(--rule)}
.tab{appearance:none;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 14px 8px 0;margin-right:22px;font:500 13px system-ui,sans-serif;color:var(--muted);cursor:pointer}
.tab .n{font-variant-numeric:tabular-nums;margin-right:7px}
.tab[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--ink)}
.tab:hover{color:var(--ink)}
main{margin:14px 28px 0;border:1px solid var(--rule);display:flex;flex-direction:column;min-height:0}
#cap{margin:0;padding:12px 18px 0;font-size:14.5px;line-height:1.4;min-height:2.6em;max-width:92ch}
#fig{flex:1;min-height:0;width:100%;display:block;padding:2px 12px 10px}
footer{display:flex;align-items:center;gap:8px;padding:12px 28px 16px}
#play[data-state="play"] .i-pause,#play[data-state="pause"] .i-play{display:none}
.scrub{position:relative;flex:1;margin:0 10px;display:flex;align-items:center}
.scrub input{width:100%;accent-color:var(--ink);margin:0;height:20px;background:transparent}
#marks{position:absolute;left:8px;right:8px;top:21px;height:5px;pointer-events:none}
#marks span{position:absolute;top:0;width:1px;height:5px;background:var(--muted)}
#count{font:500 12.5px system-ui,sans-serif;font-variant-numeric:tabular-nums;color:var(--muted);min-width:5ch;text-align:right}
.rate{font-size:12.5px;color:var(--muted);margin-left:8px;white-space:nowrap}
/* drawing */
path,circle,rect,line,polyline,polygon,ellipse{vector-effect:non-scaling-stroke}
#fig{shape-rendering:geometricPrecision}
text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;fill:var(--ink)}
.part{transition:opacity .45s ease}
#fig.instant .part,#fig.instant .detail,#fig.instant #detLive{transition:none}
/* overview vs Detail A: the overview sets --fine on the real #scene; the magnified clone never matches
   "#fig > #scene", so it inherits nothing and shows the fine detail */
#fig > #scene{--fine:none}
.fine,.st-web,.wh-tyre{display:var(--fine,inline)}
.step{--sink:var(--ink);--sfill:var(--step)}
.followed{--sink:var(--orange);--sfill:var(--orange-tint)}
.st-body{fill:var(--sfill);stroke:var(--sink);stroke-width:1.5;stroke-linejoin:round}
.st-web{fill:var(--paper);stroke:var(--sink);stroke-width:.9}
.st-line{fill:none;stroke:var(--sink,var(--ink));stroke-width:.9}
.st-fine{fill:none;stroke:var(--sink);stroke-width:.5}
.wh-rim{fill:var(--paper);stroke:var(--sink,var(--ink));stroke-width:1.5}
.wh-tyre{fill:none;stroke:var(--sink,var(--ink));stroke-width:.5}
.wh-hub{fill:var(--sink,var(--ink))}
.wh-mark{stroke:var(--sink,var(--ink));stroke-width:.9}
.rail-blue{fill:none;stroke:var(--blue);stroke-width:1.5}
.rail-teal{fill:none;stroke:var(--teal);stroke-width:1.5}
.chain-band{fill:none;stroke:var(--blue);stroke-width:.9}
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
.tick{stroke:var(--ink);stroke-width:.9}
.sh-rim{fill:none;stroke:var(--ink);stroke-width:1.5}
.sh-line{fill:none;stroke:var(--ink);stroke-width:.9}
.drv-body{fill:var(--slab);stroke:var(--ink);stroke-width:1.5}
.drv-line,.drv-frame{fill:none;stroke:var(--ink);stroke-width:.9}
.drv-chain{fill:none;stroke:var(--ink);stroke-width:.9}
.hidden{fill:none;stroke:var(--ink);stroke-width:.9;stroke-dasharray:5 3}
.centre{fill:none;stroke:var(--ink);stroke-width:.5;stroke-dasharray:14 3 2 3}
.tension{fill:none;stroke:var(--ink);stroke-width:.9}
.leader{fill:none;stroke:var(--ink);stroke-width:.5}
.ldot{fill:var(--ink)}
.label text,.ltext{font-size:${FS}px}
.label text,.ltext,.dimtext,.lvltext,.det-tag{paint-order:stroke;stroke:var(--paper);stroke-width:32px;stroke-linejoin:round}
.dim{fill:none;stroke:var(--ink);stroke-width:.5}
.dimhead{fill:var(--ink)}
.dimtext{font-size:${FS}px;font-variant-numeric:tabular-nums}
.lvltext{font-size:${FS * 0.9}px;fill:var(--muted)!important}
.detail{transition:opacity .45s ease}
.detail.off{opacity:0;visibility:hidden}.detail.dim{opacity:.35}
.det-bg{fill:var(--paper)}
.det-ring{fill:none;stroke:var(--ink);stroke-width:1.5}
.det-src{fill:none;stroke:var(--ink);stroke-width:.5}
.det-title{font-size:${FS * 0.95}px;letter-spacing:.08em;font-weight:600}
.det-tag{font-size:${FS * 1.15}px;font-weight:600}
#detLive{transition:opacity .3s ease}
.tb-frame{fill:none;stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.9}px;font-weight:600;letter-spacing:.06em}
.tb-text{font-size:${FS * 0.88}px}
.tb-small{font-size:${FS * 0.85}px;fill:var(--muted)!important}
.k-blue{stroke:var(--blue);stroke-width:1.5}.k-teal{stroke:var(--teal);stroke-width:1.5}.k-orange{stroke:var(--orange);stroke-width:1.5}
@media (prefers-reduced-motion:reduce){.part,.detail,#detLive{transition:none}}
`;

const icon = {
  prev: `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h1.6v10H2zM10.5 1v10L4.2 6z"/></svg>`,
  next: `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M8.4 1H10v10H8.4zM1.5 1v10L7.8 6z"/></svg>`,
  play: `<svg class="i-play" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1v10l8-5z"/></svg>`,
  pause: `<svg class="i-pause" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h3v10H2zM7 1h3v10H7z"/></svg>`,
};

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escalator</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <div><h1>Escalator</h1><p class="sub">One chain, two wheel tracks and a handrail, drawn to scale: a 3000 mm rise at 30°, every step level at 0.5 m/s.</p></div>
  <button class="btn" id="theme" type="button">Dark</button>
</header>
<nav role="tablist" aria-label="Chapters">
${BEATS.map((b, i) => `  <button class="tab" role="tab" type="button" aria-selected="${i === 0}"><span class="n">${i + 1}</span>${esc(b.tab)}</button>`).join("\n")}
</nav>
<main>
  <p id="cap" aria-live="polite"></p>
  ${SVG}
</main>
<footer>
  <button class="btn" id="prev" type="button" aria-label="Previous chapter">${icon.prev}</button>
  <button class="btn" id="play" type="button" aria-label="Pause" data-state="pause">${icon.play}${icon.pause}</button>
  <button class="btn" id="next" type="button" aria-label="Next chapter">${icon.next}</button>
  <div class="scrub"><input id="scrub" type="range" min="0" max="1" step="0.01" value="0" aria-label="Position of the followed step around the loop"><div id="marks"></div></div>
  <span id="count">1 / 5</span><span class="rate">chain 0.5 m/s</span>
</footer>
<script>
${modelSrc}
(${runtime.toString().replace("__S_START__", String(S_START))})(${JSON.stringify(DATA)});
</script>
</body>
</html>
`;

const out = join(HERE, "escalator-cutaway.html");
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024).toFixed(0)} KB)`);
