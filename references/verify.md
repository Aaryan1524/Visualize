# Verification

`node scripts/verify.mjs <dir>` runs the model in Node, independently of the page, builds the scene, and drives the built page in headless Chrome. It prints `ok` or `FAIL` per check with the first problems, and ends `<id>: passed` or `FAILED`.

## Checks, and how to fix their failures

| Check | Fails when | Usual fix |
|---|---|---|
| observations | a declared value, order, size, tone, visibility or highlight is not what the page shows | Fix the view (it disagrees with the model), or the observation if it was declared wrongly. Never delete it to pass. |
| captions | caption, readout or trust differ from the model's | The page is not drawing from the model |
| layout shift | the stage changes size between steps | Content under or beside the stage grows per step; give it a fixed size (kit chips already do) |
| depth order | where solids overlap, the browser paints the farther one on top (checked by ray-cast), or two solids intersect | Move parts apart. Solids must not interpenetrate, at rest or mid-move; use `arc` to pass over |
| determinism | a time shows different pages depending on what was seen before | Something depends on history; layout shift is the usual cause |
| text size, contrast, contrast dark | text under 11 px, or under WCAG contrast against what is behind it | Use kit label sizes; face ink is automatic; tone text in panels is mixed toward ink |
| labels | overlaps, spill off a face, a covered face label, text outside the card, a panel overflowing, a free label lying on a part that is not its target | Move names to a row with leaders; mark low-value labels `optional`; shorten text |
| surface finish | a declared detail is missing, or leaves its owning solid's outline | Keep side details inside the flat part of the face |
| keyboard, reduced motion, step link | arrows, Home, End and Space; no in-between frames under reduced motion; `#step=` | Player regressions |
| linking | pointing at a linked element lights unrelated elements, or misses related ones | Check `link` ids; related means one element's ids contain the other's |
| composition, semantics, callouts | (editorial) solids span less than 42% of the stage; a tone disagrees with its legend swatch; a leader misses its anchor | Fit parts, fix the legend, use part anchors for targets |
| desktop viewport, copy budget, details drawer, prediction | (editorial) the page scrolls or clips at 1440×900 or 1920×1080; too many words; the drawer fails to open; the prediction does not pause or explain | Shorten text; the explanation must state the answer |
| layout | sideways scroll, or label problems, at 390 px | Phone fallback: face labels hide when they do not fit |
| console | errors or exceptions | |

It also writes desktop and phone screenshots in both themes, a sheet of every step at rest, and a sheet of every transition at five instants, to `shots/<scene>/`.

## Proving the checks work

`pnpm verify:controls` plants 34 faults, such as reversed paint order, a wrong panel value, a hidden mark, a label lying on a part, a stage that shrinks per step, and unfit labels shown. It requires each fault to be caught while two clean fixtures pass. Run it after changing the kit or the checks.

`scripts/export-svg.mjs --plant drop-text` must fail the export comparison. `pnpm check:embed` must pass after player or style changes.

## What the checks cannot see

- Whether the representation is a good choice, or whether the explanation teaches.
- Whether the composition is beautiful.
- Observations nobody declared.
- Whether captions are true about anything outside the model.
- Continuous motion between the sampled instants.

Review the sheets and 4× close-ups yourself, and compare against the reference examples.
