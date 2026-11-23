---
name: visualize
description: Build step-through visual explanations whose picture is checked against an executable model, with a narrating voice, a prediction, a hands-on lab and practice questions. Everyday physical objects (a perfume bottle, a watch, a coffee maker, a battery, a syringe), precision machines (an escalator, an engine, a lock, a derailleur) and abstract concepts (a Bloom filter, a hash table, a cache, a protocol) are all drawn as bold shaded 3D solids on one rig, showing the real recognizable object or canonical diagram with a camera that frames each step's subject. Use whenever someone wants an everyday object, physical phenomenon, machine or device, algorithm, data structure, protocol, distributed-system behaviour, ML mechanism or paper method explained visually, animated or step by step, even if they never say "visualize". Outputs a standalone HTML page, checked in headless Chrome.
license: MIT
compatibility: Works in Claude Code, Codex and Antigravity. Needs Node.js 24+ (runs TypeScript directly) and Google Chrome or Chromium for the checks. Run `npm install` (or `pnpm install`) once in this folder.
metadata:
  version: "1.2.0"
---

# Visualize

A figure here is a model you can watch. You write a small executable model of the idea, a figure of solid parts that the model's states move, and the words a reader sees and hears. The page shows the model's numbers, the audit checks the words against the model, and the checks drive the built page in Chrome to prove it frames, plays and reads as intended.

## One route, 3 visual lanes (show the real thing first!)

**Every new page — everyday object, machine, or abstract concept — is a Drawing page on the rig.** The model, the figure, the story and the hooks go to `drawingPage()` (`src/drawing/page.mjs`), which gives every page the same player, camera, voice, prediction, What if, lab, Now you try and title block, and the same checks. Pick the visual lane that matches the subject:

1. **`--kind object` — Everyday Physical Object + Side Explainer** (`src/rig/objects.ts`, `references/objects.md`): **DEFAULT whenever the prompt names a real physical object or phenomenon** (perfume bottle, watch, coffee maker, battery, syringe, wing, lungs, microwave). Draw the **actual recognizable 3D object** front-and-center with a cutaway showing how it works inside, paired with a crisp plain-English `explainerCard` / `meterBar` beside it. **NEVER** draw abstract boxes with numbers for a physical object.
2. **`--kind machine` — Precision Mechanical Cutaway** (`src/rig/mech.ts`, `references/figures.md`): meshed gears, linkages, exploded calibres, differentials, derailleurs — use for intricate drivetrains/clockwork or when `--technical` / `--deep` asks for full mechanical engineering detail.
3. **`--kind concept` — Canonical Abstract Diagram** (`src/rig/parts.ts`, `src/rig/concept.ts`, `references/figures.md`): algorithms, data structures, protocols, distributed systems, and ML mechanisms, drawn in the shape the field already draws.

Start from the scaffold, which builds and passes `check-drawing` as generated (all but the independent review):

```sh
node <skill>/scripts/new-figure.mjs <name> --kind object  --mode everyday|fast|technical|deep --dir <folder>
node <skill>/scripts/new-figure.mjs <name> --kind machine --mode everyday|fast|technical|deep --dir <folder>
node <skill>/scripts/new-figure.mjs <name> --kind concept --mode everyday|fast|technical|deep --dir <folder>
```

Open the closest example before starting:
- `examples/perfume-atomizer/`: everyday physical object page on `src/rig/objects.ts` (`vesselShell`, `liquidColumn`, `dipTube`, `plungerNozzle`, `sprayCone`, `explainerCard`, `meterBar`) in plain college-level English.
- `examples/bloom/`: concept page on `src/rig/parts.ts`. Sixteen bit cells in two rows, a word card, one arrow a hash function, the camera on each word's bits, a lab where the reader types any word, and the deletion trap.
- `examples/derailleur/`: machine page on `src/rig/`. Bold shaded solids, each drawn once and then moved, so it reads as 3D and plays at 60 fps.
- `examples/automatic-watch/`: 14-step `--deep` exploded horological calibre built on `src/rig/mech.ts` (`explodedStack` and `centreLines`).
- `examples/differential/`: open differential built from `src/rig/mech.ts` (meshed gears, cutaway housing, and turning shafts).
- `examples/multi-agent/`: 3-tier Concept Plate (`src/rig/concept.ts`) with per-step camera shots and a synchronized trace lens.
- `examples/lock/` and `examples/escalator/`: machines that work in one plane, drawn as flat technical cutaways to scale (`references/drawing.md`) on the same page and player.

**Legacy, not for new pages:** `examples/lru/`, `retries/`, `attention/`, `lru-3d/` and `test/fixtures/gallery-*` are scene.ts pages on the older Unfold stage, checked by `scripts/verify.mjs`. They still build. Their references (`authoring.md`, `kit.md`, `verify.md`) are marked legacy, and the Drawing checks refuse their pages with a message saying so.

## 4 Composable Modes

Choose the mode from explicit flags or natural-language cues in the user's request. **Flags compose** — e.g. `--deep --technical` produces a full multi-chapter engineering masterclass, and `--fast --technical` builds a quick equation-focused diagram.

| Mode | Trigger flags / phrases | Scope & Visuals | Voice & Interactivity | Checks & Review |
|---|---|---|---|---|
| **`everyday`** *(default)* | *(no flag)* | Best **real-object** studio visual + side `explainerCard`/`meterBar`, **5–7 steps**. Real tested model underneath; intuitive, college-level plain English (no unrequested `N·mm`, `isochronism`, or raw academic formulas). | **Voice ON** by default. 1 core variant (What-if optional), Predict pause, interactive Lab, Now you try. | Full `check-drawing`, `check-arithmetic`, light/dark `shoot-steps`, `review-brief.mjs --mode everyday`. |
| **`--fast`** | `--fast`, *"quick"*, *"fast"*, *"brief"* | Quick less-detailed visual diagram (~3–4 min build), **4–5 steps**, core cause-and-effect cleanly shown. | **No voice** (`--no-voice`), no What-if variants, compact Lab + Predict. | `check-drawing.mjs --fast`, `shoot-steps.mjs --fast`, `review-brief.mjs --mode fast`. |
| **`--technical`** | `--technical`, *"technical"*, *"engineering"*, *"exact math"*, *"with equations"* | Concept & engineering rigor: exact SI units, equations and `workingStrip`s on stage, `--kind machine` for intricate mechanisms. | **Voice ON** (unless `--fast`), multi-variant What-if comparing real parameter regimes, Predict + Lab. | Full checks + strict `review-brief.mjs --mode technical` domain/unit audit. |
| **`--deep`** | `--deep`, *"in depth"*, *"deep dive"*, *"lengthy"*, *"thoroughly"* | **4–6 chapters, 14–20 steps**, highest visual detail (exploded assemblies, failure modes, trade-offs, variants, edge cases). | **Full voice**, per-chapter Predict checkpoints (`DATA.predict` list), multi-variant What-if, saved "Resume at step k". | Full checks on every step + `review-brief.mjs --mode deep` (prefer 2-agent parallel review). |

## The one idea that matters

**The model is the truth, and the page is checked against it.** Never type a number, an order or an outcome into the figure or the words. Compute it in the model, pose the figure from it, and write the words from it. The audit fails a number the model does not have. Even in `everyday` mode where the prose stays jargon-free, a real tested `model.mjs` drives every level, pressure, motion, and readout underneath.

**One causal moment per step, and the camera goes to it.** Each step has a shot: the parts it is about, framed and lit, while the rest recedes in tone. Make the change itself visible at rest: a plunger pressed down with mist firing out, a bit that turns to 1, a key that walks on past a taken slot, a pulley ahead of its chain. A step where nothing visible changes teaches nothing.

## Choose the representation

**Show the real thing first, or what the field already draws.** Write one line in your plan:
- For physical objects/phenomena (`--kind object`): *"The real object is <recognizable 3D object> cut open to show <internal cause>, beside an explainer card."*
- For mechanical assemblies (`--kind machine`): *"A precision cutaway draws <machine> as <meshed/exploded parts>."*
- For abstract concepts (`--kind concept`): *"A textbook draws <concept> as <shape>."*

Build *that shape* from the rig's parts, and say why if you depart from it. Never substitute abstract numbered boxes for a real physical object, and never force every abstract concept into a straight rail of slots.

The parts (`src/rig/`):
- **Everyday objects (`src/rig/objects.ts`, `references/objects.md`):** `OBJECT_VIEW`, `vesselShell`, `liquidColumn`, `dipTube`, `plungerNozzle`, `sprayCone`, `watchCaseDial`, `watchHand`, `coiledSpring`, `explainerCard`, `meterBar`, plus studio materials `glass`, `liquid`, `mist`, `rubber`, `wood`.
- **Precision machines (`src/rig/mech.ts`, `references/figures.md`):** `spokedWheel`, `pinion`, `arbor`, `meshCentres`, `assertMeshed`, `bridge`, `jewelSetting`, `screw`, `cutawayShell`, `explodedStack`, `centreLines`, low-level meshes (`plate`, `turned`, `rod`, `sprocket`, `roundedHull`), `turningPart()`, `moveInPlane`, `checkContacts`.
- **Abstract concepts (`src/rig/parts.ts`, `src/rig/concept.ts`, `references/figures.md`, `references/concept-rig.md`):** `cellDrawing`, `railCentres`, `cardDrawing`, `ringSlots`, `turnAt`, `markerDrawing`, `arrow`, `workingStrip`, `boardDrawing`, plus Concept Plate instruments (`deckTier`, `hubChassis`, `agentBlade`, `waferStack`, `portValve`, `vaultCore`).

One part per real element, counted true. Draw the cause, not only the states. A part the subject needs and the rig lacks is a kit gap: build it in `src/rig/`, drawn once and moved, and record it.

**Show the working, on stage.** In `everyday` mode, pair the cutaway object with a clean plain-English `explainerCard` and `meterBar` beside it so the reader sees *why* without equations cluttering the scene. In `--technical` and concept pages, put the intermediate values where the reader is looking in a `workingStrip` beside the subject (`h1  2,668,802,083 mod 16 = 3`) and each value on its part.

## Decisions this skill makes

A one-line prompt leaves these open. Decide them like this without asking. Ask only about the three marked **ask**, and only when the prompt and files don't answer them.

| Decision | Default | Why |
|---|---|---|
| **The scenario** (concept, sizes, values) **ask** if they change the answer | Small readable values (16 bits, 8 slots, 3 keys, or realistic everyday dimensions), chosen so every interesting case happens, each asserted in `model.test.mjs`; stated in Details | Small readable values stay legible on stage; a run without the key phenomenon explains nothing |
| **Output** **ask** if unclear | A standalone HTML page. Drawing pages have no SVG or React export yet; say so if one is asked for | Every output is checked |
| **What to contrast with** **ask** when "versus what?" is ambiguous | The naive alternative or failure case (as a step or What if) | A contrast makes the mechanism visible |
| Visual lane | `--kind object` for real physical objects/phenomena; `--kind machine` for intricate/technical mechanisms; `--kind concept` for abstract systems | Readers recognize a real bottle or watch instantly; abstract boxes hide the physical intuition |
| Mode & tone | **`everyday`** (plain college-level English, real model underneath, voice ON, 5–7 steps). Switch to `--fast`, `--technical`, or `--deep` (or combine them) when flags or wording ask for it | Everyday learners get an intuitive studio visual; engineers get exact SI math on request |
| Depth | **The problem first:** step 0 (no tab) says what the idea achieves and why it is interesting, before anything moves (`"step:0"`). **The second idea:** one step for what fails or comes next (priming/clogging, picking, deletion trap). **Hands-on:** every page has a live `DATA.lab` | Opening with the problem and closing with a live lab makes the mechanism stick |
| Number of systems | One; a contrast goes in What if (optional in `everyday`, omitted in `--fast`, standard in `--technical`/`--deep`) or in one step | Two figures halve the size of everything |
| Prediction | One on `PRED_STEP` (step before the causal moment); in `--deep`, one per chapter (`DATA.predict` list) | Predicting forces the reader to hold the rule; asked on the step itself, the heading gives it away |
| Camera | A `shot` per step: the parts it is about, centred, lit, at most 2×; every part the heading names stays in frame (`subject`). Pick the angle from the object's shape (`OBJECT_VIEW` for everyday objects, exploded stack for flat layered machines); once chosen, zoom and pan without turning | The reader keeps their bearings while each step is framed |
| Colour | Neutral or authentic real-object materials (`glass`, `liquid`, `brass`, `steel`); one followed part or tone in `subject` orange; at most three semantic meanings in the legend | Colour that means everything means nothing |
| Words | Title of 1–4 words with `about` as one line under it; one heading a step; callouts of 1–3 words. Plain English in `everyday`; exact SI units/formulas in `--technical` | Paragraphs get read instead of the figure |
| Voice | **ON by default** (`everyday`, `--technical`, `--deep`): write `script(M)` in `story.mjs`, `[phrase|part]` lights parts in sync, record with `voice.mjs`. **OFF in `--fast`** (`--no-voice`) | Hearing the explanation while watching the cutaway teaches twice as fast; `--fast` skips recording time |
| Letters | Text on a face is printed on it (a decal) or set in an upright `explainerCard`/`workingStrip`, never floated loosely in space | Floating labels read as detached from what they name |
| Theme | Light on every system by default; reader switches with Dark button or `#theme=dark`. Both themes are checked | A value that reads in one theme can vanish in the other |
| Where files go | In the user's project: page folder (model, figure, story, build, voice, tests), built page in its public folder, shots beside the folder | Keeps the skill folder clean |

## Deep explanations (`--deep`)

Off by default. Turn it on when the request says `--deep` or asks in words for depth (*"in depth"*, *"deep dive"*, *"lengthy"*, *"thoroughly"*); never because a topic seems big. Composes cleanly with `--technical` or `everyday`. Then:

- **Chapters, each a lesson.** 4 to 6 chapters of 3 to 5 steps (14–20 steps total; up to 30 if needed): core idea, how it fails, trade-offs, real-world variants, and edge cases. Give every step after the concept a `chapter` name; the header shows one tab per chapter.
- **A prediction in every chapter.** `DATA.predict` is a list, one entry per chapter, each asked on the step before its causal moment and revealed on the next. `check-drawing` fails a page of 12+ steps with fewer than one prediction every 8 steps.
- **Practice and What if across the chapters.** Now you try draws questions from every chapter, and What if covers the key parameter shifts.
- **The same checks on every step.** Depth never relaxes a check: every number still comes from the model, every claim is audited and reviewed, every step is framed. Pages of 12+ steps offer "Resume at step k".

## Correctness & mandatory end-of-`/visualize` review

A model checks the picture; `src/claims/audit.mjs` checks the words; and a fresh independent reviewer checks BOTH conceptual soundness and studio visual quality before any page ships. Every page carries four build-time audit checks:

1. **Topics before pictures.** Before drawing, identify what a good reference teaches for the subject and write `COVERAGE = { source, topics: [{ topic, where }] }`. Place each core topic at `"step:0"`, `"step:k"`, `"lab"`, `"whatif"`, `"practice"`, or `"deferred"` with a reason. At least three in four core topics are taught.
2. **No typed numbers.** Every number in the voice, headings, captions, cards and Details must exist in the model at the precision shown ("about" allows 5%). Non-model constants go in `allow` with a reason.
3. **Claims.** Each cause-and-effect sentence goes in `CLAIMS` word for word as the page says it, with a test against the model.
4. **Mandatory fresh independent reviewer (every `/visualize`, every model).** Run:
   ```sh
   node <skill>/scripts/review-brief.mjs <name>.audit.json <dir>/review.json <page> --shots <dir>/shots --mode <everyday|fast|technical|deep>
   ```
   Hand the printed brief (along with `model.mjs` and the fresh light & dark PNGs in `<dir>/shots`) to a **fresh-context reviewer who did NOT build the page**:
   - **Claude Code:** spawn a fresh subagent with the `Agent` tool (no prior build context).
   - **Codex:** spawn a fresh reviewer with `spawn_agent` (or a fresh read-only `codex exec` run).
   - **Gemini / Antigravity:** spawn a fresh subagent with `invoke_subagent` (or a fresh swarm worker).
   - **2-agent parallel independent review (recommended for `everyday`, `--technical`, and `--deep` when subagents are available):** spawn two disjoint fresh reviewers in parallel with zero overlap — **(1) Domain Auditor** checks `model.mjs`, physical direction, cause-and-effect, mode-appropriate language/units, and claims; **(2) Studio Visual Reviewer** inspects the light & dark step PNGs against `references/look.md` and `references/objects.md`/`figures.md` (recognizability, contrast, silhouettes, leaders, card clearance). Merge their findings into `review.json` (`"reviewer": "independent"`, `"checks": { "conceptual": "pass"|"fail", "visual": "pass"|"fail" }`).
   - **No subagent available:** stop and hand the printed brief to the user; **never self-review**.

   `audit.mjs` rejects missing/self reviews, stale stamps after edits, open findings, or any failing `conceptual`/`visual` check. Fix every finding, rebuild, re-shoot, and re-run the fresh reviewer until both checks pass.

## Workflow

`<skill>` is this folder. A page's folder can live anywhere on the same disk: the scaffold imports the rig and the page from `<skill>/src` by a relative path.

1. **Choose lane & mode, then topics first** (Correctness, 1): pick `--kind object|machine|concept` and `--mode everyday|fast|technical|deep` (combining flags if requested), then write the one-line shape plan.
2. **Scaffold:** `node <skill>/scripts/new-figure.mjs <name> --kind object|machine|concept --mode everyday|fast|technical|deep --dir <folder>`. Build it and look at it once so you know what passing looks like.
3. **The model** (`model.mjs`): pure functions, no imports (the page inlines it). Test it against an independent reference and the cases the story needs (`model.test.mjs`).
4. **The figure** (`figure.mjs`): build the real object (`src/rig/objects.ts`), mechanical assembly (`src/rig/mech.ts` + `turningPart()`), or canonical concept (`src/rig/parts.ts` / `src/rig/concept.ts`), drawn once in `figure()` and posed in `pose(state)`. **Working draft early:** build and inspect before polish.
5. **The story** (`story.mjs`): steps with their `shot` and `subject`, headings, captions, narration (plain English for `everyday`, exact SI/formulas for `--technical`), `CLAIMS` and `COVERAGE`.
6. **The hooks** (`build.mjs`): `at`, `stillAt`, `boundsOf`, `DATA.lab`, `question(n, r)`, What if variants (as needed for the mode), and `DATA.predict`.
7. **Voice and build:** run `node <folder>/voice.mjs` (skip when `--fast` / `--no-voice`), then `node <folder>/build.mjs`.
8. **Check and look**, until each passes:
   - `node --test <folder>/*.test.mjs`
   - `node <skill>/scripts/check-drawing.mjs <page>` (add `--fast` in `--fast` mode)
   - `node <skill>/scripts/check-arithmetic.mjs <page>`
   - `node <skill>/scripts/shoot-steps.mjs <page> --out <folder>/shots` (add `--fast` in `--fast` mode), inspect every light & dark PNG, then `--check-fresh`.
9. **Mandatory independent review:** run `review-brief.mjs <audit> <dir>/review.json <page> --shots <folder>/shots --mode <mode>` and dispatch to a fresh reviewer (or 2-agent parallel Domain + Visual reviewers). Fix every finding, rebuild, re-shoot, and re-verify until `checks.conceptual === "pass"` and `checks.visual === "pass"`.
10. **Deliver** with this report, and nothing vaguer:

    ```text
    Built <title> (<mode>, --kind <kind>): <n> steps, from <parts>. Model tested against <reference>.
    check-drawing: passed. audit: clean (<n> claims, <m> topics, review: independent — conceptual pass, visual pass).
    arithmetic: <n> equations. shots: <n>, <first> to <last>, light & dark inspected.
    Files: <page>, <folder>. Open: <page>#step=<the key step>. Not verified by machine: <whatever you judged only by eye>.
    ```
    A machine adds `contacts: <n> checked`. Report only checks you ran.

## Craft rules (studio baseline, every model)

`references/objects.md`, `references/figures.md`, and `references/look.md` give the reasons, tokens, and failure table.
- **Bold shaded solids** in the studio materials (`src/rig/rig.css`, included before the page's own CSS), with heavier silhouettes than creases and shine on lit edges. Out-of-focus parts recede by tone, never by opacity.
- **Everyday object studio kit (`src/rig/objects.ts`):** use `OBJECT_VIEW`, draw the recognizable real 3D object with cutaway internals (`vesselShell`, `liquidColumn`, `dipTube`, `plungerNozzle`, `sprayCone`, `watchCaseDial`, `watchHand`, `coiledSpring`) in real materials (`glass`, `liquid`, `mist`, `rubber`, `wood`), and pair it with a clean, never-receded side `explainerCard` / `meterBar`.
- **Machine studio kit (`src/rig/mech.ts` + `turningPart()`):** wrap every turning thick solid in `turningPart()` (`worstErrPx < 0.5 px`). Separate flat layered machines with `explodedStack()` + `centreLines()`. Use `plateShadow` on concave/holed parts and `{ sort: "face" }` or `drawSpiralRibbon` on coils and spoked cutouts.
- **Concept studio kit (`src/rig/parts.ts` or `src/rig/concept.ts`):** draw the field's canonical shape with live working on stage.
- **Draw once, then move.** A figure rebuilt every frame stutters; `check-drawing` times every frame.
- **Values are printed on parts** (or crisp `explainerCard` / `workingStrip` panels) and read in both themes; dark-mode `data-t-bad` and toned cells keep readable ink.
- **Arrows end on a face and never cross a printed value or index** (route over a gap with `via`).
- **Motion means something:** liquid rises as the plunger rebounds, mist fires as pressure peaks, a bit turns as its arrow lands. Nothing moves for decoration.
- **The figure dominates.** One desktop viewport holds the title, the figure, the heading, the readouts and the controls. One signal colour (`subject` orange) on a calm neutral stage; short, non-crossing callout leaders.

## Review gates

| Command | Must end with |
|---|---|
| `pnpm test` | all pass (models against references, the rig, the audit, the arithmetic) |
| `pnpm typecheck` | no errors |
| `node scripts/check-drawing.mjs <page> [--fast]` | `drawing: passed` |
| `node scripts/check-arithmetic.mjs <page>` | `arithmetic: passed (<n> equations)` |
| `node scripts/shoot-steps.mjs <page> --out <dir> [--fast] --check-fresh` | `shots: all <n> newer than the page`, after looking at them |
| `pnpm check:drawing` | every shipped Drawing page passes (after changing the rig, the page, the player or the checks) |

The legacy scene.ts pages have their own gates (`verify.mjs`, `pnpm verify:controls`, `pnpm check:embed`, `export-svg.mjs`), in `references/verify.md`; run them only when you change those pages or their engine.

## References

- `references/objects.md`: **everyday physical objects (`--kind object`)**: choosing object vs machine vs concept, Object + Side Explainer layout, `src/rig/objects.ts` API & materials, and the plain-English checklist.
- `references/figures.md`: **the recipe for all three lanes and four modes**: the scaffold, object/machine/concept parts, the look, draw once and move, the camera, predictions, lab, insets, and every failure with its check.
- `references/look.md`: studio materials, OKLab value contrast, shadows, type, and the look checks enforced by `check-drawing.mjs`.
- `references/drawing.md`: the Drawing page for real machines: what every page has, the page contract, the flat cutaway for one-plane machines, and the rig's reference.
- `references/craft.md`: the visual rules, each with the defect that taught it.
- `references/concept-rig.md`: the concept instruments in `src/rig/concept.ts` (tiers, hubs, conduits, the trace and budget lenses).
- Legacy (scene.ts pages only): `references/authoring.md`, `references/kit.md`, `references/verify.md`.
- `evals/evals.json`: held-out prompts for testing the skill on unfamiliar concepts.
