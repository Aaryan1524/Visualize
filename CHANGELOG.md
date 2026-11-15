# Changelog

One version covers the kit and the skill (`package.json` `version` and `SKILL.md` `metadata.version` move together). Each entry names the failure that caused it, so the reason for a rule is never lost.

## Unreleased

What a machine needs. The escalator built in Clay came out as about forty identical soft wheels in front of two thin track lines, with a floor shadow that meant nothing. The builder called it unprofessional. Drawn as a to-scale side cutaway, the same mechanism read at a glance.

- **Two looks, chosen by subject.** Real machines and physical systems are drawn as technical cutaways (`references/drawing.md`). Abstract concepts stay in Clay.
- **`examples/escalator` is the standard for mechanisms.** It is drawn to scale from a model whose tests check that the treads stay level, that no parts collide and that every wheel stays on its rail, for both a 30° and a 35° incline. It has a voice with parts lit as they are named, a prediction before the landing, What if and Now you try.
- **The timeline runs once, start to end.** The escalator's first bar showed the machine's 42 s loop, so it swept twice during a 98 s explanation and matched nothing on screen. Now each step is as long as its narration, and play stops at the prediction and at the end.
- **`scripts/check-drawing.mjs`** checks a Drawing page at 1440×900 and 1280×800:
  - the page contract and an embedded voice;
  - no page scroll, and the right step for each tab;
  - a forward-only timeline that stops at the end;
  - callouts at 11 px or larger that stay inside the stage and don't overlap;
  - no console errors.

  It fails on the old looping bar. It runs in CI as `pnpm check:drawing`, and `pnpm test` now runs `examples/**/*.test.mjs`.
- **Length.** A mechanism takes 5–8 steps. Every page keeps its narration to about 1.5–3 minutes, or splits the subject.
- **The voice is compressed again.** `scripts/voice.mjs` asked for 96 kb/s AAC, which afconvert rejects for 24 kHz mono, so every clip silently fell back to WAV. It now asks for 64 kb/s. Pages recorded before this need re-recording to shrink.
- **Codex and Antigravity.** Install paths, a Chrome hint for sandboxed agents, and a compatibility line. These were written for the README change but never reached main.

## 1.0.0

First release, desktop first.

- **The flagship is `examples/lru-3d`:** LRU Cache in Clay, with the voice tour, a prediction and Now you try.
- **The title is the concept's name**, set in Playfair Display SC (bundled, OFL), with one line under it; the question moves to Details.
- **The voice explains the concept first.** The first Next or ▶ waits for it, and it is also written on the opening step.
- **▶ is the narrated tour while the voice is on**, moving on only after each sentence. Timed autoplay had cut sentences as the next part came in.
- **Each step is recorded in one pass** with silence at both ends; the first version stitched sentences together and cut words. Keys are named in context ("key A").
- **Lettering is printed on the parts**, not floated above them.
- Clay is the one default look.

## 0.5.0

What a drawing cannot do. The builder found the isometric look too close to Anatomy and "boring", and asked for an edge a one-line prompt to a plain agent cannot match, with the goal that the reader understands.

- **The Unfold stage.** `look: "paper" | "clay"` draws the same marks in real 3D. The camera opens on the plan view (the flat diagram readers know), moves to each step's focus and ends flat; labels are HTML, crisp and upright. Paper outlines each part in ink by its own silhouette; clay is soft matte with shadows. Glass was tried and rejected.
- **Voice.** `voice()` scripts are recorded by a local open-source voice (Kokoro, offline after one download). Listen plays each clip after the move settles, lights each part as it is named, pauses at a prediction, and adds quiet cues. The browser's own speech was rejected as robotic.
- **What if?** Versions of the figure on other inputs, each a full scene from the same model, switched in place and verified like the first.
- **Now you try.** Questions the model makes and marks, with a score.
- **Checks for 3D pages.** Observations from projected bounds, ray-cast occlusion and HTML labels; framing by coverage (span was fooled by one stray part); label overlap and cut-off; determinism after random seeks. Three planted faults are caught.

## 0.4.0

The shape the field draws. Ten eval sessions on 0.3 (five prompts, with and without the skill) found that the skill won on finish and proof every time but taught worse in four of five: the kit's parts chose the picture.

- **Start from what the field draws.** Four subjects came out as a straight rail of slots. `SKILL.md` now asks for one line naming the textbook shape before any part is chosen, and the decision table adds pointers and time.
- **New parts** (`src/parts/flow.ts`): a ring of slots with pucks; markers that stand at their slot and hop to the next; a reservoir with a capacity post and countable items; a source with its rate; a gate that passes or turns away. Each has part tests and a gallery fixture that runs with the examples in verify.
- **A sequence-diagram panel.** A protocol figure lost its time axis. `sequence()` draws lanes with time running down, lit at `now`, with lost messages crossed.
- **Identity is drawn.** Connection names were dropped as optional labels. Names a scene gives slots are now never dropped, a toned cable shows that it is in use, and a pointer stands straight below its slot on screen (a lane in front read as the previous slot).
- **The caption no longer covers the drawing.** All five eval scenes were rearranged by hand to dodge the heading and prediction card. The camera fit now reserves their largest footprint; `caption clear` checks it, and depth names the overlay instead of a `null` painter.
- **Chip text cut off on phones** ("429", "timeout") now fails layout, and chips wrap instead.
- **Round parts are sorted by their footprints.** A marker beside a plinth sat inside the plinth's bounding square and was reported as intersecting it.
- **Fixes the eval runs found in the kit:** terminal pins on the base, labels too tall for their face, a crash in the surface check, and rails limited to 12 slots.
- **A blog image reads on its own.** `export-svg --frame` adds the title, the step's action and the legend around the checked drawing, and exports leave out inherited styles (a 1.7 MB file is now about a third the size per shape).
- **Focus on what remains.** A step that only rules things out focused the discarded cells; muted marks no longer count as the change.
- **The eval rubric scores the reader first.** The old rubric only checked that the skill was followed.

## 0.3.0

The look and the decisions.

- **Focus.** "Too much remains equally prominent throughout." Each editorial step now focuses what changed since the last one and lets everything else recede toward the stage. Emphasis is interpolated, so seeking stays exact. Checked by `focus`, with two planted faults.
- **The causal moment stays visible.** "The reply is lost." showed a fully dimmed scene: the loss happened mid-transition and left no trace at rest. The lost reply now lies on the wire for its step. If nothing focused is still drawn at rest, nothing recedes.
- **A decision table in `SKILL.md`.** Lint: "SKILL.md never states a default." Every choice a one-line prompt leaves open now has a default and a reason. Three are marked as the user's to make.
- **Scope tiers, a draft gate and a delivery report.** Agents jumped to polishing before the representation was right, and reported in their own shapes.
- **Reproducible builds and CI.** The step-5 gate was never checked. `pnpm check:reproducible` requires byte-identical rebuilds, and `.github/workflows/ci.yml` runs every gate.
- **A revisited step serialised differently from a fresh one.** An emptied `style` attribute was left behind by the emphasis variable. It is now removed, and reduced motion caught it.

## 0.2.0

Second reference, finished parts, outputs and packaging.

- **Network parts:** terminal, server, ledger, key store, plate, cable and message, each with named anchors. Retries was built from boxes that "said nothing about what each one was".
- **Turned cylinders, side-face panels, vents, seams and lamps,** for "large plain block faces" and "limited material depth".
- **Label rules:**
  - Unfit labels are hidden, after screen text spilled off a phone-sized terminal.
  - Optional labels drop, after slot numbers landed on a guide rail.
  - Leaders leave from the text's edge, after they crossed their own labels.
  - Chips keep one height, after a 6 px strip made the camera history-dependent.
- **Checks:**
  - A free label lying on a part, after "Idempotency key" sat across the terminal.
  - Stage size changing between steps.
  - A hidden value failing `text`, after gauges showed no numbers while verify passed.
  - Cable ends on parts.
  - Part tests found floating coins and an anchor in mid-air.
- **Outputs:** SVG export checked against the live stage, a React adapter, and scoped embedding with `destroy()`.
- **Packaging:** `SKILL.md`, `references/`, `evals/` and the `new-scene` scaffold. A clean npm install and a separate project were both tested.

## 0.1.0

The prototype: trace, keyed marks, a pure timeline, the isometric stage, the player, verify with planted faults, and the LRU, attention and retries examples. `research/PROTOTYPE_FINDINGS.md` records what it showed.
