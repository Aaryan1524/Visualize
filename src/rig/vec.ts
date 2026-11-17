// Small vector helpers for the rig. World coordinates are [x, y, z] with z up.

export type V3 = readonly [number, number, number];
export type P2 = readonly [number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => scale(a, 1 / (length(a) || 1));
/** a + b·k */
export const along = (a: V3, b: V3, k: number): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Twice the signed area of a closed 2D loop: positive when it runs counter-clockwise (y up). */
export function area2(loop: readonly P2[]): number {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!, b = loop[(i + 1) % loop.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s;
}

/** A number for an SVG path: one decimal, no trailing ".0". */
export const n1 = (v: number): string => {
  const t = (Math.round(v * 10) / 10).toFixed(1);
  return t.endsWith(".0") ? t.slice(0, -2) : t === "-0" ? "0" : t;
};

/** The convex outline of a set of screen points (monotone chain), counter-clockwise on screen. */
export function convexOutline(points: readonly P2[]): P2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [], upper: P2[] = [];
  for (const q of p) {
    while (lower.length > 1 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (upper.length > 1 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** A closed or open SVG path through screen points. */
export function pathThrough(points: readonly P2[], closed = true): string {
  if (!points.length) return "";
  let d = `M${n1(points[0]![0])} ${n1(points[0]![1])}`;
  for (let i = 1; i < points.length; i++) d += `L${n1(points[i]![0])} ${n1(points[i]![1])}`;
  return closed ? d + "Z" : d;
}
