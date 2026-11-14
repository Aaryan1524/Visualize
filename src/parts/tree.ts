import type { BoxMark, CylinderMark, LabelMark, LinkMark, Mark, Tone, Vec3 } from "../core/types.ts";
import { part, type Part } from "./network.ts";

// A complete binary tree, drawn the way every textbook draws a heap or a
// tournament: the root at the back (the top of the plan view), each level one
// row nearer, children spread under their parent and joined by edges lying on
// the plinth. Positions are numbered in array order (breadth first), so
// position i has children 2i+1 and 2i+2: the tree and its array share indices.
//
// Every position has a pad, filled or not, so "the next free leaf" is a place
// the reader can see. Entries stand on pads as `puck`s (from flow.ts).

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const TREE_PLINTH = 6;
const PAD_HEIGHT = 1.5;
/** Pad radius: larger than a ring pad, so a value on a puck reads from the angled views. */
export const TREE_PAD = 12;
/** A puck that fits a tree pad: pass to `puck` as `radius` and `height`. */
export const TREE_PUCK = { radius: TREE_PAD - 1.5, height: 10 } as const;

export interface TreeOptions {
  key: string;
  /** Number of levels, 1–4 (1, 3, 7 or 15 positions). */
  levels: number;
  /** Floor point of the plinth's back-left corner, before its margin. */
  at?: Vec3;
  /** Distance between neighbouring leaves along x. */
  leafPitch?: number;
  /** Distance between levels along y (toward the reader). */
  levelPitch?: number;
  /** Tone for the edge into position i (from its parent): a comparison in progress. Untoned edges are idle. */
  edgeTone?: (i: number) => Tone | undefined;
  /** Index under each pad. The default numbers are optional; `null` (the default) draws none. */
  slotLabel?: ((i: number) => string) | null;
}

export interface Tree extends Part<"root" | "front" | "left"> {
  /** Top centre of position i's pad, where an entry stands. */
  slot(i: number): Vec3;
  /** Number of positions. */
  size: number;
  /** Depth of position i (root = 0). */
  depth(i: number): number;
  /** Key of the edge from position i's parent to i. */
  edge(i: number): string;
  /** Height of a pad's top above the tree's floor. */
  top: number;
}

export function treeAssembly({ key, levels, at = [0, 0, 0], leafPitch = 64, levelPitch = 48, edgeTone, slotLabel = null }: TreeOptions): Tree {
  if (!Number.isInteger(levels) || levels < 1 || levels > 4) throw new RangeError("A tree needs 1–4 levels");
  if (at.some((n) => !Number.isFinite(n))) throw new RangeError("Tree position must be finite");
  // Pads keep their bounding squares apart, so depth order between them is never ambiguous.
  const clear = 2 * TREE_PAD + 6;
  if (!(leafPitch >= clear) || !(levelPitch >= clear)) throw new RangeError(`Tree pitches must be at least ${clear}`);
  const size = 2 ** levels - 1;
  const width = 2 ** (levels - 1) * leafPitch;
  const depth = (i: number) => Math.floor(Math.log2(i + 1));
  const check = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= size) throw new RangeError("Position outside the tree");
  };
  const centre = (i: number): Vec3 => {
    const d = depth(i), k = i - (2 ** d - 1);
    return add(at, [((k + 0.5) * width) / 2 ** d, d * levelPitch, 0]);
  };
  const margin = TREE_PAD + 12;
  const depthSpan = (levels - 1) * levelPitch;
  const edgeKey = (i: number) => `${key}/edge-${i}`;
  const marks: Mark[] = [
    // The plinth is the tree's body, not ground: it counts toward how much of the stage the subject fills.
    {
      kind: "box", key: `${key}/plinth`, at: add(at, [leafPitch / 2 - margin, -margin, 0]),
      size: [width - leafPitch + 2 * margin, depthSpan + 2 * margin, TREE_PLINTH], radius: 6, tone: "base",
      surface: { seam: 0.4 },
    } as BoxMark,
  ];
  for (let i = 1; i < size; i++) {
    const p = (i - 1) >> 1;
    const tone = edgeTone?.(i);
    // Edges lie on the plinth between pad centres; the pads cover their ends.
    marks.push({
      kind: "link", key: edgeKey(i), from: add(centre(p), [0, 0, TREE_PLINTH]), to: add(centre(i), [0, 0, TREE_PLINTH]),
      width: tone ? 2.6 : 1.8, layer: "floor", tone: tone ?? "structure",
    } as LinkMark);
  }
  for (let i = 0; i < size; i++) {
    marks.push({ kind: "cylinder", key: `${key}/pad-${i}`, at: add(centre(i), [0, 0, TREE_PLINTH]), radius: TREE_PAD, height: PAD_HEIGHT, tone: "muted" } as CylinderMark);
    if (slotLabel !== null) {
      marks.push({ kind: "label", key: `${key}/slot-${i}`, at: add(centre(i), [TREE_PAD + 6, TREE_PAD + 6, TREE_PLINTH]), text: slotLabel ? slotLabel(i) : String(i), size: "small", optional: !slotLabel } as LabelMark);
    }
  }
  const top = TREE_PLINTH + PAD_HEIGHT;
  const t = part(key, marks, {
    root: add(centre(0), [0, 0, top]),
    front: add(at, [width / 2, depthSpan + margin, TREE_PLINTH / 2]),
    left: add(at, [leafPitch / 2 - margin, depthSpan / 2, TREE_PLINTH / 2]),
  }, { root: `${key}/pad-0`, front: `${key}/plinth`, left: `${key}/plinth` });
  return {
    ...t,
    slot: (i) => (check(i), add(centre(i), [0, 0, top])),
    size,
    depth: (i) => (check(i), depth(i)),
    edge: (i) => {
      check(i);
      if (i === 0) throw new RangeError("The root has no edge to a parent");
      return edgeKey(i);
    },
    top,
  };
}
