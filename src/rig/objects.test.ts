import { test } from "node:test";
import assert from "node:assert/strict";
import type { Camera } from "./camera.ts";
import {
  axialHousing,
  calibrePlate,
  coiledSpring,
  dipTube,
  electrodeStack,
  explainerCard,
  flowArrow3D,
  helicalCoil,
  liquidColumn,
  meterBar,
  OBJECT_VIEW,
  pistonAssembly,
  plungerNozzle,
  sprayCone,
  turbineRotor,
  vesselShell,
  watchCaseDial,
  watchHand,
} from "./objects.ts";

const CAM: Camera = { ...OBJECT_VIEW, scale: 12, origin: [500, 420] };

const assertValidSvg = (name: string, svg: string) => {
  assert.ok(svg.length > 20, `${name}: expected non-empty SVG`);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `${name}: contains invalid numeric or undefined token`);
};

test("objects: OBJECT_VIEW matches the standard everyday object studio camera", () => {
  assert.deepEqual(OBJECT_VIEW, { azimuth: 238, elevation: 22 });
});

test("objects: vesselShell renders both solid and cutaway 3D bottles cleanly", () => {
  const closed = vesselShell(CAM, { r: 18, h: 42, neckR: 6, neckH: 10, shoulderH: 8, cutaway: false });
  assertValidSvg("vesselShell closed", closed);
  assert.match(closed, /rig-solid rig-m-glass/);
  assert.match(closed, /rig-glass-sheen/);
  assert.match(closed, /rig-sil/);

  const cut = vesselShell(CAM, { r: 18, h: 42, neckR: 6, neckH: 10, shoulderH: 8, wall: 2, cutaway: true });
  assertValidSvg("vesselShell cutaway", cut);
  assert.match(cut, /rig-vessel-cutaway/);
  assert.match(cut, /rig-solid rig-m-glass/);
  assert.match(cut, /rig-face rig-wall/);
  assert.match(cut, /rig-face rig-cap/);
  assert.match(cut, /rig-cut-edge/);
  assert.match(cut, /rig-glass-sheen/);
  // Cutaway uses face-by-face sorting so multiple silhouettes are emitted turn by turn
  assert.ok((cut.match(/class="rig-sil"/g) ?? []).length > 3, "cutaway emits face-sorted silhouettes");

  const woodCup = vesselShell(CAM, { r: 14, h: 24, shoulderH: 0, neckH: 0, neckR: 14, material: "wood", cutaway: true });
  assertValidSvg("vesselShell wood cutaway", woodCup);
  assert.match(woodCup, /rig-m-wood/);
  assert.doesNotMatch(woodCup, /rig-glass-sheen/);
});

test("objects: liquidColumn returns empty at h <= 0.1 and shaded amber solid at h > 0.1", () => {
  assert.equal(liquidColumn(CAM, { r: 15, h: 0 }), "");
  assert.equal(liquidColumn(CAM, { r: 15, h: 0.08 }), "");
  assert.equal(liquidColumn(CAM, { r: 15, h: -2 }), "");

  const full = liquidColumn(CAM, { r: 15, h: 26, z0: 2 });
  assertValidSvg("liquidColumn", full);
  assert.match(full, /rig-solid rig-m-liquid/);
  assert.match(full, /rig-face rig-cap/);
  assert.match(full, /rig-face rig-wall/);
});

test("objects: dipTube and plungerNozzle render valid 3D solids", () => {
  assert.equal(dipTube(CAM, { r: 1.4, z0: 5, z1: 5 }), "");
  const tube = dipTube(CAM, { r: 1.4, z0: 2, z1: 48, offset: [1, -0.5] });
  assertValidSvg("dipTube", tube);
  assert.match(tube, /rig-solid rig-m-glass/);

  const nozzle = plungerNozzle(CAM, { r: 7, h: 11, spoutLen: 5, spoutDir: [1, 0] });
  assertValidSvg("plungerNozzle", nozzle);
  assert.match(nozzle, /rig-solid rig-m-alloy/);
  assert.match(nozzle, /rig-solid rig-m-rubber/);

  // Opposite spout direction (away from camera) also renders cleanly without NaN
  const nozzleBack = plungerNozzle(CAM, { r: 7, h: 11, spoutDir: [0, 1], material: "steel" });
  assertValidSvg("plungerNozzle back", nozzleBack);
  assert.match(nozzleBack, /rig-m-steel/);
});

test("objects: sprayCone is deterministic and returns empty at zero intensity or tiny length", () => {
  assert.equal(sprayCone(CAM, { origin: [10, 0, 50], dir: [1, 0, 0], length: 30, intensity: 0 }), "");
  assert.equal(sprayCone(CAM, { origin: [10, 0, 50], dir: [1, 0, 0], length: 30, intensity: 0.005 }), "");
  assert.equal(sprayCone(CAM, { origin: [10, 0, 50], dir: [1, 0, 0], length: 0.4, intensity: 1 }), "");

  const opts = { origin: [10, 0, 50] as const, dir: [1, 0, 0.1] as const, length: 36, spreadDeg: 26, intensity: 0.85, seed: 42, droplets: 24 };
  const a = sprayCone(CAM, opts);
  const b = sprayCone(CAM, opts);
  assertValidSvg("sprayCone", a);
  assert.equal(a, b, "identical inputs produce byte-identical SVG");
  assert.match(a, /class="rig-spray-cone"/);
  assert.match(a, /class="rig-spray-drop"/);
  assert.equal((a.match(/class="rig-spray-drop"/g) ?? []).length, Math.round(24 * 0.85));

  const c = sprayCone(CAM, { ...opts, seed: 99 });
  assert.notEqual(a, c, "different seeds change droplet layout");
});

test("objects: watchCaseDial defaults to lugless 240-deg exhibition skeleton cutaway, supports chamfered lugs and calibrePlate", () => {
  // New sleek defaults: lugs=false, cutaway=true, sapphire sheen
  const defaultWatch = watchCaseDial(CAM, { r: 22, h: 8 });
  assertValidSvg("watchCaseDial default", defaultWatch);
  assert.match(defaultWatch, /rig-solid rig-m-steel/);
  assert.match(defaultWatch, /rig-solid rig-m-ceramic/);
  assert.match(defaultWatch, /rig-solid rig-m-frame/, "default cutaway reveals movement cavity");
  assert.match(defaultWatch, /rig-dial-tick/);
  assert.match(defaultWatch, /rig-dial-tick is-major/);
  assert.match(defaultWatch, /rig-glass-sheen/, "includes sapphire crystal sheen");

  // Default (lugs: false) emits fewer steel solids than lugs: true (4 chamfered lugs + crown)
  const withLugs = watchCaseDial(CAM, { r: 22, h: 8, lugs: true, cutaway: true });
  assertValidSvg("watchCaseDial with lugs", withLugs);
  const defaultSteelCount = (defaultWatch.match(/rig-solid rig-m-steel/g) ?? []).length;
  const lugsSteelCount = (withLugs.match(/rig-solid rig-m-steel/g) ?? []).length;
  assert.equal(lugsSteelCount, defaultSteelCount + 5, "lugs: true adds 4 tapered chamfered lugs + winding crown");
  assert.match(withLugs, /rig-bevel/, "tapered lugs use chamferPlate bevels");

  // Backward-compatible explicit solid dial
  const solidWatch = watchCaseDial(CAM, { r: 22, h: 8, lugs: true, cutaway: false });
  assertValidSvg("watchCaseDial solid", solidWatch);
  assert.match(solidWatch, /rig-solid rig-m-steel/);
  assert.match(solidWatch, /rig-solid rig-m-ceramic/);
  assert.doesNotMatch(solidWatch, /rig-solid rig-m-frame/, "cutaway: false keeps dial closed");

  const openWatch = watchCaseDial(CAM, { r: 22, h: 8, lugs: true, cutaway: true, bezelMaterial: "brass", dialMaterial: "ceramic" });
  assertValidSvg("watchCaseDial cutaway", openWatch);
  assert.match(openWatch, /rig-solid rig-m-brass/);
  assert.match(openWatch, /rig-solid rig-m-frame/);

  // Sculpted watch movement mainplate with pockets, ruby jewels, and slotted steel screws
  const plateSvg = calibrePlate(CAM, {
    r: 18,
    h: 2.2,
    z: 1,
    pockets: [
      { x: -6, y: 4, r: 6.5, depth: 0.9 },
      { x: 6.5, y: -4.5, r: 4.8 },
    ],
    jewels: [
      { x: 0, y: 0, r: 1.4 },
      { x: 6.5, y: -4.5, r: 1.1 },
    ],
    screws: [
      { x: -12, y: -8, r: 1.3 },
      { x: 11, y: 9, r: 1.3 },
    ],
  });
  assertValidSvg("calibrePlate", plateSvg);
  assert.match(plateSvg, /class="rig-calibre-plate"/);
  assert.match(plateSvg, /rig-solid rig-m-rhodium/);
  assert.match(plateSvg, /class="rig-calibre-pocket"/);
  assert.match(plateSvg, /rig-solid rig-m-graphite/);
  assert.match(plateSvg, /class="rig-calibre-jewel"/);
  assert.match(plateSvg, /rig-solid rig-m-ruby/);
  assert.match(plateSvg, /rig-solid rig-m-brass/);
  assert.match(plateSvg, /class="rig-calibre-screw"/);
  assert.match(plateSvg, /rig-solid rig-m-steel/);

  const hand = watchHand(CAM, { len: 14, width: 1.6, tail: 3.5, z: 6.5 });
  assertValidSvg("watchHand", hand);
  assert.match(hand, /rig-solid rig-m-blued/);

  const spring = coiledSpring(CAM, { rInner: 2.5, rOuter: 10.5, turns: 4.5, z: 3.2 });
  assertValidSvg("coiledSpring", spring);
  assert.match(spring, /rig-solid rig-m-blued/);
  assert.match(spring, /rig-face rig-wall/);
  assert.match(spring, /rig-face rig-cap/);
  assert.equal(coiledSpring(CAM, { rInner: 10, rOuter: 5, turns: 3 }), "");
});

test("objects: explainerCard and meterBar render escaped studio annotations in screen space", () => {
  const card = explainerCard(CAM, {
    at: [30, 0, 25],
    title: "Press & Spray <1>",
    rows: ["Air pressure > ambient", "Mist & droplets form"],
    badge: "ACTIVE",
    tone: "hot",
  });
  assertValidSvg("explainerCard", card);
  assert.match(card, /class="rig-explainer" data-tone="hot"/);
  assert.match(card, /class="rig-explainer-bg"/);
  assert.match(card, /class="rig-explainer-title"/);
  assert.match(card, /class="rig-explainer-badge"/);
  assert.match(card, /Press &amp; Spray &lt;1&gt;/);
  assert.match(card, /Air pressure &gt; ambient/);
  assert.match(card, /Mist &amp; droplets form/);
  assert.equal((card.match(/class="rig-explainer-row"/g) ?? []).length, 2);

  const meter = meterBar(CAM, {
    at: [-20, 0, 10],
    w: 28,
    h: 3.2,
    fraction: 0.72,
    label: "Reservoir & Level",
    valueText: "72%",
    tone: "good",
  });
  assertValidSvg("meterBar", meter);
  assert.match(meter, /class="rig-meter" data-tone="good"/);
  assert.match(meter, /class="rig-meter-track"/);
  assert.match(meter, /class="rig-meter-fill"/);
  assert.match(meter, /Reservoir &amp; Level/);
  assert.match(meter, /72%/);

  // Clamping edge cases: 0 omits fill rect, >1 clamps to full width, NaN clamps to 0
  const emptyMeter = meterBar(CAM, { at: [0, 0, 0], w: 20, fraction: -0.5, label: "Empty" });
  assertValidSvg("meterBar empty", emptyMeter);
  assert.doesNotMatch(emptyMeter, /class="rig-meter-fill"/);

  const overMeter = meterBar(CAM, { at: [0, 0, 0], w: 20, fraction: 1.8, label: "Over", tone: "bad" });
  const trackW = overMeter.match(/class="rig-meter-track"[^>]*width="([^"]+)"/)![1];
  const fillW = overMeter.match(/class="rig-meter-fill"[^>]*width="([^"]+)"/)![1];
  assert.equal(fillW, trackW, "fraction > 1 clamps fill width to track width");
});

test("objects: axialHousing renders cutaway, hatched, solid, and tapered horizontal casings cleanly", () => {
  const cut = axialHousing(CAM, { length: 64, rOuter: 18, rInner: 15.2 });
  assertValidSvg("axialHousing cutaway default", cut);
  assert.match(cut, /class="rig-axial-housing rig-axial-housing-cutaway"/);
  assert.match(cut, /rig-solid rig-m-steel/);
  assert.match(cut, /rig-face rig-wall/);
  assert.match(cut, /rig-face rig-cap/);
  assert.match(cut, /class="rig-hatch"/);
  assert.ok((cut.match(/class="rig-sil"/g) ?? []).length > 3, "cutaway housing uses face-sorted silhouettes");

  const noHatch = axialHousing(CAM, { length: 50, rOuter: 16, cutaway: true, hatch: false });
  assertValidSvg("axialHousing no hatch", noHatch);
  assert.doesNotMatch(noHatch, /class="rig-hatch"/);

  const solid = axialHousing(CAM, { length: 50, rOuter: 16, cutaway: false, material: "alu", finish: "satin" });
  assertValidSvg("axialHousing solid", solid);
  assert.match(solid, /class="rig-axial-housing"/);
  assert.doesNotMatch(solid, /rig-axial-housing-cutaway/);
  assert.doesNotMatch(solid, /class="rig-hatch"/);
  assert.match(solid, /rig-solid rig-m-alu/);

  const tapered = axialHousing(CAM, {
    length: 56,
    rOuter: 20,
    rInner: 17,
    rOuterEnd: 11.5,
    rInnerEnd: 9.5,
    x0: -20,
    cutaway: true,
    hatch: true,
    material: "alloy",
    finish: "metal",
    segments: 24,
  });
  assertValidSvg("axialHousing tapered nozzle", tapered);
  assert.match(tapered, /rig-solid rig-m-alloy/);
  assert.match(tapered, /class="rig-hatch"/);

  const vertical = axialHousing(CAM, { length: 30, rOuter: 12, axis: [0, 0, 1], origin: [0, 0, 15] });
  assertValidSvg("axialHousing vertical axis", vertical);
});

test("objects: turbineRotor renders depth-sorted 3D blades, hub, optional spinner nose cone, and rotation", () => {
  const plain = turbineRotor(CAM, { rHub: 5, rTip: 17, blades: 14 });
  assertValidSvg("turbineRotor plain", plain);
  assert.match(plain, /class="rig-turbine-rotor"/);
  assert.match(plain, /rig-solid rig-m-steel/);
  assert.match(plain, /rig-solid rig-m-subject/);
  assert.equal((plain.match(/rig-solid rig-m-steel/g) ?? []).length, 14, "emits one 3D solid per blade");
  assert.equal((plain.match(/rig-solid rig-m-subject/g) ?? []).length, 1, "emits hub solid without nose cone");

  const withNose = turbineRotor(CAM, {
    origin: [-18, 0, 0],
    axis: [1, 0, 0],
    rHub: 5.5,
    rTip: 18,
    blades: 16,
    twistDeg: 32,
    noseLen: 9,
    rotRad: 0.25,
    material: "alloy",
    hubMaterial: "cobalt",
  });
  assertValidSvg("turbineRotor with nose", withNose);
  assert.equal((withNose.match(/rig-solid rig-m-alloy/g) ?? []).length, 16);
  assert.equal((withNose.match(/rig-solid rig-m-cobalt/g) ?? []).length, 2, "noseLen > 0 adds aerodynamic spinner cone");

  const rotated = turbineRotor(CAM, { rHub: 5, rTip: 17, blades: 14, rotRad: 0.35 });
  assertValidSvg("turbineRotor rotated", rotated);
  assert.notEqual(plain, rotated, "rotRad updates blade orientation");

  const zRotor = turbineRotor(CAM, { axis: [0, 0, 1], rHub: 4, rTip: 14, blades: 12, noseLen: 5 });
  assertValidSvg("turbineRotor Z axis", zRotor);
});

test("objects: pistonAssembly renders machined piston, compression rings, wrist pin, and optional connecting rod", () => {
  const bare = pistonAssembly(CAM, { r: 12, z0: 4 });
  assertValidSvg("pistonAssembly bare", bare);
  assert.match(bare, /class="rig-piston"/);
  assert.match(bare, /rig-solid rig-m-alu/);
  assert.match(bare, /rig-solid rig-m-graphite/);
  assert.match(bare, /class="rig-piston-pin"/);
  assert.match(bare, /rig-solid rig-m-steel/);
  assert.doesNotMatch(bare, /class="rig-piston-rod"/);

  const withRod = pistonAssembly(CAM, {
    r: 12,
    height: 15,
    z0: 10,
    rodLen: 24,
    material: "alloy",
    ringMaterial: "rubber",
  });
  assertValidSvg("pistonAssembly with rod", withRod);
  assert.match(withRod, /class="rig-piston-rod"/);
  assert.match(withRod, /rig-solid rig-m-alloy/);
  assert.match(withRod, /rig-solid rig-m-rubber/);
  assert.match(withRod, /rig-bevel/, "connecting rod shank uses chamfered bevels");
});

test("objects: helicalCoil renders 3D helical tubes along Z and X axes and guards invalid geometry", () => {
  assert.equal(helicalCoil(CAM, { r: 0, height: 20, turns: 5 }), "");
  assert.equal(helicalCoil(CAM, { r: 8, height: 0, turns: 5 }), "");
  assert.equal(helicalCoil(CAM, { r: 8, height: 20, turns: 0 }), "");

  const coilZ = helicalCoil(CAM, { r: 8, height: 28, turns: 5.5, z0: 2 });
  assertValidSvg("helicalCoil Z", coilZ);
  assert.match(coilZ, /class="rig-helical-coil"/);
  assert.match(coilZ, /rig-solid rig-m-steel/);
  assert.ok((coilZ.match(/class="rig-sil"/g) ?? []).length > 5, "helical coil uses face-by-face sorting");

  const coilX = helicalCoil(CAM, {
    r: 6.5,
    height: 32,
    turns: 6,
    wireR: 0.9,
    axis: [1, 0, 0],
    origin: [-16, 0, 4],
    material: "brass",
  });
  assertValidSvg("helicalCoil X", coilX);
  assert.match(coilX, /rig-solid rig-m-brass/);
});

test("objects: electrodeStack renders layered anode/separator/cathode plates with soft shadow", () => {
  const stack = electrodeStack(CAM, { w: 28, d: 20 });
  assertValidSvg("electrodeStack default", stack);
  assert.match(stack, /class="rig-electrode-stack"/);
  assert.match(stack, /class="rig-shadow"/);
  assert.match(stack, /class="rig-shadow-outer"/);
  assert.match(stack, /class="rig-shadow-inner"/);
  assert.equal((stack.match(/class="rig-electrode-layer"/g) ?? []).length, 5);
  assert.match(stack, /data-kind="anode"/);
  assert.match(stack, /data-kind="cathode"/);
  assert.match(stack, /data-kind="sep"/);
  assert.match(stack, /rig-solid rig-m-graphite/);
  assert.match(stack, /rig-solid rig-m-cobalt/);
  assert.match(stack, /rig-solid rig-m-ceramic/);

  const twoLayer = electrodeStack(CAM, {
    w: 22,
    d: 16,
    layerH: 4,
    gap: 2,
    layers: 2,
    origin: [5, -3, 2],
    anodeMaterial: "obsidian",
    cathodeMaterial: "teal",
  });
  assertValidSvg("electrodeStack 2-layer", twoLayer);
  assert.equal((twoLayer.match(/class="rig-electrode-layer"/g) ?? []).length, 2);
  assert.match(twoLayer, /rig-solid rig-m-obsidian/);
  assert.match(twoLayer, /rig-solid rig-m-teal/);
});

test("objects: flowArrow3D projects smooth 3D curves across all tones and dashed mode", () => {
  assert.equal(flowArrow3D(CAM, { points: [] }), "");
  assert.equal(flowArrow3D(CAM, { points: [[0, 0, 0]] }), "");
  assert.equal(flowArrow3D(CAM, { points: [[1, 2, 3], [1, 2, 3]] }), "");

  const tones = ["subject", "cool", "good", "bad", "neutral"] as const;
  for (const tone of tones) {
    const svg = flowArrow3D(CAM, {
      points: [
        [-24, 0, 6],
        [-8, -6, 12],
        [10, 4, 14],
        [26, 0, 8],
      ],
      tone,
      width: 2.8,
    });
    assertValidSvg(`flowArrow3D ${tone}`, svg);
    assert.match(svg, new RegExp(`class="rig-flow-arrow" data-tone="${tone}"`));
    assert.match(svg, /class="rig-arrow-halo"/);
    assert.match(svg, /class="rig-arrow-line"/);
    assert.match(svg, /class="rig-arrow-head"/);
    assert.doesNotMatch(svg, /stroke-dasharray/);
  }

  const dashed = flowArrow3D(CAM, {
    points: [
      [-15, 0, 0],
      [15, 0, 12],
    ],
    tone: "cool",
    width: 3.2,
    headSize: 14,
    dashed: true,
  });
  assertValidSvg("flowArrow3D dashed", dashed);
  assert.match(dashed, /class="rig-flow-arrow is-dashed" data-tone="cool"/);
  assert.match(dashed, /stroke-dasharray:/);
});
