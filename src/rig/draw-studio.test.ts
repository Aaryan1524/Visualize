import { test } from "node:test";
import assert from "node:assert/strict";
import { axesOf, screenOf, type Camera } from "./camera.ts";
import { cutawayHatch, drawMesh, keyLight, rimLight, softShadow, studioShade, type Finish } from "./draw.ts";
import { chamferPlate, circlePoints, planeOf, plate, pointOn, rod, roundedRect } from "./shapes.ts";
import { add, dot, scale, unit, type P2, type V3 } from "./vec.ts";

const pointInPoly = (p: P2, poly: readonly P2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
};

test("studioShade: lit faces are strictly brighter than shadowed faces, respects finish, stays in [0.12, 1]", () => {
  const ax = axesOf(225, 26);
  const L = keyLight(ax);
  const R = rimLight(ax);
  const half = unit(add(L, ax.toward));
  const away = scale(L, -1);
  const darkCore = unit(add(scale(L, -1), scale(R, -1)));
  const finishes: Finish[] = ["metal", "satin", "glass", "matte"];

  // rim light comes from lower-right-behind relative to camera axes
  assert.ok(dot(R, ax.right) > 0.7 && dot(R, ax.up) < 0 && dot(R, ax.toward) < 0);

  for (const finish of finishes) {
    const lit = studioShade(L, L, R, ax.toward, finish);
    const shadowed = studioShade(away, L, R, ax.toward, finish);
    const core = studioShade(darkCore, L, R, ax.toward, finish);
    const spec = studioShade(half, L, R, ax.toward, finish);
    assert.ok(lit > shadowed, `${finish}: lit (${lit}) > shadowed (${shadowed})`);
    assert.ok(spec > shadowed, `${finish}: spec (${spec}) > shadowed (${shadowed})`);
    for (const s of [lit, shadowed, core, spec]) {
      assert.ok(s >= 0.12 && s <= 1, `${finish}: shade ${s} in [0.12, 1]`);
    }
  }

  // specular peak on metal and glass strictly exceeds matte
  const metalPeak = studioShade(half, L, R, ax.toward, "metal");
  const glassPeak = studioShade(half, L, R, ax.toward, "glass");
  const satinPeak = studioShade(half, L, R, ax.toward, "satin");
  const mattePeak = studioShade(half, L, R, ax.toward, "matte");
  assert.ok(metalPeak > mattePeak, `metal peak (${metalPeak}) > matte (${mattePeak})`);
  assert.ok(glassPeak > mattePeak, `glass peak (${glassPeak}) > matte (${mattePeak})`);
  assert.ok(satinPeak > mattePeak, `satin peak (${satinPeak}) > matte (${mattePeak})`);

  // rim bounce gives shadow-side walls subtle lift over deep core shadow without washing out cap contrast
  const topCap = studioShade([0, 0, 1], L, R, ax.toward, "satin");
  const rimSide = studioShade(R, L, R, ax.toward, "satin");
  const coreShadow = studioShade(darkCore, L, R, ax.toward, "satin");
  assert.ok(rimSide > coreShadow, "rim light lifts shadow-side bounce");
  assert.ok(topCap - rimSide > 0.5, `strong cap-vs-wall separation preserved (${(topCap - rimSide).toFixed(3)})`);
});

test("drawMesh: metal and glass finishes render crisp valid SVG with specular and rim highlights and zero NaN", () => {
  const cam: Camera = { azimuth: 225, elevation: 26, scale: 20, origin: [600, 450] };
  const shaft = rod([0, 0, 0], [18, -18, 0], 8, 36);
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const block = chamferPlate(pl, roundedRect(28, 18, 4), 0, 10, 1.4);

  for (const [mesh, look] of [
    [shaft, { material: "steel", finish: "metal" as const }],
    [shaft, { material: "glass", finish: "glass" as const }],
    [block, { material: "brass", finish: "metal" as const, shine: true }],
    [block, { material: "glass" }],
    [block, { material: "frame", finish: "matte" as const }],
  ] as const) {
    const svg = drawMesh(mesh, cam, look);
    assert.ok(svg.startsWith("<g ") && svg.endsWith("</g>"));
    assert.ok(!svg.includes("NaN") && !svg.includes("undefined"));
    assert.match(svg, /class="rig-face /);
    assert.match(svg, /class="rig-sil"/);
  }

  const metalShaft = drawMesh(shaft, cam, { material: "steel", finish: "metal" });
  assert.match(metalShaft, /class="rig-shine"/, "metallic shaft gets primary specular highlight");

  const metalBlock = drawMesh(block, cam, { material: "brass", finish: "metal" });
  assert.match(metalBlock, /class="rig-shine"/, "metallic chamfered block gets primary specular highlight");
  assert.match(metalBlock, /class="rig-rim-shine"/, "metallic chamfered block gets grazing rim highlight");

  const glassBlock = drawMesh(block, cam, { material: "glass", finish: "glass" });
  assert.match(glassBlock, /class="rig-shine"/, "glass chamfered block gets primary specular highlight");
  assert.match(glassBlock, /class="rig-rim-shine"/, "glass chamfered block gets grazing rim highlight");

  const matteBlock = drawMesh(block, cam, { material: "frame", finish: "matte" });
  assert.ok(!matteBlock.includes("rig-shine") && !matteBlock.includes("rig-rim-shine"), "matte finish emits no glossy highlights");
});

test("softShadow: emits layered rig-shadow-outer and rig-shadow-inner paths with zero NaN", () => {
  const cam: Camera = { azimuth: 230, elevation: 26, scale: 15, origin: [500, 400] };
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const disc = plate(pl, { outer: circlePoints(16, 28) }, 0, 4);
  const svg = softShadow(disc, cam, [1.2, -0.8, -2]);

  assert.ok(!svg.includes("NaN") && !svg.includes("undefined"));
  assert.match(svg, /class="rig-shadow"/);
  assert.match(svg, /class="rig-shadow-outer"/);
  assert.match(svg, /class="rig-shadow-inner"/);

  // outer penumbra path should span wider than inner contact shadow
  const outerD = svg.match(/class="rig-shadow-outer" d="([^"]+)"/)![1]!;
  const innerD = svg.match(/class="rig-shadow-inner" d="([^"]+)"/)![1]!;
  const bbox = (d: string) => {
    const pts = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as P2);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const ob = bbox(outerD), ib = bbox(innerD);
  assert.ok(ob.w > ib.w && ob.h > ib.h, `outer (${ob.w.toFixed(1)}x${ob.h.toFixed(1)}) wider than inner (${ib.w.toFixed(1)}x${ib.h.toFixed(1)})`);

  // empty mesh returns ""
  assert.equal(softShadow({ verts: [], faces: [] }, cam, [0, 0, -1]), "");
});

test("cutawayHatch: clips 45-degree hatch lines cleanly inside rectangles and concave L-shapes, rejects degenerate outlines", () => {
  // top-down camera looking straight along -z onto xy plane so screen coords map directly to plane coords
  const cam: Camera = { azimuth: 90, elevation: 90, scale: 10, origin: [0, 0] };
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);

  const parseSegments = (svg: string): [P2, P2][] => {
    const d = svg.match(/class="rig-hatch" d="([^"]+)"/)?.[1] ?? "";
    return [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
      [Number(m[1]), Number(m[2])],
      [Number(m[3]), Number(m[4])],
    ]);
  };

  // Helper: map plane outline to screen coordinates for exact containment verification
  const toScreen = (poly: readonly P2[]): P2[] => poly.map(([a, b]) => screenOf(cam, pointOn(pl, a, b, 0)));

  // 1. Rectangle
  const rect: P2[] = [[0, 0], [20, 0], [20, 12], [0, 12]];
  const rectSvg = cutawayHatch(cam, pl, rect, 2.4);
  assert.ok(!rectSvg.includes("NaN") && !rectSvg.includes("undefined"));
  assert.match(rectSvg, /^<path class="rig-hatch" d="[^"]+"\/>$/);
  const rectSegs = parseSegments(rectSvg);
  assert.ok(rectSegs.length >= 6, `rectangle produces multiple hatch lines (${rectSegs.length})`);
  const rectScreen = toScreen(rect);
  for (const [p0, p1] of rectSegs) {
    const mid: P2 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    assert.ok(pointInPoly(mid, rectScreen), "hatch midpoint sits inside rectangle");
    // 45-degree slope check (in top-down projection |dx| ≈ |dy|)
    const dx = Math.abs(p1[0] - p0[0]), dy = Math.abs(p1[1] - p0[1]);
    assert.ok(Math.abs(dx - dy) < 0.35, `45-degree hatch angle preserved (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)})`);
  }

  // 2. Concave L-shape oriented so 45-degree lines cross BOTH arms without bridging the notch
  const lShape: P2[] = [[0, 0], [20, 0], [20, 20], [12, 20], [12, 8], [0, 8]];
  const lSvg = cutawayHatch(cam, pl, lShape, 2.4);
  assert.ok(!lSvg.includes("NaN") && !lSvg.includes("undefined"));
  const lSegs = parseSegments(lSvg);
  assert.ok(lSegs.length >= 10, `L-shape produces clipped hatch segments (${lSegs.length})`);
  const lScreen = toScreen(lShape);
  for (const [p0, p1] of lSegs) {
    // Check 3 interior sample points along each segment so no line can bridge the concave notch
    for (const frac of [0.2, 0.5, 0.8]) {
      const pt: P2 = [p0[0] + (p1[0] - p0[0]) * frac, p0[1] + (p1[1] - p0[1]) * frac];
      assert.ok(pointInPoly(pt, lScreen), `L-shape hatch point (${pt[0].toFixed(1)}, ${pt[1].toFixed(1)}) lies strictly inside L-shape`);
    }
  }

  // 3. Oblique 3D camera projection on tilted plane still yields clean finite SVG
  const cam3d: Camera = { azimuth: 225, elevation: 26, scale: 18, origin: [500, 400] };
  const wallPl = planeOf([5, 0, 2], [0, -1, 0], [1, 0, 0]);
  const obliqueSvg = cutawayHatch(cam3d, wallPl, rect, 2.0);
  assert.ok(obliqueSvg.includes('class="rig-hatch"') && !obliqueSvg.includes("NaN"));

  // 4. Degenerate outlines return ""
  assert.equal(cutawayHatch(cam, pl, []), "");
  assert.equal(cutawayHatch(cam, pl, [[0, 0], [10, 0]]), "");
  assert.equal(cutawayHatch(cam, pl, [[0, 0], [5, 5], [10, 10]]), ""); // collinear zero-area
  assert.equal(cutawayHatch(cam, pl, rect, 0), "");
  assert.equal(cutawayHatch(cam, pl, rect, -2), "");
});
