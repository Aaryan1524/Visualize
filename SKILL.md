---
name: visualize
description: Build step-through visual explanations whose picture is checked against an executable model, with a narrating voice, a prediction and practice questions. Real machines and physical systems (an escalator, an engine, a lock) are drawn as sharp, to-scale technical cutaways; abstract concepts are built from finished 3D parts in the same ink-drawing style (rails, rings, trees, markers, reservoirs, gates, servers, ledgers, cables) in the shape the field already draws, with flat linked panels for equations, grids and sequence diagrams. Use whenever someone wants a machine or device (how an escalator, lock or engine works), an algorithm, data structure, protocol, distributed-system behaviour, ML mechanism or paper method explained visually, animated or step by step, even if they never say "visualize". Outputs a standalone HTML page (concepts also as SVG or React), checked in headless Chrome.
license: MIT
compatibility: Works in Claude Code, Codex and Antigravity. Needs Node.js 24+ (runs TypeScript directly) and Google Chrome or Chromium for verification. Run `npm install` (or `pnpm install`) once in this folder.
metadata:
  version: "1.0.0"
---

# Visualize

A figure here is a model you can watch. You write a small executable model of the idea and a view that maps each of its states to parts. The engine moves the parts between states. `verify` proves that the page shows what the model computed, at every step (checked at 1280 px in the light theme), and that it stays readable and tidy in both themes on desktop and phone.

Three reference explanations ship in `examples/`. Open the closest one before starting:

- `examples/lru/`: a cache on a recency rail. A hit hops an entry to the fresh end; an eviction pushes the stalest off the cold end. It has a prediction before the first eviction.
- `examples/retries/`: two payment systems on two plates (terminal, server, key store, ledger), run on the same faults. The ledger without idempotency keys ends with two coins, the one with keys with one.
- `examples/attention/`: scaled dot-product attention. Gauges morph from score to scaled score to weight, linked to the equation and grids in a side column.

`examples/lru-3d/` is the flagship for concepts, in the drawing look with a voice. `examples/escalator/` is the flagship for mechanisms: a technical cutaway drawn to scale, with a voice, a prediction, What if, a lab and Now you try. `examples/lock/` is the second, built on the same shared page and player (`src/drawing/`), and shows depth: it opens with the problem, ends with the second idea (picking) and lets the reader cut their own key. `examples/derailleur/` is the third and the bar for the figure itself: bold shaded solids built on `src/rig/` (each part drawn once, then moved), so a machine reads as 3D and plays at 60 fps, with a camera that frames each step's subject; the main figure carries the whole explanation, and an inset view is optional and off by default. **A machine is now built this way by default**, from `node <skill>/scripts/new-machine.mjs <name> --dir <folder>`, following `references/figures.md`; the flat cutaway is for machines a section explains. Any real machine must reach their standard (`references/drawing.md`). `test/fixtures/gallery-ring/` and `test/fixtures/gallery-flow/` show the ring, marker, reservoir, source, gate and sequence parts on their own.

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
| Size | A **figure**: one system, 6–11 steps, 3–5 chapters. A **reference**: two systems compared, at most 12 steps. A **mechanism**: 5–8 steps. Narration of at most about 3 minutes in all; a short concept can be one minute. Larger: refuse and propose a split | Past 12 steps or about 3 minutes, readers lose the thread; two systems is the most a stage holds legibly |
| Depth | **The problem first**: the opening says what the idea must achieve and the number that makes it hard (a lock must refuse about 92,000 other keys; a naive scheme that breaks badly). **The second idea**: one step for what the field teaches right after the core (picking for a lock; for a concept, the standard fix for the core idea's weakness). **Hands-on**: on a Drawing page, a lab where the reader sets their own values and the model answers (`DATA.lab`, checked by `check-drawing`); on a Clay page, What if with inputs that cover the interesting cases, since Clay has no lab yet | In blind evals a plain agent beat the skill on depth both times by doing exactly these three; one core idea on prepared inputs taught less |
| Number of systems | One; two only when the point is a contrast run on the same inputs | Two lanes halve the size of everything |
| Input sequence | Chosen so every interesting case happens, each asserted in `model.test.ts` | A run without the eviction or loss explains nothing |
| Prediction | Exactly one, just before the causal decision | Predicting forces the reader to hold the rule |
| Focus | Automatic (what changed); set `teaching.focus` only when the cause is not what moved | The default is right for most steps and is checked |
| Parts | Kit parts; a new part in `src/parts/` when none fits; never raw boxes in a scene | Finish and checks come with the part |
| Colour | Neutral parts; a semantic tone only for an outcome class (hit, miss, lost, duplicate, stored), at most three meanings, each in the legend | Colour that means everything means nothing |
| Words | Title 8 words or fewer; one action of 12 words or fewer per step; part names of 1–3 words, in a row with leaders | Paragraphs get read instead of the figure |
| Flat maths | Only when the concept has equations or matrices; terms linked to solids | Maths on a tilted face is unreadable |
| Theme | Follow the reader's preference; review in light first, then dark | Both are checked |
| Stage | **By subject.** A real machine or physical system (escalator, engine, lock, gearbox, pump) is a **Drawing**: by default a rig figure of shaded solids (`references/figures.md`, scaffold `scripts/new-machine.mjs`), or a sharp 2D technical cutaway drawn to scale when a section shows the cause (`references/drawing.md`, `examples/escalator/`). An abstract concept with no physical figure (searches, caches, heaps, protocols, attention) is **`look: "drawing"`**: the kit's 3D parts drawn like the machines, in ink outlines on the cream stage, base plates hatched as sections, the drawings' palette and a title block. `"clay"` (soft matte solids) or `"paper"` (the textbook page) only when the reader asks. Leave `look` out only for a still SVG | Machines in Clay became rows of identical blobs that hid the mechanism, and read as unprofessional; a to-scale cutaway shows the cause and is trusted. The builder asked for concepts to match the machines, so every page now looks like a plate from one book |
| Learning | Always `practice(seed)`: a fresh question the model makes and marks. Add `whatIf` when one input changes the outcome (capacity, a fault, a size) | A reader who answers a new case has understood; a figure that only plays has not proved it |
| Voice | Write `voice()` for every figure. **Step 0 explains the concept in two or three spoken sentences before anything moves** ("An LRU cache is a small, fast store that keeps what you used most recently and throws away the one you haven't touched the longest..."). The figure's title is `title` alone (the concept's name, e.g. "LRU Cache") in the display face, with `about` as one line under it; the question lives in Details. The voice is on by default and the reader can mute it. While it is on, ▶ is the narrated tour and moves on only after each sentence, so speech is never cut by the next step. Never say letters or abbreviations aloud: say "the new key", not "A". Record with `scripts/voice.mjs` | A reader who does not know the idea needs it said before the demo; the title block tells them what they are looking at |
| Letters | Text on a top face is printed on it (a decal), never floated above it | Floating labels read as detached from the cube they name |
| Trust | `computed` for exact models, `model` for simplified ones, `sourced` only with an exact location | The badge must be true |
| Where files go | In the user's project: the scene in an explanations folder, the built page in its public or static folder, screenshots beside the scene (verify puts them there) | Keeps the skill folder clean |

## Correctness: what the page says is checked too

A model checks the picture; nothing checked the words, and that is where the skill lost round 5 of the evals. A derailleur page said the cage spring swings the cage forward (it pulls it back), a heading said 60° where its readout said 37°, and limit screws were never taught because no list of topics existed to miss them from. A plain model reasoning straight from physics got all three right. Every page now carries four checks, run by `src/claims/audit.mjs` at build time:

1. **Topics before pictures.** Before any drawing, find what a good reference teaches for the subject (a manual, a textbook, a reference page; search when you can) and write the list with its source: `coverage: { source, topics: [{ topic, where }] }`. Each core topic is a step (`"step:3"`), the lab, What if or Now you try, or `"deferred"` with a reason that Details also states. At least three in four core topics are taught. The topics decide the number of steps, within the Size row.
2. **No typed numbers.** Every number in the voice, headings, captions, cards and Details must exist in the model at the precision shown ("about" allows 5%). Write numbers from the model into the text; a number that is not a quantity of the subject (a test's step size) goes in `allow` with a reason.
3. **Claims.** Each cause-and-effect sentence (what pushes, what pulls, which way a part moves, why something happens) goes in `claims` word for word as the page says it, with a test against every variant's model. The audit fails if the sentence is not on the page or the model disagrees.
4. **A reviewer who did not build it.** `node <skill>/scripts/review-brief.mjs <name>.audit.json <dir>/review.json <page>` prints a brief; give it to a fresh agent (a subagent) or a person. It writes `review.json`, stamped with the text it read. Fix each finding (the edit makes the review stale, so review again) or answer it (`resolved: true` with a `response`). Your own review does not count: it is anchored on your reasoning.

**Show the working.** Put the mechanism's intermediate values on screen, not only its result: a Bloom filter shows word → hash → mod m → bit, not an arrow from word to bit. And keep one camera through a concept page; a view that jumps between steps loses the reader.

## Workflow

`<skill>` is this folder. Scenes can live in any project: the scripts take paths, and scene files import the kit from `<skill>/src`, which the scaffold sets up.


**For a real machine, follow `references/figures.md` and `references/drawing.md` instead of this list**, starting from `node <skill>/scripts/new-machine.mjs <name> --dir <folder>` and replacing its model first. The steps below are for concept scenes (`scene.ts`, `scripts/voice.mjs <dir>`, `verify.mjs`). A Drawing page keeps the same ideas: a tested model first, a draft early, one prediction, a voice, What if, a lab and Now you try. It uses its own files instead: `model.mjs` and `model.test.mjs`, a `build.mjs` that hands the drawing and the machine's hooks to the shared page and player in `src/drawing/`, a `voice.mjs`, and `scripts/check-drawing.mjs`. Start by copying `examples/lock/`, the smaller of the two. It ships as a standalone page only, with no SVG or React export yet. Pass the correctness audit to `drawingPage({ audit })`; `check-drawing` fails until it is clean. Before delivering a machine, all of these must hold:
- `check-drawing` passes, with its camera checks;
- the machine's tests pass, including its contact directions (`checkContacts`, asserting how many it checked);
- `node <skill>/scripts/check-arithmetic.mjs <page>` passes;
- fresh shots from `node <skill>/scripts/shoot-steps.mjs <page>` have been looked at, every one (`--check-fresh` passes).

Deliver with the same report, with `check-drawing: passed` and `audit: clean (<n> claims, <m> topics, review current)` in place of `verify: passed`, and add a line: `contacts: <n> checked; arithmetic: <n> equations; shots: <n>, <first> to <last>, looked at`.

1. **Write the model** (`model.ts`): pure functions returning the state after every event. Test it against a separately written reference implementation and edge cases (`model.test.ts`). Choose the input sequence so the interesting cases happen: a hit, a full-cache miss, a lost message, a divergence.
2. **Scaffold the scene**: `node <skill>/scripts/new-scene.mjs <name> --dir <folder>` writes a model, a test and an editorial scene that build and verify as generated, except for the audit, which needs your topics, claims and review. Replace the model first, then the view. Write the topic list (Correctness, 1) before the view.
3. **Assemble the view from parts.** Use `src/parts/`. Every mark's `key` is a model entity id: keys carry identity across steps, so motion, linking and checks follow them. Position things with the parts' anchors, not by eye.
4. **Teach in beats** (`teaching`). Use 3–5 chapters and one short action per step (12 words at most). Add one prediction just before the causal moment, such as "D is next. Which key leaves?". The longer caption, assumptions and transcript go in the Details drawer automatically.
5. **Declare observations** (`observe`): every value shown, every order that matters, every size that encodes a number (`extent`), what must be visible and what must be gone, semantic tones, and what is lit.
   **Working draft early:** after the model and a rough view, build and open the page before any polish. A wrong representation is cheap to change now and expensive later.
6. **Build, verify and look.** Run `node <skill>/scripts/build.mjs <dir> --out <folder>` and then `node <skill>/scripts/verify.mjs <dir>`, and fix until it prints `passed`. Screenshots go to `<parent of dir>/shots/<name>/`. Then open the screenshots and the two contact sheets in `shots/` and look at them, at 1× and at 4× (`node <skill>/scripts/shoot.mjs <page> --step k --select .vz-stage --scale 4 --out close.png`). A passing verify proves correctness and mechanical tidiness, not beauty.
7. **Deliver** with this report, and nothing vaguer:

   ```text
   Built <title>: <n> steps in <chapters> chapters, from <parts>. Model tested against <reference>.
   verify: passed (<n> observations; depth, focus, labels, layout, both themes; audit clean: <n> claims, <m> topics, review current). Files: <page>, <scene dir>.
   Open: <page>#step=<the key step>. Not verified by machine: <whatever you judged only by eye>.
   ```
8. **Teach back and narrate.** Add `practice(seed)` from the model (the answer must be computed, never typed), `whatIf` versions built by the same scene factory, and `voice()`. Record the voice: `node <skill>/scripts/voice.mjs <dir>` (a local open-source voice; one model download, then offline). Rebuild; the page now has Listen, What if and Now you try, and verify checks every version and 40 practice questions.
9. **Export** if needed: `node <skill>/scripts/export-svg.mjs <built page> --step k --out f.svg --frame` (checked against the live stage; `--frame` adds the title, the step's action and the legend, so an image in a post reads on its own; leave it off only when the host page supplies them), or `<Figure scene={…} />` from `<skill>/src/react/Figure.tsx` (see `references/authoring.md`).

## Parts

| Part | Module | Use it for | Anchors |
|---|---|---|---|
| `railAssembly` and `cartridge` | `src/parts/rail.ts` | Ordered slots in a line with entries that slide, hop and leave: caches, queues, arrays (up to 16), priority orders. `slotLabel` names slots; given names are never dropped; `ports` gives a cable per slot | `slot(i)`, `front(i)`, `port(i)`, `anchor.first`, `anchor.last` |
| `ringAssembly` and `puck` | `src/parts/flow.ts` | Slots round a circle: circular buffers, hash rings, round robin, clock replacement | `slot(i)`, `outside(i)`, `side(i)`, `anchor.centre` |
| `treeAssembly` | `src/parts/tree.ts` | A complete binary tree in array order: heaps, tournament trees, segment trees. Pair with a rail for the array | `slot(i)`, `edge(i)`, `depth(i)`, `anchor.root` |
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

- **One constrained style per look.** In concept scenes, use the fixed camera, the shared tones and the look's shading; the drawing look gives them the machines' ink, hatching and palette. In a machine Drawing, use ink lines, hatched sections, at most three path colours plus one followed part, and the title block (`references/drawing.md`). Colour carries meaning (hit, miss, lost, duplicate, stored), one meaning per tone, stated in the legend.
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
| `node scripts/check-drawing.mjs <page>` | `drawing: passed` (for a Drawing page) |
| `node scripts/check-arithmetic.mjs <page>` | `arithmetic: passed (<n> equations)` (for a Drawing page) |
| `node scripts/shoot-steps.mjs <page> --check-fresh` | `shots: all <n> newer than the page`, after looking at them |

Then read the PNGs. Fix in the kit, not the scene, when a problem would recur elsewhere. `references/verify.md` explains every failure line and its usual fix.

## References

- `references/authoring.md`: the scene contract (model, trace, view, teaching, observe, panels), editorial layout, predictions, copy budgets, embedding in React, and SVG export.
- `references/kit.md`: marks, surface details, motion vocabulary, label rules, every part's options and anchors, components and maths.
- `references/craft.md`: the visual rules, each with the defect that taught it.
- `references/figures.md`: the recipe for a machine figure on the rig: when, the look, draw once and move, the camera, insets, and every failure with its check.
- `references/drawing.md`: the Drawing look for real machines: what every page has, the page contract, the check and the length rule.
- `references/verify.md`: every check, what its failures mean, how to fix them, and what the checks cannot see.
- `evals/evals.json`: held-out prompts for testing the skill on unfamiliar concepts.
