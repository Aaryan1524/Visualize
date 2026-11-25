// How a Jet Engine (Turbofan) Works (Everyday Edition): steps, shots, plain-English headings,
// captions, spoken narration script, prediction, claims, topic coverage, and Now you try.
//
// Everyday college-level plain English — ZERO thermodynamics jargon!

import {
  AIRLINER_BYPASS,
  BASE,
  CORE_SQUEEZE_FULL,
  FIGHTER_BYPASS,
  MODELS,
  TURBINE_EXTRACT_AIRLINER_PCT,
  TURBINE_EXTRACT_FIGHTER_PCT,
  corePushShare,
  fanPushShare,
  simulateEngine,
  turbineExtractShare,
} from "./model.mjs";

// Step 0 is the full horizontal cutaway turbofan overview with 5 anatomy callouts.
// Steps 1..6 pan smoothly from the giant front fan through bypass, compressor, burner,
// rear turbine/shaft, and the airliner-vs-fighter design comparison.
export const STEPS = [
  { tab: null, focus: null },
  { tab: "Giant fan", focus: null, shot: ["fan", "bypassUpper"], subject: ["fan"] },
  { tab: "Bypass vs core", focus: null, shot: ["bypassUpper", "bypassLower", "core"], subject: ["bypassUpper", "core"] },
  { tab: "Cool push", focus: null, shot: ["bypassUpper", "bypassLower", "fan"], subject: ["bypassUpper", "bypassLower"] },
  { tab: "Squeeze & burn", focus: null, shot: ["compressor", "burner"], subject: ["compressor", "burner"] },
  { tab: "Turbine shaft", focus: null, shot: ["turbine", "shaft", "fan"], subject: ["turbine", "shaft"] },
  { tab: "Throttle & design", focus: null, shot: ["bypassUpper", "bypassLower", "coreFlow"], subject: ["bypassUpper", "coreFlow"] },
];

/** Prediction asked on Step 2 (Bypass vs core) and revealed on Step 3 (Cool push). */
export const PRED_STEP = 2;

const isAirliner = (M) => M.bypassRatio >= 4;

/** Plain-English step headings, one per step, driven by model numbers & variant. */
export const headings = (M) => [
  isAirliner(M)
    ? "How a modern airliner jet engine splits incoming air into two very different streams."
    : "How a compact fighter jet engine balances a slim bypass duct against a blazing core.",
  `Giant fan: the spinning orange fan splits air into ${M.bypassRatio === 1 ? "1 bypass part" : `${M.bypassRatio} bypass parts`} and ${M.oneCorePart} core part.`,
  "Bypass vs core: two very different air streams leave the back of the engine.",
  isAirliner(M)
    ? `Cool push: ${M.fanPushPct}% of forward push comes from the giant front fan's cool bypass stream.`
    : `Hot core jet: at ${M.bypassRatio}:1 bypass, ${M.corePushPct}% of push comes from the blazing core jet.`,
  `Squeeze and burn: spinning blades squeeze core air ${M.coreSqueezeFull} times tighter before steady burning.`,
  `Turbine shaft: hot exhaust spins the rear turbine, sending ${M.turbineExtractPct}% of core power back to the front fan.`,
  `Throttle and design: compare an ${M.airlinerBypass}:1 airliner (${M.airlinerFanPct}% fan push) against a ${M.fighterBypass}:1 fighter (${M.fighterCorePct}% hot jet).`,
];

/** Detailed plain-English captions for the Details drawer, one per step. */
export const captions = (M) => [
  isAirliner(M)
    ? `A modern airliner jet engine wraps a giant ducted fan around a compact fiery core. In "${M.label}", ${M.bypassRatio} parts of cool air sweep around the outside for every ${M.oneCorePart} part entering the core — step inside to discover which air stream actually supplies most of the forward push.`
    : `A compact fighter jet engine wraps a slim bypass duct around a roaring fiery core. In "${M.label}", ${M.bypassRatio} part of cool air sweeps around the outside for every ${M.oneCorePart} part entering the core — step inside to see how that tight split shifts where the forward push comes from.`,
  `Up front, the giant spinning orange fan pulls in a massive river of air and splits it cleanly into ${M.twoPaths} paths: ${M.bypassRatio === 1 ? "1 part sweeps" : `${M.bypassRatio} parts sweep`} around the outside through the ${isAirliner(M) ? "wide" : "slim"} bypass duct, while just ${M.oneCorePart} part enters the smaller metal core in the center.`,
  isAirliner(M)
    ? `That split creates two completely different streams heading rearward: a wide, gentler river of cool bypass air around the outside, and a compact stream of blazing hot exhaust shooting through the inner core. Before advancing, predict which stream actually gives this ${M.bypassRatio}:1 airliner most of its forward push.`
    : `That tight split creates two very different streams heading rearward: a slim cool bypass stream around the outside, and a roaring stream of blazing hot exhaust shooting through the inner core. Before advancing, predict which stream actually gives this compact ${M.bypassRatio}:1 fighter most of its forward push.`,
  isAirliner(M)
    ? `Revealed: ${M.fanPushPct}% of the forward push comes from that huge, gentler river of cool bypass air, with only ${M.corePushPct}% from the hot core jet! Pushing a large mass of air a little faster uses far less fuel and stays far quieter than blasting a tiny jet at extreme speed.`
    : `Revealed: in this compact ${M.fighterBypass}:1 fighter engine, the bypass duct is slim, so ${M.corePushPct}% of forward push comes from the blazing hot core jet and ${M.fanPushPct}% from the front fan. That compact, super-fast jet favors raw speed — at the cost of much more noise and fuel.`,
  `Meanwhile, the ${M.oneCorePart} part of air entering the metal core passes through tight spinning steel compressor blades that squeeze the air ${M.coreSqueezeFull} times tighter. Inside the glowing burner ring, fuel sprays into that densely packed air and burns steadily without stopping.`,
  `Hot expanding gas from the burner rushes over the brass rear turbine and spins it hard. The rear turbine captures ${M.turbineExtractPct}% of the hot core power and sends it straight back along the solid center shaft to keep both the compressor and the giant front fan spinning.`,
  `Designers tune the bypass ratio for the job. An ${M.airlinerBypass}:1 airliner gets ${M.airlinerFanPct}% of its push from cool fan air for quiet, fuel-saving flights, while a ${M.fighterBypass}:1 fighter gets ${M.fighterCorePct}% from its hot core jet for compact size and blazing speed. Try both throttle and bypass ratio live in Test the engine.`,
];

/**
 * Spoken narration script, one string per step.
 * `[phrase|part]` lights the named 3D part in sync as Kokoro speaks.
 * Natural spoken English — zero symbols, zero thermodynamics jargon!
 */
export const script = (M) => [
  isAirliner(M)
    ? `How does a modern jet engine push a huge airliner across the sky? Look inside the cutaway: a giant spinning front fan splits incoming air into two completely different paths around a compact burning core. Let's step through the engine and discover where most of the forward push really comes from.`
    : `How does a compact fighter jet engine punch through the sky at blazing speed? Look inside this one-to-one cutaway: a slim bypass duct wraps tightly around a roaring burning core. Let's step through the engine to see how that tight split changes where the forward push comes from.`,
  `Start at the intake. The spinning [giant orange front fan|fan] grabs an enormous river of air and splits it into two paths: in this design, ${M.bypassRatio === 1 ? "one part sweeps" : "eight parts sweep"} around the outside through the ${isAirliner(M) ? "wide" : "slim"} [cool bypass duct|bypassUpper bypassLower], while just one part enters the inner metal core.`,
  isAirliner(M)
    ? `Now pause and compare the two streams leaving the back: the [wide cool bypass river|bypassUpper bypassLower] around the outside, and the compact blazing exhaust inside the [inner core|core]. Before you move on, predict which one produces most of this airliner's forward push.`
    : `Now pause and compare the two streams leaving the back: the [slim cool bypass stream|bypassUpper bypassLower] around the outside, and the roaring blazing exhaust inside the [inner core|core]. Before you move on, predict which one produces most of this compact fighter's forward push.`,
  isAirliner(M)
    ? `It is the cool air! Eighty percent of a modern airliner's forward push comes from the [cool bypass stream|bypassUpper bypassLower] pushed by the giant front fan, and only twenty percent from the hot core jet. Gently pushing a huge amount of air uses far less fuel and makes far less noise than blasting a narrow fiery stream.`
    : `It is the hot core jet! In this compact one-to-one fighter engine, the slim [bypass duct|bypassUpper bypassLower] only gives thirty-five percent of the push, while sixty-five percent comes from the blazing hot core jet. That narrow, super-fast exhaust favors raw speed, though it burns fuel fast and roars loudly.`,
  `So what powers that giant front fan? Inside the core, tight spinning [steel compressor blades|compressor] squeeze the incoming air thirty times tighter. Then fuel sprays into the [glowing burner ring|burner], where it burns steadily and expands outward with huge force.`,
  `That rushing hot gas spins the [brass rear turbine|turbine] at the back. In this design, the turbine extracts ${M.turbineExtractPct === 80 ? "eighty percent" : "fifty-five percent"} of the core's energy and sends it straight forward along the solid [center drive shaft|shaft] to keep the compressor and the [giant front fan|fan] spinning continuously.`,
  `Changing the bypass ratio trades quiet fuel savings for raw jet speed. An eight-to-one airliner puts eighty percent of its push into the [cool bypass stream|bypassUpper bypassLower], while a one-to-one fighter puts sixty-five percent into its [blazing hot core exhaust|coreFlow]. Open Test the engine to slide throttle and bypass ratio yourself.`,
];

/** The prediction, asked on PRED_STEP (Step 2) and revealed on Step 3 (variant-aware!). */
export function prediction(M) {
  const high = isAirliner(M);
  return {
    question: high
      ? `Where does most of this ${M.bypassRatio}:1 airliner engine's forward push come from?`
      : `Where does most of this compact ${M.bypassRatio}:1 fighter engine's forward push come from?`,
    choices: [
      "The giant front fan pushing cool air around the outside",
      "The fiery hot exhaust shooting out of the core",
      "The outer metal cover pushing air sideways",
    ],
    answer: high ? 0 : 1,
    explanation: high
      ? `In this ${M.bypassRatio}:1 airliner turbofan, ${M.fanPushPct}% of the forward push comes from the giant front fan pushing cool air around the outside — only ${M.corePushPct}% comes from the hot core jet! Pushing a lot of air gently saves huge amounts of fuel.`
      : `In this compact ${M.bypassRatio}:1 fighter turbofan, the slim bypass duct only adds ${M.fanPushPct}% — ${M.corePushPct}% of the forward push comes from the fiery hot core exhaust blasting out the back for raw speed!`,
  };
}

// ---------------------------------------------------------------- Claims & Coverage
// Every sentence in CLAIMS appears verbatim on the page and is verified on EVERY variant.
export const CLAIMS = [
  {
    text: "splits it cleanly into 2 paths",
    test: (M) => M.twoPaths === 2 && M.oneCorePart === 1,
  },
  {
    text: "tight spinning steel compressor blades that squeeze the air 30 times tighter",
    test: (M) => M.coreSqueezeFull === 30 && M.steps[3].squeezeFactor === 30,
  },
  {
    text: "The rear turbine captures 80% of the hot core power and sends it straight back along the solid center shaft",
    test: (M) =>
      M.airlinerTurbinePct === 80 &&
      turbineExtractShare(AIRLINER_BYPASS) === 80 &&
      turbineExtractShare(FIGHTER_BYPASS) === 55,
  },
  {
    text: "An 8:1 airliner gets 80% of its push from cool fan air for quiet, fuel-saving flights",
    test: (M) => M.airlinerBypass === 8 && M.airlinerFanPct === 80 && M.airlinerCorePct === 20,
  },
  {
    text: "a 1:1 fighter gets 65% from its hot core jet for compact size and blazing speed",
    test: (M) => M.fighterBypass === 1 && M.fighterCorePct === 65 && M.fighterFanPct === 35,
  },
  {
    text: "only 20% from the hot core jet",
    test: (M) => fanPushShare(AIRLINER_BYPASS) === 80 && corePushShare(AIRLINER_BYPASS) === 20,
  },
];

export const COVERAGE = {
  source: "NASA Glenn Research Center Beginner's Guide to Propulsion (Turbofan Engine: front fan, bypass duct, compressor, burner, rear turbine, drive shaft, high vs low bypass)",
  topics: [
    { topic: "how a modern turbofan splits incoming air into bypass and core streams", where: "step:0" },
    { topic: "giant front fan pulling in air and splitting it into bypass and core paths", where: "step:1" },
    { topic: "comparing the cool bypass stream against the hot core jet before revealing which wins", where: "step:2" },
    { topic: "why 80% cool fan push in an 8:1 airliner saves fuel while 65% hot jet drives a 1:1 fighter", where: "step:3" },
    { topic: "multi-stage compressor squeezing core air 30x tighter and steady burning in the combustor", where: "step:4" },
    { topic: "rear turbine extracting core power (80% in 8:1 airliner, 55% in 1:1 fighter) to drive the center shaft", where: "step:5" },
    { topic: "high-bypass airliner (8:1) vs low-bypass fighter (1:1) trade-off", where: "step:6" },
    { topic: "comparing airliner 8:1 and fighter 1:1 regimes live", where: "whatif" },
    { topic: "interactive throttle and bypass ratio propulsion lab", where: "lab" },
    { topic: "predicting air split, push share, and shaft power loop", where: "practice" },
    { topic: "multi-spool nested shafts and variable stator guide vanes", core: false, where: "deferred", why: "noted in Details; everyday mode keeps focus on the single core-to-fan power loop" },
  ],
};

// ---------------------------------------------------------------- Now you try
/**
 * Generate 3 distinct zero-spoiler plain-English question types (seed % 3) directly from model.mjs,
 * showing a clean pre-outcome visual state (`practice: true`, `hidePushSplit: true`).
 *   0 — bypass ratio air split (reader computes b + 1 total parts!)
 *   1 — high-bypass airliner vs low-bypass fighter push dominance
 *   2 — what powers the giant front fan (the rear turbine & center drive shaft)
 */
export function practice(seed, rand, spec = MODELS[BASE]) {
  const kind = seed % 3;

  if (kind === 0) {
    const ratios = [4, 6, 8, 10];
    const b = ratios[Math.floor(rand() * ratios.length)];
    const sim = simulateEngine(spec, 80, b);
    const total = b + 1;
    const wrong2 = b + 2;
    return {
      q: `An engine has a ${b}:1 bypass ratio — ${b} parts of cool air sweep around the outside for every 1 part entering the core. Out of all incoming air, what share goes through the outer bypass duct?`,
      choices: [`${b} of ${total} parts (${sim.bypassAirPct}%)`, `1 of ${total} parts (${100 - sim.bypassAirPct}%)`, `${b} of ${wrong2} parts`],
      explain: `A ${b}:1 bypass ratio means ${b} parts go around the outside and 1 part goes into the core, making ${total} parts total — so ${b} out of ${total} parts (${sim.bypassAirPct}%) stay cool in the bypass duct.`,
      state: {
        ...sim,
        hidePushSplit: true,
        cardTitle: `${b}:1 air split`,
        badge: "Your turn",
        tone: "neutral",
        hudRows: [
          `Setup: ${b}:1 bypass ratio at 80% throttle`,
          `Outer duct: ${b} parts for every 1 core part`,
          `Question: What share bypasses the core?`,
        ],
        practice: true,
      },
    };
  }

  if (kind === 1) {
    const pickAirliner = rand() >= 0.5;
    const b = pickAirliner ? AIRLINER_BYPASS : FIGHTER_BYPASS;
    const sim = simulateEngine(spec, 85, b);
    const right = pickAirliner
      ? `Cool bypass air from the giant front fan (${sim.fanPushPct}%)`
      : `Hot exhaust blasting out of the core (${sim.corePushPct}%)`;
    const other = pickAirliner
      ? `Hot exhaust blasting out of the core (${sim.fanPushPct}%)`
      : `Cool bypass air from the giant front fan (${sim.corePushPct}%)`;
    const third = "Exactly 50% from the outer metal casing";
    return {
      q: pickAirliner
        ? `You widen an engine to an ${AIRLINER_BYPASS}:1 airliner bypass ratio. Which stream now supplies most of the forward push?`
        : `You slim an engine down to a ${FIGHTER_BYPASS}:1 fighter bypass ratio. Which stream now supplies most of the forward push?`,
      choices: [right, other, third],
      explain: pickAirliner
        ? `At ${AIRLINER_BYPASS}:1 bypass, the giant front fan pushes a wide river of cool air that delivers ${sim.fanPushPct}% of forward push, leaving ${sim.corePushPct}% to the hot core jet.`
        : `At ${FIGHTER_BYPASS}:1 bypass, the bypass duct is slim, so the blazing hot core jet delivers ${sim.corePushPct}% of forward push while the front fan adds ${sim.fanPushPct}%.`,
      state: {
        ...sim,
        hidePushSplit: true,
        cardTitle: `${b}:1 design check`,
        badge: "Your turn",
        tone: "neutral",
        hudRows: [
          `Setup: ${b}:1 bypass ratio engine`,
          `Throttle: 85% cruise power`,
          `Question: Which stream gives most push?`,
        ],
        practice: true,
      },
    };
  }

  const throttles = [50, 70, 90, 100];
  const thr = throttles[Math.floor(rand() * throttles.length)];
  const b = spec?.bypassRatio ?? AIRLINER_BYPASS;
  const sim = simulateEngine(spec, thr, b);
  const squeeze = sim.squeezeFactor;
  const shaftPct = b >= 4 ? TURBINE_EXTRACT_AIRLINER_PCT : TURBINE_EXTRACT_FIGHTER_PCT;
  return {
    q: `At ${thr}% throttle, core air is squeezed ${squeeze} times tighter and burned steadily. What actually keeps the giant front fan spinning?`,
    choices: [
      `The rear turbine catching ${shaftPct}% of hot gas power through the center shaft`,
      "An electric battery hidden inside the silver outer cover",
      "Incoming wind pushing the fan backward from behind",
    ],
    explain: `Hot expanding gas from the burner spins the brass rear turbine, which captures ${shaftPct}% of the core power in this ${b}:1 design and drives the solid center shaft straight forward to spin the compressor and giant front fan.`,
    state: {
      ...sim,
      hidePushSplit: true,
      cardTitle: "Power loop check",
      badge: "Your turn",
      tone: "neutral",
      hudRows: [
        `Throttle: ${thr}% (${squeeze}x core air squeeze)`,
        `Burner: Steady fuel burning inside core`,
        `Question: What drives the front fan?`,
      ],
      practice: true,
    },
  };
}
