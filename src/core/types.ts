/**
 * Core types shared by models, views, the engine and the checks.
 *
 * The contract is deliberately small:
 *   model  -> Trace<S, E>       (what happens, as data)
 *   view   -> Mark[] per state  (what is drawn, keyed by model entity)
 *   engine -> Frame at time t   (pure; no stateful tweens)
 */

export type Vec3 = readonly [number, number, number];

/**
 * How much a claim can be trusted. Every step and every scene carries one,
 * and the player shows it next to the caption.
 *
 * - sourced:    taken from an identifiable source location (a paper, a spec)
 * - computed:   calculated by the executable model shown on the page
 * - model:      a simplified executable model; behaviour is real, scale is not
 * - analogy:    a mapping onto something familiar; only stated relations hold
 * - unverified: an interpretation that has not been checked
 */
export type Trust = "sourced" | "computed" | "model" | "analogy" | "unverified";

export interface Source {
  /** Human-readable reference, e.g. "Vaswani et al. 2017, Eq. 1". */
  label: string;
  url?: string;
}

export interface Step<S, E> {
  /** The event that produced `state`. */
  event: E;
  /** Model state after the event. */
  state: S;
  /** One sentence: what just happened and why. */
  caption: string;
  /** Defaults to the scene's trust. */
  trust?: Trust;
  source?: Source;
}

export interface Trace<S, E> {
  initial: S;
  /** Caption shown before the first event. */
  intro: string;
  steps: Step<S, E>[];
}

/** Semantic tones. Renderers map them to theme colours. */
export type Tone =
  | "base"
  | "structure"
  | "subject"
  | "accent"
  | "hot"
  | "cold"
  | "good"
  | "bad"
  | "muted";

export type EnterStyle = "drop" | "fade" | "grow" | "none";
export type ExitStyle = "fall" | "fade" | "lift" | "shrink" | "none";
export type Effect = "shake" | "pulse";

interface MarkBase {
  /** Identity across steps. Use the model entity's id. */
  key: string;
  tone?: Tone;
  /** The one thing the reader should watch in this state. */
  lit?: boolean;
  /** Entity id shared with panel elements for linked highlighting. */
  link?: string;
  enter?: EnterStyle;
  exit?: ExitStyle;
  /** A brief, self-cancelling motion during the step's move phase. */
  effect?: Effect;
  /**
   * Only drawn while the step that produced this state is transitioning.
   * Use with `travel` for messages and operations in flight.
   */
  transient?: boolean;
  /** For transient marks: the path followed during the transition. */
  travel?: { from: Vec3; to: Vec3 };
  /**
   * In the next state, says where an entity goes as it leaves: the engine
   * moves the previous mark with this key here during the transition, then
   * fades it. Never drawn at rest.
   */
  leaving?: boolean;
  /** Height of a hop during the move, so a mark can pass over its neighbours. */
  arc?: number;
  /** Accessible name of this element. */
  title?: string;
}

/** Axis-aligned box. `at` is the minimum corner; z is up. */
export interface BoxMark extends MarkBase {
  kind: "box";
  at: Vec3;
  size: Vec3;
  /** Short text drawn upright on a face. */
  label?: string;
  /** Which visible face carries the label. Use a side when something sits on top. */
  labelFace?: LabelFace;
}

export type LabelFace = "top" | "left" | "right";

/** Vertical cylinder. `at` is the centre of the bottom face. */
export interface CylinderMark extends MarkBase {
  kind: "cylinder";
  at: Vec3;
  radius: number;
  height: number;
  label?: string;
  /** "top", or a side ("left" and "right" both mean the near side). */
  labelFace?: LabelFace;
}

/** Text anchored to a world point, drawn above all solids. */
export interface LabelMark extends MarkBase {
  kind: "label";
  at: Vec3;
  text: string;
  anchor?: "start" | "middle" | "end";
  size?: "small" | "normal" | "large";
}

/** A straight line between two world points. */
export interface LinkMark extends MarkBase {
  kind: "link";
  from: Vec3;
  to: Vec3;
  width?: number;
  dashed?: boolean;
  /** floor: under every solid; overlay: above every solid. */
  layer?: "floor" | "overlay";
}

export type SolidMark = BoxMark | CylinderMark;
export type Mark = BoxMark | CylinderMark | LabelMark | LinkMark;

/** A mark after the engine has resolved it for one instant. */
export type Resolved<M extends Mark = Mark> = M & {
  opacity: number;
};

/** A flat HTML panel beside the stage: equations, grids, tables, timelines. */
export interface Panel {
  key: string;
  title?: string;
  /** Trusted HTML produced by the scene author or the math helper. */
  html: string;
}

/**
 * Something the reader should be able to see at the end of a step.
 * The checker asserts each one against the rendered page.
 */
export type Observation =
  /** The visible text of the element with this key equals `equals`. */
  | { type: "text"; key: string; equals: string }
  /** These keys appear in this order along a screen axis (left-to-right or top-to-bottom). */
  | { type: "order"; keys: string[]; axis: "x" | "y" }
  /** The element with this key is drawn (or not). */
  | { type: "visible"; key: string; visible: boolean }
  /** The element with this key is the highlighted one. */
  | { type: "lit"; key: string };

export interface Phases {
  exit: readonly [number, number];
  move: readonly [number, number];
  enter: readonly [number, number];
}

export type Projection = "iso" | "front";

export interface Scene<S, E> {
  id: string;
  title: string;
  /** The question the figure answers. */
  question: string;
  /** Default trust for every step. */
  trust: Trust;
  /** Short statement of what the model simplifies, shown with the figure. */
  assumptions?: string[];
  trace: () => Trace<S, E>;
  view: (state: S, event: E | null) => Mark[];
  panels?: (state: S, event: E | null) => Panel[];
  observe?: (state: S, event: E | null, index: number) => Observation[];
  /** One line in the model's own units, shown beside the stage. */
  readout?: (state: S, event: E | null) => string;
  /** Per-event timing. Defaults apply when omitted. */
  timing?: (event: E) => { duration?: number; phases?: Partial<Phases> };
  /** Legend entries: tone -> what it means in the concept's own words. */
  legend?: { tone: Tone; label: string }[];
  projection?: Projection;
}
