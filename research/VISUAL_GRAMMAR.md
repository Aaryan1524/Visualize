# Visual grammar

The visual languages this engine supports today, the motion vocabulary, and the rules learned from building and checking three scenes. Each rule records why it exists, so it can be dropped when the reason no longer holds.

## Two spaces

| Space | Draws | Why |
|---|---|---|
| **Isometric stage** (SVG, fixed 30° projection) | Entities as solids (boxes, cylinders) on a ground plate; floor lines; labels | Depth separates groups (lanes, rows, worlds); solids carry magnitude as height; motion reads as physical |
| **Flat panels** (HTML) | Equations (KaTeX), number grids, rules, event logs, counts | Text and numbers must be crisp and readable; maths has no natural isometric form |

The two are linked by entity ids. Pointing at an element lights every element whose ids contain its ids or are contained by them.

## Visual languages in use

| Language | Encoding | Example |
|---|---|---|
| **Temporal** | One step per event, a caption per step, a pure timeline | All three |
| **Ordering** | Position along a rail means rank | LRU recency rail |
| **Magnitude** | Solid height is a number, checked with `extent` observations | Attention vector bars and gauges |
| **Transformation** | The same mark morphs through representations: score, then scaled score, then weight | Attention gauges |
| **Flow** | A mark travels between actors along a visible path; floor-line thickness shows weight | Retries messages; attention reach lines |
| **Counterfactual** | Two lanes, the same script, one premise changed, divergence called out | Retries |
| **Evidence and trust** | A trust badge per step; sourced steps link to the source location | Attention §3.2.1 |

## Motion vocabulary

| Motion | Meaning | Mechanism |
|---|---|---|
| Move | Same entity, new place or size | Keyed interpolation between steps |
| `enter: drop` / `grow` / `fade` | Comes into being: loaded, computed, created | Enter phase, after exits |
| `exit: fall` / `lift` / `fade` / `shrink` | Ceases to exist here | Exit phase, before entries |
| `leaving` | Goes somewhere specific as it ceases: evicted off the cold end, consumed, delivered | Interpolates to the declared target, then fades |
| `arc` | Passes over others rather than through them | A hop that peaks mid-move |
| `transient` + `travel` | An operation in flight that exists only during the step | Drawn only while transitioning |
| `effect: pulse` / `shake` | Momentary emphasis, such as a key found or a failure | Self-cancelling; a pulse grows from its base |

Phases order the motion: exits finish before entries begin, so a slot is never held by two things at once.

## Rules learned

| Rule | Why (what went wrong without it) |
|---|---|
| Every number on the page comes from the model and is declared as an observation | Otherwise nothing ties the picture to the truth; `verify` refuses scenes with no observations |
| Claims about anything outside the model are computed, not written | The LRU caption claimed a FIFO comparison that was false after the histories diverged |
| Keep the source's hedges | "We suspect…" became a statement of fact in a sourced caption |
| Sizes that encode numbers are declared with `extent` | Heights were the main encoding in attention and were initially unchecked |
| "Visible" means seen, not present | A message hidden behind a server passed a presence check |
| Labels go on a face that nothing sits on (`labelFace`) | Labels on stacked tops were covered |
| Label ink is chosen by measured contrast with its face | White on light tops failed 4.5:1; one fixed rule failed some tone in some theme |
| Put moving things on a visible path in front of what they connect | Messages at mid-depth were hidden by the actors |
| Floor lines belong on the ground plate, under what stands on it | They were drawn under the base plate and vanished |
| A flat variant may need a different layout | A front view collapses depth, so lanes in depth overlap |
| Panels contain their own overflow | A table of nine requests widened the page on a phone |

## Known gaps

- **Detail density:** solids are plain boxes and cylinders with three shades. There are no bevels, seams or rounded plans.
- **Responsive composition:** wide scenes shrink on phones instead of re-arranging.
- **Camera motion:** the camera is fixed per scene. Overview-to-detail moves are not supported.
- **Colour:** tones are semantic, but nothing checks that a colour means what the legend says.
