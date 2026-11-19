// node examples/automatic-watch/build.mjs  ->  dist/automatic-watch.html (or --out <file>).
// Mechanical automatic watch movement on Visualize's upgraded rig (src/rig), inside the shared
// Drawing page and player (src/drawing/).
//
// Shows how random wrist motion becomes 8 exact beats per second (28,800 vph, or 18,000 vph in
// the vintage What-if variant): cutaway oscillating rotor, twin reversing click wheels, coiled
// mainspring with slipping bridle, 4-wheel going train, Swiss lever escapement in View A (4.5:1),
// harmonic balance wheel, breathing hairspring and micron-precision regulator lab.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { MODELS, VARIANTS, WATCH, barrelAt, escapementAt, makeModel, regulatorAt, windingRate } from "./model.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");

const VBW = 14200, VBH = 6550, FS = 148;
const BOX = { x: 2320, y: 420, w: 5850, h: 5720 };
const INSET = { c: [12060, 2080], r: 1780 };

const PRED_STEP = 3;
const STEPS = [
  { tab: null, heading: "How does a watch run for 42 hours with no battery?", focus: null },
  { tab: "The movement", heading: "Four stacked subsystems share one 25.6 mm brass-and-steel calibre.", focus: null },
  { tab: "Rotor & winding", heading: "Gravity swings the rotor; twin reversing wheels wind one way only.", focus: ["rotor", "reversing", "barrel"] },
  { tab: "Mainspring", heading: "Seven coiled turns store 42 hours of torque; a bridle prevents overwind.", focus: ["barrel", "bridle", "reversing"] },
  { tab: "Going train", heading: null, focus: ["barrel", "train", "escapement"] },
  { tab: "Escapement", heading: null, focus: ["escapement", "balance", "train"] },
  { tab: "Regulation", heading: "Shifting the hairspring by 83 microns changes daily timekeeping by 20 seconds.", focus: ["balance", "regulator", "escapement"] },
];

const fmt = (n) => n.toLocaleString("en-US");

function headings(M) {
  const N = M.N;
  return {
    4: `Four geared stages step barrel speed up by ${fmt(N.totalRatio)} : 1 to the escape wheel.`,
    5: `Lock, unlock, impulse, drop: the escape wheel advances ${N.toothStepDeg}° every ${N.beatMs} ms.`,
  };
}

function captions(M) {
  const N = M.N, D = M.D;
  return [
    `An automatic mechanical watch carries no battery, yet converts random wrist motion into ${N.beatsPerSec} exact beats every second (${fmt(N.vph)} vph, ${fmt(N.beatsPerDay)} beats a day) and keeps running for ${N.reserveHours} hours off the wrist. Inside one ${N.calibreMm} mm calibre, an oscillating rotor winds a coiled alloy mainspring, four geared stages step speed up by ${fmt(N.totalRatio)} : 1, and a Swiss lever escapement meters torque to a harmonic balance wheel.`,
    `Every subsystem is stacked cleanly on the ${N.calibreMm} mm mainplate with synthetic ruby jewel bearings cutting pivot friction. On top swings the weighted semicircular rotor over meshing reversing wheels; beneath sit the toothed mainspring barrel, the center, third and fourth wheels of the going train, and the Swiss lever escapement beside the poised balance wheel.`,
    `The rotor's center of mass sits off-axis inside its heavy outer arc, so gravity swings it whenever your wrist moves. Twin reversing click wheels mesh between the rotor pinion and the barrel ratchet, engaging on opposite directions of rotation so both clockwise and counter-clockwise swings wind the mainspring in one direction only through a ${D.rotorRatio} : 1 reduction (${N.rotorRevsFull} rotor turns from empty to full wind).`,
    `Energy is stored by coiling the alloy mainspring inside the ${D.barrelTeeth}-tooth barrel: ${D.barrelTurns} usable turns deliver ${N.hoursPerBarrelTurn} hours per turn, or ${N.reserveHours} hours total reserve. Unlike a manual-wind watch with a fixed outer hook, an automatic mainspring ends in a slipping bridle: once torque hits ${D.slipTorque} N·mm at full wind, the outer coil slides safely along the smooth barrel wall so continued wrist motion can never snap the spring.`,
    `Four geared stages connect the barrel to the escape wheel: barrel (${D.barrelTeeth} teeth) to center pinion (${D.centerPinion} leaves) is ${N.barrelToCenter} : 1; center (${D.centerTeeth}) to third (${D.thirdPinion}) is ${N.centerToThird} : 1; third (${D.thirdTeeth}) to fourth (${D.fourthPinion}) is ${N.thirdToFourth} : 1; and fourth (${M.v.fourthTeeth}) to escape pinion (${M.v.escapePinion}) is ${N.fourthToEscape} : 1 — yielding ${fmt(N.totalRatio)} : 1 overall. Because the balance rate and the ${fmt(N.centerToEscape)} : 1 train between center and escape wheels fix the center wheel at 1 rev/hour (minute hand) and the fourth wheel ${N.centerToFourth} times faster at 1 rev/min (second hand), the ${N.barrelToCenter} : 1 barrel stage paces the barrel at 1 turn every ${N.hoursPerBarrelTurn} hours. On the dial side, a separate ${D.motionWorks} : 1 motion-works reduction steps the center wheel down to the hour hand.`,
    `Without an escapement, the mainspring would unwind in seconds. View A magnifies the ${D.escapeTeeth}-tooth club-tooth escape wheel and steel pallet fork with twin ruby stones (${D.liftAngle}° lift angle). Each half-swing (${N.beatMs} ms at ${N.hz} Hz), the balance roller's ruby impulse jewel enters the fork notch to swing the fork and unlock the locking stone; the escape wheel's angled club tooth then slides across that stone's impulse plane to drive the fork, which delivers one brief push to the balance's impulse jewel before another tooth drops and locks on the opposite stone — advancing the wheel exactly ${N.toothStepDeg}° per beat (${N.beatsPerRev} beats per revolution).`,
    `Because a balance wheel and spiral hairspring form a harmonic oscillator, oscillation period stays steady across the mainspring's flat torque plateau (healthy semi-arc amplitude up to ${N.nominalAmp}°, dropping below ${N.lowAmp}° only near empty). Turning the regulator index pin shifts the active length of the ${D.hairspringMm} mm hairspring: shortening it by just ${N.reg20Um} microns makes the watch gain 20 seconds a day; lengthening by ${N.reg20Um} microns slows it by 20 seconds a day.`,
  ];
}

const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

// Callouts strictly outside top-left .vz-caption (y >= 2200 on left) and View A loupe
const label = (id, text, x, y, to, beats, anchor = "end") => ({ id, text, at: [x, y], to, beats, anchor });
const LX = 2220;
const LABELS = [
  label("reversing", "Reversing wheels", LX, 2240, "reversing", [1, 2], "end"),
  label("barrel", "Mainspring barrel", LX, 2980, "barrel", [1, 2, 3, 4], "end"),
  label("bridle", "Slipping bridle", LX, 3720, "bridle", [3], "end"),
  label("regulator", "Regulator index", LX, 4440, "regulator", [6], "end"),
  label("balance", "Balance & hairspring", LX, 5260, "balance", [1, 5, 6], "end"),
  label("rotor", "Oscillating rotor", 8420, 1220, "rotor", [1, 2], "start"),
  label("center", "Center wheel", 8420, 1920, "center", [1, 4], "start"),
  label("fourth", "Fourth wheel", 8600, 6020, "fourth", [4], "end"),
  label("escape", "Escape wheel", 7960, 5080, "escape", [1, 5], "start"),
  label("fork", "Pallet fork", 7960, 5720, "fork", [5], "start"),
];
const labelSvg = (l) => `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

function skeleton(M) {
  const N = M.N, D = M.D;
  const defs = `<defs><clipPath id="loupeClip"><circle cx="${INSET.c[0]}" cy="${INSET.c[1]}" r="${INSET.r}"/></clipPath></defs>`;
  const inset = `<g id="insetG" class="inset"><circle class="inset-bg" cx="${INSET.c[0]}" cy="${INSET.c[1]}" r="${INSET.r}"/><g clip-path="url(#loupeClip)"><g id="loupeScene"></g></g><circle class="inset-ring" cx="${INSET.c[0]}" cy="${INSET.c[1]}" r="${INSET.r}"/><text class="inset-title" x="${INSET.c[0]}" y="${INSET.c[1] - INSET.r - 110}" text-anchor="middle">VIEW A · SWISS LEVER ESCAPEMENT · 4.5 : 1</text></g>`;

  const x0 = 9640, x1 = VBW - 80, y0 = 4920, y1 = VBH - 80;
  let tb = `<g class="tblock"><path class="tb-frame" d="M${x0},${y0}H${x1}V${y1}H${x0}Z"/><path class="tb-rule" d="M${x0},${y0 + 340}H${x1}M${x0},${y1 - 300}H${x1}"/>`;
  tb += `<text class="tb-title" x="${x0 + 110}" y="${y0 + 225}">AUTOMATIC WATCH · ${esc(M.v.label.toUpperCase())}</text><text class="tb-small" x="${x1 - 110}" y="${y0 + 225}" text-anchor="end">mm</text>`;
  const facts = [
    `Calibre ${N.calibreMm} · ${N.reserveHours} h reserve (${D.barrelTurns} turns) · ${D.rotorRatio} : 1 winding`,
    `Train ${fmt(N.totalRatio)} : 1 · ${D.escapeTeeth}T escape (${N.toothStepDeg}°/beat) · ${N.beatMs} ms beat`,
    `Rotor cut open to show going train and ruby jewels beneath.`,
  ];
  facts.forEach((t, i) => (tb += `<text class="tb-text" x="${x0 + 110}" y="${y0 + 570 + i * 200}">${esc(t)}</text>`));
  tb += `<g id="tbkey" data-x0="${x0 + 110}">`;
  for (const [cls, t] of [["k-brass", "Going train"], ["k-blue", "Springs"], ["k-ruby", "Ruby jewels"], ["k-orange", "Rotor / Bridle"]]) {
    tb += `<g class="tbk"><path class="${cls}" d="M0,${y1 - 140}h210"/><text class="tb-text tb-key" x="0" y="${y1 - 100}">${t}</text></g>`;
  }
  tb += "</g></g>";
  return `${defs}<defs id="rigDefs"></defs><g id="scene"></g>${inset}<g id="labels">${LABELS.map(labelSvg).join("")}</g>${tb}`;
}

function variantData(name) {
  const v = VARIANTS[name], M = MODELS[name], N = M.N, D = M.D;
  const tracks = VOICE?.variants?.[name] ?? null;
  const meet = (tracks || []).map((tr) => 0.8 * tr.duration);
  return {
    name,
    label: v.label,
    svg: skeleton(M),
    heads: headings(M),
    captions: captions(M),
    voice: tracks,
    meet,
    explanation: `An automatic mainspring is not hooked rigidly to the barrel wall. Its outer end is a slipping bridle calibrated to ${D.slipTorque} N·mm: once the spring reaches 100% wind (${N.reserveHours} hours reserve), extra rotor turns safely slip the outer coil without stressing or snapping the spring.`,
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- in-page controller
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz");
  const clamp = (u) => Math.max(0, Math.min(1, u));
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  let V = null, model = null, cur = null;
  let figM = null, stageM = null, defsM = null, loupeEl = null;
  let lastAt = null, lastFocus = { focus: null, lit: [] }, lastLoupeKey = "";

  const anim = (k) => (V?.voice?.[k] ? Math.max(3.0, V.meet[k]) : 0.8 * DATA.plain);
  const POSE = [0.45, 0.35, 0.55, 0.82, 0.52, 0.48, 0.72];

  function stateAt(k, u, tt, still = false) {
    const m = model;
    // Slow-motion visual beat rate proportional to true Hz so 4 Hz visibly beats 1.6x faster than 2.5 Hz!
    const visBeatsPerSec = m.N.hz * 0.42; // 1.68 beats/s (4 Hz) vs 1.05 beats/s (2.5 Hz)
    const slowFactor = k === 5 ? 0.42 : 1.0; // extra slow-motion during the Escapement step!
    let beats = tt * visBeatsPerSec * slowFactor + (k === 5 ? 0.5 : 0.15);
    if (still && k === 5) beats = 1.50; // capture the live IMPULSE kick right in View A!

    let rotorDeg = 95; // parked clear of escapement/balance by default
    let revDir = 1;
    let windPct = 76;
    let wristMotion = 40;
    let regRate = 0;

    if (k === 0 || k === 1) {
      // On still frame, park rotor cleanly to the right (18 deg) so reversing wheels & barrel on the left are 100% uncovered!
      rotorDeg = still ? 18 : 18 + 95 * Math.sin(tt * 1.1);
      revDir = still ? 1 : (Math.cos(tt * 1.1) >= 0 ? 1 : -1);
      if (still && k === 1) beats = 0.12; // crisp LOCK pose matching impulse jewel clearly outside fork notch
    } else if (k === 2) {
      // Clear bidirectional wrist tilt: swings CW then reverses CCW, showing twin reversing wheels alternate!
      rotorDeg = -30 + 195 * Math.sin(u * Math.PI * 2);
      revDir = Math.cos(u * Math.PI * 2) >= 0 ? 1 : -1;
      windPct = 55 + 25 * u;
      wristMotion = 75;
    } else if (k === 3) {
      // Winding up to 100% -> slipping bridle lights up; ends on upper-right so barrel stays 100% clear!
      rotorDeg = -180 + u * 260;
      revDir = 1;
      windPct = 62 + 38 * ease(clamp(u / 0.78));
      wristMotion = 85;
    } else if (k === 4) {
      rotorDeg = 95; // parked over upper-back so full 4-wheel going train shines!
      windPct = 82;
      wristMotion = 0;
    } else if (k === 5) {
      rotorDeg = 95;
      windPct = 85;
      wristMotion = 0;
    } else if (k === 6) {
      rotorDeg = 95;
      windPct = 85;
      wristMotion = 0;
      regRate = Math.round(20 * Math.sin(u * Math.PI * 1.5));
    }

    const bar = barrelAt(windPct, wristMotion > 0);
    const reg = regulatorAt(regRate);
    const esc = escapementAt(beats, bar.ampDeg);
    const barrelDeg = (windPct / 100) * 160 + beats * 1.2;
    const trainDeg = beats * 12;

    return {
      k, u, tt, beats, rotorDeg, revDir, windPct, wristMotion, regRate,
      regRateDeg: regRate * 0.9,
      barrelDeg, trainDeg,
      slipping: bar.slipping,
      bar, reg, esc,
      hideRotor: false,
    };
  }

  const at = (k, t, still, SEG) => {
    const tt = still ? POSE[k] * anim(k) : Math.max(0, t - SEG.lead);
    return stateAt(k, clamp(tt / anim(k)), tt, still);
  };
  const stillAt = (k, SEG) => SEG.lead + POSE[k] * anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    lastLoupeKey = "";
    const cam = FIG.cameraFor(DATA.box);
    figM = FIG.figure(m, cam, { prefix: "aw" });
    defsM = $("rigDefs");
    loupeEl = $("loupeScene");
    defsM.replaceChildren();
    $("scene").replaceChildren();
    stageM = new FIG.RigStage($("scene"));
    for (const pt of figM.parts) stageM.add(pt.id, pt.part, pt.svg);
  }

  const R = {};
  const setText = (id, v) => {
    if (R[id] !== v) ((R[id] = v), ($(id).textContent = v));
  };

  function readouts(st) {
    const m = model;
    setText("r-vph", m.N.vph.toLocaleString("en-US"));
    setText("r-reserve", st.bar.reserveHours.toFixed(1));
    setText("r-torque", st.bar.torque.toFixed(2));
    setText("r-amp", `${st.bar.ampDeg}°`);
    setText("r-phase", st.esc.phase);
    setText("r-rate", `${st.reg.rateSecPerDay >= 0 ? "+" : ""}${st.reg.rateSecPerDay}`);
  }

  function focusParts() {
    const { focus, lit } = lastFocus;
    const lab = root.hasAttribute("data-lab");
    const test = (part) => ({
      recede: lit.length ? !lit.includes(part) : !lab && focus ? !focus.includes(part) : false,
      named: lit.includes(part),
    });
    stageM?.focus(test);
  }
  const focus = (f) => {
    lastFocus = f;
    focusParts();
  };

  function render(st) {
    cur = st;
    const out = figM.pose(st);
    if (out.defs.length) defsM.insertAdjacentHTML("beforeend", out.defs.join(""));
    stageM.apply(out.items);
    lastAt = out.at;
    // Update magnified Swiss lever escapement loupe
    const lk = `${model.v.key}|${Math.round(st.esc.escapeDeg * 4)}|${Math.round(st.esc.forkDeg * 4)}|${Math.round(st.esc.balDeg * 2)}|${st.esc.phase}`;
    if (lk !== lastLoupeKey) {
      lastLoupeKey = lk;
      loupeEl.innerHTML = FIG.renderEscapementLoupe(DATA.inset, st.esc, model);
    }
    focusParts();
    readouts(st);
  }

  function lab(values) {
    const wristMotion = Number(values.wrist);
    const windPct = Number(values.wind);
    const regRate = Number(values.reg);
    const bar = barrelAt(windPct, wristMotion > 0);
    const wr = windingRate(wristMotion);
    const reg = regulatorAt(regRate);
  // Show crisp IMPULSE in Lab as well
  const esc = escapementAt(0.495, bar.ampDeg);
    const rows = [
      `Winding: ${wr.rotorRpm.toFixed(1)} eff. rotor rpm supplies +${wr.gainedHrsPerHr.toFixed(1)} h/h reserve (net ${wr.netHrsPerHr >= 0 ? "+" : ""}${wr.netHrsPerHr.toFixed(1)} h/h).`,
      `Barrel: ${bar.reserveHours.toFixed(1)} h reserve left at ${bar.torque.toFixed(2)} N·mm -> balance amplitude ${bar.ampDeg}°${bar.slipping ? " (slipping bridle active)" : ""}.`,
      `Regulator: ${reg.rateSecPerDay >= 0 ? "+" : ""}${reg.rateSecPerDay} s/day shifts active hairspring by ${reg.deltaUm >= 0 ? "+" : ""}${reg.deltaUm} µm.`,
    ];
    let ok = true, verdict = "";
    if (bar.ampDeg < WATCH.lowAmp) {
      ok = false;
      verdict = `Low amplitude (${bar.ampDeg}° < ${WATCH.lowAmp}°): mainspring nearly unwound — add wrist motion or wind higher.`;
    } else if (bar.slipping) {
      ok = true;
      verdict = `Full wind (${bar.reserveHours.toFixed(1)} h): slipping bridle sliding safely at ${WATCH.slipTorque} N·mm — zero overwind damage.`;
    } else if (Math.abs(regRate) > 10) {
      ok = false;
      verdict = `Out of tolerance (${regRate >= 0 ? "+" : ""}${regRate} s/day): adjust regulator index back toward 0 s/day.`;
    } else if (wr.netHrsPerHr < 0) {
      ok = true;
      verdict = `Running clean (${bar.ampDeg}° amp) on stored reserve (${bar.reserveHours.toFixed(1)} h left; draining ${Math.abs(wr.netHrsPerHr).toFixed(1)} h/h).`;
    } else {
      ok = true;
      verdict = `Healthy & self-winding: ${bar.ampDeg}° amplitude, net +${wr.netHrsPerHr.toFixed(1)} h/h reserve gain, ${regRate >= 0 ? "+" : ""}${regRate} s/day.`;
    }
    return {
      ok, verdict, rows,
      state: {
        k: 6, u: 1, tt: 0, beats: 0.49,
        rotorDeg: wristMotion > 0 ? 35 + wristMotion * 1.4 : 95,
        revDir: 1, windPct, wristMotion, regRate,
        regRateDeg: regRate * 0.9,
        barrelDeg: (windPct / 100) * 160,
        trainDeg: 18,
        slipping: bar.slipping,
        bar, reg, esc, lab: true,
      },
    };
  }

  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
  function question(n, r) {
    const kind = n % 5, N = model.N, D = model.D;
    if (kind === 0) {
      return {
        q: `In this ${N.vph.toLocaleString("en-US")} vph movement, the escape wheel has ${D.escapeTeeth} teeth (${N.beatsPerRev} beats per turn) and the fourth wheel turns once per minute. How many revolutions per minute does the escape wheel make?`,
        choices: [`${N.escapeRevPerMin} rev/min`, `${N.centerToFourth} rev/min`, `${D.escapeTeeth} rev/min`],
        explain: `Fourth wheel (${model.v.fourthTeeth}T) drives the escape pinion (${model.v.escapePinion} leaves) at ${N.fourthToEscape} : 1, so the escape wheel turns ${N.escapeRevPerMin} rev/min (${N.escapeRevPerMin} × ${N.beatsPerRev} × 60 = ${N.vph.toLocaleString("en-US")} vph).`,
      };
    }
    if (kind === 1) {
      return {
        q: `You wear an automatic watch all day until the mainspring reaches 100% wound (${N.reserveHours} hours). What stops the oscillating rotor from snapping the spring?`,
        choices: [
          `A slipping bridle lets the outer coil slide safely at ${D.slipTorque} N·mm`,
          `A brake locks the rotor solid`,
          `The balance wheel doubles its beat rate`,
        ],
        explain: `Automatic mainsprings are not fixed to the barrel wall: a friction slipping bridle slides smoothly once barrel torque reaches ${D.slipTorque} N·mm.`,
      };
    }
    if (kind === 2) {
      return {
        q: `How many degrees does a ${D.escapeTeeth}-tooth Swiss lever escape wheel advance on each single beat (tick or tock)?`,
        choices: [`${N.toothStepDeg}°`, `${360 / D.escapeTeeth}°`, `${D.liftAngle}°`],
        explain: `Each of the ${D.escapeTeeth} teeth locks twice (entry stone, then exit stone), giving ${N.beatsPerRev} beats per full turn: 360° ÷ ${N.beatsPerRev} = ${N.toothStepDeg}° per beat.`,
      };
    }
    if (kind === 3) {
      const fast = pick(r, [true, false]);
      return {
        q: `Your mechanical watch is running ${fast ? "20 seconds fast" : "20 seconds slow"} each day. Which way should the regulator index change the active hairspring length?`,
        choices: [
          fast ? `Lengthen it by ${N.reg20Um} microns` : `Shorten it by ${N.reg20Um} microns`,
          fast ? `Shorten it by ${N.reg20Um} microns` : `Lengthen it by ${N.reg20Um} microns`,
          `Increase the mainspring wind`,
        ],
        explain: `A longer hairspring is softer and oscillates slower; a shorter hairspring is stiffer and oscillates faster. Shifting active length by ${N.reg20Um} microns on a ${D.hairspringMm} mm spring trims 20 s/day.`,
      };
    }
    return {
      q: `Why does an automatic winding train place twin reversing click wheels between the rotor and the mainspring barrel?`,
      choices: [
        `To convert both clockwise and counter-clockwise rotor swings into one-way winding`,
        `To make the second hand tick smoothly`,
        `To keep the balance wheel amplitude constant`,
      ],
      explain: `Wrist motion swings the rotor both ways. Twin reversing click wheels engage on opposite directions so every swing winds the barrel in the same direction through a ${D.rotorRatio} : 1 reduction.`,
    };
  }

  return {
    model: (v) => MODELS_IN_PAGE[v.name],
    mount, at, stillAt, render, focus,
    anchors: () => lastAt,
    lab, question,
    heading: (k) => V.heads[k] ?? null,
    info: () => (cur ? { vph: model.N.vph, windPct: cur.windPct, torque: cur.bar.torque, ampDeg: cur.bar.ampDeg, phase: cur.esc.phase, lab: !!cur.lab } : {}),
  };
}

// ---------------------------------------------------------------- build page + audit
const bundle = buildSync({ entryPoints: [join(HERE, "figure.mjs")], bundle: true, format: "iife", globalName: "FIG", write: false, minify: true, legalComments: "none" }).outputFiles[0].text;
if (/<\/script/i.test(bundle)) throw new Error("the figure bundle contains </script");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "") + "\nconst MODELS_IN_PAGE = MODELS;\n";
const std = VARIANT_DATA.modern, M0 = MODELS.modern;

const DATA = {
  box: BOX,
  inset: INSET,
  plain: 7,
  base: "modern",
  steps: STEPS.map(({ heading, focus }) => ({ heading, focus })),
  alias: {
    rotor: ["rotor"],
    reversing: ["reversing"],
    barrel: ["barrel", "bridle"],
    bridle: ["bridle", "barrel"],
    train: ["train"],
    escapement: ["escapement"],
    balance: ["balance", "regulator"],
    regulator: ["regulator", "balance"],
  },
  predict: {
    step: PRED_STEP,
    question: `The mainspring hits 100% wound (${M0.N.reserveHours} h). Why doesn't the rotor snap the spring?`,
    choices: [
      `Slipping bridle slides at ${WATCH.slipTorque} N·mm`,
      "Rotor locks solid and stops",
      "Escapement speeds up to burn torque",
    ],
    answer: 0,
    explanation: Object.fromEntries(Object.entries(VARIANT_DATA).map(([k, v]) => [k, v.explanation])),
    locked: "Locked in. Press play to follow the torque into the going train.",
  },
  lab: {
    button: "Regulate it",
    title: "Wind, wear & regulate the movement",
    heading: "Does your watch keep accurate time?",
    intro: "Set wrist activity, mainspring wind level and regulator pin offset; watch the slipping bridle, balance amplitude and View A escapement react live.",
    inputs: [
      { id: "wrist", label: "Wrist motion", min: 0, max: 100, step: 5, value: 45, format: "{}%" },
      { id: "wind", label: "Mainspring", min: 5, max: 100, step: 5, value: 80, format: "{}%" },
      { id: "reg", label: "Regulator", min: -20, max: 20, step: 2, value: 0, format: "{} s/d" },
    ],
  },
  variants: VARIANT_DATA,
};

const CSS = `
${readFileSync(join(ROOT, "src/rig/rig.css"), "utf8")}
#fig{shape-rendering:geometricPrecision}
path,circle,rect{vector-effect:non-scaling-stroke}
text{font-family:var(--sans);fill:var(--ink)}
.vz[data-practice] #fig .inset,.vz[data-practice] #fig .label{visibility:hidden}
.inset-bg{fill:color-mix(in oklab,var(--stage) 95%,var(--ink))}
.inset-ring{fill:none;stroke:var(--ink);stroke-width:1.25}
.inset-title{font-size:${FS * 0.8}px;letter-spacing:.08em;font-weight:600}
/* View A Swiss Lever Escapement Loupe styles */
.loupe-axis{fill:none;stroke:var(--ink);stroke-width:.55;stroke-opacity:.18;stroke-dasharray:4 5}
.loupe-roller{fill:color-mix(in oklab,var(--rig-brass-lit) 58%,var(--stage));stroke:var(--ink);stroke-width:1.3}
.loupe-brass{fill:color-mix(in oklab,var(--rig-brass-lit) 78%,var(--rig-brass-dark));stroke:var(--ink);stroke-width:1.4;stroke-linejoin:round}
.loupe-hole{fill:color-mix(in oklab,var(--stage) 95%,var(--ink));stroke:var(--ink);stroke-width:1.0}
.loupe-steel{fill:color-mix(in oklab,var(--rig-alloy-lit) 72%,var(--rig-steel-dark));stroke:var(--ink);stroke-width:1.4;stroke-linejoin:round}
.loupe-ruby{fill:color-mix(in oklab,var(--rig-ruby-lit) 55%,var(--rig-ruby-dark));stroke:var(--ink);stroke-width:1.2}
.loupe-ruby.is-hot{fill:var(--orange);stroke:var(--ink);stroke-width:1.5}
.loupe-pivot{fill:var(--rig-steel-dark);stroke:var(--ink);stroke-width:1.0}
.loupe-pin{fill:var(--ink-2);stroke:var(--ink);stroke-width:1.0}
.loupe-badge{fill:var(--card);stroke:var(--ink);stroke-width:1.0}
.loupe-badge.is-imp{fill:color-mix(in oklab,var(--orange) 16%,var(--card));stroke:var(--orange)}
.loupe-badge.is-unl{fill:color-mix(in oklab,var(--blue) 14%,var(--card));stroke:var(--blue)}
.loupe-badge-txt{font:600 112px var(--mono);fill:var(--ink);letter-spacing:.05em}
.loupe-badge-txt.is-imp{fill:var(--orange)}
.leader{fill:none;stroke:var(--ink);stroke-width:.55}
.ldot{fill:var(--ink)}
.label text{font-size:172px;font-weight:500;paint-order:stroke;stroke:var(--stage);stroke-width:34px;stroke-linejoin:round}
.tb-frame{fill:none;stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.78}px;font-weight:600;letter-spacing:.05em}
.tb-text{font-size:${FS * 0.78}px}
.tb-key{font-size:${FS * 0.74}px}
.tb-small{font-size:${FS * 0.78}px;fill:var(--ink-2)!important}
.k-brass{stroke:#a67e28;stroke-width:2}.k-blue{stroke:var(--blue);stroke-width:2}.k-ruby{stroke:#b8254a;stroke-width:2}.k-orange{stroke:var(--orange);stroke-width:2}
`;

const AUDIT = {
  models: Object.values(MODELS),
  facts: [4.5, 20, 100, 360, 0, 5, 45, 80],
  allow: [
    { value: 1, why: "unit 1 in ratios such as 5,760 : 1 and 1 rev/hour" },
    { value: 4, why: "four subsystems / four geared wheels" },
    { value: 24, why: "24 hours in a day" },
  ],
  claims: [
    {
      text: "converting random wrist motion", // verified via exact sentence below
      test: () => true,
    },
  ].slice(0, 0).concat([
    {
      text: "converts random wrist motion into 8 exact beats every second (28,800 vph, 691,200 beats a day) and keeps running for 42 hours off the wrist",
      test: () => MODELS.modern.N.beatsPerSec === 8 && MODELS.modern.N.vph === 28800 && MODELS.modern.N.beatsPerDay === 691200 && MODELS.modern.N.reserveHours === 42,
    },
    {
      text: "7 usable turns deliver 6 hours per turn, or 42 hours total reserve",
      test: (m) => m.D.barrelTurns === 7 && m.N.hoursPerBarrelTurn === 6 && m.N.reserveHours === 42,
    },
    {
      text: "once torque hits 7.2 N·mm at full wind, the outer coil slides safely along the smooth barrel wall",
      test: () => barrelAt(100, true).torque === 7.2 && barrelAt(100, true).slipping === true && barrelAt(100, false).slipping === false,
    },
    {
      text: "fix the center wheel at 1 rev/hour (minute hand) and the fourth wheel 60 times faster at 1 rev/min (second hand), the 6 : 1 barrel stage paces the barrel at 1 turn every 6 hours",
      test: (m) => m.N.centerToFourth === 60 && m.N.barrelToCenter === 6 && m.N.hoursPerBarrelTurn === 6,
    },
    {
      text: "yielding 5,760 : 1 overall",
      test: () => MODELS.modern.N.totalRatio === 5760,
    },
    {
      text: "advancing the wheel exactly 12° per beat (30 beats per revolution)",
      test: (m) => m.N.toothStepDeg === 12 && m.N.beatsPerRev === 30 && Math.abs(escapementAt(1).escapeDeg - 12) < 1e-9,
    },
    {
      text: "shortening it by just 83 microns makes the watch gain 20 seconds a day; lengthening by 83 microns slows it by 20 seconds a day",
      test: () => regulatorAt(20).deltaUm === -83 && regulatorAt(-20).deltaUm === 83,
    },
  ]),
  coverage: {
    source: "George Daniels, Watchmaking (going train gear ratios, Swiss lever escapement lock-unlock-impulse-drop sequence, automatic slipping mainspring bridle, balance wheel & hairspring regulation); ETA 2824-2 technical calibre specifications (25.6 mm, 28,800 vph, 52 deg lift angle)",
    topics: [
      { topic: "four layered calibre subsystems and ruby jewel bearings", where: "step:1" },
      { topic: "oscillating rotor and bidirectional reversing click wheels", where: "step:2" },
      { topic: "mainspring barrel energy storage and slipping bridle overwind protection", where: "step:3" },
      { topic: "four-wheel going train ratios (barrel to minute, second and escape wheels)", where: "step:4" },
      { topic: "Swiss lever escapement four-phase cycle (lock, unlock, impulse, drop)", where: "step:5" },
      { topic: "harmonic balance wheel, breathing hairspring and micron regulator index", where: "step:6" },
      { topic: "high-beat 28,800 vph (4 Hz) vs vintage 18,000 vph (2.5 Hz) beat rates", where: "whatif" },
      { topic: "wrist activity, mainspring wind amplitude and regulator error lab", where: "lab" },
      { topic: "keyless works and crown hand-setting clutch", core: false, where: "deferred", why: "manual time-setting sits on the dial side under the hands; named in Details" },
    ],
  },
  reviewFile: join(HERE, "review.json"),
  report: join(ROOT, "dist", "automatic-watch.audit.json"),
};

const HTML = drawingPage({
  title: "Automatic Watch",
  about: "An oscillating rotor, coiled mainspring, four geared stages and Swiss lever escapement turn random wrist motion into exact time.",
  scene: "automatic-watch",
  steps: STEPS,
  stageLabel: "Mechanical automatic watch movement in cutaway isometric with magnified Swiss lever escapement loupe. Left and right arrows step through; space plays.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Cutaway isometric drawing of a 25.6 mm automatic watch calibre showing the oscillating rotor, reversing wheels, mainspring barrel with slipping bridle, four-wheel going train, balance wheel and hairspring, plus View A magnifying the 15-tooth Swiss lever escapement",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: std.captions[0],
  whatIf: { label: "Beat rate", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-vph">${fmt(M0.N.vph)}</b> vph</span>
            <span><b id="r-reserve">32.0</b> h reserve</span>
            <span><b id="r-torque">6.70</b> N·mm</span>
            <span><b id="r-amp">275°</b> amplitude</span>
            <span><b id="r-phase">lock</b> phase</span>
            <span><b id="r-rate">+0</b> s/day</span>`,
  readoutNote: "Gear ratios, barrel torque, amplitude and regulator sensitivity are computed live by the model",
  legend: [
    ["#a67e28", "Mainspring barrel, going train wheels, escape wheel and balance rim"],
    ["var(--blue)", "Alloy mainspring coil, breathing hairspring and second hand"],
    ["#b8254a", "Synthetic ruby pivot bearings, pallet stones and impulse jewel"],
    ["var(--orange)", "Oscillating rotor weight, slipping bridle at full wind and regulator index"],
  ],
  facts: [
    `Going train math: barrel (${WATCH.barrelTeeth}T) / center pinion (${WATCH.centerPinion}) = ${M0.N.barrelToCenter} : 1; center (${WATCH.centerTeeth}T) / third (${WATCH.thirdPinion}) = ${M0.N.centerToThird} : 1; third (${WATCH.thirdTeeth}T) / fourth (${WATCH.fourthPinion}) = ${M0.N.thirdToFourth} : 1 -> exact ${M0.N.centerToFourth} : 1 minute-to-second hand ratio. Center to escape is ${fmt(M0.N.centerToEscape)} : 1 (${fmt(M0.N.vph)} vph) or ${fmt(MODELS.vintage.N.centerToEscape)} : 1 (${fmt(MODELS.vintage.N.vph)} vph), fixing center at 1 rev/h and barrel at 1 turn every ${M0.N.hoursPerBarrelTurn} hours (${fmt(M0.N.totalRatio)} : 1 / ${fmt(MODELS.vintage.N.totalRatio)} : 1 overall). Dial-side motion works add a ${WATCH.motionWorks} : 1 reduction for the hour hand.`,
    `Power reserve & bridle: ${WATCH.barrelTurns} usable barrel turns × ${M0.N.hoursPerBarrelTurn} hours/turn = ${M0.N.reserveHours} hours reserve. A ${WATCH.rotorRatio} : 1 automatic winding reduction requires ${M0.N.rotorRevsFull} effective rotor turns from empty to full; at ${WATCH.slipTorque} N·mm the slipping bridle slides safely inside the barrel wall.`,
    `Swiss lever escapement: ${WATCH.escapeTeeth} club teeth × 2 locks per tooth = ${M0.N.beatsPerRev} beats per escape revolution (${M0.N.toothStepDeg}° per beat, ${M0.N.beatMs} ms modern / ${MODELS.vintage.N.beatMs} ms vintage, ${WATCH.liftAngle}° lift angle). View A slows the real cycle so lock, unlock, impulse and drop read clearly.`,
    `Harmonic regulation: since balance frequency scales as active hairspring length to the −0.5 power, shifting active length by ${M0.N.reg20Um} microns on a ${WATCH.hairspringMm} mm hairspring changes daily rate by 20 s/day. Amplitude falls below ${WATCH.lowAmp}° only when mainspring torque drops near empty.`,
    `Not covered here: keyless works and crown hand-setting clutch (located on the dial side alongside the ${WATCH.motionWorks} : 1 motion works) and date-jumper complications.`,
  ],
  css: CSS,
  scripts: bundle,
  modelSrc,
  machine,
  data: DATA,
  audit: AUDIT,
});

const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "automatic-watch.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
