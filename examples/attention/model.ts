// Scaled dot-product attention (Vaswani et al. 2017, §3.2.1, Eq. 1):
//   Attention(Q, K, V) = softmax(Q Kᵀ / √d_k) V
// computed exactly on a tiny example, with every intermediate kept.

export type Matrix = number[][];

export function shape(m: Matrix): [number, number] {
  return [m.length, m[0]?.length ?? 0];
}

export function transpose(m: Matrix): Matrix {
  const [r, c] = shape(m);
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => m[i]![j]!));
}

export function matmul(a: Matrix, b: Matrix): Matrix {
  const [n, k] = shape(a);
  const [k2, m] = shape(b);
  if (k !== k2) throw new Error(`shape mismatch: ${n}×${k} · ${k2}×${m}`);
  return a.map((row) => Array.from({ length: m }, (_, j) => row.reduce((s, x, t) => s + x * b[t]![j]!, 0)));
}

export function dot(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error(`length mismatch: ${a.length} vs ${b.length}`);
  return a.reduce((s, x, i) => s + x * b[i]!, 0);
}

/** Row-wise softmax, shifted by the row maximum for numerical stability. */
export function softmax(row: readonly number[]): number[] {
  const max = Math.max(...row);
  const e = row.map((x) => Math.exp(x - max));
  const sum = e.reduce((s, x) => s + x, 0);
  return e.map((x) => x / sum);
}

export interface Attention {
  tokens: string[];
  Q: Matrix;
  K: Matrix;
  V: Matrix;
  dk: number;
  /** Q Kᵀ */
  scores: Matrix;
  /** Q Kᵀ / √d_k */
  scaled: Matrix;
  /** softmax of each row of `scaled` */
  weights: Matrix;
  /** weights · V */
  output: Matrix;
}

export function attention(tokens: string[], Q: Matrix, K: Matrix, V: Matrix): Attention {
  const [n, dk] = shape(Q);
  const [nk, dk2] = shape(K);
  const [nv] = shape(V);
  if (tokens.length !== n) throw new Error(`${tokens.length} tokens but Q has ${n} rows`);
  if (dk !== dk2) throw new Error(`Q and K must share d_k: ${dk} vs ${dk2}`);
  if (nk !== nv) throw new Error(`K and V need one row per token: ${nk} vs ${nv}`);
  const scores = matmul(Q, transpose(K));
  const scaled = scores.map((r) => r.map((x) => x / Math.sqrt(dk)));
  const weights = scaled.map(softmax);
  const output = matmul(weights, V);
  return { tokens, Q, K, V, dk, scores, scaled, weights, output };
}

// ---- The explanation as a sequence of steps ------------------------------------

export type Phase = "intro" | "query" | "score" | "scale" | "softmax" | "mix" | "all";

export interface AttnState {
  phase: Phase;
  /** The query row being followed. */
  focus: number;
  /** How many of the focus row's scores have been computed. */
  scored: number;
  a: Attention;
}

export interface AttnEvent {
  type: Phase;
  /** For score steps: the key being scored against. */
  key?: number;
}

export function steps(a: Attention, focus: number): { event: AttnEvent; state: AttnState }[] {
  const n = a.tokens.length;
  const out: { event: AttnEvent; state: AttnState }[] = [];
  const at = (phase: Phase, scored: number, key?: number) =>
    out.push({ event: { type: phase, ...(key === undefined ? {} : { key }) }, state: { phase, focus, scored, a } });
  at("query", 0);
  for (let j = 0; j < n; j++) at("score", j + 1, j);
  at("scale", n);
  at("softmax", n);
  at("mix", n);
  at("all", n);
  return out;
}
