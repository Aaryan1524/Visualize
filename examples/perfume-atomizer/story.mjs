// Perfume Atomizer: the story in one place — steps, shots, plain-English headings, captions,
// narration script, prediction, claims, topic coverage, and Now you try practice questions.
//
// Everyday mode: clear college-level intuition with zero fluid-dynamics jargon, backed by real
// tested quantities from model.mjs.

import {
  BASE,
  LOW_FILL_PCT,
  MODELS,
  STORY_FILL_PCT,
  canPickup,
  simulatePresses,
  spraysLeft,
  volumeMl,
} from "./model.mjs";

// Step 0 is the concept overview (no tab, whole bottle + mist).
// Steps 1..6 each frame the exact physical part causing that step's change.
export const STEPS = [
  { tab: null, focus: null },
  { tab: "Air inside", focus: null, shot: ["liquid", "straw"], subject: ["liquid", "straw"] },
  { tab: "First press", focus: null, shot: ["nozzle", "chamber"], subject: ["nozzle", "chamber"] },
  { tab: "Suction", focus: null, shot: ["straw", "chamber"], subject: ["straw", "chamber"] },
  { tab: "Mist spray", focus: null, shot: ["nozzle", "mist"], subject: ["nozzle", "mist"] },
  { tab: "Refill", focus: null, shot: ["chamber", "straw"], subject: ["chamber", "straw"] },
  { tab: "Nearly empty", focus: null, shot: ["straw", "liquid"], subject: ["straw", "liquid"] },
];

/** The step that asks the prediction (on the brand-new bottle, revealed on step 2). */
export const PRED_STEP = 1;

const pressesWord = (n) => (n === 1 ? "1 priming press" : `${n} priming presses`);
const pressesSpoken = (n) => (n === 1 ? "one priming press" : `${n === 2 ? "two" : n} priming presses`);
const capSpoken = (ml) => (ml === 50 ? "fifty" : ml === 10 ? "ten" : String(ml));

/** Plain-English step headings, one per step, computed from the model. */
export const headings = (M) => [
  "How does pressing a tiny cap make a mist cloud?",
  `Brand-new bottle: ${M.capacityMl} ml of perfume, air in the straw.`,
  "First press: pressing the cap on a brand-new bottle.",
  `Release: suction pulls perfume up after ${pressesWord(M.primingPresses)}.`,
  `Press again: perfume shoots through a ${M.pinholeMm} mm pinhole as mist.`,
  `Release to refill: one-way seals pull a fresh ${M.doseMl} ml dose.`,
  `Nearly empty: below ${M.sputterPct}%, the straw tip pulls air.`,
];

/** Detailed plain-English captions for the Details drawer, one per step. */
export const captions = (M) => [
  `Pressing a small spray cap turns calm perfume at the bottom of a glass bottle into a floating mist cloud reaching ${M.mistReachCm} cm — using only air pressure, a tiny spring, two one-way seals, and a ${M.pinholeMm} mm pinhole. Each full press delivers ${M.doseMl} ml, giving ${M.totalSprays} sprays from a full ${M.capacityMl} ml bottle.`,
  `A brand-new ${M.capacityMl} ml bottle starts ${M.fullFillPct}% full (${M.totalSprays} sprays worth of perfume), but the straw and pump chamber start full of air. Until that air is cleared out, the pump has no liquid ready at the top.`,
  `Pressing down on a brand-new bottle pushes air out instead of spraying mist. As the orange cap moves down ${M.strokeMm} mm, the small piston squeezes the return spring, seats the bottom check ball shut, and vents the trapped air through the nozzle.`,
  `Letting go lets the spring lift the cap, creating suction that pulls perfume up the straw. Outside air presses down on the perfume in the bottle, pushing golden liquid past the lifted bottom ball into the pump chamber. Because this bottle's straw is ${M.strawLenMm} mm long, it takes ${pressesWord(M.primingPresses)} to fill the straw and chamber. A shorter straw takes fewer priming presses to fill the chamber.`,
  `Now the bottle is primed and the chamber is full of liquid. Pressing a primed chamber closes the bottom ball seal so liquid cannot slip back into the bottle. With nowhere else to go, squeezing perfume through the ${M.pinholeMm} mm pinhole breaks the stream into a fine mist cloud reaching ${M.mistReachCm} cm.`,
  `When you let go after spraying, a one-way nozzle seal blocks outside air on release so the chamber refills with a fresh ${M.doseMl} ml dose straight up from the straw. Because the straw stays full of liquid, the very next press sprays fine mist right away.`,
  `When the liquid drops below ${M.sputterPct}%, the straw tip sits above the surface and the pump pulls air. Here at ${M.lowFillPct}% fill (${M.lowVolumeMl} ml, about ${M.lowSpraysLeft} sprays left in the corners), pressing upright only gives a weak sputter — tilting the bottle pools the last drops around the straw tip.`,
];

/**
 * Spoken narration script, one string per step.
 * `[phrase|part]` highlights the named 3D part in sync as Kokoro speaks.
 * Plain spoken English, no raw abbreviations.
 */
export const script = (M) => [
  `How does pressing a tiny cap turn calm perfume at the bottom of a bottle into a floating mist cloud? Inside the neck sits a tiny hand pump with a spring, two one-way seals, and a pinhole just three tenths of a millimeter wide. Let's watch what happens from the very first press.`,
  `Start with a brand-new ${capSpoken(M.capacityMl)} milliliter bottle. The [golden perfume|liquid] fills the glass base, but the [long straw|straw] and the small pump chamber above it start completely full of air.`,
  `Now press the [orange spray cap|nozzle] down for the first time. Inside the [pump chamber|chamber], the piston compresses the spring and pushes the trapped air out through the tip.`,
  `Let go, and the spring pushes the cap back up. That creates gentle suction in the [pump chamber|chamber], lifting the tiny bottom ball and pulling golden perfume right up the [straw|straw]. It takes ${pressesSpoken(M.primingPresses)} to fill this bottle's straw and chamber.`,
  `Now the chamber is primed with perfume. Press the [orange cap|nozzle] again: the bottom ball seals shut so liquid cannot go back down, and the squeezed perfume shoots through the tiny pinhole, shattering into a [fine mist cloud|mist] reaching twenty-five centimeters.`,
  `Let go once more. A one-way seal at the nozzle blocks outside air from sneaking in, so the rising spring pulls a fresh dose up the [straw|straw] to refill the [pump chamber|chamber] for your next spray.`,
  `Finally, when the [perfume level|liquid] drops below five percent, the bottom tip of the [straw|straw] pokes out into air. The pump pulls air instead of liquid and only sputters, until you tilt the bottle so the straw reaches the last drops.`,
];

/** The prediction, asked on PRED_STEP (step 1) and revealed on step 2. */
export function prediction(M) {
  return {
    question: "You just bought a brand-new bottle and press the cap once. Does mist spray out right away?",
    choices: [
      "No — it pushes air out first",
      "Yes — mist sprays right away",
    ],
    answer: 0,
    explanation: `No mist yet: the straw and chamber start full of air, so press 1 pushes air out, and letting go pulls perfume up the straw (${pressesWord(M.primingPresses)} ${M.primingPresses === 1 ? "fills" : "fill"} this ${M.capacityMl} ml bottle).`,
  };
}

// ---------------------------------------------------------------- Claims & Coverage
// Every sentence in CLAIMS appears word for word on the page and is tested against EVERY variant.
export const CLAIMS = [
  {
    text: "the straw and pump chamber start full of air",
    test: (M) => M.steps[0].strawFill === 0 && M.steps[0].chamberFill === 0,
  },
  {
    text: "Pressing down on a brand-new bottle pushes air out instead of spraying mist",
    test: (M) => {
      const s = simulatePresses(M, 1, 100);
      return s.sprayed === false && s.mode === "priming" && M.steps[1].sprayed === false;
    },
  },
  {
    text: "Letting go lets the spring lift the cap, creating suction that pulls perfume up the straw",
    test: (M) => M.steps[2].pressFrac === 0 && M.steps[2].ballOpen === true && M.steps[2].strawFill === 1 && M.steps[2].chamberFill === 1,
  },
  {
    text: "Pressing a primed chamber closes the bottom ball seal so liquid cannot slip back into the bottle",
    test: (M) => M.steps[3].ballOpen === false && M.steps[3].pressFrac === 1 && M.steps[3].sprayed === true,
  },
  {
    text: "squeezing perfume through the 0.3 mm pinhole breaks the stream into a fine mist cloud",
    test: (M) => M.pinholeMm === 0.3 && M.steps[3].sprayed === true && M.steps[3].sprayStrength === 1,
  },
  {
    text: "a one-way nozzle seal blocks outside air on release so the chamber refills with a fresh 0.1 ml dose",
    test: (M) => M.steps[4].nozzleSealed === true && M.steps[4].chamberFill === 1 && M.doseMl === 0.1,
  },
  {
    text: "When the liquid drops below 5%, the straw tip sits above the surface and the pump pulls air",
    test: (M) => canPickup(M.lowFillPct, M.sputterPct) === false && simulatePresses(M, 3, M.lowFillPct).sputtering === true,
  },
  {
    text: "A shorter straw takes fewer priming presses to fill the chamber",
    test: () => MODELS.travel.strawLenMm < MODELS.standard.strawLenMm && MODELS.travel.primingPresses < MODELS.standard.primingPresses,
  },
];

export const COVERAGE = {
  source: "Wikipedia, Spray bottle & Atomizer nozzle (pump mechanism, priming, one-way check valves, pinhole breakup); HowStuffWorks, How Pump Sprayers Work",
  topics: [
    { topic: "turning calm bottled liquid into a fine mist cloud with a hand pump", where: "step:0" },
    { topic: "brand-new bottle starts with air inside the dip tube straw and pump chamber", where: "step:1" },
    { topic: "first press clears trapped air out of the chamber before liquid can spray", where: "step:2" },
    { topic: "return spring lifts the cap on release, creating suction that draws perfume up the straw", where: "step:3" },
    { topic: "bottom one-way check ball seals during the spray press so liquid shoots through the 0.3 mm pinhole as mist", where: "step:4" },
    { topic: "top one-way nozzle seal blocks outside air on release so a fresh 0.1 ml dose refills the chamber", where: "step:5" },
    { topic: "nearly empty bottle below 5% exposes the straw tip to air, causing sputtering until tilted", where: "step:6" },
    { topic: "bottle size and straw length change total sprays and priming presses needed", where: "whatif" },
    { topic: "interactive press count and fill level testing", where: "lab" },
    { topic: "predicting priming, sprays remaining, and low-fill sputtering", where: "practice" },
    { topic: "swirl grooves inside the nozzle cap", core: false, where: "deferred", why: "mentioned in Details; the main steps focus on the visible pump, seals, and pinhole" },
  ],
};

// ---------------------------------------------------------------- Now you try
/**
 * Generate a model-graded everyday question of 3 distinct types (seed % 3):
 *   0 — priming press outcome on a brand-new bottle
 *   1 — sprays remaining from fill % and 0.1 ml dose
 *   2 — upright spray outcome near empty (< 5%) vs plenty of perfume
 */
export function practice(seed, rand, spec = MODELS[BASE]) {
  const kind = seed % 3;

  if (kind === 0) {
    const pressChoices = [1, spec.primingPresses + 1];
    const p = pressChoices[Math.floor(rand() * pressChoices.length)];
    const res = simulatePresses(spec, p, 100);
    const right = res.sprayed
      ? "A clean cloud of fine mist sprays out"
      : "No mist yet — it pushes air out while priming";
    const other = res.sprayed
      ? "No mist yet — it pushes air out while priming"
      : "A clean cloud of fine mist sprays out";
    const third = "It sputters because the bottle is almost empty";
    return {
      q: `You pick up a brand-new ${spec.capacityMl} ml bottle (needs ${pressesWord(spec.primingPresses)}) and press the cap ${p === 1 ? "once" : `${p} times`}. What happens on press ${p}?`,
      choices: [right, other, third],
      explain: res.sprayed
        ? `Press ${p} is past the ${pressesWord(spec.primingPresses)}, so the chamber is full of perfume and sprays a fine mist.`
        : `A brand-new ${spec.capacityMl} ml bottle starts with air in the straw and chamber, so press 1 pushes air out before liquid reaches the nozzle.`,
      state: {
        fillPct: 100,
        volumeMl: spec.capacityMl,
        spraysLeft: spec.totalSprays,
        strawFill: 0,
        chamberFill: 0,
        pressFrac: 0,
        ballOpen: false,
        nozzleSealed: true,
        sprayStrength: 0,
        sputtering: false,
        cardTitle: `Brand-new bottle`,
        badge: "Your turn",
        tone: "neutral",
        chamberLabel: "Before you press",
        strawLabel: "Starts full of air",
        sprayLabel: "Pick your prediction",
        practice: true,
      },
    };
  }

  if (kind === 1) {
    const pcts = [20, 40, 60, 80];
    const pct = pcts[Math.floor(rand() * pcts.length)];
    const left = spraysLeft(spec.capacityMl, spec.doseMl, pct);
    const vol = volumeMl(spec.capacityMl, pct);
    const wrong1 = Math.max(10, Math.round(left / 2));
    const wrong2 = left + Math.round(spec.totalSprays * 0.2);
    return {
      q: `This ${spec.capacityMl} ml bottle is ${pct}% full (${vol} ml left). At ${spec.doseMl} ml per spray, about how many sprays remain?`,
      choices: [`${left} sprays`, `${wrong1} sprays`, `${wrong2} sprays`],
      explain: `${vol} ml divided by ${spec.doseMl} ml per spray gives ${left} sprays (${pct}% of a full bottle's ${spec.totalSprays} sprays).`,
      state: {
        fillPct: pct,
        volumeMl: vol,
        spraysLeft: left,
        strawFill: 1,
        chamberFill: 1,
        pressFrac: 0,
        ballOpen: false,
        nozzleSealed: true,
        sprayStrength: 0,
        sputtering: false,
        cardTitle: `${pct}% full (${vol} ml)`,
        badge: "Your turn",
        tone: "neutral",
        chamberLabel: `${spec.doseMl} ml per spray`,
        strawLabel: "Primed and ready",
        sprayLabel: "Estimate sprays left",
        practice: true,
        hideSprays: true,
      },
    };
  }

  const isLow = Math.floor(rand() * 2) === 0;
  const pct = isLow ? [2, 3, 4][Math.floor(rand() * 3)] : [45, 65, 85][Math.floor(rand() * 3)];
  const vol = volumeMl(spec.capacityMl, pct);
  const left = spraysLeft(spec.capacityMl, spec.doseMl, pct);
  const right = isLow
    ? "It pulls air and only sputters until you tilt the bottle"
    : `It sprays a clean fine mist cloud reaching ${spec.mistReachCm} cm`;
  const other = isLow
    ? `It sprays a clean fine mist cloud reaching ${spec.mistReachCm} cm`
    : "It pulls air and only sputters until you tilt the bottle";
  const third = "The bottom ball seal locks open and drains the nozzle";
  return {
    q: `A primed ${spec.capacityMl} ml bottle is held upright at ${pct}% fill (the straw tip needs at least ${spec.sputterPct}%). What happens when you press the cap?`,
    choices: [right, other, third],
    explain: isLow
      ? `At ${pct}% fill (under ${spec.sputterPct}%), the perfume surface sits below the upright straw tip, so the pump sucks air and sputters.`
      : `At ${pct}% fill (well above ${spec.sputterPct}%), the straw tip stays submerged in perfume, so the primed chamber sprays a clean fine mist.`,
    state: {
      fillPct: pct,
      volumeMl: vol,
      spraysLeft: left,
      strawFill: isLow ? 0 : 1,
      chamberFill: isLow ? 0 : 1,
      pressFrac: 0,
      ballOpen: false,
      nozzleSealed: true,
      sprayStrength: 0,
      sputtering: false,
      cardTitle: `Upright at ${pct}% fill`,
      badge: "Your turn",
      tone: "neutral",
      chamberLabel: "Before you press",
      strawLabel: "Check the straw tip",
      sprayLabel: "Pick your prediction",
      practice: true,
    },
  };
}
