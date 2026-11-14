// Kit gallery: the binary tree and its pucks, filled in array order. It shows
// that position i has children 2i+1 and 2i+2, so a complete tree fills level
// by level, left to right, and keeps the part passing every check.
import { defineScene } from "../../../src/core/scene.ts";
import type { Mark } from "../../../src/core/types.ts";
import { puck } from "../../../src/parts/flow.ts";
import { TREE_PUCK, treeAssembly } from "../../../src/parts/tree.ts";
import { strip } from "../../../src/render/components.ts";

const VALUES = ["A", "B", "C", "D", "E", "F", "G"];
interface State { filled: number }
type Event = { index: number };

export function run(): { event: Event; state: State }[] {
  return VALUES.map((_, i) => ({ event: { index: i }, state: { filled: i + 1 } }));
}

const parent = (i: number) => (i - 1) >> 1;

export default defineScene<State, Event>({
  id: "gallery-tree",
  title: "Complete binary tree",
  question: "Where does the next node go?",
  presentation: "editorial",
  trust: "computed",
  setup: "Positions are numbered level by level. Position i has children 2i+1 and 2i+2, so each new node takes the leftmost free spot.",
  assumptions: ["Only the shape is shown: values are letters in arrival order, with no ordering rule."],
  trace: () => ({
    initial: { filled: 0 },
    intro: "An empty tree with seven positions.",
    steps: run().map(({ event, state }) => ({
      event, state,
      caption: event.index === 0 ? `${VALUES[0]} takes the root, position 0.` : `${VALUES[event.index]} takes position ${event.index}, a child of position ${parent(event.index)}.`,
    })),
  }),
  teaching: (s, e) => ({
    chapter: !e ? "Tree" : e.index === 0 ? "Root" : e.index < 3 ? "Level one" : "Leaves",
    heading: !e ? "Seven positions, numbered level by level." : e.index === 0 ? `${VALUES[0]} takes the root.` : `${VALUES[e.index]} goes under ${VALUES[parent(e.index)]}.`,
  }),
  view: (s, e) => {
    const tree = treeAssembly({ key: "tree", levels: 3, leafPitch: 34, levelPitch: 34, edgeTone: (i) => (e && e.index === i && i > 0 ? "accent" : undefined) });
    const marks: Mark[] = [...tree.marks];
    for (let i = 0; i < s.filled; i++) {
      const now = e?.index === i;
      marks.push(puck({ key: `node-${VALUES[i]}`, at: tree.slot(i), ...TREE_PUCK, label: VALUES[i], tone: now ? "accent" : "subject", lit: now, enter: "drop" }));
    }
    return marks;
  },
  readout: (s) => `${s.filled} of 7 positions`,
  legend: [{ tone: "accent", label: "Node just placed, and its edge" }, { tone: "subject", label: "Node" }],
  panels: (s) => [{
    key: "order", title: "Arrivals",
    html: strip(VALUES.map((v, i) => (i < s.filled ? { label: v, note: `pos ${i}`, status: i === s.filled - 1 ? "accent" as const : "good" as const, key: `chip-${v}` } : { label: v, status: i === s.filled ? "next" as const : "waiting" as const, key: `chip-${v}` }))),
  }],
  observe: (s) => [
    ...VALUES.slice(0, s.filled).flatMap((v) => [
      { type: "text" as const, key: `node-${v}`, equals: v },
      { type: "visible" as const, key: `node-${v}`, visible: true },
    ]),
    { type: "visible", key: "tree/pad-6", visible: true },
  ],
});
