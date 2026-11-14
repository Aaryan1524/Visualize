import { resolveFrame } from "./interpolate.ts";
import { buildTimeline, frameIndexAt, type Timeline } from "./timeline.ts";
import type { Mark, Observation, Panel, Resolved, Scene, Source, Teaching, Trust } from "./types.ts";

/** Identity helper that gives scene authors type inference. */
export function defineScene<S, E>(scene: Scene<S, E>): Scene<S, E> {
  return scene;
}

export interface StepInfo {
  teaching?: Teaching;
  caption: string;
  /** The spoken script for this step, with [words|ids] links. */
  voice?: string;
  trust: Trust;
  source?: Source;
  readout: string;
  panels: Panel[];
  marks: Mark[];
  observations: Observation[];
}

export interface Frame {
  index: number;
  progress: number;
  marks: Resolved[];
  /** Caption, trust, panels and readout switch halfway through a transition. */
  shown: StepInfo;
}

export interface Compiled {
  scene: Scene<any, any>;
  steps: StepInfo[];
  timeline: Timeline;
  frameAt(t: number): Frame;
  /** Time at which step k is fully shown. */
  restTime(k: number): number;
}

function checkKeys(marks: Mark[], index: number, sceneId: string): void {
  const seen = new Set<string>();
  for (const m of marks) {
    if (seen.has(m.key)) {
      throw new Error(`${sceneId}: duplicate mark key "${m.key}" in step ${index}`);
    }
    seen.add(m.key);
  }
}

/** Run the model once and precompute everything a frame needs. */
export function compile<S, E>(scene: Scene<S, E>, opts: { hold?: number } = {}): Compiled {
  const trace = scene.trace();
  const states: { state: S; event: E | null; caption: string; trust: Trust; source?: Source }[] = [
    { state: trace.initial, event: null, caption: trace.intro, trust: scene.trust },
    ...trace.steps.map((s) => ({
      state: s.state,
      event: s.event,
      caption: s.caption,
      trust: s.trust ?? scene.trust,
      ...(s.source ? { source: s.source } : {}),
    })),
  ];

  const steps: StepInfo[] = states.map((s, i) => {
    const marks = scene.view(s.state, s.event);
    checkKeys(marks, i, scene.id);
    return {
      ...(scene.teaching ? { teaching: scene.teaching(s.state, s.event, i) } : {}),
      caption: s.caption,
      ...(scene.voice ? { voice: scene.voice(s.state, s.event, i) } : {}),
      trust: s.trust,
      ...(s.source ? { source: s.source } : {}),
      readout: scene.readout ? scene.readout(s.state, s.event) : "",
      panels: scene.panels ? scene.panels(s.state, s.event) : [],
      marks,
      observations: scene.observe ? scene.observe(s.state, s.event, i) : [],
    };
  });

  if (scene.presentation === "editorial") applyFocus(steps);

  const timeline = buildTimeline(
    trace.steps.map((s) => (scene.timing ? scene.timing(s.event) : {})),
    opts.hold,
  );

  function frameAt(t: number): Frame {
    const { index, progress } = frameIndexAt(timeline, t);
    const next = steps[index]!;
    if (index === 0 || progress >= 1) {
      return {
        index,
        progress,
        marks: resolveFrame([], next.marks, 1, timeline.phases[index]!),
        shown: next,
      };
    }
    const prev = steps[index - 1]!;
    return {
      index,
      progress,
      marks: resolveFrame(prev.marks, next.marks, progress, timeline.phases[index]!),
      shown: progress >= 0.5 ? next : prev,
    };
  }

  return {
    scene,
    steps,
    timeline,
    frameAt,
    restTime: (k) => timeline.rest[Math.min(Math.max(k, 0), steps.length - 1)]!,
  };
}


/** How far recessive marks fade toward the stage (1 = full strength). */
export const RECEDE = 0.42;

const ownerOf = (m: Mark) => m.owner ?? m.key;
/** Context never recedes: plates and other foundations, and labels (text stays readable). */
const recedes = (m: Mark) => m.kind !== "label" && !(m.kind === "box" && (m.role === "foundation" || m.tone === "base"));
const shape = (m: Mark) => JSON.stringify({ ...m, emphasis: undefined });

/**
 * The default focus: owners whose marks changed since the previous step (moved,
 * appeared, changed tone or text, are leaving or in flight). A step can name
 * its own focus, or "all". Pure: it depends only on the two steps' marks.
 */
export function focusOf(prev: readonly Mark[] | null, next: readonly Mark[], explicit?: readonly string[] | "all"): Set<string> | null {
  if (explicit === "all" || prev === null) return null;
  if (explicit) return new Set(explicit);
  const before = new Map(prev.map((m) => [m.key, shape(m)]));
  const toneBefore = new Map(prev.map((m) => [m.key, m.tone]));
  const owners = new Set<string>();
  // Marks that were just muted (ruled out, discarded, retired) changed, but the
  // step is about what remains: a binary-search run lit the discarded half and
  // dimmed the survivors. Muting is the author saying "this no longer matters".
  const retired = new Set<string>();
  for (const m of next) {
    if (m.kind === "label") continue;
    if (!(m.transient || m.leaving || before.get(m.key) !== shape(m))) continue;
    if (m.tone === "muted" && toneBefore.has(m.key) && toneBefore.get(m.key) !== "muted") retired.add(ownerOf(m));
    else owners.add(ownerOf(m));
  }
  for (const o of owners) retired.delete(o);
  if (!owners.size && retired.size) {
    // Only retirements: focus the subjects still in play.
    for (const m of next) if ((m.kind === "box" || m.kind === "cylinder") && m.role === "subject" && m.tone !== "muted" && !retired.has(ownerOf(m))) owners.add(ownerOf(m));
  }
  if (!owners.size) return null;
  // If nothing focused is still drawn at rest (only marks in flight or leaving changed),
  // dimming would leave the reader looking at nothing: keep everything at full strength.
  const atRest = next.some((m) => m.kind !== "label" && !m.transient && !m.leaving && owners.has(ownerOf(m)));
  return atRest ? owners : null;
}

function applyFocus(steps: StepInfo[]): void {
  steps.forEach((step, i) => {
    const focus = focusOf(i === 0 ? null : steps[i - 1]!.marks, step.marks, step.teaching?.focus);
    if (!focus) return;
    step.marks = step.marks.map((m) => (recedes(m) && !focus.has(ownerOf(m)) && !focus.has(m.key) ? { ...m, emphasis: RECEDE } : m));
  });
}
