// Automatic mechanical watch story: 14-step (0..13) --deep 4-chapter tour,
// per-step camera shots, variant-aware headings/captions/voice/predictions,
// audited CLAIMS and horological COVERAGE.

import { MODELS, WATCH, barrelAt, escapementAt, regulatorAt, windingRate } from "./model.mjs";

const NB = "\u00a0"; // non-breaking space for ratios like 5,760 : 1
export const fmt = (n) => n.toLocaleString("en-US");
export const ratio = (a, b = 1) => `${typeof a === "number" ? fmt(a) : a}${NB}:${NB}${b}`;

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function words(n) {
  n = Math.round(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + words(n % 100) : "");
  return words(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? (n % 1000 < 100 ? " and " : " ") + words(n % 1000) : "");
}

// 14 steps (0 = concept, 1-3 = Winding, 4-6 = Power, 7-9 = Going train, 10-13 = Timekeeping)
export const STEPS = [
  { tab: null, chapter: null, shot: null, focus: null },
  { tab: "Exploded calibre", chapter: "Winding", shot: null, focus: null },
  { tab: "Oscillating rotor", chapter: "Winding", shot: ["rotor"], around: ["reversing"], subject: ["rotor"], focus: ["rotor", "reversing"] },
  { tab: "Reversing wheels", chapter: "Winding", shot: ["reversing"], subject: ["reversing"], focus: ["reversing", "rotor", "barrel"] },
  { tab: "Mainspring storage", chapter: "Power", shot: ["barrel"], around: ["reversing"], subject: ["barrel"], focus: ["barrel", "reversing", "barrelBridge"] },
  { tab: "Slipping bridle", chapter: "Power", shot: ["barrel", "bridle"], subject: ["bridle", "barrel"], focus: ["bridle", "barrel"] },
  { tab: "Torque plateau", chapter: "Power", shot: ["barrel", "balance"], subject: ["barrel", "balance"], focus: ["barrel", "balance", "bridle"] },
  { tab: "Barrel to center", chapter: "Going train", shot: ["barrel", "center"], subject: ["barrel", "center"], focus: ["barrel", "center", "trainBridge"] },
  { tab: "Minute to second", chapter: "Going train", shot: ["center", "third", "fourth"], subject: ["center", "third", "fourth"], focus: ["center", "third", "fourth", "trainBridge"] },
  { tab: "High-speed stage", chapter: "Going train", shot: ["fourth", "escapePin", "escape"], subject: ["fourth", "escape"], focus: ["fourth", "escapePin", "escape", "escCock"] },
  { tab: "Lock & unlock", chapter: "Timekeeping", shot: ["escape", "fork"], around: ["roller"], subject: ["escape", "fork"], focus: ["escape", "fork", "roller", "escCock"] },
  { tab: "Impulse & drop", chapter: "Timekeeping", shot: ["escape", "fork", "roller"], subject: ["escape", "fork", "roller"], focus: ["escape", "fork", "roller", "balance"] },
  { tab: "Harmonic balance", chapter: "Timekeeping", shot: ["balance", "roller"], around: ["fork"], subject: ["balance"], focus: ["balance", "roller", "balanceCock"] },
  { tab: "Micron regulator", chapter: "Timekeeping", shot: ["regulator", "balance"], around: ["balanceCock"], subject: ["regulator", "balance"], focus: ["regulator", "balance", "balanceCock"] },
];

export const PRED_STEPS = [4, 7, 12];

export function headings(M) {
  const N = M.N, D = M.D;
  return [
    `How does a watch run for ${N.reserveHours} hours with no battery?`,
    `Six stacked layers share one ${N.calibreMm} mm calibre on synthetic ruby bearings.`,
    `An off-axis weight swings the rotor whenever your wrist tilts.`,
    `Twin reversing wheels turn both swing directions into one-way winding.`,
    `Seven coiled turns inside the barrel store ${N.reserveHours} hours of torque.`,
    `At ${D.slipTorque} N·mm, a slipping bridle lets the outer coil slide safely.`,
    `A flat torque plateau holds balance amplitude near ${N.nominalAmp}° until almost empty.`,
    `The barrel turns once every ${N.hoursPerBarrelTurn} hours, driving the center wheel at ${ratio(N.barrelToCenter)}.`,
    `Center, third and fourth wheels multiply speed ${ratio(N.centerToFourth)} to the second hand.`,
    `Fourth to escape completes a ${ratio(N.totalRatio)} train from barrel to beat.`,
    `Lock and unlock: a ruby pallet stone holds the ${D.escapeTeeth}-tooth escape wheel.`,
    `Impulse and drop: each beat kicks the balance and advances the wheel ${N.toothStepDeg}°.`,
    `The balance wheel and breathing hairspring beat ${N.beatsPerSec} times a second (${N.hz} Hz).`,
    `Shifting the active hairspring by ${N.reg20Um} microns trims daily rate by ${N.regMaxRate} seconds.`,
  ];
}

export function captions(M) {
  const N = M.N, D = M.D;
  return [
    `An automatic mechanical watch carries no battery, yet converts random wrist motion into ${N.beatsPerSec} exact beats every second (${fmt(N.vph)} vph, ${fmt(N.beatsPerDay)} beats a day) and keeps running for ${N.reserveHours} hours off the wrist. Inside one ${N.calibreMm} mm calibre, an oscillating rotor winds a coiled alloy mainspring, four geared stages step speed up by ${ratio(N.totalRatio)}, and a Swiss lever escapement meters torque to a harmonic balance wheel.`,
    `Chapter 1 follows how wrist motion enters the movement. Six functional layers stack along shared vertical axes inside the cutaway steel case: the stepped mainplate with lower ruby bearings, the mainspring barrel and going train, the Swiss lever escapement and balance wheel, chamfered rhodium bridges with blued screws, the automatic winding train, and the weighted oscillating rotor on top.`,
    `The rotor's heavy outer rim puts its center of mass far off-axis, so gravity swings it on its central ball-bearing hub whenever your wrist moves. Because a wrist tilts both ways, the rotor swings both clockwise and counter-clockwise without ever reversing the stored spring.`,
    `Meshed between the rotor pinion and the barrel ratchet sit twin reversing click wheels. They engage on opposite directions of rotation so both clockwise and counter-clockwise swings wind the barrel in one direction only through a ${ratio(D.rotorRatio)} reduction, taking ${N.rotorRevsFull} rotor turns from empty to full wind.`,
    `Chapter 2 follows how energy is stored inside the ${D.barrelTeeth}-tooth mainspring barrel. Coiling the blued-steel ribbon stores ${D.barrelTurns} usable turns at ${N.hoursPerBarrelTurn} hours per turn, giving ${N.reserveHours} hours of power reserve before the watch stops.`,
    `Unlike a manual-wind watch with a fixed outer hook, an automatic mainspring ends in a friction slipping bridle pressed against the smooth inner barrel wall. Once torque hits ${D.slipTorque} N·mm at full wind (${N.reserveHours} hours reserve), the outer coil slides safely so continued wrist motion can never snap the spring.`,
    `As the mainspring unwinds, its flat torque plateau keeps balance semi-arc amplitude healthy up to ${N.nominalAmp}° (still ${N.midWind.ampDeg}° at ${N.midWind.windPct}% wind and ${N.midWind.torque} N·mm), falling below ${N.lowAmp}° only near empty (${N.lowWind.ampDeg}° at ${N.lowWind.windPct}% wind, down toward ${D.minTorque} N·mm). At ${N.deskWear.wristPct}% desk activity, the rotor adds ${N.deskWear.gainedHrsPerHr} h/h for a net +${N.deskWear.netHrsPerHr} h/h gain, whereas sedentary ${N.sedentaryWear.wristPct}% wear adds ${N.sedentaryWear.gainedHrsPerHr} h/h and drains net reserve.`,
    `Chapter 3 traces how four geared stages step barrel speed up to the escapement. First, the ${D.barrelTeeth}-tooth barrel drives the ${D.centerPinion}-leaf center pinion at ${ratio(N.barrelToCenter)}, pacing the barrel at 1 turn every ${N.hoursPerBarrelTurn} hours while the center wheel turns at 1 rev/hour to carry the minute hand. On the dial side, a separate ${ratio(D.motionWorks)} motion-works reduction steps the center wheel down to the hour hand.`,
    `From the center wheel, two stages multiply speed to the second hand: the ${D.centerTeeth}-tooth center wheel drives the ${D.thirdPinion}-leaf third pinion at ${ratio(N.centerToThird)}, and the ${D.thirdTeeth}-tooth third wheel drives the ${D.fourthPinion}-leaf fourth pinion at ${ratio(N.thirdToFourth)}. Together, ${N.centerToThird} × ${N.thirdToFourth} = ${ratio(N.centerToFourth)}, fixing the fourth wheel and its blued sweep second hand at 1 rev/min.`,
    `Finally, the ${M.v.fourthTeeth}-tooth fourth wheel drives the ${M.v.escapePinion}-leaf escape pinion at ${ratio(N.fourthToEscape)}, so the escape wheel turns ${N.escapeRevPerMin} rev/min — ${ratio(N.centerToEscape)} from the center wheel and ${ratio(N.totalRatio)} from the barrel. Multiplying speed divides torque by the same factor, delivering roughly ${N.escapeTorqueIdealMNmm} mN·mm of ideal torque to the escape wheel.`,
    `Chapter 4 slows down the Swiss lever escapement and balance that meter out time. Without an escapement, the mainspring would unwind in seconds. While the balance swings freely, a ruby locking stone on the steel pallet fork holds one of the ${D.escapeTeeth} angled club teeth stationary against a banking pin. As the balance swings back through center, its roller's ruby impulse jewel enters the fork notch and unlocks the stone.`,
    `Across the ${D.liftAngle}° lift angle (${N.halfLiftDeg}° either side of center), the escape wheel's angled club tooth slides across the ruby stone's impulse plane, swinging the fork between its ${D.forkBankDeg}° banking pins to kick the balance's impulse jewel. The tooth then drops off the stone and the next tooth locks on the opposite ruby — advancing the wheel exactly ${N.toothStepDeg}° per beat (${N.beatsPerRev} beats per revolution, one beat every ${N.beatMs} ms at ${N.hz} Hz).`,
    `The poised brass balance wheel with its rim weights and breathing blued-steel hairspring form a harmonic oscillator beating ${N.beatsPerSec} times a second (${N.hz} Hz, ${fmt(N.vph)} vph, ${fmt(N.beatsPerDay)} beats a day). Because restoring torque scales linearly with twist angle, oscillation period stays steady across the mainspring's flat torque plateau.`,
    `Daily accuracy is tuned at the balance cock by moving the orange regulator index pins along the ${D.hairspringMm} mm hairspring. Shortening the active spring by just ${N.reg20Um} microns makes the watch gain ${N.regMaxRate} seconds a day; lengthening it by ${N.reg20Um} microns slows it by ${N.regMaxRate} seconds a day.`,
  ];
}

// Spoken narration for voice.mjs: plain words only (zero abbreviations), with [phrase|part] camera links.
export function script(M) {
  const N = M.N, D = M.D;
  return [
    `An automatic watch has no battery, yet it turns random wrist shakes into ${words(N.beatsPerSec)} exact beats every second, ${words(N.vph)} beats an hour, and keeps running for ${words(N.reserveHours)} hours off the wrist.`,
    `Chapter one follows how wrist motion enters the watch. Six stacked layers share one ${N.calibreMm} millimetre plate on ruby bearings: [the oscillating rotor|rotor] and [reversing wheels|reversing] on top, chamfered bridges below, then [the escapement|escape] and [balance wheel|balance] above [the mainspring barrel|barrel] and going train.`,
    `Whenever your wrist tilts, gravity swings [the weighted semicircular rotor|rotor] on its central ball-bearing hub. Because a wrist moves in every direction, the rotor swings both clockwise and counter-clockwise.`,
    `Between the rotor pinion and barrel ratchet sit [twin reversing click wheels|reversing]. They catch opposite swing directions so every motion winds [the mainspring barrel|barrel] one way only through a ${words(D.rotorRatio)} to one reduction, taking ${words(N.rotorRevsFull)} rotor turns from empty to full.`,
    `Chapter two follows how energy is stored. Winding coils [the alloy mainspring|barrel] inside its ${words(D.barrelTeeth)}-tooth barrel. ${words(D.barrelTurns)} usable turns deliver ${words(N.hoursPerBarrelTurn)} hours each, storing ${words(N.reserveHours)} hours of power.`,
    `At full wind, [the slipping bridle|bridle] pressed against the smooth inner wall of [the barrel|barrel] lets the outer coil slide safely at ${D.slipTorque} newton millimetres, so continued wrist motion can never snap the spring.`,
    `As [the mainspring|barrel] unwinds, its flat torque plateau keeps [the balance wheel|balance] swinging near ${words(N.nominalAmp)} degrees until nearly empty, dropping below ${words(N.lowAmp)} degrees only near ${D.minTorque} newton millimetres. Normal desk wear adds ${N.deskWear.gainedHrsPerHr} hours of reserve each hour, while sedentary wear drains it.`,
    `Chapter three traces the four geared stages that multiply speed. First, [the mainspring barrel|barrel] drives [the center wheel|center] at ${words(N.barrelToCenter)} to one, pacing the barrel at one turn every ${words(N.hoursPerBarrelTurn)} hours while the center wheel turns once an hour for the minute hand.`,
    `Next, [the center wheel|center] drives [the third wheel|third] at ${words(N.centerToThird)} to one, and the third wheel drives [the fourth wheel|fourth] at ${N.thirdToFourth} to one. Together that is ${words(N.centerToFourth)} to one, turning the fourth wheel and its blued sweep second hand once every minute.`,
    `Finally, [the fourth wheel|fourth] drives [the escape pinion|escapePin] at ${words(N.fourthToEscape)} to one, turning [the escape wheel|escape] ${words(N.escapeRevPerMin)} turns a minute and completing a ${words(N.totalRatio)} to one train from barrel to beat.`,
    `Chapter four slows down the Swiss lever escapement that meters time. While the balance swings freely, a ruby stone on [the pallet fork|fork] locks [the ${words(D.escapeTeeth)}-tooth escape wheel|escape] still. As the balance returns, its [roller impulse jewel|roller] enters the fork notch and unlocks the stone.`,
    `Through the ${words(D.liftAngle)}-degree lift angle, an angled club tooth on [the escape wheel|escape] slides across the ruby stone, swinging [the pallet fork|fork] to kick [the balance roller|roller]. Then the next tooth drops and locks on the opposite stone, advancing ${words(N.toothStepDeg)} degrees every ${words(N.beatMs)} milliseconds.`,
    `[The poised balance wheel and breathing hairspring|balance] form a harmonic oscillator beating ${words(N.beatsPerSec)} times a second, or ${N.hz} hertz, for ${words(N.beatsPerDay)} beats every day.`,
    `Moving [the orange regulator index|regulator] along the ${words(D.hairspringMm)} millimetre hairspring on [the balance wheel|balance] tunes daily accuracy: shortening the active spring by ${words(N.reg20Um)} microns gains ${words(N.regMaxRate)} seconds a day, and lengthening it by ${words(N.reg20Um)} microns slows it by ${words(N.regMaxRate)} seconds a day.`,
  ];
}

// 3 predictions: one each in Chapters 2 (step 4 -> 5), 3 (step 7 -> 8), and 4 (step 12 -> 13).
export function predictions(M) {
  const N = M.N, D = M.D;
  return [
    {
      step: 4,
      question: `The mainspring hits 100% wound (${N.reserveHours} h) while your wrist keeps moving. Why doesn't the rotor snap the spring?`,
      choices: [
        `A slipping bridle slides safely at ${D.slipTorque} N·mm`,
        `A brake locks the rotor solid`,
        `The escapement speeds up to burn torque`,
      ],
      answer: 0,
      explanation: `An automatic mainspring is not hooked rigidly to the barrel wall. Its outer end is a slipping bridle calibrated to ${D.slipTorque} N·mm: once the spring reaches 100% wind (${N.reserveHours} hours reserve), extra rotor turns safely slide the outer coil without snapping the spring.`,
      locked: "Locked in. Press play to watch the slipping bridle take over.",
    },
    {
      step: 7,
      question: `The center wheel turns once an hour (minute hand). Two geared stages later — ${ratio(N.centerToThird)} then ${ratio(N.thirdToFourth)} — how fast does the fourth wheel turn?`,
      choices: [
        `${N.centerToFourth} times faster (1 rev/min, second hand)`,
        `${D.escapeTeeth} times faster`,
        `${D.motionWorks} times slower (hour hand)`,
      ],
      answer: 0,
      explanation: `Geared stages multiply: ${N.centerToThird} × ${N.thirdToFourth} = ${N.centerToFourth}, so the fourth wheel turns ${N.centerToFourth} times faster than the center wheel — once per minute for the sweep second hand.`,
      locked: "Locked in. Press play to follow the going train to the second hand.",
    },
    {
      step: 12,
      question: `Your watch is running ${N.regMaxRate} seconds fast every day. How should the regulator index change the ${D.hairspringMm} mm hairspring's active length?`,
      choices: [
        `Lengthen it by ${N.reg20Um} microns`,
        `Shorten it by ${N.reg20Um} microns`,
        `Wind the mainspring tighter`,
      ],
      answer: 0,
      explanation: `A longer hairspring is softer and oscillates slower; a shorter hairspring is stiffer and oscillates faster. Lengthening the ${D.hairspringMm} mm active spring by ${N.reg20Um} microns slows the watch by ${N.regMaxRate} seconds a day.`,
      locked: "Locked in. Press play to see the regulator index adjust the rate.",
    },
  ];
}

// Cause-and-effect claims verified word-for-word against the page text and every variant's model.
export const CLAIMS = [
  {
    text: "converts random wrist motion into 8 exact beats every second (28,800 vph, 691,200 beats a day) and keeps running for 42 hours off the wrist",
    test: () => MODELS.modern.N.beatsPerSec === 8 && MODELS.modern.N.vph === 28800 && MODELS.modern.N.beatsPerDay === 691200 && MODELS.modern.N.reserveHours === 42,
  },
  {
    text: "taking 840 rotor turns from empty to full wind",
    test: (m) => m.N.rotorRevsFull === 840 && m.D.barrelTurns * m.D.rotorRatio === 840,
  },
  {
    text: "stores 7 usable turns at 6 hours per turn, giving 42 hours of power reserve",
    test: (m) => m.D.barrelTurns === 7 && m.N.hoursPerBarrelTurn === 6 && m.N.reserveHours === 42,
  },
  {
    text: "Once torque hits 7.2 N·mm at full wind (42 hours reserve), the outer coil slides safely",
    test: () => barrelAt(100, true).torque === 7.2 && barrelAt(100, true).slipping === true && barrelAt(100, false).slipping === false,
  },
  {
    text: "At 40% desk activity, the rotor adds 2.4 h/h for a net +1.4 h/h gain, whereas sedentary 10% wear adds 0.6 h/h and drains net reserve",
    test: () => windingRate(40).gainedHrsPerHr === 2.4 && windingRate(40).netHrsPerHr === 1.4 && windingRate(10).gainedHrsPerHr === 0.6 && windingRate(10).netHrsPerHr < 0,
  },
  {
    text: "Together, 8 × 7.5 = 60\u00a0:\u00a01, fixing the fourth wheel and its blued sweep second hand at 1 rev/min",
    test: (m) => m.N.centerToThird === 8 && m.N.thirdToFourth === 7.5 && m.N.centerToFourth === 60,
  },
  {
    text: "5,760\u00a0:\u00a01 from the barrel",
    test: () => MODELS.modern.N.totalRatio === 5760,
  },
  {
    text: "advancing the wheel exactly 12° per beat (30 beats per revolution, one beat every 125 ms at 4 Hz)",
    test: () => MODELS.modern.N.toothStepDeg === 12 && MODELS.modern.N.beatsPerRev === 30 && MODELS.modern.N.beatMs === 125 && MODELS.modern.N.hz === 4 && Math.abs(escapementAt(1).escapeDeg - 12) < 1e-9,
  },
  {
    text: "Shortening the active spring by just 83 microns makes the watch gain 20 seconds a day; lengthening it by 83 microns slows it by 20 seconds a day",
    test: () => regulatorAt(20).deltaUm === -83 && regulatorAt(-20).deltaUm === 83,
  },
];

export const COVERAGE = {
  source: "George Daniels, Watchmaking (going train gear ratios, Swiss lever escapement lock-unlock-impulse-drop sequence, automatic slipping mainspring bridle, balance wheel & hairspring regulation); ETA 2824-2 technical calibre specifications (25.6 mm, 28,800 vph, 52 deg lift angle)",
  topics: [
    { topic: "overall battery-free timekeeping problem and calibre overview", where: "step:0" },
    { topic: "six exploded calibre layers and synthetic ruby jewel bearings", where: "step:1" },
    { topic: "off-axis weighted oscillating rotor on ball bearings", where: "step:2" },
    { topic: "bidirectional twin reversing click wheels and 120:1 winding reduction", where: "step:3" },
    { topic: "mainspring barrel energy storage (7 turns, 42 hours reserve)", where: "step:4" },
    { topic: "slipping bridle overwind protection at 7.2 N·mm", where: "step:5" },
    { topic: "mainspring torque plateau, balance amplitude and wrist-activity energy balance", where: "step:6" },
    { topic: "barrel-to-center 6:1 stage and dial-side 12:1 motion works", where: "step:7" },
    { topic: "center-third-fourth 60:1 minute-to-second going train", where: "step:8" },
    { topic: "fourth-to-escape high-speed stage and torque-speed trade-off", where: "step:9" },
    { topic: "Swiss lever escapement lock and unlock phases", where: "step:10" },
    { topic: "Swiss lever escapement impulse and drop phases (52 deg lift angle, 12 deg/beat)", where: "step:11" },
    { topic: "harmonic balance wheel and breathing hairspring oscillator", where: "step:12" },
    { topic: "micron regulator index rate adjustment (+/- 83 microns for +/- 20 s/day)", where: "step:13" },
    { topic: "high-beat 28,800 vph (4 Hz) vs vintage 18,000 vph (2.5 Hz) beat rates", where: "whatif" },
    { topic: "wrist activity, mainspring wind amplitude and regulator error lab", where: "lab" },
    { topic: "keyless works and crown hand-setting clutch", core: false, where: "deferred", why: "manual time-setting sits on the dial side under the hands; named in Details" },
  ],
};
