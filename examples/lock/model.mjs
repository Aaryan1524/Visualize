// Pin tumbler cylinder, in millimetres. x runs along the plug from its front face (x = 0)
// toward the back; y points up from the plug axis. Pure and import-free: build.mjs inlines
// this file into the page, so the page and the tests run the same code.
//
// The lock's pinning (which key pin sits in each chamber) and the key's cuts are separate
// tables. Where each pin stack sits is found by contact between the chamfered key-pin tip
// and the key blade's profile, never by reading the key code.
//
// Dimensions are representative of a common five-pin residential cylinder, not taken from
// any one maker's drawing.

export const LOCK = {
  R: 6.35, // plug radius (dia 12.7); the shear line is the plug's surface
  pinD: 2.92, // pin diameter
  boreR: 1.5, // chamber bore radius
  x0: 5.87, // first chamber centre, from the plug face
  pitch: 3.96, // chamber spacing
  step: 0.381, // depth increment between neighbouring cut depths
  depths: 10, // depths 0 (shallowest) .. 9 (deepest)
  H0: 3.3, // uncut blade top, above the plug axis; depth 0 cut root
  bladeBot: -3.8, // blade bottom edge
  kwTop: 3.6, // keyway top
  kwBot: -4.0, // keyway bottom
  rest: -0.6, // with no key, the key-pin tip rests here (the keyway wards stop it)
  driver: 4.6, // driver pin length
  chamberTop: 16.6, // top of each housing chamber (under the cap strip)
  capTop: 17.6,
  springSolid: 1.2, // a spring cannot close shorter than this
  tipFlat: 0.8, // flat on the key-pin tip; the chamfer runs at 45 degrees from it
  rootW: 0.8, // flat at the bottom of each cut; its flanks run at 45 degrees
  Ltip: 27.5, // blade length, shoulder to tip; fully in when the tip reaches x = Ltip
  tipY: -1.5, // the point of the blade's nose
  play: 0.04, // pin-in-bore clearance: how far a blocked plug can move at its surface
  housingEnd: 33,
  plugEnd: 32,
};

// The lock's pinning: the depth each chamber's key pin is cut for.
export const PINNING = [3, 6, 2, 5, 4];
// Keys. The wrong key differs in one cut: the third is one depth too shallow.
export const KEYS = { right: [3, 6, 2, 5, 4], wrong: [3, 6, 1, 5, 4] };

// The locks the page can show. The tolerance is how far a pin's top may miss the shear line
// and still be cammed past it by the chamfers on the pin and the bore.
export const VARIANTS = {
  tight: { tol: 0.1, label: "Tight lock ±0.10 mm" },
  loose: { tol: 0.45, label: "Loose lock ±0.45 mm" },
};

export const cutRoot = (d, L = LOCK) => L.H0 - L.step * d;
export const keyPinLength = (d, L = LOCK) => L.R - cutRoot(d, L);
export const pinX = (i, L = LOCK) => L.x0 + L.pitch * i;

// Height of the blade's top edge at key coordinate u (mm from the shoulder). -Infinity off the blade.
export function bladeTop(cuts, u, L = LOCK) {
  if (u < 0 || u > L.Ltip) return -Infinity;
  let y = Math.min(L.H0, L.tipY + (L.Ltip - u));
  for (let i = 0; i < cuts.length; i++) {
    const v = cutRoot(cuts[i], L) + Math.max(0, Math.abs(u - pinX(i, L)) - L.rootW / 2);
    if (v < y) y = v;
  }
  return y;
}
export function bladeBottom(u, L = LOCK) {
  return Math.max(L.bladeBot, L.tipY - (L.Ltip - u));
}
// How far the key-pin tip's surface sits above its lowest point, dx from the pin axis.
export const tipRise = (dx, L = LOCK) => Math.max(0, Math.abs(dx) - L.tipFlat / 2);

// The key-pin tip height in chamber i, for a key with these cuts inserted so its tip is at
// x = ins (null for no key). Contact: the lowest the stack can sit without the chamfered tip
// entering the blade anywhere under it, and no lower than the rest stop.
export function keyPinTip(cuts, ins, i, L = LOCK, n = 1460) {
  if (!cuts) return L.rest;
  const xc = pinX(i, L), shoulder = ins - L.Ltip, r = L.pinD / 2;
  let y = L.rest;
  for (let k = 0; k <= n; k++) {
    const dx = -r + (2 * r * k) / n;
    const top = bladeTop(cuts, xc + dx - shoulder, L);
    const need = top - tipRise(dx, L);
    if (need > y) y = need;
  }
  return y;
}

// Every stack's state for one key position.
export function stacks(pinning, cuts, ins, tol, L = LOCK) {
  return pinning.map((d, i) => {
    const tip = keyPinTip(cuts, ins, i, L);
    const keyTop = tip + keyPinLength(d, L);
    const drvTop = keyTop + L.driver;
    const miss = keyTop - L.R; // > 0: the key pin crosses the shear line; < 0: the driver does
    const block = miss > tol + 1e-9 ? "key" : miss < -tol - 1e-9 ? "driver" : null;
    return { i, x: pinX(i, L), depth: d, tip, keyTop, drvTop, spring: L.chamberTop - drvTop, miss, block };
  });
}

export function makeModel(over = {}) {
  const L = { ...LOCK, ...(over.lock || {}) };
  const tol = over.tol ?? VARIANTS.tight.tol;
  const pinning = over.pinning || PINNING;
  const keys = over.keys || KEYS;
  const stackAt = (keyName, ins) => stacks(pinning, keyName ? keys[keyName] : null, ins, tol, L);
  const fullyIn = (ins) => Math.abs(ins - L.Ltip) < 1e-9;
  // Can the plug turn with this key fully in? Every gap within the tolerance of the shear line.
  const turns = (keyName) => !!keyName && stackAt(keyName, L.Ltip).every((s) => s.block === null);
  // The furthest the plug can turn: 90 degrees when free, else only the bore clearance.
  const turnLimit = (keyName, ins) => (keyName && fullyIn(ins) && turns(keyName) ? 90 : (L.play / L.R) * (180 / Math.PI));
  const blockers = (keyName, ins) => stackAt(keyName, ins).filter((s) => s.block);
  return {
    L, tol, pinning, keys, stackAt, turns, turnLimit, blockers,
    bladeTop: (keyName, u) => bladeTop(keys[keyName], u, L),
    bladeBottom: (u) => bladeBottom(u, L),
    keyPinLength: (d) => keyPinLength(d, L),
    cutRoot: (d) => cutRoot(d, L),
    pinX: (i) => pinX(i, L),
    combinations: Math.pow(L.depths, pinning.length),
    macs: macs(L),
    keyCount: keyCount(pinning.length, L),
  };
}

// Maximum adjacent cut difference: past this, a deep cut's flank eats into its neighbour's root.
export const macs = (L = LOCK) => Math.floor((L.pitch - L.rootW) / L.step + 1e-9);
// How many different keys the lock family allows, counting only keys within the MACS.
export function keyCount(n, L = LOCK) {
  const m = macs(L);
  let ways = Array(L.depths).fill(1);
  for (let k = 1; k < n; k++) ways = ways.map((_, d) => ways.reduce((a, w, e) => a + (Math.abs(d - e) <= m ? w : 0), 0));
  return ways.reduce((a, b) => a + b, 0);
}

export const MODELS = Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, makeModel({ tol: v.tol })]));

// ---------------------------------------------------------------- the key's outline, for drawing
// The blade's profile from the shoulder (u = 0) to the tip, with every corner of the bitting
// exact, plus the bow behind the shoulder. Used by the build and, for a key the reader cuts in the
// lab, by the page.
export function keyOutline(cuts, L = LOCK) {
  const top = [], bot = [];
  const nU = Math.round(L.Ltip / 0.05);
  for (let k = 0; k <= nU; k++) {
    const u = (k * L.Ltip) / nU;
    top.push([u, bladeTop(cuts, u, L)]);
    bot.push([u, bladeBottom(u, L)]);
  }
  const corners = [];
  cuts.forEach((d, i) => {
    const c = cutRoot(d, L), x = pinX(i, L);
    for (const u of [x - L.rootW / 2, x + L.rootW / 2, x - L.rootW / 2 - (L.H0 - c), x + L.rootW / 2 + (L.H0 - c)]) corners.push(u);
  });
  const all = [...top, ...corners.filter((u) => u > 0 && u < L.Ltip).map((u) => [u, bladeTop(cuts, u, L)])].sort((a, b) => a[0] - b[0]);
  const bow = [[0, L.H0], [0, 5.4], [-2.4, 5.4], [-3.4, 8.2], [-15, 8.6], [-19.5, 6.4], [-21, 0], [-19.5, -6.4], [-15, -8.6], [-3.4, -8.2], [-2.4, -5.4], [0, -5.4], [0, L.bladeBot]];
  return [...bow.slice(0, 1), ...all.filter((p) => p[0] > 0), ...bot.slice().reverse().filter((p) => p[0] > 0 && p[0] < L.Ltip), ...bow.slice(-1).reverse(), ...bow.slice(1, -1).reverse()];
}

// ---------------------------------------------------------------- picking
// No lock is machined perfectly: each chamber is bored a few hundredths of a millimetre off the
// line. With light turning force on the plug (a tension wrench), the chamber furthest off in the
// direction of turn pinches its driver pin first: it binds, while the others stay loose. Lift that
// stack until its gap reaches the shear line and the plug turns a hair, so the driver pin is left
// resting on the plug's edge (set) and its key pin drops back. The next chamber then binds.
// Representative offsets, in mm, in the direction of turn.
export const OFFSETS = [0.012, 0.031, -0.004, 0.024, 0.018];
// Chambers in the order they bind: the largest offset first.
export const bindingOrder = (offsets = OFFSETS) => offsets.map((o, i) => [o, i]).sort((a, b) => b[0] - a[0]).map((p) => p[1]);

// The stacks while picking: chambers order[0..j-1] are set, chamber order[j] is lifted by `lift`
// (0 = resting, 1 = its gap on the shear line). With no key every key pin rests on the stop.
// drvBot is the bottom of the driver pin; for a set chamber it rests on the plug's edge.
export function pickStacks(pinning, j, lift, order = bindingOrder(), L = LOCK) {
  return pinning.map((d, i) => {
    const len = keyPinLength(d, L);
    const k = order.indexOf(i);
    const set = k < j;
    const rise = k === j ? Math.max(0, Math.min(1, lift)) * (L.R - (L.rest + len)) : 0;
    const tip = L.rest + rise, keyTop = tip + len;
    const drvBot = set ? L.R : keyTop;
    return { i, x: pinX(i, L), depth: d, tip, keyTop, drvBot, drvTop: drvBot + L.driver, set, binding: k === j && j < pinning.length };
  });
}
