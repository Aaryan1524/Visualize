// How an Automatic Watch Works (Everyday Edition): executable physical model.
// Pure JS, zero imports — inlined directly into the built HTML page.
//
// Physically grounded everyday horology:
//   - 42-hour full power reserve from a coiled flat mainspring
//   - 7 full coiled spring turns = 6 hours of running time per turn
//   - 840 full rotor swings to wind from empty to full (20 swings per hour of reserve)
//   - 8 gentle ticks per second (480 ticks per minute) set by the oscillating balance wheel
//   - Active wear adds +2 net hours of reserve per hour worn (capped at 42 hours by slipping clutch)
//   - Sitting still on a nightstand drains 1 hour of reserve per hour still, stopping cleanly at 0 hours
//
// Two What-if variants compare an Active day (wearing the watch — reserve climbs) against
// On nightstand (sitting still — reserve drains).

export const BASE = "active";

export const FULL_RESERVE_HOURS = 42;
export const MAX_SPRING_TURNS = 7;
export const HOURS_PER_TURN = 6;
export const SWINGS_TO_FULL = 840;
export const SWINGS_PER_HOUR = 20;
export const TICKS_PER_SEC = 8;
export const TICKS_PER_MIN = 480;
export const WIND_GAIN_PER_HOUR_WORN = 2;
export const DRAIN_PER_HOUR_STILL = 1;
export const LOW_RESERVE_HOURS = 6;
export const LAB_START_RESERVE_HOURS = 18;
export const MAX_LAB_WORN_HOURS = 16;
export const MAX_LAB_NIGHTSTAND_HOURS = 48;

export const VARIANTS = {
  active: {
    name: "active",
    label: "Active day",
    startReserveHours: 18,
    hoursWornDay: 14,
    hoursStillDay: 10,
    rotorSwingsPerHour: 60,
    rotorActive: true,
    trendWord: "Climbing",
  },
  nightstand: {
    name: "nightstand",
    label: "On nightstand",
    startReserveHours: 36,
    hoursWornDay: 0,
    hoursStillDay: 24,
    rotorSwingsPerHour: 0,
    rotorActive: false,
    trendWord: "Draining",
  },
};

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Power reserve percentage (0..100) for a given reserve in hours. */
export function reservePct(hours, full = FULL_RESERVE_HOURS) {
  return Math.round((clampNum(hours, 0, full) / full) * 100);
}

/** Coiled spring turns remaining (0..7), at 6 hours per turn. */
export function springTurns(hours, hoursPerTurn = HOURS_PER_TURN, maxTurns = MAX_SPRING_TURNS) {
  const h = clampNum(hours, 0, maxTurns * hoursPerTurn);
  return +(h / hoursPerTurn).toFixed(1);
}

/** Rotor swings needed to store `hours` of power reserve (20 swings per hour). */
export function swingsForHours(hours, swingsPerHour = SWINGS_PER_HOUR, full = FULL_RESERVE_HOURS) {
  return Math.round(clampNum(hours, 0, full) * swingsPerHour);
}

/**
 * Compute watch reserve & mechanism state after starting at `startHours`, wearing the watch
 * for `hoursWorn` hours (+2 net hours per hour worn, capped at 42 h), then leaving it still
 * on a nightstand for `hoursNightstand` hours (-1 hour per hour still, floored at 0 h).
 */
export function simulateWatch(spec, hoursWorn, hoursNightstand, startHours = LAB_START_RESERVE_HOURS) {
  const full = spec.fullReserveHours ?? FULL_RESERVE_HOURS;
  const gain = spec.windGainPerHourWorn ?? WIND_GAIN_PER_HOUR_WORN;
  const drain = spec.drainPerHourStill ?? DRAIN_PER_HOUR_STILL;
  const lowCut = spec.lowReserveHours ?? LOW_RESERVE_HOURS;
  const worn = clampNum(Math.round(hoursWorn), 0, MAX_LAB_WORN_HOURS);
  const still = clampNum(Math.round(hoursNightstand), 0, MAX_LAB_NIGHTSTAND_HOURS);
  const rawAfterWear = startHours + worn * gain;
  const clippedByClutch = rawAfterWear > full;
  const afterWearHours = clampNum(rawAfterWear, 0, full);
  const reserveHours = Math.max(0, Math.round(afterWearHours - still * drain));
  const pct = reservePct(reserveHours, full);
  const turns = springTurns(reserveHours);
  const running = reserveHours > 0;
  const low = running && reserveHours < lowCut;
  const ticksPerSec = running ? TICKS_PER_SEC : 0;
  const ok = running && !low;
  const tone = !running ? "bad" : low ? "hot" : "good";
  const badge = !running
    ? "Stopped"
    : low
      ? "Running low"
      : reserveHours >= full
        ? "Fully wound"
        : "Running strong";

  const springLabel = !running
    ? "Fully uncoiled (0 turns)"
    : reserveHours >= full
      ? `Coiled tight (${turns} of ${MAX_SPRING_TURNS} turns)`
      : `${turns} of ${MAX_SPRING_TURNS} turns wound`;

  const rotorLabel = worn > 0
    ? clippedByClutch
      ? `Wound full (+${worn * gain} h, clutch slips)`
      : `Added +${worn * gain} h across ${worn} h worn`
    : "Still on nightstand";

  const beatLabel = running
    ? `Steady ${ticksPerSec} ticks every second`
    : "Still (0 ticks every second)";

  return {
    startHours,
    hoursWorn: worn,
    hoursNightstand: still,
    afterWearHours,
    clippedByClutch,
    reserveHours,
    pct,
    turns,
    running,
    low,
    ticksPerSec,
    ok,
    tone,
    badge,
    springLabel,
    rotorLabel,
    beatLabel,
    swingsAdded: swingsForHours(Math.max(0, afterWearHours - startHours)),
  };
}

/**
 * Smooth escapement kinematics for visual playback:
 * Each beat advances the 15-tooth escape wheel by 12 degrees (one half-tooth step),
 * rocks the ruby-jeweled pallet fork +/- 6.5 degrees, and swings the balance wheel
 * sinusoidally while breathing the hairspring in sync.
 */
export function escapementAt(beatTime, running = true) {
  if (!running) {
    return { balDeg: 0, forkDeg: 0, escDeg: 0, hairspringBreath: 1.0, beat: 0 };
  }
  // Visual beat cadence: 2.0 beats/sec on screen so the eye follows every tooth release clearly
  const rate = 2.0;
  const phase = beatTime * rate;
  const beatIdx = Math.floor(phase);
  const f = phase - beatIdx;
  const dir = beatIdx % 2 === 0 ? 1 : -1;
  // Harmonic balance swing (+/- 145 deg visual sweep)
  const balDeg = -dir * 145 * Math.cos(Math.PI * f);
  // Smooth step transition of pallet fork (+/- 6.5 deg) & escape wheel (12 deg per beat) near mid-swing
  const u = clampNum((f - 0.36) / 0.28, 0, 1);
  const s = u * u * (3 - 2 * u);
  const forkDeg = dir * (-6.5 + 13.0 * s);
  const escDeg = (beatIdx + s) * 12;
  const hairspringBreath = 1.0 + 0.11 * Math.sin(Math.PI * f) * dir;
  return { balDeg, forkDeg, escDeg, hairspringBreath, beat: beatIdx };
}

/** Build the complete model and 6 narrative step states (steps 1..6) for one What-if variant. */
export function buildModel(spec) {
  const full = FULL_RESERVE_HOURS;
  const afterDayWear = Math.min(full, spec.startReserveHours + spec.hoursWornDay * WIND_GAIN_PER_HOUR_WORN);
  const dayEndReserveHours = Math.max(0, afterDayWear - spec.hoursStillDay * DRAIN_PER_HOUR_STILL);
  const netChangeHours = dayEndReserveHours - spec.startReserveHours;
  const dayEndPct = reservePct(dayEndReserveHours, full);
  const dayEndTurns = springTurns(dayEndReserveHours);

  // Step 0 (Overview): live 3-layer exhibition cutaway reflecting the active What-if variant
  const concept = {
    step: 0,
    id: "overview",
    reserveHours: dayEndReserveHours,
    pct: dayEndPct,
    turns: dayEndTurns,
    running: dayEndReserveHours > 0,
    ticksPerSec: dayEndReserveHours > 0 ? TICKS_PER_SEC : 0,
    rotorSwinging: spec.rotorActive,
    cardTitle: spec.rotorActive ? "Active wrist power" : "Resting on nightstand",
    badge: spec.trendWord,
    tone: spec.rotorActive ? "good" : "hot",
    hudRows: [
      `Rotor: ${spec.rotorActive ? `Adds +${WIND_GAIN_PER_HOUR_WORN} h per hour worn` : "Still (no wrist swings)"}`,
      `Spring: ${dayEndTurns} of ${MAX_SPRING_TURNS} coiled turns`,
      `Beat: ${TICKS_PER_SEC} gentle ticks every second`,
    ],
  };

  // Steps 1..6: the causal sequence from wrist motion to nightstand wind-down
  const steps = [
    // Step 1: Wrist motion — heavy orange half-moon rotor swings around its center pin
    {
      step: 1,
      id: "wrist-motion",
      reserveHours: 24,
      pct: reservePct(24, full),
      turns: springTurns(24),
      running: true,
      ticksPerSec: TICKS_PER_SEC,
      rotorSwinging: true,
      cardTitle: "Wrist motion",
      badge: "Winding",
      tone: "hot",
      hudRows: [
        "Rotor: Heavy orange half-moon weight",
        `Full wind: About ${SWINGS_TO_FULL} wrist swings`,
        `Reserve: Adds +${WIND_GAIN_PER_HOUR_WORN} h per hour worn`,
      ],
    },
    // Step 2 (PRED_STEP = 2): Wound spring — coiled tight inside brass barrel, 42 hours stored
    {
      step: 2,
      id: "wound-spring",
      reserveHours: full,
      pct: 100,
      turns: MAX_SPRING_TURNS,
      running: true,
      ticksPerSec: TICKS_PER_SEC,
      rotorSwinging: false,
      cardTitle: "Wound spring",
      badge: "Fully wound",
      tone: "good",
      hudRows: [
        "Barrel: Flat blued spring coiled tight",
        `Turns: ${MAX_SPRING_TURNS} full turns (${HOURS_PER_TURN} h each)`,
        "Safety: Slipping clutch stops overwind",
      ],
    },
    // Step 3: Ticking brake — balance wheel & rocking pallet lever release 1 tooth at a time
    {
      step: 3,
      id: "ticking-brake",
      reserveHours: 36,
      pct: reservePct(36, full),
      turns: springTurns(36),
      running: true,
      ticksPerSec: TICKS_PER_SEC,
      rotorSwinging: false,
      cardTitle: "Ticking brake",
      badge: "Controlled",
      tone: "good",
      hudRows: [
        "Brake: Balance wheel & rocking lever",
        `Release: ${1} tooth step per tick`,
        `Beat: ${TICKS_PER_SEC} gentle ticks every second`,
      ],
    },
    // Step 4: Gear train — meshed brass gears step fast ticks into seconds, minutes, hours
    {
      step: 4,
      id: "gear-train",
      reserveHours: 30,
      pct: reservePct(30, full),
      turns: springTurns(30),
      running: true,
      ticksPerSec: TICKS_PER_SEC,
      rotorSwinging: false,
      cardTitle: "Gear train",
      badge: "Stepping down",
      tone: "good",
      hudRows: [
        "Train: 4 meshed brass wheel stages",
        "Pinions: Small pinions drive larger wheels",
        "Output: Seconds, minutes, and hours",
      ],
    },
    // Step 5: Watch hands — concentric shafts carry three speeds to the exhibition dial
    {
      step: 5,
      id: "watch-hands",
      reserveHours: 24,
      pct: reservePct(24, full),
      turns: springTurns(24),
      running: true,
      ticksPerSec: TICKS_PER_SEC,
      rotorSwinging: false,
      cardTitle: "Watch hands",
      badge: "Keeping time",
      tone: "good",
      hudRows: [
        "Center: 3 nested hand shafts",
        "Dial: Open cutaway frames the hands",
        `Sweep: ${TICKS_PER_SEC} smooth steps every second`,
      ],
    },
    // Step 6: Off the wrist — 42 hours on a nightstand drains reserve to 0 until balance rests still
    {
      step: 6,
      id: "off-wrist",
      reserveHours: 0,
      pct: 0,
      turns: 0,
      running: false,
      ticksPerSec: 0,
      rotorSwinging: false,
      cardTitle: "Off the wrist",
      badge: "Stopped",
      tone: "bad",
      hudRows: [
        `Nightstand: Drains ${DRAIN_PER_HOUR_STILL} h per hour still`,
        "Spring: Fully uncoiled (0 turns)",
        "Beat: Resting still — pick up to wind",
      ],
    },
  ];

  return {
    ...spec,
    fullReserveHours: full,
    maxSpringTurns: MAX_SPRING_TURNS,
    hoursPerTurn: HOURS_PER_TURN,
    swingsToFull: SWINGS_TO_FULL,
    swingsPerHour: SWINGS_PER_HOUR,
    ticksPerSec: TICKS_PER_SEC,
    ticksPerMin: TICKS_PER_MIN,
    windGainPerHourWorn: WIND_GAIN_PER_HOUR_WORN,
    drainPerHourStill: DRAIN_PER_HOUR_STILL,
    lowReserveHours: LOW_RESERVE_HOURS,
    labStartReserveHours: LAB_START_RESERVE_HOURS,
    maxLabWornHours: MAX_LAB_WORN_HOURS,
    maxLabNightstandHours: MAX_LAB_NIGHTSTAND_HOURS,
    afterDayWear,
    dayEndReserveHours,
    netChangeHours,
    dayEndPct,
    dayEndTurns,
    zeroHours: 0,
    twoSeconds: 2,
    threeHands: 3,
    oneTooth: 1,
    concept,
    steps,
  };
}

export const MODELS = Object.fromEntries(
  Object.entries(VARIANTS).map(([k, spec]) => [k, buildModel(spec)]),
);
