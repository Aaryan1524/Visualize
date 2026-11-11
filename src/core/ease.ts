/** Cubic ease in and out: zero velocity at both ends. */
export function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Fast start, gentle arrival. */
export function easeOut(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/** Gentle start, fast finish: things falling. */
export function easeIn(x: number): number {
  return x * x * x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** A bump that is 0 at both ends and 1 in the middle. */
export function bump(x: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, x)));
}
