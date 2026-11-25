// How a Jet Engine (Turbofan) Works (Everyday Edition): executable physical model.
// Pure JS, zero imports — inlined directly into the built HTML page.
//
// Plain-English everyday physics underneath:
//   - High-bypass airliner (8:1): 8 parts cool bypass air for every 1 part core air ->
//     80% of forward push from the giant front fan's cool bypass stream, 20% from the hot core jet.
//   - Low-bypass fighter (1:1): 1 part bypass air for every 1 part core air ->
//     35% fan push, 65% hot core jet (compact & blazing exhaust speed, much louder & thirstier).
//   - Compressor squeezes core air up to 30x tighter at full throttle before steady fuel burning.
//   - Rear turbine power extraction scales realistically with bypass ratio:
//     55% at 1:1 fighter (leaving more energy for the fast hot core jet),
//     80% at 8:1 airliner, up to 82% at 10:1 ultra-high bypass to drive the giant front fan.
//   - Continuous Lab sliders: Throttle 20..100% and Bypass ratio 1..10 (shifting fan push
//     smoothly from 35% at 1:1 through 80% at 8:1 up to 83% at 10:1).

export const BASE = "airliner";

export const CORE_SQUEEZE_FULL = 30;
export const TURBINE_EXTRACT_AIRLINER_PCT = 80;
export const TURBINE_EXTRACT_FIGHTER_PCT = 55;
export const TURBINE_EXTRACT_MAX_PCT = 82;
export const MIN_THROTTLE_PCT = 20;
export const MAX_THROTTLE_PCT = 100;
export const DEFAULT_THROTTLE_PCT = 85;
export const MIN_BYPASS = 1;
export const MAX_BYPASS = 10;
export const AIRLINER_BYPASS = 8;
export const FIGHTER_BYPASS = 1;

export const VARIANTS = {
  airliner: {
    name: "airliner",
    label: "Airliner (8:1 bypass)",
    bypassRatio: AIRLINER_BYPASS,
    cruiseThrottlePct: 85,
    exhaustWord: "Cooler & quieter",
    fuelWord: "Uses far less fuel",
    roleSummary: "Long-range passenger jet",
  },
  fighter: {
    name: "fighter",
    label: "Fighter (1:1 bypass)",
    bypassRatio: FIGHTER_BYPASS,
    cruiseThrottlePct: 90,
    exhaustWord: "Blazing & loud",
    fuelWord: "Burns fuel fast",
    roleSummary: "Compact high-speed jet",
  },
};

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Percentage of forward push produced by the giant front fan's cool bypass stream
 * for a given bypass ratio B in 1..10.
 *   - 1:1 (fighter)  -> 35% fan push / 65% hot core jet
 *   - 8:1 (airliner) -> 80% fan push / 20% hot core jet
 *   - 10:1 (ultra)   -> 83% fan push / 17% hot core jet
 */
export function fanPushShare(bypassRatio) {
  const b = clampNum(Number(bypassRatio) || MIN_BYPASS, MIN_BYPASS, MAX_BYPASS);
  const k = 1.86 + 0.018 * (b - 1);
  return Math.round((b / (b + k)) * 100);
}

/** Percentage of forward push produced by the hot core exhaust jet (sums to 100% with fanPushShare). */
export function corePushShare(bypassRatio) {
  return 100 - fanPushShare(bypassRatio);
}

/** Percentage of total incoming air swept through the outer bypass duct (B / (B + 1)). */
export function bypassAirShare(bypassRatio) {
  const b = clampNum(Number(bypassRatio) || MIN_BYPASS, MIN_BYPASS, MAX_BYPASS);
  return Math.round((b / (b + 1)) * 100);
}

/**
 * Percentage of hot core gas power captured by the rear turbine to spin the center shaft
 * (compressor + front fan), scaling realistically with bypass ratio:
 *   - 1:1 (fighter)  -> 55% to shaft (more hot gas left for blazing jet exhaust)
 *   - 8:1 (airliner) -> 80% to shaft (powers the huge front fan)
 *   - 10:1 (ultra)   -> 82% to shaft
 */
export function turbineExtractShare(bypassRatio) {
  const b = clampNum(Number(bypassRatio) || MIN_BYPASS, MIN_BYPASS, MAX_BYPASS);
  return Math.round(55 + 29 * (1 - Math.exp(-0.285 * (b - 1))));
}

/** How many times tighter the spinning compressor squeezes core air at a given throttle (6x..30x). */
export function coreSqueezeAt(throttlePct) {
  const t = clampNum(Number(throttlePct) || MIN_THROTTLE_PCT, MIN_THROTTLE_PCT, MAX_THROTTLE_PCT);
  return Math.max(6, Math.round(CORE_SQUEEZE_FULL * (t / MAX_THROTTLE_PCT)));
}

/** Visual bypass tier for selecting airflow streamline geometry ("low" | "mid" | "high"). */
export function bypassTierOf(bypassRatio) {
  const b = clampNum(Number(bypassRatio) || MIN_BYPASS, MIN_BYPASS, MAX_BYPASS);
  if (b >= 6) return "high";
  if (b >= 3) return "mid";
  return "low";
}

/**
 * Live engine state for any Throttle % (20..100) and Bypass ratio (1..10).
 * Used by both the story steps and the interactive "Test the engine" lab.
 */
export function simulateEngine(spec, throttlePct, bypassRatio) {
  const throttle = clampNum(Math.round(throttlePct), MIN_THROTTLE_PCT, MAX_THROTTLE_PCT);
  const bypass = clampNum(Math.round(bypassRatio), MIN_BYPASS, MAX_BYPASS);
  const totalAirParts = bypass + 1;
  const bypassAirPct = bypassAirShare(bypass);
  const fanPushPct = fanPushShare(bypass);
  const corePushPct = 100 - fanPushPct;
  const fanPushPoints = Math.round((throttle * fanPushPct) / 100);
  const corePushPoints = throttle - fanPushPoints;
  const squeezeFactor = coreSqueezeAt(throttle);
  const turbineExtractPct = turbineExtractShare(bypass);
  const burnerGlow = +(0.2 + 0.8 * (throttle / MAX_THROTTLE_PCT)).toFixed(2);
  const fanSpeed = +(0.35 + 0.65 * (throttle / MAX_THROTTLE_PCT)).toFixed(2);
  const bypassTier = bypassTierOf(bypass);

  const highBypass = bypass >= 6;
  const lowBypass = bypass <= 2;
  const badge = highBypass
    ? "Cool fan push"
    : lowBypass
      ? "Hot jet blast"
      : "Balanced mix";
  const tone = highBypass ? "good" : lowBypass ? "hot" : "neutral";
  const quietLabel = highBypass
    ? "Quieter & uses far less fuel"
    : lowBypass
      ? "Louder & burns fuel fast"
      : "Moderate noise & fuel use";

  const partsWord = bypass === 1 ? "1 part" : `${bypass} parts`;
  const hudRows = [
    `Air split: ${partsWord} bypass to 1 core (${bypassAirPct}% bypass)`,
    `Push split: ${fanPushPct}% cool fan, ${corePushPct}% hot core`,
    `Core squeeze: ${squeezeFactor}x tighter at ${throttle}% throttle`,
  ];

  return {
    throttlePct: throttle,
    bypassRatio: bypass,
    totalAirParts,
    bypassAirPct,
    fanPushPct,
    corePushPct,
    fanPushPoints,
    corePushPoints,
    squeezeFactor,
    turbineExtractPct,
    burnerGlow,
    fanSpeed,
    bypassTier,
    highBypass,
    lowBypass,
    ok: highBypass,
    badge,
    tone,
    quietLabel,
    hudRows,
    specName: spec?.name ?? BASE,
  };
}

/** Build the complete model and 6 narrative step states (steps 1..6) for one What-if variant. */
export function buildModel(spec) {
  const bypass = spec.bypassRatio;
  const fanPct = fanPushShare(bypass);
  const corePct = corePushShare(bypass);
  const bypassAirPct = bypassAirShare(bypass);
  const turbineExtractPct = turbineExtractShare(bypass);
  const totalAirParts = bypass + 1;
  const cruiseSim = simulateEngine(spec, spec.cruiseThrottlePct, bypass);
  const fullSim = simulateEngine(spec, MAX_THROTTLE_PCT, bypass);
  const airlinerFanPct = fanPushShare(AIRLINER_BYPASS);
  const airlinerCorePct = corePushShare(AIRLINER_BYPASS);
  const fighterFanPct = fanPushShare(FIGHTER_BYPASS);
  const fighterCorePct = corePushShare(FIGHTER_BYPASS);
  const maxBypassFanPct = fanPushShare(MAX_BYPASS);
  const maxBypassCorePct = corePushShare(MAX_BYPASS);
  const airlinerTurbinePct = turbineExtractShare(AIRLINER_BYPASS);
  const fighterTurbinePct = turbineExtractShare(FIGHTER_BYPASS);
  const maxBypassTurbinePct = turbineExtractShare(MAX_BYPASS);

  const bypassPartsWord = bypass === 1 ? "1 part" : `${bypass} parts`;
  const isHighBypass = bypass >= 4;

  // Step 0 (Overview): live open cutaway reflecting the active What-if variant (hides push split before Predict!)
  const concept = {
    step: 0,
    id: "overview",
    ...cruiseSim,
    hidePushSplit: true,
    cardTitle: isHighBypass ? "Airliner turbofan" : "Fighter turbofan",
    badge: isHighBypass ? `${bypass}:1 bypass` : `${bypass}:1 low bypass`,
    tone: isHighBypass ? "good" : "hot",
    hudRows: [
      `Air split: ${bypassPartsWord} bypass to 1 part core`,
      `Two streams: Cool outer duct & fiery core`,
      `Feel: ${spec.exhaustWord} — ${spec.fuelWord.toLowerCase()}`,
    ],
  };

  // Steps 1..6: the causal sequence from intake fan to throttle & design trade-off
  const steps = [
    // Step 1: Giant fan — pulls in air and splits it into two paths (push split hidden until Step 3!)
    {
      step: 1,
      id: "giant-fan",
      ...cruiseSim,
      hidePushSplit: true,
      cardTitle: "Giant front fan",
      badge: `${bypass}:1 split`,
      tone: "hot",
      hudRows: [
        `Intake: Splits incoming air into 2 paths`,
        `Bypass duct: ${bypassPartsWord} ${bypass === 1 ? "sweeps" : "sweep"} around core`,
        `Inner core: 1 part enters the metal center`,
      ],
    },
    // Step 2 (PRED_STEP = 2): Bypass vs core — ask where most forward push comes from (no spoiler!)
    {
      step: 2,
      id: "bypass-vs-core",
      ...cruiseSim,
      hidePushSplit: true,
      cardTitle: "Two air streams",
      badge: "Predict",
      tone: "neutral",
      hudRows: [
        `Outer path: ${bypassPartsWord} cool, gentle bypass air`,
        `Inner path: 1 part blazing hot core exhaust`,
        `Question: Which stream gives most push?`,
      ],
    },
    // Step 3: Cool push / Core jet dominates — REVEALS the push split!
    {
      step: 3,
      id: "cool-push",
      ...cruiseSim,
      hidePushSplit: false,
      cardTitle: isHighBypass ? "Cool bypass wins" : "Core jet dominates",
      badge: isHighBypass ? `${fanPct}% fan push` : `${corePct}% core jet`,
      tone: isHighBypass ? "good" : "hot",
      hudRows: [
        `Cool bypass stream: ${fanPct}% of forward push`,
        `Hot core jet: ${corePct}% of forward push`,
        isHighBypass
          ? "Why: Gentle wide air uses far less fuel"
          : "Why: Compact fast jet favors raw speed",
      ],
    },
    // Step 4: Squeeze & burn — 1 part core air squeezed 30x tighter, mixed with fuel, burned steadily
    {
      step: 4,
      id: "squeeze-and-burn",
      ...fullSim,
      cardTitle: "Squeeze and burn",
      badge: `${CORE_SQUEEZE_FULL}x squeeze`,
      tone: "hot",
      hudRows: [
        `Compressor: Squeezes core air ${CORE_SQUEEZE_FULL}x tighter`,
        `Burner: Fuel sprays and burns continuously`,
        `Result: Expanding hot gas blasts rearward`,
      ],
    },
    // Step 5: Turbine shaft — rear turbine captures bypass-dependent % of core power to drive the fan
    {
      step: 5,
      id: "turbine-shaft",
      ...fullSim,
      cardTitle: "Turbine and shaft",
      badge: `${turbineExtractPct}% to shaft`,
      tone: "good",
      hudRows: [
        `Rear turbine: Spun by rushing hot gas`,
        `Center shaft: Sends ${turbineExtractPct}% of core power forward`,
        isHighBypass
          ? "Loop: Powers compressor and giant front fan"
          : "Loop: Leaves more hot energy for rear blast",
      ],
    },
    // Step 6: Throttle & design — compare high-bypass airliner (8:1) vs low-bypass fighter (1:1)
    {
      step: 6,
      id: "throttle-and-design",
      ...cruiseSim,
      cardTitle: "Airliner vs fighter",
      badge: isHighBypass ? "8:1 quiet" : "1:1 fast",
      tone: isHighBypass ? "good" : "hot",
      hudRows: [
        `Airliner 8:1: ${airlinerFanPct}% cool fan push, far less fuel`,
        `Fighter 1:1: ${fighterCorePct}% hot jet push, high speed`,
        `Trade-off: Quiet efficiency vs raw jet blast`,
      ],
    },
  ];

  return {
    ...spec,
    coreSqueezeFull: CORE_SQUEEZE_FULL,
    turbineExtractPct,
    airlinerTurbinePct,
    fighterTurbinePct,
    maxBypassTurbinePct,
    minThrottlePct: MIN_THROTTLE_PCT,
    maxThrottlePct: MAX_THROTTLE_PCT,
    defaultThrottlePct: DEFAULT_THROTTLE_PCT,
    minBypass: MIN_BYPASS,
    maxBypass: MAX_BYPASS,
    airlinerBypass: AIRLINER_BYPASS,
    fighterBypass: FIGHTER_BYPASS,
    airlinerFanPct,
    airlinerCorePct,
    fighterFanPct,
    fighterCorePct,
    maxBypassFanPct,
    maxBypassCorePct,
    fanPushPct: fanPct,
    corePushPct: corePct,
    bypassAirPct,
    totalAirParts,
    oneCorePart: 1,
    twoPaths: 2,
    concept,
    steps,
  };
}

export const MODELS = Object.fromEntries(
  Object.entries(VARIANTS).map(([k, spec]) => [k, buildModel(spec)]),
);
