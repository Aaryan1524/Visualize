---
name: visualize
description: Build step-through visual explanations whose picture is checked against an executable model, drawn in one constrained isometric style from finished parts (rails, cartridges, terminals, servers, ledgers, key stores, cables, plates) with flat linked panels for equations and number grids. Use whenever someone wants an algorithm, data structure, protocol, distributed-system behaviour, ML mechanism or paper method explained visually, animated or step by step, for docs, a blog, a course, onboarding or a paper companion, even if they never say "visualize". Outputs a standalone HTML page, a standalone SVG of any step, or a React component; every number on the page is verified against the model in headless Chrome.
license: MIT
compatibility: Node.js 24+ (runs TypeScript directly) and Google Chrome or Chromium for verification. Run `npm install` (or `pnpm install`) once in this folder.
metadata:
  version: "0.2.0"
---

# Visualize

A figure here is a model you can watch. You write a small executable model of the idea and a view that maps each of its states to parts. The engine moves the parts between states, and `verify` proves the page shows what the model computed, at every step, in both themes, on desktop and phone.

Three reference explanations ship in `examples/`. Open the closest one before starting:

- `examples/lru/`: a cache on a recency rail. A hit hops an entry to the fresh end; an eviction pushes the stalest off the cold end. It has a prediction before the first eviction.
- `examples/retries/`: two payment systems on two plates (terminal, server, key store, ledger), run on the same faults. The ledger without idempotency keys ends with two coins, the one with keys with one.
- `examples/attention/`: scaled dot-product attention. Gauges morph from score to scaled score to weight, linked to the equation and grids. It is not yet in the editorial style.

## The one idea that matters

**The model is the truth, and the picture is checked against it.** Never type a number, an order or an outcome into the view. Compute it in the model, show it through the view, and declare what the reader should see as observations, which `verify` reads back from the rendered page.

## Choose the representation

Go down this ladder and stop at the first rung that fits. Name the rung in your plan.

1. **The concept's own structure, built as finished parts.** A cache is slots on a rail; a payment system is a terminal, a server and a ledger joined by cables; a queue is items in a channel. One part per real element, counted true.
2. **Native flat mathematics beside the stage.** For equations, matrices and derivations, use flat panels (`tex`, `grid`) linked by entity ids to the solids they describe.
3. **An analogy, only with a written mapping.** List what each part means and what the analogy does not preserve, in `assumptions`.

Do not draw boxes-and-arrows diagrams. Do not invent a decorative machine whose parts mean nothing.

## Workflow

1. **Write the model** (`model.ts`): pure functions returning the state after every event. Test it against a separately written reference implementation and edge cases (`model.test.ts`). Choose the input sequence so the interesting cases happen: a hit, a full-cache miss, a lost message, a divergence.
2. **Scaffold the scene**: `node scripts/new-scene.mjs <name>` writes a model, a test and an editorial scene that build and verify as generated. Replace the model first, then the view.
3. **Assemble the view from parts.** Use `src/parts/`. Every mark's `key` is a model entity id: keys carry identity across steps, so motion, linking and checks follow them. Position things with the parts' anchors, not by eye.
4. **Teach in beats** (`teaching`). Use 3–5 chapters and one short action per step (12 words at most). Add one prediction just before the causal moment, such as "D is next. Which key leaves?". The longer caption, assumptions and transcript go in the Details drawer automatically.
5. **Declare observations** (`observe`): every value shown, every order that matters, every size that encodes a number (`extent`), what must be visible and what must be gone, semantic tones, and what is lit.
6. **Build, verify and look.** Run `node scripts/build.mjs <dir>` and then `node scripts/verify.mjs <dir>`, and fix until it prints `passed`. Then open the screenshots and the two contact sheets in `shots/` and look at them, at 1× and with `scripts/shoot.mjs` at 4×. A passing verify proves correctness and mechanical tidiness, not beauty.
7. **Export** if needed: `node scripts/export-svg.mjs <page> --step k --out f.svg` (checked against the live stage), or `<Figure scene={…} />` from `src/react/Figure.tsx`.

## Parts

| Part | Module | Use it for | Anchors |
|---|---|---|---|
| `railAssembly` and `cartridge` | `src/parts/rail.ts` | Ordered slots with entries that slide, hop and leave: caches, queues, buffers, priority orders | `slot(i)`, `anchor.first`, `anchor.last` |
| `terminal` | `src/parts/network.ts` | A client or device with a lit status screen | `port`, `outbox`, `top`, `screen` |
| `server` | same | A service: rack units, vents, a status lamp whose tone shows activity | `inPort`, `inbox`, `outPort`, `top`, `front` |
| `ledger` | same | Durable records stacked one per entry: charges, writes, commits | `inPort`, `top`, `front` |
| `keyStore` | same | A store of keys or tokens with a stored item | `top`, `front` |
| `plate` | same | The fastened ground a system stands on | `frontLeft`, `backRight` |
| `cable` and `message` | same | Connections lying on the plate, and capsules that ride them | n/a |
| `strip` and `totals` | `src/render/components.ts` | The strip under the stage: requests or events, and big totals | n/a |
| `tex`, `linked` and `grid` | `src/render/math.ts` | Flat equations and number grids whose terms link to solids | n/a |

When a concept needs a part that does not exist, build it in `src/parts/` from boxes and cylinders with owned surface details (`references/kit.md`). Never use scene-specific CSS. A missing part is a kit gap; record it.

## Craft rules (short form)

`references/craft.md` gives the reasons.

- **One constrained style.** Use the fixed isometric camera, the shared tones and the kit's shading. Colour carries meaning (hit, miss, lost, duplicate, stored), one meaning per tone, stated in the legend.
- **Finished parts, not slabs.** Housings have seams, screens are recessed, servers show rack units and vents, round things are turned. Detail belongs to a part and follows its motion.
- **Motion means something.** Use `enter` and `exit` for coming and going, `leaving` for "goes there" (evicted, consumed, delivered), `arc` to pass over neighbours, travel along a cable for messages, and `pulse` for a moment of emphasis. Nothing moves for decoration.
- **Words are few and pinned.** Use a title of 8 words at most, one action per step and short part names with leaders. A label that does not fit its face is not drawn; optional labels drop where they would sit on a part.
- **The figure dominates.** One desktop viewport holds the title, the stage, the current action, the strip and the controls.

## Review gates

| Command | Must end with |
|---|---|
| `pnpm test` | all pass (models against references, engine, parts) |
| `pnpm typecheck` | no errors |
| `node scripts/verify.mjs <dir>` | `passed` |
| `pnpm verify:controls` | `all … planted faults caught; clean fixture passes` (after changing the kit or checks) |
| `node scripts/export-svg.mjs …` | no `differs` beyond tolerance (when exporting) |
| `pnpm check:embed` | `embed: passed` (after changing the player or styles) |

Then read the PNGs. Fix in the kit, not the scene, when a problem would recur elsewhere. `references/verify.md` explains every failure line and its usual fix.

## References

- `references/authoring.md`: the scene contract (model, trace, view, teaching, observe, panels), editorial layout, predictions, copy budgets, embedding in React, and SVG export.
- `references/kit.md`: marks, surface details, motion vocabulary, label rules, every part's options and anchors, components and maths.
- `references/craft.md`: the visual rules, each with the defect that taught it.
- `references/verify.md`: every check, what its failures mean, how to fix them, and what the checks cannot see.
- `evals/evals.json`: held-out prompts for testing the skill on unfamiliar concepts.
