// Bloom filter: the model, the truth every bit, number and caption comes from. Pure functions; the
// state after every operation is recorded. The page inlines this file (its `export` keywords removed),
// so it imports nothing.

/** 32-bit FNV-1a of a string's UTF-16 code units. */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Hash function number `i` (1-based): FNV-1a of the word with its own prefix, so the k functions differ. */
export const hashOf = (i, word) => fnv1a(`${i}:${word}`);

/** word → hash → mod m → bit, for each of the k hash functions, with each bit's value before. */
export function workingFor(bits, k, word) {
  const m = bits.length;
  return Array.from({ length: k }, (_, j) => {
    const hash = hashOf(j + 1, word);
    const bit = hash % m;
    return { fn: j + 1, hash, bit, was: bits[bit] };
  });
}

const unique = (xs) => [...new Set(xs)].sort((a, b) => a - b);

/** Test a word against bits: "maybe" only when every one of its k bits is 1. */
export function test(bits, k, word) {
  return workingFor(bits, k, word).every((w) => w.was === 1) ? "maybe" : "no";
}

export function initial(m, k, ops) {
  if (!Number.isInteger(m) || m < 2) throw new RangeError("m must be an integer of at least 2");
  if (!Number.isInteger(k) || k < 1) throw new RangeError("k must be a positive integer");
  return { m, k, bits: Array(m).fill(0), members: [], ops, done: 0, results: [] };
}

/** One operation: add sets the word's bits; ask checks them; clear is the naive delete (bits back to 0). */
export function step(s) {
  const index = s.done, o = s.ops[index];
  if (!o) throw new Error("no operations left");
  const working = workingFor(s.bits, s.k, o.word);
  const picked = unique(working.map((w) => w.bit));
  if (o.op === "add") {
    const bits = [...s.bits];
    const newly = picked.filter((b) => bits[b] === 0), already = picked.filter((b) => bits[b] === 1);
    for (const b of picked) bits[b] = 1;
    const members = s.members.includes(o.word) ? s.members : [...s.members, o.word];
    return { state: { ...s, bits, members, done: index + 1, results: [...s.results, "added"] }, event: { type: "add", word: o.word, index, working, picked, newly, already } };
  }
  if (o.op === "ask") {
    const zeros = picked.filter((b) => s.bits[b] === 0);
    const answer = zeros.length ? "no" : "maybe", member = s.members.includes(o.word);
    const result = answer === "maybe" ? (member ? "maybe" : "false-positive") : member ? "false-negative" : "no";
    return { state: { ...s, done: index + 1, results: [...s.results, result] }, event: { type: "ask", word: o.word, index, working, picked, zeros, answer, member } };
  }
  const bits = [...s.bits];
  const cleared = picked.filter((b) => bits[b] === 1);
  for (const b of picked) bits[b] = 0;
  const members = s.members.filter((w) => w !== o.word);
  const broken = members.filter((w) => test(bits, s.k, w) === "no");
  return { state: { ...s, bits, members, done: index + 1, results: [...s.results, "cleared"] }, event: { type: "clear", word: o.word, index, working, picked, cleared, broken } };
}

export function run(m, k, ops) {
  let state = initial(m, k, ops);
  const steps = ops.map(() => {
    const prev = state, next = step(state);
    state = next.state;
    return { prev, ...next };
  });
  return { m, k, steps };
}

export const setBits = (bits) => bits.reduce((n, b) => n + b, 0);
/** The textbook estimate of the false-positive rate after n insertions: (1 − e^(−kn/m))^k. */
export const fpRate = (m, k, n) => Math.pow(1 - Math.exp((-k * n) / m), k);
/** The rate for a given filled share of bits: an absent word's k bits are all 1 with chance (filled)^k. */
export const fpFromFill = (filled, k) => Math.pow(filled, k);
/** The k that minimises the false-positive rate for m bits and n items: (m/n)·ln 2. */
export const bestK = (m, n) => (m / n) * Math.LN2;
/** Bits per item needed for a target false-positive rate p, at the best k: −ln p / (ln 2)². */
export const bitsPerItem = (p) => -Math.log(p) / (Math.LN2 * Math.LN2);
/** The expected share of bits set after n insertions with k uniform hashes: 1 − (1 − 1/m)^(kn). */
export const expectedFill = (m, k, n) => 1 - Math.pow(1 - 1 / m, k * n);
/**
 * Bloom's classic estimate, (1 − (1 − 1/m)^(kn))^k: the expected fill raised to the k-th power. It
 * treats the k probed bits as independent, but they are not (they share one fixed count of set bits),
 * so for k of 2 or more it is a lower bound, a little low at small m (Bose et al., IPL 2008).
 */
export const fpRateClassic = (m, k, n) => Math.pow(expectedFill(m, k, n), k);

/** How many of m bits kn uniform hashes set: the chance of each count, 0 to m (exact, by counting). */
export function occupancy(m, draws) {
  let p = Array(m + 1).fill(0);
  p[0] = 1;
  for (let d = 0; d < draws; d++) {
    const q = Array(m + 1).fill(0);
    for (let j = 0; j <= m; j++) {
      if (!p[j]) continue;
      q[j] += (p[j] * j) / m; // lands on a bit already set
      if (j < m) q[j + 1] += (p[j] * (m - j)) / m; // sets a new one
    }
    p = q;
  }
  return p;
}
/**
 * The true expected false-positive rate with uniform, independent hashes: an absent word's k bits are all
 * set with chance (X/m)^k, where X is how many bits the n words set, averaged over X: E[(X/m)^k].
 */
export const fpRateTrue = (m, k, n) => occupancy(m, k * n).reduce((s, pj, j) => s + pj * Math.pow(j / m, k), 0);
/** The number of hash functions, 1 to `upto`, with the lowest true expected rate. */
export function bestKTrue(m, n, upto = 8) {
  let best = 1;
  for (let k = 2; k <= upto; k++) if (fpRateTrue(m, k, n) < fpRateTrue(m, best, n)) best = k;
  return best;
}

// ---------------------------------------------------------------- the story's filter
export const M = 16;
/**
 * The story with three hash functions: a bit shared at insertion (fox reuses cat's bit 6), a true
 * "maybe", a "definitely not" decided by a single 0, a false positive built from three different words'
 * bits, and a naive delete that breaks a member (clearing cat's bit 6 turns fox into a false negative).
 */
export const OPS = [
  { op: "add", word: "cat" }, { op: "add", word: "fox" }, { op: "add", word: "owl" },
  { op: "ask", word: "fox" }, { op: "ask", word: "elk" }, { op: "ask", word: "jay" },
  { op: "clear", word: "cat" }, { op: "ask", word: "fox" },
];
// What if: the same story through filters with other numbers of hash functions, around the best k
// for 16 bits and 3 words: one too few, four just above, six too many. Each variant tells the same
// story with words its own hashes make every case happen for (opsFor).
const WORDS = ["cat", "fox", "owl", "elk", "jay", "ant", "bee", "cow", "pig", "hen", "eel", "ram", "ape", "gnu", "yak", "cod", "doe", "ewe", "rat", "koi", "asp", "bat", "dog", "emu", "crow", "deer", "duck", "frog", "goat", "hare", "lark", "lion", "mole", "moth", "mule", "newt", "puma", "seal", "swan", "toad", "wolf", "wren"];
/**
 * The story's words for k hash functions: the first that make every lesson happen, preferring the
 * three-hash story's own. The second word shares a bit with the first (so deleting the first breaks
 * it: a false negative), the fourth question's word hits a 0 (definitely not), the fifth's finds every
 * bit set (a false positive).
 */
export function opsFor(k) {
  const pref = (w) => [w, ...WORDS.filter((x) => x !== w)];
  const add = (bits, w) => {
    const b = [...bits];
    for (const x of workingFor(b, k, w)) b[x.bit] = 1;
    return b;
  };
  const empty = Array(M).fill(0);
  for (const a of pref("cat")) {
    const A = add(empty, a);
    for (const b of pref("fox")) {
      if (b === a || !workingFor(A, k, b).some((x) => x.was === 1)) continue;
      const B = add(A, b);
      for (const c of pref("owl")) {
        if (c === a || c === b) continue;
        const C = add(B, c);
        const no = pref("elk").find((w) => ![a, b, c].includes(w) && test(C, k, w) === "no");
        const fp = pref("jay").find((w) => ![a, b, c, no].includes(w) && test(C, k, w) === "maybe");
        if (!no || !fp) continue;
        return [{ op: "add", word: a }, { op: "add", word: b }, { op: "add", word: c }, { op: "ask", word: b }, { op: "ask", word: no }, { op: "ask", word: fp }, { op: "clear", word: a }, { op: "ask", word: b }];
      }
    }
  }
  throw new Error(`no words make every case happen with k = ${k}`);
}
export const VARIANTS = {
  one: { label: "1", k: 1 },
  three: { label: "3", k: 3 },
  four: { label: "4", k: 4 },
  six: { label: "6", k: 6 },
};
/** The story's filter, the one the page opens on. */
export const BASE = "three";

export function makeModel(v) {
  const k = v.k, ops = opsFor(k), r = run(M, k, ops), after = r.steps[2].state, n = after.members.length, on = setBits(after.bits);
  const pct = (p) => 100 * p;
  // the true expected rate for every number of hash functions, for these n words in M bits: the What if's trade-off
  const byK = Array.from({ length: 8 }, (_, i) => fpRateTrue(M, i + 1, n));
  // Numbers the page states, derived here so the audit can find them: every hash, bit and count of
  // the run, and the rates and sizing rules the false-positive step quotes.
  const facts = [
    ...r.steps.flatMap((st) => st.event.working.flatMap((w) => [w.hash, w.bit])),
    ...r.steps.map((st) => setBits(st.state.bits)),
    ...Array.from({ length: M + 1 }, (_, i) => i),
    k, n, on, fpFromFill(on / M, k), pct(fpFromFill(on / M, k)), fpRate(M, k, n), pct(fpRate(M, k, n)), fpRateClassic(M, k, n), pct(fpRateClassic(M, k, n)),
    ...byK, ...byK.map(pct), bestKTrue(M, n),
    M * expectedFill(M, k, n), bestK(M, n), bitsPerItem(0.01), Math.round(bitsPerItem(0.01)), Math.round(bestK(bitsPerItem(0.01), 1)), 0.01, 1, 2,
    1 / Math.LN2, Math.log2(100), bitsPerItem(0.001) - bitsPerItem(0.01), 100,
  ];
  return { v, m: M, k, n, steps: r.steps, ops, facts, expected: byK };
}

export const MODELS = Object.fromEntries(Object.entries(VARIANTS).map(([key, v]) => [key, makeModel(v)]));
