import type { BoxMark, CylinderMark, LabelMark, Mark, Tone, Vec3 } from "../core/types.ts";
import { part, type Part } from "./network.ts";

// Parts for the shapes fields actually draw, built as finished solids:
//
//   ring       a ring buffer, a hash ring, a round-robin: slots around a circle
//   marker     a pointer that stands on one slot (head, tail, lo, mid, hi)
//   reservoir  a stack of countable things with a visible capacity (a token bucket)
//   source     something that adds at a rate (a refill, an arrival stream)
//   gate       where a request meets what it needs, and passes or is turned away
//
// These exist because the evals drew every subject as a straight rail: the
// ring buffer lost its ring, the token bucket lost its refill and the request
// never met the token it spent. A scene should be able to build the picture
// the field already draws.

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const finite = (v: Vec3, what: string) => {
  if (v.some((n) => !Number.isFinite(n))) throw new RangeError(`${what} must be finite`);
};

// ---- Ring ---------------------------------------------------------------------

export const RING_PAD = 9;
const RING_PLINTH = 6;

export interface RingOptions {
  key: string;
  slots: number;
  /** Centre of the ring on the floor. */
  at?: Vec3;
  /** Distance from the centre to each slot's centre. Default: just enough room for the slots. */
  radius?: number;
  /** Names under each slot. Default numbers are optional; names the scene gives are always drawn. `null`: none. */
  slotLabel?: ((i: number) => string) | null;
}

export interface Ring extends Part<"centre" | "front"> {
  /** Top centre of slot i's pad, where an entry stands. */
  slot(i: number): Vec3;
  /** The floor just outside slot i, where a marker stands. */
  outside(i: number): Vec3;
  /** Screen-clockwise angle of slot i, in radians (slot 0 at the back). */
  angle(i: number): number;
  /** The side a marker at slot i should put its name: away from the ring. */
  side(i: number): MarkerSide;
  /**
   * How tall a marker at slot i should be: tall behind the ring so it rises
   * above it, short in front so it never stands over the slot it points at.
   */
  markerHeight(i: number): number;
  radius: number;
  /** Height of a slot's top above the ring's floor. */
  top: number;
}

/**
 * Slots around a circle on a round plinth, slot 0 at the back, numbered
 * clockwise as seen on screen. The wrap from the last slot back to the first is
 * a step to a neighbour, which is the point of a ring buffer.
 */
export function ringAssembly({ key, slots, at = [0, 0, 0], radius, slotLabel }: RingOptions): Ring {
  if (!Number.isInteger(slots) || slots < 3 || slots > 16) throw new RangeError("A ring needs 3–16 slots");
  finite(at, "Ring position");
  // Neighbouring pads keep their bounding squares apart in every direction, so
  // depth order between them is never ambiguous (the worst case is at 45°).
  const minimum = Math.max(30, (2 * Math.SQRT2 * RING_PAD + 2) / (2 * Math.sin(Math.PI / slots)));
  const R = radius ?? minimum;
  if (!Number.isFinite(R) || R < minimum - 1e-9) throw new RangeError(`A ring of ${slots} slots needs a radius of at least ${minimum.toFixed(1)}`);
  const outer = R + RING_PAD + 7;
  const angle = (i: number) => -0.75 * Math.PI + (i * 2 * Math.PI) / slots;
  const around = (i: number, r: number, z: number): Vec3 => add(at, [Math.cos(angle(i)) * r, Math.sin(angle(i)) * r, z]);
  const check = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= slots) throw new RangeError("Slot index outside the ring");
  };
  // A slot's name sits just outside the plinth's outline on screen, in the slot's
  // direction: past the top rim behind, past the side wall in front. A point on
  // the floor at the same radius would land on the plinth for the back slots.
  const beside = (i: number): Vec3 => {
    const c = Math.cos(Math.PI / 6);
    const u = Math.cos(angle(i)), v = Math.sin(angle(i));
    // Screen direction of the slot from the centre (unit circle → ellipse).
    const ex = (u - v) * c, ey = (u + v) / 2;
    const reach = outer + 9;
    const sx = ex * reach, sy = ey * reach - RING_PLINTH + Math.max(0, ey) * RING_PLINTH * 1.4 + (ey < 0 ? -3 : 3);
    // Back to a world point on the floor with that screen position.
    const xmy = sx / c, xpy = 2 * sy;
    return add(at, [(xmy + xpy) / 2, (xpy - xmy) / 2, 0]);
  };
  const marks: Mark[] = [
    // The plinth is the ring's body, not ground: it counts toward how much of the stage the subject fills.
    { kind: "cylinder", key: `${key}/plinth`, at, radius: outer, height: RING_PLINTH, tone: "base" } as CylinderMark,
    // The hub inside the slots leaves a channel between them and the rim, so the ring reads as a ring.
    // Its bounding square stays clear of the pads' (slot 0 sits on the diagonal).
    { kind: "cylinder", key: `${key}/hub`, at: add(at, [0, 0, RING_PLINTH]), radius: Math.max(4, R * Math.SQRT1_2 - RING_PAD - 1), height: 2, tone: "structure" } as CylinderMark,
  ];
  for (let i = 0; i < slots; i++) {
    marks.push({ kind: "cylinder", key: `${key}/pad-${i}`, at: around(i, R, RING_PLINTH), radius: RING_PAD, height: 1.5, tone: "muted" } as CylinderMark);
    if (slotLabel !== null) {
      marks.push({
        kind: "label", key: `${key}/slot-${i}`, at: beside(i),
        text: slotLabel ? slotLabel(i) : String(i), size: "small", optional: !slotLabel,
      } as LabelMark);
    }
  }
  const top = RING_PLINTH + 1.5;
  const r = part(key, marks, { centre: add(at, [0, 0, RING_PLINTH + 2]), front: add(at, [outer * Math.SQRT1_2, outer * Math.SQRT1_2, RING_PLINTH / 2]) }, { centre: `${key}/hub`, front: `${key}/plinth` });
  return {
    ...r,
    slot: (i) => (check(i), around(i, R, top)),
    outside: (i) => (check(i), around(i, outer + 4, 0)),
    angle: (i) => (check(i), angle(i)),
    markerHeight: (i) => {
      check(i);
      const ey = (Math.cos(angle(i)) + Math.sin(angle(i))) / 2;
      return ey > 0.2 ? 11 : ey > -0.2 ? 20 : MARKER_HEIGHT;
    },
    side: (i) => {
      check(i);
      // Beside, on the outer side; under the foot in front, where anything higher lands on the ring.
      const ex = Math.cos(angle(i)) - Math.sin(angle(i)), ey = (Math.cos(angle(i)) + Math.sin(angle(i))) / 2;
      return ey > 0.2 ? "below" : ex >= 0 ? "start" : "end";
    },
    radius: R,
    top,
  };
}

/** An entry standing on a ring slot: a puck with its value on top. */
export function puck(mark: Omit<CylinderMark, "kind" | "radius" | "height"> & { radius?: number; height?: number }): CylinderMark {
  return { radius: RING_PAD - 1.5, height: 9, labelFace: "top", textRole: "symbol", role: "subject", ...mark, kind: "cylinder" } as CylinderMark;
}

// ---- Marker -----------------------------------------------------------------------

export const MARKER_HEIGHT = 30;
/** Where a marker's name goes: over its cap, or beside it to the screen right ("start") or left ("end"). */
export type MarkerSide = "above" | "start" | "end" | "below";

/**
 * A pointer standing on the floor next to the slot it points at: a foot, a
 * post and a cap, with its name above. Its name is an identity, never dropped.
 * Several markers on one slot stand side by side (`lane` 0, 1, …).
 */
export function marker(key: string, at: Vec3, name: string, { tone = "accent", lit = false, lane = 0, height = MARKER_HEIGHT, hop = 26, side = "above" }: { tone?: Tone; lit?: boolean; lane?: number; height?: number; hop?: number; side?: MarkerSide } = {}): Part<"tip" | "foot"> {
  finite(at, "Marker position");
  if (!Number.isInteger(lane) || lane < 0 || lane > 3) throw new RangeError("A marker lane is 0–3");
  if (!(height >= 10)) throw new RangeError("A marker needs a height of at least 10");
  // Side by side along the screen's horizontal (+x −y), so lanes never hide each other.
  const foot = add(at, [lane * 7, -lane * 7, 0]);
  const tall = height + lane * 9;
  // A marker moving to another slot hops over what lies between (a ring, a rail), never through it.
  const marks: Mark[] = [
    { kind: "cylinder", key: `${key}/foot`, at: foot, radius: 3.4, height: 1.6, tone: "structure", arc: hop } as CylinderMark,
    { kind: "cylinder", key: `${key}/post`, at: add(foot, [0, 0, 1.6]), radius: 0.9, height: tall - 4.6, tone: "structure", arc: hop } as CylinderMark,
    { kind: "cylinder", key: `${key}/cap`, at: add(foot, [0, 0, tall - 3]), radius: 2.6, height: 3, tone, lit, role: "subject", arc: hop } as CylinderMark,
    // The name stands over the cap, or beside it on the side away from what it points at.
    {
      kind: "label", key: `${key}/name`, text: name, size: "normal", target: { key: `${key}/cap`, at: add(foot, [0, 0, tall]) },
      ...(side === "above" ? { at: add(foot, [0, 0, tall + 7]) } : side === "below" ? { at: add(foot, [4, 4, -3]) } : { at: add(foot, side === "start" ? [5, -5, tall - 1] : [-5, 5, tall - 1]), anchor: side }),
    } as LabelMark,
  ];
  return part(key, marks, { tip: add(foot, [0, 0, tall]), foot }, { tip: `${key}/cap`, foot: `${key}/foot` });
}

// ---- Reservoir ----------------------------------------------------------------------

export const TOKEN_HEIGHT = 3.6;
const RESERVOIR_FLOOR = 8;

export interface Item {
  id: string;
  tone?: Tone;
  lit?: boolean;
}

/**
 * A stack of countable things on a base, with a capacity post as tall as a full
 * stack. How full it is reads at a glance as stack height against the post.
 */
export function reservoir(key: string, centre: Vec3, { capacity, items, unit = "tokens" }: { capacity: number; items: readonly Item[]; unit?: string }): Part<"top" | "take" | "front" | "capacity"> {
  finite(centre, "Reservoir position");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) throw new RangeError("A reservoir holds 1–20 items");
  if (items.length > capacity) throw new RangeError(`${items.length} items exceed the capacity of ${capacity}`);
  const full = RESERVOIR_FLOOR + capacity * TOKEN_HEIGHT;
  const marks: Mark[] = [
    { kind: "cylinder", key: `${key}/base`, at: centre, radius: 17, height: 6, tone: "structure" } as CylinderMark,
    { kind: "cylinder", key: `${key}/well`, at: add(centre, [0, 0, 6]), radius: 11, height: 2, tone: "muted" } as CylinderMark,
    // The capacity post stands on the base beside the stack, as tall as a full one.
    { kind: "cylinder", key: `${key}/post`, at: add(centre, [-14, 0, 6]), radius: 1.5, height: full - 6, tone: "structure" } as CylinderMark,
    { kind: "cylinder", key: `${key}/full`, at: add(centre, [-14, 0, full]), radius: 2.6, height: 1.4, tone: "structure" } as CylinderMark,
    { kind: "label", key: `${key}/capacity`, at: add(centre, [-14, 0, full + 7]), text: `${capacity} max`, size: "small" } as LabelMark,
  ];
  items.forEach((it, i) => {
    marks.push({
      // Alternate radii leave a ledge at every item, so the stack can be counted.
      kind: "cylinder", key: `${key}/item-${it.id}`, at: add(centre, [0, 0, RESERVOIR_FLOOR + i * TOKEN_HEIGHT]), radius: i % 2 ? 8.8 : 10, height: TOKEN_HEIGHT,
      tone: it.tone ?? "hot", lit: it.lit ?? false, enter: "drop", role: "subject", title: unit,
    } as CylinderMark);
  });
  return part(key, marks, {
    top: add(centre, [0, 0, RESERVOIR_FLOOR + items.length * TOKEN_HEIGHT]),
    take: add(centre, [0, 0, RESERVOIR_FLOOR + Math.max(0, items.length - 1) * TOKEN_HEIGHT]),
    front: add(centre, [0, 17, 3]),
    capacity: add(centre, [-14, 0, full]),
  }, { front: `${key}/base`, capacity: `${key}/full` });
}

// ---- Source -----------------------------------------------------------------------

/**
 * Something that adds at a rate, mounted over what it fills: a hopper on an
 * arm, with its rate written beside it. Items entering the reservoir below
 * drop from it.
 */
export function source(key: string, over: Vec3, { rate, height = 56, lit = false }: { rate: string; height?: number; lit?: boolean }): Part<"out" | "body"> {
  finite(over, "Source position");
  if (!(height >= 30)) throw new RangeError("A source needs a height of at least 30");
  const mouth = add(over, [0, 0, height + 3]);
  const marks: Mark[] = [
    // A column behind the target, an arm over it, and the hopper on the arm.
    // A column beside the target, an arm resting on it out over the target, and the hopper on the arm's end.
    { kind: "box", key: `${key}/column`, at: add(over, [-3, -36, 0]), size: [6, 6, height], radius: 1.2, tone: "structure", surface: { seam: 0.5 } } as BoxMark,
    { kind: "box", key: `${key}/arm`, at: add(over, [-2, -35, height]), size: [4, 39, 3], radius: 1, tone: "structure" } as BoxMark,
    { kind: "box", key: `${key}/hopper`, at: add(over, [-7, -7, height + 3]), size: [14, 14, 11], radius: 2, tone: "subject", lit, role: "subject", surface: { seam: 0.3 } } as BoxMark,
    // On the side away from the arm and column.
    { kind: "label", key: `${key}/rate`, at: add(over, [-9, 9, height + 9]), text: rate, anchor: "end" } as LabelMark,
  ];
  return part(key, marks, { out: mouth, body: add(over, [0, 0, height + 8]) }, { out: `${key}/hopper`, body: `${key}/hopper` });
}

// ---- Gate ------------------------------------------------------------------------

export const GATE_SPAN = 26;

/**
 * Where a request meets what it needs. Two posts across the lane with a bar
 * between them: raised and good when the request passes, down and bad when it
 * is turned away. The lane runs along +x: `in` is before the gate, `out` after
 * it, `reject` to the front where turned-away requests go.
 */
export function gate(key: string, at: Vec3, { open, lit = false }: { open: boolean | null; lit?: boolean }): Part<"in" | "out" | "reject" | "top"> {
  finite(at, "Gate position");
  const marks: Mark[] = [
    { kind: "box", key: `${key}/sill`, at: add(at, [-4, -2, 0]), size: [8, GATE_SPAN + 4, 2], radius: 0.8, tone: "structure" } as BoxMark,
    { kind: "box", key: `${key}/post-back`, at: add(at, [-3, -2, 2]), size: [6, 5, 24], radius: 1.4, tone: "structure", surface: { seam: 0.5 } } as BoxMark,
    { kind: "box", key: `${key}/post-front`, at: add(at, [-3, GATE_SPAN - 3, 2]), size: [6, 5, 24], radius: 1.4, tone: "structure", surface: { seam: 0.5, lamp: { face: "left", u: 0.5, at: 0.8, radius: 1.3, tone: open === true ? "good" : open === false ? "bad" : "muted" } } } as BoxMark,
  ];
  const tone: Tone = open === true ? "good" : open === false ? "bad" : "structure";
  if (open === true) {
    // Raised: the bar lies across the tops of both posts and the lane is clear.
    marks.push({ kind: "box", key: `${key}/bar-up`, at: add(at, [-1.5, -2, 26]), size: [3, GATE_SPAN + 4, 3], radius: 1, tone, lit, role: "subject", enter: "fade", exit: "fade" } as BoxMark);
  } else {
    // Down: the bar rests on two short rods and closes the lane.
    for (const [name, y] of [["rod-back", 3], ["rod-front", GATE_SPAN - 4.5]] as const) {
      marks.push({ kind: "box", key: `${key}/${name}`, at: add(at, [-1, y, 2]), size: [2, 1.5, 9], radius: 0.4, tone: "structure" } as BoxMark);
    }
    // The raised and lowered bars are different pieces, so a change swaps them instead of dragging one through the posts.
    marks.push({ kind: "box", key: `${key}/bar-down`, at: add(at, [-1.5, 3, 11]), size: [3, GATE_SPAN - 6, 3], radius: 1, tone, lit, role: "subject", enter: "fade", exit: "fade" } as BoxMark);
  }
  return part(key, marks, {
    in: add(at, [-16, GATE_SPAN / 2, 2]),
    out: add(at, [16, GATE_SPAN / 2, 2]),
    reject: add(at, [6, GATE_SPAN + 18, 0]),
    top: add(at, [0, GATE_SPAN / 2, open === true ? 29 : 14]),
  }, { top: open === true ? `${key}/bar-up` : `${key}/bar-down` });
}
