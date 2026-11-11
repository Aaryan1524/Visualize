// Fixture for `verify --controls`. The clean variant must pass every check;
// each broken variant must be caught by the check named in verify.mjs.
import stack from "../stack/scene.ts";
import lru from "../../../examples/lru/scene.ts";
import { defineScene } from "../../../src/core/scene.ts";
import type { Mark } from "../../../src/core/types.ts";

const clean = defineScene({ ...stack, id: "clean" });
const editorial = defineScene({ ...lru, id: "editorial" });
const wrongTone = defineScene({
  ...stack, id:"wrong-tone",
  view:(s,e)=>stack.view(s,e).map(m=>m.key==="base" ? {...m,tone:"bad"} : m),
  observe:(s,e)=>[...stack.observe!(s,e,0),{type:"tone",key:"base",equals:"base"}],
});

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

/**
 * More labels on one spot than the renderer's collision nudging can
 * separate (it resolves a few; this crowd is too many).
 */
const crowdedLabels = defineScene({
  ...stack,
  id: "crowded-labels",
  view: (s, e) => [
    ...stack.view(s, e),
    ...Array.from({ length: 12 }, (_, i) => ({ kind: "label" as const, key: `note-${i}`, at: [40, i * 0.1, 0] as const, text: `crowded label ${i}` })),
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

/** A mark that exists in the DOM but sits entirely behind a larger solid. */
const hiddenBehind = defineScene({
  ...stack,
  id: "hidden-behind",
  view: (s, e) => [
    ...stack.view(s, e),
    // Directly behind the screen along the line of sight (−1, −1, −1), away from the stack.
    { kind: "box", key: "screen", at: [60, -40, 0], size: [30, 30, 60], tone: "structure" },
    { kind: "box", key: "hidden", at: [51, -49, 6], size: [8, 8, 8], tone: "bad" },
  ],
  observe: () => [{ type: "visible", key: "hidden", visible: true }],
});

/** A bar drawn at a different height from the one its value implies. */
const wrongSize = defineScene({
  ...stack,
  id: "wrong-size",
  observe: (s) => s.items.map((it) => ({ type: "extent" as const, key: it.id, size: [24, 24, 12] as const })),
});

/** The declared order is the reverse of what is drawn. */
const wrongOrder = defineScene({
  ...stack,
  id: "wrong-order",
  observe: (s) => (s.items.length > 1 ? [{ type: "order" as const, keys: s.items.map((i) => i.id), axis: "y" as const }] : []),
});

/** The model says the pushed item is the one to watch; the view never lights it. */
const unlit = defineScene({
  ...stack,
  id: "unlit",
  view: (s, e) => stack.view(s, e).map((m) => ({ ...m, lit: false })),
});

/** A label far wider than the face it sits on. */
const wideLabel = defineScene({
  ...stack,
  id: "wide-label",
  view: (s, e) => stack.view(s, e).map((m) => (m.kind === "box" && m.label ? { ...m, label: `${m.label} is a very long label` } : m)),
});

/** Labels on the tops of stacked blocks, covered by the block above. */
const coveredLabel = defineScene({
  ...stack,
  id: "covered-label",
  view: (s, e) => stack.view(s, e).map((m) => (m.kind === "box" && m.label ? { ...m, labelFace: "top" as const } : m)),
});

export const variants = {
  clean,
  editorial,
  "wrong-tone":wrongTone,
  "wrong-value": wrongValue,
  "crowded-labels": crowdedLabels,
  intersecting,
  "hidden-behind": hiddenBehind,
  "wrong-size": wrongSize,
  "wrong-order": wrongOrder,
  unlit,
  "wide-label": wideLabel,
  "covered-label": coveredLabel,
};

export default clean;
