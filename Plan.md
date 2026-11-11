# Plan: visual explanation engine — research, three prototypes, one thin core

## Context

The goal is an open-source engine, plus an installable Agent Skill, that lets a coding agent produce accurate, animated, interactive explanations from a one-line request. This plan starts with research and the smallest prototypes that settle the main architectural question, not with a large framework.

Starting conditions:

- **Environment:** Node 26, pnpm 11, Google Chrome. No ffmpeg, so video export is out of scope for now. Node runs TypeScript directly (type stripping), so tests need no test framework.
- **Reference project:** Anatomy (MIT), an Agent Skill for interactive isometric SVG figures. Its `SKILL.md`, kit reference, motion, verification and craft guides and its evals were reviewed.
- **Agent Skills spec:** `name` must match the directory, description is at most 1024 characters, `SKILL.md` under 500 lines, references one level deep, validated with `skills-ref validate`.
- **Prior art for the paper use case:** several Manim-based skills already turn a paper into a video (for example `vumichien/manim-skill`, the Hermes `manim-video` skill). They produce rendered video, not an interactive, checkable artifact. Their quality and licences are not yet verified.

## A. What we are building, and what we are not

An engine where the author (a person or an agent) writes two small things: an executable model of the idea, and a view that maps model state to drawn marks. The engine owns everything else: motion, playback, scrubbing, controls, accessibility, export, and checking that the picture agrees with the model.

It is not a paper summarizer, a chart template set, a Manim wrapper, a 3D renderer or an Anatomy clone. The skill is a thin guide on top of the library; the library must work without it.

## B. Anatomy: what to learn, where it stops

Strongest ideas, all worth keeping in spirit:

1. **One model drives motion, readout and caption.** Nothing on screen is typed by hand.
2. **Verification is part of the kit.** Shapes are recorded as they are drawn, and an audit proves depth order, clearance and line ends; scripted Chrome sessions produce close-ups and slow-motion contact sheets. Each check has a planted-fault control.
3. **A small vocabulary with strong craft rules** written as "what got rejected and why", plus complete examples to copy from.
4. **A representation ladder** (real thing, then the concept's own parts, then analogy with a mapping table) that stops the author defaulting to metaphor.

Limits for our goal:

- One representation only: a physical object in isometric view. Equations, matrices, timelines of messages and proofs have no natural form there.
- Its audit proves the drawing is physically coherent, not that it says what the model says. Nothing checks a displayed number against the model.
- Time is a live loop with springs, not a seekable timeline. There is no step, rewind or "state at step 7".
- Each figure is 300–900 lines of bespoke build and live code, and takes one to many hours.
- No notion of sources, evidence or trust levels.

## C. Engine concepts and ranking

`research/ENGINE_CONCEPTS.md` covers 20 concepts (the 15 starting hypotheses plus five new ones) against ten criteria. The five additions:

- **Witness marks:** every drawn mark carries the id of the model entity it shows, so a checker can read the page and compare it with the model at every step.
- **Counterfactual twin worlds:** the same deterministic simulation run twice with one premise changed, played in sync, with the point of divergence marked.
- **Trust-typed ink:** the five trust levels (sourced, computed, simplified model, analogy, unverified) are a required field on every claim and get a distinct visual treatment.
- **Lens stack:** one model state shown through linked representations (equation, grid, geometry), with one entity highlighted across all of them.
- **Observations as tests:** each scene declares what the viewer should be able to see ("after step 4, B is at the cold end"), and the checker asserts it on the rendered page.

Selected for prototypes, because each proposes a different source of truth:

| # | Approach | Source of truth | Would be falsified if |
|---|---|---|---|
| 1 | Temporal world + semantic motion | A trace of typed events with a state snapshot after each | Motion derived from state diffs looks mechanical, or views need hand-written tweens |
| 2 | Living mathematics + lens stack | A graph of computed values; equation terms and matrix cells are the same entities | Term-level identity in rendered math is too fragile, or the trace model cannot express it |
| 3 | Causal simulation + twin worlds | A discrete-event simulation with explicit cause links | Two synced worlds do not fit a phone-width layout legibly |

Adopted across all three: witness marks, trust-typed ink, observations as tests.

Deferred: true rotatable 3D and exploded views (high cost, blurry text, hard to check), constraint-solved layout (fragile for generated code), figure reconstruction (needs the paper adapter first), a multi-renderer orchestrator (nothing to orchestrate yet).

## D. Architecture position

Working hypothesis, which the prototypes test: **all three approaches reduce to one substrate.**

- **Model:** a pure TypeScript function returning `Step[]`, where a step is `{ event, state, note, trust }`.
- **View:** a pure function from `(state, event)` to a flat list of keyed marks. A key is the model entity's id.
- **Engine:** `frameAt(t)` is pure. It maps time to a step and a progress value, matches marks by key between adjacent steps, and interpolates. The event type picks the choreography from a small motion vocabulary (move, enter, exit, travel, emphasize, fail). Scrubbing, rewind, determinism and reduced motion follow from purity, with no stateful tweens.
- **Renderer:** SVG and HTML. A mark lives in one of two spaces: the isometric stage (world coordinates, projected at a fixed angle) or a flat panel. KaTeX renders math in flat panels. No Canvas, WebGL or true 3D until an example needs it.

### Visual direction (decided)

- **Isometric is the main look.** The figure is built from solid objects drawn at a fixed angle, in SVG.
- **Math stays flat.** Equations, matrices and number grids sit in flat panels beside the stage and are linked to it: selecting a cell or term highlights the matching object, and the reverse.
- **Kept minimal for the first build:** solids are boxes, slabs and cylinders only, with simple face shading. Objects are sorted back to front every frame, because moving objects change which one is in front.
- **Risk: looking like an Anatomy clone.** Our identity has to come from what Anatomy does not have: the stepped timeline, the linked flat math panels, trust labels, and our own colour and line treatment. No Anatomy code is reused. Screenshots are compared against Anatomy's examples during review.

Two deliberate departures from the original brief:

- **`ExplanationIR` as a large typed schema is premature.** Code is more reliable to write than big JSON documents, and the executable model is already the truth. Instead: a small manifest (scenes, learning objective, claims with trust level and source) alongside models written as code.
- **Three separate engines would waste effort.** Three prototypes are built on one deliberately tiny shared substrate, and every place a prototype has to bypass it is recorded as a finding.

## E. The three experiments

Each uses a different visual representation:

1. **LRU cache (first).** Isometric: entries are solid blocks on a recency rail that slide to reorder, drop in on a miss and fall off the cold end on eviction. Model checked against a reference implementation and an edge-case sequence. Also built flat from the same model, so the two looks can be compared side by side.
2. **Scaled dot-product attention.** Isometric stage: three token blocks with their query, key and value vectors as bars whose heights are the real numbers, and attention weights as links of matching thickness. Flat panels: the equation, the Q·Kᵀ grid, softmax rows, the weighted sum. Selecting a grid cell lights its terms in the equation and its two tokens on the stage. Checks: shapes, rows sum to 1, output equals a direct recomputation.
3. **Payment retries.** Isometric stage: client, server and ledger as solid objects, with messages as blocks travelling between them, run as two synced worlds from one fault schedule: without and with an idempotency key. A flat event timeline sits under each world. Check: charges applied are 2 and 1.

LRU goes first because it is the smallest case that exercises identity, derived motion, stepping, depth ordering and the page-versus-model check end to end.

## F. First vertical slice

The shared core plus the three examples, each built to one standalone HTML file, with a `verify` command that passes. That is the smallest thing that demonstrates the unique claim: the picture is checked against the model, at every step, automatically.

## G. Build steps, in order

Each step lands on its own branch and merges into `main` once its checks pass.

1. **Scaffold** a single pnpm package (no workspace yet): `typescript`, `esbuild`, `katex`, `puppeteer-core` driving the installed Chrome. Tests with `node --test`.
2. **Core** in `src/core/` (trace, marks, timeline, interpolation, trust levels).
3. **Isometric stage** in `src/iso/` (projection, box, slab and cylinder solids with face shading, per-frame depth sort).
4. **Player and build** in `src/render/` (keyed SVG reconciler, flat panels, math, stage-to-panel linking, player with keyboard control, reduced motion, linkable steps) and `scripts/build.mjs`, which bundles an example into one HTML file.
5. **Verification:** `scripts/verify.mjs` steps through a built page in headless Chrome and reports:
   - visible page values equal model values at every step;
   - identical DOM after random seeks;
   - text overlap, clipping, minimum font size, contrast;
   - where two solids overlap on screen, the nearer one is drawn on top, at every step and mid-move, checked against true geometry rather than the sort key;
   - declared observations hold;
   - no console errors;
   - screenshots at desktop and 390 px in both themes, plus a contact sheet.
6. **Examples** in `examples/lru/`, then `attention/`, then `retries/`, each as `model.ts`, `model.test.ts`, `scene.ts`.
7. **Review every screenshot,** record defects, fix them in the core where possible, re-render.
8. **Research docs:** `research/ANATOMY_ANALYSIS.md`, `LANDSCAPE.md` (at least 12 tools, every claim sourced or marked unverified), `ENGINE_CONCEPTS.md`, `VISUAL_GRAMMAR.md`, and `PROTOTYPE_FINDINGS.md` (what was shared, what each example had to bypass, lines of example code versus core, and whether the hypothesis in section D held).

Not in this pass: `ARCHITECTURE.md`, `API_DESIGN.md`, `VISUAL_CRAFT.md`, `ROADMAP.md`, the skill package, benchmarks, gradient descent and the paper adapter. Those depend on what the prototypes show. The fine points of the visual identity (colours, line weights, shading) are settled from screenshots, within the direction in section D.

## Verification

- `pnpm test`: model tests, including the reference comparison for LRU, the numeric invariants for attention and the charge counts for retries.
- `pnpm typecheck`.
- `pnpm build`: three standalone HTML files in `dist/`, openable from disk with no server.
- `pnpm verify`: exits non-zero on any failed check. Each check has a planted-fault control (for example a view that shows a wrong number) that proves the check can fail.
- Every screenshot is reviewed by eye, and the report says what passed, what failed and what could only be judged visually.
