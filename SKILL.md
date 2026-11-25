---
name: visualize
description: Build interactive, voice-guided visual explanations powered by a Deterministic 2-Engine Studio Kit + Unified Frameless Director Shell + 2 Parallel Fresh-Context Final Verifiers. Every topic is routed automatically to the right medium — Engine A (Three.js Orthographic Matte-Clay 3D CAD for EVERY physical object, machine, fluid/thermal/optical device, hardware, watch, battery, atomizer, or organ) or Engine C (2D Tactile Conceptual Studio with Braun/Rams switchboard strips, milled sliding rails, spring lift-arc motion, and single-active-thread Bézier arcs for algorithms, data structures, protocols, distributed systems, ML/transformers, math, finance, and circuits/logic) — wrapped in one cinema-minimal player with Kokoro voiceover, single-source-of-truth simModel telemetry, Dim & Illuminate, Progressive Reveal, hard max-2 collision-aware callouts, verified "Now You Try" micro-challenges, automated headless Chrome Visual QA, and mandatory dual fresh-context verification (Concept & Physics Auditor + Visual Design Director). Use whenever someone wants an object, physical phenomenon, machine, algorithm, data structure, protocol, distributed system, ML mechanism, or paper explained visually, animated, or step by step. Outputs a standalone offline HTML page.
license: MIT
compatibility: Works in Claude Code, Codex and Antigravity. Needs Node.js 24+ (runs TypeScript directly) and Google Chrome or Chromium for the checks. Run `npm install` (or `pnpm install`) once in this folder.
metadata:
  version: "3.1.0"
---

# Visualize Studio (`v3.1`) — Deterministic 2-Engine Kit + Fresh-Context Verifier Pipeline

Every `/visualize` topic is built by **1 focused Builder** routing to **2 Deterministic Studio Engines** wrapped inside **1 Unified Frameless Director Shell**, verified by headless Chrome, and signed off by **2 Parallel Read-Only Fresh-Context Final Verifiers** before recording offline Kokoro voiceover.

## The 6-Step Studio Pipeline (Claude Code, Codex, Antigravity)

`<skill>` is this repository folder. From ANY one-line user request, execute these steps in exact order:

### Step 1 — Route & Scaffold
Auto-select **Engine A** (3D Physical CAD) or **Engine C** (2D Tactile Conceptual). Pass `--engine A|C` explicitly if the topic is ambiguous or low-confidence:
```sh
node <skill>/scripts/new-studio.mjs <slug> --topic "<user prompt>" --dir <folder> [--engine A|C]
```

### Step 1.5 (MANDATORY) — Read Closest Flagship Scene Before Writing `scene.mjs`
Open and inspect the closest golden reference **before** authoring `scene.mjs` so geometry, camera framing, part registration, and `removeMissing` patterns match the verified baseline:
- **Engine A (3D Physical CAD):** `examples/turbofan-studio/scene.mjs` (rotary / aerospace / mechanical) or `examples/venturi-atomizer/scene.mjs` (vessels / fluids / pistons / sprays).
- **Engine C (2D Tactile Conceptual):** `examples/lru-studio/scene.mjs` (switchboards, sliding rails, lift-arc physics, active threads, `stage.removeMissing`).

### Step 2 — Single Focused Builder (`model.mjs` + `model.test.mjs` + `scene.mjs` + `build.mjs`)
Keep math, geometry, and storyboard tightly coupled in one builder:
- Write pure `simModel(params, variant, t?)` (optional `t` in seconds for cyclic machines) + unit tests (`node --test <folder>/model.test.mjs`).
- Write compact `scene.mjs` (60–140 lines) using only the locked primitives in `references/studio-engines.md`.
- Write `build.mjs` with **5–7 steps** via `studioPage(...)` (`references/studio-director.md`). **Never override variant-controlled keys inside `step.sim`** — let the active variant own its distinguishing parameters across steps!
```sh
node --test <folder>/model.test.mjs && node <folder>/build.mjs
```

### Step 3 — Automated Headless Chrome Content & Visual Gate
Verify offline loading, zero runtime/WebGL errors, valid telemetry, callout budget/bounds, variants, Light/Dark themes, and capture 4 fresh inspection PNGs:
```sh
node <skill>/scripts/check-studio.mjs dist/<slug>.html --shots <folder>/shots
```

### Step 4 — Mandatory 2 Parallel Read-Only Fresh-Context Final Verifiers (NEVER Self-Review!)
Generate 2 ready-to-send verifier prompts + exact `htmlSha256` / `modelSha256` / `shotSha256s`:
```sh
node <skill>/scripts/studio-review.mjs brief dist/<slug>.html --shots <folder>/shots --model <folder>/model.mjs --out <folder>/review.json
```
Dispatch **both** disjoint read-only verifiers **in parallel** with zero prior build context:
- **Claude Code:** `Agent` tool (2 parallel read-only calls)
- **Codex:** `spawn_agent` with `fork_turns="none"` (2 parallel calls)
- **Antigravity:** `invoke_subagent` with `research` (2 parallel calls)
- **Verifier 1 — Concept & Physics Auditor:** audits `model.mjs` + `STUDIO_CONFIG` for real-world accuracy, `simModel` directionality, and narration ↔ telemetry ↔ `tryOut` agreement.
- **Verifier 2 — Visual Design Director:** inspects **ONLY** the 4 fresh PNGs (`step0-light.png`, `step0-dark.png`, `mid-focus.png`, `final-step.png`) — zero code bias.
- **Fix Loop:** Any `blockers[]` triggers fix → rebuild → re-shoot → re-verify (up to `max_rounds = 2`). Non-blocking `nits[]` are logged without blocking.

### Step 5 — Seal & Verify Review Gate (Before Voiceover)
Merge both passing verdicts into `<folder>/review.json` (`"reviewer": "independent"`) and pass the automated gate:
```sh
node <skill>/scripts/studio-review.mjs verify dist/<slug>.html --review <folder>/review.json --shots <folder>/shots
```

### Step 6 — Offline Kokoro Voiceover, Final Build & Fast Gate
Synthesize offline voiceover (`studio-voice.mjs` automatically normalizes `O(1)`, `8:1`, `µm`, `kPa`, `×` for natural speech; skip voice when `--fast` / `--no-voice`), run the final build, and pass the fast gate:
```sh
node <skill>/scripts/studio-voice.mjs --from-html dist/<slug>.html --out <folder>/voice.json
node <folder>/build.mjs && node <skill>/scripts/check-studio.mjs dist/<slug>.html --fast
```

## Studio Manuals (Read Before Your First Build)

- **`references/studio-engines.md`** — Strict 2-Engine routing table (`A` vs `C`), Color Lock, 3D CAD + Volumetric WebGL craft rules, and type-exact cheat-sheets for `engine-a.ts` (all 17 primitives including `airVolume` and `jetPlume`) and `engine-c.ts` (all 5 kinetic primitives + `removeMissing`).
- **`references/studio-director.md`** — `studioPage()` contract (`hint`, outer-margin callout `place`), storyboard schema, `simModel(params, variant, t?)`, variant-key rule, Dim & Illuminate, Progressive Reveal, `tryOut` challenges, and `window.__studio` + `diagnostics()`.
- **`references/studio-qa.md`** — End-to-end QA pipeline, `studio-review.mjs` v3.1 schema (`conceptual` / `visual` with `blockers[]` & `nits[]`, `round`, `max_rounds = 2`, SHA-256 locks), cross-harness verifier dispatch, and failure-recovery triage.

## The Strict 2-Engine Split (`src/studio/router.mjs`)

| Engine | Kit Module | Route Here For | Flagship Examples |
|---|---|---|---|
| **Engine A — 3D Physical CAD Studio** | `src/studio/engine-a.ts` (Three.js Orthographic Matte-Clay + `EdgesGeometry` + `RoomEnvironment` + Volumetric WebGL GLSL Shaders + damped `OrbitControls`) | **EVERY physical object, machine, fluid/thermal/optical device, hardware, watch, battery, atomizer, or organ** — **NO flat 2D drawings for physical objects!** (`cutawayCylinder`, `bladeRing`, `combustorRing`, `shaft`, `pipe`, `spring`, `gear`, `glassVessel`, `liquidVolume`, `pistonPlunger`, `mistCone`, `baseMount`, `flowRibbon`, `airVolume`, `jetPlume`, `boxPlate`, `gasVolume`) | `examples/turbofan-studio/` (`dist/turbofan-studio.html`), `examples/venturi-atomizer/` (`dist/venturi-atomizer.html`) |
| **Engine C — 2D Tactile Conceptual Studio** | `src/studio/engine-c.ts` (Braun/Rams tactile instruments on warm drafting paper: switchboard strips, milled sliding rails with lift-arc spring reorder & drop-off eviction, single-active-thread Bézier arcs — ZERO nested dashed SaaS boxes or badge soup!) | **EVERY conceptual / abstract topic**: algorithms, data structures, protocols, distributed systems, ML/transformers, math, finance, circuits/logic (`strip`, `track`, `arcLink`, `stageNode`, `flowPipe`, `removeMissing`, `hint: ""`, max 1 outer-margin callout with `place: "top"\|"bottom"`) | `examples/lru-studio/` (`dist/lru-studio.html`) |

## Hardcoded "Anti-Slop" Guardrails (Enforced in Code)

1. **Color Lock:** Structural geometry uses only 4 monochrome tokens (`clayLight`, `clayMid`, `clayDark`, `graphite`). Saturated color (`orange`, `cobalt`, `ember`, `teal`, `gold`) is reserved strictly for `focus[]` highlights and invisible forces (airflow, liquid, gas, mist, heat, pressure, electric current, active packets).
2. **Volumetric WebGL Over Rigid Tubes:** Whenever visualizing physical invisible forces in Engine A, **use full WebGL procedural GLSL shaders** — `airVolume()` for wide diffused air/wind/cooling mist (optical rim-depth weighted so cutaway internals stay razor-sharp), `jetPlume()` for strong fiery exhaust/rockets/afterburners (Mach shock diamonds + turbulent shear sheath), volumetric `combustorRing()` flames, `mistCone()` for sprays, and feathered `flowRibbon({ colorStops })` only for narrow channeled conduits/throats. Never draw rigid opaque rods for air or flames, and always adapt shader luminance across Light & Dark themes (`uDarkMode`).
3. **Light-Faithful Dark Mode:** Warm gallery paper (`#f6f5f0`) in Light mode; obsidian studio mat (`#111317`) in Dark mode with luminous 3D matte-clay solids and crisp matte-ivory 2D ceramic tiles.
4. **Single Source of Truth (`simModel(params, variant, t?)`):** One pure function drives animation, quiet monospace telemetry, and verified `tryOut` challenges — zero arithmetic drift or `? %` placeholders.
5. **Hard Label Budget:** `director.mjs` caps callouts at ≤ 2 per step (use ≤ 1 outer-margin callout in Engine C) with 2D AABB repulsion and viewport clamping.
6. **Cinema-Minimal Chrome:** ≥85% unobstructed frameless canvas, Dim & Illuminate on `focus[]`, Progressive Reveal on `reveal[]`, floating subtitle bar, quiet telemetry strip, bottom pill dock (`Play`, presets, `Tune`, `Reset`), and verified "Now You Try" challenges.

---

*Maintaining legacy `v2.0` 2.5D SVG Drawing pages (`examples/escalator/`, `lock/`, `bloom/`, `automatic-watch/`, etc.)? See [`references/legacy-v2-drawing.md`](references/legacy-v2-drawing.md) — never use `v2.0` for new `/visualize` pages.*
