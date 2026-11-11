# Visualize

An engine for model-driven visual explanations. You write an executable model of an idea and a view that maps its state to drawn marks; the engine handles motion, step-through playback, isometric rendering, linked math panels, standalone export, and checks that what the page shows matches what the model computed.

Early development. See [Plan.md](Plan.md) for the current plan.

## Requirements

- Node.js 24 or newer
- pnpm
- Google Chrome or Chromium (for `pnpm verify`)

## Commands

```sh
pnpm install
pnpm test        # model and engine tests
pnpm typecheck
pnpm build       # standalone HTML pages in dist/
pnpm verify      # headless-browser checks against the model
pnpm verify:controls   # planted faults: proves each check can fail
```

## What `verify` checks

The model runs in Node, separately from the page. Its observations, captions and readouts are compared with what Chrome actually draws:

| Check | How |
|---|---|
| Observations | Each step declares what the reader should see (a value, an order, what is drawn, what is lit); each is read from the rendered page |
| Captions | Caption, readout and trust label match the model at every step |
| Depth order | Wherever solids overlap on screen, the line of sight is ray-cast against the true geometry and compared with the element the browser paints on top, at rest and inside every transition |
| Determinism | A time shows the same page whatever was seen before it |
| Text | 11 px minimum, WCAG contrast against the face or card behind it, in both themes |
| Labels | No overlaps, nothing wider than its face, nothing covered by another solid, nothing outside the card |
| Layout | No sideways scroll at 1280 and 390 px |
| Interaction | Arrow keys, Home, End, Space; reduced motion shows no in-between frames; `#step=` links |
| Console | No errors or uncaught exceptions |

It also writes screenshots and two contact sheets per scene to `shots/`: every step at rest, and every transition at five instants. Compilation and passing checks do not prove the result looks good; read the sheets.
