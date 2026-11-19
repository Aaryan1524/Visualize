---
name: visualize
description: Build step-through visual explanations whose picture is checked against an executable model, with a narrating voice, a prediction, a hands-on lab and practice questions. Real machines and physical systems (an escalator, an engine, a lock, a derailleur) and abstract concepts (a Bloom filter, a hash table, a cache, a protocol) are both drawn as bold shaded 3D solids on one rig, in the shape the field already draws, with a camera that frames each step's subject. Use whenever someone wants a machine or device (how an escalator, lock or engine works), an algorithm, data structure, protocol, distributed-system behaviour, ML mechanism or paper method explained visually, animated or step by step, even if they never say "visualize". Outputs a standalone HTML page, checked in headless Chrome.
license: MIT
compatibility: Works in Claude Code, Codex and Antigravity. Needs Node.js 24+ (runs TypeScript directly) and Google Chrome or Chromium for the checks. Run `npm install` (or `pnpm install`) once in this folder.
metadata:
  version: "1.0.0"
---

# Visualize

A figure here is a model you can watch. You write a small executable model of the idea, a figure of solid parts that the model's states move, and the words a reader sees and hears. The page shows the model's numbers, the audit checks the words against the model, and the checks drive the built page in Chrome to prove it frames, plays and reads as intended.

## One route for every page

**Every new page, machine or concept, is a Drawing page on the rig.** The model, the figure, the story and the hooks go to `drawingPage()` (`src/drawing/page.mjs`), which gives every page the same player, camera, voice, prediction, What if, lab, Now you try and title block, and the same checks. `references/figures.md` is the recipe for both kinds.

Start from the scaffold, which builds and passes `check-drawing` as generated (all but the independent review):

```sh
node <skill>/scripts/new-figure.mjs <name> --kind concept --dir <folder>   # a hash table: slots, a key card, an arrow, a marker
node <skill>/scripts/new-figure.mjs <name> --kind machine --dir <folder>   # a gear pair
```

Open the closest example before starting:
- `examples/bloom/`: **the bar for a concept.** Sixteen bit cells in two rows, a word card, one arrow a hash function, the camera on each word's bits, a lab where the reader types any word, and the deletion trap.
- `examples/derailleur/`: **the bar for a machine.** Bold shaded solids, each drawn once and then moved, so it reads as 3D and plays at 60 fps.
- `examples/lock/` and `examples/escalator/`: machines that work in one plane, drawn as flat technical cutaways to scale (`references/drawing.md`) on the same page and player. The lock opens with the problem, ends with the second idea (picking) and lets the reader cut their own key.

**Legacy, not for new pages:** `examples/lru/`, `retries/`, `attention/`, `lru-3d/` and `test/fixtures/gallery-*` are scene.ts pages on the older Unfold stage, checked by `scripts/verify.mjs`. They still build. Their references (`authoring.md`, `kit.md`, `verify.md`) are marked legacy, and the Drawing checks refuse their pages with a message saying so.

## The one idea that matters

**The model is the truth, and the page is checked against it.** Never type a number, an order or an outcome into the figure or the words. Compute it in the model, pose the figure from it, and write the words from it. The audit fails a number the model does not have.

**One causal moment per step, and the camera goes to it.** Each step has a shot: the parts it is about, framed and lit, while the rest recedes in tone. Make the change itself visible at rest: a bit that turns to 1, a key that walks on past a taken slot, a pulley ahead of its chain. A step where nothing visible changes teaches nothing.

## Choose the representation

**Start from what the field already draws.** Write one line in your plan: "A textbook draws <concept> as <shape>." A Bloom filter is a row of bits with k arrows from the item to the bits its hashes pick. A round-robin scheduler is a circle of slots with a pointer going round. Quicksort's partition is a row of cells with i and j marked on it. A hash table is a row of slots with a key walking to the first free one. Build *that shape* from the rig's parts, and say why if you depart from it.

The evals taught this. Without it, four of five subjects came out as a straight rail of slots because that was the part at hand, and a plain flat diagram drawn without the skill taught them better each time.

The parts (`src/rig/`, `references/figures.md`):
- **Concepts:** `cellDrawing` (a cell or slot, with a printed value by `decalAt` and `valueText`, and a tone by flag), `railCentres` (a row with indices), `cardDrawing` (a token or key card), `ringSlots` and `turnAt` (a ring of slots), `markerDrawing` (a pointer), `arrow` (a link drawn in the figure's projection, routed with `via`), `workingStrip` (the working beside a part), `boardDrawing` (the floor).
- **Machines:** `plate`, `turned`, `rod`, `sprocket` and `roundedHull` meshes, `moveInPlane` and `angleBin` for motion, `checkContacts` for what drives what.

One part per real element, counted true. Draw the cause, not only the states. Do not draw boxes-and-arrows diagrams, and do not invent a decorative machine whose parts mean nothing. A part the subject needs and the rig lacks is a kit gap: build it in `src/rig/`, drawn once and moved, and record it.

**Show the working, on stage.** Put the intermediate values where the reader is looking, not only the result: a Bloom filter shows each hash function's row (`h1  2,668,802,083 mod 16 = 3`) in a working strip beside the word card (`workingStrip`), framed with it, and each bit's 0 or 1 on its cell. Captions and lab rows alone hide it. Drawing pages have no flat side panels yet: a short sum goes in a working strip, a longer one in the caption and the lab's rows; a subject that cannot be taught without a sequence diagram or a matrix is a kit gap to report, not a reason to take the legacy route.

## Decisions this skill makes

A one-line prompt leaves these open. Decide them like this without asking. Ask only about the three marked **ask**, and only when the prompt and files don't answer them.

| Decision | Default | Why |
|---|---|---|
| **The scenario** (concept, sizes, values) **ask** if they change the answer | Small readable values (16 bits, 8 slots, 3 keys), chosen so every interesting case happens, each asserted in `model.test.mjs`; stated in Details | Small numbers keep every value legible on a face; a run without the collision explains nothing |
| **Output** **ask** if unclear | A standalone HTML page. Drawing pages have no SVG or React export yet; say so if one is asked for | Every output is checked |
| **What to contrast with** **ask** when "versus what?" is ambiguous | The naive alternative the concept fixes, as a step or a What if | A contrast makes the mechanism visible |
| Representation | The shape the field draws (write the one line), built from rig parts | A reader recognises the shape they were taught |
| Pointers and indices | A `markerDrawing` standing on its slot; indices printed on the board in front of each cell | A pointer on a separate lane read as being on the wrong slot |
| Size | **Standard** (the default): 5–9 steps after the concept, narration of about 3 minutes at most; a short concept can be one minute. **Deep**, only when the request has `--deep` or asks for it in words ("in depth", "deep dive", "everything about", "thoroughly"): see *Deep explanations* below. Larger than deep: propose a short series of linked pages | Past 9 steps a single story loses the reader; the reader who asks for depth gets it in chapters, each a lesson of its own |
| Depth | **The problem first:** step 0, the concept (no tab), says what the idea must achieve and what makes it hard, before anything moves; a topic it teaches is placed at `"step:0"`. **The second idea:** one step for what the field teaches right after the core (picking for a lock; the deletion trap and counting filters for a Bloom filter). **Hands-on:** every page has a lab (`DATA.lab`), where the reader sets a number or types a word or key and the model answers | In blind evals a plain agent beat the skill on depth by doing exactly these three |
| Number of systems | One; a contrast goes in What if (the same story with one input changed) or in one step | Two figures halve the size of everything |
| Prediction | Exactly one, asked on `PRED_STEP` about what the next step shows, the step before the causal moment | Predicting forces the reader to hold the rule; asked on the step itself, the heading gives it away |
| Camera | A `shot` per step: the parts it is about, centred, lit, at most 2×; every part the heading names stays in frame (`subject`). It zooms and pans from one fixed angle and never turns. A step whose subject spans the whole figure has no shot | The reader keeps their bearings while each step is framed |
| Colour | Neutral parts; one followed part or tone in orange; at most three meanings (set, good, bad), each in the legend | Colour that means everything means nothing |
| Words | Title of 1–4 words (the concept's name) with `about` as one line under it; one heading a step; callouts of 1–3 words, on the overview only where the camera zooms | Paragraphs get read instead of the figure |
| Learning | Always `question(n, r)` from the model (three choices or more, answer computed); `whatIf` when one input changes the outcome (k, a size, a fault); the lab | A reader who answers a new case has understood |
| Voice | Write `script(M)` in `story.mjs`; step 0 explains the concept in two or three spoken sentences before anything moves. `[phrase|part]` lights a part while it is spoken. Never say letters or abbreviations aloud. Record with the page's own `voice.mjs` | A reader who does not know the idea needs it said before the demo |
| Letters | Text on a face is printed on it (a decal), never floated above it | Floating labels read as detached from what they name |
| Theme | Light on every system by default; the reader switches with the Dark button or a `#theme=dark` link. Review light first, then dark; both are checked | The builder found dark ugly as a first impression; a value that reads in one theme can vanish in the other |
| Where files go | In the user's project: the page's folder (model, figure, story, build, voice, tests), the built page in its public folder, shots beside the folder | Keeps the skill folder clean |

## Deep explanations (`--deep`)

Off by default. Turn it on only when the request says `--deep` or asks in words for depth ("in depth", "deep dive", "explain everything about", "thoroughly"); never because a topic seems big. Then:

- **Chapters, each a lesson.** 4 to 6 chapters of 3 to 6 steps: the core idea, then what the field teaches next, typically how it fails (a crash, a slow part, a bad input), the trade-offs (when more of something stops helping, with the number where it turns), the variants used in practice, and the edge cases. Give every step after the concept a `chapter` name; the header shows one tab a chapter.
- **A prediction in every chapter.** `DATA.predict` is a list, one entry a chapter, each asked on the step before its causal moment and revealed on the next. `check-drawing` fails a page of 12 steps or more with fewer than one prediction every 8 steps.
- **Practice and What if across the chapters.** Now you try draws questions from every chapter, and What if covers the input each chapter turns on.
- **Length.** 15 to 30 steps and about 10 to 15 minutes of narration. Step 0 still explains the concept in two or three sentences before anything moves; each chapter's first step says in one sentence what this chapter adds. Past about 6 chapters, make a series: one page a part, each linking to the next.
- **The same checks on every step.** Depth never relaxes a check: every number still comes from the model, every claim is audited and reviewed, every step is framed.
- **Long pages remember where the reader stopped.** A page of 12 steps or more offers "Resume at step k" on its opening (kept in the reader's browser only).

## Correctness: what the page says is checked too

A model checks the picture; nothing checked the words, and that is where the skill lost round 5 of the evals: a derailleur page said the cage spring swings the cage forward (it pulls it back), and limit screws were never taught. Every page carries four checks, run by `src/claims/audit.mjs` at build time:

1. **Topics before pictures.** Before any drawing, find what a good reference teaches for the subject (a manual, a textbook, a reference page; search when you can) and write the list with its source: `COVERAGE = { source, topics: [{ topic, where }] }`. Each core topic is placed at a step (`"step:0"` for the concept, `"step:3"`), `"lab"`, `"whatif"` or `"practice"`, or `"deferred"` with a reason that Details also states. At least three in four core topics are taught. The topics decide the number of steps.
2. **No typed numbers.** Every number in the voice, headings, captions, cards and Details must exist in the model at the precision shown ("about" allows 5%). A number that is not a quantity of the subject (a hash's width in bits) goes in `allow` with a reason.
3. **Claims.** Each cause-and-effect sentence goes in `CLAIMS` word for word as the page says it, with a test against the model. The audit fails if the sentence is not on the page or the model disagrees.
4. **A reviewer who did not build it.** `node <skill>/scripts/review-brief.mjs <name>.audit.json <dir>/review.json <page>` prints a brief; give it to a fresh agent (a subagent) or a person. It writes `review.json`, stamped with the text it read. Fix each finding (the edit makes the review stale, so review again) or answer it (`resolved: true` with a `response`). Your own review does not count.

## Workflow

`<skill>` is this folder. A page's folder can live anywhere on the same disk: the scaffold imports the rig and the page from `<skill>/src` by a relative path.

1. **Topics first** (Correctness, 1), then the one line: "A textbook draws <concept> as <shape>."
2. **Scaffold:** `node <skill>/scripts/new-figure.mjs <name> --kind concept|machine --dir <folder>`. Build it and look at it once, so you know what passing looks like.
3. **The model** (`model.mjs`): pure functions, no imports (the page inlines it). Test it against a separately written reference and the cases the story needs (`model.test.mjs`).
4. **The figure** (`figure.mjs`): the field's shape from rig parts, each drawn once in `figure()` and placed in `pose(state)`; values and tones by attribute. **Working draft early:** build and open it before any polish; a wrong shape is cheap to change now.
5. **The story** (`story.mjs`): steps with their `shot` and `subject`, headings, captions and the narration, all written from the model; `CLAIMS` and `COVERAGE`.
6. **The hooks** (`build.mjs`): the motion through each step (`at`, `stillAt`), `boundsOf` for each camera name, the lab, `question(n, r)`, What if variants and the prediction.
7. **Voice and build:** `node <folder>/voice.mjs`, then `node <folder>/build.mjs`.
8. **Check and look**, until each passes:
   - `node --test <folder>/*.test.mjs`
   - `node <skill>/scripts/check-drawing.mjs <page>`: framing, subjects, the camera's calm and determinism, playback timing, the lab, the prediction, practice, the rig's material colours, and the audit;
   - `node <skill>/scripts/check-arithmetic.mjs <page>`: every printed sum, product, quotient and remainder, redone;
   - `node <skill>/scripts/shoot-steps.mjs <page> --out <folder>/shots`, then open every image, then `--check-fresh`. A passing check proves the page is correct and tidy, not that it is beautiful: compare the shots with the derailleur's and the Bloom filter's.
9. **Review:** the brief (Correctness, 4) to a fresh reviewer; fix or answer every finding, rebuild, and review again if the words changed.
10. **Deliver** with this report, and nothing vaguer:

    ```text
    Built <title>: <n> steps, from <parts>. Model tested against <reference>.
    check-drawing: passed. audit: clean (<n> claims, <m> topics, review current).
    arithmetic: <n> equations. shots: <n>, <first> to <last>, looked at.
    Files: <page>, <folder>. Open: <page>#step=<the key step>. Not verified by machine: <whatever you judged only by eye>.
    ```
    A machine adds `contacts: <n> checked`. Report only checks you ran.

## Craft rules (short form)

`references/figures.md` gives the reasons, and its failure table the defect behind each.
- **Bold shaded solids** in the rig's materials (`src/rig/rig.css`, included before the page's own CSS), with a heavier silhouette than creases and a shine on lit edges. Out-of-focus parts recede by tone, never by opacity.
- **Draw once, then move.** A figure rebuilt every frame stutters; `check-drawing` times every frame.
- **Values are printed on parts** and read in both themes; a toned cell prints in its tone's dark ink.
- **Arrows end on a face and never cross a printed value or index** (route them over a gap with `via`); `check-drawing` checks it.
- **Motion means something:** a bit turns as its arrow lands; a key walks to the slot it looks at. Nothing moves for decoration.
- **The figure dominates.** One desktop viewport holds the title, the figure, the heading, the readouts and the controls.

## Review gates

| Command | Must end with |
|---|---|
| `pnpm test` | all pass (models against references, the rig, the audit, the arithmetic) |
| `pnpm typecheck` | no errors |
| `node scripts/check-drawing.mjs <page>` | `drawing: passed` |
| `node scripts/check-arithmetic.mjs <page>` | `arithmetic: passed (<n> equations)` |
| `node scripts/shoot-steps.mjs <page> --out <dir> --check-fresh` | `shots: all <n> newer than the page`, after looking at them |
| `pnpm check:drawing` | every shipped Drawing page passes (after changing the rig, the page, the player or the checks) |

The legacy scene.ts pages have their own gates (`verify.mjs`, `pnpm verify:controls`, `pnpm check:embed`, `export-svg.mjs`), in `references/verify.md`; run them only when you change those pages or their engine.

## References

- `references/figures.md`: **the recipe, for machines and concepts**: the scaffold, the concept parts, the look, draw once and move, the camera, the page's prediction, lab and step 0, insets, and every failure with its check.
- `references/drawing.md`: the Drawing page for real machines: what every page has, the page contract, the flat cutaway for one-plane machines, and the rig's reference.
- `references/craft.md`: the visual rules, each with the defect that taught it.
- Legacy (scene.ts pages only): `references/authoring.md`, `references/kit.md`, `references/verify.md`.
- `evals/evals.json`: held-out prompts for testing the skill on unfamiliar concepts.
