# Figures: the recipe for a machine that reads as 3D

This is how the rear derailleur page (`examples/derailleur/`) was built, written so the next machine starts where it ended. Its first versions failed in the ways listed at the end. Each failure now has a check, and each check is in the scaffold.

Start with the scaffold, then replace its parts in order:

```sh
node scripts/new-machine.mjs <name> --dir <folder>    # a gear pair that builds and passes check-drawing (all but the review)
```

It writes a model with a tested contact pair, a rig figure of a few parts, a camera shot per step, a recorded narration, the audit's claims and topics, a claims test, a lab and Now you try. **Replace the model first** (`model.mjs`), then the figure (`figure.mjs`), then the story (`story.mjs`). Keep every test passing as you go.

## When a subject gets a rig figure

| Subject | Figure | Why |
|---|---|---|
| A machine whose parts move in depth (sideways and in the side plane at once, or in layers) | **The rig** (`src/rig/`): shaded solids, drawn once and moved | The default for machines. The derailleur's cage swings in one plane while the parallelogram carries it across eleven cogs, and only solids show both. |
| A machine that works in one plane, where a section shows the cause | **The flat cutaway** (`references/drawing.md`) | Tracks and steps, pins and a shear line: `examples/escalator/`, `examples/lock/` |
| A concept with no physical figure | Clay or the drawing look (`SKILL.md`, "Stage") | A concept still has parts. Where it is drawn as a mechanism, build its parts as rig solids. |

**A concept's parts become rig solids by what they are, not by decoration:**
- a slot is a recessed `plate` with a floor;
- a token or bit is a short `turned` disc that slides between slots by one transform;
- a ring is a `plate` with a hole and its positions as `turned` pins round it;
- a pointer is a small `plate` arrow standing at its slot.

The rest of this page applies unchanged: one followed part, a camera shot per step, contact tests where one part drives another.

## The look

- **Materials** are token pairs in `src/rig/rig.css` (steel, alloy, chain, slate, subject, frame), in both themes.
  - Put the page's CSS after `rig.css`. Without it every solid draws black, yet every other check still passes. `check-drawing` now fails a figure whose solids have no colours.
- **One followed part, in orange** (`subject`): the part the story is about, such as the derailleur's cage and pulleys, or the scaffold's driving gear. Everything else is steel, alloy, slate or chain. Context (frame, wheel, base plate) is `frame`, quiet.
- **Weights:** the silhouette is drawn heavier than the creases, and metal edges that catch the key light get a specular line (`drawMesh(…, { shine: true })`). A soft `contactShadow` falls toward the part behind.
- **Detail:** enough to name every part a step names: teeth, bolts, a slot. Nothing the story never mentions.
- **Receding:** out-of-focus parts recede by tone (`--recede`), never by opacity. A see-through solid shows what it should hide.

## Draw once, then move

A page that redraws its figure each frame stutters. The derailleur's first version rebuilt 2,800 elements a frame and ran near 25 fps.

- **`moveInPlane`:** a flat part turning or sliding in its own plane moves by one exact 2D transform.
- **Angle bins:** a thick part is exact only on the plane it is placed by. Draw it at a few angles across its symmetry with `angleBin` (one tooth for a gear), and turn only by what is left over. A test holds every part under a pixel (`examples/derailleur/figure.test.mjs`).
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

The rule under every row is the same: **look at the page as built**. Checks pass frames that read wrong, so open every fresh shot.
