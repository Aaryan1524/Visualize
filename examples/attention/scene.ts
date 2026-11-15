import { defineScene } from "../../src/core/scene.ts";
import type { Mark, Observation, Panel, Source, Teaching, Vec3 } from "../../src/core/types.ts";
import { plate } from "../../src/parts/network.ts";
import { formatNumber as fmt, grid, linked, tex } from "../../src/render/math.ts";
import { attention, softmax, steps, type AttnEvent, type AttnState } from "./model.ts";

/**
 * Hand-picked so the arithmetic is readable and the result tells a story:
 * "sat" ends up attending mostly to "cat". Q, K and V are given directly;
 * in a Transformer they are learned projections of each token's representation.
 */
export const EXAMPLE = {
  tokens: ["the", "cat", "sat"],
  Q: [
    [1, 0],
    [0, 2],
    [1, 2],
  ],
  K: [
    [1, 0],
    [0, 2],
    [0.5, 0.5],
  ],
  V: [
    [1, 0],
    [0, 1],
    [0.5, 0.5],
  ],
};
const FOCUS = 2;

const PAPER: Source = { label: "Vaswani et al. 2017, §3.2.1, Eq. 1", url: "https://arxiv.org/abs/1706.03762" };

const A = attention(EXAMPLE.tokens, EXAMPLE.Q, EXAMPLE.K, EXAMPLE.V);
const N = A.tokens.length;
const tok = (i: number) => A.tokens[i]!;
const vec = (v: readonly number[]) => `[${v.map((x) => fmt(x)).join(", ")}]`;
const num = (x: number) => (Number.isInteger(x) ? String(x) : String(x));
/** Weights to three decimals, so the followed row shown adds up to 1 (to two it would read 0.99). */
const WD = 3;
const fw = (x: number) => fmt(x, WD);
/** What the followed token's weights would be without the division by √d_k. */
const UNSCALED = softmax(A.scores[FOCUS]!);
const CAT = A.tokens.indexOf("cat");
/** Direction and length of a vector, to say why one key outscores another. */
const norm = (v: readonly number[]) => Math.hypot(...v);
const cosine = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0) / (norm(a) * norm(b));
/** The key that scores highest against the followed query, and the key that points most along it. */
const TOP_SCORE = A.scores[FOCUS]!.indexOf(Math.max(...A.scores[FOCUS]!));
const cosines = A.K.map((k) => cosine(A.Q[FOCUS]!, k));
const BEST_ALIGNED = cosines.indexOf(Math.max(...cosines));
const LENGTH_WINS = `“${tok(BEST_ALIGNED)}”’s key points closer to the query than “${tok(TOP_SCORE)}”’s does, but “${tok(TOP_SCORE)}”’s key is longer, so “${tok(TOP_SCORE)}” scores higher.`;
const VARIANCE = "If the parts of q and k are independent with mean 0 and variance 1, q · k has variance d_k, and dividing by √d_k brings it back to 1.";
const FLATTER = "Dividing the scores makes the weights flatter.";

// ---- Stage layout (world units ≈ px at 1×) ----------------------------------
const PITCH = 74;
const PLINTH: Vec3 = [48, 40, 10];
const BAR = 11; // height per unit of a vector component
const SCORE = 9; // gauge height per unit of score
const WEIGHT = 40; // gauge height for a weight of 1
const GAUGE_Y = 74;
const OUT_Y = 118;

const tx = (i: number) => i * PITCH;
const barH = (v: number) => Math.max(0.6, v * BAR);
const gaugeAt = (j: number): Vec3 => [tx(j) + PLINTH[0] / 2, GAUGE_Y, 1];

/** Which quantity the focus row's gauges show in this phase. */
function gaugeValues(s: AttnState): { values: number[]; unit: number; what: string } | null {
  const f = s.focus;
  switch (s.phase) {
    case "intro":
    case "query":
      return null;
    case "score":
      return { values: A.scores[f]!.slice(0, s.scored), unit: SCORE, what: "score" };
    case "scale":
      return { values: A.scaled[f]!, unit: SCORE, what: "scaled score" };
    default:
      return { values: A.weights[f]!, unit: WEIGHT, what: "weight" };
  }
}

function view(s: AttnState, e: AttnEvent | null): Mark[] {
  const f = s.focus;
  const marks: Mark[] = [...plate("base", [-16, -12, 0], [tx(N - 1) + PLINTH[0] + 32, OUT_Y + 34]).marks];
  // The gauge pads and output trays stand from the first step: places where
  // scores and results will appear, so the stage reads as one machine throughout.
  for (let j = 0; j < N; j++) {
    const [cx, cy] = gaugeAt(j);
    marks.push({ kind: "cylinder", key: `pad-${j}`, at: [cx, cy, 0], radius: 15, height: 1, tone: "muted", owner: `gauge-${j}` });
    marks.push({ kind: "box", key: `out-${j}`, at: [tx(j), OUT_Y, 0], size: [PLINTH[0], 20, 6], radius: 2.5, surface: { seam: 0.5 }, tone: "muted", link: `z-${j}`, owner: `out-${j}` });
  }
  const weighted = s.phase === "softmax" || s.phase === "mix" || s.phase === "all";

  for (let i = 0; i < N; i++) {
    const x = tx(i);
    const isFocus = i === f && s.phase !== "intro" && s.phase !== "all";
    marks.push({
      kind: "box",
      key: `tok-${i}`,
      at: [x, 0, 0],
      size: PLINTH,
      radius: 3,
      role: "subject",
      surface: { seam: 0.5 },
      tone: "structure",
      label: tok(i),
      labelFace: "left",
      lit: isFocus,
      link: `q-${i} k-${i} v-${i}`,
      owner: `tok-${i}`,
    });
    // Query, key and value vectors as bars at their true heights.
    const groups: [string, number[], "cold" | "hot" | "good", number][] = [
      ["q", A.Q[i]!, "cold", 4],
      ["k", A.K[i]!, "hot", 19],
      ["v", A.V[i]!, "good", 34],
    ];
    for (const [name, v, tone, ox] of groups) {
      v.forEach((value, d) => {
        marks.push({ kind: "box", key: `${name}-${i}-${d}`, at: [x + ox + d * 6, 16, PLINTH[2]], size: [5, 8, barH(value)], radius: 0.8, tone, link: `${name}-${i}`, owner: `tok-${i}` });
      });
    }
  }

  // Gauges in front of each key: score, then scaled score, then weight.
  const g = gaugeValues(s);
  if (g) {
    const max = Math.max(...g.values);
    for (let j = 0; j < N; j++) {
      const [cx, cy] = gaugeAt(j);
      const v = g.values[j];
      if (v === undefined) continue;
      const h = Math.max(0.6, v * g.unit);
      marks.push({
        kind: "cylinder",
        key: `gauge-${j}`,
        at: [cx, cy, 1],
        // Wide enough that its top holds the value it encodes.
        radius: 11,
        height: h,
        tone: "subject",
        lit: weighted && v === max,
        enter: "grow",
        label: weighted ? fw(v) : fmt(v),
        link: `q-${f} k-${j}`,
        owner: `gauge-${j}`,
      });

      // The query reaching each key, on the floor; thickness shows the weight once there is one.
      marks.push({
        kind: "link",
        key: `reach-${j}`,
        from: [tx(f) + PLINTH[0] / 2, PLINTH[1], 0],
        to: [cx, cy - 15, 0],
        width: weighted ? 1 + 7 * A.weights[f]![j]! : 1.25,
        dashed: !weighted,
        tone: weighted ? "accent" : "muted",
        layer: "floor",
      });
    }
  }

  // Outputs: a weighted mix of the values.
  const outputs = s.phase === "mix" ? [f] : s.phase === "all" ? A.tokens.map((_, i) => i) : [];
  for (const i of outputs) {
    const x = tx(i);
    A.output[i]!.forEach((value, d) => {
      marks.push({ kind: "box", key: `z-${i}-${d}`, at: [x + 17 + d * 8, OUT_Y + 6, 6], size: [6, 8, barH(value)], radius: 0.8, tone: "good", enter: "grow", link: `z-${i}`, owner: `out-${i}` });
    });
    marks.push({ kind: "label", key: `out-label-${i}`, at: [x + PLINTH[0] / 2, OUT_Y + 36, -4], text: `output for “${tok(i)}”`, size: "small", target: { key: `out-${i}`, at: [x + PLINTH[0] / 2, OUT_Y + 20, 3] } });
  }
  // On the mix step, a piece of each value, sized by its weight, travels to the output.
  if (e?.type === "mix") {
    for (let j = 0; j < N; j++) {
      const w = A.weights[f]![j]!;
      const side = 2 + 10 * w;
      marks.push({
        kind: "box",
        key: `share-${j}`,
        at: [0, 0, 0],
        size: [side, side, side],
        tone: "good",
        transient: true,
        arc: 46,
        travel: { from: [tx(j) + 36 - side / 2, 20 - side / 2, PLINTH[2] + 12], to: [tx(f) + 24 - side / 2, OUT_Y + 10 - side / 2, 8] },
      });
    }
  }
  return marks;
}

// ---- Panels ---------------------------------------------------------------------
const Qids = A.tokens.map((_, i) => `q-${i}`);
const Kids = A.tokens.map((_, i) => `k-${i}`);
const Vids = A.tokens.map((_, i) => `v-${i}`);
const EQ = tex(
  String.raw`\mathrm{Attention}(${linked(Qids, "Q")}, ${linked(Kids, "K")}, ${linked(Vids, "V")}) = \mathrm{softmax}\!\left(\frac{${linked(Qids, "Q")}${linked(Kids, "K")}^{\top}}{\sqrt{d_k}}\right)${linked(Vids, "V")}`,
  { display: true },
);

function calc(s: AttnState, e: AttnEvent | null): string {
  const f = s.focus;
  const q = String.raw`${linked(`q-${f}`, `q_{\text{${tok(f)}}}`)}`;
  switch (s.phase) {
    case "intro":
      return String.raw`d_k = ${A.dk}`;
    case "query":
      return String.raw`${q} = ${vec(A.Q[f]!)}`;
    case "score": {
      const j = e!.key!;
      const k = linked(`k-${j}`, String.raw`k_{\text{${tok(j)}}}`);
      const terms = A.Q[f]!.map((x, d) => `${num(x)}\\cdot ${num(A.K[j]![d]!)}`).join(" + ");
      return String.raw`${q}\cdot ${k} = ${terms} = ${fmt(A.scores[f]![j]!)}`;
    }
    case "scale":
      return String.raw`\frac{${vec(A.scores[f]!)}}{\sqrt{${A.dk}}} = ${vec(A.scaled[f]!)}`;
    case "softmax":
      return String.raw`\mathrm{softmax}(${vec(A.scaled[f]!)}) = [${A.weights[f]!.map(fw).join(", ")}]`;
    case "mix":
      return (
        A.weights[f]!.map((w, j) => `${fw(w)}\\,${linked(`v-${j}`, String.raw`v_{\text{${tok(j)}}}`)}`).join(" + ") +
        ` = ${vec(A.output[f]!)}`
      );
    case "all":
      return String.raw`Z = \mathrm{softmax}\!\left(QK^{\top}/\sqrt{d_k}\right)V`;
  }
}

function panels(s: AttnState, e: AttnEvent | null): Panel[] {
  const f = s.focus;
  const vectors = grid(
    A.tokens.map((_, i) => [...A.Q[i]!, ...A.K[i]!, ...A.V[i]!]),
    {
      rows: A.tokens,
      cols: ["q₁", "q₂", "k₁", "k₂", "v₁", "v₂"],
      digits: 1,
      link: (i, j) => `${["q", "k", "v"][Math.floor(j / 2)]}-${i}`,
      key: (i, j) => `vec-${i}-${j}`,
    },
  );

  // Scores, scaled scores or weights for every row revealed so far.
  const rowShown = (i: number) => (s.phase === "all" ? true : i === f);
  let matrixTitle = "Scores  q · k";
  let values = A.scores;
  let prefix = "s";
  if (s.phase === "scale") (matrixTitle = "Scaled scores  q · k / √d_k"), (values = A.scaled), (prefix = "c");
  if (s.phase === "softmax" || s.phase === "mix" || s.phase === "all") (matrixTitle = "Weights  softmax(row)"), (values = A.weights), (prefix = "w");
  const shown = (i: number, j: number) => {
    if (s.phase === "intro" || s.phase === "query") return false;
    if (!rowShown(i)) return false;
    return s.phase !== "score" || j < s.scored;
  };
  const withSums = prefix === "w";
  const matrix = grid(
    values.map((row, i) => (withSums ? [...row, row.reduce((a, b) => a + b, 0)] : row)),
    {
      rows: A.tokens.map((t) => `q ${t}`),
      cols: [...A.tokens.map((t) => `k ${t}`), ...(withSums ? ["Σ"] : [])],
      ...(withSums ? { digits: WD } : {}),
      link: (i, j) => (j < N ? `q-${i} k-${j}` : undefined),
      key: (i, j) => (shown(i, Math.min(j, N - 1)) ? (j < N ? `${prefix}-${i}-${j}` : `sum-${i}`) : undefined),
      blank: (i, j) => !shown(i, Math.min(j, N - 1)),
      tone: (i, j) => (!shown(i, Math.min(j, N - 1)) ? "vz-dim" : j === N ? "vz-dim" : prefix === "w" && i === f && values[i]![j] === Math.max(...values[i]!) ? "vz-hot" : undefined),
    },
  );

  const out: Panel[] = [
    { key: "eq", place: "side", title: "Scaled dot-product attention", html: EQ + `<div class="vz-calc">${tex(calc(s, e), { display: true })}</div>` },
    { key: "vectors", place: "side", title: "Query, key and value", html: vectors },
    { key: "matrix", place: "side", title: matrixTitle, html: matrix },
  ];
  const outRows = s.phase === "mix" ? [f] : s.phase === "all" ? A.tokens.map((_, i) => i) : [];
  if (outRows.length) {
    out.push({
      key: "output",
      place: "side",
      title: "Output  z = Σ w · v",
      html: grid(
        A.output.map((r) => r),
        {
          rows: A.tokens.map((t) => `z ${t}`),
          cols: ["z₁", "z₂"],
          key: (i, d) => (outRows.includes(i) ? `z-${i}-${d}-value` : undefined),
          blank: (i) => !outRows.includes(i),
          tone: (i) => (outRows.includes(i) ? undefined : "vz-dim"),
          link: (i) => `z-${i}`,
        },
      ),
    });
  }
  return out;
}

// ---- Captions and checks ------------------------------------------------------------
function caption(s: AttnState, e: AttnEvent): string {
  const f = s.focus;
  const w = A.weights[f]!;
  const top = w.indexOf(Math.max(...w));
  switch (e.type) {
    case "query":
      return `Follow one token. “${tok(f)}” asks how relevant every token is to it, itself included, using its query q = ${vec(A.Q[f]!)}.`;
    case "score": {
      const j = e.key!;
      const why = j === N - 1 && TOP_SCORE !== BEST_ALIGNED ? ` ${LENGTH_WINS}` : "";
      return `Score “${tok(f)}” against “${tok(j)}”: the dot product of its query with that key is ${fmt(A.scores[f]![j]!)}. A larger score earns more attention; it grows both when the key points along the query and when the key is longer.${why}`;
    }
    case "scale":
      return `Divide every score by √d_k = √${A.dk} ≈ ${fmt(Math.sqrt(A.dk))}. ${VARIANCE} The authors suspect that for large d_k the dot products grow large in magnitude, pushing softmax into regions with extremely small gradients, and scale to counteract it.`;
    case "softmax":
      return `Softmax turns the scaled scores into weights that are positive and sum to 1. “${tok(f)}” puts ${fw(w[top]!)} of its attention on “${tok(top)}”; without the division it would be ${fw(UNSCALED[top]!)}. ${FLATTER} Gauge heights now show weights.`;
    case "mix":
      return `The output for “${tok(f)}” is the values mixed in those proportions: ${w.map((x, j) => `${fw(x)} of “${tok(j)}”`).join(", ")}, giving ${vec(A.output[f]!)}.`;
    case "all":
      return `Every token does the same with its own query, all at once: this is Eq. 1 of the paper, softmax(QKᵀ/√d_k)V, one row of weights per token, each summing to 1. The stage still shows “${tok(f)}”’s weights; the weights panel shows every row.`;
    default:
      return "";
  }
}

function observe(s: AttnState): Observation[] {
  const f = s.focus;
  const obs: Observation[] = [];
  A.tokens.forEach((_, i) => [...A.Q[i]!, ...A.K[i]!, ...A.V[i]!].forEach((v, j) => obs.push({ type: "text", key: `vec-${i}-${j}`, equals: fmt(v, 1) })));
  // Bar heights are the numbers: check the drawn size, not just the label.
  A.tokens.forEach((_, i) =>
    (["q", "k", "v"] as const).forEach((name) =>
      A[name.toUpperCase() as "Q" | "K" | "V"][i]!.forEach((v, d) => obs.push({ type: "extent", key: `${name}-${i}-${d}`, size: [5, 8, barH(v)], radius: 0.8 })),
    ),
  );
  const g = gaugeValues(s);
  if (g) {
    const weighted = s.phase === "softmax" || s.phase === "mix" || s.phase === "all";
    g.values.forEach((v, j) => {
      obs.push({ type: "text", key: `gauge-${j}`, equals: weighted ? fw(v) : fmt(v) });
      obs.push({ type: "visible", key: `gauge-${j}`, visible: true });
      obs.push({ type: "extent", key: `gauge-${j}`, size: [22, 22, Math.max(0.6, v * g.unit)] });
      if (weighted) obs.push({ type: "visible", key: `reach-${j}`, visible: true });
    });
    for (let j = g.values.length; j < N; j++) obs.push({ type: "visible", key: `gauge-${j}`, visible: false });
  }
  const prefix = s.phase === "score" ? "s" : s.phase === "scale" ? "c" : "w";
  const values = prefix === "s" ? A.scores : prefix === "c" ? A.scaled : A.weights;
  if (s.phase !== "intro" && s.phase !== "query") {
    const rows = s.phase === "all" ? A.tokens.map((_, i) => i) : [f];
    for (const i of rows) {
      const count = s.phase === "score" ? s.scored : N;
      const show = prefix === "w" ? fw : (x: number) => fmt(x);
      for (let j = 0; j < count; j++) obs.push({ type: "text", key: `${prefix}-${i}-${j}`, equals: show(values[i]![j]!) });
      if (prefix === "w") obs.push({ type: "text", key: `sum-${i}`, equals: fw(values[i]!.reduce((a, b) => a + b, 0)) });
    }
  }
  const outRows = s.phase === "mix" ? [f] : s.phase === "all" ? A.tokens.map((_, i) => i) : [];
  for (const i of outRows)
    A.output[i]!.forEach((z, d) => {
      obs.push({ type: "text", key: `z-${i}-${d}-value`, equals: fmt(z) });
      obs.push({ type: "extent", key: `z-${i}-${d}`, size: [6, 8, barH(z)], radius: 0.8 });
    });
  if (s.phase !== "intro" && s.phase !== "all") obs.push({ type: "lit", key: `tok-${f}` });
  return obs;
}

const HEADING: Record<string, string> = {
  intro: "Three tokens, each with a query, key and value.",
  query: "Follow “sat”: its query asks the question.",
  scale: "Divide every score by √d_k.",
  softmax: "Softmax turns scores into weights that sum to 1.",
  mix: "Mix the values in those proportions.",
  all: `Every token does the same at once; the stage still follows “${tok(FOCUS)}”.`,
};
const CHAPTER: Record<string, string> = { intro: "Ask", query: "Ask", score: "Score", scale: "Scale", softmax: "Weigh", mix: "Mix", all: "Mix" };

function teaching(s: AttnState, e: AttnEvent | null): Teaching {
  const t: Teaching = {
    chapter: CHAPTER[s.phase]!,
    heading: s.phase === "score" ? `Score “${tok(s.focus)}” against “${tok(e!.key!)}”.` : HEADING[s.phase]!,
  };
  if (s.phase === "scale") {
    const scaled = A.weights[s.focus]![CAT]!, unscaled = UNSCALED[CAT]!;
    const answer = unscaled > scaled ? "Higher" : "Lower";
    t.prediction = {
      question: "Without the division, would cat's weight be higher or lower?",
      choices: ["Higher", "Lower"],
      answer,
      explanation: `${answer}: ${fw(unscaled)} instead of ${fw(scaled)}. ${FLATTER}`,
    };
  }
  return t;
}

export default defineScene<AttnState, AttnEvent>({
  id: "attention",
  title: "Scaled dot-product attention",
  question: "How does a token choose what to attend?",
  presentation: "editorial",
  setup: "Each token scores every token with its query, turns the scores into weights, and mixes the values.",
  teaching,
  trust: "computed",
  assumptions: [
    "This is self-attention: queries, keys and values all come from the same tokens, which is why “sat” also scores itself. Here Q, K and V are given directly. In a Transformer they are learned linear projections of each token's representation at that layer: its embedding in the first layer, the previous layer's output after that.",
    `d_k = ${A.dk} so the arithmetic is readable. The paper's base model uses 8 heads with d_k = d_v = 64 each.`,
    "One attention head, no masking, no batch. In multi-head attention each head has its own learned projections of Q, K and V; the heads run in parallel, their outputs are concatenated, and one more learned matrix projects the result. The vectors are chosen by hand; they come from no trained model.",
    "Gauge heights use one scale for scores and another for weights (full height = 1). Weights are shown to three decimals; each row sums to exactly 1 before rounding, so a row as shown can be off in the last digit.",
  ],
  trace: () => ({
    initial: { phase: "intro", focus: FOCUS, scored: 0, a: A },
    intro: `Three tokens, each carrying three small vectors: a query (what it is looking for), a key (what it can be matched on) and a value (what it passes on). Bar heights are the numbers; here d_k = ${A.dk}.`,
    steps: steps(A, FOCUS).map(({ event, state }) => ({
      event,
      state,
      caption: caption(state, event),
      ...(event.type === "scale" || event.type === "all" ? { trust: "sourced" as const, source: PAPER } : {}),
    })),
  }),
  view,
  panels,
  observe,
  readout: (s) => {
    const g = gaugeValues(s);
    if (s.phase === "all") return `${N} queries · ${N}×${N} weights · rows sum to 1`;
    if (!g) return `${N} tokens · d_k = ${A.dk}`;
    return `${g.what}s for “${tok(s.focus)}”: ${g.values.map((v) => (g.what === "weight" ? fw(v) : fmt(v))).join(" · ")}`;
  },
  timing: (e) => ({ duration: e.type === "mix" ? 1900 : e.type === "softmax" || e.type === "scale" ? 1400 : 1100 }),
  legend: [
    { tone: "cold", label: "Query" },
    { tone: "hot", label: "Key" },
    { tone: "good", label: "Value, and outputs mixed from values" },
    { tone: "subject", label: "Score, then weight, for the followed token" },
  ],
});

// The correctness audit (SKILL.md, Correctness): what the page says, checked like the picture.
const ATT = attention(EXAMPLE.tokens, EXAMPLE.Q, EXAMPLE.K, EXAMPLE.V);
const SAT = ATT.tokens.indexOf("sat");
const UNSCALED_ALL = ATT.scores.map((r) => softmax(r));
/** Var(q · k) over every q, k with independent ±1 parts (mean 0, variance 1), exactly. */
function dotVariance(dk: number, scale: number): number {
  const vecs: number[][] = Array.from({ length: 1 << dk }, (_, m) => Array.from({ length: dk }, (_, i) => ((m >> i) & 1 ? 1 : -1)));
  const dots = vecs.flatMap((q) => vecs.map((k) => q.reduce((s, x, i) => s + x * k[i]!, 0) / scale));
  const mean = dots.reduce((a, b) => a + b, 0) / dots.length;
  return dots.reduce((a, b) => a + (b - mean) ** 2, 0) / dots.length;
}
export const audit = {
  models: [ATT, EXAMPLE],
  // The variance sentence: a ±1 part has mean 0 and variance 1; q · k has variance d_k, and 1 once divided by √d_k.
  facts: [Math.sqrt(ATT.dk), ...UNSCALED_ALL.flat(), ...[[-1, 1]].flatMap((xs) => [xs.reduce((a, b) => a + b, 0) / xs.length, xs.reduce((a, b) => a + b * b, 0) / xs.length]), dotVariance(ATT.dk, 1), dotVariance(ATT.dk, Math.sqrt(ATT.dk))],
  allow: [{ value: WD, why: "display precision of the weights (three decimals), not a quantity of attention" }, { value: 8, why: "the paper's base model: 8 heads" }, { value: 64, why: "the paper's base model: d_k = d_v = 64" }],
  claims: [
    { text: "Softmax turns scores into weights that sum to 1.", test: () => ATT.weights.every((r) => Math.abs(r.reduce((a, b) => a + b, 0) - 1) < 1e-9) },
    { text: FLATTER, test: () => UNSCALED_ALL.every((u, i) => Math.max(...u) > Math.max(...ATT.weights[i]!)) && UNSCALED_ALL[SAT]![ATT.tokens.indexOf("cat")]! > ATT.weights[SAT]![ATT.tokens.indexOf("cat")]! },
    {
      text: LENGTH_WINS,
      test: () => {
        const q = ATT.Q[SAT]!, cat = ATT.tokens.indexOf("cat");
        return ATT.scores[SAT]![cat]! > ATT.scores[SAT]![SAT]! && cosine(q, ATT.K[SAT]!) > cosine(q, ATT.K[cat]!) && norm(ATT.K[cat]!) > norm(ATT.K[SAT]!);
      },
    },
    { text: VARIANCE, test: () => [ATT.dk, 3, 4].every((d) => Math.abs(dotVariance(d, 1) - d) < 1e-12 && Math.abs(dotVariance(d, Math.sqrt(d)) - 1) < 1e-12) },
    { text: "Divide every score by √d_k.", test: () => ATT.scores.every((r, i) => r.every((v, j) => Math.abs(v / Math.sqrt(ATT.dk) - ATT.scaled[i]![j]!) < 1e-12)) },
  ],
  coverage: {
    source: "Vaswani et al. 2017, Attention Is All You Need, section 3.2.1 (scaled dot-product attention)",
    topics: [
      { topic: "queries, keys and values", where: "step:1" },
      { topic: "dot-product scores", where: "step:2" },
      { topic: "scaling by the square root of d_k", where: "step:5" },
      { topic: "softmax turns scores into weights", where: "step:6" },
      { topic: "the output is the weighted sum of values", where: "step:7" },
      { topic: "every query at once, as matrices", where: "step:8" },
      { topic: "multi-head attention", where: "deferred", why: "one head shows the mechanism; Details says how heads combine (concatenate, then project)" },
      { topic: "masking", core: false, where: "deferred", why: "no causal mask in this example" },
    ],
  },
};
