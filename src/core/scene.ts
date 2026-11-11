import { resolveFrame } from "./interpolate.ts";
import { buildTimeline, frameIndexAt, type Timeline } from "./timeline.ts";
import type { Mark, Observation, Panel, Resolved, Scene, Source, Trust } from "./types.ts";

/** Identity helper that gives scene authors type inference. */
export function defineScene<S, E>(scene: Scene<S, E>): Scene<S, E> {
  return scene;
}

export interface StepInfo {
  caption: string;
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
      caption: s.caption,
      trust: s.trust,
      ...(s.source ? { source: s.source } : {}),
      readout: scene.readout ? scene.readout(s.state, s.event) : "",
      panels: scene.panels ? scene.panels(s.state, s.event) : [],
      marks,
      observations: scene.observe ? scene.observe(s.state, s.event, i) : [],
    };
  });

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
