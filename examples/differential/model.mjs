// Open Differential: executable physics & kinematics model.
// Pure functions, zero imports (build.mjs inlines this file directly into the standalone page).
//
// Sign convention (3D right-handed axle frame):
//   +X runs from the left wheel (-X) to the right wheel (+X).
//   +Y runs toward the front of the car (the incoming driveshaft).
//   +Z is up.
//
// Final drive: 11-tooth drive pinion meshing a 41-tooth ring gear (41 / 11 ≈ 3.73 : 1).
// Bevel differential gearset: 16-tooth left & right sun (side) gears meshing 10-tooth spider (planet) gears.
//
// Fundamental kinematic constraint (holds in every state — straight, cornering, or wheelspin on ice):
//   omegaL + omegaR = 2 * omegaCarrier
//   omegaSpider = ((omegaL - omegaR) / 2) * (zSun / zSpider)
//
// Open differential torque balance (frictionless spider balance bar):
//   torqueL = torqueR = min(carrierTorque / 2, maxLeftGripTorque, maxRightGripTorque)

export const DIFF = {
  zPinion: 11,       // drive pinion teeth
  zRing: 41,         // ring gear teeth (final drive 41 / 11 ≈ 3.73 : 1)
  zSun: 16,          // left & right sun (side) gear teeth
  zSpider: 10,       // spider (planet) gear teeth
  track: 1.50,       // m, track width between left & right tire contact patches
  tireR: 0.32,       // m, tire rolling radius (205/55R16 class)
  wheelLoad: 3750,   // N, normal load per driven rear wheel (~1,530 kg car, 50/50 split)
  driveRpm: 820,     // rpm, nominal driveshaft speed -> exact 220 rpm carrier speed
  driveTorque: 110,  // N·m, nominal driveshaft torque -> exact 410 N·m carrier torque
  muDry: 0.85,       // dry asphalt friction coefficient -> 1,020 N·m per wheel
  muIce: 0.08,       // glare ice friction coefficient -> 96 N·m per wheel
};

export const VARIANTS = {
  wide:  { key: "wide",  label: "Wide bend (7.5 m)",   turnR: 7.5 },
  tight: { key: "tight", label: "Tight turn (3.75 m)", turnR: 3.75 },
};

const TAU = Math.PI * 2;

/** Maximum road-traction torque (N·m) one tire can hold at friction coefficient mu. */
export function gripTorque(mu, D = DIFF) {
  return mu * D.wheelLoad * D.tireR;
}

/**
 * Pure rolling cornering kinematics for a left turn of centerline radius `turnR` (Infinity = straight).
 * In a left turn, the left wheel is the inner wheel (radius R - W/2) and the right wheel is the outer
 * wheel (radius R + W/2).
 */
export function cornerKinematics(driveRpm, turnR = Infinity, D = DIFF) {
  const finalDrive = D.zRing / D.zPinion;
  const sunSpiderRatio = D.zSun / D.zSpider;
  const halfTrack = D.track / 2;
  const carrierRpm = driveRpm / finalDrive;
  const straight = !Number.isFinite(turnR);
  const rInner = straight ? Infinity : turnR - halfTrack;
  const rOuter = straight ? Infinity : turnR + halfTrack;
  const deltaFrac = straight ? 0 : halfTrack / turnR;
  const deltaRpm = carrierRpm * deltaFrac;
  const leftRpm = carrierRpm - deltaRpm;
  const rightRpm = carrierRpm + deltaRpm;
  // Signed spider spin about its outward cross-pin axis: positive when right (outer) wheel runs faster than left
  const spiderSpinRpm = ((rightRpm - leftRpm) / 2) * sunSpiderRatio;
  const spiderRpm = Math.abs(spiderSpinRpm);
  const outerToInner = straight ? 1 : rOuter / rInner;
  const outerPctFaster = (outerToInner - 1) * 100;
  const roadSpeedMs = (carrierRpm / 60) * TAU * D.tireR;
  const roadSpeedKmh = roadSpeedMs * 3.6;
  return {
    driveRpm,
    carrierRpm,
    sumRpm: leftRpm + rightRpm,
    leftRpm,
    rightRpm,
    deltaFrac,
    deltaRpm,
    spiderSpinRpm,
    spiderRpm,
    rInner,
    rOuter,
    outerToInner,
    outerPctFaster,
    roadSpeedMs,
    roadSpeedKmh,
  };
}

/**
 * Full open-differential operating state: combines cornering kinematics with the equal-torque balance
 * bar and tire traction ceilings on both left and right wheels.
 */
export function tractionState(
  {
    driveRpm = DIFF.driveRpm,
    driveTorque = DIFF.driveTorque,
    turnR = Infinity,
    muLeft = DIFF.muDry,
    muRight = DIFF.muDry,
  } = {},
  D = DIFF,
) {
  const finalDrive = D.zRing / D.zPinion;
  const sunSpiderRatio = D.zSun / D.zSpider;
  const kin = cornerKinematics(driveRpm, turnR, D);
  const carrierTorque = driveTorque * finalDrive;
  const demandedPerWheel = carrierTorque / 2;
  const maxLeftTorque = gripTorque(muLeft, D);
  const maxRightTorque = gripTorque(muRight, D);
  const minGripTorque = Math.min(maxLeftTorque, maxRightTorque);

  // An open differential's floating spider gears enforce TL === TR at all times
  const wheelTorque = Math.min(demandedPerWheel, minGripTorque);
  const deliveredAxleTorque = 2 * wheelTorque;
  const availableGripTotal = maxLeftTorque + maxRightTorque;
  const trappedTorque = Math.max(0, availableGripTotal - 2 * minGripTorque);

  const slipping = demandedPerWheel > minGripTorque + 1e-9;
  const slipSide = !slipping
    ? "none"
    : maxLeftTorque < maxRightTorque - 1e-9
      ? "left"
      : maxRightTorque < maxLeftTorque - 1e-9
        ? "right"
        : "both";

  let leftRpm = kin.leftRpm;
  let rightRpm = kin.rightRpm;
  let deltaFrac = kin.deltaFrac;

  if (slipSide === "left") {
    // Left wheel breaks traction on low grip; dry right wheel is capped below demanded torque and stalls
    rightRpm = 0;
    leftRpm = 2 * kin.carrierRpm;
    deltaFrac = -1;
  } else if (slipSide === "right") {
    leftRpm = 0;
    rightRpm = 2 * kin.carrierRpm;
    deltaFrac = 1;
  } else if (slipSide === "both") {
    leftRpm = kin.carrierRpm;
    rightRpm = kin.carrierRpm;
    deltaFrac = 0;
  }

  const spiderSpinRpm = ((rightRpm - leftRpm) / 2) * sunSpiderRatio;
  const spiderRpm = Math.abs(spiderSpinRpm);

  return {
    ...kin,
    driveTorque,
    carrierTorque,
    demandedPerWheel,
    muLeft,
    muRight,
    maxLeftTorque,
    maxRightTorque,
    wheelTorque,
    torqueL: wheelTorque,
    torqueR: wheelTorque,
    deliveredAxleTorque,
    availableGripTotal,
    trappedTorque,
    slipping,
    slipSide,
    leftRpm,
    rightRpm,
    sumRpm: leftRpm + rightRpm,
    deltaFrac,
    spiderSpinRpm,
    spiderRpm,
  };
}

/**
 * Kinematic angles (radians) for a given carrier angle `carrierRad` and split fraction `deltaFrac`
 * (0 = straight, +W/(2R) = left turn, -1 = left wheel spinning on ice while right wheel is stopped).
 * Guarantees thetaL + thetaR === 2 * carrierRad and exact bevel-gear meshing signs.
 */
export function anglesAt(carrierRad, deltaFrac = 0, D = DIFF) {
  const finalDrive = D.zRing / D.zPinion;
  const sunSpiderRatio = D.zSun / D.zSpider;
  const pinionRad = carrierRad * finalDrive;
  const leftRad = carrierRad * (1 - deltaFrac);
  const rightRad = carrierRad * (1 + deltaFrac);
  // Signed spin of spider gear about its outward cross-pin axis (positive when right sun outruns left)
  const spiderRad = ((rightRad - leftRad) / 2) * sunSpiderRatio;
  return { pinionRad, carrierRad, leftRad, rightRad, spiderRad };
}

/** Map a lab steering slider (0 = straight, 50 = wide 7.5 m bend, 100 = tight 3.75 m turn) to turning radius (m). */
export function turnRadiusFromSteer(steerPct) {
  if (steerPct <= 0) return Infinity;
  return 3.75 / (steerPct / 100);
}

/** Format a wheel-speed pair and their exact sum so printed digits always add up identically. */
export function exactSpeedStrings(leftRpm, rightRpm, carrierRpm) {
  const sum = 2 * carrierRpm;
  for (const dec of [0, 1, 2]) {
    const ls = leftRpm.toFixed(dec), rs = rightRpm.toFixed(dec), ss = sum.toFixed(dec), cs = carrierRpm.toFixed(dec);
    if (Math.abs(Number(ls) + Number(rs) - Number(ss)) < 1e-9 && Math.abs(2 * Number(cs) - Number(ss)) < 1e-9) {
      return { left: ls, right: rs, sum: ss, carrier: cs, dec };
    }
  }
  return {
    left: leftRpm.toFixed(2),
    right: rightRpm.toFixed(2),
    sum: sum.toFixed(2),
    carrier: carrierRpm.toFixed(2),
    dec: 2,
  };
}

export function makeModel(v, D = DIFF) {
  const finalDrive = D.zRing / D.zPinion;
  const sunSpiderRatio = D.zSun / D.zSpider;
  const halfTrack = D.track / 2;

  const straight = tractionState({ driveRpm: D.driveRpm, driveTorque: D.driveTorque, turnR: Infinity, muLeft: D.muDry, muRight: D.muDry }, D);
  const corner = tractionState({ driveRpm: D.driveRpm, driveTorque: D.driveTorque, turnR: v.turnR, muLeft: D.muDry, muRight: D.muDry }, D);
  const ice = tractionState({ driveRpm: D.driveRpm, driveTorque: D.driveTorque, turnR: Infinity, muLeft: D.muIce, muRight: D.muDry }, D);

  // Complete audited number table: every figure shown or spoken on the page lives here
  const N = {
    zPinion: D.zPinion,
    zRing: D.zRing,
    zSun: D.zSun,
    zSpider: D.zSpider,
    finalDrive,
    sunSpiderRatio,
    track: D.track,
    halfTrack,
    tireR: D.tireR,
    wheelLoad: D.wheelLoad,
    turnR: v.turnR,
    rOuter: corner.rOuter,
    rInner: corner.rInner,
    outerToInner: corner.outerToInner,
    outerPctFaster: corner.outerPctFaster,
    driveRpm: D.driveRpm,
    carrierRpm: straight.carrierRpm,
    sumRpm: straight.sumRpm,
    turnDeltaRpm: corner.deltaRpm,
    turnLeftRpm: corner.leftRpm,
    turnRightRpm: corner.rightRpm,
    turnSpiderRpm: corner.spiderRpm,
    driveTorque: D.driveTorque,
    carrierTorque: straight.carrierTorque,
    wheelTorque: straight.wheelTorque,
    muDry: D.muDry,
    muIce: D.muIce,
    dryCapTorque: straight.maxLeftTorque,
    iceCapTorque: ice.maxLeftTorque,
    iceTotalTorque: ice.deliveredAxleTorque,
    iceAvailableTorque: ice.availableGripTotal,
    iceTrappedTorque: ice.trappedTorque,
    iceLeftRpm: ice.leftRpm,
    iceRightRpm: ice.rightRpm,
    iceSpiderRpm: ice.spiderRpm,
    roadSpeedKmh: straight.roadSpeedKmh,
  };

  return {
    v,
    D,
    N,
    finalDrive,
    sunSpiderRatio,
    straight,
    corner,
    ice,
    gripTorque: (mu) => gripTorque(mu, D),
    cornerKinematics: (rpm, R) => cornerKinematics(rpm, R, D),
    tractionState: (opts) => tractionState(opts, D),
    anglesAt: (carrierRad, deltaFrac) => anglesAt(carrierRad, deltaFrac, D),
  };
}

export const MODELS = Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, makeModel(v)]));
