// Open Differential: the story, in one place — steps, headings, captions, narration, claims, and
// coverage. build.mjs, voice.mjs, and claims.test.mjs all read this module.
//
// Every number is computed from model.mjs (src/claims/audit.mjs fails any number the model lacks),
// ratios use non-breaking spaces (3.73 : 1), whole numbers are spoken in words with full unit names
// in narration, and every cause-and-effect claim in CLAIMS appears word-for-word on the page.

export const STEPS = [
  { tab: null, focus: null },
  { tab: "The parts", focus: null },
  { tab: "Final drive", focus: ["pinion", "ring", "carrier"], shot: ["pinion", "ring"], around: ["carrier"] },
  { tab: "Straight", focus: ["carrier", "spider", "sunL", "sunR", "wheelL", "wheelR"], shot: ["spider", "sunL", "sunR"], around: ["carrier"] },
  { tab: "Cornering", focus: ["carrier", "spider", "sunL", "sunR", "axleL", "axleR", "wheelL", "wheelR"], shot: ["wheelL", "spider", "wheelR"], subject: ["spider", "sunL", "sunR"] },
  { tab: "Equal torque", focus: ["carrier", "spider", "sunL", "sunR", "forces"], shot: ["spider", "forces"], around: ["sunL", "sunR"] },
  { tab: "The ice trap", focus: ["wheelL", "ice", "axleL", "sunL", "spider", "sunR", "wheelR"], shot: ["wheelL", "ice", "spider"], around: ["axleL", "sunL"] },
];

export const PRED_STEP = 5;

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

const fmt0 = (v) => Math.round(v).toLocaleString("en-US");
const fmt1 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const fmt2 = (v) => v.toFixed(2);
const ratio = (a, b) => `${a}\u00a0:\u00a0${b}`;

/** Step headings, one per step, computed from the model. */
export const headings = (M) => {
  const N = M.N, D = M.D;
  return [
    "How does one driveshaft turn two wheels at different speeds?",
    "A rotating cage of bevel gears links one driveshaft to both half-shafts.",
    `The ${D.zPinion}-tooth pinion turns the ${D.zRing}-tooth ring gear ${ratio(fmt2(N.finalDrive), 1)} slower, multiplying torque.`,
    `Going straight, the spider gears orbit with the carrier without spinning.`,
    `In a ${fmt2(N.turnR)} m bend, the outer wheel runs at ${fmt0(N.turnRightRpm)} rpm and the inner at ${fmt0(N.turnLeftRpm)} rpm.`,
    `The floating spider gears act as a balance bar, keeping both wheels at ${fmt0(N.wheelTorque)} N·m.`,
    `On glare ice, both wheels drop to ${fmt0(N.iceCapTorque)} N·m and the icy wheel spins at ${fmt0(N.iceLeftRpm)} rpm.`,
  ];
};

/** Details drawer captions, one per step. */
export const captions = (M) => {
  const N = M.N, D = M.D;
  return [
    `When a car turns, the outer wheel travels a longer circular arc than the inner wheel. With a ${fmt1(D.track)} m track through a ${fmt2(N.turnR)} m turn, the outer wheel rolls on a ${fmt2(N.rOuter)} m radius and the inner on a ${fmt2(N.rInner)} m radius — ${fmt1(N.outerPctFaster)}% faster. A solid axle would force both tires to turn together and scrub; an open differential lets one driveshaft drive both wheels at different speeds while splitting torque equally.`,
    `Power enters along the driveshaft to the ${D.zPinion}-tooth drive pinion, which meshes at right angles with the ${D.zRing}-tooth ring gear bolted to the rotating carrier. Inside the carrier, two ${D.zSpider}-tooth spider gears (orange) ride on a cross-pin and mesh with the ${D.zSun}-tooth left and right sun gears splined to the two half-shafts.`,
    `The final drive is a ${ratio(D.zRing, D.zPinion)} (${ratio(fmt2(N.finalDrive), 1)}) reduction. At ${fmt0(N.driveRpm)} rpm and ${fmt0(N.driveTorque)} N·m on the driveshaft, the ring gear and carrier turn at ${fmt0(N.carrierRpm)} rpm with ${fmt0(N.carrierTorque)} N·m of torque — power in equals power out.`,
    `Driving straight ahead on dry asphalt, both tires see the same road radius and resistance. The spider gears do not spin on their cross-pin (${fmt0(0)} rpm); they act like wedges locking the two sun gears to the carrier so both wheels turn at ${fmt0(N.carrierRpm)} rpm and share ${fmt0(N.wheelTorque)} N·m each.`,
    `In a ${fmt2(N.turnR)} m left turn, the inner left wheel slows by ${fmt0(N.turnDeltaRpm)} rpm to ${fmt0(N.turnLeftRpm)} rpm while the outer right wheel speeds up by ${fmt0(N.turnDeltaRpm)} rpm to ${fmt0(N.turnRightRpm)} rpm. Their speeds always add up to twice the carrier speed: ${fmt0(N.turnLeftRpm)} + ${fmt0(N.turnRightRpm)} = ${fmt0(N.sumRpm)} rpm. That speed difference spins the ${D.zSpider}-tooth spider gears on their cross-pin at ${fmt1(N.turnSpiderRpm)} rpm (a ${ratio(fmt1(N.sunSpiderRatio), 1)} sun-to-spider ratio).`,
    `Each spider gear pushes both sun gears from opposite sides of its cross-pin like a pivoted balance bar. Neglecting gear friction, both wheels always receive equal torque: ${fmt0(N.wheelTorque)} N·m left and ${fmt0(N.wheelTorque)} N·m right, even while turning at different speeds.`,
    `Equal torque becomes a trap when one tire hits glare ice. At friction ${fmt2(D.muIce)}, the icy left tire can hold only ${fmt0(N.iceCapTorque)} N·m before breaking traction, while the dry right tire at ${fmt2(D.muDry)} could hold ${fmt0(N.dryCapTorque)} N·m. Because the open differential enforces equal torque, the dry wheel is capped at ${fmt0(N.iceCapTorque)} N·m too — delivering only ${fmt0(N.iceTotalTorque)} N·m total and stranding ${fmt0(N.iceTrappedTorque)} N·m of available grip. Because ${fmt0(N.iceTotalTorque)} N·m is less than the resistance holding the car still (here ${fmt0(N.carrierTorque)} N·m of demand), the dry right wheel stalls at ${fmt0(N.iceRightRpm)} rpm while the icy left wheel spins at twice carrier speed, ${fmt0(N.iceLeftRpm)} rpm, spinning the spider gears at ${fmt0(N.iceSpiderRpm)} rpm.`,
  ];
};

/**
 * Spoken narration for Kokoro TTS: whole numbers in words, decimals as digits, all units in plain
 * words (zero abbreviations). [phrase|part ...] lights those parts while spoken.
 */
export const script = (M) => {
  const N = M.N, D = M.D;
  return [
    `When a car turns, the outer wheel travels a longer circular arc than the inner wheel. An open differential lets one driveshaft turn both wheels at different speeds while keeping their torque equal.`,
    `Power comes in through [the drive pinion|pinion] and turns [the ring gear|ring] bolted to [the carrier|carrier]. Inside, two orange [spider gears|spider] ride on a cross-pin between [the left sun gear|sunL] and [the right sun gear|sunR], which drive [both half-shafts|axleL axleR].`,
    `[The eleven-tooth drive pinion|pinion] drives [the forty-one-tooth ring gear|ring] at a 3.73 to one reduction. ${words(N.driveRpm)} revolutions per minute at ${words(N.driveTorque)} newton-metres becomes ${words(N.carrierRpm)} revolutions per minute at ${words(N.carrierTorque)} newton-metres on [the carrier|carrier].`,
    `Going straight, both wheels turn at the same speed. [The spider gears|spider] orbit with [the carrier|carrier] without spinning on their cross-pin, locking [both sun gears|sunL sunR] to ${words(N.carrierRpm)} revolutions per minute.`,
    `Now enter a ${fmt2(N.turnR)} metre left bend. [The left wheel|wheelL] slows by ${words(N.turnDeltaRpm)} revolutions per minute to ${words(N.turnLeftRpm)}, while [the right wheel|wheelR] speeds up by ${words(N.turnDeltaRpm)} to ${words(N.turnRightRpm)}. Their speeds always add up to twice the carrier speed, ${words(N.sumRpm)} revolutions per minute, as [the spider gears|spider] spin on their cross-pin at ${fmt1(N.turnSpiderRpm)} revolutions per minute.`,
    `Because [each spider gear|spider] pivots freely on its cross-pin, it pushes [the left sun gear|sunL] and [the right sun gear|sunR] with [equal force|forces]. Both wheels always receive equal torque, ${words(N.wheelTorque)} newton-metres each, even when their speeds differ.`,
    `Put [the left wheel|wheelL] on [glare ice|ice], and equal torque turns into a trap. The icy tire slips at ${words(N.iceCapTorque)} newton-metres, so the open differential caps the dry right wheel at ${words(N.iceCapTorque)} newton-metres too. With only ${words(N.iceTotalTorque)} newton-metres total — not enough to overcome the resistance holding the car still — the dry wheel stalls while [the icy left wheel|wheelL] spins at twice carrier speed, ${words(N.iceLeftRpm)} revolutions per minute, and [the spider gears|spider] whirl at ${words(N.iceSpiderRpm)} revolutions per minute.`,
  ];
};

/** Cause-and-effect claims: every text must appear word-for-word on the page and pass against every variant. */
export const CLAIMS = [
  {
    text: "the outer wheel travels a longer circular arc than the inner wheel",
    test: (m) => m.corner.rOuter > m.corner.rInner && m.corner.rightRpm > m.corner.leftRpm,
  },
  {
    text: "power in equals power out",
    test: (m) =>
      Math.abs(m.N.driveTorque * m.N.driveRpm - m.N.carrierTorque * m.N.carrierRpm) < 1e-9 &&
      Math.abs(m.corner.torqueL * m.corner.leftRpm + m.corner.torqueR * m.corner.rightRpm - m.corner.carrierTorque * m.corner.carrierRpm) < 1e-9,
  },
  {
    text: "the spider gears orbit with the carrier without spinning",
    test: (m) => m.straight.spiderRpm === 0 && m.straight.leftRpm === m.straight.carrierRpm && m.straight.rightRpm === m.straight.carrierRpm,
  },
  {
    text: "Their speeds always add up to twice the carrier speed",
    test: (m) =>
      Math.abs(m.straight.leftRpm + m.straight.rightRpm - 2 * m.straight.carrierRpm) < 1e-9 &&
      Math.abs(m.corner.leftRpm + m.corner.rightRpm - 2 * m.corner.carrierRpm) < 1e-9 &&
      Math.abs(m.ice.leftRpm + m.ice.rightRpm - 2 * m.ice.carrierRpm) < 1e-9,
  },
  {
    text: "both wheels always receive equal torque",
    test: (m) =>
      Math.abs(m.straight.torqueL - m.straight.torqueR) < 1e-9 &&
      Math.abs(m.corner.torqueL - m.corner.torqueR) < 1e-9 &&
      Math.abs(m.ice.torqueL - m.ice.torqueR) < 1e-9,
  },
  {
    text: "the dry wheel is capped at 96 N·m too",
    test: (m) => m.ice.torqueR === m.ice.maxLeftTorque && m.ice.torqueR === 96 && m.ice.maxRightTorque > 1000,
  },
  {
    text: "the icy left wheel spins at twice carrier speed",
    test: (m) => Math.abs(m.ice.leftRpm - 2 * m.ice.carrierRpm) < 1e-9 && m.ice.rightRpm === 0,
  },
];

/** Core topics of an open differential and where each is taught on the page. */
export const COVERAGE = {
  source: "Gillespie, Fundamentals of Vehicle Dynamics (driveline and open differential kinematics/torque split); Bosch Automotive Handbook (final drive bevel gearset, planetary bevel differential, traction limit on split-mu surfaces)",
  topics: [
    { topic: "why outer and inner wheels need different speeds in a turn", where: "step:0" },
    { topic: "the parts: drive pinion, ring gear, carrier, spider gears, sun gears, half-shafts", where: "step:1" },
    { topic: "final drive speed reduction and torque multiplication", where: "step:2" },
    { topic: "straight-ahead drive: spider gears orbit without spinning", where: "step:3" },
    { topic: "cornering kinematics: omegaL + omegaR = 2 * omegaCarrier and spider spin", where: "step:4" },
    { topic: "equal-torque balance bar: TL = TR even when speeds differ", where: "step:5" },
    { topic: "the split-mu ice trap: torque capped by the low-grip tire and single-wheel spin", where: "step:6" },
    { topic: "tighter turn radius doubles speed split and spider spin", where: "whatif" },
    { topic: "interactive steering radius, driveshaft speed, and left-tire grip", where: "lab" },
    { topic: "limited-slip and locking differentials", core: false, where: "deferred", why: "uses clutches, helical gears, or dogs to break the equal-torque rule; noted in Details" },
    { topic: "hypoid pinion offset and gear tooth friction losses", core: false, where: "deferred", why: "modelled as frictionless straight bevel gears so the pure kinematic and torque laws stay exact; noted in Details" },
  ],
};
