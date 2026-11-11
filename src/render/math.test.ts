import assert from "node:assert/strict";
import test from "node:test";
import { formatNumber, grid, linked, tex } from "./math.ts";

test("tex: linked terms carry data-link", () => {
  const html = tex(`${linked("q1", "q_1")} \\cdot ${linked("k2", "k_2")}`);
  assert.match(html, /data-link="q1"/);
  assert.match(html, /data-link="k2"/);
});

test("tex: other HTML extensions stay untrusted", () => {
  const html = tex(String.raw`\href{https://example.com}{x}`);
  assert.doesNotMatch(html, /href="https:\/\/example.com"/);
});

test("tex: invalid input throws instead of rendering an error", () => {
  assert.throws(() => tex(String.raw`\frac{1}{`));
});

test("linked: several ids become one space-separated attribute", () => {
  assert.match(tex(linked(["q-the", "q-cat"], "Q")), /data-link="q-the q-cat"/);
});

test("linked: rejects ids that could break out of the attribute", () => {
  assert.throws(() => linked('a"b', "x"));
});

test("grid: cells carry links, keys and tones", () => {
  const html = grid(
    [
      [1, -0.004],
      [2.5, -3],
    ],
    { rows: ["a", "b"], cols: ["x", "y"], link: (i, j) => `c${i}${j}`, key: (i) => (i === 1 ? "row-b" : undefined), tone: () => "vz-dim" },
  );
  assert.match(html, /data-link="c01"/);
  assert.match(html, /data-key="row-b"/);
  assert.match(html, />0\.00</, "no negative zero");
  assert.match(html, />−3\.00</, "real minus sign");
});

test("formatNumber", () => {
  assert.equal(formatNumber(-0.0001), "0.00");
  assert.equal(formatNumber(-1.234, 1), "−1.2");
  assert.equal(formatNumber(0.5, 3), "0.500");
});
