// node examples/automatic-watch/build.mjs  ->  dist/automatic-watch.html (or --out <file>).
// Mechanical automatic watch movement on Visualize's rig (src/rig/mech.ts), inside the shared
// Drawing page and player (src/drawing/).
//
// 14-step --deep 4-chapter tour (Winding, Power, Going train, Timekeeping) with 3 chapter
// predictions, per-step cameraKit() framing, 6-layer exploded 3D calibre, What if beat-rate
// comparison (28,800 vph · 4 Hz vs 18,000 vph · 2.5 Hz), Regulate it lab, and seeded Now you try.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { MODELS, VARIANTS, WATCH, barrelAt, escapementAt, makeModel, regulatorAt, windingRate } from "./model.mjs";
import { cameraFor, figure } from "./figure.mjs";
import { CLAIMS, COVERAGE, STEPS, captions, fmt, headings, predictions, ratio } from "./story.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");

// ---------------------------------------------------------------- frame, camera clear area & callouts
const VBW = 14200, VBH = 6550, FS = 150;
const LX = 3850, RX = 10350;
const BOX = { x: 4100, y: 260, w: 6000, h: 6000 };
const CLEAR = { x0: LX + 150, y0: 150, x1: 9500, y1: VBH - 150 };
const CARD_CLEAR = { x0: 5000, y0: 150, x1: 9500, y1: VBH - 150 };

const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

// Short, non-crossing callouts: left column y >= 2200 (clear of .vz-caption), right column y <= 3100
// on prediction/reveal steps (clear of #predict at 1280x800 and title block y0 = 4980).
const label = (id, text, x, y, to, beats, anchor = "end") => ({ id, text, at: [x, y], to, beats, anchor });
const LABELS = [
  // Left column (top-to-bottom matching target Y; Step 13 labels sit far-left in open white margin)
  label("reversing", "Reversing wheels", LX, 2240, "reversing", [1, 3], "end"),
  label("balanceCock", "Balance cock", 2750, 2650, "balanceCock", [13], "end"),
  label("regulator", "Regulator index", 2750, 3350, "regulator", [13], "end"),
  label("barrel", "Mainspring barrel", LX, 4080, "barrel", [1, 4, 6, 7], "end"),
  label("bridle", "Slipping bridle", LX, 4620, "bridle", [5], "end"),
  label("center", "Center wheel", LX, 4780, "center", [7, 8], "end"),
  label("balance", "Balance & hairspring", LX, 5180, "balance", [1, 6, 12], "end"),
  // Right column (top-to-bottom matching target Y; Step 8/9 labels strictly above #predict y ~ 3400)
  label("rotor", "Oscillating rotor", RX, 860, "rotor", [1, 2], "start"),
  label("third", "Third wheel", RX, 1750, "third", [8], "start"),
  label("fourth", "Fourth wheel", RX, 2320, "fourth", [8, 9], "start"),
  label("escape", "Escape wheel", RX, 3460, "escape", [1, 9, 10, 11], "start"),
  label("fork", "Pallet fork", RX, 4280, "fork", [10, 11], "start"),
];
const labelSvg = (l) => `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

function skeleton(M) {
  const N = M.N, D = M.D;
  const x0 = 10200, x1 = VBW - 80, y0 = 4980, y1 = VBH - 80;
  let tb = `<g class="tblock" data-camera-avoid=""><path class="tb-frame" d="M${x0},${y0}H${x1}V${y1}H${x0}Z"/><path class="tb-rule" d="M${x0},${y0 + 340}H${x1}M${x0},${y1 - 300}H${x1}"/>`;
  tb += `<text class="tb-title" x="${x0 + 110}" y="${y0 + 225}">AUTOMATIC WATCH · ${esc(M.v.label.toUpperCase())}</text><text class="tb-small" x="${x1 - 110}" y="${y0 + 225}" text-anchor="end">mm</text>`;
  const facts = [
    `Calibre ${N.calibreMm} · ${N.reserveHours} h reserve (${D.barrelTurns} turns) · ${ratio(D.rotorRatio)} winding`,
    `Train ${ratio(N.totalRatio)} · ${D.escapeTeeth}T escape (${N.toothStepDeg}°/beat) · ${N.beatMs} ms beat`,
    `6 exploded layers on shared axes; case cut open at front.`,
  ];
  facts.forEach((t, i) => (tb += `<text class="tb-text" x="${x0 + 110}" y="${y0 + 570 + i * 200}">${esc(t)}</text>`));
  tb += `<g id="tbkey" data-x0="${x0 + 110}">`;
  for (const [cls, t] of [["k-brass", "Going train"], ["k-blue", "Springs"], ["k-ruby", "Ruby jewels"], ["k-orange", "Followed"]]) {
    tb += `<g class="tbk"><path class="${cls}" d="M0,${y1 - 140}h180"/><text class="tb-text tb-key" x="0" y="${y1 - 100}">${t}</text></g>`;
  }
  tb += "</g></g>";
  return `<defs id="rigDefs"></defs><g id="scene" data-camera=""></g><g id="labels">${LABELS.map(labelSvg).join("")}</g>${tb}`;
}

function variantData(name) {
  const v = VARIANTS[name], M = MODELS[name];
  const tracks = VOICE?.variants?.[name] ?? null;
  const meet = (tracks || []).map((tr) => 0.8 * tr.duration);
  const heads = Object.fromEntries(headings(M).map((h, k) => [k, h]));
  return {
    name,
    label: v.label,
    svg: skeleton(M),
    heads,
    captions: captions(M),
    voice: tracks,
    meet,
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- build-time camera name check
const CAM_ITEMS = {};
const CAM_ALIAS = {
  rotor: ["rotor"],
  reversing: ["reversing"],
  barrel: ["barrel", "bridle"],
  bridle: ["bridle", "barrel"],
  center: ["center"],
  third: ["third"],
  fourth: ["fourth"],
  escapePin: ["escapePin"],
  escape: ["escape"],
  fork: ["fork"],
  roller: ["roller"],
  balance: ["balance"],
  barrelBridge: ["barrelBridge"],
  trainBridge: ["trainBridge"],
  escCock: ["escCock"],
  balanceCock: ["balanceCock"],
  regulator: ["regulator"],
};

function cameraNames() {
  const can = new Set();
  for (const M of Object.values(MODELS)) {
    const F = figure(M, cameraFor(BOX), { prefix: "aw" });
    for (const p of F.parts) can.add(p.part);
    const out = F.pose({ esc: escapementAt(0.5, WATCH.nominalAmp), rotorDeg: 45, windPct: 80, regRateDeg: 0 });
    for (const i of out.items) if (i.part) can.add(i.part);
  }
  const bad = [];
  STEPS.forEach((st, k) => [...(st.shot ?? []), ...(st.around ?? []), ...(st.subject ?? [])].forEach((n) => can.has(n) || bad.push(`step ${k} names "${n}"`)));
  for (const [v, tracks] of Object.entries(VOICE?.variants ?? {})) {
    tracks.forEach((tr, k) => tr.links.forEach((l) => l.ids.forEach((n) => can.has(n) || bad.push(`voice (${v}, step ${k}) names "${n}"`))));
  }
  if (bad.length) throw new Error(`camera cannot frame: ${bad.join("; ")}`);
}
cameraNames();

// ---------------------------------------------------------------- in-page controller
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz");
  const clamp = (u) => Math.max(0, Math.min(1, u));
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  let V = null, model = null, cur = null;
  let figM = null, stageM = null, defsM = null;
  let lastAt = null, lastFocus = { focus: null, lit: [] };

  const anim = (k) => (V?.voice?.[k] ? Math.max(3.0, V.meet[k]) : 0.8 * DATA.plain);
  const POSE = [0.42, 0.35, 0.45, 0.55, 0.78, 0.86, 0.50, 0.55, 0.55, 0.55, 0.45, 0.52, 0.48, 0.72];

  function stateAt(k, u, tt, still = false) {
    const m = model;
    const visBeatsPerSec = m.N.hz * 0.42; // 1.68 beats/s (4 Hz) vs 1.05 beats/s (2.5 Hz)
    const slowFactor = k === 10 || k === 11 ? 0.35 : 1.0;
    let beats = tt * visBeatsPerSec * slowFactor + (k === 11 ? 0.5 : 0.15);
    if (still && k === 10) beats = 1.12; // crisp LOCK pose
    if (still && k === 11) beats = 1.50; // live IMPULSE kick right across the ruby stone

    let rotorDeg = 46; // parked gracefully along upper-back rim clear of barrel, train & balance
    let revDir = 1;
    let ratchetDeg = 0;
    let windPct = 78;
    let wristMotion = 40;
    let regRate = 0;
    let useEscDrive = true;
    let centerDeg = 0;

    if (k === 0 || k === 1) {
      rotorDeg = still ? 42 : 42 + 75 * Math.sin(tt * 0.95);
      revDir = still ? 1 : (Math.cos(tt * 0.95) >= 0 ? 1 : -1);
      ratchetDeg = still ? 24 : 24 + Math.abs(Math.sin(tt * 0.95)) * 28;
      if (still && k === 1) beats = 0.14;
    } else if (k === 2) {
      // Off-axis weighted rotor swings CW then CCW
      rotorDeg = still ? 48 : 15 + 115 * Math.sin(u * Math.PI * 2);
      revDir = still ? 1 : (Math.cos(u * Math.PI * 2) >= 0 ? 1 : -1);
      ratchetDeg = u * 90;
      wristMotion = 75;
    } else if (k === 3) {
      // Bidirectional swings wind the ratchet strictly one way
      rotorDeg = still ? 58 : -20 + 150 * Math.sin(u * Math.PI * 2);
      revDir = still ? -1 : (Math.cos(u * Math.PI * 2) >= 0 ? 1 : -1);
      ratchetDeg = u * 160;
      windPct = 55 + 25 * u;
      wristMotion = 80;
    } else if (k === 4) {
      // Mainspring coils tighter inside barrel up to 92%
      rotorDeg = 48;
      ratchetDeg = u * 180;
      windPct = 30 + 62 * ease(u);
      wristMotion = 70;
    } else if (k === 5) {
      // Full wind 100% under wrist motion -> slipping bridle lights up orange
      rotorDeg = still ? 52 : 10 + u * 50;
      ratchetDeg = u * 140;
      windPct = 72 + 28 * ease(clamp(u / 0.65));
      wristMotion = 85;
    } else if (k === 6) {
      // Flat torque plateau unwinding 95% -> 5% (still at 50% healthy plateau)
      rotorDeg = 48;
      windPct = 95 - 90 * u;
      wristMotion = 0;
    } else if (k === 7 || k === 8 || k === 9) {
      // Going train chapter: smooth continuous rotation showing exact gear ratios
      rotorDeg = 48;
      windPct = 82;
      wristMotion = 0;
      useEscDrive = false;
      centerDeg = k === 7 ? u * 120 : k === 8 ? u * 45 : u * 24;
    } else if (k === 10 || k === 11) {
      // Slow-motion Swiss lever escapement
      rotorDeg = 48;
      windPct = 85;
      wristMotion = 0;
      useEscDrive = true;
    } else if (k === 12) {
      // Harmonic balance & breathing hairspring
      rotorDeg = 48;
      windPct = 85;
      wristMotion = 0;
      useEscDrive = true;
    } else if (k === 13) {
      // Micron regulator index sweeping -20..+20 s/day
      rotorDeg = 48;
      windPct = 85;
      wristMotion = 0;
      useEscDrive = true;
      regRate = still ? 16 : Math.round(20 * Math.sin(u * Math.PI * 1.6));
    }

    const bar = barrelAt(windPct, wristMotion > 0);
    const reg = regulatorAt(regRate);
    const esc = escapementAt(beats, bar.ampDeg);

    return {
      k, u, tt, beats, rotorDeg, revDir, ratchetDeg, windPct, wristMotion, regRate,
      regRateDeg: regRate * 1.1,
      centerDeg, useEscDrive,
      slipping: bar.slipping,
      bar, reg, esc,
    };
  }

  const at = (k, t, still, SEG) => {
    const tt = still ? POSE[k] * anim(k) : Math.max(0, t - SEG.lead);
    return stateAt(k, clamp(tt / anim(k)), tt, still);
  };
  const stillAt = (k, SEG) => SEG.lead + POSE[k] * anim(k);

  function boundsOf(names) {
    const scene = $("scene");
    if (!scene) return null;
    const inv = scene.getCTM().inverse();
    let b = null;
    const add = (x0, y0, x1, y1) => (b = b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
    for (const n of names) {
      const sel = DATA.camera.items[n] ? DATA.camera.items[n].map((id) => `[data-item="${id}"]`).join(",") : `[data-part="${n}"]`;
      for (const el of scene.querySelectorAll(sel)) {
        if (el.style.display === "none") continue;
        const r = el.getBBox();
        if (!r.width && !r.height) continue;
        const m = inv.multiply(el.getCTM());
        const pts = [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
        add(Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])));
      }
    }
    return b;
  }

  function mount(v, m) {
    V = v;
    model = m;
    const cam = FIG.cameraFor(DATA.box);
    figM = FIG.figure(m, cam, { prefix: "aw" });
    defsM = $("rigDefs");
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
    const esc = escapementAt(1.50, bar.ampDeg);
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
        k: 13, u: 1, tt: 0, beats: 1.50,
        rotorDeg: wristMotion > 0 ? 35 + wristMotion * 0.5 : 55,
        revDir: 1, ratchetDeg: windPct * 1.5, windPct, wristMotion, regRate,
        regRateDeg: regRate * 1.1,
        centerDeg: 0, useEscDrive: true,
        slipping: bar.slipping,
        bar, reg, esc, lab: true,
      },
    };
  }

  const cardShot = (st) => (st?.practiceShot ? st.practiceShot : ["barrel", "balance", "regulator", "rotor"]);
  const cardClear = () => DATA.cardClear;

  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
  const pState = (over, shot) => {
    const windPct = over.windPct ?? 82;
    const wristMotion = over.wristMotion ?? 40;
    const regRate = over.regRate ?? 0;
    const bar = barrelAt(windPct, wristMotion > 0);
    const reg = regulatorAt(regRate);
    const esc = escapementAt(over.beats ?? 1.50, bar.ampDeg);
    return {
      k: 0, u: 0.5, tt: 0, beats: over.beats ?? 1.50,
      rotorDeg: over.rotorDeg ?? 48, revDir: over.revDir ?? 1, ratchetDeg: 40,
      windPct, wristMotion, regRate, regRateDeg: regRate * 1.1,
      centerDeg: 0, useEscDrive: true, slipping: bar.slipping,
      bar, reg, esc, practice: true, practiceShot: shot,
    };
  };

  // Seeded Now you try across all 4 chapters (Winding, Power, Going train, Timekeeping)
  function question(n, r) {
    const kind = n % 5, N = model.N, D = model.D;
    if (kind === 0) {
      // Chapter 1: Winding
      return {
        q: `Why does an automatic winding train place twin reversing click wheels between the rotor and the mainspring barrel?`,
        choices: [
          `To convert both clockwise and counter-clockwise rotor swings into one-way winding`,
          `To make the second hand tick smoothly`,
          `To keep the balance wheel amplitude constant`,
        ],
        explain: `Wrist motion swings the rotor both ways. Twin reversing click wheels engage on opposite directions so every swing winds the barrel in the same direction through a ${D.rotorRatio}\u00a0:\u00a01 reduction.`,
        state: pState({ rotorDeg: 55, revDir: -1 }, ["rotor", "reversing", "barrel"]),
      };
    }
    if (kind === 1) {
      // Chapter 2: Power
      return {
        q: `You wear an automatic watch all day until the mainspring reaches 100% wound (${N.reserveHours} hours). What stops the oscillating rotor from snapping the spring?`,
        choices: [
          `A slipping bridle lets the outer coil slide safely at ${D.slipTorque} N·mm`,
          `A brake locks the rotor solid`,
          `The balance wheel doubles its beat rate`,
        ],
        explain: `Automatic mainsprings are not fixed to the barrel wall: a friction slipping bridle slides smoothly once barrel torque reaches ${D.slipTorque} N·mm.`,
        state: pState({ windPct: 100, wristMotion: 85 }, ["barrel", "bridle"]),
      };
    }
    if (kind === 2) {
      // Chapter 3: Going train
      return {
        q: `In this ${N.vph.toLocaleString("en-US")} vph movement, the escape wheel has ${D.escapeTeeth} teeth (${N.beatsPerRev} beats per turn) and the fourth wheel turns once per minute. How many revolutions per minute does the escape wheel make?`,
        choices: [`${N.escapeRevPerMin} rev/min`, `${N.centerToFourth} rev/min`, `${D.escapeTeeth} rev/min`],
        explain: `Fourth wheel (${model.v.fourthTeeth}T) drives the escape pinion (${model.v.escapePinion} leaves) at ${N.fourthToEscape}\u00a0:\u00a01, so the escape wheel turns ${N.escapeRevPerMin} rev/min (${N.escapeRevPerMin} × ${N.beatsPerRev} × 60 = ${N.vph.toLocaleString("en-US")} vph).`,
        state: pState({}, ["fourth", "escapePin", "escape"]),
      };
    }
    if (kind === 3) {
      // Chapter 4: Escapement
      return {
        q: `How many degrees does a ${D.escapeTeeth}-tooth Swiss lever escape wheel advance on each single beat (tick or tock)?`,
        choices: [`${N.toothStepDeg}°`, `${N.wheelToothStepDeg}°`, `${D.liftAngle}°`],
        explain: `Each of the ${D.escapeTeeth} teeth locks twice (entry stone, then exit stone), giving ${N.beatsPerRev} beats per full turn: 360° ÷ ${N.beatsPerRev} = ${N.toothStepDeg}° per beat.`,
        state: pState({ beats: 1.50 }, ["escape", "fork", "roller"]),
      };
    }
    // Chapter 4: Regulation
    const fast = pick(r, [true, false]);
    return {
      q: `Your mechanical watch is running ${fast ? "20 seconds fast" : "20 seconds slow"} each day. Which way should the regulator index change the active hairspring length?`,
      choices: [
        fast ? `Lengthen it by ${N.reg20Um} microns` : `Shorten it by ${N.reg20Um} microns`,
        fast ? `Shorten it by ${N.reg20Um} microns` : `Lengthen it by ${N.reg20Um} microns`,
        `Increase the mainspring wind`,
      ],
      explain: `A longer hairspring is softer and oscillates slower; a shorter hairspring is stiffer and oscillates faster. Shifting active length by ${N.reg20Um} microns on a ${D.hairspringMm} mm spring trims 20 s/day.`,
      state: pState({ regRate: fast ? 20 : -20 }, ["regulator", "balance"]),
    };
  }

  return {
    model: (v) => MODELS_IN_PAGE[v.name],
    mount, at, stillAt, render, focus,
    anchors: () => lastAt,
    boundsOf,
    clearArea: () => DATA.camera.clear,
    cardShot, cardClear,
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

// Build array of 3 predictions (Chapters 2, 3, 4), keyed by variant
const PREDS_BY_VAR = Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, predictions(m)]));
const PREDICT_ARRAY = PREDS_BY_VAR.modern.map((baseP, idx) => ({
  step: baseP.step,
  question: Object.fromEntries(Object.entries(PREDS_BY_VAR).map(([k, ps]) => [k, ps[idx].question])),
  choices: baseP.choices,
  answer: Object.fromEntries(Object.entries(PREDS_BY_VAR).map(([k, ps]) => [k, ps[idx].answer])),
  explanation: Object.fromEntries(Object.entries(PREDS_BY_VAR).map(([k, ps]) => [k, ps[idx].explanation])),
  locked: baseP.locked,
}));

const DATA = {
  box: BOX,
  plain: 7,
  base: "modern",
  steps: STEPS.map((s, k) => ({
    heading: headings(M0)[k],
    focus: s.focus,
    ...(s.shot ? { shot: s.shot } : {}),
  })),
  camera: {
    clear: CLEAR,
    items: CAM_ITEMS,
    alias: {},
    around: Object.fromEntries(STEPS.flatMap((s, k) => (s.around ? [[k, s.around]] : []))),
    subject: Object.fromEntries(STEPS.flatMap((s, k) => (s.subject ? [[k, s.subject]] : []))),
  },
  cardClear: CARD_CLEAR,
  alias: CAM_ALIAS,
  predict: PREDICT_ARRAY,
  lab: {
    button: "Regulate it",
    title: "Wind, wear & regulate the movement",
    heading: "Does your watch keep accurate time?",
    intro: "Set wrist activity, mainspring wind level and regulator pin offset; watch the slipping bridle, balance amplitude and regulator index react live.",
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
#fig{shape-rendering:geometricPrecision;overflow:visible}
path,circle,rect{vector-effect:non-scaling-stroke}
text{font-family:var(--sans);fill:var(--ink)}
.vz[data-practice] #fig .label{visibility:hidden}
.vz-step-heading{text-shadow:0 0 6px var(--stage),0 0 12px var(--stage),0 0 18px var(--stage)}
.vz-caption::before{content:"";position:absolute;z-index:-1;inset:-60px -70px -70px -60px;background:radial-gradient(closest-side,var(--stage) 62%,color-mix(in oklab,var(--stage) 0%,transparent))}
.leader{fill:none;stroke:var(--ink);stroke-width:.55}
.ldot{fill:var(--ink)}
.label text{font-size:164px;font-weight:500;paint-order:stroke;stroke:var(--stage);stroke-width:42px;stroke-linejoin:round}
.tb-frame{fill:var(--stage);stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.78}px;font-weight:600;letter-spacing:.05em}
.tb-text{font-size:${FS * 0.78}px}
.tb-key{font-size:${FS * 0.74}px}
.tb-small{font-size:${FS * 0.78}px;fill:var(--ink-2)!important}
.k-brass{stroke:#a67e28;stroke-width:2}.k-blue{stroke:var(--blue);stroke-width:2}.k-ruby{stroke:#b8254a;stroke-width:2}.k-orange{stroke:var(--orange);stroke-width:2}
`;

const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "automatic-watch.html");

const AUDIT = {
  models: Object.values(MODELS),
  facts: [0, 5, 20, 45, 80, 100, 360],
  allow: [
    { value: 1, why: "unit 1 in ratios such as 5,760 : 1 and 1 rev/hour" },
    { value: 3, why: "Chapter 3 ordinal label" },
    { value: 4, why: "four chapters / four geared stages" },
    { value: 0.5, why: "exponent -0.5 in harmonic oscillator frequency scaling f ~ L^(-0.5)" },
  ],
  claims: CLAIMS,
  coverage: COVERAGE,
  reviewFile: join(HERE, "review.json"),
  report: out.replace(/\.html$/, ".audit.json"),
};

const HTML = drawingPage({
  title: "Automatic Watch",
  about: "An oscillating rotor, coiled mainspring, four geared stages and Swiss lever escapement turn random wrist motion into exact time.",
  scene: "automatic-watch",
  steps: STEPS,
  stageLabel: "Mechanical automatic watch movement in 6-layer exploded isometric. Left and right arrows step through; space plays.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Exploded isometric drawing of a 25.6 mm automatic watch calibre showing the cutaway steel case, mainplate with ruby jewels, mainspring barrel with slipping bridle, four-wheel going train, 15-tooth Swiss lever escapement, poised balance wheel, rhodium bridges, reversing wheels and oscillating rotor",
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
    ["var(--blue)", "Alloy mainspring coil, breathing hairspring, blued screws and second hand"],
    ["#b8254a", "Synthetic ruby pivot bearings, pallet stones and impulse jewel"],
    ["var(--orange)", "Active reversing wheel, slipping bridle at full wind, rotor rim and regulator index"],
  ],
  facts: [
    `Going train math: barrel (${WATCH.barrelTeeth}T) / center pinion (${WATCH.centerPinion}) = ${ratio(M0.N.barrelToCenter)}; center (${WATCH.centerTeeth}T) / third (${WATCH.thirdPinion}) = ${ratio(M0.N.centerToThird)}; third (${WATCH.thirdTeeth}T) / fourth (${WATCH.fourthPinion}) = ${ratio(M0.N.thirdToFourth)} -> exact ${ratio(M0.N.centerToFourth)} minute-to-second hand ratio. Center to escape is ${ratio(M0.N.centerToEscape)} (${fmt(M0.N.vph)} vph) or ${ratio(MODELS.vintage.N.centerToEscape)} (${fmt(MODELS.vintage.N.vph)} vph), fixing center at 1 rev/h and barrel at 1 turn every ${M0.N.hoursPerBarrelTurn} hours (${ratio(M0.N.totalRatio)} / ${ratio(MODELS.vintage.N.totalRatio)} overall). Dial-side motion works add a ${ratio(WATCH.motionWorks)} reduction for the hour hand.`,
    `Power reserve & bridle: ${WATCH.barrelTurns} usable barrel turns × ${M0.N.hoursPerBarrelTurn} hours/turn = ${M0.N.reserveHours} hours reserve. A ${ratio(WATCH.rotorRatio)} automatic winding reduction requires ${M0.N.rotorRevsFull} effective rotor turns from empty to full; at ${WATCH.slipTorque} N·mm the slipping bridle slides safely inside the barrel wall.`,
    `Swiss lever escapement: ${WATCH.escapeTeeth} club teeth × 2 locks per tooth = ${M0.N.beatsPerRev} beats per escape revolution (${M0.N.toothStepDeg}° per beat, ${M0.N.beatMs} ms modern / ${MODELS.vintage.N.beatMs} ms vintage, ${WATCH.liftAngle}° lift angle, ${WATCH.forkBankDeg}° fork banking angle).`,
    `Harmonic regulation: since balance frequency scales as active hairspring length to the −0.5 power, shifting active length by ${M0.N.reg20Um} microns on a ${WATCH.hairspringMm} mm hairspring changes daily rate by ${M0.N.regMaxRate} s/day. Amplitude falls below ${WATCH.lowAmp}° only when mainspring torque drops near empty.`,
    `Not covered here: keyless works and crown hand-setting clutch (located on the dial side alongside the ${ratio(WATCH.motionWorks)} motion works) and date-jumper complications.`,
  ],
  css: CSS,
  scripts: bundle,
  modelSrc,
  machine,
  data: DATA,
  audit: AUDIT,
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
