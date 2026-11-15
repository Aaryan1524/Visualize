// node examples/lock/build.mjs  ->  dist/lock.html (or --out <file>).
// The pin tumbler lock as a Drawing page: a long section drawn to scale from model.mjs, with a
// transverse section A-A in the detail circle, inside the shared Drawing page and player
// (src/drawing/). No dependencies. The page runs the same model.mjs the tests run (inlined below).
//
// The story: the problem (one key in ninety thousand), the pin stacks, the key, the shear line,
// the turn, a wrong key (with a prediction and a tolerance What if), and the second idea, picking.
// The lab lets the reader cut a key of their own.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS, VARIANTS, LOCK, KEYS, keyOutline, OFFSETS, bindingOrder } from "./model.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");

// ---------------------------------------------------------------- frame and scale
// The SVG works in "units": 14200 x 6550, like the escalator, so its type sizes carry over.
// World millimetres map through one scale: X = OX + SC x, Y = OY - SC y (y up in the model).
const VBW = 14200, VBH = 6550;
const SC = 150, OX = 4300, OY = 3950;
const FS = 150; // label font size in units (about 12 px at 1440 x 900)
const X = (x) => OX + SC * x, Y = (y) => OY - SC * y;
const W = (x, y) => [X(x), Y(y)];
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const f3 = (v) => (Math.round(v * 1000) / 1000).toString();
const P = (p) => `${f1(p[0])},${f1(p[1])}`;
const polyU = (pts) => "M" + pts.map(P).join("L") + "Z"; // already in units
const polyW = (pts) => polyU(pts.map(([x, y]) => W(x, y))); // world mm -> units
const lineU = (a, b) => `M${P(a)}L${P(b)}`;
const polyM = (pts, close = true) => "M" + pts.map((p) => `${f3(p[0])},${f3(p[1])}`).join("L") + (close ? "Z" : ""); // mm, for mm groups
const MM = `matrix(${SC},0,0,${-SC},${OX},${OY})`; // a group drawn in world mm

// Section hatching at `angle` for a simple polygon, as segments, in the polygon's own units.
function hatch(polygon, spacing, angle = 45) {
  const a = (angle * Math.PI) / 180, ca = Math.cos(-a), sa = Math.sin(-a);
  const r = polygon.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
  const ys = r.map((p) => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const back = ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  let out = "";
  for (let y = Math.ceil(lo / spacing) * spacing; y <= hi; y += spacing) {
    const xs = [];
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length];
      if (p[1] > y !== q[1] > y) xs.push(p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
    }
    xs.sort((u, v) => u - v);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const A = back([xs[i], y]), B = back([xs[i + 1], y]);
      out += `M${f3(A[0])},${f3(A[1])}L${f3(B[0])},${f3(B[1])}`;
    }
  }
  return out;
}
const circlePts = (c, r, n = 72) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)]);
function arrowU(at, dir) {
  const L = 95, Wd = 26, b = [at[0] - dir[0] * L, at[1] - dir[1] * L], n = [-dir[1], dir[0]];
  return `M${P(at)}L${P([b[0] + n[0] * Wd, b[1] + n[1] * Wd])}L${P([b[0] - n[0] * Wd, b[1] - n[1] * Wd])}Z`;
}

// ---------------------------------------------------------------- the key (its outline comes from the model)
const L = LOCK;
// shallow groove along the blade (the keyway ward), and the bow's hole
const keyDetail = () => `${polyM(circlePts([-15.5, 0], 2.1, 40))}M${f3(0.6)},-2.2L${f3(L.Ltip - 2.4)},-2.2`;

// ---------------------------------------------------------------- the story
const PRED_STEP = 4; // the prediction is asked on this step and answered by the next
const STEPS = [
  { tab: null, heading: "How does a lock tell one key from ninety thousand?", focus: null },
  { tab: "Pin stacks", heading: "Spring-loaded pin stacks lock the plug.", focus: ["keypins", "drivers", "springs", "shear", "plug", "housing"], block: true },
  { tab: "The key", heading: "The key's cuts lift each stack.", focus: ["key", "keypins", "drivers", "springs"] },
  { tab: "Shear line", heading: "Every gap meets the shear line.", focus: ["key", "keypins", "drivers", "shear"] },
  { tab: "The turn", heading: "The plug turns; the driver pins stay put.", focus: ["plug", "key", "keypins", "drivers", "cam", "shear"] },
  { tab: "Wrong key", heading: null, focus: ["key", "keypins", "drivers", "shear", "plug"], block: true },
  { tab: "Picking", heading: "No lock is perfect, so a pick can set the pins one at a time.", focus: ["pick", "keypins", "drivers", "springs", "shear", "plug"] },
];
const HEAD5 = { tight: "One shallow cut, and the key pin jams.", loose: "A loose lock lets the near-miss key turn." };
// The machine's state through each step, at fraction u of its motion (0..1).
// key: which key, ins: x of its tip (fully in at L.Ltip), angle: plug turn in degrees.
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const INS2 = 21.5;

function captions(M, name) {
  const t = M.turns("wrong"), s = M.stackAt("wrong", L.Ltip)[2];
  return [
    `A lock has to turn for one key and refuse every other key cut for the same keyway: with ten cut depths and ${M.pinning.length} pins, ${M.keyCount.toLocaleString("en")} keys can be cut (${M.combinations.toLocaleString("en")} codes, less those whose neighbouring cuts differ by more than ${M.macs} depths). A plug of Ø${(2 * L.R).toFixed(1)} mm turns inside a housing only when all ${M.pinning.length} pin stacks are split exactly at the joint between them, the shear line.`,
    `Each chamber holds a key pin (${M.keyPinLength(0).toFixed(2)} to ${M.keyPinLength(9).toFixed(2)} mm long, one length per depth), a ${L.driver} mm driver pin and a spring. With no key the springs push each stack down until the key pin rests in the keyway; every driver pin then spans the shear line, so the plug is held.`,
    `The blade's tip is a 45° ramp. As it enters, it lifts each stack, and each key pin's chamfered tip rides over the cuts. The page finds every pin's height by contact between that tip and the blade's profile. Cut depths step by ${L.step} mm; ten depths in all.`,
    `Fully in, each cut root sits ${L.R} mm minus its key pin's length above the plug axis, so the top of every key pin, and the gap above it, lies on the shear line. Worst miss with this key: ${Math.max(...M.stackAt("right", L.Ltip).map((x) => Math.abs(x.miss))).toFixed(3)} mm.`,
    `With every gap on the line, the plug turns. The key pins turn with it; the driver pins stay in the housing, held up by the plug's surface; the cam on the back turns and throws the bolt. The figure stops the turn at 60° so the key and cam still read; a real cam turns on to throw the bolt. In the long section the turned parts inside the plug are shown dashed, as hidden lines, foreshortened by the turn.`,
    t
      ? `The wrong key's third cut is one depth shallow, so its key pin stands ${s.miss.toFixed(3)} mm above the shear line. This lock lets a pin miss by up to ${M.tol} mm (the chamfers cam it past), so the plug still turns: a lock this loose cannot tell the two keys apart.`
      : `The wrong key's third cut is one depth shallow, so its key pin stands ${s.miss.toFixed(3)} mm above the shear line, more than this lock's ${M.tol} mm allowance. The key pin blocks the plug. A cut that is too deep fails the other way, with the driver pin left across the line.`,
    `Picking uses the lock's own imperfection. Each chamber is bored a few hundredths of a millimetre off line (here ${OFFSETS.map((o) => (o >= 0 ? "+" : "") + o.toFixed(3)).join(", ")} mm). Light turning force from a tension wrench pinches only the chamber furthest off; a pick lifts that stack until its gap reaches the shear line, the plug turns a hair, and the driver pin is left on the plug's edge. The chambers bind in the order ${bindingOrder().map((i) => i + 1).join(", ")}, so the pins are set one at a time, with no key.`,
  ];
}

const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

// ---------------------------------------------------------------- the drawing for one variant
const DC = [11300, 2420], DR = 1600, DK = 225, DYC = 2.0; // detail circle: centre, radius (units), scale (units/mm), mm y at its centre
const DM = `matrix(${DK},0,0,${-DK},${DC[0]},${DC[1] + DK * DYC})`;
const D = (z, y) => [DC[0] + DK * z, DC[1] - DK * (y - DYC)];
const SLOT = { l1: [9560, 1250], l2: [9560, 2420], r1: [13060, 1420], r2: [13060, 3520] };
const xA = L.x0 + 2 * L.pitch; // section A-A through the third chamber

function makeDrawing(M, name) {
  const R = L.R, n = M.pinning.length;
  const xs = M.pinning.map((_, i) => M.pinX(i));
  const bibleL = 3.0, bibleR = xs[n - 1] + 3.5;
  // ---- housing (cut, hatched one way) and plug (cut, hatched the other way)
  const hUp = [[1.2, R], [L.housingEnd, R], [L.housingEnd, 9], [bibleR, 9], [bibleR, L.chamberTop], [bibleL, L.chamberTop], [bibleL, 9], [1.2, 9]];
  const hLow = [[1.2, -R], [L.housingEnd, -R], [L.housingEnd, -9], [1.2, -9]];
  const plug = [[0, -7.6], [1.2, -7.6], [1.2, -R], [L.plugEnd, -R], [L.plugEnd, R], [1.2, R], [1.2, 7.6], [0, 7.6]];
  const toU = (pts) => pts.map(([x, y]) => W(x, y));
  const housingSvg = `<path class="slab" d="${polyW(hUp)}${polyW(hLow)}"/><path class="hatch" d="${hatch(toU(hUp), 70, 45)}${hatch(toU(hLow), 70, 45)}"/>` +
    `<path class="solid" d="${polyW([[bibleL, L.chamberTop], [bibleR, L.chamberTop], [bibleR, L.capTop], [bibleL, L.capTop]])}"/>` +
    `<path class="bore" d="${xs.map((x) => polyW([[x - L.boreR, R], [x + L.boreR, R], [x + L.boreR, L.chamberTop], [x - L.boreR, L.chamberTop]])).join("")}"/>`;
  const plugSvg = `<path class="slab plug-fill" d="${polyW(plug)}"/><path class="hatch" d="${hatch(toU(plug), 42, -45)}"/>`;
  const plugHoles = `<path class="bore" d="${polyW([[0, L.kwBot], [29.5, L.kwBot], [29.5, L.kwTop], [0, L.kwTop]])}${xs.map((x) => polyW([[x - L.boreR, L.kwTop], [x + L.boreR, L.kwTop], [x + L.boreR, R + 0.02], [x - L.boreR, R + 0.02]])).join("")}"/>`;
  // ---- the key, in its frame; drawn in a group the runtime moves and foreshortens
  const kk = { right: keyOutline(M.keys.right, L), wrong: keyOutline(M.keys.wrong, L) };
  const keySvg = (which) => which === "custom"
    ? `<g class="key-custom"><path class="key-body"/><path class="key-line" d="${keyDetail()}"/></g>`
    : `<g class="key-${which}"><path class="key-body" d="${polyM(kk[which])}"/><path class="key-line" d="${keyDetail()}"/></g>`;

  // ---- dimensions and the section mark
  const dimY = 1060;
  let dims = `<g class="dims" data-beats="2 3">`;
  const xd0 = X(0), xd1 = X(xs[0]), xd2 = X(xs[1]);
  dims += `<path class="dim" d="${lineU([xd0, Y(8)], [xd0, dimY - 80])}${lineU([xd1, Y(L.capTop) - 40], [xd1, dimY - 80])}${lineU([xd2, Y(L.capTop) - 40], [xd2, dimY - 80])}${lineU([xd0 + 4, dimY], [xd1 - 4, dimY])}${lineU([xd1 + 4, dimY], [xd2 - 4, dimY])}"/>`;
  dims += `<path class="dimhead" d="${arrowU([xd0, dimY], [-1, 0])}${arrowU([xd1, dimY], [1, 0])}${arrowU([xd1, dimY], [-1, 0])}${arrowU([xd2, dimY], [1, 0])}"/>`;
  dims += `<text class="dimtext" x="${f1((xd0 + xd1) / 2)}" y="${dimY - 50}" text-anchor="middle">${L.x0}</text><text class="dimtext" x="${f1((xd1 + xd2) / 2)}" y="${dimY - 50}" text-anchor="middle">${L.pitch}</text></g>`;
  // plug diameter at the back, beside the cam
  const xdD = X(0) - 330;
  dims += `<g class="dims" data-beats="1"><path class="dim" d="${lineU([X(0) - 40, Y(R)], [xdD - 110, Y(R)])}${lineU([X(0) - 40, Y(-R)], [xdD - 110, Y(-R)])}${lineU([xdD, Y(R) + 4], [xdD, Y(-R) - 4])}"/><path class="dimhead" d="${arrowU([xdD, Y(R)], [0, -1])}${arrowU([xdD, Y(-R)], [0, 1])}"/><text class="dimtext" transform="translate(${f1(xdD - 70)},${f1(OY)}) rotate(-90)" text-anchor="middle">Ø${(2 * R).toFixed(1)}</text></g>`;
  const secX = X(xA), sy0 = Y(L.capTop) - 170, sy1 = Y(-9) + 170;
  const section = `<g class="secmark"><path class="centre" d="${lineU([secX, sy0], [secX, sy1])}"/><path class="secline" d="${lineU([secX, sy0], [secX, sy0 + 110])}${lineU([secX, sy1 - 110], [secX, sy1])}${lineU([secX, sy0], [secX + 200, sy0])}${lineU([secX, sy1], [secX + 200, sy1])}"/><path class="dimhead" d="${arrowU([secX + 260, sy0], [1, 0])}${arrowU([secX + 260, sy1], [1, 0])}"/><text class="det-tag" x="${secX - 60}" y="${sy0 + 40}" text-anchor="end">A</text><text class="det-tag" x="${secX - 60}" y="${sy1 + 40}" text-anchor="end">A</text></g>`;

  // ---- callouts (units). `to` points at a part in its still frame for that step.
  const st1 = M.stackAt(null, 0);
  const wrong = M.stackAt("wrong", L.Ltip);
  const bad = wrong.findIndex((s, i) => M.keys.wrong[i] !== M.pinning[i]);
  const label = (id, text, at, to, beats, anchor = "start", cls = "") => ({ id, text, at, to, beats, anchor, cls });
  const LABELS = [
    label("spring", "Spring", [4150, 980], W(xs[0] - 0.8, 14.6), [1], "end"),
    label("housing", "Housing", [6950, 980], W((xs[2] + xs[3]) / 2, 12.4), [1], "start"),
    label("driver", "Driver pin", [8350, 1750], W(xs[4] + 0.9, st1[4].keyTop + 3.0), [1], "start"),
    label("shear", "Shear line", [3150, 2330], W(0.7, R), [1, 3], "end"),
    label("keypin", "Key pin", [5650, 5850], W(xs[3] - 0.8, st1[3].tip + 2.2), [1], "end"),
    label("plug", "Plug", [8350, 5850], W(26.5, -4.6), [1], "start"),
    label("key", "Key", [3300, 5850], W(2.4, -2.8), [2], "end"),
    label("cut", "Cut root", [6450, 5850], W(xs[4] + 0.15, M.cutRoot(M.keys.right[4])), [3], "end"),
    label("cam", "Cam", [8350, 5850], W(33.8, -8.3 * Math.cos((60 * Math.PI) / 180)), [4], "start"), // the story turn is 60 degrees
    label("held", "Driver pins held up", [4900, 980], W(xs[1] + 0.9, R + 2.0), [4], "end"),
    M.turns("wrong")
      ? label("bad", "Plug turns anyway", [5250, 980], W(xs[bad] - 0.9, R + 0.1), [5], "end")
      : label("bad", "Key pin across the line", [5250, 980], W(xs[bad] - 0.9, R + 0.1), [5], "end", "warn"),
    label("wrench", "Tension wrench", [3300, 5850], W(-1.0, -9.5), [6], "end"),
    label("pickl", "Pick", [5650, 5850], W(9.5, -3.15), [6], "end"),
    label("set", "Set: driver pin on the plug's edge", [4900, 980], W(xs[1] + 0.9, R + 1.6), [6], "end"),
    // in the detail circle
    label("ddriver", "Driver pin", SLOT.l1, D(-1.0, R + 2.4), [4], "end"),
    
    label("dshear", "Shear line", SLOT.r1, D(R * Math.sin(0.7), R * Math.cos(0.7)), [1, 3, 5, 6], "start"),
    label("dkey", "Key", SLOT.r2, D(0.45, -2.6), [2], "start"),
    label("dplug", "Plug", SLOT.r2, D(R * 0.62, -R * 0.45), [4], "start"),
    ...(M.turns("wrong") ? [] : [label("dbad", `Key pin, ${wrong[bad].miss.toFixed(2)} high`, SLOT.l2, D(-1.0, wrong[bad].keyTop - 0.5), [5], "end", "warn")]),
  ];
  const labelSvg = (l) => `<g class="label${l.cls ? " " + l.cls : ""}" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-to="${f1(l.to[0])},${f1(l.to[1])}"><path class="leader"/><circle class="ldot" cx="${f1(l.to[0])}" cy="${f1(l.to[1])}" r="24"/><text x="${f1(l.at[0])}" y="${f1(l.at[1])}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

  // ---- detail: transverse section A-A through the third chamber, live
  const hBox = [[-12, -12], [12, -12], [12, L.chamberTop], [-12, L.chamberTop]];
  const plugC = circlePts([0, 0], R, 120);
  // keyway: a slot with two wards, as in a real paracentric keyway
  const kwZ = 1.0;
  const keyway = [[-kwZ, L.kwBot], [kwZ, L.kwBot], [kwZ, -1.6], [0.45, -1.2], [kwZ, -0.8], [kwZ, L.kwTop], [-kwZ, L.kwTop], [-kwZ, 1.6], [-0.45, 1.2], [-kwZ, 0.8]];
  const detail = `<g id="detail" class="detail">
<clipPath id="clipD"><circle cx="${DC[0]}" cy="${DC[1]}" r="${DR}"/></clipPath>
<circle class="det-bg" cx="${DC[0]}" cy="${DC[1]}" r="${DR}"/>
<g clip-path="url(#clipD)"><g transform="${DM}">
<path class="slab" d="${polyM(hBox)}"/><path class="hatch" d="${hatch(hBox, 70 / DK, 45)}"/>
<path class="bore" d="${polyM(plugC)}${polyM([[-L.boreR, R - 0.2], [L.boreR, R - 0.2], [L.boreR, L.chamberTop], [-L.boreR, L.chamberTop]])}"/>
<g id="dPlug">
<path class="slab plug-fill" d="${polyM(plugC)}"/><path class="hatch" d="${hatch(plugC, 42 / DK, -45)}"/>
<path class="bore" d="${polyM(keyway)}${polyM([[-L.boreR, L.kwTop - 0.05], [L.boreR, L.kwTop - 0.05], [L.boreR, R + 0.02], [-L.boreR, R + 0.02]])}"/>
<path id="dBlade" class="key-body"/>
<path id="dKeyPin" class="pin keypin"/>
</g>
<path id="dSpring" class="spring"/><path id="dDriver" class="pin driver"/>
<circle class="shear-line" r="${R}"/>
<g class="dims" data-beats="4 5"><path class="turnarrow" d="${polyM(Array.from({ length: 31 }, (_, i) => { const a = ((170 - i * 1.6) * Math.PI) / 180; return [(R + 0.9) * Math.cos(a), (R + 0.9) * Math.sin(a)]; }), false)}"/><path class="dimhead" transform="matrix(${1 / DK},0,0,${-1 / DK},${f3((R + 0.9) * Math.cos((122 * Math.PI) / 180))},${f3((R + 0.9) * Math.sin((122 * Math.PI) / 180))})" d="${arrowU([0, 0], [Math.sin((122 * Math.PI) / 180), Math.cos((122 * Math.PI) / 180)])}"/></g>
</g></g>
<circle class="det-ring" cx="${DC[0]}" cy="${DC[1]}" r="${DR}"/>
<rect id="detailFrame" x="${DC[0] - DR - 1700}" y="${DC[1] - DR - 80}" width="${2 * DR + 3400}" height="${2 * DR + 520}" fill="none" stroke="none"/>
<text class="det-title" x="${DC[0]}" y="${DC[1] - DR - 110}" text-anchor="middle">SECTION A–A  ·  ${DK / SC} : 1  ·  THROUGH CHAMBER 3</text>
</g>`;

  // ---- title block
  const tb = (() => {
    const x0 = 9700, x1 = VBW - 60, y0 = 4900, y1 = VBH - 60;
    let s = `<g class="tblock"><path class="tb-frame" d="${polyU([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])}"/>`;
    s += `<path class="tb-rule" d="${lineU([x0, y0 + 380], [x1, y0 + 380])}${lineU([x0, y1 - 300], [x1, y1 - 300])}"/>`;
    s += `<text class="tb-title" x="${x0 + 110}" y="${y0 + 250}">PIN TUMBLER CYLINDER · LONG SECTION</text>`;
    s += `<text class="tb-small" x="${x1 - 110}" y="${y0 + 250}" text-anchor="end">mm</text>`;
    const facts = [
      `Plug Ø${(2 * R).toFixed(1)} · ${n} chambers at ${L.pitch} · pins Ø${L.pinD} · driver pins ${L.driver}`,
      `10 cut depths, ${L.step} apart · MACS ${M.macs} · shear allowance ±${M.tol.toFixed(2)}`,
      `Near half removed. Key, pins and springs not hatched.`,
      `Turned plug: parts inside it shown dashed (hidden).`,
    ];
    facts.forEach((t, i) => (s += `<text class="tb-text" x="${x0 + 110}" y="${y0 + 600 + i * 200}">${esc(t)}</text>`));
    s += `<g id="tbkey" data-x0="${x0 + 110}">`;
    for (const [cls, t] of [["k-blue", "Shear line"], ["k-orange", "Key or pick"], ["k-red", "Pin that blocks"]]) s += `<g class="tbk"><path class="${cls}" d="M0,${y1 - 140}h240"/><text class="tb-text tb-key" x="0" y="${y1 - 100}">${t}</text></g>`;
    return s + "</g></g>";
  })();

  const springsG = xs.map((_, i) => `<path class="spring" id="sp${i}"/>`).join("");
  const scene = `
<g class="part" data-part="housing">${housingSvg}</g>
<g class="part" data-part="plug">${plugSvg}<g id="plugHoles">${plugHoles}</g></g>
<g class="part" data-part="springs">${springsG}</g>
<g class="part" data-part="drivers">${xs.map((_, i) => `<path class="pin driver" id="dr${i}"/>`).join("")}</g>
<g class="part" data-part="key"><g id="keyIn" clip-path="url(#clipIn)"><g id="keyInT">${keySvg("right")}${keySvg("wrong")}${keySvg("custom")}</g></g><g id="keyOut" clip-path="url(#clipOut)"><g id="keyOutT">${keySvg("right")}${keySvg("wrong")}${keySvg("custom")}</g></g></g>
<g class="part" data-part="pick"><g transform="${MM}"><path class="tool" id="wrench"/><path class="tool" id="pick"/></g></g>
<g class="part" data-part="keypins"><g id="kpT" transform="${MM}">${xs.map((_, i) => `<path class="pin keypin" id="kp${i}"/>`).join("")}</g></g>
<g class="part" data-part="cam"><g id="camT"><path class="cam" id="cam"/></g></g>
<g class="part" data-part="shear"><path class="shear-line" d="${lineU(W(0, R), W(L.plugEnd, R))}"/></g>`;
  const clips = `<defs><clipPath id="clipIn"><rect x="${X(0)}" y="0" width="${VBW}" height="${VBH}"/></clipPath><clipPath id="clipOut"><rect x="0" y="0" width="${X(0)}" height="${VBH}"/></clipPath></defs>`;
  const svg = `${clips}<g id="scene">${scene}</g>${section}<g id="dims">${dims}</g>${detail}<g id="labels">${LABELS.map(labelSvg).join("")}</g>${tb}`;
  return { svg, bad };
}

// ---------------------------------------------------------------- per variant data
function variantData(name) {
  const v = VARIANTS[name], M = MODELS[name];
  const dr = makeDrawing(M, name);
  const tracks = VOICE?.variants?.[name] ?? null;
  // On the narrated tour, each step's motion ends when the voice names what it is about.
  const MEET = [null, null, null, "shear", "cam", M.turns("wrong") ? "plug" : "block", null];
  const meet = (tracks || []).map((tr, k) => {
    const l = MEET[k] && tr.links.find((x) => x.ids.includes(MEET[k]));
    return l ? l.start + 0.35 : 0.8 * tr.duration;
  });
  const wrong = M.stackAt("wrong", L.Ltip)[dr.bad];
  return {
    name, label: v.label, tol: v.tol,
    svg: dr.svg, bad: dr.bad,
    heading5: HEAD5[name],
    captions: captions(M, name),
    voice: tracks, meet,
    pose: [0, 0, 1, 1, 1, 1, 0.42], // picking: the still frame is mid-way, two pins set and the third lifting
    answer: M.turns("wrong") ? 0 : wrong.block === "key" ? 2 : 1,
    explanation: M.turns("wrong")
      ? `It lifts that key pin ${wrong.miss.toFixed(2)} mm too high, but this loose lock allows ±${M.tol.toFixed(2)} mm, so the plug turns anyway.`
      : `It lifts that key pin ${wrong.miss.toFixed(2)} mm too high, past the ±${M.tol.toFixed(2)} mm allowance: the key pin itself now crosses the shear line.`,
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));
// ---------------------------------------------------------------- the machine (runs in the page)
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz"), fig = $("fig");
  const fx = (v) => v.toFixed(1), f3 = (v) => v.toFixed(3);
  const STEPS = DATA.steps;
  let V = null, model = null, E = null, Lk = null, P = null;
  const SCx = DATA.SC, OX = DATA.OX, OY = DATA.OY;
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const PICK = 6, ORDER = bindingOrder();

  // ------------------------------------------------ the machine's state through the story
  // key: which key, ins: x of its tip (fully in at L.Ltip), angle: plug turn in degrees,
  // pick: { j, lift } while picking (j chambers set, the next lifted by lift).
  function stateAt(k, u) {
    const full = Lk.Ltip;
    if (k <= 1) return { key: null, ins: 0, angle: 0 };
    if (k === 2) return { key: "right", ins: 1 + (DATA.ins2 - 1) * ease(u), angle: 0 };
    if (k === 3) return { key: "right", ins: DATA.ins2 + (full - DATA.ins2) * ease(u), angle: 0 };
    if (k === 4) return { key: "right", ins: full, angle: DATA.turn * ease(u) };
    if (k === PICK) {
      // five pins, each lifted then left set, then the plug turns
      const n = model.pinning.length, w = 0.85 / n;
      if (u >= 0.85) return { key: null, ins: 0, angle: DATA.turn * ease((u - 0.85) / 0.15), pick: { j: n, lift: 0 } };
      const j = Math.floor(u / w), f = (u - j * w) / w;
      return { key: null, ins: 0, angle: 0, pick: { j, lift: f < 0.7 ? ease(f / 0.7) : 1, release: f >= 0.7 } };
    }
    // the wrong key goes in, then the reader's hand tries to turn it
    const a = Math.min(1, u / 0.6), b = Math.max(0, (u - 0.6) / 0.4);
    const ins = 17 + (full - 17) * ease(a);
    return { key: "wrong", ins, angle: Math.min(DATA.turn * ease(b), model.turnLimit("wrong", ins)) };
  }
  // A step's motion fills the stretch before the voice names what it is about (or 6 s silent).
  const anim = (k) => (V.voice?.[k] ? Math.max(1.5, V.meet[k]) : 0.75 * DATA.plain);
  const at = (k, t, still, SEG) => stateAt(k, still ? V.pose[k] : Math.max(0, Math.min(1, (t - SEG.lead) / anim(k))));
  const stillAt = (k, SEG) => SEG.lead + V.pose[k] * anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    Lk = model.L;
    const n = model.pinning.length;
    E = {
      kp: [...Array(n)].map((_, i) => $("kp" + i)), dr: [...Array(n)].map((_, i) => $("dr" + i)), sp: [...Array(n)].map((_, i) => $("sp" + i)),
      keyIn: $("keyInT"), keyOut: $("keyOutT"), kpT: $("kpT"), cam: $("cam"), holes: $("plugHoles"),
      dPlug: $("dPlug"), dBlade: $("dBlade"), dKeyPin: $("dKeyPin"), dDriver: $("dDriver"), dSpring: $("dSpring"),
      detail: $("detail"), keyParts: [...fig.querySelectorAll("#scene .key-right, #scene .key-wrong, #scene .key-custom")],
      custom: [...fig.querySelectorAll("#scene .key-custom .key-body")], pick: $("pick"), wrench: $("wrench"),
    };
    $("r-tol").textContent = `±${V.tol.toFixed(2)}`;
  }

  // ------------------------------------------------ drawing one moment
  const M3 = (pts) => "M" + pts.map((p) => `${f3(p[0])},${f3(p[1])}`).join("L") + "Z";
  function keyPinPts(x, tip, top) {
    const r = Lk.pinD / 2, h = Lk.tipFlat / 2, c = r - h; // 45 degree chamfer from the flat
    // the top is domed to the plug's radius, as real key pins are, so it turns clear of the housing
    const dome = Array.from({ length: 9 }, (_, j) => {
      const dx = r - (2 * r * j) / 8;
      return [x + dx, top - (Lk.R - Math.sqrt(Lk.R * Lk.R - dx * dx))];
    });
    return [[x - h, tip], [x + h, tip], [x + r, tip + c], ...dome, [x - r, tip + c]];
  }
  const driverPts = (x, b, t) => {
    const r = Lk.pinD / 2, e = 0.2;
    return [[x - r + e, b], [x + r - e, b], [x + r, b + e], [x + r, t - e], [x + r - e, t], [x - r + e, t], [x - r, t - e], [x - r, b + e]];
  };
  function springD(x, b, t, toU) {
    const coils = 7, w = Lk.boreR - 0.25, pts = [[x, b]];
    for (let j = 0; j < coils * 2; j++) pts.push([x + (j % 2 ? w : -w), b + ((t - b) * (j + 0.5)) / (coils * 2)]);
    pts.push([x, t]);
    return "M" + pts.map(toU).map((p) => `${fx(p[0])},${fx(p[1])}`).join("L");
  }
  const toU = ([x, y]) => [OX + SCx * x, OY - SCx * y];
  // A tool drawn as a strip of width w along a polyline (mm).
  function strip(pts, w) {
    const L = [], R = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
      const nx = -dy / m, ny = dx / m;
      L.push([p[0] + (nx * w) / 2, p[1] + (ny * w) / 2]);
      R.push([p[0] - (nx * w) / 2, p[1] - (ny * w) / 2]);
    });
    return M3([...L, ...R.reverse()]);
  }
  let cur = null, labKey = null;
  function render(state, S) {
    cur = state;
    P = S;
    const st = state.pick ? pickStacks(model.pinning, state.pick.j, state.pick.lift, ORDER, Lk)
      : state.key === "custom" ? stacks(model.pinning, state.cuts, state.ins, model.tol, Lk)
      : model.stackAt(state.key, state.ins);
    const a = (state.angle * Math.PI) / 180, c = Math.max(0.02, Math.cos(a));
    const turned = state.angle > 1.5;
    const showBlock = STEPS[S.step]?.block && !state.lab && (!state.key || Math.abs(state.ins - Lk.Ltip) < 1e-6);
    // Turning, a key pin that stands within the allowance above the line is cammed down to it
    // (the key has a little play in its keyway); the driver pins rest on the plug's surface.
    const drop = turned && !state.pick ? Math.max(0, ...st.map((s) => s.keyTop - Lk.R)) : 0;
    for (const s of st) ((s.tip -= drop), (s.keyTop -= drop));
    const labBlock = state.lab ? st.map((s) => s.block) : null;
    st.forEach((s, i) => {
      E.kp[i].setAttribute("d", M3(keyPinPts(s.x, s.tip, s.keyTop)));
      const b = turned ? Lk.R : s.drvBot ?? s.keyTop;
      E.dr[i].setAttribute("d", M3(driverPts(s.x, b, b + Lk.driver)).replace(/(-?\d+\.\d+),(-?\d+\.\d+)/g, (_, x, y) => `${fx(OX + SCx * +x)},${fx(OY - SCx * +y)}`));
      E.sp[i].setAttribute("d", springD(s.x, b + Lk.driver, Lk.chamberTop, toU));
      const blk = labBlock ? labBlock[i] : showBlock ? s.block : null;
      E.kp[i].classList.toggle("block", blk === "key");
      E.dr[i].classList.toggle("block", blk === "driver");
      E.kp[i].classList.toggle("named", !state.pick && !state.lab && i === V.bad);
      E.dr[i].classList.toggle("named", !state.pick && !state.lab && i === V.bad);
      E.kp[i].classList.toggle("binding", !!s.binding);
      E.dr[i].classList.toggle("set", !!s.set);
    });
    // key pins (inside the plug) turn with it: foreshortened, and hidden once turned
    E.kpT.setAttribute("transform", `matrix(${SCx},0,0,${fx(-SCx * c)},${OX},${OY})`);
    E.kpT.classList.toggle("hid", turned);
    for (const g of E.keyParts) g.style.display = state.key && g.classList.contains("key-" + state.key) ? "" : "none";
    if (state.key === "custom" && labKey !== state.cuts.join()) {
      labKey = state.cuts.join();
      const d = M3(keyOutline(state.cuts, Lk));
      for (const p of E.custom) p.setAttribute("d", d);
    }
    const sh = OX + SCx * (state.ins - Lk.Ltip);
    const kt = `matrix(${SCx},0,0,${fx(-SCx * c)},${fx(sh)},${fx(OY + SCx * c * drop)})`;
    E.keyIn.setAttribute("transform", kt);
    E.keyOut.setAttribute("transform", kt);
    E.keyIn.classList.toggle("hid", turned);
    E.holes.style.opacity = String(Math.max(0, 1 - state.angle / 6));
    // the pick and the tension wrench, only while picking
    if (state.pick) {
      const i = ORDER[Math.min(state.pick.j, ORDER.length - 1)], s = st[i];
      const hx = s.x, hy = state.pick.j < ORDER.length && !state.pick.release ? s.tip : Lk.rest - 0.3;
      const y0 = Lk.kwBot + 0.55;
      E.pick.setAttribute("d", strip([[-16, y0], [hx - 1.6, y0], [hx - 0.5, hy - 0.35], [hx + 0.35, hy - 0.35]], 0.55));
      E.wrench.setAttribute("d", strip([[2.6, Lk.kwBot + 0.25], [-0.9, Lk.kwBot + 0.25], [-0.9, -11.5]], 0.6));
    } else {
      E.pick.setAttribute("d", "");
      E.wrench.setAttribute("d", "");
    }
    // cam on the back of the plug: a lobe pointing down, seen foreshortened as it turns
    const cam = [[32.2, 3.6], [35.4, 3.6], [35.4, -6.2], [34.6, -9.4], [33.0, -9.4], [32.2, -6.2]];
    E.cam.setAttribute("d", "M" + cam.map(([x, y]) => toU([x, y * c])).map((p) => `${fx(p[0])},${fx(p[1])}`).join("L") + "Z" + `M${fx(OX + SCx * 32.2)},${fx(OY)}L${fx(OX + SCx * 35.4)},${fx(OY)}`);
    // section A-A through the third chamber
    const s3 = st[2];
    E.dPlug.setAttribute("transform", `rotate(${(-state.angle).toFixed(2)})`);
    E.dKeyPin.setAttribute("d", M3(keyPinPts(0, s3.tip, s3.keyTop)));
    const b3 = turned ? Lk.R : s3.drvBot ?? s3.keyTop;
    E.dDriver.setAttribute("d", M3(driverPts(0, b3, b3 + Lk.driver)));
    E.dSpring.setAttribute("d", (() => {
      const pts = [[0, b3 + Lk.driver]], w = Lk.boreR - 0.25, t = Lk.chamberTop, bb = b3 + Lk.driver;
      for (let j = 0; j < 14; j++) pts.push([j % 2 ? w : -w, bb + ((t - bb) * (j + 0.5)) / 14]);
      pts.push([0, t]);
      return "M" + pts.map((p) => `${f3(p[0])},${f3(p[1])}`).join("L");
    })());
    const blk3 = labBlock ? labBlock[2] : showBlock ? s3.block : null;
    E.dKeyPin.classList.toggle("block", blk3 === "key");
    E.dDriver.classList.toggle("block", blk3 === "driver");
    if (state.key) {
      const u = DATA.xA - (state.ins - Lk.Ltip);
      const cuts = state.key === "custom" ? state.cuts : model.keys[state.key];
      const top = bladeTop(cuts, u, Lk) - drop, bot = model.bladeBottom(u) - drop;
      const z = 0.82;
      E.dBlade.setAttribute("d", top > bot ? M3([[-z, bot], [z, bot], [z, -1.75], [0.3, -1.25], [z, -0.75], [z, top], [-z, top], [-z, 1.75], [-0.3, 1.25], [-z, 0.75]].filter(([, y]) => y <= top && y >= bot)) : "");
    } else E.dBlade.setAttribute("d", "");
    readouts(state, st);
  }
  const R = {};
  const setText = (id, v) => {
    if (R[id] !== v) ((R[id] = v), ($(id).textContent = v));
  };
  function readouts(state, st) {
    setText("r-angle", `${state.angle.toFixed(state.angle < 1 && state.angle > 0 ? 1 : 0)}°`);
    const on = state.pick ? st.filter((s) => s.set).length : state.key ? st.filter((s) => s.block === null).length : 0;
    setText("r-on", `${on} / ${st.length}`);
    setText("r-on-unit", state.pick ? "pins set" : "gaps on the line");
    setText("r-ins", state.key ? state.ins.toFixed(1) : "0.0");
    setText("r-miss", state.pick ? "–" : Math.max(...st.map((s) => Math.abs(s.miss))).toFixed(2));
    const full = state.key && Math.abs(state.ins - Lk.Ltip) < 1e-6;
    const free = state.pick ? state.pick.j >= st.length : full && st.every((s) => s.block === null);
    setText("r-state", state.angle > 1.5 ? "turning" : free ? "free" : "locked");
  }

  // ------------------------------------------------ focus, and the parts the voice names
  const lit = (ids) => root.toggleAttribute("data-named", ids.includes("block"));

  // ------------------------------------------------ the lab: cut your own key
  function lab(values, variant) {
    const n = model.pinning.length;
    const cuts = [...Array(n)].map((_, i) => Number(values["c" + (i + 1)]));
    const m = makeModel({ tol: DATA.variants[variant].tol, keys: { ...model.keys, custom: cuts } });
    const st = m.stackAt("custom", Lk.Ltip);
    const ok = st.every((s) => s.block === null);
    const rows = st.map((s, i) => {
      const d = cuts[i] - model.pinning[i];
      if (s.block === null) return `Pin ${i + 1}: gap ${Math.abs(s.miss) < 1e-9 ? "on the line" : `${Math.abs(s.miss).toFixed(2)} mm off, inside ±${m.tol.toFixed(2)}`}`;
      return s.block === "key"
        ? `Pin ${i + 1}: key pin ${s.miss.toFixed(2)} mm across the line. Cut ${-d} deeper`
        : `Pin ${i + 1}: driver pin ${(-s.miss).toFixed(2)} mm across the line. Cut ${d} shallower`;
    });
    const blocking = st.filter((s) => s.block).length;
    return {
      ok,
      state: { key: "custom", cuts, ins: Lk.Ltip, angle: ok ? DATA.turn : 0, lab: true },
      verdict: ok ? `It opens: every gap is within ±${m.tol.toFixed(2)} mm of the line.` : `Locked: ${blocking} pin${blocking > 1 ? "s" : ""} across the shear line.`,
      rows,
    };
  }

  // ------------------------------------------------ now you try: questions made from the model
  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
  const mm = (v) => `${v.toFixed(2)} mm`;
  function question(n, r) {
    const kind = n % 4;
    const Lq = model.L;
    if (kind === 0) {
      // which part crosses the shear line, from a pin depth and a cut depth
      const d = 1 + Math.floor(r() * 8), off = pick(r, [-2, -1, 1, 2]), e = Math.max(0, Math.min(9, d + off));
      const tol = pick(r, Object.values(DATA.variants).map((v) => v.tol));
      const [s] = stacks([d], [e], Lq.Ltip, tol, Lq);
      const out = ["The gap sits on the shear line", "The key pin crosses the line", "The driver pin crosses the line"];
      const ans = s.block === null ? 0 : s.block === "key" ? 1 : 2;
      return {
        q: `A chamber's key pin is cut for depth ${d}; the key's cut there is depth ${e} (depths ${Lq.step} mm apart, deeper is higher number). The lock allows ±${tol.toFixed(2)} mm. Fully in, what happens at this chamber?`,
        choices: [out[ans], ...out.filter((_, i) => i !== ans)],
        explain: `The key pin's top lands ${e < d ? "above" : "below"} the line by |${d} − ${e}| × ${Lq.step} = ${Math.abs(s.miss).toFixed(3)} mm. ${s.block === null ? "That is inside the allowance, so the gap counts as on the line." : s.block === "key" ? "A shallow cut lifts the key pin too high, so it crosses the line." : "A deep cut leaves the stack too low, so the driver pin crosses the line."}`,
      };
    }
    if (kind === 1) {
      const d = Math.floor(r() * 10), Lkp = keyPinLength(d, Lq), c = cutRoot(d, Lq);
      return {
        q: `The shear line is ${Lq.R} mm above the plug axis. A depth-${d} cut root sits ${c.toFixed(3)} mm above the axis. How long must that chamber's key pin be?`,
        choices: [mm(Lkp), mm(c), mm(Lkp + Lq.driver)],
        explain: `The key pin must reach from the cut root to the shear line: ${Lq.R} − ${c.toFixed(3)} = ${Lkp.toFixed(3)} mm.`,
      };
    }
    if (kind === 2) {
      const k = pick(r, [1, 2, 3]), miss = k * Lq.step;
      const tT = DATA.variants.tight.tol, tL = DATA.variants.loose.tol, tight = miss <= tT + 1e-9, loose = miss <= tL + 1e-9;
      const out = ["Only the loose lock turns", "Both locks turn", "Neither lock turns"];
      const ans = tight ? 1 : loose ? 0 : 2;
      return {
        q: `A key's cut is ${k} depth${k > 1 ? "s" : ""} too shallow (${k} × ${Lq.step} mm). Which locks still turn: one allowing ±${tT.toFixed(2)} mm, one allowing ±${tL.toFixed(2)} mm?`,
        choices: [out[ans], ...out.filter((_, i) => i !== ans)],
        explain: `The key pin stands ${miss.toFixed(3)} mm above the line. ${tight ? "Inside both allowances." : loose ? `Under ${tL} but over ${tT}: only the loose lock is fooled.` : "More than either allowance: both locks hold."}`,
      };
    }
    // this lock's own pin count, so the question never disagrees with the drawing
    const pins = model.pinning.length, m = macs(Lq), v = keyCount(pins, Lq);
    return {
      q: `This lock has ${pins} pins and 10 cut depths, and neighbouring cuts may differ by at most ${m} depths (so a deep cut's flank cannot eat its neighbour's root). How many different keys can be cut for it?`,
      choices: [v.toLocaleString("en"), Math.pow(10, pins).toLocaleString("en"), (10 * pins).toLocaleString("en")],
      explain: `${Math.pow(10, pins).toLocaleString("en")} codes in all, minus every code with a jump of ${m + 1} or more between neighbours (a 0 next to a 9): ${v.toLocaleString("en")}.`,
    };
  }

  return { model: (v) => makeModel({ tol: v.tol }), mount, at, stillAt, render, lit, lab, question, heading: (k) => (k === 5 ? V.heading5 : null), info: () => (cur ? { ...cur } : {}) };
}

// ---------------------------------------------------------------- page
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const std = VARIANT_DATA.tight, M0 = MODELS.tight;
const bad = std.bad, ORD = ["first", "second", "third", "fourth", "fifth"];

const DATA = {
  SC, OX, OY, FS, ins2: INS2, turn: 60, xA, plain: 8,
  base: "tight",
  steps: STEPS.map(({ heading, focus, block }) => ({ heading, focus, block: !!block })),
  alias: { block: ["keypins", "drivers"], binding: ["keypins", "drivers"] },
  predict: {
    step: PRED_STEP,
    question: `This key's ${ORD[bad]} cut is one depth too shallow. Turn it: what happens?`,
    choices: ["The plug turns", "A driver pin blocks it", "A key pin blocks it"],
    answer: Object.fromEntries(Object.entries(VARIANT_DATA).map(([k, v]) => [k, v.answer])),
    explanation: Object.fromEntries(Object.entries(VARIANT_DATA).map(([k, v]) => [k, v.explanation])),
    locked: "Locked in. Press play to try the wrong key.",
  },
  lab: {
    button: "Cut a key",
    title: "Cut your own key",
    heading: "Will your key open it?",
    intro: `Set each cut's depth, 0 (shallow) to 9 (deep). It starts as the wrong key; the lock is pinned ${M0.pinning.join("-")}.`,
    inputs: KEYS.wrong.map((d, i) => ({ id: "c" + (i + 1), label: `Cut ${i + 1}`, min: 0, max: 9, step: 1, value: d })),
  },
  variants: VARIANT_DATA,
};

const CSS = `
.vz{--red:#c2410c;--plugfill:#f3ead6}
@media (prefers-color-scheme:dark){.vz:not([data-theme="light"]){--plugfill:#2a2418}}
.vz[data-theme="dark"]{--plugfill:#2a2418}
/* ---- the drawing: line weights in screen pixels; blue, orange and red, one meaning each ---- */
path,circle,rect,line,polyline,polygon,ellipse{vector-effect:non-scaling-stroke}
#fig{shape-rendering:geometricPrecision}
text{font-family:var(--sans);fill:var(--ink)}
.part{transition:opacity .45s ease}
.instant .part,.instant .detail{transition:none}
.slab{fill:var(--slab);stroke:var(--ink);stroke-width:1.5;stroke-linejoin:miter}
.slab.plug-fill{fill:var(--plugfill)}
.hatch{fill:none;stroke:var(--ink);stroke-width:.5;opacity:.85}
.solid{fill:var(--ink);stroke:var(--ink);stroke-width:.9}
.bore{fill:var(--stage);stroke:var(--ink);stroke-width:.9}
.pin{fill:var(--step);stroke:var(--ink);stroke-width:1.3;stroke-linejoin:round}
.pin.driver{fill:var(--slab)}
.spring{fill:none;stroke:var(--ink);stroke-width:.9;stroke-linejoin:round}
.pin.block{stroke:var(--t-bad);fill:color-mix(in oklab,var(--t-bad) 22%,var(--stage));stroke-width:2}
.pin.binding{stroke:var(--orange);stroke-width:2.2}
.vz[data-named] .pin.named{stroke-width:2.4}
.key-body{fill:var(--orange-tint);stroke:var(--orange);stroke-width:1.5;stroke-linejoin:round}
.key-line{fill:none;stroke:var(--orange);stroke-width:.7}
.tool{fill:var(--orange-tint);stroke:var(--orange);stroke-width:1.3;stroke-linejoin:round}
.hid .key-body,.hid .key-line,.hid .pin{fill:none;stroke-dasharray:5 3;stroke-width:.9}
.hid .key-line{display:none}
.cam{fill:var(--slab);stroke:var(--ink);stroke-width:1.5}
.shear-line{fill:none;stroke:var(--blue);stroke-width:1.8}
.lit .shear-line{stroke-width:3}
.lit .pin{stroke-width:2}.lit .key-body,.lit .tool{stroke-width:2.4}
.vz[data-practice] #fig .detail,.vz[data-practice] #fig .label[data-label^="d"],.vz[data-lab] #fig .label[data-label^="d"]{visibility:hidden}
.vz[data-lab] #keyOut{visibility:hidden}
.vz[data-practice] #fig .label{visibility:hidden}
.turnarrow{fill:none;stroke:var(--ink);stroke-width:1.3}
.centre{fill:none;stroke:var(--ink);stroke-width:.5;stroke-dasharray:14 3 2 3}
.secline{fill:none;stroke:var(--ink);stroke-width:1.8}
.leader{fill:none;stroke:var(--ink);stroke-width:.5}
.ldot{fill:var(--ink)}
.label.warn text{fill:var(--t-bad)}
.label.warn .ldot{fill:var(--t-bad)}.label.warn .leader{stroke:var(--t-bad)}
.label text{font-size:${FS}px;font-weight:500}
.dim{fill:none;stroke:var(--ink);stroke-width:.5}
.dimhead{fill:var(--ink)}
.dimtext{font-size:${FS}px;font-weight:500;font-variant-numeric:tabular-nums}
.label text,.dimtext,.det-tag{paint-order:stroke;stroke:var(--stage);stroke-width:32px;stroke-linejoin:round}
.detail{transition:opacity .45s ease}
.detail.dim{opacity:.35}
.det-bg{fill:var(--stage)}
.det-ring{fill:none;stroke:var(--ink);stroke-width:1.5}
.det-title{font-size:${FS * 0.88}px;letter-spacing:.08em;font-weight:600}
.det-tag{font-size:${FS * 1.1}px;font-weight:600}
.tb-frame{fill:none;stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.84}px;font-weight:600;letter-spacing:.06em}
.tb-text{font-size:${FS * 0.8}px}
.tb-key{font-size:${FS * 0.76}px}
.tb-small{font-size:${FS * 0.78}px;fill:var(--ink-2)!important}
.k-blue{stroke:var(--blue);stroke-width:1.8}.k-orange{stroke:var(--orange);stroke-width:1.8}.k-red{stroke:var(--t-bad);stroke-width:1.8}
@media (prefers-reduced-motion:reduce){.part,.detail{transition:none}}
`;

const HTML = drawingPage({
  title: "Pin Tumbler Lock",
  about: "Five split pins and one shear line: why only the right key turns, and how a pick gets round it.",
  scene: "pin-tumbler",
  steps: STEPS,
  stageLabel: "Pin tumbler lock. Left and right arrows step through the explanation; space plays and pauses.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Long section of a pin tumbler cylinder with five pin stacks, a key, and a cross-section through the third chamber",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: std.captions[0],
  whatIf: { label: "Lock tolerance", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-ins">0.0</b> mm key in</span>
            <span><b id="r-on">0 / 5</b> <span id="r-on-unit">gaps on the line</span></span>
            <span><b id="r-miss">0.00</b> mm worst miss</span>
            <span><b id="r-tol">±0.10</b> mm allowed</span>
            <span><b id="r-angle">0°</b> plug turn</span>
            <span><b id="r-state">locked</b></span>`,
  readoutNote: "Readouts are computed from the pins' contact with the key",
  legend: [
    ["var(--blue)", "The shear line, where plug meets housing"],
    ["var(--orange)", "The key, or the pick and the pin it is lifting"],
    ["var(--t-bad)", "A pin across the shear line, blocking the plug"],
    ["var(--ink)", "Everything else, in ink; the plug's section is tinted"],
  ],
  facts: [
    `The lock's pinning (${M0.pinning.join("-")}) and each key's cuts are separate tables. Each stack's height comes from contact between its key pin's 45° chamfered tip and the blade profile; the key code is never read.`,
    "The plug turns only if every key pin's top is within the allowance of the shear line. Tests check this against an independent rule (cut depth equals pin depth, within the allowance) on every one-off key and 2,000 random ones, for both locks.",
    "An insertion sweep, 0.02 mm at a time, checks that no pin enters the blade and no spring is crushed solid; planted faults prove the checks can fail.",
    `Picking: chamber offsets of ${OFFSETS.map((o) => o.toFixed(3)).join(", ")} mm set the binding order ${bindingOrder().map((i) => i + 1).join(", ")}. Tests check that each set chamber leaves nothing across the line and that all five set frees the plug.`,
    `Assumptions: dimensions are representative of a five-pin residential cylinder (plug Ø${(2 * L.R).toFixed(1)}, chamber pitch ${L.pitch}, depth step ${L.step}), not one maker's drawing. With no key, each key pin rests on a stop ${-L.rest} mm below the axis (in a real lock, the keyway's wards). The allowance stands in for the chamfers and wear that let a pin slip past the line.`,
  ],
  css: CSS,
  modelSrc,
  machine,
  data: DATA,
});

// node examples/lock/build.mjs [--out <file>]; the page goes to dist/lock.html by default.
const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "lock.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
