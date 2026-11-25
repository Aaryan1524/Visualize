import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCENT_TOKENS,
  MONOCHROME_TOKENS,
  THEME_PALETTES,
  buildArcBezier,
  buildRoundedOrthogonalPath,
  computeFlowPipeGeometry,
  computeLiftArcOffset,
  formatFlowPipeLabel,
  logicalToViewport,
  routeOrthogonal,
  sampleCubicBezier,
  samplePolyline,
  segmentIntersectsRect,
  snapToGrid,
  stepSpring,
  viewportToLogical,
  type Point2D,
  type Rect2D,
  type SpringState,
} from "./engine-c.ts";

function assertPathStrictlyOrthogonal(points: Point2D[], label: string): void {
  assert.ok(points.length >= 2, `${label}: expected at least 2 points`);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const isHoriz = Math.abs(a.y - b.y) < 1e-2;
    const isVert = Math.abs(a.x - b.x) < 1e-2;
    assert.ok(
      isHoriz || isVert,
      `${label}: segment ${i} (${a.x},${a.y})->(${b.x},${b.y}) is not orthogonal`,
    );
  }
}

function assertPathAvoidsObstacles(points: Point2D[], obstacles: Rect2D[], label: string): void {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (let j = 0; j < obstacles.length; j++) {
      const obs = obstacles[j]!;
      assert.equal(
        segmentIntersectsRect(a, b, obs),
        false,
        `${label}: segment ${i} (${a.x.toFixed(1)},${a.y.toFixed(1)})->(${b.x.toFixed(1)},${b.y.toFixed(1)}) intersected obstacle ${j} (${obs.x},${obs.y},${obs.w}x${obs.h})`,
      );
    }
  }
}

describe("Engine C — Color Lock Tokens & Light-Faithful Dark Mode", () => {
  it("enforces strictly 4 monochrome tokens and 5 semantic accents", () => {
    assert.deepEqual(Object.keys(MONOCHROME_TOKENS), [
      "clayLight",
      "clayMid",
      "clayDark",
      "graphite",
    ]);
    assert.equal(MONOCHROME_TOKENS.clayLight, "#f7f6f2");
    assert.equal(MONOCHROME_TOKENS.clayMid, "#ebe9e2");
    assert.equal(MONOCHROME_TOKENS.clayDark, "#d4d1c7");
    assert.equal(MONOCHROME_TOKENS.graphite, "#2d3036");

    assert.deepEqual(Object.keys(ACCENT_TOKENS), [
      "orange",
      "cobalt",
      "ember",
      "teal",
      "gold",
    ]);
    assert.equal(ACCENT_TOKENS.orange, "#e05a1e");
    assert.equal(ACCENT_TOKENS.cobalt, "#2563eb");
    assert.equal(ACCENT_TOKENS.ember, "#ef4444");
    assert.equal(ACCENT_TOKENS.teal, "#0d9488");
    assert.equal(ACCENT_TOKENS.gold, "#d69624");
  });

  it("provides distinct light studio paper and obsidian dark palettes", () => {
    assert.equal(THEME_PALETTES.light.bg, "#f6f5f0");
    assert.equal(THEME_PALETTES.dark.bg, "#111317");
    assert.equal(THEME_PALETTES.dark.cardFill.clayLight, "#1a1d24");
    assert.equal(THEME_PALETTES.dark.cardStroke, "rgba(255, 255, 255, 0.12)");
  });
});

describe("Engine C — Grid Snapping (snapToGrid)", () => {
  it("snaps positive, negative, and zero values deterministically to multiples of grid", () => {
    assert.equal(snapToGrid(0, 16), 0);
    assert.equal(snapToGrid(7, 16), 0);
    assert.equal(snapToGrid(8, 16), 16);
    assert.equal(snapToGrid(123, 16), 128);
    assert.equal(snapToGrid(-15, 16), -16);
    assert.equal(snapToGrid(-1, 16), 0);
    assert.equal(Object.is(snapToGrid(-1, 16), -0), false);
    assert.equal(snapToGrid(37, 10), 40);
  });

  it("handles non-positive grid or non-finite inputs safely", () => {
    assert.equal(snapToGrid(12.34, 0), 12.34);
    assert.equal(snapToGrid(Number.NaN, 16), 0);
  });
});

describe("Engine C — Critically-Damped Spring Physics (stepSpring)", () => {
  it("converges monotonically from rest without overshoot or NaN", () => {
    let s: SpringState = { value: 0, velocity: 0 };
    const target = 240;
    let prev = s.value;

    for (let i = 0; i < 120; i++) {
      s = stepSpring(s, target, 1 / 60, 220);
      assert.ok(Number.isFinite(s.value) && Number.isFinite(s.velocity));
      assert.ok(s.value >= prev - 1e-6, `Expected monotonic increase at frame ${i}: ${prev} -> ${s.value}`);
      assert.ok(s.value <= target + 1e-4, `Expected no overshoot at frame ${i}: ${s.value}`);
      prev = s.value;
    }

    assert.ok(Math.abs(s.value - target) < 0.05, `Expected convergence near ${target}, got ${s.value}`);
    assert.ok(Math.abs(s.velocity) < 0.05, `Expected velocity near 0, got ${s.velocity}`);
  });

  it("remains unconditionally stable for huge dt spikes and underdamped/overdamped configs", () => {
    const huge = stepSpring({ value: 10, velocity: 500 }, 100, 10, 300);
    assert.ok(Number.isFinite(huge.value) && Number.isFinite(huge.velocity));
    assert.equal(huge.value, 100);
    assert.equal(huge.velocity, 0);

    // Underdamped converges cleanly without blowup
    let under: SpringState = { value: 0, velocity: 0 };
    for (let i = 0; i < 180; i++) {
      under = stepSpring(under, 50, 1 / 60, 200, 12);
      assert.ok(Number.isFinite(under.value) && Math.abs(under.value) < 200);
    }
    assert.ok(Math.abs(under.value - 50) < 0.5);

    // Overdamped converges monotonically
    let over: SpringState = { value: 100, velocity: 0 };
    let prev = over.value;
    for (let i = 0; i < 180; i++) {
      over = stepSpring(over, 0, 1 / 60, 180, 40);
      assert.ok(over.value <= prev + 1e-6 && over.value >= -1e-4);
      prev = over.value;
    }
    assert.ok(Math.abs(over.value) < 0.5);
  });
});

describe("Engine C — Zero-Overlap Orthogonal Router (routeOrthogonal)", () => {
  it("routes cleanly between two boxes without obstacles and produces rounded SVG path d", () => {
    const from: Rect2D = { x: 80, y: 120, w: 120, h: 64 };
    const to: Rect2D = { x: 420, y: 260, w: 120, h: 64 };
    const res = routeOrthogonal(from, to, [], { fromSide: "right", toSide: "left", radius: 10 });

    assertPathStrictlyOrthogonal(res.points, "unobstructed");
    assert.ok(res.path.startsWith("M "), "SVG path must start with M");
    assert.ok(res.path.includes("Q "), "SVG path must include rounded Q corners");
    assert.ok(res.length > 200, "Route length should reflect actual Manhattan distance");
    assert.equal(res.fromSide, "right");
    assert.equal(res.toSide, "left");
  });

  it("routes cleanly AROUND a direct blocking obstacle AABB between source and target", () => {
    const from: Rect2D = { x: 64, y: 200, w: 112, h: 64 };
    const to: Rect2D = { x: 544, y: 200, w: 112, h: 64 };
    const blocker: Rect2D = { x: 288, y: 160, w: 144, h: 144 };

    const res = routeOrthogonal(from, to, [blocker], {
      fromSide: "right",
      toSide: "left",
      padding: 14,
      radius: 10,
    });

    assertPathStrictlyOrthogonal(res.points, "single-blocker");
    assertPathAvoidsObstacles(res.points, [blocker], "single-blocker");
    assert.ok(res.points.length >= 4, "Detour around blocker must introduce bends");
    assert.ok(res.path.includes("Q "), "Detour path must have rounded Q bends");
  });

  it("navigates multiple staggered obstacles without intersecting any obstacle box", () => {
    const from: Rect2D = { x: 64, y: 80, w: 96, h: 48 };
    const to: Rect2D = { x: 520, y: 360, w: 96, h: 48 };
    const obstacles: Rect2D[] = [
      { x: 220, y: 64, w: 112, h: 144 },
      { x: 352, y: 240, w: 128, h: 160 },
      { x: 112, y: 256, w: 144, h: 96 },
    ];

    const res = routeOrthogonal(from, to, obstacles, {
      fromSide: "bottom",
      toSide: "top",
      padding: 12,
      radius: 10,
    });

    assertPathStrictlyOrthogonal(res.points, "multi-obstacle");
    assertPathAvoidsObstacles(res.points, obstacles, "multi-obstacle");
    assert.ok(res.path.startsWith("M ") && res.path.includes("L "));
  });

  it("builds valid SVG rounded path strings via buildRoundedOrthogonalPath", () => {
    const d = buildRoundedOrthogonalPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      10,
    );
    assert.equal(d, "M 0.00 0.00 L 90.00 0.00 Q 100.00 0.00 100.00 10.00 L 100.00 100.00");
  });
});

describe("Engine C — Polyline Sampling (samplePolyline)", () => {
  const poly: Point2D[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it("returns exact endpoints, corner midpoint, and directional angles", () => {
    const p0 = samplePolyline(poly, 0);
    assert.equal(p0.x, 0);
    assert.equal(p0.y, 0);
    assert.equal(p0.angle, 0);

    const p25 = samplePolyline(poly, 0.25);
    assert.ok(Math.abs(p25.x - 50) < 1e-6);
    assert.ok(Math.abs(p25.y - 0) < 1e-6);
    assert.ok(Math.abs(p25.angle - 0) < 1e-6);

    const p50 = samplePolyline(poly, 0.5);
    assert.ok(Math.abs(p50.x - 100) < 1e-6);
    assert.ok(Math.abs(p50.y - 0) < 1e-6);

    const p75 = samplePolyline(poly, 0.75);
    assert.ok(Math.abs(p75.x - 100) < 1e-6);
    assert.ok(Math.abs(p75.y - 50) < 1e-6);
    assert.ok(Math.abs(p75.angle - Math.PI / 2) < 1e-6);

    const p1 = samplePolyline(poly, 1);
    assert.equal(p1.x, 100);
    assert.equal(p1.y, 100);
  });

  it("clamps out-of-range t values cleanly", () => {
    assert.deepEqual(samplePolyline(poly, -2), samplePolyline(poly, 0));
    assert.deepEqual(samplePolyline(poly, 5), samplePolyline(poly, 1));
  });
});

describe("Engine C — Camera Projection (logicalToViewport & viewportToLogical)", () => {
  it("maps logical camera center to exact viewport center and scales accurately with zoom", () => {
    const logical = { width: 1120, height: 640 };
    const viewport = { width: 1400, height: 800 }; // exact 1.25x scale
    const camera = { x: 560, y: 320, zoom: 1 };

    const center = logicalToViewport({ x: 560, y: 320 }, camera, viewport, logical);
    assert.ok(Math.abs(center.x - 700) < 1e-6);
    assert.ok(Math.abs(center.y - 400) < 1e-6);
    assert.ok(Math.abs(center.scale - 1.25) < 1e-6);
    assert.equal(center.visible, true);

    const zoomed = logicalToViewport(
      { x: 660, y: 320 },
      { x: 560, y: 320, zoom: 2 },
      viewport,
      logical,
    );
    // +100 logical units * (1.25 * 2) = +250 viewport px
    assert.ok(Math.abs(zoomed.x - 950) < 1e-6);
    assert.ok(Math.abs(zoomed.y - 400) < 1e-6);
    assert.ok(Math.abs(zoomed.scale - 2.5) < 1e-6);
  });

  it("round-trips accurately with viewportToLogical across arbitrary pan/zoom", () => {
    const logical = { width: 1120, height: 640 };
    const viewport = { width: 1280, height: 720 };
    const camera = { x: 480, y: 290, zoom: 1.35 };
    const original = { x: 712.5, y: 418.25 };

    const projected = logicalToViewport(original, camera, viewport, logical);
    const recovered = viewportToLogical(projected, camera, viewport, logical);
    assert.ok(Math.abs(recovered.x - original.x) < 1e-6);
    assert.ok(Math.abs(recovered.y - original.y) < 1e-6);
  });
});

describe("Engine C — Smooth Cubic Bézier Arcs (buildArcBezier & sampleCubicBezier)", () => {
  it("constructs a vertical-tangent S-curve with exact endpoints and symmetric midpoint", () => {
    const from: Point2D = { x: 420, y: 202 };
    const to: Point2D = { x: 640, y: 340 };
    const curve = buildArcBezier(from, to);

    assert.deepEqual(curve.p0, from);
    assert.deepEqual(curve.p3, to);
    // Vertical departure & arrival tangents (p1.x === from.x, p2.x === to.x)
    assert.equal(curve.p1.x, from.x);
    assert.equal(curve.p2.x, to.x);
    assert.ok(curve.p1.y > from.y, "Departure handle must extend downward");
    assert.ok(curve.p2.y < to.y, "Arrival handle must extend upward");
    assert.ok(curve.d.startsWith("M ") && curve.d.includes(" C "), "Must emit valid SVG cubic C path");

    // Symmetric S-curve midpoint lies exactly at average of endpoints
    assert.ok(Math.abs(curve.midpoint.x - 530) < 1e-6);
    assert.ok(Math.abs(curve.midpoint.y - 271) < 1e-6);
  });

  it("samples exact endpoints, midpoint, tangent direction, and clamps out-of-range t", () => {
    const curve = buildArcBezier({ x: 300, y: 200 }, { x: 500, y: 360 }, 80);

    const s0 = sampleCubicBezier(curve.p0, curve.p1, curve.p2, curve.p3, 0);
    assert.ok(Math.abs(s0.x - 300) < 1e-6);
    assert.ok(Math.abs(s0.y - 200) < 1e-6);
    assert.ok(Math.abs(s0.angle - Math.PI / 2) < 1e-6, "Initial tangent must point straight down");

    const sMid = sampleCubicBezier(curve.p0, curve.p1, curve.p2, curve.p3, 0.5);
    assert.ok(Math.abs(sMid.x - 400) < 1e-6);
    assert.ok(Math.abs(sMid.y - 280) < 1e-6);

    const s1 = sampleCubicBezier(curve.p0, curve.p1, curve.p2, curve.p3, 1);
    assert.ok(Math.abs(s1.x - 500) < 1e-6);
    assert.ok(Math.abs(s1.y - 360) < 1e-6);
    assert.ok(Math.abs(s1.angle - Math.PI / 2) < 1e-6, "Arrival tangent must point straight down");

    // Out-of-range clamping
    assert.deepEqual(
      sampleCubicBezier(curve.p0, curve.p1, curve.p2, curve.p3, -1),
      s0,
    );
    assert.deepEqual(
      sampleCubicBezier(curve.p0, curve.p1, curve.p2, curve.p3, 3),
      s1,
    );
  });
});

describe("Engine C — Kinetic Lift-Arc Physics (computeLiftArcOffset)", () => {
  it("lifts symmetrically upward at midpoint and rests cleanly at 0 on endpoints", () => {
    assert.equal(computeLiftArcOffset(0, 32), 0);
    assert.equal(computeLiftArcOffset(1, 32), 0);
    assert.ok(Math.abs(computeLiftArcOffset(0.5, 32) - -32) < 1e-6);

    const q1 = computeLiftArcOffset(0.25, 32);
    const q3 = computeLiftArcOffset(0.75, 32);
    assert.ok(q1 < 0 && Math.abs(q1 - q3) < 1e-6, "Lift arc must be symmetric across travel");
  });

  it("clamps invalid progress or non-positive peak safely to 0", () => {
    assert.equal(computeLiftArcOffset(-0.5, 32), 0);
    assert.equal(computeLiftArcOffset(1.5, 32), 0);
    assert.equal(computeLiftArcOffset(Number.NaN, 32), 0);
    assert.equal(computeLiftArcOffset(0.5, 0), 0);
  });
});

describe("Engine C — Tactile Light-Faithful Dark Mode Ceramic Contrast", () => {
  function hexLuminance(hex: string): number {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrastRatio(a: string, b: string): number {
    const l1 = hexLuminance(a);
    const l2 = hexLuminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  it("keeps matte-ivory ceramic tiles gleaming with crisp charcoal ink in both light and dark modes", () => {
    const lightTactile = THEME_PALETTES.light.tactile;
    const darkTactile = THEME_PALETTES.dark.tactile;

    assert.equal(lightTactile.tileFill, "#fbfaf6");
    assert.equal(lightTactile.tileInk, "#1b1b19");
    assert.equal(darkTactile.tileFill, "#eceae2");
    assert.equal(darkTactile.tileInk, "#1b1b19");

    // Both light & dark ceramic tiles maintain WCAG AAA (>12:1) text legibility
    assert.ok(contrastRatio(lightTactile.tileFill, lightTactile.tileInk) > 12);
    assert.ok(contrastRatio(darkTactile.tileFill, darkTactile.tileInk) > 12);
    // Dark ceramic tile pops cleanly off obsidian background (>10:1)
    assert.ok(contrastRatio(darkTactile.tileFill, THEME_PALETTES.dark.bg) > 10);
  });
});

describe("Engine C — FlowPipe Label Casing, Bidirectional laneOffset & Arrowhead Geometry", () => {
  it("preserves exact caller casing on flowPipe labels without forcing uppercase", () => {
    assert.equal(formatFlowPipeLabel("SYN"), "SYN");
    assert.equal(formatFlowPipeLabel("ACK 2"), "ACK 2");
    assert.equal(formatFlowPipeLabel("seq=1"), "seq=1");
    assert.equal(formatFlowPipeLabel("HTTP/2 Push"), "HTTP/2 Push");
    assert.equal(formatFlowPipeLabel(undefined), "");
  });

  it("separates bidirectional horizontal pipes cleanly with canonical +/- laneOffset", () => {
    const client: Point2D = { x: 180, y: 320 };
    const server: Point2D = { x: 620, y: 320 };

    const forward = computeFlowPipeGeometry(client, server, -14);
    const reverse = computeFlowPipeGeometry(server, client, +14);

    // Upper lane (client -> server) sits at y = 306; lower lane (server -> client) sits at y = 334
    assert.ok(Math.abs(forward.start.y - 306) < 1e-6);
    assert.ok(Math.abs(forward.end.y - 306) < 1e-6);
    assert.ok(Math.abs(reverse.start.y - 334) < 1e-6);
    assert.ok(Math.abs(reverse.end.y - 334) < 1e-6);

    // Parallel lanes are separated by exactly 2 * 14 = 28px and never overlap
    assert.ok(Math.abs(reverse.midpoint.y - forward.midpoint.y - 28) < 1e-6);
    assert.equal(forward.midpoint.x, reverse.midpoint.x);

    // Labels sit cleanly outside each lane (above upper lane, below lower lane)
    assert.ok(forward.labelPos.y < forward.midpoint.y);
    assert.ok(reverse.labelPos.y > reverse.midpoint.y);

    // Directional arrowheads point right (0 rad) and left (PI rad)
    assert.ok(Math.abs(forward.endAngle - 0) < 1e-4);
    assert.ok(Math.abs(Math.abs(reverse.endAngle) - Math.PI) < 1e-4);
    assert.ok(forward.arrowPath.startsWith("M ") && forward.arrowPath.includes(" L "));
    assert.ok(reverse.arrowPath.startsWith("M ") && reverse.arrowPath.includes(" L "));
  });

  it("applies exact perpendicular laneOffset on diagonal pipes", () => {
    const a: Point2D = { x: 100, y: 100 };
    const b: Point2D = { x: 400, y: 400 };
    const gPos = computeFlowPipeGeometry(a, b, 14);
    const gNeg = computeFlowPipeGeometry(b, a, -14);

    // Distance between opposing lane midpoints is exactly 28px perpendicular to segment
    const sep = Math.hypot(gPos.midpoint.x - gNeg.midpoint.x, gPos.midpoint.y - gNeg.midpoint.y);
    assert.ok(Math.abs(sep - 28) < 1e-4, `Expected 28px separation, got ${sep}`);

    // Displacement vector is strictly perpendicular to the (a -> b) direction
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dot = (gPos.start.x - a.x) * dx + (gPos.start.y - a.y) * dy;
    assert.ok(Math.abs(dot) < 1e-6, `Expected perpendicular offset, dot=${dot}`);
  });
});
