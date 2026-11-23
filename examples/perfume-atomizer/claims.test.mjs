// node --test examples/perfume-atomizer/claims.test.mjs
//
// Verifies every claim holds on every variant, every core topic is placed, Now you try generates
// three distinct question types with distinct choices, and everyday mode uses zero PhD jargon.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, MODELS } from "./model.mjs";
import { CLAIMS, COVERAGE, PRED_STEP, STEPS, captions, headings, practice, prediction, script } from "./story.mjs";

const M0 = MODELS[BASE];
const plainScript = (M) => script(M).map((s) => s.replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1"));
const wordsFor = (M) => [...headings(M), ...captions(M), ...plainScript(M)].join("\n");

for (const c of CLAIMS) {
  test(`claim "${c.text}" holds across variants and appears verbatim on the page`, () => {
    for (const [name, M] of Object.entries(MODELS)) {
      assert.ok(c.test(M), `${name}: model contradicts claim`);
    }
    assert.ok(wordsFor(M0).toLowerCase().includes(c.text.toLowerCase()), "page text does not say claim verbatim");
  });
}

test("every core topic is placed on a step, whatif, lab, or practice", () => {
  const places = new Set([...STEPS.map((_, k) => `step:${k}`), "whatif", "lab", "practice"]);
  for (const t of COVERAGE.topics) {
    assert.ok(places.has(t.where) || t.where === "deferred", `${t.topic}: invalid place ${t.where}`);
  }
  const core = COVERAGE.topics.filter((t) => t.core !== false);
  assert.ok(core.length >= 6);
  const taught = core.filter((t) => t.where !== "deferred").length;
  assert.ok(taught / core.length >= 0.75);
});

test("Now you try generates all 3 question types with 3 distinct choices", () => {
  for (const [name, M] of Object.entries(MODELS)) {
    for (let n = 0; n < 18; n++) {
      let s = n + 17;
      const p = practice(n, () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648), M);
      assert.equal(p.choices.length, 3, `${name} q${n} choices`);
      assert.equal(new Set(p.choices).size, 3, `${name} q${n} distinct choices`);
      assert.ok(p.q.length > 20 && p.explain.length > 20);
      assert.ok(p.state && typeof p.state.fillPct === "number");
    }
  }
});

test("everyday mode contains zero fluid-dynamics jargon", () => {
  const JARGON = /\b(bernoulli|venturi|pascal|kpa|mpa|reynolds|weber|m\/s²|cavitation|hydrostatic|navier)\b/i;
  for (const [name, M] of Object.entries(MODELS)) {
    const all = wordsFor(M) + "\n" + JSON.stringify(prediction(M));
    assert.ok(!JARGON.test(all), `${name} contains forbidden jargon: ${all.match(JARGON)?.[0]}`);
  }
});

test("prediction step and step-to-step text uniqueness", () => {
  assert.equal(PRED_STEP, 1);
  for (const [name, M] of Object.entries(MODELS)) {
    const h = headings(M), c = captions(M), v = script(M);
    assert.equal(h.length, STEPS.length);
    assert.equal(c.length, STEPS.length);
    assert.equal(v.length, STEPS.length);
    for (let k = 1; k < h.length; k++) {
      assert.notEqual(h[k], h[k - 1], `${name} step ${k} heading repeats`);
      assert.notEqual(c[k], c[k - 1], `${name} step ${k} caption repeats`);
      assert.notEqual(v[k], v[k - 1], `${name} step ${k} voice repeats`);
    }
  }
});
