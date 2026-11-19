// Mechanical automatic watch movement model (mm, teeth, N·mm, Hz, degrees, hours, s/day).
// Pure and import-free: build.mjs inlines this file into the standalone page, so the page,
// the correctness audit and the unit tests execute the exact same horological mechanics.
//
// Grounded in:
//  - George Daniels, "Watchmaking" (going train ratios, Swiss lever escapement phases:
//    lock, unlock, impulse, drop; slipping mainspring bridle; balance & hairspring regulation)
//  - Standard 11.5-ligne (25.6 mm) Swiss automatic calibre architecture

export const WATCH = {
  calibreMm: 25.6, // standard 11.5-ligne movement diameter (mm)
  barrelTeeth: 72,
  centerPinion: 12, // 72 / 12 = 6 : 1 -> barrel turns once every 6 hours
  centerTeeth: 64,
  thirdPinion: 8,   // 64 / 8 = 8 : 1
  thirdTeeth: 60,
  fourthPinion: 8,  // 60 / 8 = 7.5 : 1 -> 8 * 7.5 = 60 : 1 (center 1 rev/h -> fourth 1 rev/min)
  escapeTeeth: 15,  // 15 club teeth * 2 beats/tooth = 30 beats per escape wheel revolution
  motionWorks: 12,  // dial-side 12 : 1 reduction (cannon pinion -> minute -> hour wheel) for hour hand
  barrelTurns: 7,   // 7 usable turns * 6 hours/turn = 42 hours power reserve
  rotorRatio: 120,  // 120 rotor revolutions = 1 full barrel turn (840 revs from empty to full)
  maxRotorRpm: 2.0, // effective continuous winding rpm at 100% vigorous wrist activity (+6.0 h/h)
  slipTorque: 7.2,  // N·mm where slipping bridle slides against barrel wall (prevents overwind)
  minTorque: 3.6,   // N·mm when nearly unwound (0% wind)
  nominalAmp: 290,  // degrees semi-arc at full wind (healthy range: 260-315 deg)
  lowAmp: 220,      // degrees below which timekeeping degrades
  liftAngle: 52,    // degrees of balance arc spent engaging the pallet fork (+/- 26 deg)
  forkBankDeg: 6.5, // pallet fork resting angle against each banking pin (degrees)
  hairspringMm: 180, // active balance spring length (mm)
  secPerDay: 86400,
};

export const VARIANTS = {
  modern: { key: "modern", label: "28,800 vph · 4 Hz", fourthTeeth: 112, escapePinion: 7 },
  vintage: { key: "vintage", label: "18,000 vph · 2.5 Hz", fourthTeeth: 70, escapePinion: 7 },
};

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Compute barrel torque (N·mm) and whether the slipping bridle is sliding at a given wind %. */
export function barrelAt(windPct, windingActive = false) {
  const w = clamp(windPct, 0, 100);
  const frac = w / 100;
  const plateau = Math.pow(frac, 0.52);
  const rawTorque = WATCH.minTorque + (WATCH.slipTorque - WATCH.minTorque) * plateau;
  const torque = r2(Math.min(WATCH.slipTorque, rawTorque));
  const slipping = w >= 99.5 && windingActive;
  const reserveHours = r1(frac * WATCH.barrelTurns * 6);
  const ampDeg = Math.round(165 + (WATCH.nominalAmp - 165) * Math.pow(clamp((torque - WATCH.minTorque) / (WATCH.slipTorque - WATCH.minTorque), 0, 1), 0.8));
  return { windPct: w, torque, slipping, reserveHours, ampDeg };
}

/**
 * Exact hairspring length shift (mm and microns) required by the regulator pins to produce
 * `rateSecPerDay` seconds/day error. Since f ~ L^(-1/2), df/f = -0.5 * dL/L.
 */
export function regulatorAt(rateSecPerDay) {
  const rate = clamp(rateSecPerDay, -20, 20);
  const fracLen = (-2 * rate) / WATCH.secPerDay; // negative = shorter spring = faster beat
  const deltaMm = WATCH.hairspringMm * fracLen;
  const deltaUm = Math.round(deltaMm * 1000) || 0;
  return { rateSecPerDay: rate, deltaMm: r2(deltaMm) || 0, deltaUm };
}

/**
 * Net power-reserve rate (hours gained per hour worn) for a wrist activity level 0..100%.
 * At 40% desk activity: 0.80 effective rotor rpm -> 48 revs/h -> 0.40 barrel turns/h ->
 * +2.4 h/h gained (net +1.4 h/h after the watch burns 1.0 h/h). Sedentary 5-15% drains net reserve.
 */
export function windingRate(wristPct) {
  const w = clamp(wristPct, 0, 100);
  const rotorRpm = r2((w / 100) * WATCH.maxRotorRpm);
  const barrelTurnsPerHr = (rotorRpm * 60) / WATCH.rotorRatio;
  const gainedHrsPerHr = r1(barrelTurnsPerHr * 6);
  const netHrsPerHr = r1(gainedHrsPerHr - 1.0);
  return { wristPct: w, rotorRpm, gainedHrsPerHr, netHrsPerHr };
}

/**
 * Exact 4-phase Swiss lever escapement kinematics for continuous oscillator phase `beats`
 * (each integer increment of `beats` is one half-oscillation: 1 beat = 12 deg escape advance).
 * Since balDeg = -dir * ampDeg * cos(pi * u), the balance crosses +/- (liftAngle/2) at
 * u = 0.5 +/- asin((liftAngle/2) / ampDeg) / pi, preserving the exact 52 deg lift angle.
 */
export function escapementAt(beats, ampDeg = WATCH.nominalAmp) {
  const half = Math.floor(beats);
  const u = beats - half;
  const dir = half % 2 === 0 ? 1 : -1;
  const balDeg = -dir * ampDeg * Math.cos(Math.PI * u);

  // Exact harmonic phase half-width for the stated 52 deg lift angle (+/- 26 deg about center)
  const halfLift = Math.asin(Math.min(0.95, (WATCH.liftAngle / 2) / Math.max(90, ampDeg))) / Math.PI;
  const uUnlock = 0.5 - halfLift;
  const uImpulse0 = 0.5 - halfLift * 0.42;
  const uImpulse1 = 0.5 + halfLift;
  const uDrop = 0.5 + halfLift * 1.28;

  let phase = "lock";
  let forkNorm = -dir;
  let toothFrac = 0;

  if (u < uUnlock) {
    phase = "lock";
    forkNorm = -dir;
    toothFrac = 0;
  } else if (u < uImpulse0) {
    phase = "unlock";
    const f = (u - uUnlock) / Math.max(1e-6, uImpulse0 - uUnlock);
    forkNorm = -dir + dir * 0.28 * f;
    // Slight draw recoil during unlock before the tooth slips onto the impulse plane
    toothFrac = -0.04 * Math.sin(Math.PI * f);
  } else if (u < uImpulse1) {
    phase = "impulse";
    const f = (u - uImpulse0) / Math.max(1e-6, uImpulse1 - uImpulse0);
    const s = f * f * (3 - 2 * f);
    forkNorm = -dir + dir * (0.28 + 1.62 * s);
    toothFrac = 0.88 * s;
  } else if (u < uDrop) {
    phase = "drop";
    const f = (u - uImpulse1) / Math.max(1e-6, uDrop - uImpulse1);
    forkNorm = dir * (0.9 + 0.1 * f);
    toothFrac = 0.88 + 0.12 * f;
  } else {
    phase = "lock";
    forkNorm = dir;
    toothFrac = 1;
  }

  const toothStepDeg = 360 / (WATCH.escapeTeeth * 2); // 12 degrees per beat
  const escapeDeg = (half + toothFrac) * toothStepDeg;
  const forkDeg = forkNorm * WATCH.forkBankDeg;
  const breath = 1 + 0.09 * (balDeg / WATCH.nominalAmp);
  return { phase, balDeg, forkDeg, escapeDeg, breath, dir };
}

export function makeModel(over = {}) {
  const D = WATCH;
  const v = over.variant || VARIANTS.modern;
  const barrelToCenter = D.barrelTeeth / D.centerPinion; // 6
  const centerToThird = D.centerTeeth / D.thirdPinion;   // 8
  const thirdToFourth = D.thirdTeeth / D.fourthPinion;   // 7.5
  const fourthToEscape = v.fourthTeeth / v.escapePinion; // 16 (modern) or 10 (vintage)
  const centerToFourth = centerToThird * thirdToFourth;  // 60
  const centerToEscape = centerToFourth * fourthToEscape; // 960 (modern) or 600 (vintage)
  const totalRatio = barrelToCenter * centerToEscape;     // 5760 or 3600
  const escapeRevPerMin = fourthToEscape;
  const beatsPerRev = D.escapeTeeth * 2;  // 30
  const beatsPerMin = escapeRevPerMin * beatsPerRev; // 480 or 300
  const beatsPerSec = beatsPerMin / 60;   // 8 or 5
  const hz = beatsPerSec / 2;             // 4.0 or 2.5
  const vph = beatsPerMin * 60;           // 28800 or 18000
  const beatsPerDay = vph * 24;           // 691200 or 432000
  const beatMs = Math.round(1000 / beatsPerSec); // 125 or 200 ms
  const hoursPerBarrelTurn = (totalRatio * beatsPerRev) / vph; // 6.0 hours
  const reserveHours = D.barrelTurns * hoursPerBarrelTurn; // 42 hours
  const rotorRevsFull = D.barrelTurns * D.rotorRatio; // 840 revolutions
  const reg20 = regulatorAt(20);

  return {
    D,
    v,
    N: {
      calibreMm: D.calibreMm,
      barrelToCenter,
      centerToThird,
      thirdToFourth,
      fourthToEscape,
      centerToFourth,
      centerToEscape,
      totalRatio,
      escapeRevPerMin,
      beatsPerRev,
      beatsPerMin,
      beatsPerSec,
      hz,
      vph,
      beatsPerDay,
      beatMs,
      hoursPerBarrelTurn,
      reserveHours,
      rotorRevsFull,
      slipTorque: D.slipTorque,
      nominalAmp: D.nominalAmp,
      lowAmp: D.lowAmp,
      liftAngle: D.liftAngle,
      reg20Um: Math.abs(reg20.deltaUm),
      toothStepDeg: 360 / beatsPerRev, // 12 deg
    },
  };
}

export const MODELS = Object.fromEntries(Object.entries(VARIANTS).map(([k, variant]) => [k, makeModel({ variant })]));
