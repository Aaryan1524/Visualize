import { test } from "node:test";
import assert from "node:assert/strict";
import { OBJECT_VIEW } from "./objects.ts";
import { CONCEPT_VIEW } from "./parts.ts";
import {
  SPREADS,
  distributeCallouts,
  renderHudStack,
  spread,
  type Box,
  type Rect,
  type SpreadKind,
} from "./spreads.ts";

const ALL_KINDS: SpreadKind[] = [
  "cutaway-vessel",
  "exploded-stack",
  "axial-cutaway",
  "linked-train",
  "concept-plate",
  "system-tiers",
];

const boxToRect = (b: Box): Rect => ({
  x0: b.x,
  y0: b.y,
  x1: b.x + b.w,
  y1: b.y + b.h,
});

const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

const isValidRect = (r: Rect, w = 14200, h = 6550): boolean =>
  r.x0 >= 0 && r.y0 >= 0 && r.x1 > r.x0 && r.y1 > r.y0 && r.x1 <= w && r.y1 <= h;

test("spreads: all 6 universal spreads exist with canonical 14200x6550 viewBoxes and studio views", () => {
  assert.deepEqual(Object.keys(SPREADS).sort(), [...ALL_KINDS].sort());

  assert.deepEqual(SPREADS["cutaway-vessel"].view, OBJECT_VIEW);
  assert.deepEqual(SPREADS["concept-plate"].view, CONCEPT_VIEW);
  assert.deepEqual(SPREADS["exploded-stack"].view, { azimuth: 236, elevation: 27 });
  assert.deepEqual(SPREADS["axial-cutaway"].view, { azimuth: 234, elevation: 22 });
  assert.deepEqual(SPREADS["linked-train"].view, { azimuth: 240, elevation: 28 });
  assert.deepEqual(SPREADS["system-tiers"].view, { azimuth: 235, elevation: 26 });

  // Horizontal axial-cutaway hero box is wider than vertical cutaway-vessel
  assert.ok(
    SPREADS["axial-cutaway"].box.w > SPREADS["cutaway-vessel"].box.w,
    "axial-cutaway should offer a wider horizontal hero box",
  );

  for (const kind of ALL_KINDS) {
    const s = SPREADS[kind];
    assert.equal(s.kind, kind);
    assert.ok(s.label.length > 0);
    assert.ok(s.description.length > 10);
    assert.deepEqual(s.viewBox, { w: 14200, h: 6550, str: "0 0 14200 6550" });
    assert.ok(s.fs >= 150 && s.fs <= 152, `${kind}: fs ${s.fs} must be 150..152`);
    assert.match(s.css, /\.label text\{font-size:15[02]px/);
    assert.match(s.css, /\.leader\{/);
    assert.match(s.css, /\.vz-step-heading\{text-shadow:/);
    assert.match(s.css, /\.vz\[data-practice\] \.vz-step-heading\{visibility:hidden\}/);
  }
});

test("spreads: mathematical zero-overlap invariants hold across all 6 spreads", () => {
  for (const kind of ALL_KINDS) {
    const s = SPREADS[kind];
    const boxRect = boxToRect(s.box);
    const { heading, hud, predict, lab } = s.safeZones;

    // Every rect sits cleanly inside 14200 x 6550
    for (const [name, rect] of [
      ["box", boxRect],
      ["clear", s.clear],
      ["predictClear", s.predictClear],
      ["cardClear", s.cardClear],
      ["heading", heading],
      ["hud", hud],
      ["predict", predict],
      ["lab", lab],
    ] as const) {
      assert.ok(isValidRect(rect), `${kind}.${name} must be a valid rect inside 14200x6550`);
    }

    // 1. Overview box vs heading, hud, predict
    assert.equal(rectsOverlap(boxRect, heading), false, `${kind}: box overlaps heading`);
    assert.equal(rectsOverlap(boxRect, hud), false, `${kind}: box overlaps hud`);
    assert.equal(rectsOverlap(boxRect, predict), false, `${kind}: box overlaps predict`);

    // 2. Zoomed clear vs heading, hud
    assert.equal(rectsOverlap(s.clear, heading), false, `${kind}: clear overlaps heading`);
    assert.equal(rectsOverlap(s.clear, hud), false, `${kind}: clear overlaps hud`);

    // 3. Predict-open clear vs heading, hud, predict
    assert.equal(rectsOverlap(s.predictClear, heading), false, `${kind}: predictClear overlaps heading`);
    assert.equal(rectsOverlap(s.predictClear, hud), false, `${kind}: predictClear overlaps hud`);
    assert.equal(rectsOverlap(s.predictClear, predict), false, `${kind}: predictClear overlaps predict`);

    // 4. Lab/Practice cardClear vs lab, hud
    assert.equal(rectsOverlap(s.cardClear, lab), false, `${kind}: cardClear overlaps lab`);
    assert.equal(rectsOverlap(s.cardClear, hud), false, `${kind}: cardClear overlaps hud`);

    // 5. HUD and Predict zones are vertically separated with room for right callouts
    assert.equal(rectsOverlap(hud, predict), false, `${kind}: hud overlaps predict`);
    assert.ok(predict.y0 - hud.y1 >= 1200, `${kind}: expected >=1200u gap between hud and predict`);

    // 6. HUD card & meters stay strictly inside safeZones.hud
    const cardW = s.hud.cardWidth * s.hud.cardCam.scale;
    assert.ok(s.hud.cardCam.origin[0] >= hud.x0, `${kind}: hud card left inside hud zone`);
    assert.ok(s.hud.cardCam.origin[0] + cardW <= hud.x1, `${kind}: hud card right inside hud zone`);
    assert.ok(s.hud.cardCam.origin[1] >= hud.y0, `${kind}: hud card top inside hud zone`);
    assert.equal(s.hud.meterCams.length, 2, `${kind}: provides 2 stacked meter cams`);
    for (const mc of s.hud.meterCams) {
      const mW = s.hud.meterWidth * mc.scale;
      assert.ok(mc.origin[0] >= hud.x0 && mc.origin[0] + mW <= hud.x1, `${kind}: meter x inside hud zone`);
      assert.ok(mc.origin[1] + 4.3 * mc.scale <= hud.y1, `${kind}: meter bottom inside hud zone`);
    }
  }
});

test("spread(): returns an isolated deep copy and throws RangeError on invalid kind", () => {
  const copy = spread("cutaway-vessel");
  assert.deepEqual(copy, SPREADS["cutaway-vessel"]);

  // Mutating nested fields on the copy must not mutate SPREADS
  copy.box.x = 9999;
  copy.safeZones.heading.x1 = 0;
  copy.hud.cardCam.origin[0] = 0;
  copy.hud.meterCams[0]!.origin[1] = 0;
  assert.equal(SPREADS["cutaway-vessel"].box.x, 3450);
  assert.equal(SPREADS["cutaway-vessel"].safeZones.heading.x1, 3220);
  assert.equal(SPREADS["cutaway-vessel"].hud.cardCam.origin[0], 9850);
  assert.equal(SPREADS["cutaway-vessel"].hud.meterCams[0]!.origin[1], 1960);

  assert.throws(
    () => spread("invalid" as SpreadKind),
    (err: unknown) =>
      err instanceof RangeError &&
      err.message.includes("invalid") &&
      ALL_KINDS.every((k) => err.message.includes(k)),
  );
});

test("distributeCallouts: maintains vertical spacing and keeps right-side callouts strictly between hud and predict", () => {
  for (const kind of ALL_KINDS) {
    const s = spread(kind);
    const distributed = distributeCallouts(s, [
      { id: "a", text: "Top cap", to: "cap" },
      { id: "b", text: "Chamber", to: "chamber", side: "left", beats: [0, 1] },
      { id: "c", text: "Gear train", to: "train", side: "right" },
      { id: "d", text: "Dip tube", to: "tube", side: "left" },
      { id: "e", text: "Escapement", to: "esc", side: "right", beats: [0, 2] },
      { id: "f", text: "Reservoir", to: "liq", side: "left" },
    ]);

    assert.equal(distributed.length, 6);
    // Preserves input order
    assert.deepEqual(
      distributed.map((d) => d.id),
      ["a", "b", "c", "d", "e", "f"],
    );

    const left = distributed.filter((d) => d.anchor === "end");
    const right = distributed.filter((d) => d.anchor === "start");
    assert.equal(left.length, 4);
    assert.equal(right.length, 2);

    // Left rail checks: aligned on rails.lx, strictly below heading, monotonic with generous vertical spacing
    for (let i = 0; i < left.length; i++) {
      const c = left[i]!;
      assert.equal(c.at[0], s.rails.lx);
      assert.ok(c.at[1] > s.safeZones.heading.y1 + s.fs, `${kind}: left callout clears heading`);
      assert.ok(c.at[1] <= s.rails.yMax, `${kind}: left callout inside yMax`);
      if (i > 0) {
        assert.ok(
          c.at[1] - left[i - 1]!.at[1] >= s.fs * 2,
          `${kind}: left callouts have generous vertical spacing`,
        );
      }
    }

    // Right rail checks: aligned on rails.rx, strictly below hud.y1 and above predict.y0
    for (let i = 0; i < right.length; i++) {
      const c = right[i]!;
      assert.equal(c.at[0], s.rails.rx);
      assert.ok(
        c.at[1] >= s.safeZones.hud.y1 + s.fs,
        `${kind}: right callout y=${c.at[1]} clears hud.y1=${s.safeZones.hud.y1}`,
      );
      assert.ok(
        c.at[1] <= s.safeZones.predict.y0 - s.fs,
        `${kind}: right callout y=${c.at[1]} clears predict.y0=${s.safeZones.predict.y0}`,
      );
      if (i > 0) {
        assert.ok(
          c.at[1] - right[i - 1]!.at[1] >= s.fs * 2,
          `${kind}: right callouts have generous vertical spacing`,
        );
      }
    }

    // Default beats [0] and preserved custom beats
    assert.deepEqual(distributed[0]!.beats, [0]);
    assert.deepEqual(distributed[1]!.beats, [0, 1]);
    assert.deepEqual(distributed[4]!.beats, [0, 2]);
  }

  // Single right callout centers cleanly in the hud..predict band; empty list returns empty
  const s = spread("exploded-stack");
  assert.deepEqual(distributeCallouts(s, []), []);
  const single = distributeCallouts(s, [{ id: "only", text: "Rotor", to: "rotor", side: "right" }]);
  assert.equal(single.length, 1);
  assert.ok(single[0]!.at[1] > s.safeZones.hud.y1 + s.fs);
  assert.ok(single[0]!.at[1] < s.safeZones.predict.y0 - s.fs);
});

test("renderHudStack: renders valid escaped SVG with explainerCard and up to 2 meterBars, zero NaN", () => {
  for (const kind of ALL_KINDS) {
    const s = spread(kind);
    const svg = renderHudStack(
      s,
      {
        title: "Pressure & Flow <1>",
        badge: "READY",
        tone: "good",
        rows: ["Chamber: 80% > threshold", "Valve: sealed & primed", "Mist: fine spray"],
      },
      [
        { label: "Bottle & fill", fraction: 0.78, valueText: "78% (39 ml)", tone: "good" },
        { label: "Pump chamber", fraction: 0.45, valueText: "45%", tone: "hot" },
        { label: "Ignored third meter", fraction: 0.99, valueText: "99%", tone: "bad" },
      ],
    );

    assert.ok(svg.length > 100, `${kind}: non-empty HUD SVG`);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `${kind}: HUD SVG contains no invalid tokens`);
    assert.match(svg, /class="rig-explainer" data-tone="good"/);
    assert.match(svg, /class="rig-explainer-bg"/);
    assert.match(svg, /Pressure &amp; Flow &lt;1&gt;/);
    assert.match(svg, /Chamber: 80% &gt; threshold/);
    assert.match(svg, /Bottle &amp; fill/);
    assert.equal((svg.match(/class="rig-meter-track"/g) ?? []).length, 2, `${kind}: caps stacked meters at 2`);
    assert.doesNotMatch(svg, /Ignored third meter/);
  }

  // Card-only call (no meters) still renders cleanly
  const cardOnly = renderHudStack(spread("concept-plate"), {
    title: "Hash Lookup",
    rows: ["k = 3 hash probes"],
  });
  assert.doesNotMatch(cardOnly, /NaN|undefined|Infinity/);
  assert.match(cardOnly, /class="rig-explainer-bg"/);
  assert.doesNotMatch(cardOnly, /class="rig-meter-track"/);
});
