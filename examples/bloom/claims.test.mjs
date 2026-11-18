// node --test examples/bloom/claims.test.mjs
//
// Every claim holds by the model, and its words are on the page: in a heading, a caption or the
// narration (story.mjs) of the filter the page opens on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, MODELS } from "./model.mjs";
import { CLAIMS, COVERAGE, PRED_STEP, STEPS, captions, headings, practice, prediction, script } from "./story.mjs";

const M = MODELS[BASE];
const words = [...headings(M), ...captions(M), ...script(M).map((s) => s.replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1"))].join("\n");
for (const c of CLAIMS) {
  test(`"${c.text}" holds, and the page says it`, () => {
    assert.ok(c.test(M), "the model contradicts it");
    assert.ok(words.toLowerCase().includes(c.text.toLowerCase()), "the page does not say it");
  });
}

test("every core topic is placed on a step, the lab or What if", () => {
  const places = new Set([...STEPS.map((_, k) => `step:${k}`), "whatif", "lab", "practice"]);
  for (const t of COVERAGE.topics) assert.ok(places.has(t.where) || t.where === "deferred", `${t.topic}: ${t.where}`);
  assert.ok(COVERAGE.topics.filter((t) => t.core !== false).length >= 4);
});

test("Now you try gives each kind of question, and its answer is the model's", () => {
  for (let n = 0; n < 30; n++) {
    let s = n + 1;
    const p = practice(n, () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648));
    assert.equal(p.answer, n % 3 === 2 ? "Definitely not" : "Maybe in the set");
  }
});

// Each core lesson, by the words that teach it and the step that must carry them, in every What if variant.
const LESSONS = [
  { step: 1, says: "the word itself is not stored" },
  { step: 2, says: "so", shares: true },
  { step: 4, says: "so the filter answers maybe in the set" },
  { step: 5, says: "the answer is definitely not" },
  { step: 6, says: "a false positive" },
  { step: 6, says: "expected rate" },
  { step: 6, says: "bits per item" },
  { step: 8, says: "a false negative" },
  { step: 8, says: "counting bloom filter" },
];
for (const [name, Mo] of Object.entries(MODELS)) {
  test(`${name}: every core lesson happens and is said, at its step`, () => {
    const c = captions(Mo).map((x) => x.toLowerCase());
    for (const l of LESSONS) assert.ok(c[l.step].includes(l.says), `${name} step ${l.step}: "${l.says}"`);
    assert.ok(/was already 1, set by/.test(c[2]), `${name}: the second word shares a bit`);
  });
  test(`${name}: no step repeats the previous step's paragraph`, () => {
    const sentences = (t) => t.split(/(?<=\.) /).filter((x) => x.length > 50);
    const c = captions(Mo), h = headings(Mo), v = script(Mo);
    for (let k = 1; k < c.length; k++) {
      for (const x of sentences(c[k])) assert.ok(!c[k - 1].includes(x), `${name} step ${k} repeats: ${x}`);
      assert.notEqual(h[k], h[k - 1]);
      assert.notEqual(v[k], v[k - 1]);
    }
  });
  test(`${name}: the prediction's question, answer and explanation come from its own model`, () => {
    const p = prediction(Mo), e = Mo.steps[PRED_STEP].event;
    assert.ok(p.question.toLowerCase().startsWith(e.word), p.question);
    for (const b of e.picked) assert.ok(new RegExp(`\\b${b}\\b`).test(p.question), `${name}: bit ${b} in "${p.question}"`);
    assert.equal(p.choices[p.answer], e.answer === "maybe" ? "Maybe in the set" : "Definitely not");
    for (const b of e.picked) assert.ok(new RegExp(`\\b${b}\\b`).test(p.explanation), `${name}: bit ${b} in "${p.explanation}"`);
    assert.ok(!/bits \d+ are/.test(p.explanation) && !/bits \d+\./.test(p.question), `${name}: one bit is not "bits": ${p.question} / ${p.explanation}`);
  });
}
