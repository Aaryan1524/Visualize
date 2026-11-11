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
```
