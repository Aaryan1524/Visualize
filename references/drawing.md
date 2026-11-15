# The Drawing look: technical cutaways for mechanisms

The bar for a real machine or physical system is set by two examples on one shared page and player (`src/drawing/`):

- `examples/escalator/`: the flagship. A side elevation of a continuous loop.
- `examples/lock/`: smaller, and the one to copy. A long section plus a cross-section, a story told in states rather than one continuous motion, the second idea (picking) and a lab.

Build both (`node examples/escalator/build.mjs`, `node examples/lock/build.mjs`) and open `dist/escalator.html` and `dist/lock.html`. A mechanism page ships only when it reads as well as they do.

## When to use it

| Subject | Look | Why |
|---|---|---|
| A real machine or physical system: escalator, engine, lock, gearbox, pump, disk drive, bicycle gears, a lift | **Drawing**: a sharp 2D side elevation or section, drawn to scale | In Clay, a machine's many parts became identical soft blobs. Forty wheels hid the two tracks that are the whole point, and the builder called it unprofessional |
| An abstract concept with no physical figure: binary search, LRU, heaps, retries, attention | **A scene in the drawing look** (`look: "drawing"`): the kit's 3D parts in the same ink, hatching, palette and title block | There is no real geometry to draw to scale, but the page should still look like a plate from the same book |

Aim for sharp and precise, not photo-real: an engineering drawing a reader trusts, not a render.

## What a Drawing page has

These are all in the escalator. A page missing one of them is not done.

**The figure**
- **A model in real units, with tests.** The escalator's model works in mm. Its tests check:
  - the stated numbers;
  - that the loop closes;
  - the property the page teaches: the treads stay level within 0.5°, measured independently of the drawing code;
  - that no moving part ever overlaps another, swept over a full cycle;
  - that each wheel is tangent to its own rail;
  - a planted overlap, to prove the collision test can fail.
- **One view, drawn to scale from the model.** A side elevation or section, with nothing positioned by eye. A part the model does not compute is drawn as fixed structure.
- **Cut material is hatched.** The building, pits and slabs read as cut, with the near side removed and say so in the title block.
- **Dimension lines and level marks** for the numbers the story uses: rise, angle, the step rise.
- **A title block** with the view's name, units, the key numbers and a legend.
- **Colour only for the mechanism's key paths.** At most three line colours, each in the legend (in the escalator: chain track blue, trailer track green), plus orange for the one part the reader follows. Everything else is ink and grey.
- **A magnified detail circle for each step,** at a stated scale (for example "DETAIL A · 2.6 : 1"). It shows the moment that step is about, linked to a small circle on the overview. Fine detail (grooves, cleats, webs) lives only in the details, so the overview stays clean.
- **Callouts** with short part names (1–3 words), leaders that never cross one another or run through text, and only the labels the current step needs. A callout never sits where a card opens (the prediction, the concept, Now you try, the lab); `check-drawing` fails it.
- **Every cut part reads as its own part.** Two sections that touch get different fills or clearly different hatching (angle and spacing). The eval lock hatched its plug exactly like its housing, and the judge could not tell them apart; the lock now tints the plug and hatches it closer.

**The depth**

A plain agent beat the skill on depth in both blind evals of round 4, each time by doing these three things. Every Drawing page does them:

- **The problem first.** Step 0 says what the machine must achieve and the number that makes it hard: "A lock has one job: turn for one key, and refuse more than ninety thousand others." Fold it into the concept, not an extra step. The lock is the model for this; the escalator's opening predates the rule and still starts with the mechanism.
- **The second idea.** One step for what the field teaches right after the core: picking for a lock, the handrail drive for an escalator. Ask "what does someone who just understood this ask next?"
- **A lab.** The reader sets their own values and the model answers, with the drawing following where it can: cut a key and see each pin land, or move the orange step anywhere and set a track error. Inputs are bounded, and the model's tests sweep the lab's whole range (the lock tests 3,000 random keys for each tolerance).

**The page**
- **Visualize's own page.** It has:
  - the card frame and the concept's name in the display face, with one line under it;
  - numbered step tabs;
  - Details and Dark buttons;
  - the step heading in large type on the stage;
  - a readout row computed from the model;
  - the control bar: back, play, forward, step count, timeline, Now you try, Voice, replay.
  
  Take fonts and colours from `src/render/tokens.css`.
- **One story timeline.** The bar under the stage runs once, from the concept to the last step. Each step is as long as its narration. It stops at the prediction until the reader answers, and it stops at the end. It never shows the machine's own cycle: an earlier version tracked the 42 s loop, so the bar swept start to end twice during a 98 s explanation and matched nothing on screen.
- **A voice.**
  - Step 0 explains the concept in two or three sentences, then one clip per step.
  - Numbers are spoken in words and taken from the model.
  - `[phrase|part]` lights the part while it is named.
  - The moving part reaches the spot the voice names as the voice names it.
  - Record locally with Kokoro, as in `examples/escalator/voice.mjs`.
- **One prediction,** just before the causal moment. In the escalator it is: "The two tracks meet near the top. What happens to the steps?"
- **What if:** a real variant (30° and 35°). The model, the drawing, the readouts and the voice are all recomputed, and every test runs for each variant.
- **Now you try:** questions generated from the model with a seed, each marked with a worked explanation. Every number in a question comes from the model on the page: the eval lock asked about "6 pins" while the drawing had 5.

## Length

Five to eight steps, the second idea included, and at most about 3 minutes of narration in all (the lock is 2 minutes, the escalator about 98 s). Past that, split the subject into two pages: for example, "how it moves" and "how it stops safely".

## Build it from the kit

A machine's `build.mjs` does three things and hands them to `drawingPage()` from `src/drawing/page.mjs`:

1. **Draws each variant at build time** as an SVG string, from the model in mm. Mark it up so the player can drive it:
   - parts as `<g class="part" data-part="name">`, inside `<g id="scene">`;
   - callouts as `<g class="label" data-beats="1 3" data-to="x,y"><path class="leader"/><circle class="ldot"/><text/></g>` (the player draws each leader from the measured text box to `data-to`, and shows the label on the steps in `data-beats`);
   - any other element shown on some steps only, with `data-beats`;
   - detail circles as `<g class="detail" data-full="2" data-dim="0 1">`;
   - the title block's key as `<g id="tbkey" data-x0="…">` holding `<g class="tbk">` entries, laid out by measured width.
2. **Writes the machine's hooks**: a function `machine(DATA)` that runs in the page and returns:

   | Hook | What it does |
   |---|---|
   | `model(V)` | the model for a variant, usually `makeModel(V.over)` |
   | `mount(V, model)` | creates the moving elements once the variant's SVG is in `#fig`, and fills fixed readouts |
   | `at(k, t, still, SEG)` | the machine's state `t` seconds into step `k` (`still` for a step's still frame) |
   | `stillAt(k, SEG)` | seconds into step `k` for its still frame: the moment the voice names what the step is about |
   | `render(state, S)` | draws one moment and its readouts |
   | `question(n, r)` | a Now you try question from seed `n` and a seeded `r()`: `{ q, choices: [right, …wrong], explain }` |
   | `lab(values, variant)` | the lab: `{ state, ok, verdict, rows }` for the reader's values |
   | `heading(k)`, `lit(ids)`, `info(state)` | optional: a variant's own heading, extra lighting when the voice names a part, extra fields for `__viz.state()` |

   It may use the model's functions (the model is inlined above it) but nothing else from the build.
3. **Fills `DATA`**: `steps` (heading and focus per step), `base` (the first variant), `predict` (`step`, `question`, `choices`, `answer` and `explanation`, either one or one per variant, and `locked`), `variants` (each with its `svg`, `captions` and `voice`), `alias` (a name the voice lights that stands for several parts) and `lab` (`button`, `title`, `heading`, `intro` and `inputs`, each with `id`, `label`, `min`, `max`, `step`, `value` and an optional `format` such as `"{} mm"`).

Plus the page's words (title, the line under it, the readout row, the legend, the facts in Details), the drawing's own CSS, and **the audit** (see SKILL.md, "Correctness"):

```js
audit: {
  models: Object.values(MODELS),                 // every variant
  facts: [/* numbers derived in the build, not stored in the model */],
  allow: [{ value: 5, why: "the tests' sweep step" }],
  claims: [{ text: "the sentence exactly as the page says it", test: (M) => /* true by the model */ true }],
  coverage: { source: "where the topic list came from", topics: [{ topic, where: "step:3" | "lab" | "whatif" | "practice" | "deferred", why }] },
  reviewFile: join(HERE, "review.json"),
  report: join(ROOT, "dist", "<name>.audit.json"),   // for scripts/review-brief.mjs
}
```

The audit gathers every string in `DATA` and Details itself, so nothing a reader sees escapes it. Both examples carry one: the escalator's caught its own landing step saying the tracks "come together" with "both wheels at the same height", where the model keeps the trailer wheel 30 mm higher and the stairs flatten because the chain's path levels out. The player supplies the timeline, the voice tour, the prediction, What if, Now you try, the lab, Details, the theme, the keyboard (on the document, so the arrows work on a fresh page) and `window.__viz`.

## The page contract and the check

The shared player exposes it for you:
- `window.__viz`, with `steps`, `predictStep`, `variants`, `seekStep(k)`, `seek(ms)`, `state()`, `variant(name)`, `answer(i)`, `practice(n)`, `question(n)`, `lab(values)`, `labInputs()` and `closeLab()`;
- `#scrub`, `#play`, `#voice`, `#try`, `#labBtn`, `#lab` and `#predict`;
- every callout as `<g class="label">` holding a `<text>`.

Then:

```sh
node --test examples/<name>/model.test.mjs
node examples/<name>/build.mjs --out dist/<name>.html
node scripts/check-drawing.mjs dist/<name>.html     # must print: drawing: passed
```

`check-drawing` checks at 1440×900 and 1280×800, on every step of every What if variant, the answered prediction, Now you try and the lab at each input's minimum and maximum. It fails on any of these:
- a missing part of the contract, no embedded voice, no lab, or fewer than two variants;
- an audit that is not clean: a typed number, a claim the model contradicts or the page does not say, a topic list without a source or with too little taught, or no current independent review;
- page scroll;
- a step that lands on the wrong tab, or a timeline that does not run forward step by step;
- a callout under 11 px, outside the stage, overlapping another callout, or under an open card;
- text reading NaN, undefined or Infinity;
- a prediction that is not revealed with its explanation on the next step;
- a question without three distinct choices and a worked explanation, or a lab without a verdict;
- the right arrow doing nothing on a fresh page;
- a narrated tour (run with stand-in audio) that does not stop at the prediction, or play near the end that does not stop at the end;
- any console error.

It is proven against faults: the old looping escalator, the round-4 eval lock (no lab, an incomplete contract) and the eval's clipped "Plug turns anyway" label planted back into the new lock.

It cannot judge beauty. Shoot every step with `node scripts/shoot.mjs <page> --step k`, plus the detail circle at 4× (`--select "#detailFrame" --scale 4`). Read every image, then fix and reshoot. The escalator took three rounds.

## Known gaps

- **The drawing itself is still per machine.** The page and the player are shared; hatching, dimension lines, arrowheads, detail circles and the title block are still small functions in each `build.mjs` (the two examples draw them differently: the escalator in world mm with y up, the lock in page units). Copy them from `examples/lock/build.mjs`.
- **`voice.mjs` is per example**, a copy of the same recorder with the machine's own script. `scripts/voice.mjs` records concept scenes only.
- **`scripts/verify.mjs` does not read Drawing pages.** The model tests and `check-drawing` stand in for it.
- **Desktop only,** like the rest of the kit for now.
