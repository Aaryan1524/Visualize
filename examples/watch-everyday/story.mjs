// How an Automatic Watch Works (Everyday Edition): steps, shots, plain-English headings,
// captions, spoken narration script, prediction, claims, topic coverage, and Now you try.
//
// Plain college-level everyday English — ZERO PhD horological jargon!

import {
  BASE,
  FULL_RESERVE_HOURS,
  HOURS_PER_TURN,
  MAX_SPRING_TURNS,
  MODELS,
  SWINGS_TO_FULL,
  TICKS_PER_SEC,
  WIND_GAIN_PER_HOUR_WORN,
  DRAIN_PER_HOUR_STILL,
  simulateWatch,
  springTurns,
} from "./model.mjs";

// Step 0 is the full 3-layer exhibition cutaway overview (no tab).
// Steps 1..6 frame each causal organ in turn with clean camera shots.
export const STEPS = [
  { tab: null, focus: null },
  { tab: "Wrist motion", focus: null, shot: ["rotor", "barrel"], subject: ["rotor"] },
  { tab: "Wound spring", focus: null, shot: ["barrel", "center"], subject: ["barrel"] },
  { tab: "Ticking brake", focus: null, shot: ["balance", "pallet", "escape"], subject: ["balance", "pallet"] },
  { tab: "Gear train", focus: null, shot: ["center", "third", "fourth", "escape"], subject: ["center", "third", "fourth"] },
  { tab: "Watch hands", focus: null, shot: ["hands"], subject: ["hands"] },
  { tab: "Off the wrist", focus: null, shot: ["barrel", "balance"], subject: ["barrel", "balance"] },
];

/** Prediction asked on Step 2 (Wound spring) and revealed on Step 3 (Ticking brake). */
export const PRED_STEP = 2;

/** Plain-English step headings, one per step, driven by model numbers. */
export const headings = (M) => [
  "How flicking your wrist powers a mechanical watch with zero battery.",
  "Wrist motion: every arm move swings the heavy orange rotor.",
  `Wound spring: coiled tight to store up to ${M.fullReserveHours} hours of power.`,
  `Ticking brake: a rocking lever releases one tooth, ${M.ticksPerSec} ticks every second.`,
  "Gear train: meshed brass wheels step fast ticks into steady time.",
  "Watch hands: three stacked shafts sweep the hands above the dial.",
  `Off the wrist: after ${M.fullReserveHours} hours still, the spring uncoils and stops.`,
];

/** Detailed plain-English captions for the Details drawer, one per step. */
export const captions = (M) => [
  `An automatic mechanical watch keeps running with zero battery by turning everyday wrist movement into stored spring power. Wearing it on an active day adds +${M.windGainPerHourWorn} hours of power reserve per hour worn, while leaving it still drains ${M.drainPerHourStill} hour per hour. Here in "${M.label}", the watch ends the day at ${M.dayEndReserveHours} hours of reserve (${M.dayEndTurns} coiled turns out of ${M.maxSpringTurns}).`,
  `Every move of your arm swings the heavy orange half-moon rotor around its center pin. Because one side is weighted, gravity and wrist motion spin it freely as you walk, reach, or type — about ${M.swingsToFull} swings wind an empty watch all the way to full.`,
  `The swinging rotor coils a flat steel spring tight inside the brass barrel, storing up to ${M.fullReserveHours} hours of power across ${M.maxSpringTurns} full coiled turns (${M.hoursPerTurn} hours per turn). Once the spring reaches ${M.maxSpringTurns} turns, a tiny slipping clutch lets it glide safely so you can never overwind it.`,
  `Inside the movement, the oscillating balance wheel and tiny rocking pallet lever act like a steady brake — releasing just ${M.oneTooth} tooth at a time, ${M.ticksPerSec} gentle ticks every second. That rhythmic brake keeps the wound spring from unwinding in ${M.twoSeconds} seconds and stretches its stored energy across ${M.fullReserveHours} hours.`,
  `Meshed brass gears step those fast ticks down into smooth, steady speeds for the seconds, minutes, and hours. Reading inward from the fast escape wheel, each small steel pinion turns a much larger brass wheel on the next shaft so every stage turns slower and steadier than the one before it.`,
  `Concentric shafts at the very center of the watch carry those ${M.threeHands} speeds straight up through the dial to sweep the seconds, minute, and hour hands in crisp steps — ${M.ticksPerSec} tiny advances every second give a mechanical watch its signature smooth sweep.`,
  `Leave the watch sitting on a nightstand for ${M.fullReserveHours} hours and the coiled spring uncoils completely to ${M.zeroHours} hours until the balance wheel rests still. No battery died — simply pick the watch back up, move your wrist, and the weighted rotor winds the spring right back up.`,
];

/**
 * Spoken narration script, one string per step.
 * `[phrase|part]` lights the named 3D part in sync as Kokoro speaks.
 * Natural spoken English — zero symbols, zero academic jargon!
 */
export const script = (M) => [
  `How does a mechanical watch run all day and night with zero battery? Every time you move your wrist, a hidden weight coils a flat steel spring inside, and a tiny rhythmic brake meters up to forty-two hours of stored power out to the hands.`,
  `Start with everyday wrist motion. Every move of your arm swings the heavy [orange half-moon rotor|rotor] around its center pin. About eight hundred forty swings wind the watch from empty all the way to full.`,
  `As the rotor turns, it winds a flat blued spring tight inside the [brass mainspring barrel|barrel]. Fully coiled to seven tight turns, that single spring stores up to forty-two hours of power — six hours for every turn.`,
  `So what stops that coiled spring from dumping all its power in two seconds? The [oscillating balance wheel|balance] and tiny [rocking pallet lever|pallet] act like a steady brake, catching the [escape wheel|escape] and releasing just one tooth at a time — eight gentle ticks every second.`,
  `Those fast ticks feed inward through a [train of meshed brass gears|center third fourth]. Each small steel pinion turns a much larger brass wheel on the next shaft, stepping the speed down cleanly for seconds, minutes, and hours.`,
  `Three concentric shafts carry those three steady speeds right up through the open exhibition dial to sweep the [watch hands|hands]. Eight tiny steps each second give a mechanical watch its smooth gliding sweep.`,
  `Finally, take the watch off and leave it sitting still on a nightstand. It drains one hour of reserve for every hour it sits — after forty-two hours, the [coiled spring|barrel] unwinds completely and the [balance wheel|balance] rests still. No battery is dead; just pick it up and wear it again.`,
];

/** The prediction, asked on PRED_STEP (Step 2) and revealed on Step 3. */
export function prediction(M) {
  return {
    question: "That coiled spring pushes hard on the gears. What stops the whole watch from unwinding in two seconds?",
    choices: [
      "A tiny rocking brake that releases one tooth at a time",
      "Thick grease packed tightly around the brass gears",
      "The watch hands pushing back against the glass",
    ],
    answer: 0,
    explanation: `A swinging balance wheel and tiny rocking pallet lever act like a steady brake — releasing just ${M.oneTooth} tooth at a time, ${M.ticksPerSec} gentle ticks every second, so the wound spring lasts ${M.fullReserveHours} hours instead of ${M.twoSeconds} seconds.`,
  };
}

// ---------------------------------------------------------------- Claims & Coverage
// Every sentence in CLAIMS appears verbatim on the page and is verified on EVERY variant.
export const CLAIMS = [
  {
    text: "Every move of your arm swings the heavy orange half-moon rotor around its center pin",
    test: (M) => M.steps[0].rotorSwinging === true && M.swingsToFull === 840,
  },
  {
    text: "storing up to 42 hours of power across 7 full coiled turns",
    test: (M) => M.fullReserveHours === 42 && M.maxSpringTurns === 7 && M.maxSpringTurns * M.hoursPerTurn === 42,
  },
  {
    text: "releasing just 1 tooth at a time, 8 gentle ticks every second",
    test: (M) => M.oneTooth === 1 && M.ticksPerSec === 8 && M.steps[2].ticksPerSec === 8,
  },
  {
    text: "Meshed brass gears step those fast ticks down into smooth, steady speeds for the seconds, minutes, and hours",
    test: (M) => M.steps[3].running === true && M.threeHands === 3,
  },
  {
    text: "Wearing it on an active day adds +2 hours of power reserve per hour worn, while leaving it still drains 1 hour per hour",
    test: (M) => {
      const wearGain = simulateWatch(M, 4, 0, 10).reserveHours - 10;
      const stillLoss = 20 - simulateWatch(M, 0, 5, 20).reserveHours;
      return M.windGainPerHourWorn === 2 && M.drainPerHourStill === 1 && wearGain === 8 && stillLoss === 5;
    },
  },
  {
    text: "Leave the watch sitting on a nightstand for 42 hours and the coiled spring uncoils completely to 0 hours until the balance wheel rests still",
    test: (M) => {
      const out = simulateWatch(M, 0, 42, 42);
      return out.reserveHours === 0 && out.running === false && out.ticksPerSec === 0 && M.steps[5].reserveHours === 0;
    },
  },
  {
    text: "Once the spring reaches 7 turns, a tiny slipping clutch lets it glide safely so you can never overwind it",
    test: (M) => {
      const over = simulateWatch(M, 12, 0, 30);
      return over.reserveHours === M.fullReserveHours && over.clippedByClutch === true;
    },
  },
];

export const COVERAGE = {
  source: "Wikipedia, Automatic watch & Mechanical watch (self-winding rotor, mainspring barrel, escapement, balance wheel, going train, power reserve)",
  topics: [
    { topic: "how wrist movement powers a mechanical watch with zero battery", where: "step:0" },
    { topic: "weighted half-moon rotor swinging around its center pin from everyday arm motion", where: "step:1" },
    { topic: "mainspring coiling tight inside the brass barrel to store 42 hours across 7 turns, with slipping clutch protection", where: "step:2" },
    { topic: "oscillating balance wheel and rocking pallet lever braking the gear train to 8 ticks per second", where: "step:3" },
    { topic: "meshed brass gear train stepping fast ticks down into seconds, minutes, and hours", where: "step:4" },
    { topic: "concentric center shafts sweeping the three hands across the exhibition dial", where: "step:5" },
    { topic: "nightstand wind-down draining 1 hour per hour still until the watch stops cleanly at 0 hours", where: "step:6" },
    { topic: "active day wear (+2 h/h) vs sitting still on a nightstand (-1 h/h)", where: "whatif" },
    { topic: "interactive wear hours and nightstand hours power-reserve lab", where: "lab" },
    { topic: "predicting reserve hours, spring turns, and nightstand stop time", where: "practice" },
    { topic: "temperature-compensated alloy hairsprings and manual crown hand-setting gears", core: false, where: "deferred", why: "noted in Details; the main steps keep focus on the core self-winding and timekeeping loop" },
  ],
};

// ---------------------------------------------------------------- Now you try
/**
 * Generate 3 distinct plain-English question types (seed % 3) directly from model.mjs,
 * showing an unspoiled pre-outcome visual state (`practice: true`).
 *   0 — coiled turns to power-reserve hours (6 hours per turn)
 *   1 — active wear + nightstand balance (starting from 18 h, +2 h/h worn, -1 h/h still)
 *   2 — leaving a watch on a nightstand: still running or stopped?
 */
export function practice(seed, rand, spec = MODELS[BASE]) {
  const kind = seed % 3;

  if (kind === 0) {
    const turnsList = [2, 3, 5, 6];
    const t = turnsList[Math.floor(rand() * turnsList.length)];
    const hrs = t * HOURS_PER_TURN;
    const wrong1 = Math.max(4, hrs - HOURS_PER_TURN * 2);
    const wrong2 = Math.min(FULL_RESERVE_HOURS + 12, hrs + HOURS_PER_TURN * 2);
    return {
      q: `The mainspring inside the brass barrel is wound to ${t} full turns. At ${HOURS_PER_TURN} hours per turn, how many hours of power reserve are stored?`,
      choices: [`${hrs} hours`, `${wrong1} hours`, `${wrong2} hours`],
      explain: `Each coiled turn stores ${HOURS_PER_TURN} hours of running time, so ${t} turns store ${t} × ${HOURS_PER_TURN} = ${hrs} hours (out of ${FULL_RESERVE_HOURS} hours max).`,
      state: {
        reserveHours: hrs,
        running: true,
        ticksPerSec: TICKS_PER_SEC,
        rotorDeg: 135,
        cardTitle: `${t} coiled turns`,
        badge: "Your turn",
        tone: "neutral",
        rotorLabel: "Before checking the gauge",
        springLabel: `${t} of ${MAX_SPRING_TURNS} turns wound`,
        beatLabel: `${HOURS_PER_TURN} hours stored per turn`,
        hideReserve: true,
        practice: true,
      },
    };
  }

  if (kind === 1) {
    const scenarios = [
      { start: 18, worn: 6, still: 8 },  // 18 + 12 - 8 = 22 h
      { start: 18, worn: 10, still: 10 }, // 18 + 20 - 10 = 28 h
      { start: 24, worn: 12, still: 12 }, // 24 + 24 = 48 -> capped at 42 by slipping clutch -> 42 - 12 = 30 h
      { start: 18, worn: 4, still: 14 },  // 18 + 8 - 14 = 12 h
    ];
    const sc = scenarios[Math.floor(rand() * scenarios.length)];
    const res = simulateWatch(spec, sc.worn, sc.still, sc.start);
    const wrong1 = Math.max(0, res.reserveHours - 6);
    const wrong2 = Math.min(FULL_RESERVE_HOURS, res.reserveHours + 8);
    return {
      q: `Your watch starts the morning at ${sc.start} hours. You wear it for ${sc.worn} hours (+${WIND_GAIN_PER_HOUR_WORN} h each, capped at ${FULL_RESERVE_HOURS} h), then leave it on a nightstand for ${sc.still} hours (-${DRAIN_PER_HOUR_STILL} h each). What is the reserve left?`,
      choices: [`${res.reserveHours} hours`, `${wrong1} hours`, `${wrong2} hours`],
      explain: `Wearing it for ${sc.worn} hours brings the spring to ${res.afterWearHours} hours${res.clippedByClutch ? " (capped at 42 h by the slipping clutch)" : ""}. Sitting still for ${sc.still} hours drains ${sc.still} hours, leaving ${res.reserveHours} hours.`,
      state: {
        reserveHours: sc.start,
        running: true,
        ticksPerSec: TICKS_PER_SEC,
        rotorDeg: 152,
        cardTitle: `Starts at ${sc.start} hours`,
        badge: "Your turn",
        tone: "neutral",
        rotorLabel: `Wear ${sc.worn} h, then rest ${sc.still} h`,
        springLabel: `${springTurns(sc.start)} turns at start`,
        beatLabel: "Calculate reserve left",
        hideReserve: true,
        practice: true,
      },
    };
  }

  const cases = [
    { start: 42, still: 48, stopped: true },
    { start: 24, still: 30, stopped: true },
    { start: 42, still: 24, stopped: false },
    { start: 30, still: 12, stopped: false },
  ];
  const c = cases[Math.floor(rand() * cases.length)];
  const res = simulateWatch(spec, 0, c.still, c.start);
  const right = c.stopped
    ? "Stopped cleanly at 0 hours — pick it up to wind it back up"
    : `Still ticking with ${res.reserveHours} hours left in the spring`;
  const other = c.stopped
    ? "Still ticking with half the spring wound"
    : "Stopped cleanly at 0 hours because the battery died";
  const third = "Ticking twice as fast to catch up";
  return {
    q: `You set down a watch with ${c.start} hours of power reserve and leave it untouched on your nightstand for ${c.still} hours. What do you find when you pick it up?`,
    choices: [right, other, third],
    explain: c.stopped
      ? `Sitting still drains ${DRAIN_PER_HOUR_STILL} hour per hour, so ${c.still} hours completely unwinds ${c.start} hours of reserve to 0 hours. No battery died — wrist motion winds it right back up.`
      : `Sitting still drains ${c.still} hours from ${c.start} hours, leaving ${res.reserveHours} hours stored in the spring — so the balance wheel is still ticking smoothly at ${TICKS_PER_SEC} ticks per second.`,
    state: {
      reserveHours: c.start,
      running: true,
      ticksPerSec: TICKS_PER_SEC,
      rotorDeg: 180,
      cardTitle: `Set down at ${c.start} h`,
      badge: "Your turn",
      tone: "neutral",
      rotorLabel: `Untouched for ${c.still} hours`,
      springLabel: `${springTurns(c.start)} turns before rest`,
      beatLabel: "Will it still be ticking?",
      hideReserve: true,
      practice: true,
    },
  };
}
