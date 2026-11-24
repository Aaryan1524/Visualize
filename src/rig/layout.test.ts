import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertNoCollisions,
  checkCavityFill,
  composeExplodedLayers,
  layoutFlowSpine,
  solveGearTrain,
} from "./layout.ts";

const approx = (a: number, b: number, tol = 1e-6, msg?: string) => {
  assert.ok(Math.abs(a - b) <= tol, msg ?? `expected ${a} ≈ ${b} (tol ${tol})`);
};

test("layout: solveGearTrain solves a 5-wheel compound watch gear train with exact tangency, ratios, signs, and zero collisions", () => {
  // Classical 5-wheel mechanical watch going train:
  // 1) Barrel (60T, m=0.25) -> Center pinion (10T, m=0.25, layer 0)
  // 2) Center wheel (48T, m=0.20, coaxial with center pinion, layer 1) -> Third pinion (8T, m=0.20, layer 1)
  // 3) Third wheel (45T, m=0.18, coaxial with third pinion, layer 2) -> Fourth pinion (9T, m=0.18, layer 2)
  // 4) Fourth wheel (40T, m=0.15, coaxial with fourth pinion, layer 3) -> Escape pinion (8T, m=0.15, layer 3)
  // 5) Escape wheel (15T, m=0.15, coaxial with escape pinion, layer 4)
  const train = solveGearTrain([
    { name: "barrel", teeth: 60, module: 0.25, layer: 0, z: 0 },
    { name: "centerPinion", teeth: 10, module: 0.25, driver: "barrel", angleDeg: 0, layer: 0, z: 0 },
    { name: "centerWheel", teeth: 48, module: 0.2, coaxialWith: "centerPinion", layer: 1, z: 1.4 },
    { name: "thirdPinion", teeth: 8, module: 0.2, driver: "centerWheel", angleDeg: 65, layer: 1, z: 1.4 },
    { name: "thirdWheel", teeth: 45, module: 0.18, coaxialWith: "thirdPinion", layer: 2, z: 2.8 },
    { name: "fourthPinion", teeth: 9, module: 0.18, driver: "thirdWheel", angleDeg: 145, layer: 2, z: 2.8 },
    { name: "fourthWheel", teeth: 40, module: 0.15, coaxialWith: "fourthPinion", layer: 3, z: 4.2 },
    { name: "escapePinion", teeth: 8, module: 0.15, driver: "fourthWheel", angleDeg: 225, layer: 3, z: 4.2 },
    { name: "escapeWheel", teeth: 15, module: 0.15, coaxialWith: "escapePinion", layer: 4, z: 5.6 },
  ]);

  assert.equal(train.list.length, 9);
  const g = train.byName;

  // Verify exact pitch tangency for every meshed pair
  const meshedPairs: [string, string][] = [
    ["barrel", "centerPinion"],
    ["centerWheel", "thirdPinion"],
    ["thirdWheel", "fourthPinion"],
    ["fourthWheel", "escapePinion"],
  ];
  for (const [drvName, drivenName] of meshedPairs) {
    const a = g[drvName]!;
    const b = g[drivenName]!;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    approx(dist, a.pitchR + b.pitchR, 1e-9, `${drvName}-${drivenName} pitch tangency`);
  }

  // Verify coaxial arbors share exact (x, y), ratio, and spin sign
  const coaxialPairs: [string, string][] = [
    ["centerPinion", "centerWheel"],
    ["thirdPinion", "thirdWheel"],
    ["fourthPinion", "fourthWheel"],
    ["escapePinion", "escapeWheel"],
  ];
  for (const [hostName, riderName] of coaxialPairs) {
    const h = g[hostName]!;
    const r = g[riderName]!;
    assert.equal(r.x, h.x);
    assert.equal(r.y, h.y);
    assert.equal(r.ratioToRoot, h.ratioToRoot);
    assert.equal(r.omegaSign, h.omegaSign);
  }

  // Verify compound gear ratios and alternating spin signs:
  // barrel: 1 (+1)
  // center: 60/10 = 6 (-1)
  // third: 6 * 48/8 = 36 (+1)
  // fourth: 36 * 45/9 = 180 (-1)
  // escape: 180 * 40/8 = 900 (+1)
  approx(g.barrel!.ratioToRoot, 1);
  assert.equal(g.barrel!.omegaSign, 1);
  approx(g.centerWheel!.ratioToRoot, 6);
  assert.equal(g.centerWheel!.omegaSign, -1);
  approx(g.thirdWheel!.ratioToRoot, 36);
  assert.equal(g.thirdWheel!.omegaSign, 1);
  approx(g.fourthWheel!.ratioToRoot, 180);
  assert.equal(g.fourthWheel!.omegaSign, -1);
  approx(g.escapeWheel!.ratioToRoot, 900);
  assert.equal(g.escapeWheel!.omegaSign, 1);

  // Bounds encompass every gear outer radius
  for (const item of train.list) {
    assert.ok(item.x - item.outerR >= train.bounds.minX - 1e-9);
    assert.ok(item.x + item.outerR <= train.bounds.maxX + 1e-9);
    assert.ok(item.y - item.outerR >= train.bounds.minY - 1e-9);
    assert.ok(item.y + item.outerR <= train.bounds.maxY + 1e-9);
    assert.ok(Math.hypot(item.x, item.y) + item.outerR <= train.bounds.rBound + 1e-9);
  }
});

test("layout: solveGearTrain catches planted collisions and module mismatches", () => {
  // Planted fault 1: non-meshed wheels folding back on the same layer collide
  assert.throws(
    () =>
      solveGearTrain([
        { name: "driverA", teeth: 40, module: 0.5, layer: 0 },
        { name: "idlerB", teeth: 20, module: 0.5, driver: "driverA", angleDeg: 0, layer: 0 },
        // Folding back at 170° slams wheelC straight into driverA on the same layer!
        { name: "wheelC", teeth: 36, module: 0.5, driver: "idlerB", angleDeg: 170, layer: 0 },
      ]),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Collision on layer 0/);
      assert.match(err.message, /"driverA"/);
      assert.match(err.message, /"wheelC"/);
      assert.match(err.message, /overlap/);
      return true;
    },
  );

  // Planted fault 2: mismatched modules throw RangeError
  assert.throws(
    () =>
      solveGearTrain([
        { name: "wheelA", teeth: 40, module: 0.5 },
        { name: "pinionB", teeth: 10, module: 0.4, driver: "wheelA", angleDeg: 30 },
      ]),
    (err: unknown) => {
      assert.ok(err instanceof RangeError);
      assert.match(err.message, /Module mismatch/);
      return true;
    },
  );
});

test("layout: assertNoCollisions respects layers, minGap, and ignorePairs", () => {
  // Same layer overlapping -> throws with names
  assert.throws(
    () =>
      assertNoCollisions([
        { name: "alpha", x: 0, y: 0, r: 5, layer: 1 },
        { name: "beta", x: 8, y: 0, r: 5, layer: 1 },
      ]),
    /Collision on layer 1 between "alpha" and "beta"/,
  );

  // Different layers -> allowed
  assert.doesNotThrow(() =>
    assertNoCollisions([
      { name: "alpha", x: 0, y: 0, r: 5, layer: 0 },
      { name: "beta", x: 2, y: 0, r: 5, layer: 1 },
    ]),
  );

  // Ignored pair -> allowed
  assert.doesNotThrow(() =>
    assertNoCollisions(
      [
        { name: "alpha", x: 0, y: 0, r: 5 },
        { name: "beta", x: 8, y: 0, r: 5 },
      ],
      { ignorePairs: [["beta", "alpha"]] },
    ),
  );

  // minGap enforced
  assert.throws(
    () =>
      assertNoCollisions(
        [
          { name: "a", x: 0, y: 0, r: 4 },
          { name: "b", x: 8.5, y: 0, r: 4 },
        ],
        { minGap: 1.0 },
      ),
    /overlap 0\.500/,
  );
});

test("layout: checkCavityFill catches empty ashtray layouts and passes well-proportioned movements", () => {
  // Defect: giant cavity (R = 30) with 3 tiny floating discs (r = 3) -> ratio = 3*9/900 = 0.03 < 0.25
  const ashtray = checkCavityFill(30, [
    { x: -10, y: 0, r: 3 },
    { x: 0, y: 5, r: 3 },
    { x: 10, y: -4, r: 3 },
  ]);
  assert.equal(ashtray.ok, false);
  assert.equal(ashtray.outside, 0);
  approx(ashtray.ratio, 0.03, 1e-6);

  // Well-proportioned watch movement inside R = 20 cavity
  const watchMovement = checkCavityFill(20, [
    { x: -7, y: 5, r: 8 },
    { x: 7, y: 4, r: 7 },
    { x: 0, y: -8, r: 7.5 },
    { x: 0, y: 0, r: 4 },
  ]);
  assert.equal(watchMovement.ok, true);
  assert.equal(watchMovement.outside, 0);
  assert.ok(watchMovement.ratio >= 0.35 && watchMovement.ratio <= 0.6, `ratio ${watchMovement.ratio}`);

  // Part poking outside cavity is flagged even when area fill is high
  const pokingOut = checkCavityFill(10, [
    { x: 0, y: 0, r: 6 },
    { x: 7, y: 0, r: 5 }, // 7 + 5 = 12 > 10
  ]);
  assert.equal(pokingOut.outside, 1);
  assert.equal(pokingOut.ok, false);
});

test("layout: layoutFlowSpine produces monotonic zero-overlap stages and exact callout anchors on z and x axes", () => {
  const vertical = layoutFlowSpine(
    [
      { name: "reservoir", length: 24, r: 16, gap: 2 },
      { name: "pump", length: 12, r: 6, gap: 1 },
      { name: "nozzle", length: 8, r: 5 },
    ],
    { axis: "z", origin: [10, -5, 4] },
  );

  assert.equal(vertical.reservoir!.z0, 4);
  assert.equal(vertical.reservoir!.z1, 28);
  assert.deepEqual(vertical.reservoir!.mid, [10, -5, 16]);
  assert.deepEqual(vertical.reservoir!.anchorLeft, [-6, -5, 16]);
  assert.deepEqual(vertical.reservoir!.anchorRight, [26, -5, 16]);

  assert.equal(vertical.pump!.z0, 30);
  assert.equal(vertical.pump!.z1, 42);
  assert.ok(vertical.pump!.z0 >= vertical.reservoir!.z1);

  assert.equal(vertical.nozzle!.z0, 43);
  assert.equal(vertical.nozzle!.z1, 51);
  assert.deepEqual(vertical.nozzle!.anchorRight, [15, -5, 47]);

  const horizontal = layoutFlowSpine(
    [
      { name: "intake", length: 10, r: 4, gap: 3 },
      { name: "compressor", length: 14, r: 5 },
    ],
    { axis: "x", origin: [0, 2, 8] },
  );

  assert.equal(horizontal.intake!.z0, 0);
  assert.equal(horizontal.intake!.z1, 10);
  assert.deepEqual(horizontal.intake!.mid, [5, 2, 8]);
  assert.deepEqual(horizontal.intake!.anchorLeft, [5, -2, 8]);
  assert.deepEqual(horizontal.intake!.anchorRight, [5, 6, 8]);
  assert.equal(horizontal.compressor!.z0, 13);
  assert.equal(horizontal.compressor!.z1, 27);
  assert.deepEqual(horizontal.compressor!.mid, [20, 2, 8]);
});

test("layout: composeExplodedLayers keeps monotonic ascending elevations across explode 0..1", () => {
  const specs = [
    { name: "mainplate", thickness: 2, gap: 6 },
    { name: "train", thickness: 3, gap: 8 },
    { name: "bridge", thickness: 1.5, gap: 5 },
    { name: "dial", thickness: 1 },
  ];

  const assembled = composeExplodedLayers(specs, { baseZ: 2, explode: 0 });
  assert.equal(assembled.byName.mainplate!.z0, 2);
  assert.equal(assembled.byName.mainplate!.z1, 4);
  assert.equal(assembled.byName.train!.z0, 4);
  assert.equal(assembled.byName.train!.z1, 7);
  assert.equal(assembled.byName.bridge!.z0, 7);
  assert.equal(assembled.byName.bridge!.z1, 8.5);
  assert.equal(assembled.byName.dial!.z0, 8.5);
  assert.equal(assembled.byName.dial!.z1, 9.5);
  approx(assembled.totalHeight, 7.5);

  const half = composeExplodedLayers(specs, { baseZ: 2, explode: 0.5 });
  assert.equal(half.byName.train!.z0, 4 + 3);
  assert.equal(half.byName.bridge!.z0, 10 + 4);
  assert.equal(half.byName.dial!.z0, 15.5 + 2.5);
  approx(half.byName.dial!.midZ, 18.5);

  const exploded = composeExplodedLayers(specs, { baseZ: 2, explode: 1 });
  assert.equal(exploded.byName.mainplate!.z0, 2);
  assert.equal(exploded.byName.train!.z0, 10);
  assert.equal(exploded.byName.bridge!.z0, 21);
  assert.equal(exploded.byName.dial!.z0, 27.5);
  approx(exploded.totalHeight, 7.5 + 6 + 8 + 5);

  // Strict monotonic non-overlapping order for all layers
  const names = specs.map((s) => s.name);
  for (let i = 1; i < names.length; i++) {
    const prev = exploded.byName[names[i - 1]!]!;
    const curr = exploded.byName[names[i]!]!;
    assert.ok(curr.z0 > prev.z1, `${curr.name}.z0 (${curr.z0}) > ${prev.name}.z1 (${prev.z1})`);
  }

  // Rejects out-of-range explode
  assert.throws(() => composeExplodedLayers(specs, { explode: 1.5 }), RangeError);
  assert.throws(() => composeExplodedLayers(specs, { explode: -0.1 }), RangeError);
});
