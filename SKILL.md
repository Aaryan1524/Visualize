---
name: visualize
description: Build step-through visual explanations whose picture is checked against an executable model, drawn in one constrained isometric style from finished parts (rails, rings, markers, reservoirs, sources, gates, terminals, servers, ledgers, cables, plates) in the shape the field already draws, with flat linked panels for equations, grids and sequence diagrams. Use whenever someone wants an algorithm, data structure, protocol, distributed-system behaviour, ML mechanism or paper method explained visually, animated or step by step, for docs, a blog, a course, onboarding or a paper companion, even if they never say "visualize". Outputs a standalone HTML page, a standalone SVG of any step, or a React component; every number on the page is verified against the model in headless Chrome.
license: MIT
compatibility: Node.js 24+ (runs TypeScript directly) and Google Chrome or Chromium for verification. Run `npm install` (or `pnpm install`) once in this folder.
metadata:
  version: "0.4.0"
---

# Visualize

A figure here is a model you can watch. You write a small executable model of the idea and a view that maps each of its states to parts. The engine moves the parts between states. `verify` proves that the page shows what the model computed, at every step (checked at 1280 px in the light theme), and that it stays readable and tidy in both themes on desktop and phone.

Three reference explanations ship in `examples/`. Open the closest one before starting:

- `examples/lru/`: a cache on a recency rail. A hit hops an entry to the fresh end; an eviction pushes the stalest off the cold end. It has a prediction before the first eviction.
- `examples/retries/`: two payment systems on two plates (terminal, server, key store, ledger), run on the same faults. The ledger without idempotency keys ends with two coins, the one with keys with one.
- `examples/attention/`: scaled dot-product attention. Gauges morph from score to scaled score to weight, linked to the equation and grids in a side column.

`test/fixtures/gallery-ring/` and `test/fixtures/gallery-flow/` show the ring, marker, reservoir, source, gate and sequence parts on their own.

## The one idea that matters

**The model is the truth, and the picture is checked against it.** Never type a number, an order or an outcome into the view. Compute it in the model, show it through the view, and declare what the reader should see as observations, which `verify` reads back from the rendered page.

**For the look: one causal moment per step, and everything else recedes.** The engine focuses whatever changed since the last step and lets the rest fall back toward the stage. Your job is to make the change itself visible at rest: a lost message stays on the wire, a second charge stacks a second coin. A step where nothing visible changes is a step that teaches nothing.

## Choose the representation

**Start from what the field already draws.** Before choosing parts, write one line in your plan: "A textbook draws <concept> as <shape>." A round-robin scheduler is a circle of slots with a pointer moving round it. A semaphore is a pool of permits that a caller takes at a gate and gives back. Quicksort's partition is a row of cells with i and j marked on it. Two-phase commit is a sequence diagram with time running down. That shape is what the reader already knows; build *it*, in the kit's style, and say why if you depart from it.

The evals taught this. Without it, four of five subjects came out as a straight rail of slots because that was the part at hand, and a plain flat diagram drawn without the skill taught them better each time.

Then go down this ladder and stop at the first rung that fits. Name the rung in your plan.

1. **The concept's canonical shape, built as finished parts.** A cache is slots on a rail. Anything circular is a `ringAssembly` with `marker`s for its positions. A stock of something countable is a `reservoir`, refilled by a `source`, and callers meet it at a `gate`. A payment system is a terminal, a server and a ledger joined by cables. One part per real element, counted true. Draw the cause, not only the states: what a request consumes must visibly go to it, and a rate must have a source.
2. **Native flat panels beside the stage**, linked by entity ids to the solids: `tex` and `grid` for equations and matrices, and `sequence` for anything the field draws on a timeline (protocols, retries, timeouts). When time is the subject, the timeline is not optional.
3. **An analogy, only with a written mapping.** List what each part means and what the analogy does not preserve, in `assumptions`.

Do not draw boxes-and-arrows diagrams. Do not invent a decorative machine whose parts mean nothing. Do not force a subject onto a rail because the rail exists: a missing part is a kit gap, so build it in `src/parts/`.

## Decisions this skill makes

A one-line prompt leaves these open. Decide them like this without asking. Ask the user only about the three marked **ask**, and only when the prompt and files don't answer them.

| Decision | Default | Why |
|---|---|---|
| **The scenario** (concept, sizes, values) **ask** if they change the answer | Small readable values (capacity 3–6, $20, 40 ms); state them in `assumptions` | Small numbers keep every value legible on a face |
| **Output destination** **ask** if unclear | Standalone page always; plus SVG of the key step when they say image, blog or static; plus React when they say component, React or Next.js | Every output is checked, so producing the page first costs nothing |
| **What to contrast with** **ask** when "versus what?" is ambiguous | The naive alternative the concept fixes (FIFO for LRU, no key for idempotency) | A contrast makes the mechanism visible |
| Representation | The shape the field draws (write the one line), built at rung 1 of the ladder | A reader recognises the shape they were taught; the evals lost wherever it was missing |
| Pointers and indices | `marker`s standing at their slot (`ring.outside(i)`, `rail.front(i)`), never a separate track in front | A pointer on a lane in front read as being on the wrong slot |
| Time | A `sequence` side panel whenever timing is the point (timeouts, retries, rates) | Time with no axis lives only in captions |
| Size | A **figure**: one system, 6–11 steps, 3–5 chapters. A **reference**: two systems compared, at most 12 steps. Larger: refuse and propose a split | Past 12 steps, readers lose the thread; two systems is the most a stage holds legibly |
| Number of systems | One; two only when the point is a contrast run on the same inputs | Two lanes halve the size of everything |
| Input sequence | Chosen so every interesting case happens, each asserted in `model.test.ts` | A run without the eviction or loss explains nothing |
| Prediction | Exactly one, just before the causal decision | Predicting forces the reader to hold the rule |
| Focus | Automatic (what changed); set `teaching.focus` only when the cause is not what moved | The default is right for most steps and is checked |
| Parts | Kit parts; a new part in `src/parts/` when none fits; never raw boxes in a scene | Finish and checks come with the part |
| Colour | Neutral parts; a semantic tone only for an outcome class (hit, miss, lost, duplicate, stored), at most three meanings, each in the legend | Colour that means everything means nothing |
| Words | Title 8 words or fewer; one action of 12 words or fewer per step; part names of 1–3 words, in a row with leaders | Paragraphs get read instead of the figure |
| Flat maths | Only when the concept has equations or matrices; terms linked to solids | Maths on a tilted face is unreadable |
| Theme | Follow the reader's preference; review in light first, then dark | Both are checked |
| Trust | `computed` for exact models, `model` for simplified ones, `sourced` only with an exact location | The badge must be true |
| Where files go | In the user's project: the scene in an explanations folder, the built page in its public or static folder, screenshots beside the scene (verify puts them there) | Keeps the skill folder clean |

## Workflow

`<skill>` is this folder. Scenes can live in any project: the scripts take paths, and scene files import the kit from `<skill>/src`, which the scaffold sets up.


1. **Write the model** (`model.ts`): pure functions returning the state after every event. Test it against a separately written reference implementation and edge cases (`model.test.ts`). Choose the input sequence so the interesting cases happen: a hit, a full-cache miss, a lost message, a divergence.
2. **Scaffold the scene**: `node <skill>/scripts/new-scene.mjs <name> --dir <folder>` writes a model, a test and an editorial scene that build and verify as generated. Replace the model first, then the view.
3. **Assemble the view from parts.** Use `src/parts/`. Every mark's `key` is a model entity id: keys carry identity across steps, so motion, linking and checks follow them. Position things with the parts' anchors, not by eye.
4. **Teach in beats** (`teaching`). Use 3–5 chapters and one short action per step (12 words at most). Add one prediction just before the causal moment, such as "D is next. Which key leaves?". The longer caption, assumptions and transcript go in the Details drawer automatically.
5. **Declare observations** (`observe`): every value shown, every order that matters, every size that encodes a number (`extent`), what must be visible and what must be gone, semantic tones, and what is lit.
   **Working draft early:** after the model and a rough view, build and open the page before any polish. A wrong representation is cheap to change now and expensive later.
6. **Build, verify and look.** Run `node <skill>/scripts/build.mjs <dir> --out <folder>` and then `node <skill>/scripts/verify.mjs <dir>`, and fix until it prints `passed`. Screenshots go to `<parent of dir>/shots/<name>/`. Then open the screenshots and the two contact sheets in `shots/` and look at them, at 1× and with `scripts/shoot.mjs` at 4×. A passing verify proves correctness and mechanical tidiness, not beauty.
7. **Deliver** with this report, and nothing vaguer:

   ```text
   Built <title>: <n> steps in <chapters> chapters, from <parts>. Model tested against <reference>.
   verify: passed (<n> observations; depth, focus, labels, layout, both themes). Files: <page>, <scene dir>.
   Open: <page>#step=<the key step>. Not verified by machine: <whatever you judged only by eye>.
   ```
8. **Export** if needed: `node <skill>/scripts/export-svg.mjs <built page> --step k --out f.svg --frame` (checked against the live stage; `--frame` adds the title, the step's action and the legend, so an image in a post reads on its own; leave it off only when the host page supplies them), or `<Figure scene={…} />` from `<skill>/src/react/Figure.tsx` (see `references/authoring.md`).

## Parts

| Part | Module | Use it for | Anchors |
|---|---|---|---|
| `railAssembly` and `cartridge` | `src/parts/rail.ts` | Ordered slots in a line with entries that slide, hop and leave: caches, queues, arrays (up to 16), priority orders. `slotLabel` names slots; given names are never dropped; `ports` gives a cable per slot | `slot(i)`, `front(i)`, `port(i)`, `anchor.first`, `anchor.last` |
| `ringAssembly` and `puck` | `src/parts/flow.ts` | Slots round a circle: circular buffers, hash rings, round robin, clock replacement | `slot(i)`, `outside(i)`, `side(i)`, `anchor.centre` |
| `marker` | same | A pointer standing at one slot: head, tail, lo, mid, hi, next. Hops to its next slot; lanes for two on one slot | `tip`, `foot` |
| `reservoir` | same | A countable stack with its capacity: tokens, permits, credits, free buffers | `top`, `take`, `front`, `capacity` |
| `source` | same | Something that adds at a rate, over what it fills: refill, arrivals, a producer | `out`, `body` |
| `gate` | same | Where a request meets what it needs and passes (bar up) or is turned away (bar down) | `in`, `out`, `reject`, `top` |
| `terminal` | `src/parts/network.ts` | A client or device with a lit status screen | `port`, `outbox`, `top`, `screen` |
| `server` | same | A service: rack units, vents, a status lamp whose tone shows activity | `inPort`, `inbox`, `outPort`, `top`, `front` |
| `ledger` | same | Durable records stacked one per entry: charges, writes, commits | `inPort`, `top`, `front` |
| `keyStore` | same | A store of keys or tokens with a stored item | `top`, `front` |
| `plate` | same | The fastened ground a system stands on | `frontLeft`, `backRight` |
| `cable` and `message` | same | Connections lying on the plate, and capsules that ride them | n/a |
| `strip` and `totals` | `src/render/components.ts` | The strip under the stage: requests or events, and big totals | n/a |
| `sequence` | same | A flat side panel: lanes, time running down, messages (lost ones crossed), timer marks | n/a |
| `tex`, `linked` and `grid` | `src/render/math.ts` | Flat equations and number grids whose terms link to solids | n/a |

When a concept needs a part that does not exist, build it in `src/parts/` from boxes and cylinders with owned surface details (`references/kit.md`). Never use scene-specific CSS. A missing part is a kit gap; record it.

## Craft rules (short form)

`references/craft.md` gives the reasons.

- **One constrained style.** Use the fixed isometric camera, the shared tones and the kit's shading. Colour carries meaning (hit, miss, lost, duplicate, stored), one meaning per tone, stated in the legend.
- **Finished parts, not slabs.** Housings have seams, screens are recessed, servers show rack units and vents, round things are turned. Detail belongs to a part and follows its motion.
- **Motion means something.** Use `enter` and `exit` for coming and going, `leaving` for "goes there" (evicted, consumed, delivered), `arc` to pass over neighbours, travel along a cable for messages, and `pulse` for a moment of emphasis. Nothing moves for decoration. A thing consumed travels to what consumed it.
- **Identity is drawn.** Which slot, which connection, which pointer: names a scene gives are never dropped, and a cable's tone shows whether it is in use.
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
