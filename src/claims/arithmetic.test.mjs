import { test } from "node:test";
import assert from "node:assert/strict";
import { checkArithmetic } from "./arithmetic.mjs";

const one = (text) => checkArithmetic([{ where: "t", text }]);

test("arithmetic: sums, differences, products and quotients that hold at the printed precision pass", () => {
  for (const text of [
    "the rest is 29 + 12 − 5 − 10 = 26 mm",
    "One click: 2.67 × 1.4 = 3.74 mm of travel.",
    "3.74 ÷ 1.4 = 2.67 mm of cable",
    "1.0 × 1.4 = 1.40 mm off its cog",
    "73 mm = 61 + 12? no equation here, but 61 mm + 12 mm = 73 mm is one",
    "2 + 3 × 4 = 14",
    "The half-wrap rule (half of 17 teeth × 12.7 mm = 108 mm)",
  ]) {
    const r = one(text);
    assert.deepEqual(r.problems, [], text);
    assert.ok(r.checked >= 1, `checked nothing in "${text}"`);
  }
});

test("arithmetic: a planted wrong sum fails, and so do a wrong product and a wrong quotient", () => {
  // shares rounded one by one, so the printed parts no longer add up to the printed whole
  const sum = one("Of the 73 mm, the cage gives up 47 mm and the rest 25 mm: 47 + 25 = 73 mm.");
  assert.equal(sum.problems.length, 1);
  assert.match(sum.problems[0], /"47 \+ 25 = 73 mm" — the left side comes to 72/);
  assert.equal(one("2.67 × 1.4 = 3.94").problems.length, 1);
  assert.equal(one("3.74 ÷ 1.4 = 2.91").problems.length, 1);
  // a product may round: 1.4 stands for anything from 1.35 to 1.45
  assert.deepEqual(one("3.74 ÷ 1.4 = 2.67").problems, []);
});

test("arithmetic: a hyphen inside a word is not a minus, and an en dash range is not a sum", () => {
  assert.equal(one("an 11-speed cassette, 11–28").checked, 0);
  assert.equal(one("29 - 5 = 24").checked, 1);
});
