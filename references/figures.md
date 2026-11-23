# Figures: the recipe for every page — everyday object, machine, or concept

Every new page is a Drawing page on the rig: a tested model, a figure of shaded solids drawn once and moved, a camera shot per step, a recorded voice (unless `--fast`), the audit's claims and topics, a lab and Now you try, put together by `drawingPage()` (`src/drawing/page.mjs`) and checked by `check-drawing`, `check-arithmetic` and `shoot-steps`. Everyday physical objects, precision machines, and abstract concepts all take the same route; only the parts and mode depth differ.

Six pages show the studio bar: `examples/perfume-atomizer/` (everyday physical object + side explainer on `src/rig/objects.ts`); `examples/derailleur/`, `examples/automatic-watch/` (14-step `--deep` exploded calibre on `src/rig/mech.ts`), and `examples/differential/` (cutaway meshed train on `src/rig/mech.ts`) for machines; `examples/bloom/` (`src/rig/parts.ts`) and `examples/multi-agent/` (3-tier Concept Plate on `src/rig/concept.ts`) for concepts. Their earlier versions failed in the ways listed at the end. Each failure now has a check, and each check is in the scaffold and enforced by `check-drawing` + the mandatory independent review.

Start with the scaffold, then replace its parts in order:

```sh
node <skill>/scripts/new-figure.mjs <name> --kind object  --mode everyday|fast|technical|deep --dir <folder>   # everyday 3D cutaway object + side explainer
node <skill>/scripts/new-figure.mjs <name> --kind machine --mode everyday|fast|technical|deep --dir <folder>   # a gear pair
node <skill>/scripts/new-figure.mjs <name> --kind concept --mode everyday|fast|technical|deep --dir <folder>   # a hash table: slots, a key card, an arrow, a marker
```

Each builds and passes `check-drawing` as generated, all but the review (which only a fresh reviewer can give). Each writes:
- `model.mjs` and `model.test.mjs`: the model, tested against a separately written reference (the machine's also checks its contact pair);
- `figure.mjs`: the rig figure;
- `story.mjs`: the steps with their shots, the headings, captions and narration, the claims and the topics;
- `build.mjs`: the machine hooks (motion, camera bounds, lab, Now you try) handed to `drawingPage`;
- `voice.mjs`, which records `voice.json`, and `claims.test.mjs`.

**Replace the model first** (`model.mjs`), then the figure (`figure.mjs`), then the story (`story.mjs`). Keep every test passing as you go. (`new-machine.mjs <name>` still works: it is `--kind machine`.)

## What figure a subject gets

| Subject | Figure | Example |
|---|---|---|
| An everyday physical object or phenomenon (perfume bottle, wristwatch, coffee maker, battery, syringe, wing, lungs) | **Everyday 3D cutaway + side explainer** from `src/rig/objects.ts` (`--kind object`, `references/objects.md`) — **default for real physical objects** | `examples/perfume-atomizer/` (cutaway bottle, liquid column, dip tube, nozzle, mist cone, side `explainerCard` + `meterBar`) |
| A precision machine whose parts move in depth or meshed trains (especially with `--technical` or `--deep`) | **Rig solids** from `src/rig/mech.ts` and `src/rig/` meshes (`plate`, `turned`, `rod`, `sprocket`) | `examples/derailleur/` (cage and parallelogram), `examples/automatic-watch/` (exploded layered calibre), `examples/differential/` (meshed bevel and spur train) |
| An abstract concept: a data structure, an algorithm, a protocol, a mechanism in a paper | **Rig solids** from `src/rig/parts.ts` or `src/rig/concept.ts`, in the shape the field already draws | `examples/bloom/` (bit cells, word card, hash arrows), `examples/multi-agent/` (3-tier Concept Plate with trace lens) |
| A machine that works in one plane, where a section shows the cause | **The flat cutaway** (`references/drawing.md`): a Drawing page too, with the same page, player and checks | `examples/escalator/`, `examples/lock/` |

The scene.ts route (the Unfold stage, `look: "drawing"` or `"clay"`, `verify.mjs`) is **legacy**: it is kept so `examples/lru/`, `retries/`, `attention/` and `lru-3d/` still build, and it is not chosen for a new page. The Drawing checks refuse its pages with a message saying so.

## Everyday object parts (`src/rig/objects.ts`) & 4 composable modes

For real physical objects and everyday learners, use `--kind object` and read [`references/objects.md`](objects.md) for the full API (`OBJECT_VIEW`, `vesselShell`, `liquidColumn`, `dipTube`, `plungerNozzle`, `sprayCone`, `watchCaseDial`, `watchHand`, `coiledSpring`, `explainerCard`, `meterBar`), everyday materials (`glass`, `liquid`, `mist`, `rubber`, `wood`), and plain-English guidelines.

All three lanes (`object`, `machine`, `concept`) share four composable modes passed via `--mode` or natural-language cues:
- **`everyday`** *(default)*: recognizable studio visual + side explainer, plain college-level English backed by a real tested model, voice ON, 5–7 steps, Predict + Lab, `review-brief.mjs --mode everyday`.
- **`--fast`**: quick 4–5 step visual (~3–4 min), no voice (`--no-voice`), no What-if variants, `check-drawing.mjs --fast`, `shoot-steps.mjs --fast`, `review-brief.mjs --mode fast`.
- **`--technical`**: exact SI units, equations / `workingStrip`s on stage, multi-variant What-if, strict `review-brief.mjs --mode technical` audit.
- **`--deep`**: 4–6 chapters, 14–20 steps, highest visual detail, full voice, per-chapter Predict checkpoints, `review-brief.mjs --mode deep`.

Flags compose (for example `--deep --technical` for a multi-chapter engineering breakdown).

## Concept parts

`src/rig/parts.ts` builds what concepts are made of, each drawn once at the origin and placed by a transform. Values and tones change by attribute, never by rebuilding the solid.

| Part | Call | Notes |
|---|---|---|
| A cell or slot | `cellDrawing(cam, { w, d, h })` | A block with a shallow panel on top. Its tone is a flag on the item: `t-set` (holds a value: dark in the light theme), `t-hot` (the followed one, orange), `t-good`, `t-bad` |
| A printed value | `decalAt(cam, [x, y, z])` and `valueText(text, size)` | A live item lying on the cell's top; swap the string to change it. On a toned cell it takes the tone's own ink, so it reads in both themes |
| A rail of cells, with indices | `railCentres(n, pitch, origin)`, an index decal per cell (`valueText(i, 6, "rig-index")`) on the board in front | Indices are drawn once, in place |
| A token or key card | `cardDrawing(cam, { w, d })`, its word by `valueText(word, size, "rig-value rig-on-card")` | Light in both themes, so its ink is dark in both |
| A ring of slots | `ringSlots(n, r, centre)` and `turnAt(cam, theta, at)` | The first slot at the front |
| A pointer or marker | `markerDrawing(cam, { h })` | A pin with a ball, in the followed colour |
| An arrow or link | `arrow(cam, from, to, { lift, via })` | Drawn in the figure's projection, lifted into an arc, or routed through `via` points on a smooth curve; rebuilt when its ends move (a short path, not a solid) |
| The working | `workingStrip(rows, at, size)` | A small card-coloured tag of rows of text beside a part, upright on screen so long numbers read: `h1  2,668,802,083 mod 16 = 3`. A row appears as its step happens |
| A floor | `boardDrawing(cam, { w, d })` | Quiet context, in `frame` |

`CONCEPT_VIEW` is a three-quarter default for flat-board concepts so tops, fronts and printed values all read; in general, pick the camera azimuth and elevation from the object's shape (or use an exploded vertical stack for flat layered assemblies) rather than forcing one angle on every subject.

**How the concept parts are used well** (each learned on the Bloom filter):
- **An arrow ends on the front face of its cell**, beside the index printed in front of it, never on its top: a head on the top covers the value printed there. An arrow to a back row goes over the gap between two front cells (`via`), never across one; a lift alone still crossed the front row's values. `check-drawing` fails any arrow that runs across a printed value or index at a still frame.
- **The card goes where its arrows are short**: in front of the cells it points at, or walking with the key along the rail (the scaffold's card stays in front of the slot it is looking at).
- **Show the working on stage, beside the subject**, in a `workingStrip` that belongs to the subject's part, so the camera frames them together. In captions and lab rows alone, the working was hidden: an eval lost on a Bloom filter that "hides the hashing". Names on the arrows themselves (h1, h2, h3 at their heads) sat on the cells and read as noise. Keep the strip clear of every cell and of the cards at the lower right.
- **A group the story is about gets a camera name**: the scaffold's `"run"` (the slots a key has looked at), the Bloom filter's `"hashed"` (the bits a word's hashes pick). `boundsOf` and the lighting expand it to the parts it is this step. A name may not be as big as the whole figure (half its area): frame the run, not the rail, and give a step whose subject spans everything no shot.
- **Frame the overview to the figure.** Fit the camera to the cells and the card's place, not the board's rim, and fill the clear area with it; keep the clear area itself above the cards that open at the stage's lower right (`CLEAR.y1`), since the camera centres a subject in it at every size and nothing else keeps the subject from under a card.

The rest of this page applies to both kinds: one followed part, a camera shot per step, contact tests where one part drives another.

## Machine parts (`src/rig/mech.ts`)

Use the reusable mechanical kit in `src/rig/mech.ts` instead of hand-rolling gear outlines or bridge slabs per figure:

- **Gear train:** `spokedWheel` and `pinion` (clock or involute profiles), `arbor` for shafts, `meshCentres` to lay out a train from pitch radii and angles, and `assertMeshed` to verify centre distances and modules in tests.
- **Structure and hardware:** `bridge` (with automatic screw and jewel hole records), `jewelSetting`, `screw`, and `cutawayShell` (opened toward `facingCamera(cam)`).
- **Flat layered machines:** watches, gearboxes and clutches stack thin wheels on parallel planes. Separate their layers with `explodedStack()` and connect shared axes with dashed `centreLines()` instead of squashing the assembly into a shallow disc.

## The page

- **Step 0 is the concept**, with no tab: the problem the idea solves, before anything moves (`headings(M)[0]` is the question). A topic it teaches is placed at `"step:0"`.
- **The prediction** is asked on `PRED_STEP` about what the next step shows, and revealed there. Ask it the step before the causal moment. Build it for each What if variant from that variant's model (`question`, `answer` and `explanation` may each be keyed by variant): one question frozen to the base variant contradicted the others' explanations.
- **Every What if variant keeps every lesson.** A variant that changes an input (the number of hash functions) can lose a case: the Bloom filter's one-hash run had no false negative, its six-hash run no "definitely not". Let the model choose each variant's inputs so every case still happens (`opsFor`), name the tabs by lesson, not by input, and test that each variant says each lesson at its step and never repeats the previous step's paragraph.
- **What if compares expectations, not one run's luck.** Show the expected value for the variant beside this run's value, each labelled, and the expected values side by side where the trade-off is taught.
- **The lab** (`DATA.lab.inputs`) is the reader's own values: a number on a slider (`min`, `max`, `step`), or a typed entry, `{ type: "text", samples: [...] }`, for a word or a key. The checks try each slider's two ends, or each sample and an empty entry.
- **Now you try** is `question(n, r)` from the model, with three choices or more. Return the question's own `state` too, and the stage draws it: a question about one filter over a picture of another misleads.
- **The lab asks of what the stage shows**: the step on screen, and its first row says which state it is.
- **While the lab or Now you try is open**, `cardShot(state)` names what the camera frames and `cardClear()` the space beside the card they open in; the camera may zoom out below 1 there. Without them the figure stays where it is, under the card.

## The look

`references/look.md` defines the studio palette, OKLab value-contrast spans, and line/type rules.

- **Materials** are token pairs in `src/rig/rig.css` (`steel`, `alloy`, `chain`, `slate`, `subject`, `frame`, `brass`, `ruby`, `blued`, `rhodium`, `graphite`, `ceramic`, `cell`, `card`, plus everyday materials `glass`, `liquid`, `mist`, `rubber`, `wood`), in both themes.
  - Put the page's CSS after `rig.css`. Without it every solid draws black, yet every other check still passes. `check-drawing` fails a figure whose solids have no colours.
- **One followed part, in orange** (`subject`): the part the story is about, such as the derailleur's cage and pulleys, or the scaffold's driving gear. Everything else is neutral metal or the material the real part is made of. Context (frame, wheel, base plate) is `frame`, quiet.
- **Weights and shadows:** the silhouette is drawn heavier than the creases, and metal edges that catch the key light get a specular line (`drawMesh(…, { shine: true })`). For shadows laid toward the part behind, use `plateShadow` (the part's true outline with holes kept open) on concave or holed parts such as rotors, levers and bridges, and `contactShadow` only on convex slabs.
- **Self-occluding coils:** pass `{ sort: "face" }` to `drawMesh`—or use `drawSpiralRibbon` for flat springs (mainsprings, hairsprings)—so nearer turns paint cleanly over farther ones.
- **Detail:** enough to name every part a step names: teeth, bolts, a slot. Nothing the story never mentions.
- **Receding:** out-of-focus parts recede by tone (`--recede`), never by opacity. A see-through solid shows what it should hide.
- **Look checks:** `check-drawing.mjs` runs `scripts/lib/look.mjs` automatically and enforces turn error (`< 1 px`), OKLab cap-vs-wall and subject-vs-stage contrast, framing variety across steps, subject span, leader length and crossing, and covered-focus visibility (`VIZ_ONLY_LOOK=1` runs these alone).

## Draw once, then move

A page that redraws its figure each frame stutters. The derailleur's first version rebuilt 2,800 elements a frame and ran near 25 fps.

- **`turningPart()` (preferred for turning thick solids):** a thick solid turned by a raw 2D transform skews by its thickness times the turn angle. Wrap every turning thick part in `turningPart()`, which computes the fewest angle bins across the part's symmetry to keep screen error under `1 px` (default `0.5 px`), places on the part's mid-plane, and reports `turnErrPx` to `RigStage` for `check-drawing.mjs`.
- **Keep stationary shafts and arbors unrotated:** draw fixed pins and arbors once without turning them with the wheel.
- **`moveInPlane`:** use raw `moveInPlane` for pure translations or flat parts turning in their own plane.
- **`<use>` instances:** repeated parts, such as chain links, are instances of one drawing.
- **Fixed slots:** parts that are slabs between parallel planes are ordered by the gap they sit in (`slotKey`). The order changes only when a part really crosses a plane.
- **Rebuild only what changes shape:** in the derailleur, the links on tilted pins, the spring, the inner cable and the force arrows. Everything else is placed.
- **`RigStage`** puts one `<g>` per part and moves only the parts that are out of place.
- `check-drawing` times every frame against the machine it runs on: p95 under 8 ms and no frame over 16.7 ms, both scaled to the machine.

## The camera

A whole-machine figure at every step leaves the reader hunting for a 4 mm screw (`references/drawing.md`, "Point the camera at what the step teaches").

- **A `shot` per step** names the subject: the camera centres it and lights it, and the rest recedes.
- **`DATA.camera.around[k]`** names the parts it attaches to, which stay in view.
- **Every part the heading names stays in frame** (`DATA.camera.subject[k]`), checked through the whole step. Name the parts that carry the step's cause, not only the part it is about: "the pulley moves; the chain waits" needs the pulley and the chain run between it and the cog.
- **The 2× cap** (`CAP` in `src/drawing/camera.mjs`): at 3× the context is gone.
- **Voice-led shots** follow `[phrase|part]` links in the narration. Two names spoken close together share one shot.
  - A step that names two parts in one breath should frame both. The scaffold's speed step does.
- **The camera only zooms and pans**, from the one angle the figure is drawn at; it never turns. That is the "one camera" of the concept pages: the reader keeps their bearings while each step is framed.
- **Keep clear of the cards:** `clearArea()` is the space between the callout columns, and anything framed parts must stay out from under (the title block, an inset if you add one) carries `data-camera-avoid`.
- **Nothing clips** the figure but the stage.

## Insets: optional, and off by default

**The main figure carries the explanation on its own.** Build no inset by default. A second view splits the reader's eye and the stage, and the builder chose a robust main figure over one.

When the main view truly cannot show something, such as an alignment, show it there first:
- a readout from the model;
- the lab's rows;
- a tint on the part that is out of line, and a mark that shows which way and how far. When the derailleur's guide pulley is off line, its teeth turn red, and an arrow under it runs from the pulley back to the line of the cog it should be on. Where the pulley sits ("pulley 1.40 mm outboard of the 17") is written at the pulley's end.
  - Measure from the part the reader asked about, not the nearest one. Past half a cog off, the nearest cog is the wrong one and the side flips. One function says it for the arrow, the readout and the lab's rows.
  - Word the label as the position of the thing at its end. A word at an arrow's head reads as "this way".
  - A 1–4 mm offset is a pixel or two in the figure, so the arrow is drawn a fixed 30 mm long.
  - The legend says the arrow is drawn longer than the offset, and the label's number is exact.
  - A test checks the label and the direction across the lab's whole range.

If an inset is added later, it must earn its place:
- **Make it a true orthographic elevation, never a near-angle view.** When alignment is the point, as with a chain on its cog, look straight along the line that matters: from behind and level, azimuth 180°, elevation 0.
- Draw each part where the model puts it, mark what should line up, and write the gap in mm from the model.
- From straight on, parts only slide, so each is drawn once and moved by a translate.
- Test that the camera is exactly that elevation and that each part's position matches the model.

An inset at a near angle shows slanted faces, and the reader cannot judge alignment by eye. The derailleur's first inset was drawn that way, and a later true elevation was removed in favour of the main figure.

## Failures, each with its check

| What happened | The check that catches it now |
|---|---|
| **Backwards pulleys:** both jockey pulleys turned against the chain for weeks; every still frame looked right | `checkContacts` (`src/rig/contacts.ts`): where a chain or gear drives a wheel, the two move together on screen. Each machine's tests call it with their contacts and assert how many of each kind they checked, so it never passes on nothing. The scaffold's `model.test.mjs` does, and plants a reversed gear that must fail. |
| **The stutter:** a redraw-every-frame figure at 25 fps | `check-drawing` times every frame, relative to the machine |
| **Day-old screenshots:** a review judged a camera from images taken before the camera existed | `node scripts/shoot-steps.mjs <page>` shoots every step, theme, variant, lab end and Now you try, and prints each time. `--check-fresh` fails on any shot older than the page. |
| **Framing that passed but was wrong:** the barrel adjuster sat centred but small on a parallelogram five times its size | The subject must be centred in the clear area's middle half, span 15% of it, and outweigh every other part in focus. The lit parts must cover it. |
| **The hard crop:** a straight fade cut the zoomed drawing beside the heading | No clip-path or mask on the camera's group, and `#fig` must not clip to its own box. The heading reads on a soft wash, never a hard edge. |
| **Sums that did not add up:** shares of a length rounded one by one, so the printed parts missed the printed whole | `node scripts/check-arithmetic.mjs <page>` re-does every printed equation from the printed digits. A sum must add up exactly; a product or quotient may round. It covers headings, captions, Details, the narration, Now you try and the lab's rows. |
| **A black figure:** the scaffold's first build left out `rig.css`, and every check passed | `check-drawing` fails solids with no material colours |
| **A step that lost its subject:** with the inset gone, step 4 framed only the cassette, and the pulley moving ahead of the chain was never seen | `DATA.camera.subject[k]`: every part the heading names stays in frame through the step. The planted fault `missing-subject` fails it. |
| **An alignment cue too small to see:** the off-line mark was about 1 px long and hidden behind the parallelogram | A red arrow, drawn long, with the exact offset beside it. A test checks its label, direction and on-screen length across the lab. |
| **The old route for a concept:** a fresh agent built a Bloom filter as a scene.ts page, a flat pale plan view with none of the rig, the lit subject or the camera, and two of these checks crashed on it | One route in `SKILL.md`; the Drawing checks refuse an old page with a clear message; the concept scaffold |
| **A value nobody could read:** white figures on a cell's lit top, and dark ones on a light card in the dark theme | Toned cells print their value in the tone's dark shade; a set cell and a card have their own ink in each theme. Look at both themes |
| **A remainder printed wrong:** concept pages print "27 mod 8 = 3" | `check-arithmetic` re-does every `a mod m = r`, thousands separators included |
| **Hidden hashing:** the working (word → hash → mod 16 → bit) was only in captions and lab rows; on stage, arrows went from word to bit with no numbers | The working strip beside the card, framed with it |
| **Arrows across the values:** arrows to the back row crossed the front row's 0s and 1s, and the ones along the front crossed the indices | `check-drawing` samples every arrow at each step's still frame against every printed value and index. A planted fault (`VIZ_PLANT=straight-arrows node examples/bloom/build.mjs`) must fail it |
| **A lit bit cut off, or under the lab card:** the camera framed only what the step named, and the lab card hid the bit that decided the answer | Every part lit (by the shot, the voice or the current operation) must be wholly on the stage and under no open card, at every step's still frame and every lab sample. The Bloom filter's operation lights its word and every bit it touches; a planted fault (`VIZ_PLANT=card-only-shot`) must fail |
| **An estimate called exact:** the page called Bloom's classic formula the exact expected rate, and it ranked the hash counts wrongly at 16 bits | The model computes the true expectation by counting, tested against an exact reference and a seeded simulation; the page names each formula for what it is |
| **What if variants that lost lessons:** one hash function never showed a false negative, six never a "definitely not" | The model chooses each variant's words so every case happens; a test checks every lesson in every variant |
| **A heading that gave the answer away:** the prediction was set on the step it asks about, so the heading above it said "A false positive" | The prediction sits on the step before (`PRED_STEP`); `check-drawing` checks it is revealed on the next step |
| **Subtle domain errors or visual defects past automated checks:** a 1,000× SI torque unit slip (`µN·mm` vs `mN·mm`), a bow-tie spoke cutout, a dark-mode CSS variable cycle, or a hand-waved explanation | Mandatory fresh independent reviewer at the end of every `/visualize` (`scripts/review-brief.mjs` with `--shots`): checks `model.mjs` conceptual soundness AND light/dark rendered PNGs against `references/look.md`. `src/claims/audit.mjs` enforces `"reviewer": "independent"` and passing `checks.conceptual` & `checks.visual` |

The rule under every row is the same: **look at the page as built, and never ship without a fresh independent review**. Checks catch mechanical regressions; a fresh reviewer catches conceptual nonsense and subtle visual flaws across Claude, Codex and Gemini alike.
