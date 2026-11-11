# Finished parts

The first shared assembly is a recency rail. It is appropriate for ordered slots and sliding entries; it is not a universal metaphor for other concepts.

```ts
import { railAssembly, cartridge, RAIL_CELL } from "./rail.ts";

const rail = railAssembly({ key: "cache", slots: state.capacity });
const marks = [
  ...rail.marks,
  ...state.order.map((key, i) => cartridge({
    key: `entry-${key}`,
    at: rail.slot(i),
    size: RAIL_CELL,
    label: key,
    tone: "subject",
    enter: "drop",
  })),
];
```

Use `presentation: "editorial"` for the desktop figure shell and shared material treatment. Supply a short `teaching.heading` and model observations. The optional panel and details drawer remain available. No CSS keyed to these entries or a scene id is necessary.

## Contract

- `railAssembly({ key, slots, at?, cell?, pitch?, flat? })` returns `marks`, `slot(i)`, `length`, `cell`, `id(name)` and `anchor.first/last`.
- Supports integer capacities 1–12. The default cell is 28×24×17, pitch 42. Custom cells must be at least 16×12×6, with at least six units of spacing between cells. These limits constrain geometry, not a guarantee of readable composition at every viewport.
- `at` translates the complete assembly, its slots and its anchors together. Two rails must use distinct key prefixes. The empty prefix is reserved for compatibility with the original LRU scene.
- Slots return the minimum corner of the resting entry. Each lies on its tray floor. The open tray ends allow recency moves without crossing a raised wall.
- Entries keep their model entity keys as they change slots. Animation remains the core's pure, seekable interpolation. An accessed entry can hop with `arc`; surface seams move with it automatically.
- `cartridge(mark)` attaches the shared radius, inset, seam and subject role. Semantic tone remains chosen by the model event. Do not assign arbitrary colour meanings inside a part.
- Anchor coordinates are derived from the assembly's placement. They are static anchors for this assembly; dynamic entity-relative connectors are a later capability.
- Surface details are owned by one box and rendered inside its depth-sorted group. Housing seams wrap the visible sides, fasteners sit on the housing face, ticks terminate on the guide edge, and the tray floor receives an inset shade. The floor treatment and highlight lines are surface graphics, not excavated or bevelled geometry.
- Foundation shadows and subject labels use semantic roles rather than entity-key CSS selectors.

## Evidence

`test/fixtures/rail/scene.ts` renders capacities 1, 3 and 6 through this API with the same CSS and renderer. Each fixture runs the LRU model, including a hit and an eviction. Unit tests cover placement, support, disjoint solid bounds and anchors at capacities 1, 2, 3, 6 and 12, plus repeatable animated surface placement. Browser checks sample depth, surface containment, model observations, replay and desktop fit.

```sh
node scripts/build.mjs test/fixtures/rail --out dist/rail
node scripts/verify.mjs test/fixtures/rail --quick
node scripts/review-rail.mjs
```

The last command writes a local gallery, full desktop captures, 4× close-ups and a step/motion sheet to `shots/rail-review/`. It retains `before.html` if a previous checkpoint has been saved there. No files are uploaded.

This is the first reusable assembly under visual review. It does not yet establish an approved general-purpose parts library, an installable skill, or standalone SVG/React exports.
