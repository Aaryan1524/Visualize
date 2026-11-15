# The Drawing look: technical cutaways for mechanisms

The bar for a real machine or physical system is `examples/escalator/`. Open it and copy its structure: `node examples/escalator/build.mjs`, then open `dist/escalator.html`. A mechanism page ships only when it reads as well as that one.

## When to use it

| Subject | Look | Why |
|---|---|---|
| A real machine or physical system: escalator, engine, lock, gearbox, pump, disk drive, bicycle gears, a lift | **Drawing**: a sharp 2D side elevation or section, drawn to scale | In Clay, a machine's many parts became identical soft blobs. Forty wheels hid the two tracks that are the whole point, and the builder called it unprofessional |
| An abstract concept with no physical figure: binary search, LRU, heaps, retries, attention | **Clay** (`look: "clay"` in a scene) | Clay gives ideas a body; there is no real geometry to get wrong |

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
- **Callouts** with short part names (1–3 words), leaders that never cross one another or run through text, and only the labels the current step needs.

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
- **Now you try:** questions generated from the model with a seed, each marked with a worked explanation.

## Length

Five to eight steps, and about 1.5 to 3 minutes of narration in all. Past that, split the subject into two pages: for example, "how it moves" and "how it stops safely".

## The page contract and the check

The page exposes:
- `window.__viz`, with `steps`, `seekStep(k)`, `seek(ms)`, `state()` and `variant(name)`;
- `#scrub`, `#play`, `#voice`, `#try` and `#predict`;
- every callout as `<g class="label">` holding a `<text>`.

Then:

```sh
node --test examples/<name>/model.test.mjs
node examples/<name>/build.mjs --out dist/<name>.html
node scripts/check-drawing.mjs dist/<name>.html     # must print: drawing: passed
```

`check-drawing` checks at 1440×900 and 1280×800. It fails on any of these:
- a missing part of the contract, or no embedded voice;
- page scroll;
- a step that lands on the wrong tab;
- a timeline that does not run forward step by step;
- a callout under 11 px, outside the stage, or overlapping another callout;
- play near the end that does not stop at the end;
- any console error.

It cannot judge beauty. Shoot every step with `node scripts/shoot.mjs <page> --step k`, plus the detail circle at 4× (`--select "#detailFrame" --scale 4`). Read every image, then fix and reshoot. The escalator took three rounds.

## Known gaps

- **Not built from the kit yet.** A Drawing page is its own `build.mjs`: the escalator's is about 1,600 lines. The shared pieces are hatching, dimension lines, leaders, detail circles, the title block and the player. They will move into `src/` when a second mechanism needs them. Until then, start by copying the escalator.
- **`scripts/verify.mjs` does not read Drawing pages.** The model tests and `check-drawing` stand in for it.
- **Desktop only,** like the rest of the kit for now.
