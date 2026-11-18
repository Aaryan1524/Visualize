// Bloom filter: the story, in one place: steps, headings, captions, the narration, and the claims and
// topics the audit holds the page to. build.mjs, voice.mjs and the tests all read it.
//
// Every number is written from the model; each cause-and-effect sentence in CLAIMS appears on the page
// word for word, with a test against the model.

import { MODELS, BASE, OPS, M as BITS, bestK, bitsPerItem, expectedFill, fpFromFill, fpRate, fpRateExact, setBits, test, workingFor } from "./model.mjs";

// Steps: step 0 is the concept (no tab); each later step is one operation. `shot` names what the camera
// centres on (lit); `subject` every part the heading names, which must stay in frame. Names: "card" (the
// word and its hash arrows), "hashed" (the bits this word's hashes pick), "bitN" (one bit).
// Step 3 has no shot: with six hash functions owl's bits reach across the whole array, and once three
// words are in, the whole filter is the thing to look at.
const TABS = ["Add cat", "Add fox", "Add owl", "Ask fox", "Ask elk", "Ask jay", "Delete cat", "Ask again"];
const shot = (k) => (k === 3 ? { subject: ["card"] } : { shot: ["card", "hashed"], subject: ["card", "hashed"] });
export const STEPS = [{ tab: null, focus: null }, ...TABS.map((tab, i) => ({ tab, focus: null, ...shot(i + 1) }))];
/** The step that asks the prediction, about the next one: the false positive. */
export const PRED_STEP = 5;

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
const say = (n) => NUM[n] ?? String(n);
export const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const fmt = (n) => n.toLocaleString("en-US");
const pct = (p) => `${(100 * p).toFixed(1)}%`;
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const bitN = (n) => (n === 1 ? "bit" : "bits");
const isAre = (n) => (n === 1 ? "is" : "are");
const wasWere = (n) => (n === 1 ? "was" : "were");
const bitsOf = (e) => e.picked;

/** Which words set a bit before operation `upto`, for saying who a false positive borrowed from. */
function setters(steps, upto, bit) {
  const who = [];
  for (const st of steps.slice(0, upto)) if (st.event.type === "add" && st.event.working.some((w) => w.bit === bit) && !who.includes(st.event.word)) who.push(st.event.word);
  return who;
}
const hashes = (k) => (k === 1 ? "One hash function" : `${cap(say(k))} hash functions`);

/** The headings, one a step, from the model. */
export const headings = (Mo) => ["How can a few bits test membership?", ...Mo.steps.map((st, i) => heading(Mo, st.event, i + 1))];

function heading(Mo, e, index) {
  const bits = bitsOf(e);
  if (e.type === "add") {
    if (e.already.length) return `Add ${e.word}: ${bitN(e.already.length)} ${list(e.already)} ${wasWere(e.already.length)} already 1.`;
    return index === 1 ? `Add ${e.word}: set ${bitN(bits.length)} ${list(bits)} to 1.` : `Add ${e.word}: ${e.newly.length} more ${bitN(e.newly.length)} set.`;
  }
  if (e.type === "clear") return `Delete ${e.word} by clearing ${bitN(bits.length)} ${list(bits)}.`;
  if (e.answer === "no") return e.member ? `Ask for ${e.word} again: bit ${e.zeros[0]} is 0. A false negative.` : `Ask for ${e.word}: bit ${e.zeros[0]} is 0. Definitely not.`;
  const all = bits.length === 1 ? "its bit is 1" : "every bit is 1";
  return e.member ? `Ask for ${e.word}: ${all}. Maybe in the set.` : `Ask for ${e.word}: ${all}. A false positive.`;
}

/** The Details caption for each step. */
export const captions = (Mo) => [
  `An empty Bloom filter: ${Mo.m} bits, all 0, and ${say(Mo.k)} hash function${Mo.k > 1 ? "s" : ""}. Each word is hashed, each hash is reduced mod ${Mo.m}, and the bits it picks are set or checked.`,
  ...Mo.steps.map((st) => caption(Mo, st.prev, st.state, st.event)),
];

function caption(Mo, prev, s, e) {
  const k = Mo.k, STEPS_ = Mo.steps;
  const work = e.working.map((w) => `h${w.fn}(${e.word}) = ${fmt(w.hash)}, and ${fmt(w.hash)} mod ${s.m} = ${w.bit}`).join("; ");
  const bits = bitsOf(e);
  if (e.type === "add") {
    const shared = e.already.map((b) => `Bit ${b} was already 1, set by ${list(setters(STEPS_, e.index, b))}, so ${e.word} shares it.`).join(" ");
    const on = setBits(s.bits);
    return `Adding ${e.word}: ${work}. ${cap(bitN(bits.length))} ${list(bits)} ${bits.length === 1 ? "becomes" : "become"} 1; the word itself is not stored. ${shared}`.trim() + ` ${on} of ${s.m} bits ${isAre(on)} now 1.`;
  }
  if (e.type === "clear") {
    const shared = e.cleared.filter((b) => STEPS_.slice(0, e.index).some((st) => st.event.type === "add" && st.event.word !== e.word && st.event.working.some((w) => w.bit === b)));
    const owners = (b) => list(setters(STEPS_, e.index, b).filter((w) => w !== e.word));
    const pairs = shared.map((b, i) => (i === 0 ? `Bit ${b} also belonged to ${owners(b)}` : `bit ${b} to ${owners(b)}`));
    const result = shared.length === 1 && e.broken.length === 1 ? `so clearing it erases ${e.broken[0]}'s share too` : `so clearing ${shared.length > 1 ? "them" : "it"} leaves ${list(e.broken)} each testing as absent`;
    const broke = e.broken.length ? ` ${list(pairs)}, ${result}.` : ` None of the other words used ${bits.length > 1 ? "these bits" : "this bit"}, so this time nothing else is damaged, but the filter cannot know that in general.`;
    return `A plain Bloom filter has no delete. Clearing ${e.word}'s bits is the naive attempt: ${work}.${broke}`;
  }
  if (e.answer === "maybe") {
    if (e.member) return `Asking for ${e.word}: ${work}. ${bits.length > 1 ? `All ${bits.length} of its bits are` : "Its bit is"} 1, so the filter answers maybe in the set. ${cap(e.word)} was added, so here the maybe is right.`;
    const from = [...new Set(bits.flatMap((b) => setters(STEPS_, e.index, b)))].sort((a, b) => OPS.findIndex((o) => o.word === a) - OPS.findIndex((o) => o.word === b));
    const on = setBits(prev.bits), n = prev.members.length, m = prev.m;
    const avg = m * expectedFill(m, k, n);
    const vsAverage = on > avg ? " This run set more bits than average." : on < avg ? " This run set fewer bits than average." : "";
    return `Asking for ${e.word}: ${work}. ${cap(e.word)} was never added, but ${list(from)} set ${bits.length > 1 ? "all of its bits" : "its bit"}, so the filter answers maybe: a false positive. ` +
      `With ${on} of ${m} bits set, a word that was never added passes with chance about (${on}/${m})^${k} = ${pct(fpFromFill(on / m, k))}. ` +
      `On average ${n} words set about ${avg.toFixed(1)} of ${m} bits, for an expected rate of (1 − (1 − 1/m)^(kn))^k = ${pct(fpRateExact(m, k, n))}; the textbook formula (1 − e^(−kn/m))^k, an approximation for large m, gives ${pct(fpRate(m, k, n))}.${vsAverage} ` +
      `The best number of hash functions here is (m/n) ln 2 ≈ ${bestK(m, n).toFixed(1)}: each extra hash checks one more bit, which helps, but also sets more bits, which hurts. ` +
      `Real filters are sized from the target: about ${bitsPerItem(0.01).toFixed(1)} bits per item give a 1% rate, with ${Math.round(bestK(bitsPerItem(0.01), 1))} hash functions.`;
  }
  const zero = e.zeros[0];
  if (e.member)
    return `Asking for ${e.word} again: ${work}. Bit ${zero} is 0, so the filter answers definitely not, yet ${e.word} was added: a false negative, which a Bloom filter must never give. ` +
      `A counting Bloom filter fixes this by keeping a small counter in each position instead of a bit: adding increments the counters and deleting decrements them, so a shared position stays above 0 until every word that set it is gone. ` +
      `It is safe only for deleting words that were really added: deleting a false positive would decrement other words' counters and could cause false negatives too. The counters, often 4 bits each, can also overflow, and they cost about four times the space of plain bits.`;
  return `Asking for ${e.word}: ${work}. Bit ${zero} is 0, and adding ${e.word} would have set it, so ${e.word} was never added: the answer is definitely not. One 0 is enough, and while no bit is ever cleared, this answer is always right. ` +
    `It is the answer that saves work: a database that keeps a Bloom filter in memory skips a disk read whenever the filter says definitely not.`;
}

/** The narration, one string a step. [phrase|part] lights those parts while they are spoken. */
export const script = (Mo) => [
  `A Bloom filter answers one question: is this item in the set? It never stores the items, only a row of bits, so it stays tiny: about ten bits per item for a one percent error rate, however long the items are. That makes it a cheap first check: a database can skip a disk read whenever the filter says no. The price is that it can say maybe when the truth is no. Here are ${say(Mo.m)} bits, all zero, and ${say(Mo.k)} hash function${Mo.k > 1 ? "s" : ""}.`,
  ...Mo.steps.map((st, i) => voice(Mo, st.state, st.event, i + 1)),
];

function voice(Mo, s, e, index) {
  const STEPS_ = Mo.steps, bits = bitsOf(e);
  const named = (b) => `[bit ${say(b)}|bit${b}]`;
  const word = `[${e.word}|card]`;
  const its = bits.length === 1 ? `Its bit, ${named(bits[0])}, becomes one.` : `Its bits, ${list(bits.map(named))}, become one.`;
  if (e.type === "add") {
    const first = index === 1 ? `To add ${word}, each hash function turns the word into a big number, and the remainder after dividing by ${say(s.m)} picks a bit. ` : `Now ${word}. `;
    const by = [...new Set(e.already.flatMap((b) => setters(STEPS_, e.index, b)))];
    const shared = e.already.length ? ` ${e.already.map((b) => `${named(b)} was already one, set by ${list(setters(STEPS_, e.index, b))}.`).join(" ")} So ${e.word} now shares bits with ${list(by)}.` : "";
    return `${first}${its}${shared}${index === 3 ? ` The filter now holds ${say(setBits(s.bits))} ones, and no words at all.` : ""}`;
  }
  if (e.type === "clear") {
    const shared = e.cleared.filter((b) => STEPS_.slice(0, e.index).some((st) => st.event.type === "add" && st.event.word !== e.word && st.event.working.some((w) => w.bit === b)));
    return e.broken.length
      ? `There's no delete in a Bloom filter. Suppose we try anyway, and clear [${e.word}'s bits|hashed] back to zero. But ${list(shared.map((b) => `${named(b)} belonged to ${list(setters(STEPS_, e.index, b).filter((w) => w !== e.word))}`))} as well.`
      : `There's no delete in a Bloom filter. Suppose we clear [${e.word}'s bits|hashed] anyway. This time no other word used them, but the filter has no way to know that.`;
  }
  if (e.answer === "maybe") {
    if (e.member) return `Now a question. Is ${word} in the set? Hash it the same way. ${bits.length === 1 ? `${named(bits[0])} is one` : `${list(bits.map(named))} are all one`}, so the answer is maybe. And it's right: ${e.word} was added.`;
    return `${cap(e.word)} was never added. But ${bits.length === 1 ? `its bit, ${named(bits[0])}, was set by another word` : `its bits, ${list(bits.map(named))}, were all set by other words`}. So the filter says maybe. That's a false positive: the one kind of mistake a Bloom filter makes. The more bits are set, the more often it happens.`;
  }
  const zero = named(e.zeros[0]);
  if (e.member) return `Now ask for ${word} again. ${zero} is zero, so the filter says definitely not, and that's wrong. A Bloom filter must never say no to something it holds. That's why it has no delete. A counting Bloom filter keeps a small counter instead of each bit, so deleting takes away only its own share, as long as you only delete what you really added.`;
  return `Is ${word} in the set? ${zero} is zero. If ${e.word} had been added, that bit would be one. So the answer is definitely not. As long as no bit is ever cleared, that answer is always right.`;
}

// ---------------------------------------------------------------- the claims, against the story's filter
// Each sentence is said of the three-hash story (the filter the page opens on), so each test runs on it.
const RUN = MODELS[BASE];
const at = (n) => RUN.steps[n - 1];
const AFTER_ADDS = at(3).state;
const K = RUN.k;
const pos = (w) => [...new Set(workingFor(Array(BITS).fill(0), K, w).map((x) => x.bit))].sort((a, b) => a - b);
export const CLAIMS = [
  { text: "Bit 6 was already 1, set by cat, so fox shares it", test: () => at(2).event.type === "add" && at(2).event.already.join() === "6" && at(1).event.working.some((w) => w.bit === 6) },
  { text: "the word itself is not stored", test: () => Object.keys(AFTER_ADDS).every((key) => key !== "words") && AFTER_ADDS.bits.every((b) => b === 0 || b === 1) },
  { text: "All 3 of its bits are 1, so the filter answers maybe in the set", test: () => { const e = at(4).event; return e.type === "ask" && e.answer === "maybe" && e.zeros.length === 0 && e.member && e.picked.length === 3; } },
  { text: "Bit 0 is 0, and adding elk would have set it, so elk was never added: the answer is definitely not", test: () => { const e = at(5).event; return e.type === "ask" && e.word === "elk" && e.zeros[0] === 0 && !e.member && e.answer === "no"; } },
  { text: "Jay was never added, but cat, fox and owl set all of its bits, so the filter answers maybe: a false positive", test: () => { const e = at(6).event; return e.type === "ask" && e.word === "jay" && !e.member && e.answer === "maybe" && ["cat", "fox", "owl"].every((w) => RUN.steps.find((st) => st.event.type === "add" && st.event.word === w).event.working.some((x) => e.picked.includes(x.bit))); } },
  { text: "Bit 6 also belonged to fox, so clearing it erases fox's share too", test: () => { const e = at(7).event; return e.type === "clear" && e.cleared.includes(6) && e.broken.join() === "fox" && at(2).event.working.some((w) => w.bit === 6) && !at(3).event.working.some((w) => w.bit === 6); } },
  { text: "Bit 6 is 0, so the filter answers definitely not, yet fox was added: a false negative, which a Bloom filter must never give", test: () => { const e = at(8).event; return e.type === "ask" && e.word === "fox" && e.zeros[0] === 6 && e.answer === "no" && at(4).event.type === "ask"; } },
  {
    text: "adding increments the counters and deleting decrements them, so a shared position stays above 0 until every word that set it is gone",
    test: () => {
      // a counting filter over the same operations: fox's position 6 survives cat's delete
      const counts = Array(BITS).fill(0);
      for (const w of ["cat", "fox", "owl"]) for (const b of pos(w)) counts[b]++;
      for (const b of pos("cat")) counts[b]--;
      return pos("fox").every((b) => counts[b] > 0) && pos("cat").filter((b) => !pos("fox").includes(b) && !pos("owl").includes(b)).every((b) => counts[b] === 0);
    },
  },
  {
    text: "each extra hash checks one more bit, which helps, but also sets more bits, which hurts",
    test: () => {
      // over k = 1…6 for these sizes the rate falls and then rises again, lowest next to (m/n) ln 2
      const r = [1, 2, 3, 4, 5, 6].map((k) => fpRateExact(BITS, k, 3));
      const best = r.indexOf(Math.min(...r)) + 1;
      return r[0] > r[best - 1] && r[5] > r[best - 1] && Math.abs(best - bestK(BITS, 3)) < 1 && expectedFill(BITS, 6, 3) > expectedFill(BITS, 3, 3);
    },
  },
  {
    text: "deleting a false positive would decrement other words' counters and could cause false negatives too",
    test: () => {
      // a counting filter holding cat, fox and owl; jay tests maybe (a false positive); deleting jay zeroes a counter a member needs
      const counts = Array(BITS).fill(0);
      for (const w of ["cat", "fox", "owl"]) for (const b of pos(w)) counts[b]++;
      if (!pos("jay").every((b) => counts[b] > 0)) return false;
      for (const b of pos("jay")) counts[b]--;
      return ["cat", "fox", "owl"].some((w) => pos(w).some((b) => counts[b] === 0));
    },
  },
  { text: "If elk had been added, that bit would be one", test: () => workingFor(AFTER_ADDS.bits, K, "elk").some((w) => w.bit === 0) && test(AFTER_ADDS.bits, K, "elk") === "no" },
];

/** The field's core topics, each placed on the page, and the source the list came from. */
export const COVERAGE = {
  source: "Bloom, \"Space/Time Trade-offs in Hash Coding with Allowable Errors\" (CACM 13(7), 1970); Wikipedia, Bloom filter (Algorithm description, Probability of false positives, Optimal number of hash functions, Counting Bloom filters); Mitzenmacher & Upfal, Probability and Computing, section 5.5.3; Fan, Cao, Almeida & Broder, \"Summary Cache\" (IEEE/ACM ToN 8(3), 2000) for counting Bloom filters",
  topics: [
    { topic: "an array of m bits, all 0, and k hash functions", where: "step:0" },
    { topic: "adding: each hash picks a bit (hash mod m) and sets it to 1", where: "step:1" },
    { topic: "items share bits; the items themselves are not stored", where: "step:2" },
    { topic: "querying: all k bits 1 means maybe in the set", where: "step:4" },
    { topic: "any 0 bit means definitely not; no false negatives", where: "step:5" },
    { topic: "false positives from bits set by other items", where: "step:6" },
    { topic: "the false-positive rate (1 − e^(−kn/m))^k", where: "step:6" },
    { topic: "the number of hash functions trades off: too few or too many raise the rate; best k = (m/n) ln 2", where: "whatif" },
    { topic: "sizing: bits per item for a target rate", where: "step:6" },
    { topic: "no deletion: clearing bits causes false negatives", where: "step:8" },
    { topic: "counting Bloom filters support deletion", where: "step:8" },
    { topic: "uses: a cheap check before an expensive lookup, such as a database skipping a disk read", core: false, where: "step:5" },
    { topic: "counting filter caveats: delete only inserted items; counter overflow; about 4 times the space", core: false, where: "step:8" },
    { topic: "how the hash functions are built (double hashing)", core: false, where: "deferred", why: "named in Details" },
  ],
};

// ---------------------------------------------------------------- Now you try
const POOL = ["ant", "bee", "cow", "pig", "hen", "eel", "ram", "ape", "gnu", "yak", "cod", "doe", "ewe", "rat", "koi", "asp", "bat", "cat", "dog", "elk", "emu", "fox", "jay", "owl"];
/** A fresh filter of three random words and a word to ask about; the model decides the answer. */
export function practice(seed, rand, k = K) {
  const want = ["member", "false-positive", "no"][seed % 3];
  for (let tries = 0; tries < 5000; tries++) {
    const pool = [...POOL];
    const pick = () => pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const words = [pick(), pick(), pick()];
    const ask = want === "member" ? words[Math.floor(rand() * 3)] : pick();
    const bits = Array(BITS).fill(0);
    for (const w of words) for (const x of workingFor(bits, k, w)) bits[x.bit] = 1;
    const answer = test(bits, k, ask), kind = answer === "no" ? "no" : words.includes(ask) ? "member" : "false-positive";
    if (kind !== want) continue;
    const on = bits.flatMap((b, i) => (b ? [i] : []));
    const its = [...new Set(workingFor(bits, k, ask).map((w) => w.bit))].sort((a, b) => a - b);
    const zero = its.find((b) => bits[b] === 0);
    return {
      q: `A ${BITS}-bit filter with ${k} hash function${k > 1 ? "s" : ""} holds ${list(words)}. Bits set: ${list(on)}. Asking for "${ask}" checks ${bitN(its.length)} ${list(its)}. What does it answer?`,
      answer: answer === "maybe" ? "Maybe in the set" : "Definitely not",
      explain: answer === "maybe" ? `Maybe in the set: ${bitN(its.length)} ${list(its)} ${its.length === 1 ? "is" : "are all"} 1${words.includes(ask) ? `, because ${ask} was added` : `, though ${ask} was never added: a false positive`}.` : `Definitely not: bit ${zero} is 0, and adding "${ask}" would have set it.`,
    };
  }
  throw new Error("practice: no question of that kind found");
}
