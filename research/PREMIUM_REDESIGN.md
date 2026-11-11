# Premium redesign review

Branch: `feat/premium-redesign`. Work is intentionally paused after the LRU reference for visual review; attention and retries retain their current presentation. Nothing is pushed.

## First review checkpoint: LRU

- A full-width figure above the current explanation and one request panel.
- Rounded rectangular solids with shaded corner facets, inset surface rims, contact shadows, a fitted base, guide rails, slot numbers and ticks.
- Neutral cached entries; green for a hit, terracotta for a miss, red for an eviction. The highlighted edge uses the entry's own colour.
- Readable request chips with full result names, and one set of totals.
- Labels with leaders pinned to their model objects; no text halos.
- A question that challenges insertion-order eviction, chapters, and a final recap.
- A prediction at step 4, immediately before the first eviction. Playback pauses; the next-step control waits for an answer. Keyboard users can answer with Enter, then continue with the right arrow. Scrubbing and chapter navigation remain freely available.
- The flat comparison uses the same presentation and model. Its consumed request fades before the queue advances, rather than passing through the cache.

Open `dist/lru.html#step=4` after `pnpm build` to review the hit and prediction. Step 5 shows the first eviction; step 9 is the recap. `shots/premium-review/index.html` contains the local visual comparison once screenshots have been captured.

## Verification additions

`pnpm verify` now checks these conditions for editorial scenes:

| Check | Condition | Limits |
|---|---|---|
| Composition | Stage spans at least 90% of the body width; solids occupy at least 42% of the stage width | Checks scale, not visual quality or teaching effectiveness |
| Semantics | Solid tone agrees with its legend swatch; a highlighted edge uses that same tone | Model-event tone observations separately assert hit/miss roles |
| Callouts | The pin lies on the target solid's surface; the rendered leader ends at the model anchor | Does not prove the leader takes the clearest route |
| Prediction | Keyboard answering, explanatory feedback, next-step gating and automatic playback pause | Deliberate timeline and chapter navigation can skip the exercise |

Composition, semantics and callouts are checked at every resting step, at 1280 and 390 px, in light and dark themes. Rounded-solid extent observations include the radius, and the independent browser ray caster accounts for rounded corners. The label-outside-card control closes the previously documented gap.

The controls include broken figure scale, a contradictory swatch, a detached leader, a broken answer button, a wrong semantic tone, and text moved outside the card. Both the original clean fixture and a clean editorial fixture must pass.

## Subsequent checkpoints, after review

1. Refine LRU from visual feedback, including its density and how strongly each step focuses attention.
2. Apply the accepted presentation to attention: readable token labels, meaningful weights grid, active equation terms, and a softmax prediction.
3. Apply it to retries: distinct actor shapes, a responsive lane arrangement, readable events, a prediction before divergence, and a clear final charge comparison.
4. Reconcile the visual grammar and prototype findings with the final three-scene result.

The original prototype findings remain a record of the prototype, rather than a claim about this checkpoint. The new checks cannot certify that a page looks premium; that decision remains a side-by-side visual review.

## Observed checkpoint results

- `pnpm test`: 51 passed.
- `pnpm typecheck` and `pnpm build`: passed.
- `pnpm verify`: all four pages passed, with desktop/phone screenshots in both themes and step/motion contact sheets.
- `pnpm verify:controls`: all 27 planted faults caught; the original and editorial clean fixtures passed.
- The local comparison includes the original LRU, the redesigned step 4, a close-up, dark and phone renders, the first eviction, the recap, and the local Anatomy push-button reference. The reference is not included in the project source.

## Desktop composition and minimal-copy checkpoint

The default editorial view now fits in one desktop viewport. Its header is compact; the stage uses the remaining height; the current action sits beside the figure; and the request strip and playback controls stay visible. The duplicate floating change label and default explanatory paragraphs have been removed. Prediction feedback is one short sentence.

Details opens a contained native dialog for the full current caption, model assumptions, legend, provenance and transcript. Opening it pauses playback. Escape closes it and restores focus; its keyboard input does not control the underlying timeline. Expanded content scrolls inside the drawer, without extending the main page.

New verification checks cover all resting steps, prediction answers and four samples per transition at 1440×900 and 1920×1080, in both themes. They reject page overflow and clipped solids or controls. Copy budgets cover the title, action, prediction and feedback. Three additional controls plant desktop scrolling, excessive copy and a non-opening drawer.

Small or unusually short windows retain a readable scrolling fallback. Existing phone checks remain in place; phone-specific layout work is deferred. The rail geometry and motion are unchanged in this checkpoint. Finished reusable parts and stronger focus/reveal behavior remain subsequent review checkpoints.

Review images are in `shots/desktop-review/`: the prior layout, both desktop sizes and themes, prediction feedback, the expanded drawer, start/eviction/recap views, a short-window fallback, and complete step and motion sheets.

Validation for the desktop checkpoint: 51 unit tests, typecheck and build passed; rendered-page verification passed on all four pages; all 30 planted faults were caught and both clean fixtures passed. The served localhost LRU preview was also checked at 1440×900: step link, current action, caption/model agreement, viewport fit and copy budget passed with no browser console errors.

## Reusable rail and surface-finish checkpoint

The rail is now `src/parts/rail.ts`, with parameterized capacity, placement, cell dimensions, slot positions and endpoint anchors. Its housing, pads, guides, open-ended trays and cartridges inherit the same finish. Housing seams, screw seats, guide ticks and recessed floor shading are owned by their solids, so they follow the same motion and painter's order. Foundation and subject styles use roles instead of LRU entity keys. The LRU scene consumes the API; independent review fixtures exercise one, three and six slots without custom CSS.

An early design raised the tray ends. Motion verification found entries passing through those ends while changing recency. The finished trays are open along the travel direction; their side lips retain the fitted appearance without obstructing that motion. This was corrected in geometry, without a depth-order bias or a check exemption.

The new browser audit samples the actual rendered surface paths in each owner's coordinate system at rest and during transitions. It rejects missing finishes and paths leaving their owner's silhouette. Two controls deliberately remove and detach the details. This is a containment check, not proof that every detail has manufacturing realism or that all continuous motion is collision-free. The existing depth/ray and replay checks still run.

Fixtures without a panel no longer fail solely because the optional panel is absent. A short transcript can fit inside Details without needing to scroll; the drawer audit requires a contained, scroll-enabled surface rather than requiring every transcript to overflow it. The long LRU transcript continues to exercise internal scrolling.

### Upstream geometry probe

`node scripts/probe-anatomy.mjs /path/to/anatomy/kit/iso-kit.mjs` probes the installed kit without copying or bundling it. With azimuth 45°, elevation 35.26438968° and scale 0.96824584, its projection matches this engine's fixed isometric projection over 2,079 points to a maximum error of 4.50e-14 world-screen units. `slabOf` supplies four shade layers and a bevel path.

The output is SVG path strings, while this engine carries polygon faces and model dimensions through interpolation, depth sorting and independent ray checks. Camera compatibility alone is not a drop-in renderer adapter. This checkpoint keeps the existing geometry and adds native assemblies and owned surface detail. Upstream lathe/tube capabilities remain candidates for a future shape-record adapter; no upstream implementation is vendored here. This deliberately avoids replacing a tested shape pipeline just to draw another rounded slab.

Review: `node scripts/review-rail.mjs` builds `shots/rail-review/index.html`, with LRU, three capacities, and the saved previous version. It captures light/dark desktop views, both requested desktop sizes for LRU, 4× assembly close-ups, every resting step and ten samples across the hit and first eviction.

Observed results for this checkpoint: 58 unit tests, typecheck and build passed. All four existing pages and all three rail fixtures passed rendered-page verification. All 32 planted faults were caught; both clean fixtures passed. The served 1440×900 LRU preview passed its step-link, copy/viewport and surface checks with no console errors, and its review gallery loaded. A 120-seek browser probe measured 1.8 ms median and 3.5 ms p95 synchronous seek work on this machine; this is not a frame-rate measurement. Both desktop sizes/themes, all capacity specimens, assembly close-ups and the step/motion sheet were visually inspected. The reference remains subject to the user's visual review before broader rollout.

## Retries reference, network parts and toolkit checkpoint

Retries is rebuilt as the second editorial reference from new finished parts (`src/parts/network.ts`): a terminal with a lit status screen, a rack server with rack-unit seams, vents and an activity lamp, a ledger that stacks one coin per charge, a key store, fastened plates, cased cables and message capsules. Each part returns named anchors, and every placement in the scene derives from them. The result is a candidate reference awaiting visual review.

The kit gained turned (faceted) cylinders; side-face panels, vents, seams and lamps; routed cased cables; strip and totals components, which replace LRU-only CSS; and four label rules. A label that does not fit its face is not drawn, optional labels drop where they would sit on a part, leaders leave from the text's nearest edge, and strip chips keep one height.

New checks, each with a planted fault:

- a free label may not lie on a part other than its target;
- the stage keeps one size at every step;
- a hidden face label fails a `text` observation;
- cable ends must sit on a standing part.

That makes 36 planted faults in `verify:controls`, plus the separate plants for the export check (`--plant drop-text`) and the embed check (`--plant-page`). Building the network part tests found floating ledger coins and a server anchor in mid-air, both fixed.

Outputs: `scripts/export-svg.mjs` writes a standalone SVG of any step and compares it with the live stage, by structure and by antialiasing-tolerant pixels; `--plant drop-text` must fail. `src/react/Figure.tsx` wraps `mount()`. Figures are scoped to their root and `mount()` returns `destroy()`. `scripts/check-embed.mjs` embeds three figures, one with maths, in a React app, and fails a planted page-mode figure.

Packaging: `SKILL.md` at the root, `references/` (kit, authoring, craft, verify), `evals/` (five held-out prompts) and `scripts/new-scene.mjs`. A clean copy installed with npm, and a separate project driving the skill by path, both scaffolded, tested, built and verified a new scene.

Still open: attention in the editorial style and parts vocabulary; focus and de-emphasis; the two known LRU issues and back-porting the new finish to the rail; held-out generation runs and the with/without benchmark; and the official `skills-ref` validator, which was not run.

## Visual standard 01 — checkpoint 1 candidate

The [visual specification](VISUAL_STANDARD.md) defines Visualize's own neutral instrument direction: paired graphite/pale materials, blue request/input, amber processing, teal success and red unwanted outcomes; quiet navigation/selection ink; bundled Instrument Sans and IBM Plex Mono; and fixed type, spacing, edge-light and shadow rules. These live in shared tokens/styles rather than a retries-specific skin.

The reference shortens the terminal and server, tightens lane spacing and plate depth, strengthens surface detail, and moves totals clear of the key store. The review presents the lost-response transition, key lookup/divergence, and final charge comparison. Existing model values and event order are preserved. Focus/reveal behavior, dynamic attachment contracts and stronger subject-only composition audits remain later checkpoints.

Font assets carry their OFL notices. Standalone HTML and exported SVG inline them; React/DOM consumers can bundle the local CSS/WOFF2 imports. The player refits an embedded figure after font loading without changing its time or playback. The standalone bootstrap waits for fonts before mounting and emits `visualize:ready` for tooling. Planted faults now initialize on that signal, so they mutate the player rather than racing font loading.

Verification caught a dark waiting-label contrast failure and a narrow-window total/key-tray overlap. Both were corrected without weakening their checks. The new font startup also exposed the fault harness's assumption that the player exists at the window load event; the explicit ready signal fixes that lifecycle mismatch.

`pnpm build && node scripts/review-standard.mjs` writes `shots/visual-standard/`: the interactive three-moment review, saved before/after when available, a live token/type specimen, 1440×900 captures in both themes, 1920×1080 outcome captures and 4× close-ups. The captures were inspected at normal size and close-up. The localhost preview and offline font loading were exercised.

Observed final results: 79 unit tests, typecheck and build passed; all four example pages passed rendered-page verification; all 36 planted faults were caught and both clean fixtures passed. The React embed check passed with both bundled fonts loaded, independent themes, maths, step isolation and cleanup; its planted page-mode figure was rejected. Light/dark SVG exports differed from the live stage at 0.08% / 0.10% of pixels, below the unchanged 0.3% tolerance. The served 1440×900 lookup preview passed desktop/copy checks; both font faces also loaded with the browser offline. Review captures cover the three moments and both themes, both desktop outcome sizes, and 4× front-assembly close-ups. These are verification results for a candidate visual standard, not approval of its appearance.

## Typography refinement

The primary face is now bundled Manrope 400–700, paired with IBM Plex Mono 500 for values. Diagram text has explicit shared roles (`name`, `status`, `value`, `symbol`) rather than selecting type from object keys. Names and screen statuses use consistent medium-weight sans; numerical annotations use tabular mono; identifiers use semibold sans. Solid labels remain centred on their face/screen. The renderer preserves authored text, case and model values. Finished cartridges explicitly declare identifier treatment, while terminal screens declare status treatment.

Retries' display statuses are consistently sentence case: Ready, Waiting, Retrying, Paid and Failed. A browser typography audit checks visible diagram text roles, families, weights and face centring across resting steps and both themes. A planted serif-font substitution must fail that check. The new review can be generated with `node scripts/review-standard.mjs shots/typography`; its saved previous page provides a matched before/after.

The requested Anatomy construction article was read and compared with the installed geometry/motion sources. Application notes are in `ANATOMY_ANALYSIS.md`; recurring visual defects now have an explicit publication-review pass in `references/craft.md`. Proposed richer interactions remain the next checkpoints rather than being presented as already implemented.

Initial typography results, before the screen-plane refinement: 79 unit tests, typecheck and build passed. All four example pages passed, including the new typography check; all 37 fault controls were caught and both clean fixtures passed. React embedding passed, and the updated SVG differed from the live stage at 0.10% of pixels, below the unchanged tolerance. The served typography preview passed viewport, copy and text-role checks, its moment/theme/before-after controls selected the intended state, and both font faces loaded offline. The light/dark moment sheet and close-ups were visually inspected. This remains a review checkpoint before interaction/focus changes.


Close-up review then found that upright screen text could exceed the slanted opening while still fitting its broad bounding box. Screen text now uses the side-face projection, with horizontal and vertical padding. The typography audit tests actual opening containment and the text plane; a new planted flattened-screen style must fail. External names, values and identifiers retain upright treatments. Small-screen labels that cannot fit at a readable size follow the existing hide/transcript policy; existing mobile checks remain in force.


Final screen-placement results: the retries page passed its full resting/motion, layout and typography checks after the correction; all 38 fault controls were caught and both clean fixtures passed. The other three pages had already passed the new font/role checks and have no side-panel text affected by the projection change. React embedding passed. Light/dark SVG differences were 0.10% / 0.11%, within the unchanged tolerance. All 80 unit tests and typecheck passed, including a regression for importing the public kit and compiling a model in Node: the label-ink luminance constant no longer accesses the DOM at module import. Final review captures and the served preview cover the face-aligned status text, consistent values, names and identifiers.

## Quiet page backgrounds

The shared page surface is now warm cream with a near-white card/stage in light mode, and near-black with charcoal surfaces in dark mode. Text and borders follow a warm neutral scale. Materials and semantic colours retain their meanings. The review wrapper and style guide switch their outer backgrounds with the figure theme.

Build, rendered verification of all four pages (including layout, contrast and typography), and the three-figure React embed check passed. Light/dark captures were inspected at normal desktop size. This CSS-only checkpoint did not rerun the unit suite or fault controls from the preceding typography checkpoint.

### Proposed direct interaction checkpoint

Retries is the first candidate: send a payment from the terminal, lose its reply, then retry and observe the ledger. A key toggle selects a new run; selecting the key store reveals its saved response. Each action should dispatch a validated event into the existing pure model, animate the resulting transition, and record an action history for undo, reset, deterministic replay and sharing. The current scripted explanation remains available as a guided example.

LRU can expose clickable requests and capacity changes; attention can expose query selection and vector inputs. Each requires its own domain actions rather than generic dragging. Diagram controls need visible affordances, keyboard equivalents, short model-derived feedback and a single desktop viewport. These interactions are proposals, not implemented in this background checkpoint.
