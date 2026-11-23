import { test } from "node:test";
import assert from "node:assert/strict";
import type { Camera } from "./camera.ts";
import {
  coiledSpring,
  dipTube,
  explainerCard,
  liquidColumn,
  meterBar,
  OBJECT_VIEW,
  plungerNozzle,
  sprayCone,
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

test("objects: watchCaseDial, watchHand, and coiledSpring render horological 3D solids", () => {
  const solidWatch = watchCaseDial(CAM, { r: 22, h: 8, lugs: true, cutaway: false });
  assertValidSvg("watchCaseDial solid", solidWatch);
  assert.match(solidWatch, /rig-solid rig-m-steel/);
  assert.match(solidWatch, /rig-solid rig-m-ceramic/);
  assert.match(solidWatch, /rig-dial-tick/);
  assert.match(solidWatch, /rig-dial-tick is-major/);

  const openWatch = watchCaseDial(CAM, { r: 22, h: 8, lugs: true, cutaway: true, bezelMaterial: "brass", dialMaterial: "ceramic" });
  assertValidSvg("watchCaseDial cutaway", openWatch);
  assert.match(openWatch, /rig-solid rig-m-brass/);
  assert.match(openWatch, /rig-solid rig-m-frame/);

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
