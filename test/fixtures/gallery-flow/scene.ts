// Kit gallery: a source over a reservoir, a gate, a lane, and a sequence panel.
import { defineScene } from "../../../src/core/scene.ts";
import type { Mark } from "../../../src/core/types.ts";
import { gate, reservoir, source } from "../../../src/parts/flow.ts";
import { message } from "../../../src/parts/network.ts";
import { sequence } from "../../../src/render/components.ts";

interface State { held: number; t: number; open: boolean | null; passed: number; turned: number }
const STATES: State[] = [
  { held: 3, t: 0, open: null, passed: 0, turned: 0 },
  { held: 2, t: 10, open: true, passed: 1, turned: 0 },
  { held: 0, t: 20, open: true, passed: 3, turned: 0 },
  { held: 0, t: 30, open: false, passed: 3, turned: 1 },
  { held: 1, t: 40, open: null, passed: 3, turned: 1 },
];

export default defineScene<State, number>({
  id: "gallery-flow",
  title: "Kit gallery: flow",
  question: "What does the gate need?",
  presentation: "editorial",
  trust: "model",
  trace: () => ({
    initial: STATES[0]!,
    intro: "Three items held.",
    steps: STATES.slice(1).map((state, i) => ({ event: i, state, caption: `t = ${state.t}.` })),
  }),
  view: (s) => {
    const tank = reservoir("tank", [0, 0, 0], { capacity: 5, items: Array.from({ length: s.held }, (_, i) => ({ id: `i${i}`, tone: "hot" as const })) });
    const tap = source("tap", [0, 0, 0], { rate: "+1 per 10" });
    const g = gate("gate", [60, 10, 0], { open: s.open, lit: s.open !== null });
    const marks: Mark[] = [...tank.marks, ...tap.marks, ...g.marks];
    if (s.open === true) marks.push(message("req-ok", g.anchor.out, "request", { tone: "good" }));
    if (s.open === false) marks.push(message("req-no", g.anchor.reject, "request", { tone: "bad" }));
    return marks;
  },
  teaching: (s, _e, k) => ({ chapter: k < 3 ? "Pass" : "Refill", heading: s.open === false ? "Nothing held: turned away." : `t = ${s.t}: ${s.held} held.` }),
  readout: (s) => `${s.held} held · ${s.passed} passed · ${s.turned} turned away`,
  panels: (s) => [{
    key: "seq", title: "Over time", place: "side",
    html: sequence({
      lanes: [{ id: "c", label: "Client" }, { id: "g", label: "Gate" }],
      messages: [
        { id: "m1", from: "c", to: "g", at: 10, arrive: 12, label: "pass", status: "good" },
        { id: "m2", from: "c", to: "g", at: 20, arrive: 22, label: "pass", status: "good" },
        { id: "m3", from: "c", to: "g", at: 30, label: "turned away", status: "bad", lost: true, arrive: 34 },
      ],
      marks: [{ lane: "g", at: 40, label: "refill", status: "accent" }],
      now: s.t, until: 40, unit: "s",
    }),
  }],
  observe: (s) => [{ type: "visible", key: s.open === true ? "gate/bar-up" : "gate/bar-down", visible: true }],
});
