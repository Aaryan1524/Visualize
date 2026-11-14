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

/** Visual treatment only; never alters case, identifiers or model values. */
export type TextRole = "name" | "status" | "value" | "symbol";

interface MarkBase {
  /** Shared typography for a solid label or world annotation. */
  textRole?: TextRole;
  /** Identity across steps. Use the model entity's id. */
  key: string;
  tone?: Tone;
  /** The one thing the reader should watch in this state. */
  lit?: boolean;
  /**
   * Entity id(s), space-separated, shared with panel elements for linked
   * highlighting. Pointing at an element lights every element whose ids
   * contain its ids or are contained by them.
   */
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
  /**
   * The part this mark belongs to (parts set it on every piece). Focus treats
   * all pieces of one owner together: a change to a server's tower lights the
   * whole server.
   */
  owner?: string;
  /**
   * How strongly the mark is drawn, 0–1. Set by the engine from the step's
   * focus; scenes rarely set it themselves. Recessive marks fade toward the stage.
   */
  emphasis?: number;
  /** Accessible name of this element. */
  title?: string;
}

/** Axis-aligned box. `at` is the minimum corner; z is up. */
export interface BoxMark extends MarkBase {
  kind: "box";
  at: Vec3;
  size: Vec3;
  /** Rounded floor-plan corners, in world units. */
  radius?: number;
  /** An inset rim on the top surface. */
  inset?: boolean;
  /** Shared finish. Surface details belong to this solid and follow its motion. */
  surface?: {
    /** Height of a housing seam as a fraction of the solid's height. */
    seam?: number;
    /** Several seams, as fractions of the height: rack units, drawer lines. */
    seams?: readonly number[];
    /**
     * A recessed panel on a side face (a screen, a bezel), between heights
     * `from` and `to` (fractions) and inset from the face's ends. A label on
     * the same face is centred on it.
     */
    panel?: { face: "left" | "right"; from: number; to: number; inset: number };
    /** Horizontal vent slots on a side face, between two height fractions. */
    vents?: { face: "left" | "right"; from: number; to: number; count: number; length: number };
    /** A small status lamp on a side face at (u along the face, height fraction). */
    lamp?: { face: "left" | "right"; u: number; at: number; radius: number; tone: Tone };
    fasteners?: { inset: number; radius: number };
    ticks?: { step: number; majorEvery: number };
    /** Inset of the socket's recessed floor treatment. */
    well?: number;
  };
  /** Visual hierarchy independent of model keys or a particular scene. */
  role?: "foundation" | "subject";
  /** Short face text; upright by default, projected into the plane of a side panel. */
  label?: string;
  /** Which visible face carries the label. Use a side when something sits on top. */
  labelFace?: LabelFace;
  /** The label may be hidden when it does not fit (decoration, not information). */
  labelOptional?: boolean;
}

export type LabelFace = "top" | "left" | "right";

/** Vertical cylinder. `at` is the centre of the bottom face. */
export interface CylinderMark extends MarkBase {
  kind: "cylinder";
  at: Vec3;
  radius: number;
  height: number;
  /** As on boxes: a foundation (plinth) everything stands on, or the subject. */
  role?: "foundation" | "subject";
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
  /** A leader ending on the named solid, in world coordinates. */
  target?: { key: string; at: Vec3 };
  /**
   * A label the explanation does not depend on (slot numbers, scale marks).
   * The renderer drops it whenever it would sit on a standing part or another
   * label, for example at small sizes.
   */
  optional?: boolean;
}

/** A straight line between two world points. */
export interface LinkMark extends MarkBase {
  kind: "link";
  from: Vec3;
  to: Vec3;
  /** Intermediate points for a routed link, in order. */
  via?: readonly Vec3[];
  /** Draw as a cased cable lying on the ground rather than a hairline. */
  cable?: boolean;
  /** Owners the two ends must sit on (set by binding a cable to part anchors). */
  ends?: readonly [string, string];
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
  /**
   * Editorial layout: "strip" (default) sits under the stage; "side" sits in a
   * column beside it, for linked equations and grids that need height.
   */
  place?: "strip" | "side";
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
  /**
   * The element with this key can be seen (or is not drawn at all). Seen
   * means unobstructed at a real share of its area, not merely present.
   */
  | { type: "visible"; key: string; visible: boolean }
  /** The element with this key is the highlighted one. */
  | { type: "lit"; key: string }
  /** Semantic colour role, independently asserted from the model event. */
  | { type: "tone"; key: string; equals: Tone }
  /**
   * The solid with this key is drawn at this world size: [w, d, h] for a
   * box, [diameter, diameter, h] for a cylinder. Use it wherever a size
   * encodes a number. Checked against the drawn outline with the projection.
   */
  | { type: "extent"; key: string; size: readonly [number, number, number]; radius?: number; tolerance?: number };

export interface Phases {
  exit: readonly [number, number];
  move: readonly [number, number];
  enter: readonly [number, number];
}

export type Projection = "iso" | "front";

export interface Teaching {
  chapter: string;
  heading: string;
  /**
   * What the reader should look at in this step: owners or keys. By default
   * the engine focuses whatever changed since the previous step and lets the
   * rest recede. `"all"` keeps everything at full strength.
   */
  focus?: readonly string[] | "all";
  /** Unfold stage only: "plan" shows the flat top-down view for this step. */
  shot?: "plan" | "focus";
  prediction?: {
    question: string;
    choices: string[];
    answer: string;
    explanation: string;
  };
}

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
  /** Opt into the figure-first presentation without changing existing scenes. */
  presentation?: "editorial";
  setup?: string;
  teaching?: (state: S, event: E | null, index: number) => Teaching;
}
