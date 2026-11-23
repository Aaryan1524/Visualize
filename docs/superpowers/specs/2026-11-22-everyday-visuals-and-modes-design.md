# Visualize v1.2 Design: Everyday Real-Object Visuals & Dynamic Modes

## Why
Everyday and college-level learners asking *"how does a watch work?"* or *"how does a perfume bottle spray?"* currently hit two barriers in Visualize v1.1:
1. **Binary visual routing (`machine` vs `concept`)** forces physical concepts into abstract data-structure boxes (`cellDrawing`) instead of showing the recognizable real object (a watch dial + spring, a perfume bottle spraying mist) alongside a plain-English explainer card.
2. **Engineering-manual defaults + ~25–30 min runtime** push jargon/SI units (`N·mm`, `isochronism`, `4 Hz`) onto beginners and offer no fast visual mode.

## Goals
- **Default (`everyday`)**: Best 3D studio visual (**real object first** whenever the subject is physical, paired with a crisp side explainer card), **simple college-level plain English** backed by a real tested model, **voice narration ON by default**, 5–7 steps, Predict + Lab.
- **4 Composable Modes** (flags + natural-language triggers):
  - `everyday` (default): Real-object visual, plain language, voice ON, 1 core variant, full review.
  - `--fast`: Quick less-detailed visual (~3–4 min), 4–5 steps, no voice, no What-if, `--fast` checks + light/dark sanity shots.
  - `--technical`: Engineering/concept rigor — exact SI units, equations on stage, What-if variants, strict domain audit.
  - `--deep`: 4–6 chapters, 14–20 steps, highest visual detail, full voice, per-chapter Predicts, parallel dual-specialist review.
- **Reusable Real-Object 3D Kit (`src/rig/objects.ts` + `src/rig/rig.css`)** + **`--kind object` scaffold (`new-figure.mjs`)** + flagship proof (**Perfume Atomizer**, `examples/perfume-atomizer/`).
- **Zero regressions** across all existing `v1.1.0` tests, typechecks, and shipped Drawing pages.

## Chosen Approach (Option B)
Build reusable 3D everyday physical primitives directly on `src/rig/shapes.ts` & `draw.ts` (`src/rig/objects.ts`), add everyday studio materials (`glass`, `liquid`, `mist`, `rubber`, `wood`) and fix dark-mode `data-t-bad` tokens in `src/rig/rig.css`, add `--kind object` & `--mode` support to `new-figure.mjs`, add `--fast` / `--mode` support to `check-drawing.mjs`, `shoot-steps.mjs`, and `review-brief.mjs`, update `SKILL.md` + references, and ship `examples/perfume-atomizer/` as the everyday flagship proof.

## Frozen Module Contract (`src/rig/objects.ts`)
- `OBJECT_VIEW = { azimuth: 238, elevation: 22 }`
- `vesselShell(cam, { r, h, neckR?, neckH?, shoulderH?, wall?, cutaway?, material?, segments? })`
- `liquidColumn(cam, { r, h, z0?, material?, segments? })`
- `dipTube(cam, { r, z0, z1, offset?, material? })`
- `plungerNozzle(cam, { r, h, spoutLen?, spoutDir?, material? })`
- `sprayCone(cam, { origin, dir, length, spreadDeg?, intensity?, seed?, droplets? })`
- `watchCaseDial(cam, { r, h?, lugs?, cutaway?, bezelMaterial?, dialMaterial? })`
- `watchHand(cam, { len, width?, tail?, z?, material? })`
- `coiledSpring(cam, { rInner, rOuter, turns, z?, thickness?, material? })`
- `explainerCard(cam, { at, title, rows, badge?, tone?, width? })`
- `meterBar(cam, { at, w, h?, fraction, label, valueText?, tone? })`

## Zero-Overlap Parallel Execution Plan
- **Wave 1 (3 parallel agents, disjoint files):**
  - **Agent A (Object Rig):** `src/rig/objects.ts`, `src/rig/objects.test.ts`, `src/rig/rig.css`, `src/rig/index.ts`
  - **Agent B (Mode Tooling):** `scripts/check-drawing.mjs`, `scripts/shoot-steps.mjs`, `scripts/review-brief.mjs`, `scripts/review-brief.test.mjs`
  - **Agent C (Skill & Docs):** `SKILL.md`, `references/objects.md`, `references/figures.md`, `README.md`, `CHANGELOG.md`
- **Wave 2 (2 parallel agents, disjoint files, after Wave 1 typecheck + tests pass):**
  - **Agent D (Object Scaffold):** `scripts/templates/object/*`, `scripts/new-figure.mjs`, `scripts/new-figure.test.mjs`
  - **Agent E (Flagship Perfume Atomizer):** `examples/perfume-atomizer/*` + independent parallel review
- **Wave 3 (Integration & Release):**
  - Wire `perfume-atomizer` into `package.json` `check:drawing`, capture `.github/assets/perfume-atomizer.jpg`, bump `package.json` to `1.2.0`, run full suite + CI PR + publish `v1.2.0`.
