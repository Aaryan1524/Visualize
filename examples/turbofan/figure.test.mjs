// node --test examples/turbofan/figure.test.mjs
//
// Verifies the horizontal axial-cutaway turbofan figure:
//   - Uses spread("axial-cutaway") and layoutFlowSpine({ axis: "x" }) cleanly
//   - Every rotating rotor (fan, comp1, comp2, turbine) uses turningPart() with worstErrPx < 0.5 px
//   - Total SVG <path> elements stay strictly < 10,000 (live paths even leaner!)
//   - Every placed item across operating states & variants resolves cleanly and anchors stay in viewBox

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, simulateEngine } from "./model.mjs";
import { CALLOUTS, SP, SPINE, cameraFor, figure, renderHud } from "./figure.mjs";

const cam = cameraFor(SP.box);

test("figure: spread('axial-cutaway') and layoutFlowSpine snap all 7 stages monotonically along +X", () => {
  assert.equal(SP.kind, "axial-cutaway");
  assert.equal(CALLOUTS.length, 5);
  const order = ["intake", "fan", "comp1", "comp2", "burner", "turbine", "nozzle"];
  let prevX1 = -Infinity;
  for (const name of order) {
    const node = SPINE[name];
    assert.ok(node, `missing spine stage ${name}`);
    assert.ok(node.z0 >= prevX1 - 1e-9, `stage ${name} overlaps previous stage`);
    assert.ok(node.z1 > node.z0, `stage ${name} must have positive length`);
    prevX1 = node.z1;
  }
});

test("figure: every rotating rotor uses turningPart() with worstErrPx < 0.5 px", () => {
  const F = figure(MODELS.airliner, cam, { prefix: "t" });
  assert.equal(F.turningSpecs.length, 4, "expected 4 turning rotors (fan, comp1, comp2, turbine)");
  for (const spec of F.turningSpecs) {
    assert.ok(spec.worstErrPx < 0.5, `${spec.id} worstErrPx=${spec.worstErrPx.toFixed(3)} >= 0.5 px`);
  }
  for (let i = 0; i < 20; i++) {
    const out = F.pose({
      throttlePct: 20 + i * 4,
      bypassTier: i % 3 === 0 ? "high" : i % 3 === 1 ? "mid" : "low",
      fanDeg: i * 19,
      coreDeg: i * 27,
    });
    for (const it of out.items) {
      if (it.turnErrPx !== undefined) {
        assert.ok(it.turnErrPx < 0.5, `${it.id} turnErrPx=${it.turnErrPx.toFixed(3)} >= 0.5 px`);
      }
    }
  }
});

test("figure: total SVG <path> count across static parts and <defs> stays strictly under 10,000", () => {
  const F = figure(MODELS.airliner, cam, { prefix: "p" });
  const out = F.pose({ throttlePct: 85, bypassTier: "high", fanDeg: 18, coreDeg: 26 });
  const countPaths = (svg) => (svg.match(/<path\b/g) || []).length;
  let staticPaths = 0;
  let defPaths = 0;
  for (const p of F.parts) staticPaths += countPaths(p.svg);
  for (const d of out.defs) defPaths += countPaths(d);
  const totalPaths = staticPaths + defPaths;
  assert.ok(totalPaths > 250, `suspiciously few paths: ${totalPaths}`);
  assert.ok(totalPaths < 10000, `SVG path bloat: ${totalPaths} (static ${staticPaths} + defs ${defPaths}) >= 10,000`);
});

test("figure: every placed item resolves and all callout anchors stay inside viewBox across variants", () => {
  for (const [name, M] of Object.entries(MODELS)) {
    const F = figure(M, cam, { prefix: "v" });
    const drawn = new Set(F.parts.map((p) => p.id));
    const states = [
      M.concept,
      M.steps[1],
      M.steps[3],
      simulateEngine(M, 20, 1),
      simulateEngine(M, 100, 10),
    ];
    for (const st of states) {
      const { items, defs, at } = F.pose(st);
      for (const d of defs) {
        const m = d.match(/id="([^"]+)"/);
        if (m) drawn.add(`#${m[1]}`);
      }
      for (const it of items) {
        if (it.hidden || it.svg !== undefined) continue;
        assert.ok(it.href ? drawn.has(it.href) : drawn.has(it.id), `${name}: ${it.id} missing`);
      }
      for (const [k, pt] of Object.entries(at)) {
        assert.ok(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), `${name}: anchor ${k} not finite`);
        assert.ok(
          pt[0] >= 0 && pt[0] <= SP.viewBox.w && pt[1] >= 0 && pt[1] <= SP.viewBox.h,
          `${name}: anchor ${k} out of bounds: ${pt}`,
        );
      }
      const hud = renderHud(M, st);
      assert.ok(hud.includes("Cool fan push") && hud.includes("Engine throttle"));
    }
  }
});
