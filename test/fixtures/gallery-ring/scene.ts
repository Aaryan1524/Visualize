// Kit gallery: a ring of slots with entries and markers standing on slots.
// Used to look at the parts and to keep them passing every check.
import { defineScene } from "../../../src/core/scene.ts";
import type { Mark } from "../../../src/core/types.ts";
import { marker, puck, ringAssembly } from "../../../src/parts/flow.ts";

interface State { cells: (string | null)[]; a: number; b: number }
const N = 8;
const STATES: State[] = [
  { cells: Array(N).fill(null), a: 0, b: 0 },
  { cells: ["P", "Q", "R", null, null, null, null, null], a: 3, b: 0 },
  { cells: ["P", "Q", "R", "S", "T", "U", "V", null], a: 7, b: 2 },
  { cells: ["W", "Q", "R", "S", "T", "U", "V", null], a: 1, b: 2 },
];

export default defineScene<State, number>({
  id: "gallery-ring",
  title: "Kit gallery: ring",
  question: "Where do the markers stand?",
  presentation: "editorial",
  trust: "model",
  trace: () => ({
    initial: STATES[0]!,
    intro: "An empty ring.",
    steps: STATES.slice(1).map((state, i) => ({ event: i, state, caption: `State ${i + 1}.` })),
  }),
  view: (s) => {
    const ring = ringAssembly({ key: "ring", slots: N, at: [0, 0, 0] });
    const marks: Mark[] = [...ring.marks];
    s.cells.forEach((v, i) => { if (v) marks.push(puck({ key: `v-${v}`, at: ring.slot(i), label: v, tone: "subject", enter: "drop", exit: "lift" })); });
    marks.push(...marker("mark-a", ring.outside(s.a), "A", { tone: "accent", side: ring.side(s.a) }).marks);
    marks.push(...marker("mark-b", ring.outside(s.b), "B", { tone: "cold", lane: s.a === s.b ? 1 : 0, side: ring.side(s.b) }).marks);
    return marks;
  },
  teaching: (s, _e, k) => ({ chapter: k < 2 ? "Fill" : "Wrap", heading: k === 0 ? "An empty ring of eight." : `A on ${s.a}, B on ${s.b}.` }),
  readout: (s) => `A ${s.a} · B ${s.b}`,
  observe: (s) => s.cells.flatMap((v) => (v ? [{ type: "text" as const, key: `v-${v}`, equals: v }] : [])),
});
