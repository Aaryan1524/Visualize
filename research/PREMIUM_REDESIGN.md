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
