# Verification

> **Legacy.** This page describes the scene.ts route (the Unfold stage, `verify.mjs`), kept so `examples/lru/`, `retries/`, `attention/` and `lru-3d/` still build. **Do not use it for a new page:** every new page, machine or concept, is a Drawing page on the rig (`references/figures.md`). Where this page and `figures.md` disagree (the camera, the checks, the parts), `figures.md` is right.

A Drawing page is checked by `scripts/check-drawing.mjs`, `scripts/check-arithmetic.mjs` and `scripts/shoot-steps.mjs` instead; `references/figures.md` lists what each catches, and their failure lines say what to fix. `verify.mjs` does not read Drawing pages, and the Drawing checks refuse a scene.ts page with a message saying so.

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

## Look checks (check-drawing.mjs)

These are part of `scripts/check-drawing.mjs`, the Drawing check, not the legacy route above. They came from a page that passed every other check and still looked wrong: the first automatic watch had near-white tops and sides, the same framing on every step, a leader running the figure's full height, and its key part hidden. The code is in `scripts/lib/look.mjs`, with the thresholds in `LOOK` there. They run at 1440×900. `VIZ_ONLY_LOOK=1 node scripts/check-drawing.mjs <page>` runs only these, in a few seconds.

Rig-only checks run on pages with `#fig .rig-part`. The flat cutaways (escalator, lock) get only the leader-length check.

| Check | Failure line (starts `look …`) | Threshold | Usual fix |
|---|---|---|---|
| unbudgeted turn | `part "<id>" turns a thick solid by one 2D transform without its error budget — use turningPart()` | any part whose own transform rotates, shears or mirrors, that draws `.rig-wall` faces (itself or in its `<use>` template), and that lacks `data-rig-turn`, at any 0.1 s sample of any What if | Place it with `turningPart()` / `turnErrPx`, so it is drawn at its nearest prepared angle and its error is recorded |
| turn error | `part "<id>" is drawn with a turn error of N px, over 1 px` | `__rig.turns` maxErrPx > 1.0 | Prepare more angles for that part (smaller turn left over) |
| top and sides | `"<part>" shows its top and sides D apart in lightness …, under 0.04` | lit part, either theme: OKLab L of its caps (weighted median) against its farthest wall shade that holds ≥10% of its wall area, < 0.04 | Use a material whose lit and dark tones differ (not two near-whites); don't paint caps and walls one colour |
| against the stage | `"<part>" is lit but its top is D in lightness from the stage, under 0.02` | a part the step is about (`data-named`, or named by a shown callout), either theme | Give the subject a toned material; never white-on-white for the thing being taught |
| same framing | `steps A to B (N in a row) show the same framing, over 4` | the camera moves < 0.05 clear-area short sides between steps; a run > 4 fails; a rig page with the camera off is one framing for every step | Give the steps shots (`DATA.camera`) of what each is about |
| subject size | `the step is about "<names>", which spans P% of the stage's shorter side, under 12%` | union of the shot's parts (or of the parts the step is about) on screen | Frame it closer (the step's shot) |
| long leader | `the leader of "<label>" is P% of the stage's shorter side, over 80%` | every page, every step | Move the callout next to its part |
| leader crossing | `the leader of "<label>" crosses "<part>" for P% …, over 25%` | painted length of the leader over another part that matters at the step (not its own part, not the part it ends on) | Put the callout on its part's open side |
| covered focus | `"<part>" is lit but P% of it is covered (most by "<other>")` | elementsFromPoint on a 16×16 grid over the part. At grid points that hit the part, it must be the first rig part hit at least 5% of the time. Outlines, contact shadows, arrows and callouts don't count as cover. | Turn the figure, or cut the cover away (a cutaway) |

### Calibration

Every threshold sits below the worst value on the pages that look right (derailleur and bloom are the bar). No threshold fails the derailleur. Measured at 1440×900, worst over every step, every What if and both themes:

| Page | unbudgeted turns | top/sides | subject vs stage | same-framing run | subject span | longest leader | leader crossing | least on top |
|---|---|---|---|---|---|---|---|---|
| escalator (flat) | - | - | - | - | - | 30% | 0% | - |
| lock (flat) | - | - | - | - | - | 36% | 0% | - |
| derailleur | 240 (chain links, cogs, pulleys, cage; pending turningPart) | 0.055 | 0.216 | 1 | 16% | 74% | 19% | 7% (guide pulley behind the knuckle, "wide") |
| bloom | 0 | 0.091 | 0.023 (white card) | 4 ("six") | 35% | 22% | 0% | 100% |
| multi-agent | 0 | 0.091 | **0.015** (orchestrator) | **6** (camera off) | 51% | 43% | 4% | 40% |
| automatic-watch | **17** | 0.258 | 0.106 | **6** (camera off) | 23% | 48% | 14% | 35% |

Bold values fail. The stage threshold (0.02) is narrow: it sits 0.003 below bloom's white card, and multi-agent misses it by 0.005, so that failure is a close call between two near-white subjects. Some of the watch's faults are not caught at a threshold the derailleur passes. Its case and plate are near-white (frame material, top 0.94 against sides 0.85 to 0.95), but the derailleur's frame context is as low, and the part as a whole includes steel. The watch's barrel is 65% under the rotor, and the derailleur's guide pulley is up to 93% under the knuckle. Review screenshots for these.

### Proving the look checks fail

`node scripts/plant-look.mjs [dist/bloom.html]` plants each fault in a clean page through `VIZ_PLANT` (laid on again after every seek). It requires the check's own failure line, and checks that the clean page does not print it. The faults:

- `turn`: a wall part turned 20°, unmarked
- `turn-error`: a recorded 3.5 px error
- `flat`: every face one grey
- `pale`: caps painted the stage colour
- `still`: the camera frozen
- `small`: the subject drawn at 5%
- `leader-long`: a corner-to-corner leader
- `leader-cross`: a leader zig-zagging over a lit part
- `cover`: an opaque part over a lit part

Run it after changing `look.mjs` or the rig's look.
