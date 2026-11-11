import type { Phases } from "./types.ts";

export const DEFAULT_DURATION = 1100;
export const DEFAULT_HOLD = 1400;

/**
 * Make room, then move, then arrive: exits finish before entries start,
 * so a slot is never occupied by two things at once.
 */
export const DEFAULT_PHASES: Phases = {
  exit: [0, 0.45],
  move: [0.2, 0.8],
  enter: [0.55, 1],
};

export interface Timeline {
  /** Time at which the transition into step k begins. Step 0 starts at 0. */
  start: number[];
  /** Time at which step k is fully shown. */
  rest: number[];
  duration: number[];
  phases: Phases[];
  total: number;
}

export interface FrameIndex {
  /** The step being shown or transitioned into. */
  index: number;
  /** Progress of the transition into `index`, 0..1. 1 while holding. */
  progress: number;
}

export function buildTimeline(
  timings: { duration?: number; phases?: Partial<Phases> }[],
  hold = DEFAULT_HOLD,
): Timeline {
  const start = [0];
  const rest = [0];
  const duration = [0];
  const phases: Phases[] = [DEFAULT_PHASES];
  let t = 0;
  for (const timing of timings) {
    const d = Math.max(0, timing.duration ?? DEFAULT_DURATION);
    t += hold;
    start.push(t);
    duration.push(d);
    phases.push({ ...DEFAULT_PHASES, ...timing.phases });
    t += d;
    rest.push(t);
  }
  return { start, rest, duration, phases, total: t };
}

/** Pure: the same time always gives the same step and progress. */
export function frameIndexAt(tl: Timeline, t: number): FrameIndex {
  const time = Math.min(Math.max(t, 0), tl.total);
  // Largest k with start[k] <= time (binary search; start is non-decreasing).
  let lo = 0;
  let hi = tl.start.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tl.start[mid]! <= time) lo = mid;
    else hi = mid - 1;
  }
  const d = tl.duration[lo]!;
  const progress = d > 0 ? Math.min(1, (time - tl.start[lo]!) / d) : 1;
  return { index: lo, progress };
}

/** Progress within a phase window, 0 before it, 1 after it. */
export function local(progress: number, window: readonly [number, number]): number {
  const [a, b] = window;
  if (progress <= a) return 0;
  if (progress >= b) return 1;
  return (progress - a) / (b - a);
}
