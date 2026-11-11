// Smallest scene that exercises enter, exit, move, labels and panels.
// Used to smoke-test the player and as the base for planted-fault controls.
import { defineScene } from "../../../src/core/scene.ts";
import type { Mark } from "../../../src/core/types.ts";

type Op = { type: "push"; value: string } | { type: "pop" };
interface State {
  items: { id: string; value: string }[];
}

const OPS: Op[] = [
  { type: "push", value: "A" },
  { type: "push", value: "B" },
  { type: "push", value: "C" },
  { type: "pop" },
  { type: "push", value: "D" },
];

export function run(ops: Op[]) {
  let items: State["items"] = [];
  let n = 0;
  return ops.map((op) => {
    if (op.type === "push") items = [...items, { id: `i${n++}`, value: op.value }];
    else items = items.slice(0, -1);
    return { event: op, state: { items } };
  });
}

export default defineScene<State, Op>({
  id: "stack",
  title: "Stack",
  question: "Which item does pop remove?",
  trust: "computed",
  trace: () => ({
    initial: { items: [] },
    intro: "An empty stack.",
    steps: run(OPS).map(({ event, state }) => ({
      event,
      state,
      caption: event.type === "push" ? `Push ${event.value} onto the top.` : "Pop removes the most recent item.",
    })),
  }),
  view: (s, e) => {
    const marks: Mark[] = [{ kind: "box", key: "base", at: [-6, -6, -4], size: [36, 36, 4], tone: "base" }];
    s.items.forEach((it, i) => {
      marks.push({
        kind: "box",
        key: it.id,
        at: [0, 0, i * 12],
        size: [24, 24, 10],
        tone: i === s.items.length - 1 ? "accent" : "subject",
        label: it.value,
        labelFace: "right",
        link: `item-${it.id}`,
        enter: "drop",
        exit: "lift",
        lit: e?.type === "push" && i === s.items.length - 1,
      });
    });
    return marks;
  },
  readout: (s) => `size ${s.items.length}`,
  panels: (s) => [
    {
      key: "list",
      title: "Contents, bottom to top",
      html: `<p data-key="contents">${s.items.map((i) => `<span data-link="item-${i.id}">${i.value}</span>`).join(" · ") || "empty"}</p>`,
    },
  ],
  observe: (s, e) => [
    { type: "text", key: "contents", equals: s.items.map((i) => i.value).join(" · ") || "empty" },
    // Screen y grows downward, so top-to-bottom is the order of increasing y.
    ...(s.items.length > 1 ? [{ type: "order" as const, keys: [...s.items].reverse().map((i) => i.id), axis: "y" as const }] : []),
    ...(e?.type === "push" ? [{ type: "lit" as const, key: s.items.at(-1)!.id }] : []),
    ...s.items.map((it) => ({ type: "visible" as const, key: it.id, visible: true })),
    ...s.items.map((it) => ({ type: "extent" as const, key: it.id, size: [24, 24, 10] as const })),
  ],
  legend: [
    { tone: "accent", label: "Top of the stack" },
    { tone: "subject", label: "Item" },
  ],
});
