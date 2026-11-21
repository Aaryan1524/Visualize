// Every piece of arithmetic a page prints, done again from the printed numbers: "29 + 12 − 5 − 10 =
// 26 mm", "2.67 × 1.4 = 3.74", "3.74 ÷ 1.4 = 2.67". A derailleur page once printed shares of a
// length that did not add up, because each share had been rounded on its own; the model was right
// and every number on the page came from it, so nothing else caught it.
//
// A sum or a difference must add up exactly as printed, because a reader adds the digits. In a
// product or a quotient each printed number stands for any value that rounds to it, so the equation
// holds when some values within half a unit of each printed digit satisfy it: interval arithmetic over
// the left side must meet the right side's interval. This reads the words only; it does not use the
// page's model.
//
//   import { checkArithmetic } from "./arithmetic.mjs";
//   const { checked, problems } = checkArithmetic([{ where: "step:5", text: "…" }]);

const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const UNIT = String.raw`(?:\s?(?:mm|cm|m|km|g|kg|N|N·mm|s|ms|°|%|teeth|links|bits|bytes|ms|V|A|W|vph|Hz|rpm|N·m))?`;
const OP = "[+−×÷]|-(?=\\s)"; // a hyphen counts as minus only with a space after it ("29 - 5"), not in "11-speed"
const MOD = /(?<![\d,.])(\d{1,3}(?:,\d{3})+|\d+) mod (\d+) = (\d+)\b/g;
const EQ = new RegExp(`(${NUM}${UNIT}(?:\\s*(?:${OP})\\s*${NUM}${UNIT})+)\\s*=\\s*(${NUM})${UNIT}`, "g");

const num = (s) => Number(s.replace(/,/g, ""));
const decimals = (s) => (s.split(".")[1] ?? "").length;
/** A printed number as the interval of values that round to it. */
const interval = (s) => {
  const v = num(s), h = 0.5 * 10 ** -decimals(s);
  return [v - h, v + h];
};
const iv = {
  "+": (a, b) => [a[0] + b[0], a[1] + b[1]],
  "−": (a, b) => [a[0] - b[1], a[1] - b[0]],
  "×": (a, b) => {
    const c = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
    return [Math.min(...c), Math.max(...c)];
  },
  "÷": (a, b) => {
    if (b[0] <= 0 && b[1] >= 0) return [-Infinity, Infinity];
    const c = [a[0] / b[0], a[0] / b[1], a[1] / b[0], a[1] / b[1]];
    return [Math.min(...c), Math.max(...c)];
  },
};

/** The left side's interval, × and ÷ before + and −. */
function evaluate(left, exact = false) {
  const tokens = [...left.matchAll(new RegExp(`(${NUM})|(${OP})`, "g"))].map((m) => (m[1] !== undefined ? { n: m[1] } : { op: m[2] === "-" ? "−" : m[2] }));
  const val = (s) => (exact ? [num(s), num(s)] : interval(s));
  // products first
  const terms = [];
  let cur = val(tokens[0].n), sign = "+";
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i].op, x = val(tokens[i + 1].n);
    if (op === "×" || op === "÷") cur = iv[op](cur, x);
    else {
      terms.push([sign, cur]);
      sign = op;
      cur = x;
    }
  }
  terms.push([sign, cur]);
  return terms.slice(1).reduce((acc, [s, t]) => iv[s](acc, t), terms[0][1]);
}

/** Check every equation in the texts. Returns how many were checked, and one line per problem. */
export function checkArithmetic(texts) {
  let checked = 0;
  const problems = [];
  for (const { where, text } of texts) {
    // "half of 17 teeth × 12.7 mm" is an exact half: written as a product with a precise 0.5
    const t = String(text).replace(/\s+/g, " ").replace(/\b(?:half of|½ of|½ ×) (?=\d)/g, "0.500000 × ");
    for (const m of t.matchAll(EQ)) {
      // a sum or difference must add up exactly as printed: a reader adds the digits, and rounding
      // each share on its own is the fault this exists for. A product or quotient may round.
      const exact = !/[×÷]/.test(m[1]);
      const [lo, hi] = evaluate(m[1], exact);
      const [rlo, rhi] = exact ? [num(m[2]) - 1e-9, num(m[2]) + 1e-9] : interval(m[2]);
      checked++;
      if (hi < rlo - 1e-12 || lo > rhi + 1e-12) {
        const mid = (lo + hi) / 2;
        problems.push(`${where}: "${m[0]}" — the left side comes to ${+mid.toFixed(Math.max(decimals(m[2]), 2))} (${+lo.toFixed(4)} to ${+hi.toFixed(4)} from the printed digits), not ${m[2]}`);
      }
    }
    // a remainder, as concept pages print it ("29 mod 8 = 5"): whole numbers, exact
    for (const m of t.matchAll(MOD)) {
      checked++;
      const [a, b, r] = [Number(m[1].replace(/,/g, "")), Number(m[2]), Number(m[3])];
      if (b === 0 || a % b !== r) problems.push(`${where}: "${m[0]}" — ${a} mod ${b} is ${b === 0 ? "undefined" : a % b}, not ${r}`);
    }
  }
  return { checked, problems };
}
