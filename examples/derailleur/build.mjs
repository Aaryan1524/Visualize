// node examples/derailleur/build.mjs  ->  dist/derailleur.html (or --out <file>).
// The rear derailleur as a Drawing page with an isometric figure on Visualize's rig (src/rig): the
// real parts (cassette, chain, parallelogram, cage and pulleys, hanger, cable, limit screws,
// barrel adjuster) as shaded solids, each drawn once and placed from the model every moment by
// figure.mjs, inside the shared Drawing page and player (src/drawing/).
//
// The story: the problem (one cable, eleven cogs, a chain that must stay tight), the parts, a
// click of cable, the return spring, shifting needs pedalling (ramps and pins), the slack take-up
// (with the prediction: what turns the cage forward?), the limit and B screws, and cable
// tension with the barrel adjuster. The lab sets a gear, a cable error and the L screw.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { MODELS, VARIANTS, DR, makeModel, clickPull, indexing, BANDS, shares } from "./model.mjs";
import { cameraFor, XCUT, VIEW_A } from "./figure.mjs";
import { screenOf } from "../../src/rig/index.ts";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");

// ---------------------------------------------------------------- frame and scale
// The SVG works in "units", 14200 x 6550, like the lock and the escalator, so the player's leader
// offsets and type sizes carry over: about 10 units to a screen pixel at 1440 x 900.
const VBW = 14200, VBH = 6550, FS = 150, UNIT = 10;
const f1 = (v) => (Math.round(v * 10) / 10).toString();
// The main view: each cassette's camera is fitted to its own gears, so the figure fills the stage.
const BOX = { x: 4300, y: 260, w: 5100, h: 6080 };
// The inset: View A, from behind and a little outboard, magnified, following the guide pulley.
const INSET = { c: [12180, 2260], r: 2000, azimuth: VIEW_A.azimuth, elevation: VIEW_A.elevation };
INSET.scale = INSET.r / 27; // 27 mm either side of its centre

// ---------------------------------------------------------------- the story
const PRED_STEP = 4;
const G3 = 3; // the story starts in the fourth gear
const STEPS = [
  { tab: null, heading: "How does one cable choose among eleven cogs?", focus: null },
  { tab: "The parts", heading: "A sprung parallelogram hangs a cage of two pulleys under the cassette.", focus: null },
  { tab: "One click", heading: null, focus: ["cable", "links", "pknuckle", "bknuckle", "guide", "tension", "cage", "chain", "cassette", "barrel"] },
  { tab: "Return spring", heading: "Let cable out, and the return spring pulls the derailleur back out.", focus: ["rspring", "links", "pknuckle", "bknuckle", "guide", "tension", "cage", "chain", "cassette", "cable"] },
  { tab: "Pedal to shift", heading: "The pulley moves at once; the chain waits for a ramp to come round.", focus: ["guide", "tension", "cage", "pknuckle", "chain", "cassette"] },
  { tab: "Slack", heading: null, focus: ["cage", "guide", "tension", "chain", "cassette", "forces", "pknuckle"] },
  { tab: "Limit screws", heading: "Two screws stop the swing at the end cogs; a third sets the gap.", focus: ["bknuckle", "links", "pknuckle", "guide", "tension", "cage", "chain", "cassette", "hanger"] },
  { tab: "Barrel adjuster", heading: "A slack cable puts every cog but the smallest off line; the barrel adjuster takes it up.", focus: ["cable", "barrel", "bknuckle", "pknuckle", "guide", "tension", "cage", "chain", "cassette", "links"] },
];
const STRETCH = -1.0; // mm of cable slack in the barrel adjuster step
const OVER = 2.0; // mm of extra cable pull against the L screw in the limit screw step
const rnd = (v) => Math.round(v);
const two = (v) => v.toFixed(2);
const one = (v) => v.toFixed(1);

function headings(M) {
  const N = M.N;
  return {
    2: `One click pulls ${two(M.clickPull)} mm of cable; the guide pulley moves one cog, ${M.D.pitch} mm.`,
    5: `On the ${N.big}, the chain pulls the cage ${rnd(N.swing)}° forward, against its spring.`,
  };
}

function captions(M) {
  const N = M.N, D = M.D, road = MODELS.road.N, wide = MODELS.wide.N;
  const cable = (mm) => two(mm / D.ratio); // mm off line, as mm of cable
  const sh = shares(M); // the figures printed so that every sum on the page adds up
  return [
    `A rear derailleur must put a turning chain on any one of ${M.n} cogs (${M.cogs.join(", ")} teeth), ${D.pitch} mm apart, using one cable. The ${N.big} wraps ${rnd(N.extraWrap)} mm more chain than the ${N.small}, and the chain is a fixed length, so the cage pays out chain as the chain climbs the cassette and takes it back as the chain drops, and the chain is never over-tight on the largest cog and never loose on the smallest.`,
    `The derailleur bolts to the frame's hanger at its B-knuckle. A parallelogram of two links and four pins carries the P-knuckle, which carries the cage. The cable pulls the parallelogram inboard; a return spring stretched across it pulls it back out. The cage holds the guide pulley, which steers the chain onto a cog, and the tension pulley, which keeps the chain tight. Both pulleys have ${D.pulleyT} teeth; the cage is ${M.v.cage} mm between pulley centres.`,
    `Each click of an 11-speed road shifter pulls ${two(M.clickPull)} mm of cable. The parallelogram's actuation ratio is ${D.ratio} : 1, so the guide pulley moves ${two(M.clickPull)} × ${D.ratio} = ${D.pitch} mm, exactly one cog. The links are rigid, so the pulley travels on an arc about their fixed pins: it swings through ${rnd(N.linkSwing)}° from the smallest cog to the largest. On a real derailleur the short and long cage versions share one linkage and differ only in the cage; here the linkage is refitted for each cassette, so the guide pulley clears both end cogs by the same gap, which is why the swing is ${rnd(road.linkSwing)}° with the ${road.big}-tooth cassette and ${rnd(wide.linkSwing)}° with the ${wide.big}.`,
    `A cable can only pull. Releasing a click lets ${two(M.clickPull)} mm of cable out, and the return spring pulls the parallelogram outboard by one cog; the chain drops to the smaller cog at the next gate.`,
    `The pulley moves as soon as the cable does, but the chain only moves to a new cog while it turns. Only forward pedalling drives the chain, so coasting and backpedalling do not shift. Each cog has ${D.gates} shift gates: a ramp cut into the teeth and a pin that catches the chain's plate. When a gate comes round under the off-line chain, the chain is lifted onto the bigger cog over about three links (${D.climb} mm of travel), or let down onto the smaller one. With the pedals still, the chain just runs at an angle.`,
    `The ${N.big} wraps ${sh.extra} mm more chain than the ${N.small}, and the chain (${M.links} links) cannot stretch, so that chain comes out of the rest of the loop: ${sh.cage} mm from the loop through the cage, and the other ${sh.rest} mm from the rest of the loop. There the lower run to the chainring gives up ${sh.lower} mm, once the tension pulley has moved ${rnd(N.forward)} mm forward, and the chainring's wrap ${sh.ring} mm, while the top run to the cog takes back ${sh.top} mm and the run from the cog to the guide pulley ${sh.run} mm: ${sh.lower} + ${sh.ring} − ${sh.top} − ${sh.run} = ${sh.rest} mm. The cage spring only ever turns the cage back, taking up slack, and it is the chain's pull on the tension pulley that turns the cage forward. On the ${N.big} the cage sits ${rnd(N.swing)}° further forward and the spring is wound from ${rnd(N.spring0)} to ${rnd(N.spring1)} N·mm, winding the spring tighter, so the slack side of the chain is held at ${one(N.tension1)} N instead of ${one(N.tension0)} N. The cage's angle in every frame is solved so the chain's length closes.`,
    `The H screw stops the parallelogram on the smallest cog's line, and the L screw on the largest. Backed out by ${D.dropoutGap} mm or more, the H screw lets the return spring pull the guide pulley ${D.dropoutGap} mm outboard of the smallest cog's line, once the cable is slack by ${one(N.spokePull)} mm, and the chain comes off outboard into the dropout. Backed out by ${D.spokeGap} mm or more, the L screw lets a cable pulled at least ${one(N.spokePull)} mm past the largest cog's pull carry the guide pulley ${D.spokeGap} mm inboard of that cog's line, where the chain reaches the spokes; with the L screw set, ${OVER} mm of extra pull (${one(OVER * D.ratio)} mm of travel) leaves the chain on the ${N.big}. The B screw turns the whole derailleur about its mounting bolt, which moves the guide pulley toward or away from every cog together. Set it with the chain on the largest cog, as close as it can run without touching: ${D.gap} mm tip to tip here. Too close, and the guide pulley's teeth reach the largest cog's; too far, and the chain crosses a longer unsupported run to the big cogs. On a real derailleur the gap is wider on the smaller cogs; here the linkage is refitted for each cassette to the same ${D.gap} mm on the smallest cog, so the gap is widest, ${one(N.gapMax)} mm, between the two.`,
    `Cables stretch and housings settle. If the cable runs ${Math.abs(STRETCH)} mm slack, every cog but the smallest lands ${Math.abs(STRETCH)} × ${D.ratio} = ${one(Math.abs(STRETCH * D.ratio))} mm outboard of its cog; the smallest is held on its line by the H screw and the return spring, so indexing trouble shows going up the cassette, not in the smallest cog. Past ${BANDS.quiet} mm off line (${cable(BANDS.quiet)} mm of cable) the chain rubs the next smaller cog; past ${BANDS.rubs} mm off line (${cable(BANDS.rubs)} mm of cable) it skips under load; past half a cog off line (${two(N.halfPitch)} mm, ${cable(N.halfPitch)} mm of cable) it sits on the wrong cog. A tight cable does the same the other way, rubbing the next larger cog, with the largest cog held on its line by the L screw. If the chain hesitates or rubs going up to a larger cog, the cable is slack, so turn the barrel adjuster out, counter-clockwise, to take it up. If the downshift hesitates or the chain rubs the next larger cog, the cable is tight, so turn it in, clockwise. Make the final adjustment while pedalling, trying every gear.`,
  ];
}

const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

// ---------------------------------------------------------------- the drawing skeleton for one variant
// The parts are drawn live; the build writes the layers, the callouts and the title block.
function skeleton(M, name) {
  const N = M.N;
  const cam = cameraFor(M, BOX);
  // the housing and the chain fade out toward the cut; the frame's stays fade away from the dropout
  const xa = screenOf(cam, [XCUT - 60, -20, 0])[0], xb = screenOf(cam, [XCUT - 4, -20, 0])[0];
  const dz = screenOf(cam, [4, -12, 0]);
  const defs = `<defs><linearGradient id="fadeXg" gradientUnits="userSpaceOnUse" x1="${f1(xa)}" x2="${f1(xb)}" y1="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="fadeX" maskUnits="userSpaceOnUse" x="0" y="0" width="${VBW}" height="${VBH}"><rect width="${VBW}" height="${VBH}" fill="url(#fadeXg)"/></mask><radialGradient id="fadeStaysG" gradientUnits="userSpaceOnUse" cx="${f1(dz[0])}" cy="${f1(dz[1])}" r="${f1(cam.scale * 95)}"><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="fadeStays" maskUnits="userSpaceOnUse" x="0" y="0" width="${VBW}" height="${VBH}"><rect width="${VBW}" height="${VBH}" fill="url(#fadeStaysG)"/></mask><clipPath id="insetClip"><circle cx="${INSET.c[0]}" cy="${INSET.c[1]}" r="${INSET.r}"/></clipPath></defs>`;
  const inset = `<g id="insetG" class="inset"><circle class="inset-bg" cx="${INSET.c[0]}" cy="${INSET.c[1]}" r="${INSET.r}"/><g clip-path="url(#insetClip)"><defs id="rigDefsA"></defs><g id="insetScene"></g></g><circle class="inset-ring" cx="${INSET.c[0]}" cy="${INSET.c[1]}" r="${INSET.r}"/><text class="inset-title" x="${INSET.c[0]}" y="${INSET.c[1] - INSET.r - 110}" text-anchor="middle">VIEW A · FROM BEHIND · FOLLOWS THE GUIDE PULLEY</text></g>`;
  // the title block
  const x0 = 10200, x1 = VBW - 80, y0 = 4950, y1 = VBH - 80;
  let tb = `<g class="tblock"><path class="tb-frame" d="M${x0},${y0}H${x1}V${y1}H${x0}Z"/><path class="tb-rule" d="M${x0},${y0 + 360}H${x1}M${x0},${y1 - 300}H${x1}"/>`;
  tb += `<text class="tb-title" x="${x0 + 110}" y="${y0 + 240}">REAR DERAILLEUR · ISOMETRIC · ${esc(M.v.label.toUpperCase())}</text><text class="tb-small" x="${x1 - 110}" y="${y0 + 240}" text-anchor="end">mm</text>`;
  const facts = [
    `${M.n} cogs ${M.cogs[0]}–${N.big} at ${DR.pitch} · chain ${M.links} links · ${DR.ring}T ring`,
    `Pulleys ${DR.pulleyT}T · cage ${M.v.cage} · ratio ${DR.ratio} : 1 · ${two(M.clickPull)} per click`,
    `Frame cut at the dropout; chain cut ahead of the cassette.`,
  ];
  facts.forEach((t, i) => (tb += `<text class="tb-text" x="${x0 + 110}" y="${y0 + 590 + i * 200}">${esc(t)}</text>`));
  tb += `<g id="tbkey" data-x0="${x0 + 110}">`;
  for (const [cls, t] of [["k-blue", "Cable"], ["k-green", "Springs"], ["k-orange", "Followed part"], ["k-red", "Off line"]]) tb += `<g class="tbk"><path class="${cls}" d="M0,${y1 - 140}h240"/><text class="tb-text tb-key" x="0" y="${y1 - 100}">${t}</text></g>`;
  tb += "</g></g>";
  return `${defs}<defs id="rigDefs"></defs><g id="scene"></g>${inset}<g id="labels">${LABELS.map(labelSvg).join("")}</g>${tb}`;
}

// Callouts: text placed in units; the leader is drawn live to the part's projected point (`to`,
// a name in the scene's anchor table), so it follows the part as it moves.
const label = (id, text, x, y, to, beats, anchor = "end", cls = "") => ({ id, text, at: [x, y], to, beats, anchor, cls });
const LX = 3900, RX = 9420;
const LABELS = [
  // step 1: every part, left and right, each column in the order of its targets
  label("cassette", "Cassette", RX, 800, "cassette", [1], "start"),
  label("chain", "Chain", RX, 1350, "chainUpper", [1], "start"),
  label("cable", "Housing", RX, 2450, "housing", [1, 2, 7], "start"),
  label("hanger", "Hanger", RX, 3050, "hanger", [1], "start"),
  label("pknuckle", "P-knuckle", RX, 3750, "pknuckle", [1], "start"),
  label("bknuckle", "B-knuckle", LX, 2700, "bknuckle", [1], "end"),
  label("links", "Parallelogram", LX, 3350, "links", [1, 2], "end"),
  label("guide", "Guide pulley", LX, 4300, "guide", [1, 2, 4], "end"),
  label("cage", "Cage", LX, 4950, "cage", [1], "end"),
  label("tension", "Tension pulley", LX, 5700, "tension", [1, 5], "end"),
  label("rspring", "Return spring", LX, 3350, "rspring", [3], "end"),
  label("gates", "Ramp and pin", RX, 1050, "gate", [4], "start"),
  label("springF", "Cage spring: turns it back", LX, 4300, "springForce", [5], "end"),
  label("chainF", "Chain: pulls it forward", LX, 4950, "chainForce", [5], "end"),
  label("hscrew", "H screw", LX, 2700, "hscrew", [6], "end"),
  label("lscrew", "L screw", LX, 3350, "lscrew", [6], "end"),
  label("bscrew", "B screw", RX, 3050, "bscrew", [6], "start"),
  label("barrel", "Barrel adjuster", RX, 3650, "barrel", [7], "start"),
];
const labelSvg = (l) => `<g class="label${l.cls ? " " + l.cls : ""}" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

// ---------------------------------------------------------------- per variant data
function variantData(name) {
  const v = VARIANTS[name], M = MODELS[name];
  const tracks = VOICE?.variants?.[name] ?? null;
  // On the narrated tour, each step's motion ends when the voice names what it is about.
  const MEET = [null, null, "guide", "rspring", "gates", "tension", "lscrew", "barrel"];
  const meet = (tracks || []).map((tr, k) => {
    const l = MEET[k] && tr.links.find((x) => x.ids.includes(MEET[k]));
    return l ? l.start + 0.35 : 0.8 * tr.duration;
  });
  const N = M.N;
  return {
    name, label: v.label,
    svg: skeleton(M, name),
    heads: headings(M),
    captions: captions(M),
    voice: tracks, meet,
    explanation: `The cage spring only ever turns the cage back, taking up slack. On the ${N.big} the cog wraps ${shares(M).extra} mm more chain, so the chain's pull on the tension pulley turns the cage ${rnd(N.swing)}° forward and winds the spring tighter, from ${rnd(N.spring0)} to ${rnd(N.spring1)} N·mm. The cage gives up ${shares(M).cage} mm of the chain it holds; the rest of the loop gives up the other ${shares(M).rest} mm.`,
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- the machine (runs in the page)
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz"), fig = $("fig");
  const STEPS = DATA.steps;
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const clamp = (u) => Math.max(0, Math.min(1, u));
  const IN = DATA.inset, G3 = DATA.g3;
  let V = null, model = null, cur = null;
  const SPEED = 60; // mm of chain a second while pedalling, about 70 rpm on the 50 ring at this cog

  // ------------------------------------------------ the machine's state through the story
  // pull: cable (mm, effective); chainK: the cog the chain is on (fractional while it climbs);
  // roll: mm of chain run since the step began; show: what the drawing marks.
  function stateAt(k, u, t) {
    const m = model, cp = m.clickPull, roll = SPEED * t;
    const base = { pull: G3 * cp, chainK: G3, roll, lOut: 0, err: 0, barrel: 0, show: {} };
    if (k <= 1) return base;
    if (k === 2 || k === 3) {
      // one click up (k = 2) or one released (k = 3); the chain follows at the next gate
      const from = k === 2 ? G3 : G3 + 1, to = k === 2 ? G3 + 1 : G3;
      const a = ease(clamp(u / 0.25));
      const since = Math.max(0, roll - SPEED * 0.25 * DATA.anim[k]);
      const f = u >= 1 ? 1 : m.shiftProgress(since, from, 0.35);
      return { ...base, pull: (from + (to - from) * a) * cp, chainK: from + (to - from) * f, show: { cutaway: k === 3 } };
    }
    if (k === 4) {
      // pedals still: click; the pulley moves, the chain waits. Then pedalling: a gate comes round.
      const a = ease(clamp(u / 0.2));
      const pedal = clamp((u - 0.5) / 0.5), r = pedal * SPEED * 0.5 * DATA.anim[k];
      const f = m.shiftProgress(r, G3, 0.55);
      return { ...base, roll: r, pull: (G3 + a) * cp, chainK: G3 + f, show: { gates: true } };
    }
    if (k === 5) {
      // climb the whole cassette while pedalling; the cage turns forward
      const kk = G3 + (m.last - G3) * ease(clamp(u));
      return { ...base, pull: Math.round(kk + 0.49) * cp, chainK: kk, show: { forces: true } };
    }
    if (k === 6) {
      // on the largest cog, a tight cable pulls on: the L screw holds it
      const extra = DATA.over * ease(clamp(u / 0.6));
      return { ...base, pull: m.last * cp + extra, chainK: m.last, show: { screws: true } };
    }
    // k === 7: the cable goes slack, every gear lands short; the barrel takes it up
    const gear = 5;
    const err = DATA.stretch * (u < 0.55 ? ease(clamp(u / 0.3)) : 1 - ease(clamp((u - 0.55) / 0.35)));
    const barrel = 2.5 * ease(clamp((u - 0.55) / 0.35));
    const x = indexing(m, gear + 1, err);
    return { ...base, pull: x.pull, chainK: x.on, err, barrel, show: { offline: true } };
  }
  // A step's motion fills the stretch before the voice names what it is about (or 6 s silent).
  const anim = (k) => (V.voice?.[k] ? Math.max(2, V.meet[k]) : 0.75 * DATA.plain);
  const POSE = [0, 0, 1, 1, 0.42, 1, 1, 0.42];
  // The cassette turns as one block, driven by the chain on whichever cog it is on: its angle is the
  // chain run so far over that cog's radius, summed through a climb so it never jumps. Each step
  // seats the chain in its starting cog's valleys once, at its first frame.
  const DT = 1 / 50;
  let turns = new Map(), phases = new Map();
  const stateIn = (k, tt) => stateAt(k, clamp(tt / anim(k)), tt);
  function turnAt(k, tt) {
    let tab = turns.get(k);
    if (!tab) turns.set(k, (tab = [0]));
    const need = Math.ceil(tt / DT);
    for (let i = tab.length; i <= need; i++) {
      const a = stateIn(k, (i - 1) * DT), b = stateIn(k, i * DT);
      tab.push(tab[i - 1] - (b.roll - a.roll) / model.cogR((a.chainK + b.chainK) / 2));
    }
    const i = Math.min(need, Math.floor(tt / DT)), f = tt / DT - i;
    return tab[i] + ((tab[i + 1] ?? tab[i]) - tab[i]) * f;
  }
  function phaseOf(k) {
    if (!phases.has(k)) {
      const s0 = stateIn(k, 0), p0 = model.pose(s0.pull, s0.chainK, s0.lOut ?? 0);
      phases.set(k, FIG.seatPhase(model, p0, s0.roll, 0));
    }
    return phases.get(k);
  }
  const at = (k, t, still, SEG) => {
    DATA.anim = DATA.anim || [];
    DATA.anim[k] = anim(k);
    // a still frame of a pedalling step shows the chain where it has run to
    const tt = still ? POSE[k] * anim(k) : Math.max(0, t - SEG.lead);
    const s = stateIn(k, tt);
    return { ...s, k, u: clamp(tt / anim(k)), turn: turnAt(k, tt), phase: phaseOf(k) };
  };
  const stillAt = (k, SEG) => SEG.lead + POSE[k] * anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    turns = new Map();
    phases = new Map();
    // Every part drawn once for this variant, in the main camera and in View A's; the stages then
    // only place them each frame.
    const cam = FIG.cameraFor(model, DATA.box);
    figM = FIG.figure(model, cam, { prefix: "m" });
    figA = FIG.figure(model, { azimuth: IN.azimuth, elevation: IN.elevation, scale: IN.scale, origin: [0, 0] }, { prefix: "a", inset: true });
    defsM = $("rigDefs");
    defsA = $("rigDefsA");
    defsM.replaceChildren();
    defsA.replaceChildren();
    $("scene").replaceChildren();
    $("insetScene").replaceChildren();
    stageM = new FIG.RigStage($("scene"));
    stageA = new FIG.RigStage($("insetScene"));
    for (const pt of figM.parts) stageM.add(pt.id, pt.part, pt.svg);
    for (const pt of figA.parts) stageA.add(pt.id, pt.part, pt.svg);
  }

  // ------------------------------------------------ drawing one moment
  let figM = null, figA = null, stageM = null, stageA = null, defsM = null, defsA = null;
  const addDefs = (host, list) => list.length && host.insertAdjacentHTML("beforeend", list.join(""));
  function poseOf(s) {
    return model.pose(s.pull, s.chainK, s.lOut ?? 0);
  }
  let lastAt = null, lastFocus = { focus: null, lit: [] };
  function render(state, S) {
    cur = state;
    const pose = poseOf(state);
    cur.pose = pose;
    const st = { ...state, pose };
    const out = figM.pose(st);
    addDefs(defsM, out.defs);
    stageM.apply(out.items);
    lastAt = out.at;
    // View A is drawn once at the world origin and only slides to keep the guide pulley centred
    const focus = [pose.G[0], (-model.cogR(pose.chainK) + pose.G[1] + model.r) / 2 - 3, (pose.e + pose.chainE) / 2];
    const fa = FIG.screenOf({ azimuth: IN.azimuth, elevation: IN.elevation, scale: IN.scale, origin: [0, 0] }, FIG.W(focus[0], focus[1], focus[2]));
    $("insetScene").setAttribute("transform", `translate(${(IN.c[0] - fa[0]).toFixed(1)} ${(IN.c[1] - fa[1]).toFixed(1)})`);
    const ina = figA.pose(st);
    addDefs(defsA, ina.defs);
    stageA.apply(ina.items);
    focusParts();
    readouts(state, pose);
  }
  // Out-of-focus parts recede in tone, not by opacity: a see-through solid would show what it hides.
  function focusParts() {
    const { focus, lit } = lastFocus;
    const lab = root.hasAttribute("data-lab");
    const test = (part) => ({ recede: lit.length ? !lit.includes(part) : !lab && focus ? !focus.includes(part) : false, named: lit.includes(part) });
    stageM?.focus(test);
    stageA?.focus(test);
  }
  const focus = (f) => {
    lastFocus = f;
    focusParts();
  };
  const R = {};
  const setText = (id, v) => {
    if (R[id] !== v) ((R[id] = v), ($(id).textContent = v));
  };
  function readouts(state, p) {
    const m = model;
    setText("r-cog", `${m.cogs[Math.round(p.chainK)]}`);
    // while the chain waits for a gate, say where the pulley already is
    const under = m.cogs[p.cog], on = m.cogs[Math.round(p.chainK)];
    setText("r-cog-unit", under !== on && Math.abs(p.chainK - Math.round(p.chainK)) < 1e-9 ? `teeth · pulley under the ${under}` : "teeth");
    setText("r-pull", (p.pull).toFixed(2));
    setText("r-off", Math.abs(p.off) < 0.005 ? "0.00" : `${Math.abs(p.off).toFixed(2)}`);
    setText("r-off-unit", Math.abs(p.off) < 0.005 ? "mm off line" : p.off < 0 ? "mm outboard" : "mm inboard");
    setText("r-swing", `${Math.round(p.alpha - m.N.alpha0)}°`);
    setText("r-tension", p.tension.toFixed(1));
    setText("r-gap", p.gap.toFixed(1));
  }

  // ------------------------------------------------ the lab: your gear, your cable, your L screw
  function lab(values, variant) {
    const m = model;
    const gear = Number(values.gear), err = Number(values.err), lOut = Number(values.lout);
    const x = indexing(m, gear, err, lOut);
    const teeth = m.cogs[x.k], onT = m.cogs[x.on];
    const rows = [
      `Cable: ${two(m.pullFor(x.k))} mm for cog ${gear}, ${err >= 0 ? "+" : "−"}${Math.abs(err).toFixed(1)} mm error: ${two(Math.max(0, x.pull))} mm pulled.`,
      `Guide pulley: ${(x.z).toFixed(2)} mm inboard of the smallest cog's line; the ${teeth} is at ${m.cogZ(x.k).toFixed(2)} mm.`,
      x.stopped === "high" ? "The H screw stops it on the smallest cog's line." : x.stopped === "low" ? (lOut > 0 ? `The L screw, backed out ${lOut.toFixed(1)} mm, stops it ${(x.z - m.zMax).toFixed(1)} mm past the largest cog.` : `The L screw stops it on the ${m.N.big}'s line.`) : `${Math.abs(err).toFixed(1)} × ${m.D.ratio} = ${(Math.abs(err) * m.D.ratio).toFixed(2)} mm off its cog.`,
    ];
    const verdict = {
      quiet: `Runs clean on the ${onT}: ${Math.abs(x.off).toFixed(2)} mm off, inside ${DATA.bands.quiet} mm.`,
      rubs: `Rubs: ${Math.abs(x.off).toFixed(2)} mm ${x.side} of the ${onT}, past ${DATA.bands.quiet} mm. Turn the barrel adjuster ${x.off < 0 ? "out" : "in"}.`,
      skips: `Skips under load: ${Math.abs(x.off).toFixed(2)} mm ${x.side} of the ${onT}.`,
      wrong: `Wrong cog: the chain sits on the ${onT}, not the ${teeth}.`,
      over: `Past the largest cog: the guide pulley is ${(x.z - m.zMax).toFixed(2)} mm inboard of the ${m.N.big}, pushing the chain toward the spokes.`,
      spokes: `In the spokes: the guide pulley is ${(x.z - m.zMax).toFixed(1)} mm past the ${m.N.big}. Set the L screw.`,
    }[x.cls];
    const ok = x.cls === "quiet";
    return {
      ok, verdict, rows,
      state: { pull: x.pull, chainK: x.on, lOut, roll: 0, err, barrel: 0, show: { offline: true, screws: !!x.stopped }, lab: true, cls: x.cls },
    };
  }
  const two = (v) => v.toFixed(2);

  // ------------------------------------------------ now you try: questions made from the model
  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
  const mm = (v) => `${v.toFixed(2)} mm`;
  const VERD = { quiet: "It runs clean", rubs: "It rubs the next cog", skips: "It skips under load", wrong: "It sits on the wrong cog" };
  function question(n, r) {
    const kind = n % 5, D = model.D, N = model.N;
    if (kind === 0) {
      const g = 2 + Math.floor(r() * (model.n - 1));
      return {
        q: `Each click moves the guide pulley one cog (${D.pitch} mm), and the actuation ratio is ${D.ratio} : 1. How much cable does the shifter pull to go from the smallest cog to cog ${g}, counting from the smallest?`,
        choices: [mm(model.pullFor(g - 1)), mm((g - 1) * D.pitch), mm((g - 1) * D.pitch * D.ratio)],
        explain: `${g - 1} clicks of ${D.pitch} ÷ ${D.ratio} = ${model.clickPull.toFixed(3)} mm each: ${model.pullFor(g - 1).toFixed(2)} mm of cable, which the parallelogram turns into ${((g - 1) * D.pitch).toFixed(2)} mm of travel.`,
      };
    }
    if (kind === 1) {
      const e = pick(r, [0.3, 0.5, 0.7, 1.2, 1.5]) * pick(r, [-1, 1]);
      return {
        q: `The cable is ${Math.abs(e)} mm too ${e < 0 ? "slack" : "tight"}. With a ${D.ratio} : 1 derailleur, how far off its cog does every cog land, except the one a limit screw holds (the smallest when the cable is slack, the largest when it is tight)?`,
        choices: [mm(Math.abs(e * D.ratio)), mm(Math.abs(e)), mm(Math.abs(e / D.ratio))],
        explain: `Every mm of cable moves the pulley ${D.ratio} mm, so ${Math.abs(e)} × ${D.ratio} = ${(Math.abs(e) * D.ratio).toFixed(2)} mm ${e < 0 ? "outboard, toward the smaller cogs; the H screw holds the smallest cog on its line" : "inboard, toward the bigger cogs; the L screw holds the largest cog on its line"}.`,
      };
    }
    if (kind === 2) {
      const g = 2 + Math.floor(r() * (model.n - 2)), e = pick(r, [-1.6, -1.0, -0.6, -0.2, 0.3, 0.7, 1.1, 1.5]);
      const x = indexing(model, g, e), others = Object.keys(VERD).filter((c) => c !== x.cls);
      const a = others[Math.floor(r() * 3)], b = others.filter((c) => c !== a)[Math.floor(r() * 2)];
      return {
        q: `Cog ${g} (counting from the smallest), with the cable ${Math.abs(e)} mm too ${e < 0 ? "slack" : "tight"}. Quiet within ${DATA.bands.quiet} mm off line, rubbing to ${DATA.bands.rubs} mm off line, skipping to half a cog off line. What does the chain do?`,
        choices: [VERD[x.cls], VERD[a], VERD[b]],
        explain: `${Math.abs(e)} × ${D.ratio} = ${(Math.abs(e) * D.ratio).toFixed(2)} mm off; half a cog is ${(D.pitch / 2).toFixed(2)} mm. ${VERD[x.cls]}.`,
      };
    }
    if (kind === 3) {
      return {
        q: `The chain climbs from the ${N.small} to the ${N.big}, which wraps ${shares(model).extra} mm more chain round the cog. The chain cannot stretch, so the cage gives some up. What turns the cage, and which way?`,
        choices: ["The chain's pull turns it forward, against the spring", "The cage spring turns it forward", "The cable turns it back"],
        explain: `The cage spring only ever turns the cage back, taking up slack. The bigger cog takes chain from the loop through the cage (${shares(model).cage} mm of it) and from the rest of the loop (${shares(model).rest} mm), so the chain's pull on the tension pulley turns the cage ${Math.round(N.swing)}° forward and winds the spring from ${Math.round(N.spring0)} to ${Math.round(N.spring1)} N·mm.`,
      };
    }
    const which = pick(r, ["H", "L"]);
    return {
      q: which === "L" ? `A rider's chain went over the ${N.big} and into the spokes. Which screw was set too far out?` : `When shifting down, the chain comes off the ${N.small} outboard and into the dropout. Which screw was set too far out?`,
      choices: which === "L" ? ["The L screw", "The H screw", "The B screw"] : ["The H screw", "The L screw", "The B screw"],
      explain: which === "L" ? "The L screw stops the parallelogram on the largest cog's line, so the cage cannot swing on into the spokes." : "The H screw stops the parallelogram on the smallest cog's line, so the return spring cannot pull the guide pulley, and the chain, outboard past it.",
    };
  }

  return {
    model: (v) => MODELS_IN_PAGE[v.name],
    mount, at, stillAt,
    render, focus, anchors: () => lastAt, lab, question,
    heading: (k) => V.heads[k] ?? null,
    info: () => (cur ? { pull: cur.pull, chainK: cur.chainK, err: cur.err, lOut: cur.lOut, alpha: cur.pose?.alpha, z: cur.pose?.z, off: cur.pose?.off, swing: cur.pose ? cur.pose.alpha - model.N.alpha0 : null, tension: cur.pose?.tension, at: lastAt } : {}),
  };
}

// ---------------------------------------------------------------- page
const bundle = buildSync({ entryPoints: [join(HERE, "figure.mjs")], bundle: true, format: "iife", globalName: "FIG", write: false, minify: true, legalComments: "none" }).outputFiles[0].text;
if (/<\/script/i.test(bundle)) throw new Error("the figure bundle contains </script");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "") + "\nconst MODELS_IN_PAGE = MODELS;\n";
const std = VARIANT_DATA.road, M0 = MODELS.road;

const DATA = {
  box: BOX, inset: INSET, g3: G3, plain: 8, stretch: STRETCH, over: OVER, bands: BANDS,
  base: "road",
  steps: STEPS.map(({ heading, focus }) => ({ heading, focus })),
  alias: { forces: ["forces", "cage", "tension"], gates: ["cassette", "chain"], lscrew: ["bknuckle"], hscrew: ["bknuckle"], bscrew: ["bknuckle", "hanger"], barrel: ["cable"], housing: ["cable"] },
  predict: {
    step: PRED_STEP,
    question: `Next the chain climbs to the ${M0.N.big}, which wraps ${shares(M0).extra} mm more chain round the cog. The chain cannot stretch, so the cage has to give some up. What turns the cage forward to do it?`,
    choices: ["The chain's pull, against the cage spring", "The cage spring", "The cable"],
    answer: 0,
    explanation: Object.fromEntries(Object.entries(VARIANT_DATA).map(([k, v]) => [k, v.explanation])),
    locked: "Locked in. Press play to climb the cassette.",
  },
  lab: {
    button: "Adjust it",
    title: "Set a gear, a cable and the L screw",
    heading: "Does your gear run clean?",
    intro: `Pick a cog (1 is the smallest) and put the cable out of adjustment (minus is slack, as from stretch); back the L screw out to see what it guards.`,
    inputs: [
      { id: "gear", label: "Cog", min: 1, max: 11, step: 1, value: 6 },
      { id: "err", label: "Cable error", min: -3, max: 3, step: 0.1, value: -1, format: "{} mm" },
      { id: "lout", label: "L screw out", min: 0, max: 6, step: 0.5, value: 0, format: "{} mm" },
    ],
  },
  variants: VARIANT_DATA,
};

// The rig's look (src/rig/rig.css) plus the figure's own marks.
const CSS = `
${readFileSync(join(ROOT, "src/rig/rig.css"), "utf8")}
.vz{--green:#0f8a6c}
@media (prefers-color-scheme:dark){.vz:not([data-theme="light"]){--green:#3fbf9c}}
.vz[data-theme="dark"]{--green:#3fbf9c}
#fig{shape-rendering:geometricPrecision}
path,circle{vector-effect:non-scaling-stroke}
text{font-family:var(--sans);fill:var(--ink)}
/* the cog the chain is on takes the followed part's colour, faintly */
.rig-part[data-on]{--rig-steel-lit:color-mix(in oklab,var(--rig-subject-lit) 45%,#ffffff);--rig-steel-dark:color-mix(in oklab,var(--rig-subject-dark) 55%,#3a3631)}
.rig-part[data-touch]{--rig-alloy-lit:color-mix(in oklab,var(--orange) 35%,#fff);--rig-ink:var(--orange)}
.spoke{fill:none;stroke:color-mix(in oklab,var(--ink-2) calc(55% - var(--recede) * .4),var(--stage));stroke-width:.9px}
.housing{fill:none;stroke:color-mix(in oklab,var(--ink) calc(100% - var(--recede)),var(--stage));stroke-width:10px;stroke-linecap:round}
.housing-core{fill:none;stroke:color-mix(in oklab,#5d5a54 calc(100% - var(--recede)),var(--stage));stroke-width:6px;stroke-linecap:round}
.vz[data-theme="dark"] .housing-core{stroke:#77736b}
.cable{fill:none;stroke:color-mix(in oklab,var(--blue) calc(100% - var(--recede)),var(--stage));stroke-width:1.8px}
.force{fill:none;stroke-width:3px;stroke-linecap:round}
.force-head{stroke:none}
.spring-f{stroke:var(--green)}.force-head.spring-f{fill:var(--green)}
.chain-f{stroke:var(--orange)}.force-head.chain-f{fill:var(--orange)}
.offline{fill:none;stroke:var(--t-bad);stroke-width:3px}
.gate{fill:none;stroke:var(--orange);stroke-width:2.6px;stroke-linecap:round}
.gate-pin{fill:var(--orange);stroke:var(--stage);stroke-width:.8px}
.spring{fill:none;stroke-width:1.6px;stroke:color-mix(in oklab,var(--green) calc(100% - var(--recede)),var(--stage));stroke-linecap:round}
.spring.back{stroke-width:1.1px;stroke-opacity:.55}
.offline-end{fill:var(--t-bad)}
.engrave{font:600 64px var(--mono);fill:var(--ink-2)}
.inset-bg{fill:color-mix(in oklab,var(--stage) 94%,var(--ink))}
.inset-ring{fill:none;stroke:var(--ink);stroke-width:1.2}
.inset-title{font-size:${FS * 0.82}px;letter-spacing:.08em;font-weight:600}
.vz[data-practice] #fig .inset,.vz[data-practice] #fig .label{visibility:hidden}
.leader{fill:none;stroke:var(--ink);stroke-width:.5}
.ldot{fill:var(--ink)}
.label text{font-size:${FS}px;font-weight:500}
.label text{paint-order:stroke;stroke:var(--stage);stroke-width:32px;stroke-linejoin:round}
.tb-frame{fill:none;stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.8}px;font-weight:600;letter-spacing:.06em}
.tb-text{font-size:${FS * 0.78}px}
.tb-key{font-size:${FS * 0.74}px}
.tb-small{font-size:${FS * 0.78}px;fill:var(--ink-2)!important}
.k-blue{stroke:var(--blue);stroke-width:1.8}.k-green{stroke:var(--green);stroke-width:1.8}.k-orange{stroke:var(--orange);stroke-width:1.8}.k-red{stroke:var(--t-bad);stroke-width:1.8}
`;

// ---------------------------------------------------------------- the correctness audit
// Every gear, and every quarter-cog of a climb, for the claims that hold through a shift.
const sweep = (m) => Array.from({ length: 4 * m.last + 1 }, (_, q) => q / 4).map((k) => ({ k, p: m.pose(m.pullFor(Math.round(k)), k) }));
const R = DR.ratio;
// the model's own variant, for claims that compare a changed setting with this one
const withDr = (m, dr) => makeModel({ variant: m.v, dr });
const gapAt = (m, k) => m.pose(m.pullFor(k), k).gap;
const AUDIT = {
  models: Object.values(MODELS),
  // numbers the build derives: the cable and slack figures, thresholds in cable, and the travel of an over-pull
  facts: [STRETCH, OVER, Math.abs(STRETCH * R), OVER * R, BANDS.quiet, BANDS.rubs, BANDS.quiet / R, BANDS.rubs / R, DR.pitch / 2 / R],
  allow: [{ value: 1, why: "the 1 of a ratio written 1.4 : 1, and one millimetre of slack" }],
  claims: [
    { text: "the cage pays out chain as the chain climbs the cassette and takes it back as the chain drops", test: (m) => m.cogs.every((_, k) => k === 0 || m.inCage(k) < m.inCage(k - 1)) },
    { text: "The bigger cog takes chain from the loop through the cage", test: (m) => m.inCage(m.last) < m.inCage(0) },
    { text: "most of the rest from the lower run to the chainring", test: (m) => m.N.lowerShort > m.N.restShort / 2 && m.N.forward > 0 && Math.abs(m.N.takeUp + m.N.restShort - m.N.extraWrap) < 1e-9 },
    { text: "29 + 12 − 5 − 10 = 26 mm", test: (m) => { const x = shares(m), n = Number; return Math.abs(n(x.extra) - n(x.cage) - n(x.rest)) < 1e-9 && Math.abs(n(x.rest) - n(x.lower) - n(x.ring) + n(x.top) + n(x.run)) < 1e-9; } },
    { text: "the lower run to the chainring gives up 29 mm, once the tension pulley has moved 31 mm forward", test: (m) => m.N.lowerShort > 0 && m.N.forward > 0 },
    { text: "the chainring's wrap 12 mm, while the top run to the cog takes back 5 mm and the run from the cog to the guide pulley 10 mm", test: (m) => m.N.ringShort > 0 && m.N.topLonger > 0 && m.N.cogRunLonger > 0 },
    { text: "with the largest cog held on its line by the L screw", test: (m) => indexing(m, m.n, 1).off === 0 && indexing(m, m.n, 1).stopped === "low" && indexing(m, 1, 1).off > 0 },
    { text: "The cage spring only ever turns the cage back, taking up slack", test: (m) => sweep(m).every(({ p, k }) => p.spring < 0 && m.lengthAt(m.cogR(k), p.G, p.alpha - 2) > m.L) },
    { text: "it is the chain's pull on the tension pulley that turns the cage", test: (m) => sweep(m).every(({ p, k }) => p.chainArm > 0 && m.lengthAt(m.cogR(k), p.G, p.alpha + 2) < m.L) },
    { text: "winding the spring tighter", test: (m) => m.N.spring1 > m.N.spring0 && m.N.tension1 > m.N.tension0 },
    { text: "the chain wraps about a third of each cog here", test: (m) => [0, m.last].every((k) => { const w = (m.pose(m.pullFor(k), k).path.wraps[1].w * 180) / Math.PI; return w > 100 && w < 140; }) },
    { text: "so the guide pulley moves exactly one cog", test: (m) => Math.abs(m.clickPull * m.D.ratio - m.D.pitch) < 1e-12 && m.cogs.every((_, k) => Math.abs(m.travel(m.pullFor(k)) - m.cogZ(k)) < 1e-9) },
    { text: "The links are rigid, so the pulley travels on an arc about their fixed pins", test: (m) => [0, 0.25, 0.5, 0.75, 1].every((f) => { const g = m.guide3(f * m.zMax); return Math.abs(Math.hypot(g[0] - m.centre[0], g[1] - m.centre[1], g[2] - m.centre[2]) - m.link) < 1e-6; }) },
    { text: "the linkage is refitted for each cassette, so the guide pulley clears both end cogs by the same gap", test: (m) => [0, m.last].every((k) => Math.abs(gapAt(m, k) - m.D.gap) < 1e-6) && Math.abs(MODELS.road.N.linkSwing - MODELS.wide.N.linkSwing) > 5 },
    { text: "the shifter lets the cable out, so the return spring pulls the parallelogram back out", test: (m) => m.cogs.every((_, k) => k === 0 || Math.abs(m.travel(m.pullFor(k) - m.clickPull) - m.cogZ(k - 1)) < 1e-9) },
    { text: "the chain only moves while it turns", test: (m) => m.cogs.every((_, k) => m.shiftProgress(0, k) === 0) },
    { text: "coasting and backpedalling do not shift", test: (m) => m.cogs.every((_, k) => k === m.last || [0, -1, -30, -300].every((t) => m.shiftProgress(t, k) === 0)) },
    { text: "With the pedals still, the pulley moves at once and the chain just runs at an angle", test: (m) => { const p = m.pose(m.pullFor(4), 3); return Math.abs(p.z - m.cogZ(4)) < 1e-9 && p.chainE !== p.e && Number.isFinite(p.alpha); } },
    { text: "The H screw stops the parallelogram on the smallest cog's line", test: (m) => m.travel(-5) === 0 },
    { text: "the L screw on the largest", test: (m) => m.travel(m.pullFor(m.last) + 5) === m.zMax },
    { text: "the H screw lets the return spring pull the guide pulley 4 mm outboard of the smallest cog's line, once the cable is slack by 2.9 mm", test: (m) => m.D.dropoutGap === 4 && indexing(m, 1, -3, 0, 4).dropout && !indexing(m, 1, -2.8, 0, 4).dropout && !indexing(m, 1, -3, 0, 3.9).dropout && !indexing(m, 1, -3).dropout },
    { text: "the L screw lets a cable pulled at least 2.9 mm past the largest cog's pull carry the guide pulley 4 mm inboard of that cog's line", test: (m) => m.D.spokeGap === 4 && indexing(m, m.n, 2.86, 4).spokes && !indexing(m, m.n, 2.8, 4).spokes && !indexing(m, m.n, 9, 3.9).spokes },
    { text: "with the L screw set, 2 mm of extra pull (2.8 mm of travel) leaves the chain on the 28", test: (m) => indexing(m, m.n, OVER, 0).stopped === "low" && Math.abs(indexing(m, m.n, OVER, 0).z - m.zMax) < 1e-9 && Math.abs(OVER * m.D.ratio - 2.8) < 1e-9 },
    { text: "which moves the guide pulley toward or away from every cog together", test: (m) => { const up = m.cogs.map((_, k) => m.bGap(k, 1) - m.bGap(k, 0)); return up.every((d) => d < -0.05) || up.every((d) => d > 0.05); } },
    { text: "as close as it can run without touching", test: (m) => Math.abs(gapAt(m, m.last) - m.D.gap) < 1e-9 && m.D.gap > 0 && m.cogs.every((_, k) => gapAt(m, k) >= m.D.gap - 1e-9) },
    { text: "Too close, and the guide pulley's teeth reach the largest cog's", test: (m) => { const c = withDr(m, { gap: 0 }); return Math.abs(gapAt(c, c.last)) < 1e-6; } },
    { text: "too far, and the chain crosses a longer unsupported run to the big cogs", test: (m) => { const f = withDr(m, { gap: m.D.gap + 5 }), run = (x) => x.pose(x.pullFor(x.last), x.last).path.runs[1].L; return run(f) > run(m); } },
    { text: "the gap is widest, 13.4 mm, between the two", test: (m) => { const g = m.cogs.map((_, k) => gapAt(m, k)), top = Math.max(...g); return g.indexOf(top) > 0 && g.indexOf(top) < m.last && Math.abs(g[0] - m.D.gap) < 1e-6 && Math.abs(top - m.N.gapMax) < 1e-9; } },
    { text: "every cog but the smallest lands 1.4 millimetres outboard of its cog", test: (m) => m.cogs.every((_, k) => k === 0 ? indexing(m, 1, -1).off === 0 : Math.abs(indexing(m, k + 1, -1).off + 1.4) < 1e-9) },
    { text: "The smallest is held on its line by the H screw and the return spring", test: (m) => { const x = indexing(m, 1, -3); return x.off === 0 && x.stopped === "high" && x.cls === "quiet"; } },
    { text: "Past 0.6 mm off line (0.43 mm of cable) the chain rubs the next smaller cog", test: (m) => { const x = indexing(m, 6, -0.45), y = indexing(m, 6, -0.41); return x.cls === "rubs" && x.side === "outboard" && y.cls === "quiet"; } },
    { text: "past 1.3 mm off line (0.93 mm of cable) it skips under load", test: (m) => indexing(m, 6, -0.95).cls === "skips" && indexing(m, 6, -0.91).cls === "rubs" },
    { text: "past half a cog off line (1.87 mm, 1.34 mm of cable) it sits on the wrong cog", test: (m) => indexing(m, 6, -1.36).cls === "wrong" && indexing(m, 6, -1.32).cls === "skips" },
    { text: "A tight cable does the same the other way, rubbing the next larger cog", test: (m) => indexing(m, 6, 0.6).side === "inboard" && indexing(m, 6, 0.6).cls === "rubs" },
    { text: "if the chain hesitates or rubs going up to a larger cog, the cable is slack", test: (m) => m.cogs.every((_, k) => k < 1 || k === m.last || (indexing(m, k + 1, -1.5).on === k - 1 && indexing(m, k + 1, -0.6).side === "outboard")) },
    { text: "so turn the barrel adjuster out, counter-clockwise, to take it up", test: (m) => m.cogs.every((_, k) => Math.abs(indexing(m, k + 1, -1 + 1).off) < 1e-9) },
    { text: "If the downshift hesitates or the chain rubs the next larger cog, the cable is tight", test: (m) => m.cogs.every((_, k) => k < 1 || k === m.last || (indexing(m, k + 1, 1.5).on === k + 1 && indexing(m, k + 1, 0.6).side === "inboard")) },
    { text: "so turn it in, clockwise", test: (m) => m.cogs.every((_, k) => Math.abs(indexing(m, k + 1, 1 - 1).off) < 1e-9) },
  ],
  coverage: {
    source: "Park Tool, Rear Derailleur Adjustment (parktool.com repair help: limit screws, indexing with the barrel adjuster in both directions, the B-screw gap set with the chain on the largest cog and a 5 to 6 mm target, every shift checked by pedalling); Shimano dealer's manual DM-RARD001 (RD-R9100/R8000/R7000: stroke adjustment, B-tension adjustment, cable tension adjustment)",
    topics: [
      { topic: "the parts: hanger, B-knuckle, parallelogram, P-knuckle, cage and pulleys", where: "step:1" },
      { topic: "indexing: one click of cable moves the guide pulley one cog", where: "step:2" },
      { topic: "the return spring moves it back when cable is let out", where: "step:3" },
      { topic: "shifting only while pedalling: ramps and pins on the cogs", where: "step:4" },
      { topic: "coasting and backpedalling do not shift", where: "step:4" },
      { topic: "the cage spring takes up chain slack; the chain pulls the cage forward", where: "step:5" },
      { topic: "H and L limit screws", where: "step:6" },
      { topic: "the B screw and the guide pulley's gap, and what a wrong gap does", where: "step:6" },
      { topic: "the H screw's failure: the chain thrown outboard into the dropout", where: "step:6" },
      { topic: "cable tension and indexing with the barrel adjuster, slack and tight, and adjusting while pedalling", where: "step:7" },
      { topic: "rub and skip from a cable out of adjustment", where: "lab" },
      { topic: "cage length for a wider-range cassette", where: "whatif" },
      { topic: "chain length", core: false, where: "deferred", why: "sized here by the cage on the largest cog; the shop rules are a page of their own" },
      { topic: "hanger alignment", core: false, where: "deferred", why: "Park Tool checks it first, with a separate tool and procedure" },
      { topic: "taking up cable slack at the anchor bolt", core: false, where: "deferred", why: "a fitting step before indexing; named in Details" },
    ],
  },
  reviewFile: join(HERE, "review.json"),
  report: join(ROOT, "dist", "derailleur.audit.json"),
};

const HTML = drawingPage({
  title: "Rear Derailleur",
  about: "One cable, two springs and a slanted parallelogram put a turning chain on any of eleven cogs.",
  scene: "rear-derailleur",
  steps: STEPS,
  stageLabel: "Rear derailleur, drawn in isometric. Left and right arrows step through the explanation; space plays and pauses.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Isometric drawing of a bicycle rear derailleur under an eleven-cog cassette, with the chain, the parallelogram, the cage and its two pulleys, the cable and the adjusting screws, and a magnified view from behind",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: std.captions[0],
  whatIf: { label: "Cassette", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-cog">${M0.cogs[G3]}</b> <span id="r-cog-unit">teeth</span></span>
            <span><b id="r-pull">0.00</b> mm cable</span>
            <span><b id="r-off">0.00</b> <span id="r-off-unit">mm off line</span></span>
            <span><b id="r-swing">0°</b> cage swing</span>
            <span><b id="r-tension">0.0</b> N slack side</span>
            <span><b id="r-gap">0.0</b> mm gap</span>`,
  readoutNote: "Readouts are computed by the model on this page",
  legend: [
    ["var(--blue)", "The cable and its pull"],
    ["var(--green)", "The springs, and the cage spring's pull: always back"],
    ["var(--orange)", "The part to follow: the cage and pulleys, the chain's pull on them, the shift gates"],
    ["var(--t-bad)", "The chain out of line with its cog"],
  ],
  facts: [
    `The chain's path is solved, not drawn: ring, cog, guide pulley and tension pulley joined by tangent runs, with the cage angle found so the path is exactly ${M0.links} links of ${DR.p} mm. Tests re-measure every path point by point.`,
    `The two torques on the cage are the model's: the spring's (${DR.springK} N·mm a degree, unloaded past the back stop, so always turning the cage back) and the chain's, from its pull along both runs that leave the tension pulley. The tests check the chain's by virtual work, from how much chain a small turn of the cage needs, and plant a spring that turns the cage forward to show the check can fail. The chain tensions shown (${one(M0.N.tension0)} N and ${one(M0.N.tension1)} N) are those of the slack side of the chain, set by the cage spring; the driving side, under pedalling, carries far more.`,
    `Where the extra chain comes from: of the ${shares(M0).extra} mm the ${M0.N.big} wraps more than the ${M0.N.small}, the loop through the cage gives up ${shares(M0).cage} mm and the rest of the loop the other ${shares(M0).rest} mm: the lower run to the chainring ${shares(M0).lower} mm (as the tension pulley moves ${rnd(M0.N.forward)} mm forward) and the chainring's wrap ${shares(M0).ring} mm, less ${shares(M0).top} mm and ${shares(M0).run} mm that the top run and the run from the cog to the guide pulley take back. With the ${MODELS.wide.N.big}: ${shares(MODELS.wide).extra} mm, ${shares(MODELS.wide).cage} mm and ${shares(MODELS.wide).rest} mm; the rest is ${shares(MODELS.wide).lower} + ${shares(MODELS.wide).ring} − ${shares(MODELS.wide).top} − ${shares(MODELS.wide).run}. Each figure is printed to the fewest decimals at which these sums add up.`,
    `Shifting is gated on turning: the chain moves to a new cog only after a shift gate (${DR.gates} a cog) has come round under it, then climbs over ${DR.climb} mm of chain travel. Coasting and backpedalling give the chain no forward travel, so nothing shifts. The figure redraws every link, tooth and pulley from the model at each moment; nothing in the drawing is animated by hand.`,
    `The half-wrap rule (half of ${M0.N.big - M0.N.small} teeth × ${DR.p} mm = ${Math.round(M0.N.halfWrap)} mm) assumes the chain wraps half of each cog. In this model's layout the guide pulley sits ${-DR.dirSmall} to ${-DR.dirBig} degrees from forward, below and behind the axle, and the chain wraps about a third of each cog here, so the page states the model's own difference, ${Math.round(M0.N.extraWrap)} mm. A maker's rated capacity is a different, deliberately conservative figure, and still has to be met with the real wrap, chain length and cage.`,
    `The B screw's gap is set on the largest cog (Park Tool gives a target for it; the model uses ${DR.gap} mm tip to tip). The model refits the linkage for each cassette so that the gap is the same ${DR.gap} mm on the smallest cog too, and widest, ${one(M0.N.gapMax)} mm with the ${M0.N.big} (${one(MODELS.wide.N.gapMax)} mm with the ${MODELS.wide.N.big}), between them; a real derailleur's gap simply grows toward the smaller cogs. A turn of the whole body about its bolt changes the gap in every gear together (tested in all gears).`,
    `Representative 11-speed numbers, not one maker's drawing: pitch ${DR.pitch} mm, actuation ratio ${DR.ratio} : 1; off line, the chain is quiet within ${BANDS.quiet} mm (${two(BANDS.quiet / DR.ratio)} mm of cable), rubs to ${BANDS.rubs} mm (${two(BANDS.rubs / DR.ratio)} mm of cable) and skips to half a cog (${two(DR.pitch / 2)} mm, ${two(DR.pitch / 2 / DR.ratio)} mm of cable); the spokes lie ${DR.spokeGap} mm inboard of the largest cog's line and the dropout ${DR.dropoutGap} mm outboard of the smallest's.`,
    "Not covered here: chain length (the model sizes it with the cage on the largest cog), hanger alignment (checked first, with its own tool), and taking up cable slack at the anchor bolt before indexing.",
    "Drawn on Visualize's rig (src/rig): every part is a closed solid shaded by one key light, drawn once and placed from the model each frame. The frame's stays sit outboard of the cassette on a real bike; they are drawn behind it here, faded, so the cassette stays in view.",
  ],
  css: CSS,
  scripts: bundle,
  modelSrc,
  machine,
  data: DATA,
  audit: AUDIT,
});

const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "derailleur.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
