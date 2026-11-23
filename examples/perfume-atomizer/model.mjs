// Perfume Atomizer: executable physical model (pure JS, zero imports — inlined into the built page).
//
// Models a hand-operated crimp-pump perfume atomizer:
//   - bottle capacity (ml), dose per spray (0.1 ml), total sprays, remaining sprays
//   - dip tube (straw) length and number of priming presses needed to clear air
//   - press/release stroke, one-way bottom ball seal & nozzle seal states
//   - atomized mist spray through a 0.3 mm pinhole (25 cm reach) vs sputtering below 5% fill
//
// Two What-if variants compare a standard 50 ml bottle (2 priming presses) against a compact
// 10 ml travel atomizer (shorter straw, 1 priming press).

export const BASE = "standard";

export const VARIANTS = {
  standard: {
    name: "standard",
    label: "50 ml bottle",
    capacityMl: 50,
    doseMl: 0.1,
    chamberMl: 0.1,
    strawLenMm: 85,
    primingPresses: 2,
    pinholeMm: 0.3,
    mistReachCm: 25,
    sputterPct: 5,
    strokeMm: 8,
    bottleR: 25,
    bottleH: 62,
    shoulderH: 12,
    neckR: 9.2,
    neckH: 12,
    wall: 3.2,
  },
  travel: {
    name: "travel",
    label: "10 ml travel",
    capacityMl: 10,
    doseMl: 0.1,
    chamberMl: 0.1,
    strawLenMm: 45,
    primingPresses: 1,
    pinholeMm: 0.3,
    mistReachCm: 25,
    sputterPct: 5,
    strokeMm: 6,
    bottleR: 18,
    bottleH: 48,
    shoulderH: 9,
    neckR: 8.6,
    neckH: 10,
    wall: 2.8,
  },
};

export const STORY_FILL_PCT = 80;
export const LOW_FILL_PCT = 3;
export const FULL_FILL_PCT = 100;
export const MAX_LAB_PRESSES = 5;

/** Total full-bottle sprays at `doseMl` per spray. */
export function totalSprays(capacityMl, doseMl) {
  return Math.round(capacityMl / doseMl);
}

/** Remaining liquid volume (ml) at a given fill percentage (0..100). */
export function volumeMl(capacityMl, fillPct) {
  const f = Math.max(0, Math.min(100, fillPct));
  return +((capacityMl * f) / 100).toFixed(1);
}

/** Number of 0.1 ml doses left in the bottle at `fillPct`. */
export function spraysLeft(capacityMl, doseMl, fillPct) {
  const f = Math.max(0, Math.min(100, fillPct));
  return Math.round((capacityMl * (f / 100)) / doseMl);
}

/** Whether the liquid level still covers the bottom tip of the upright straw. */
export function canPickup(fillPct, sputterPct = 5) {
  return fillPct >= sputterPct;
}

/**
 * Compute the steady physical state of the atomizer after `presses` (0..5) on a bottle
 * starting brand-new at `fillPct` (0..100).
 */
export function simulatePresses(spec, presses, fillPct) {
  const p = Math.max(0, Math.round(presses));
  const f = Math.max(0, Math.min(100, fillPct));
  const vol = volumeMl(spec.capacityMl, f);
  const left = spraysLeft(spec.capacityMl, spec.doseMl, f);
  const reaches = canPickup(f, spec.sputterPct);

  if (f <= 0) {
    return {
      presses: p,
      fillPct: 0,
      volumeMl: 0,
      spraysLeft: 0,
      reachesStraw: false,
      primed: false,
      sprayed: false,
      sputtering: false,
      strawFill: 0,
      chamberFill: 0,
      pressFrac: p > 0 ? 0.7 : 0,
      ballOpen: false,
      nozzleSealed: p === 0,
      sprayStrength: 0,
      mode: "empty",
      chamberLabel: "Empty (air)",
      strawLabel: "Empty (air)",
      sprayLabel: "None (empty bottle)",
      badge: "Empty",
      tone: "bad",
    };
  }

  if (!reaches) {
    return {
      presses: p,
      fillPct: f,
      volumeMl: vol,
      spraysLeft: left,
      reachesStraw: false,
      primed: false,
      sprayed: false,
      sputtering: p > 0,
      strawFill: 0,
      chamberFill: p > 0 ? 0.14 : 0,
      pressFrac: p > 0 ? 0.78 : 0,
      ballOpen: false,
      nozzleSealed: p === 0,
      sprayStrength: p > 0 ? 0.34 : 0,
      mode: p > 0 ? "sputter" : "low-idle",
      chamberLabel: p > 0 ? "Mostly air" : "Air only",
      strawLabel: "Tip sits above liquid",
      sprayLabel: p > 0 ? "Weak sputter (tilt bottle)" : "Too low to reach straw",
      badge: p > 0 ? "Sputtering" : "Nearly empty",
      tone: "bad",
    };
  }

  if (p === 0) {
    return {
      presses: 0,
      fillPct: f,
      volumeMl: vol,
      spraysLeft: left,
      reachesStraw: true,
      primed: false,
      sprayed: false,
      sputtering: false,
      strawFill: 0,
      chamberFill: 0,
      pressFrac: 0,
      ballOpen: false,
      nozzleSealed: true,
      sprayStrength: 0,
      mode: "new",
      chamberLabel: "Full of air",
      strawLabel: "Full of air",
      sprayLabel: "None (needs priming)",
      badge: "Unprimed",
      tone: "neutral",
    };
  }

  if (p <= spec.primingPresses) {
    const strawFill = +(p / spec.primingPresses).toFixed(2);
    const primed = p >= spec.primingPresses;
    // Liquid cannot reach the upper chamber until the dip tube straw is completely full
    const chamberFill = primed ? 1 : 0;
    return {
      presses: p,
      fillPct: f,
      volumeMl: vol,
      spraysLeft: left,
      reachesStraw: true,
      primed,
      sprayed: false,
      sputtering: false,
      strawFill,
      chamberFill,
      pressFrac: 0,
      ballOpen: true,
      nozzleSealed: true,
      sprayStrength: 0,
      mode: "priming",
      chamberLabel: primed ? "Full of perfume" : "Still full of air",
      strawLabel: primed ? "Full of perfume" : "Perfume rising up straw",
      sprayLabel: primed ? "Primed — next press sprays" : "None yet (priming straw)",
      badge: primed ? "Primed" : "Priming",
      tone: primed ? "good" : "hot",
    };
  }

  // Primed and actively spraying a clean 0.1 ml dose of mist
  return {
    presses: p,
    fillPct: f,
    volumeMl: vol,
    spraysLeft: left,
    reachesStraw: true,
    primed: true,
    sprayed: true,
    sputtering: false,
    strawFill: 1,
    chamberFill: 0.72,
    pressFrac: 0.88,
    ballOpen: false,
    nozzleSealed: false,
    sprayStrength: 1,
    mode: "spraying",
    chamberLabel: "Pressurized perfume",
    strawLabel: "Full of perfume",
    sprayLabel: `Fine mist (${spec.mistReachCm} cm)`,
    badge: "Spraying",
    tone: "good",
  };
}

/** Build the complete model and 6 narrative step states (steps 1..6) for one bottle variant. */
export function buildModel(spec) {
  const fullSprays = totalSprays(spec.capacityMl, spec.doseMl);
  const storyVol = volumeMl(spec.capacityMl, STORY_FILL_PCT);
  const storySprays = spraysLeft(spec.capacityMl, spec.doseMl, STORY_FILL_PCT);
  const lowVol = volumeMl(spec.capacityMl, LOW_FILL_PCT);
  const lowSprays = spraysLeft(spec.capacityMl, spec.doseMl, LOW_FILL_PCT);

  // Concept overview (step 0): 80% full, primed, mid-spray
  const concept = {
    step: 0,
    fillPct: STORY_FILL_PCT,
    volumeMl: storyVol,
    spraysLeft: storySprays,
    strawFill: 1,
    chamberFill: 0.78,
    pressFrac: 0.78,
    ballOpen: false,
    nozzleSealed: false,
    sprayed: true,
    sputtering: false,
    sprayStrength: 0.92,
    cardTitle: "Inside one spray",
    badge: "Fine mist",
    tone: "good",
    chamberLabel: "Squeezing 0.1 ml dose",
    strawLabel: "Full of perfume",
    sprayLabel: `Fine mist (${spec.mistReachCm} cm)`,
  };

  // Steps 1..6: the causal sequence from brand-new bottle to nearly empty sputter
  const steps = [
    // Step 1: Brand-new bottle — full liquid, air in straw & chamber
    {
      step: 1,
      id: "new",
      fillPct: FULL_FILL_PCT,
      volumeMl: spec.capacityMl,
      spraysLeft: fullSprays,
      strawFill: 0,
      chamberFill: 0,
      pressFrac: 0,
      ballOpen: false,
      nozzleSealed: true,
      sprayed: false,
      sputtering: false,
      sprayStrength: 0,
      cardTitle: "Brand-new bottle",
      badge: "Unprimed",
      tone: "neutral",
      chamberLabel: "Full of air",
      strawLabel: "Full of air",
      sprayLabel: "None yet",
    },
    // Step 2 (PRED_STEP = 2): First press down — squeezing air out of the chamber
    {
      step: 2,
      id: "first-press",
      fillPct: FULL_FILL_PCT,
      volumeMl: spec.capacityMl,
      spraysLeft: fullSprays,
      strawFill: 0,
      chamberFill: 0,
      pressFrac: 1,
      ballOpen: false,
      nozzleSealed: false,
      sprayed: false,
      sputtering: false,
      sprayStrength: 0,
      cardTitle: "First press",
      badge: "Clearing air",
      tone: "hot",
      chamberLabel: "Pushing air out",
      strawLabel: "Still full of air",
      sprayLabel: "No mist yet",
    },
    // Step 3: Release — spring lifts cap, suction pulls perfume up the straw to prime
    {
      step: 3,
      id: "prime",
      fillPct: FULL_FILL_PCT,
      volumeMl: spec.capacityMl,
      spraysLeft: fullSprays,
      strawFill: 1,
      chamberFill: 1,
      pressFrac: 0,
      ballOpen: true,
      nozzleSealed: true,
      sprayed: false,
      sputtering: false,
      sprayStrength: 0,
      cardTitle: "Release to prime",
      badge: "Primed",
      tone: "good",
      chamberLabel: "Full of perfume",
      strawLabel: "Perfume pulled to top",
      sprayLabel: `Ready after ${spec.primingPresses} ${spec.primingPresses === 1 ? "press" : "presses"}`,
    },
    // Step 4: Press again — primed liquid shoots through 0.3 mm pinhole as fine mist
    {
      step: 4,
      id: "spray",
      fillPct: FULL_FILL_PCT,
      volumeMl: spec.capacityMl,
      spraysLeft: fullSprays,
      strawFill: 1,
      chamberFill: 0.68,
      pressFrac: 1,
      ballOpen: false,
      nozzleSealed: false,
      sprayed: true,
      sputtering: false,
      sprayStrength: 1,
      cardTitle: "Press to spray",
      badge: "Fine mist",
      tone: "good",
      chamberLabel: `Squeezing ${spec.doseMl} ml`,
      strawLabel: "Bottom ball sealed shut",
      sprayLabel: `Mist fan (${spec.mistReachCm} cm)`,
    },
    // Step 5: Release & refill — one-way nozzle seal blocks air, fresh 0.1 ml dose refills
    {
      step: 5,
      id: "refill",
      fillPct: FULL_FILL_PCT,
      volumeMl: spec.capacityMl,
      spraysLeft: fullSprays,
      strawFill: 1,
      chamberFill: 1,
      pressFrac: 0,
      ballOpen: true,
      nozzleSealed: true,
      sprayed: false,
      sputtering: false,
      sprayStrength: 0,
      cardTitle: "Release & refill",
      badge: "Refilled",
      tone: "good",
      chamberLabel: `Fresh ${spec.doseMl} ml loaded`,
      strawLabel: "Nozzle blocks outside air",
      sprayLabel: "Ready for next press",
    },
    // Step 6: Nearly empty (3% < 5%) — straw tip sits above liquid, pump pulls air & sputters
    {
      step: 6,
      id: "empty",
      fillPct: LOW_FILL_PCT,
      volumeMl: lowVol,
      spraysLeft: lowSprays,
      strawFill: 0,
      chamberFill: 0.14,
      pressFrac: 0.85,
      ballOpen: false,
      nozzleSealed: false,
      sprayed: false,
      sputtering: true,
      sprayStrength: 0.34,
      cardTitle: "Nearly empty",
      badge: "Sputtering",
      tone: "bad",
      chamberLabel: "Pulling air again",
      strawLabel: "Tip sits above liquid",
      sprayLabel: "Weak sputter (tilt bottle)",
    },
  ];

  return {
    ...spec,
    totalSprays: fullSprays,
    storyFillPct: STORY_FILL_PCT,
    storyVolumeMl: storyVol,
    storySpraysLeft: storySprays,
    lowFillPct: LOW_FILL_PCT,
    lowVolumeMl: lowVol,
    lowSpraysLeft: lowSprays,
    fullFillPct: FULL_FILL_PCT,
    emptyPct: 0,
    maxLabPresses: MAX_LAB_PRESSES,
    concept,
    steps,
  };
}

export const MODELS = Object.fromEntries(
  Object.entries(VARIANTS).map(([k, spec]) => [k, buildModel(spec)]),
);
