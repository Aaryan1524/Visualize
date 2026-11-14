# Handover: Visualize, from 1.0.0 (desktop first) to launch

Read this first, then `.skill-forge/status.md` and `.skill-forge/failures.md`. This document says what exists, what the builder decided, how to work in this repo, and the ordered work that remains before `/visualize` can be launched.

## 1. What this is

Visualize is an installable Agent Skill (the repo root is the skill; `SKILL.md`, `name: visualize`). From a one-line request ("explain how an LRU cache works") a coding agent builds a step-through explanation:

- an executable **model** of the idea, tested against a separately written reference;
- a **view** that maps each model state to keyed marks, drawn by the engine;
- checks (`verify`) that the rendered page shows what the model computed, at every step.

The builder's goal, in their words: "clean & beautiful like Anatomy but in our own way", "a finished premium reusable skill toolkit people can use like Anatomy", and above all that **the reader understands the concept**. The edge over a plain prompt must be visible: a look nobody else makes, a voice that explains and points, and teach-back (What if?, Now you try), all checked against the model.

## 2. Decisions the builder made (do not reopen without asking)

| Decision | Detail |
|---|---|
| Look | **Clay** is the one default look for every figure (soft matte parts, warm table, soft shadows). Paper only on request. **Glass was rejected.** The reference for the look is `research/look-samples/clay.html` (open it). |
| Stage | Real 3D (three.js) with a directed camera: opens on the flat plan view (the diagram the reader knows), moves to each step's focus, ends flat. Isometric SVG stays available but is no longer the default. |
| Title | The header shows only the concept's name (e.g. "LRU Cache") in **Playfair Display SC** (bundled, OFL), with one `about` line under it. The question moves to the Details drawer. |
| Voice | Always available, **on by default**, with a mute. Step 0 explains the concept briefly before anything moves (also written on screen as a card). While the voice is on, **▶ is the narrated tour** and moves on only after each sentence ends. Recorded locally with Kokoro (open source, offline after one download). Browser speech synthesis was rejected as robotic. |
| Voice wording | Each step is recorded in **one pass** (never stitched from sentences). Keys are named in context ("key A is new"). Bare single letters and spelled-out letters ("ay", "see") were garbled; avoid abbreviations ("LRU" is said "least recently used"). |
| Lettering | Text on a top face is printed on the part (a decal), never floated above it. |
| Representation | Build the shape the field already draws (a ring for anything circular, a stock with its refill and gate, a row with pointers on it, a timeline for timing). The kit's parts must not choose the picture. |
| Evals | After each upgrade, run **one** paired eval (with and without the skill) on an unseen prompt, not the full set. If the skill does not clearly win, keep upgrading the kit. Every paid run still needs the builder's yes. |
| First-glance test | Anything shown to the builder (galleries and fixtures included) must be understandable at first glance: a real question, named parts, a small story. |
| Priority | **Desktop first.** Phones after desktop is right. |

## 3. Standing rules for working here

- **Do not push, and do not merge into `main` or any branch, without the builder's explicit OK.**
- **No AI mentions** in commits, code or docs, and no attribution trailers in commits. Product terms ("Agent Skill", "coding agent") are fine.
- Do not edit or commit `research/PREMIUM_READINESS_REVIEW.md` or `.brooks-lint-history.json` (another agent's uncommitted files). Keep `.skill-forge/` uncommitted (excluded in `.git/info/exclude`).
- Gate every commit on **exit codes**, never on grepped output: a commit once landed with failing checks because of this (failures 23 and 40).
- Read the actual screenshots. A passing `verify` proves correctness and mechanical tidiness, not beauty.
- Never send the builder's personal details to external services.

## 4. Where things are

| Path | What it is |
|---|---|
| `SKILL.md` | The skill: governing idea, representation ladder, decision table, workflow, parts, gates. |
| `references/` | `kit.md` (marks, parts, components), `authoring.md` (scene contract, Unfold stage, voice, What if, Now you try), `craft.md` (visual rules with the defect behind each), `verify.md` (every check). |
| `src/core/` | Trace/step model, `compile`, focus (what changed recedes the rest), interpolation, scene types (`look`, `about`, `voice`, `whatIf`, `practice` live in `types.ts`). |
| `src/unfold/stage.ts`, `looks.ts` | The 3D stage: marks to meshes, directed camera, decals, highlight-by-voice, `inspect()` for checks. Looks: clay, paper. |
| `src/render/player.ts` | The page: header, chapters, caption, prediction, panels, voice (▶ tour, mute, intro hold), What if bar, Now you try card. Chooses the 3D stage when `scene.look` is set. |
| `src/render/svg.ts`, `src/iso/` | The isometric SVG stage and its depth sort (round parts are ordered by real footprints). |
| `src/parts/` | Finished parts: `rail.ts`, `network.ts` (terminal, server, ledger, cable…), `flow.ts` (ring, puck, marker, reservoir, source, gate). |
| `src/render/components.ts` | `strip`, `totals`, `sequence` (a flat sequence diagram panel). |
| `scripts/` | `build.mjs` (one standalone HTML per scene; embeds `<scene>/voice/<name>.json`), `verify.mjs` (all checks; 3D pages go through `verifyUnfold`), `voice.mjs` (records narration), `shoot.mjs` (`--scale 4` for close-ups), `export-svg.mjs` (`--frame`), `check-embed.mjs`, `check-reproducible.mjs`, `new-scene.mjs`. |
| `examples/lru-3d/` | **The flagship**: LRU Cache in Clay with voice, prediction and Now you try (plus a Paper variant). |
| `examples/lru`, `retries`, `attention` | Earlier examples on the isometric stage. |
| `test/fixtures/` | `faults/` (planted faults for `verify --controls`), `gallery-ring/` (round robin, with What if), `gallery-flow/` (permit limiter: reservoir, source, gate, sequence). |
| `research/look-samples/` | The builder's chosen reference pages (`clay.html`, `paper.html`, binary search) and their source. These were made by hand and are the quality bar for new 3D parts. |
| `.skill-forge/` | Working state: `status.md` (gates), `failures.md` (every defect and what became of it), `evals/` (SCORING.md and all eval reports), `upstream-from-eval-7/` (a tree part and a min-heap scene built during the last eval, not yet merged into the kit). |

## 5. How to run it

```sh
pnpm install                        # pnpm 11; voice deps' install scripts are declined in pnpm-workspace.yaml (they run without them)
pnpm test                           # unit tests (136 at handover)
pnpm typecheck
pnpm verify                         # every example and gallery, including What if versions and practice questions
pnpm verify:controls                # 48 planted faults must all be caught
pnpm check:embed && pnpm check:reproducible
node scripts/build.mjs examples/lru-3d --out dist && open dist/lru-3d.html
node scripts/voice.mjs <scene dir> [--only <variant>]   # record narration (first run downloads ~90 MB)
```

If `pnpm` refuses to run because of a TTY or corepack check, run the underlying commands from `package.json` directly.

## 6. What has been done (summary by version)

- **0.1–0.2:** trace/marks engine, isometric stage, player, verify with planted faults, LRU, retries and attention; finished network parts; label rules; SVG export; React adapter.
- **0.3:** focus (what changed stays, the rest recedes), decision table, scope tiers, reproducible builds, a CI workflow file.
- **0.4:** after a 10-session eval round the skill lost on clarity 4 of 5: new parts for the shapes fields draw (ring, marker, reservoir, source, gate, sequence panel); caption-clear camera fit; chip clipping check; round-part depth sort; framed SVG export.
- **0.5:** the 3D stage (clay, paper), recorded voice with spoken highlighting, What if?, Now you try, checks for 3D pages.
- **1.0.0 (desktop first):** title in Playfair Display SC; concept intro spoken first and shown as a card; ▶ is the narrated tour; one-pass recording; keys named in context; lettering printed on parts; clay default; `examples/lru-3d` is the flagship. Phone layout started, not polished.

Eval history (all in `.skill-forge/evals/SCORING.md`): round 1 (0.3, 5 pairs) lost on clarity 4/5; round 2 (consistent hashing) right shape but lost; round 3 (min-heap) still lost to a plain agent's flat explorer with tree, array, code and "insert any value".

## 7. Work to launch, in order

Each item has a definition of done. Do them in order; stop and ask the builder at the marked points.

### 7.1 Merge and install (ask first)
- Branch state: `feat/unfold` (61 commits ahead of `main`) contains `feat/canonical-shapes`, `feat/focus-and-flagship` and `feat/premium-redesign`. Another agent once worked on `feat/premium-redesign`; check with the builder before rewriting anything there.
- **Ask the builder** to approve merging `feat/unfold` into `main` (fast-forward or a merge commit; no squash unless asked).
- Install for local use: link or clone the repo as `~/.claude/skills/visualize` (the folder name must equal `name: visualize`), then `npm install` in it. **Ask before writing to `~/.claude`.**
- Done when: a fresh session can run `/visualize explain how an LRU cache works`, the skill loads, and it produces a page that passes `verify`.

### 7.2 End-to-end test in a fresh session
- In a new session, with the skill installed, run `/visualize explain how inserting into a min-heap works`. Do not help it.
- Record every place it struggled (wrong defaults, missing parts, unclear docs) as rows in `.skill-forge/failures.md`, then fix them in the kit or `SKILL.md`.
- Done when: an unaided run builds a clay figure with a voice intro, a prediction and Now you try, and `verify` passes.

### 7.3 Win a head-to-head (needs the builder's yes for the paid runs)
- Run one pair on an unseen concept (with and without the skill), same prompt, same budget. Score reader-first with `evals/README.md` (the first list decides).
- What lost last time: the plain agent showed the tree and the array side by side with the parent link, highlighted the code line being run, and let the reader **insert any value**. Close these gaps first:
  1. **A reader-driven explorer**: the reader types or picks an input; the model re-runs and the figure plays it (combine `whatIf` and `practice`; generate scenes from the input at runtime, verify a sample of inputs).
  2. **The model's own steps beside the picture**: a code or rule panel whose current line lights as the step plays (a `place: "side"` panel driven by the step).
- Done when: the skill clearly wins the pair on what the reader gets, and the scoring says why.

### 7.4 3D-native parts (so every concept looks like the clay sample)
- The flagship looks right because it was tuned; new concepts reuse isometric-era parts (rails, trays, feet) and look busier. Build clay-grade parts with the sample as the bar (`research/look-samples/clay.html`): big soft keys on one slab, ring, tree (start from `.skill-forge/upstream-from-eval-7/tree.ts` and its tests), bucket and gate, node for systems.
- Each part: one-piece silhouettes, depth that carries meaning (what matters lifts, what drops out sinks), lettering as decals, part tests (no interpenetration, supported, anchors on surfaces) and a gallery fixture that passes `verify`.
- Also upstream from eval 7: the cylinder label-height fix (`.skill-forge/upstream-from-eval-7/svg.diff`) and the dark-theme heading ink on 3D stages.
- Done when: a figure built only from kit parts for a new concept looks like the sample at 1× and at 4× (judge with the builder).

### 7.5 Voice without extra setup
- Today an agent must write `voice()`, then run `scripts/voice.mjs` (one-time ~90 MB model download), and clips are compressed with macOS `afconvert`; elsewhere they stay WAV and pages get large.
- Make it simple: record automatically as part of `build.mjs` when a scene has `voice()` and no current recording (hash the script text to know when to re-record); compress cross-platform (an `ffmpeg`-free option: encode to Opus or MP3 in Node, e.g. a WASM encoder); record What if versions too (they are currently silent).
- Keep: one pass per step, silence at both ends, keys named in context, no bare letters or abbreviations. The builder judges the sound; you cannot hear it, so ask them to listen.
- Done when: `node scripts/build.mjs <dir>` alone produces a page with a voice on macOS and Linux, and the page stays under ~3 MB.

### 7.6 Checks and CI for 3D
- `verifyUnfold` today checks text and visibility observations, captions, framing (coverage), label overlap and cut-off, determinism and console. It does **not** check: `extent`, `tone`, `order`, `lit` observations, contrast (both themes), phone layout, copy budget, the prediction pause, or that ▶ waits for each clip.
- Add each with a planted fault in `test/fixtures/faults` and an entry in `CONTROLS` (`scripts/verify.mjs`), so `pnpm verify:controls` proves it can fail.
- Run CI on GitHub (`.github/workflows/ci.yml` exists but has never run; it needs Chrome and must skip the voice download). **Pushing needs the builder's OK.**
- Done when: CI is green on `main`, and every 3D check has a caught planted fault.

### 7.7 Phones (after desktop is right)
- Started: the 3D stage gets its own block under the step caption on narrow screens, and text buttons wrap. Still open: labels near the edge get cut, the controls row is crowded, and the concept card placement needs a phone layout.
- Done when: the flagship passes a phone pass of the 3D checks at 390 px in both themes, and the builder approves a phone screenshot.

### 7.8 Launch
- Version, changelog line per failure fixed, README with images of the flagship and a real one-line prompt, install instructions that work from a clean machine, `skills-ref validate` (the official validator; it was blocked from running here, so run it where allowed).
- Done when: a stranger can install it and get a good figure from one line in five minutes, on desktop.

## 8. Pitfalls already paid for

- **Voice:** stitching sentences cut words; tight silence trimming clipped endings; timed autoplay overlapped sentences with the next step; the first click armed the voice and moved on in the same instant (the intro never played); ▶ and the tour once played the first clip twice. All fixed; keep the tests in mind (log `play`/`ended`/`pause` events in headless Chrome, as in the fixes).
- **Letters:** the voice model garbles single capitals and spelled letters. Name keys in context.
- **Framing:** a single stray part fooled a span-based framing check; coverage is used now (40%, or 30% in the flat opening and closing views).
- **pnpm 11** refuses to install until each dependency's build scripts are approved or declined; the voice deps are declined in `pnpm-workspace.yaml`.
- **Determinism:** compare 3D state by key, not DOM order.
- **Evals:** the 0.3 rubric only checked that the skill was followed, so the skill "won" while teaching worse. Score what the reader gets first.

## 9. Open questions for the builder

- Approve merging `feat/unfold` into `main`, installing to `~/.claude/skills/visualize`, and pushing for CI.
- Approve the paid sessions for the next head-to-head.
- Does the "key A" voice sound right? (Only the builder can judge.)
