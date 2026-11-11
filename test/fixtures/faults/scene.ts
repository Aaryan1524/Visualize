// Fixture for `verify --controls`. The clean variant must pass every check;
// each broken variant must be caught by the check named in verify.mjs.
import stack from "../stack/scene.ts";
import { defineScene } from "../../../src/core/scene.ts";
import type { Mark } from "../../../src/core/types.ts";

const clean = defineScene({ ...stack, id: "clean" });

/** The panel shows a different value from the one the model holds. */
const wrongValue = defineScene({
  ...stack,
  id: "wrong-value",
  // The view lists the items top to bottom while the model (and the panel title) say bottom to top.
  panels: (s) => [
    {
      key: "list",
      title: "Contents, bottom to top",
      html: `<p data-key="contents">${[...s.items].reverse().map((i) => i.value).join(" · ") || "empty"}</p>`,
    },
  ],
});

/** Two labels drawn on top of each other. */
const crowdedLabels = defineScene({
  ...stack,
  id: "crowded-labels",
  view: (s, e) => [
    ...stack.view(s, e),
    { kind: "label", key: "note-a", at: [40, 0, 0], text: "first label" },
    { kind: "label", key: "note-b", at: [40, 1, 0], text: "second label" },
  ],
});

/** Two solids that occupy the same space, so no painter's order is right. */
const intersecting = defineScene({
  ...stack,
  id: "intersecting",
  view: (s, e) => {
    const marks: Mark[] = stack.view(s, e);
    return [...marks, { kind: "box", key: "intruder", at: [8, 8, -2], size: [24, 24, 8], tone: "bad" }];
  },
  observe: () => [{ type: "visible", key: "intruder", visible: true }],
});

export const variants = {
  clean,
  "wrong-value": wrongValue,
  "crowded-labels": crowdedLabels,
  intersecting,
};

export default clean;
