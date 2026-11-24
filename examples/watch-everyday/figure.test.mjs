// node --test examples/watch-everyday/figure.test.mjs
//
// Verifies the 3-layer studio exhibition cutaway watch figure:
//   - All 4 going-train gear pairs satisfy exact pitch tangency (assertMeshed)
//   - Every rotating thick part uses turningPart() with worstErrPx < 0.5 px
//   - Total SVG <path> elements across static parts + <defs> stay strictly < 8,000
//   - Every placed item across operating states resolves to a real drawing and valid anchors

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, escapementAt } from "./model.mjs";
import {
  CAVITY_FILL,
  CAVITY_R,
  GEAR_PAIRS,
  LAYERS,
  assertMeshed,
  cameraFor,
  figure,
  renderHud,
} from "./figure.mjs";

const BOX = { x: 3500, y: 340, w: 5300, h: 5820 };
const cam = cameraFor(BOX);

test("figure: all 4 meshed going-train pairs satisfy exact pitch-circle tangency and spin signs", () => {
  assert.equal(GEAR_PAIRS.length, 4);
  for (const p of GEAR_PAIRS) {
    assert.doesNotThrow(() => assertMeshed(p.a, p.b, 1e-6), `failed tangency: ${p.name}`);
  }
  // Negative centerDeg drives centerWheel & fourthWheel CW (matching hands) and escapePinion CCW (matching club-tooth rake)
  const F = figure(MODELS.active, cam, { prefix: "s" });
  const tr = F.layout.train.byName;
  assert.equal(tr.centerWheel.omegaSign, 1);
  assert.equal(tr.fourthWheel.omegaSign, 1);
  assert.equal(tr.escapePinion.omegaSign, -1);
});

test("figure: cavity fill passes (ratio >= 0.30, zero parts outside r = 32)", () => {
  assert.equal(CAVITY_R, 32);
  assert.equal(CAVITY_FILL.ok, true);
  assert.ok(CAVITY_FILL.ratio >= 0.30, `ratio=${CAVITY_FILL.ratio.toFixed(3)}`);
  assert.equal(CAVITY_FILL.outside, 0);
});

test("figure: every turning thick solid uses turningPart() with worstErrPx < 0.5 px", () => {
  const F = figure(MODELS.active, cam, { prefix: "t" });
  assert.ok(F.turningSpecs.length >= 14, `expected >= 14 turning parts, got ${F.turningSpecs.length}`);
  let worst = 0;
  for (const spec of F.turningSpecs) {
    assert.ok(spec.worstErrPx < 0.5, `${spec.id} worstErrPx=${spec.worstErrPx.toFixed(3)} >= 0.5 px`);
    worst = Math.max(worst, spec.worstErrPx);
  }
  for (let i = 0; i < 20; i++) {
    const out = F.pose({
      reserveHours: (i * 3) % 43,
      rotorDeg: -140 + i * 18,
      centerDeg: i * 15,
      useEscDrive: i % 2 === 0,
      esc: escapementAt(i * 0.14, i % 5 !== 0),
      hourDeg: 148 - i * 4,
      minuteDeg: 28 - i * 18,
      secondDeg: -45 - i * 32,
    });
    for (const item of out.items) {
      if (item.turnErrPx !== undefined) {
        assert.ok(item.turnErrPx < 0.5, `${item.id} turnErrPx=${item.turnErrPx.toFixed(3)} >= 0.5 px`);
      }
    }
  }
  assert.ok(worst < 0.5, `worst turn error ${worst.toFixed(3)} px >= 0.5 px`);
});

test("figure: total SVG <path> count across static parts and all <defs> stays strictly under 8,000", () => {
  const F = figure(MODELS.active, cam, { prefix: "p" });
  const out = F.pose({ reserveHours: 30, rotorDeg: 145, centerDeg: 12, esc: escapementAt(0.3, true) });
  const countPaths = (svg) => (svg.match(/<path\b/g) || []).length;
  let totalPaths = 0;
  for (const p of F.parts) totalPaths += countPaths(p.svg);
  for (const d of out.defs) totalPaths += countPaths(d);
  assert.ok(totalPaths > 300, `suspiciously few paths: ${totalPaths}`);
  assert.ok(totalPaths < 8000, `SVG path bloat: ${totalPaths} >= 8,000`);
});

test("figure: every placed part resolves and all callout anchors stay in viewBox across states & variants", () => {
  for (const [name, M] of Object.entries(MODELS)) {
    const F = figure(M, cam, { prefix: "v" });
    const drawn = new Set(F.parts.map((p) => p.id));
    const states = [
      { ...M.concept, rotorDeg: 145, centerDeg: 0, esc: escapementAt(0.25, true) },
      { ...M.steps[1], rotorDeg: 185, centerDeg: 20, esc: escapementAt(0.5, true) },
      { ...M.steps[5], rotorDeg: 175, centerDeg: 0, esc: escapementAt(0, false) },
    ];
    for (const st of states) {
      const { items, defs, at } = F.pose(st);
      for (const d of defs) {
        const m = d.match(/id="([^"]+)"/);
        if (m) drawn.add(`#${m[1]}`);
      }
      for (const it of items) {
        if (it.hidden || it.svg !== undefined) continue;
        assert.ok(it.href ? drawn.has(it.href) : drawn.has(it.id), `${name}: ${it.id} (${it.href ?? "static"}) missing`);
      }
      for (const [k, pt] of Object.entries(at)) {
        assert.ok(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), `${name}: anchor ${k} not finite`);
        assert.ok(pt[0] >= 0 && pt[0] <= 14200 && pt[1] >= 0 && pt[1] <= 6550, `${name}: anchor ${k} out of bounds: ${pt}`);
      }
      const hud = renderHud(M, st);
      assert.ok(hud.includes("Power reserve") && hud.includes("Balance beat"));
    }
  }
  assert.ok(LAYERS.totalHeight > 45);
});
