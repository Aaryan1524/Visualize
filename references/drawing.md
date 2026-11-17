# The Drawing look: technical cutaways for mechanisms

The bar for a real machine or physical system is set by two examples on one shared page and player (`src/drawing/`):

- `examples/escalator/`: the flagship. A side elevation of a continuous loop.
- `examples/lock/`: smaller, and the one to copy. A long section plus a cross-section, a story told in states rather than one continuous motion, the second idea (picking) and a lab.

Build both (`node examples/escalator/build.mjs`, `node examples/lock/build.mjs`) and open `dist/escalator.html` and `dist/lock.html`. A mechanism page ships only when it reads as well as they do.

## When to use it

| Subject | Look | Why |
|---|---|---|
| A real machine or physical system: escalator, engine, lock, gearbox, pump, disk drive, a lift | **Drawing**: a sharp 2D side elevation or section, drawn to scale; or, when it works in depth as well (a bicycle's rear derailleur), an isometric figure (see "Isometric machine figures") | In Clay, a machine's many parts became identical soft blobs. Forty wheels hid the two tracks that are the whole point, and the builder called it unprofessional |
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
- any console error;
- the camera, on a page whose steps name a shot (see "Point the camera at what the step teaches"):
  - a named part it cannot frame, or framed under a card or too small;
  - a subject off centre, too small, or outweighed by other parts in focus;
  - a figure clipped by anything but the stage, or bounds bigger than the figure or missing their part's anchor;
  - a camera that differs by how a step or time was reached;
  - a camera that moves too fast or holds a shot under 0.8 s;
- playback: the 95th-percentile frame over 8 ms, or any frame outside a step change over one 60 fps frame (16.7 ms), both scaled to the machine (see "Check it plays"). Every frame of the whole story is timed, for every variant, from its start to its layout being done.

It is proven against faults: the old looping escalator, the round-4 eval lock (no lab, an incomplete contract) and the eval's clipped "Plug turns anyway" label planted back into the new lock.

It cannot judge beauty. Shoot every step with `node scripts/shoot.mjs <page> --step k`, plus the detail circle at 4× (`--select "#detailFrame" --scale 4`). Read every image, then fix and reshoot. The escalator took three rounds.

## Isometric machine figures

`references/figures.md` is the recipe: start there, from `node scripts/new-machine.mjs <name>`. This section is the rig's reference.

Two drawings serve a machine. Pick by what the reader must see.

| Use | When | Example |
|---|---|---|
| **The flat cutaway** (the rest of this page) | The mechanism works in one plane, and a section shows it: tracks and steps, pins and a shear line | `examples/escalator/`, `examples/lock/` |
| **An isometric figure** on `src/rig/` | The mechanism works in depth as well: parts move sideways and in the side plane at once, or stack in layers a section would cut away | `examples/derailleur/`: the cage swings in the side plane while the parallelogram carries it across eleven cogs |

An isometric figure keeps everything else on this page: the model and its tests, the steps, the voice, the prediction, What if, the lab, Now you try, the audit and `check-drawing`.

### Build one with `src/rig/`

- **Camera** (`camera.ts`): `fitCamera(points, box, azimuth, elevation)` fits an orthographic view to the figure's bounds; fit it to every pose the story reaches, so nothing leaves the stage. `insetCamera` makes a second, magnified view. When alignment is the point, an inset is a true elevation instead: the derailleur's View A is drawn straight from behind (`examples/derailleur/rear.mjs`), where every part only slides. See `references/figures.md`, "Insets".
- **Shapes** (`shapes.ts`): every part is a closed mesh whose faces carry their outward normals.
  - `plate(plane, { outer, holes }, t0, t1)` extrudes any outline: teeth, windows and slots included.
  - `turned(origin, axis, profile)` makes pulleys, bolts and barrels.
  - `rod(a, b, r)` makes pins.
  - A plate seen edge-on still draws: its walls are its rim.
- **The look** (`draw.ts`, `rig.css`):
  - `drawMesh(mesh, camera, { material, shine })` shades each face continuously from its normal under one key light fixed to the camera.
  - The silhouette is drawn heavier than the creases.
  - Metal edges that catch the light get a specular line.
  - `contactShadow` lays a soft shadow toward the part behind.
  - Materials are token pairs (steel, alloy, chain, slate, subject, frame) in both themes.
  - Make the subject the strongest material, keep context (frame, wheel) in `frame`, and let out-of-focus parts recede by tone (`--recede`), never by opacity: a see-through solid shows what it should hide.

### Draw once, then move

A page that redraws its figure every frame stutters: the derailleur's first isometric version rebuilt about 2,800 elements a frame and ran near 25 fps. The rule:

- **Build each part once**, at rest, and place it each frame with one SVG transform (`moveInPlane`). A flat part turning or sliding in its own plane is redrawn exactly by one 2D transform, because the camera is linear.
- **A thick part that turns** is exact on the face it is placed by, and off by its thickness times the angle elsewhere. Draw it ahead at a few angles across its symmetry (`angleBin`), and turn only the small rest, placing it by the plane in the middle of what it draws. The derailleur draws one drawing a cog (half a tooth left over), two a pulley, a cage plate every 4° and a chain piece at 12 angles (`BINS` in `examples/derailleur/figure.mjs`). Hold every part under a pixel, and test it, as `examples/derailleur/figure.test.mjs` does (its worst is an inner link's rollers, 0.8 px).
- **Repeated parts are `<use>` instances** of one drawing, such as the chain's links. Selectors that name an ancestor do not reach inside a `<use>`, so style through tokens and classes without ancestors.
- **Order with fixed slots.** Parts that are slabs between parallel planes (cogs, chain plates, pulleys, cage plates) are keyed by the gap they sit in (`slotKey`), so the order changes only when a part really crosses a plane.
- **Rebuild only parts whose shape changes**, and only when their state does. In the derailleur those are the links on tilted pins, the spring, the inner cable and the force arrows.
- **The page runtime** is `RigStage`: one `<g>` per part, created once; each frame sets transforms and re-orders only on change, moving only the parts that are out of place. That last point matters: a first version moved every part it passed whenever one crossed the list (a chain link reappearing at the far cut), about 160 moves a frame, and made the slowest tenth of frames five times dearer.
- **The shared player's hooks:**
  - `focus({ focus, lit })` lets the figure recede parts itself.
  - `anchors()` makes callouts with `data-at` follow moving parts.
  - `drawingPage({ scripts })` ships the bundled engine; esbuild bundles `src/rig` with the figure.

### Check it plays

`check-drawing` times every frame of the story and fails a page that takes more than 8 ms at the 95th percentile, or a whole frame (16.7 ms) outside a step change. The limits scale with the machine, so a slow runner does not fail a page that is fine at 60 fps:

- **Calibration.** First, in the same browser and viewport, the check times a fixed workload like a frame of the rig: 300 `<g>` holding a `<use>` of a 24-path part, a transform set on each, some arithmetic, one layout read (batches of 10 frames, the median of 20, the best of three runs). `REFERENCE_MS` in `scripts/check-drawing.mjs` (0.28 ms) is that workload on the machine the budgets were set on; it runs at 0.71 ms under 2.5x CPU throttling. Both limits are multiplied by `max(1, measured / reference)`, capped at 3, and the check prints the scale (`machine is 2.6x the reference`).
- **A stray pause** (garbage collection, a shared host) does not count: a frame over its limit is timed again twice and its best time counts.
- **A page clearly over** its limit (the 95th percentile of its first 800 frames) stops being timed, so a failing page fails in seconds.
- **To try a slow machine**, set `VIZ_CPU_THROTTLE=2.5`. Chrome slows the reference and the page alike. `VIZ_ONLY_PLAYBACK=1` skips every other check, to time a page alone.

The derailleur's redraw-every-frame version fails at 1x (p95 38 ms) and at 2.5x (p95 94 ms); the draw-once version passes at both (p95 1.9 and 4.4 ms), as do the escalator and the lock.

### Point the camera at what the step teaches

A figure that shows the whole machine at every step leaves the reader hunting for a 4 mm screw. The shared player has a camera (`src/drawing/camera.mjs`): zoom and pan only, as one transform on the figure's group, so nothing is redrawn and the viewing angle never changes.

- **A step names its subject:** `shot: ["barrel"]` in `DATA.steps`. The camera centres those parts in the stage's clear area, zoomed at most 2× (`CAP`), never below 1×. At 3× the derailleur lost its context and became a field of teeth around a 4 mm part.
  - **What it attaches to stays in view:** `DATA.camera.around[k]`, e.g. `["links"]` for the barrel adjuster. These parts limit the zoom, and the subject moves off centre only as far as keeping them in view needs.
  - **No shot:** a step without one shows the whole figure.
- **The subject is lit.** While the voice names nothing else, the shot's parts are lit and every other part recedes by tone, still recognisable. The camera alone cannot make a small part the subject: the derailleur's barrel at 2× is a fifth of the size of the parallelogram it sits on.
- **The voice points too.** The narration may speak a `[phrase|part]` that the step's shot does not frame well (inside the clear area and at least 6% of its shorter side). The camera then eases to that part before the words reach it, holds at least 0.8 s, and comes back when there is room. Links too close together share one shot, so the camera never chases every word.
- **Calm.** Each move is long enough that the picture never moves faster than 2 clear-area short sides a second, eased in and out. Under reduced motion it jumps instead.
- **Deterministic.** The camera is a function of the story time.
  - Running on from the step before, a step eases in from that step's camera.
  - Reached by a tab, it eases from wherever the camera is to the step's shot.
  - A seek and a play to the same time give the same camera.
- **Only the stage clips it.** Give the drawing `overflow: visible`, and put no clip-path or mask on the camera's group: a zoomed figure runs to the stage's rounded edge.
  - The heading stays readable on a soft wash of the stage colour behind it, never a hard edge through the drawing.
  - Callout text has a halo, and View A is an opaque disc.
- **What does not zoom:** callout text, View A, the title block and the cards. Leaders follow the camera to their parts; a callout whose point leaves the picture hides.
- **The machine supplies two hooks:**
  - `boundsOf(names)`: the named parts' bounds in the figure's own units, without the camera, or null for a name it does not have;
  - `clearArea()`: `{ x0, y0, x1, y1 }`, where the camera centres its shots: clear of the heading, the callout columns, any inset and the cards.

  Put `data-camera` on the group the camera moves, and `data-camera-avoid` on anything framed parts must stay out from under (the derailleur marks View A's disc and title, and the title block). Keep insets and labels outside the camera's group. `DATA.camera.alias` adds names only the camera uses, with the parts they light. All of `DATA.camera` stays out of the audit's stamp.
- **Every name must be framable.** The derailleur's build stops on a shot or a voice link naming a part the figure does not draw.
- **A part too small to read alone** is framed with what it acts on. The derailleur's B screw, a 5 mm head, is framed with the mounting bolt it turns the derailleur about.

`check-drawing` checks the camera on any page whose steps name a shot (`VIZ_ONLY_CAMERA=1` runs these checks alone):
- **Framing.** At each step's still frame, and at the moment each spoken name begins, every named part has bounds. Each must:
  - sit inside the clear area;
  - stay off the cards, the heading and anything marked `data-camera-avoid`;
  - be at least 6% of the stage's shorter side;
  - have its callout point at it on the stage.

  Checked at 1440×900 and 1280×800, for every variant.
- **Centring and subject.** At a step's still frame, and when a voice-led shot has arrived:
  - the subject's centre lies in the middle half of the clear area, both ways;
  - it spans at least 15% of the clear area's shorter side;
  - the lit parts take more of the frame than every other part in focus put together.
- **No hard crop.** No clip-path or mask on the camera's group or above it, and the drawing does not clip to a box inside the stage.
- **Bounds sanity.** Every name a shot, its `around` or the voice uses has bounds smaller than the whole figure, and they hold the point its callout marks.
- **Determinism.** A step's camera matches by `seekStep` and by its tab. A time's camera matches by `seek` and by playing up to it.
- **Calm.** Run frame by frame through the whole story, the picture never moves faster than the limit. Every shot is held 0.8 s or more, and a tab's eased move keeps to the same speed.

It fails each of the derailleur's planted faults (`node examples/derailleur/build.mjs --plant <fault> --out <page>`):
- `missing-shot`: a shot naming a part the figure lacks;
- `unknown-link`: a voice link to an unknown part;
- `under-card`: a clear area that frames parts under the cards;
- `off-centre`: a shot whose `around` pushes the subject off centre.

Then look. `node examples/derailleur/shots.mjs --only step` shoots every step in both What ifs and themes, plus two frames halfway through voice-led moves, and prints each image's time. `--check-fresh` fails if any shot is older than the page.

## Known gaps

- **The drawing itself is still per machine.** The page and the player are shared; hatching, dimension lines, arrowheads, detail circles and the title block are still small functions in each `build.mjs` (the two examples draw them differently: the escalator in world mm with y up, the lock in page units). Copy them from `examples/lock/build.mjs`.
- **`voice.mjs` is per example**, a copy of the same recorder with the machine's own script. `scripts/voice.mjs` records concept scenes only.
- **`scripts/verify.mjs` does not read Drawing pages.** The model tests and `check-drawing` stand in for it.
- **Desktop only,** like the rest of the kit for now.
- **The rig sorts by fixed slots, not by a general solver.** Parts that are not slabs between parallel planes need keys chosen by hand; two parts that interpenetrate on screen in both orders need splitting.
