// The correctness layer: what a page says is checked, not only what its model computes.
//
// Round 5 of the evals lost on words, not on the model. The derailleur's model solved the cage
// angle correctly, but its narration said the cage spring swings the cage forward (it pulls it
// back), a heading said 60° where the readout said 37°, and the intro said 75 mm where Details
// said 73. Limit screws were never taught, because no list of topics existed to miss them from.
//
// audit() runs at build time and returns problems, one line each:
//   numbers   every number in the page's text exists in the model, at the precision shown
//   claims    each cause-and-effect sentence is on the page word for word and passes a test
//             against every variant's model
//   coverage  the field's core topics, each taught (a step, the lab, What if) or deferred with a
//             reason that Details states, with the source the list came from
//   review    a fresh reviewer's verdicts (review.json beside the build), stamped with a hash of the
//             current text: an edit after the review makes it stale
//
// Zero dependencies; used by src/drawing/page.mjs and by concept builds.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------- numbers in text
const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };
const NUMWORD = [...Object.keys(ONES), ...Object.keys(TENS), ...Object.keys(SCALE)].sort((x, y) => y.length - x.length).join("|");
const WORD = new RegExp(`\\b(?:${NUMWORD})\\b(?:(?:[-\\s]+(?:and[-\\s]+)?)(?:${NUMWORD})\\b)*`, "gi");

function wordsValue(phrase) {
  let total = 0, cur = 0, any = false;
  for (const w of phrase.toLowerCase().split(/[-\s]+/).filter((x) => x && x !== "and")) {
    if (w in ONES) (cur += ONES[w]), (any = true);
    else if (w in TENS) (cur += TENS[w]), (any = true);
    else if (w === "hundred") (cur = (cur || 1) * 100), (any = true);
    else if (w in SCALE) (total += (cur || 1) * SCALE[w]), (cur = 0), (any = true);
  }
  return any ? total + cur : null;
}

const APPROX = /\b(about|around|roughly|nearly|almost|approximately|some|~)\s*$/i;
const ATLEAST = /\b(more than|over|above|at least|upwards of)\s*$/i;
const ATMOST = /\b(less than|under|below|at most|up to|within)\s*$/i;

/**
 * Every number a reader sees in `text`: digits ("2.67", "1,200", "±0.10", "11–34"), number words of
 * three or more ("seventy-five", "ninety thousand"; "one" and "two" are too often not quantities),
 * and "<n> tenths". Each with the precision it is written to and any hedge before it.
 */
export function numbersIn(text) {
  const out = [];
  const plain = String(text).replace(/<[^>]+>/g, " ");
  const hedge = (i) => {
    const before = plain.slice(Math.max(0, i - 24), i);
    return APPROX.test(before) ? "approx" : ATLEAST.test(before) ? "atleast" : ATMOST.test(before) ? "atmost" : null;
  };
  // digits; a digit glued to letters (an id like "k10", "h1", "T2") is a name, not a quantity
  for (const m of plain.matchAll(/(?<![\p{L}_\d.,])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\p{L}_]*\d)/gu)) {
    const raw = m[0], value = Number(raw.replace(/,/g, "")), dec = m[2]?.length ?? 0;
    out.push({ raw, value, step: Math.pow(10, -dec), hedge: hedge(m.index), at: m.index });
  }
  for (const m of plain.matchAll(WORD)) {
    const phrase = m[0].trim().replace(/[-\s]+(and)?$/i, "");
    let v = wordsValue(phrase);
    if (v === null || v < 3) continue;
    const after = plain.slice(m.index + m[0].length, m.index + m[0].length + 14);
    let step = v >= 1000 ? Math.pow(10, Math.floor(Math.log10(v)) - 1) : 1;
    if (/^\s*tenths?\b/i.test(after)) (v /= 10), (step = 0.1);
    else if (/^\s*hundredths?\b/i.test(after)) (v /= 100), (step = 0.01);
    out.push({ raw: phrase, value: v, step, hedge: hedge(m.index), at: m.index, words: true });
  }
  return out;
}

// A number matches a fact when it is the fact written to the precision shown, or, with a hedge,
// close in the hedge's direction. Facts are compared as given, in percent, and across mm and m.
function matches(n, v) {
  const forms = [v, v * 100, v / 1000, v * 1000, -v];
  return forms.some((f) => {
    if (!Number.isFinite(f)) return false;
    if (Math.abs(n.value - f) <= n.step / 2 + 1e-9 * Math.max(1, Math.abs(f))) return true;
    if (n.hedge === "approx") return Math.abs(n.value - f) <= Math.max(n.step / 2, 0.05 * Math.abs(f));
    if (n.hedge === "atleast") return n.value <= f + 1e-9 && n.value >= 0.8 * f;
    if (n.hedge === "atmost") return n.value >= f - 1e-9 && n.value <= 1.25 * f;
    return false;
  });
}

/** Every finite number reachable in a model (plain data and zero-argument getters), for matching. */
export function factsFrom(model, depth = 3, seen = new Set()) {
  const out = [];
  const walk = (x, d) => {
    if (typeof x === "number") return Number.isFinite(x) && out.push(x);
    if (!x || typeof x !== "object" || d <= 0 || seen.has(x)) return;
    seen.add(x);
    const vals = Array.isArray(x) ? x.slice(0, 200) : Object.values(x);
    for (const v of vals) walk(v, d - 1);
  };
  walk(model, depth);
  return out;
}

// ---------------------------------------------------------------- the page's text
/** Every string a reader can see, gathered from a build's data (skipping audio, SVG and ids). */
export function textsOf(data, where = "data") {
  const out = [];
  const skip = new Set(["audio", "svg", "type", "links", "id", "ids", "key", "variant", "href", "base"]);
  const walk = (x, path) => {
    if (typeof x === "string") return x.trim() && out.push({ where: path, text: x });
    if (!x || typeof x !== "object") return;
    for (const [k, v] of Array.isArray(x) ? x.entries() : Object.entries(x)) if (!skip.has(String(k))) walk(v, `${path}.${k}`);
  };
  walk(data, where);
  return out;
}

export const stampOf = (texts, claims = []) =>
  createHash("sha256").update(JSON.stringify([texts.map((t) => t.text).sort(), claims.map((c) => c.text)])).digest("hex").slice(0, 16);

// ---------------------------------------------------------------- the audit
/**
 * @param {object} a
 * @param {{where: string, text: string}[]} a.texts     everything a reader sees (see textsOf)
 * @param {object[]} a.models                           the model for every variant
 * @param {number[]} [a.facts]                          extra numbers the page may state, derived in the build
 * @param {{value: number, why: string}[]} [a.allow]    numbers that are not quantities of the subject (a test's step size)
 * @param {{text: string, test: (model: object, i: number) => boolean}[]} a.claims
 * @param {{source: string, topics: {topic: string, core?: boolean, where: string, why?: string}[]}} a.coverage
 * @param {string[]} a.places                           where a topic may be taught: "step:1".."step:n", "lab", "whatif", "practice"
 * @param {string} a.details                            the Details text, where deferred core topics must be named
 * @param {string} [a.reviewFile]                       review.json beside the build
 */
export function audit(a) {
  const problems = [];
  const known = [...a.models.flatMap((m) => factsFrom(m)), ...(a.facts ?? []), ...(a.allow ?? []).map((x) => x.value)];
  const pageText = a.texts.map((t) => t.text).join("\n").toLowerCase().replace(/\s+/g, " ");

  // numbers
  const bad = new Map();
  for (const t of a.texts) {
    for (const n of numbersIn(t.text)) {
      if (known.some((v) => matches(n, v))) continue;
      const k = `${n.raw}`;
      if (!bad.has(k)) bad.set(k, `numbers: "${n.raw}" in ${t.where} ("…${t.text.slice(Math.max(0, n.at - 30), n.at + 30).replace(/\s+/g, " ")}…") is not in the model; compute it there, or allow it with a reason`);
    }
  }
  problems.push(...bad.values());

  // claims
  if (!a.claims?.length) problems.push("claims: none declared; pair each cause-and-effect sentence on the page with a test against the model");
  for (const c of a.claims ?? []) {
    const said = c.text.toLowerCase().replace(/\s+/g, " ");
    if (!pageText.includes(said)) problems.push(`claims: "${c.text}" is not on the page word for word; a claim must be the sentence the reader sees`);
    a.models.forEach((m, i) => {
      let ok = false;
      try {
        ok = c.test(m, i) === true;
      } catch (e) {
        problems.push(`claims: "${c.text}" threw on variant ${i}: ${e.message}`);
        return;
      }
      if (!ok) problems.push(`claims: "${c.text}" is false for variant ${i} by the model`);
    });
  }

  // coverage
  const cov = a.coverage;
  if (!cov?.topics?.length) problems.push("coverage: no topic list; write down what the field teaches for this subject before building");
  else {
    if (!cov.source || cov.source.length < 12) problems.push("coverage: name the source of the topic list (a manual, a textbook, a reference page)");
    const core = cov.topics.filter((t) => t.core !== false);
    if (core.length < 4) problems.push(`coverage: only ${core.length} core topics; a subject worth a page has at least four`);
    for (const t of cov.topics) {
      if (t.where === "deferred") {
        if (!t.why) problems.push(`coverage: "${t.topic}" is deferred without a reason`);
        if (t.core !== false && !a.details.toLowerCase().includes(t.topic.toLowerCase())) problems.push(`coverage: core topic "${t.topic}" is deferred but Details does not say so`);
      } else if (!a.places.includes(t.where)) problems.push(`coverage: "${t.topic}" is placed at "${t.where}", which is not on the page (${a.places.join(", ")})`);
    }
    const taught = core.filter((t) => t.where !== "deferred").length;
    if (core.length && taught / core.length < 0.75) problems.push(`coverage: only ${taught} of ${core.length} core topics are taught`);
  }

  // review
  const stamp = stampOf(a.texts, a.claims ?? []);
  let review = "missing";
  if (a.reviewFile && existsSync(a.reviewFile)) {
    try {
      const r = JSON.parse(readFileSync(a.reviewFile, "utf8"));
      // A finding is closed when the reviewer has checked the fix on the current text (fixed: true),
      // or has accepted the author's answer (resolved: true with a response saying why the text stands).
      const open = (r.findings ?? []).filter((f) => !(f.fixed === true || (f.resolved && String(f.response ?? "").trim().length > 8)));
      // One review may cover several variants of a page: "stamps" lists each text it read.
      const read = [r.stamp, ...(r.stamps ?? [])].filter(Boolean);
      review = !read.includes(stamp) ? "stale" : open.length ? "open" : "current";
      if (review === "open") problems.push(...open.map((f) => `review: open finding: ${f.finding}`));
    } catch (e) {
      problems.push(`review: ${a.reviewFile} is not valid JSON (${e.message})`);
    }
  }
  if (review === "missing") problems.push(`review: no independent review; run node scripts/review-brief.mjs <build> and give the brief to a fresh reviewer (stamp ${stamp})`);
  if (review === "stale") problems.push(`review: the text changed after the review (now stamp ${stamp}); review again`);

  return { ok: problems.length === 0, problems, stamp, review, counts: { texts: a.texts.length, claims: a.claims?.length ?? 0, topics: cov?.topics?.length ?? 0 } };
}
