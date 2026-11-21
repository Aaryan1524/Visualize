// node --test examples/automatic-watch/figure.test.mjs
//
// Verifies the 6-layer exploded automatic watch calibre on src/rig/mech.ts:
//  - All 7 meshing gear pairs satisfy exact pitch-circle tangency (assertMeshed)
//  - Every turning thick part uses turningPart() with worst screen error < 0.5 px
//  - Every placed item across operating states resolves to a real drawing
//  - Exploded stack layers are strictly ascending with dashed centreLines across gaps

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, WATCH, escapementAt } from "./model.mjs";
import { BASE_EXPLODE, CAL, GEAR_PAIRS, STACK_LAYERS, assertMeshed, cameraFor, figure, stackFor } from "./figure.mjs";

const BOX = { x: 4100, y: 260, w: 6000, h: 6000 };
const cam = cameraFor(BOX);

test("figure: all 7 calibre gear pairs satisfy exact pitch-circle tangency via assertMeshed", () => {
  assert.equal(GEAR_PAIRS.length, 7);
  for (const p of GEAR_PAIRS) {
    assert.doesNotThrow(() => assertMeshed(p.a, p.b, 1e-6), `failed tangency: ${p.name}`);
  }
});

test("figure: planted fault — shifting a meshed wheel by 0.5 mm fails assertMeshed", () => {
  const p = GEAR_PAIRS[0];
  const shifted = { ...p.b, at: [p.b.at[0] + 0.5, p.b.at[1]] };
  assert.throws(() => assertMeshed(p.a, shifted, 1e-3));
});

test("figure: every turning thick part uses turningPart() with worst error strictly < 0.5 px", () => {
  const F = figure(MODELS.modern, cam, { prefix: "t" });
  assert.ok(F.turningSpecs.length >= 19, `expected >= 19 turning parts, got ${F.turningSpecs.length}`);
  let worst = 0;
  for (const spec of F.turningSpecs) {
    assert.ok(spec.worstErrPx < 0.5, `${spec.id} worstErrPx=${spec.worstErrPx.toFixed(3)} >= 0.5 px`);
    worst = Math.max(worst, spec.worstErrPx);
  }
  // Sweep live pose frames and verify every turned item logs turnErrPx < 0.5 px
  for (let i = 0; i < 24; i++) {
    const out = F.pose({
      rotorDeg: -120 + i * 15,
      revDir: i % 2 === 0 ? 1 : -1,
      ratchetDeg: i * 18,
      windPct: (i * 4.2) % 100,
      slipping: i % 3 === 0,
      centerDeg: i * 25,
      useEscDrive: i % 2 === 0,
      esc: escapementAt(i * 0.17, WATCH.nominalAmp),
      regRateDeg: -20 + i * 1.7,
    });
    for (const item of out.items) {
      if (item.turnErrPx !== undefined) {
        assert.ok(item.turnErrPx < 0.5, `${item.id} frame turnErrPx=${item.turnErrPx.toFixed(3)} >= 0.5 px`);
      }
    }
  }
  assert.ok(worst < 0.5, `worst turn error ${worst.toFixed(3)} px must be < 0.5 px`);
});

test("figure: every placed part resolves to a drawing across all states and variants", () => {
  for (const [name, M] of Object.entries(MODELS)) {
    const F = figure(M, cam, { prefix: "v" });
    const drawn = new Set(F.parts.map((p) => p.id));
    const states = [
      { rotorDeg: 42, revDir: 1, ratchetDeg: 0, windPct: 80, slipping: false, centerDeg: 0, useEscDrive: true, esc: escapementAt(0.12, 290), regRateDeg: 0 },
      { rotorDeg: -45, revDir: -1, ratchetDeg: 90, windPct: 100, slipping: true, centerDeg: 45, useEscDrive: false, esc: escapementAt(1.5, 290), regRateDeg: 20 },
      { rotorDeg: 110, revDir: 1, ratchetDeg: 180, windPct: 5, slipping: false, centerDeg: 120, useEscDrive: true, esc: escapementAt(2.8, 200), regRateDeg: -20 },
    ];
    for (const st of states) {
      const { items, defs, at } = F.pose(st);
      for (const d of defs) {
        const m = d.match(/id="([^"]+)"/);
        if (m) drawn.add(`#${m[1]}`);
      }
      for (const it of items) {
        if (it.hidden || it.svg !== undefined) continue;
        assert.ok(it.href ? drawn.has(it.href) : drawn.has(it.id), `${name}: ${it.id} (${it.href ?? "static"}) has no drawing`);
      }
      for (const [k, pt] of Object.entries(at)) {
        assert.ok(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), `${name}: anchor ${k} not finite`);
        assert.ok(pt[0] >= 0 && pt[0] <= 14200 && pt[1] >= 0 && pt[1] <= 6550, `${name}: anchor ${k} out of viewBox: ${pt}`);
      }
    }
  }
});

test("figure: 6-layer exploded stack has strictly ascending bases and dashed centreLines", () => {
  const st = stackFor(BASE_EXPLODE);
  assert.equal(st.bases.length, STACK_LAYERS.length);
  assert.equal(st.bases.length, 6);
  for (let i = 1; i < st.bases.length; i++) {
    assert.ok(st.bases[i] > st.bases[i - 1] + STACK_LAYERS[i - 1].thickness, `layer ${i} overlaps layer ${i - 1}`);
  }
  const F = figure(MODELS.modern, cam, { prefix: "g" });
  const out = F.pose({ esc: escapementAt(0.5, 290) });
  for (let layer = 1; layer <= 5; layer++) {
    const g = out.items.find((i) => i.id === `g-guide${layer}`);
    assert.ok(g && g.svg && g.svg.length > 0, `missing dashed centreLines for layer ${layer}`);
  }
  assert.ok(CAL.plateR < CAL.caseR, "compact mainplate fits inside cutaway case");
});
