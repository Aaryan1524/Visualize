// node --test examples/automatic-watch/claims.test.mjs
//
// Verifies every audited claim holds by the model and appears word-for-word in the story,
// every core topic in COVERAGE is placed, all 3 chapter predictions match the model,
// and spoken narration uses plain words with zero abbreviations.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS } from "./model.mjs";
import { CLAIMS, COVERAGE, PRED_STEPS, STEPS, captions, headings, predictions, script } from "./story.mjs";

const M0 = MODELS.modern;
const plainVoice = (M) => script(M).map((s) => s.replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1"));
const allWords = [...headings(M0), ...captions(M0), ...plainVoice(M0)].join("\n");

for (const c of CLAIMS) {
  test(`claim: "${c.text}" holds and appears on the page`, () => {
    assert.ok(c.test(M0), "model contradicts claim");
    assert.ok(allWords.toLowerCase().includes(c.text.toLowerCase()), "page text does not include claim");
  });
}

test("coverage: every core topic is placed at a valid step, lab, whatif, practice or deferred", () => {
  const places = new Set([...STEPS.map((_, k) => `step:${k}`), "whatif", "lab", "practice"]);
  for (const t of COVERAGE.topics) {
    assert.ok(places.has(t.where) || t.where === "deferred", `invalid placement for "${t.topic}": ${t.where}`);
  }
  assert.ok(COVERAGE.topics.filter((t) => t.core !== false).length >= 12);
});

test("deep tour: 14 steps across 4 chapters with 3 predictions (chapters 2-4)", () => {
  assert.equal(STEPS.length, 14);
  const chapters = [...new Set(STEPS.slice(1).map((s) => s.chapter))];
  assert.deepEqual(chapters, ["Winding", "Power", "Going train", "Timekeeping"]);
  assert.deepEqual(PRED_STEPS, [4, 7, 12]);
  for (const [name, M] of Object.entries(MODELS)) {
    const ps = predictions(M);
    assert.equal(ps.length, 3, `${name}: expected 3 predictions`);
    assert.deepEqual(ps.map((p) => p.step), PRED_STEPS);
    for (const p of ps) {
      assert.ok(p.choices.length >= 3, `${name} step ${p.step}: >= 3 choices`);
      assert.ok(p.answer >= 0 && p.answer < p.choices.length);
    }
  }
});

for (const [name, M] of Object.entries(MODELS)) {
  test(`${name}: headings, captions and voice scripts match STEPS length with zero consecutive repeats`, () => {
    const h = headings(M), c = captions(M), v = plainVoice(M);
    assert.equal(h.length, STEPS.length);
    assert.equal(c.length, STEPS.length);
    assert.equal(v.length, STEPS.length);
    for (let k = 1; k < STEPS.length; k++) {
      assert.notEqual(h[k], h[k - 1], `${name} step ${k} repeats heading`);
      assert.notEqual(c[k], c[k - 1], `${name} step ${k} repeats caption`);
      assert.notEqual(v[k], v[k - 1], `${name} step ${k} repeats voice`);
    }
  });

  test(`${name}: spoken narration uses plain words with no abbreviations`, () => {
    const bad = /\b(vph|Hz|mm|ms|rpm|deg)\b|N·mm|µm|s\/day|rev\/min|h\/h/;
    for (const [k, line] of plainVoice(M).entries()) {
      assert.ok(!bad.test(line), `${name} step ${k} has abbreviation in voice: ${line}`);
    }
  });
}
