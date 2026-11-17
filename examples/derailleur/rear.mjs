// View A: the derailleur straight from behind, a true rear elevation (orthographic, azimuth 180°,
// elevation 0), drawn the way a mechanic's diagram draws it.
//
// From straight behind, every part of the story only slides sideways or up and down: a cog is a
// thin bar as tall as its diameter and as wide as its thickness, at its lateral position; the guide
// pulley is a bar under the cog it serves; the chain is a ladder of links running down from its cog
// to the pulleys. So every part is drawn once, by the rig, and each frame only moves it: no angle
// bins, and nothing seen edge-on. Two dashed centrelines, the cog's and the guide pulley's, show the
// alignment the story is about, and when they differ the gap between them is written in mm, from
// the model.
//
//   const R = rearView(M, { scale })   // once per variant
//   R.parts                            // drawings put in the page once
//   R.pose(state)                      // each frame: { items, at, focus } (focus: what the window follows)
//
// The screen position of a world point comes from the rig's own camera at VIEW_A, not a formula of
// this file's: the tests hold the camera to 180° and 0°, and each cog's bar to the model's lateral
// position.

import { drawMesh, plate, planeOf, screenOf, turned, axesOf } from "../../src/rig/index.ts";
import { pathAt } from "./model.mjs";

export const VIEW_A = { azimuth: 180, elevation: 0 };
const W = (x, y, e) => [x, -e, y]; // as figure.mjs: x forward, y up, e lateral (outboard +)
const LAT = [0, -1, 0]; // outboard
const COG_T = 1.8, RIM_T = 2.6, HUB_W = 7, HUB_R = 8.5, PLATE_T = 1.6, PLATE_GAP = 5.2;
const f1 = (v) => (Math.round(v * 10) / 10).toString();

export function rearView(M, { scale: s, prefix = "a" }) {
  const cam = { azimuth: VIEW_A.azimuth, elevation: VIEW_A.elevation, scale: s, origin: [0, 0] }, ax = axesOf(cam.azimuth, cam.elevation);
  const at = (y, e) => screenOf(cam, W(0, y, e), ax); // x (fore and aft) does not show from behind
  const D = M.D, r = M.r, tip = D.tipAdd;
  const parts = [];
  const id = (n) => `${prefix}-${n}`;
  const once = (n, part, svg) => parts.push({ id: id(n), part, svg });
  // a part turned about a lateral axis, centred on lateral 0, at the origin
  const disk = (profile, material, shine = true) => drawMesh(turned(W(0, 0, 0), LAT, profile, 48, [1, 0, 0]), cam, { material, shine });
  const centred = (w, rad) => [[-w / 2, rad], [w / 2, rad]];
  // a box: fore-aft depth d, height h (from y0 down), lateral thickness t centred on 0
  const box = (d, y0, h, t, material) => drawMesh(plate(planeOf(W(0, 0, -t / 2), LAT, [1, 0, 0]), { outer: [[-d / 2, y0], [d / 2, y0], [d / 2, y0 - h], [-d / 2, y0 - h]] }, 0, t), cam, { material });

  // ---- context, in place: the frame's dropout and the axle outboard, the hub, the spokes inboard
  const eDrop = D.dropoutGap + 3, ySpan = 160;
  const drop = at(0, eDrop), axle0 = at(0, eDrop + 6), axle1 = at(0, -M.zMax - D.spokeGap - 6);
  once("frame", "context", `<g class="rv-frame">` +
    `<rect x="${f1(drop[0] - 2.5 * s)}" y="${f1(-ySpan * s)}" width="${f1(5 * s)}" height="${f1((ySpan + 12) * s)}" rx="${f1(1.5 * s)}"/>` +
    `<rect x="${f1(Math.min(axle0[0], axle1[0]))}" y="${f1(-5 * s)}" width="${f1(Math.abs(axle0[0] - axle1[0]))}" height="${f1(10 * s)}" rx="${f1(2 * s)}"/></g>`);
  const sp = at(0, -M.zMax - D.spokeGap);
  once("spokes", "context", `<g class="rv-spokes"><path d="M${f1(sp[0])},${f1(-ySpan * s)}V${f1(ySpan * s)}"/>` +
    `<text class="rv-note" x="${f1(sp[0] - 0.8 * s)}" y="${f1(72 * s)}" text-anchor="end">spokes</text></g>`);
  // the freehub body the cogs sit on
  const fh0 = at(0, 1), fh1 = at(0, -M.zMax - 1.5);
  once("freehub", "cassette", `<rect class="rv-freehub" x="${f1(Math.min(fh0[0], fh1[0]))}" y="${f1(-17 * s)}" width="${f1(Math.abs(fh0[0] - fh1[0]))}" height="${f1(34 * s)}" rx="${f1(2 * s)}"/>`);
  // ---- the cogs: thin bars at their lateral positions, drawn in place
  for (let k = 0; k <= M.last; k++) {
    const p = at(0, M.cogE(k));
    once(`cog${k}`, "cassette", `<g transform="translate(${f1(p[0])} 0)">${disk(centred(COG_T, M.Rk[k] + tip), "steel")}</g>`);
  }
  // ---- the derailleur: drawn once at the origin, slid each frame
  // a pulley: its toothed rim and the wider hub it turns on, with the bolt through it
  const pulley = () => disk(centred(RIM_T, r + tip), "subject") + disk([[-HUB_W / 2, HUB_R], [HUB_W / 2, HUB_R]], "alloy") + disk([[-HUB_W / 2 - 1.2, 3.4], [HUB_W / 2 + 1.2, 3.4]], "steel");
  once("guide", "guide", pulley());
  once("tension", "tension", pulley());
  // cage plates: 100 mm tall at the origin, stretched to the cage's height each frame
  for (const side of ["In", "Out"]) once(`cage${side}`, "cage", box(26, 0, 100, PLATE_T, "subject"));
  // the parallelogram's moving knuckle and an arm to the cage; its links to the fixed pivots, as unit bars
  once("pknuckle", "pknuckle", box(18, 7, 14, 10, "slate"));
  once("arm", "pknuckle", `<rect class="rv-arm" x="0" y="${f1(-2.2 * s)}" width="1" height="${f1(4.4 * s)}"/>`);
  for (const n of ["link1", "link2"]) once(n, "links", `<g class="rv-link"><path class="rv-link-edge" d="M0,0H1"/><path class="rv-link-face" d="M0,0H1"/></g>`);
  // the fixed knuckle and the hanger to the dropout, in place
  const pv = at(M.centre[1] + D.pOff[1], M.centre[2] + D.pLat), dr = at(4, eDrop);
  once("bknuckle", "bknuckle", box(20, M.centre[1] + D.pOff[1] + 9, 18, 12, "slate").replace("<g ", `<g transform="translate(${f1(pv[0])} 0)" `));
  once("hanger", "hanger", `<path class="rv-hanger" d="M${f1(dr[0] - 2.4 * s)},${f1(dr[1])}L${f1(dr[0] + 2.4 * s)},${f1(dr[1])}L${f1(pv[0] + 3 * s)},${f1(pv[1] - 6 * s)}L${f1(pv[0] - 3 * s)},${f1(pv[1] - 6 * s)}Z"/>`);
  // ---- the chain: one drawing per link, slid along the chain's path as it rolls
  const w = 5.6, link = `<g class="rig-solid rig-m-chain rv-chain"><rect class="rv-roller" x="${f1((-w / 2 + 0.6) * s)}" y="${f1(-1.9 * s)}" width="${f1((w - 1.2) * s)}" height="${f1(3.8 * s)}" rx="${f1(1.2 * s)}"/>` +
    `<rect class="rv-plate" x="${f1(-w / 2 * s)}" y="${f1(-5.4 * s)}" width="${f1(0.9 * s)}" height="${f1(10.8 * s)}" rx="${f1(0.4 * s)}"/><rect class="rv-plate" x="${f1((w / 2 - 0.9) * s)}" y="${f1(-5.4 * s)}" width="${f1(0.9 * s)}" height="${f1(10.8 * s)}" rx="${f1(0.4 * s)}"/></g>`;
  for (let i = 0; i < M.links; i++) once(`cn${i}`, "chain", link);
  // ---- the alignment cue: the two centrelines, and the offset between them
  once("lineCog", "overlay", `<path class="rv-line rv-line-cog" d="M0,${f1(-26 * s)}V${f1(18 * s)}"/>`);
  once("linePulley", "overlay", `<path class="rv-line rv-line-pulley" d="M0,${f1(-18 * s)}V${f1(26 * s)}"/>`);
  once("gapBar", "overlay", `<path class="rv-gap" d="M0,${f1(-1.6 * s)}V${f1(1.6 * s)}M0,0H1M1,${f1(-1.6 * s)}V${f1(1.6 * s)}"/>`);

  const memo = new Map();
  /** Each frame: where every part goes, from the model's pose. */
  function pose(st) {
    const p = st.pose, items = [], roll = st.roll ?? 0;
    const put = (n, key, extra = {}) => items.push({ id: id(n), key, ...extra });
    const tr = (x, y) => `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
    const eG = p.e, eC = p.chainE, eNear = M.cogE(p.cog);
    const G = at(p.G[1], eG), T = at(p.T[1], eG);
    put("frame", 0, { transform: null });
    put("spokes", 1, { transform: null });
    put("freehub", 2, { transform: null });
    const on = Math.max(0, Math.min(M.last, Math.round(p.chainK)));
    for (let k = 0; k <= M.last; k++) put(`cog${k}`, 10 + k, { transform: null, flags: { on: k === on } });
    put("hanger", 4, { transform: null });
    put("bknuckle", 5, { transform: null });
    // the cage: plates either side of the pulleys, from above the guide pulley to below the tension pulley
    const top = Math.max(p.G[1], p.T[1]) + r * 0.62, bot = Math.min(p.G[1], p.T[1]) - r * 0.62, h = (top - bot) / 100;
    for (const [side, de, key] of [["In", -PLATE_GAP, 21], ["Out", PLATE_GAP, 41]]) {
      const o = at(top, eG + de);
      put(`cage${side}`, key, { transform: `matrix(1 0 0 ${h.toFixed(4)} ${o[0].toFixed(1)} ${o[1].toFixed(1)})` });
    }
    put("guide", 37, { transform: tr(G[0], G[1]) });
    put("tension", 37, { transform: tr(T[0], T[1]) });
    // the moving knuckle sits pLat outboard of the guide pulley, pOff above it; the links run from
    // it to the fixed pivots; an arm joins it to the outer cage plate
    const pk = at(p.G[1] + D.pOff[1], eG + D.pLat), fixed = at(M.centre[1] + D.pOff[1], M.centre[2] + D.pLat);
    put("pknuckle", 44, { transform: tr(pk[0], pk[1]) });
    const arm0 = at(p.G[1] + D.pOff[1], eG + PLATE_GAP);
    put("arm", 42, { transform: `matrix(${(pk[0] - arm0[0]).toFixed(1)} 0 0 1 ${arm0[0].toFixed(1)} ${arm0[1].toFixed(1)})` });
    for (const [n, dy, key] of [["link1", -4, 43], ["link2", 6, 45]]) {
      const a = [pk[0], pk[1] + dy * s], b = [fixed[0], fixed[1] + dy * s], dx = b[0] - a[0], dyy = b[1] - a[1], L = Math.hypot(dx, dyy) || 1;
      put(n, key, { transform: `matrix(${dx.toFixed(2)} ${dyy.toFixed(2)} ${(-dyy / L).toFixed(4)} ${(dx / L).toFixed(4)} ${a[0].toFixed(1)} ${a[1].toFixed(1)})` });
    }
    // the chain: each link where the model has it, from where it wraps the cog to where it leaves
    // the tension pulley; it runs from the cog's line to the guide pulley's between the two
    const path = p.path, Lp = D.p;
    for (let i = 0; i < M.links; i++) {
      let show = !!path, pt = null;
      if (path) {
        const q = pathAt(path, ((((-roll + (i + 0.5) * Lp) % path.total) + path.total) % path.total));
        const seg = q.on;
        if (seg === "cog") pt = at(q.p[1], eC);
        else if (seg === "run1") pt = at(q.p[1], eC + (eG - eC) * q.f);
        else if (seg === "guide" || seg === "run2" || seg === "tension") pt = at(q.p[1], eG);
        else show = false;
      }
      put(`cn${i}`, 35, show ? { transform: tr(pt[0], pt[1]) } : { hidden: true });
    }
    // the alignment cue
    const xc = at(0, eNear)[0], xp = G[0], off = p.off;
    // the gap: just above the guide pulley's teeth, below the foot of the cog it serves
    const yg = at(p.G[1] + r + tip + 3.5, 0)[1];
    put("lineCog", 60, { transform: tr(xc, yg), part: "overlay" });
    put("linePulley", 61, { transform: tr(xp, yg), part: "overlay" });
    const shown = Math.abs(off) >= 0.005;
    const x0 = Math.min(xc, xp), x1 = Math.max(xc, xp);
    put("gapBar", 62, shown ? { transform: `matrix(${Math.max(1, x1 - x0).toFixed(1)} 0 0 1 ${x0.toFixed(1)} ${yg.toFixed(1)})`, part: "overlay" } : { hidden: true });
    if (shown) {
      // off line: the gap in mm, in red, beside the pulley on the open side
      const text = `${Math.abs(off).toFixed(2)} mm ${off > 0 ? "inboard" : "outboard"}`;
      if (!memo.has(text)) memo.set(text, `<text class="rv-gap-text" x="0" y="0">${text}</text>`);
      put("gapText", 63, { transform: tr(x1 + 6 * s, yg + 1.6 * s), svg: memo.get(text), part: "overlay" });
    } else put("gapText", 63, { hidden: true });
    // the window follows the guide pulley: sideways with it, and between the cog's foot and the pulley
    const focus = at((p.G[1] - r - tip) / 2, eG);
    return { items, focus, at: { cogLine: xc, pulleyLine: xp, off, scale: s } };
  }
  return { cam, parts, pose, cogX: (k) => at(0, M.cogE(k))[0] };
}
