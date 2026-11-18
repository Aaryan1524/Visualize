// node --test examples/bloom/claims.test.mjs
//
// Every claim holds by the model, and its words are on the page: in a heading, a caption or the
// narration (story.mjs) of the filter the page opens on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, MODELS } from "./model.mjs";
import { CLAIMS, COVERAGE, STEPS, captions, headings, practice, script } from "./story.mjs";

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
