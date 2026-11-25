# Studio QA — Builder + 2 Parallel Fresh-Context Final Verifiers Pipeline

Every Studio page follows one deterministic, end-to-end verified pipeline from a 1-line user prompt to a ship-ready, narrated standalone HTML page.

---

## Why This Orchestration Architecture?

1. **1 Focused Builder (Never Split a Compact Scene):** One Builder writes `model.mjs`, `model.test.mjs`, `scene.mjs`, and `build.mjs`. Splitting a ~250-line visual scene across multiple builders causes part-ID mismatches, anchor drift, and `simModel` vs storyboard inconsistencies.
2. **1 Automated Headless Chrome Gate (`check-studio.mjs --shots`):** Proves offline loading, zero runtime/WebGL errors, valid telemetry, callout budget/bounds, UI clearance via `window.__studio.diagnostics()`, variant separation, theme switching, and captures 4 deterministic PNGs (`step0-light.png`, `step0-dark.png`, `mid-focus.png`, `final-step.png`).
3. **2 Parallel Read-Only Fresh-Context Final Verifiers (`studio-review.mjs`):** The Builder's own eyes are anchored on its own intent. Spawning two **disjoint, fresh-context, read-only** verifiers in parallel catches both subtle domain/physics bugs AND visual framing/aesthetic flaws before Kokoro voice synthesis ever runs.

---

## Stage 1 — Plan, Route & Read Flagship (~30s)

Scaffold the project directory and auto-route to **Engine A** (3D Physical CAD Studio — every physical object, machine, fluid/thermal/optical device, hardware, watch, battery, atomizer, or organ) or **Engine C** (2D Tactile Conceptual Studio — algorithms, data structures, protocols, distributed systems, ML/transformers, math, finance, circuits/logic):

```bash
node scripts/new-studio.mjs <slug> --topic "<user prompt>" --dir examples/<slug> [--engine A|C]
```

*(Pass `--engine A|C` if the topic is ambiguous or `routeTopic` reports low confidence.)*

**Mandatory Step 1.5:** Before writing `scene.mjs`, read the closest flagship scene (`examples/turbofan-studio/scene.mjs`, `examples/venturi-atomizer/scene.mjs`, or `examples/lru-studio/scene.mjs`) to match geometry, camera framing, anchor placement, and `removeMissing` hygiene.

Before writing code, lock a crisp 10-line plan:
- **Core mechanism**: What 1 visual insight makes the concept click?
- **Variants (1–2)**: e.g. `Airliner (8:1)` vs `Fighter (1:1)`, or `Balanced (Cap 4)` vs `Tight Memory (Cap 3)`.
- **Controls (2–3)**: Continuous sliders that visibly morph 3D CAD geometry/flows or 2D tactile instrument state.
- **Telemetry (3–4)**: Quiet monospace KPIs computed directly by `simModel`.
- **Storyboard (5–7 steps)**: Overview → Component breakdown (`focus` + progressive `reveal`) → Invisible forces / causal loop → Final comparison with 1–2 verified `tryOut` micro-challenges.

---

## Stage 2 — Single Focused Builder: Model + Scene + Build (~1–2 min)

1. **Pure Math Model (`<dir>/model.mjs` + `<dir>/model.test.mjs`)**
   - Implement `export function simModel(params, variant, t = 0)` (optional `t` in seconds for cyclic machines) returning every number needed by animation, telemetry, and `tryOut` checks.
   - Run unit tests immediately to lock real-world directionality, monotonicity, conservation, range bounds, and zero `NaN`:
     ```bash
     node --test <dir>/model.test.mjs
     ```
2. **Compact Engine Scene (`<dir>/scene.mjs`, target 60–140 lines)**
   - Assemble strictly from **Engine A** (`src/studio/engine-a.ts`) or **Engine C** (`src/studio/engine-c.ts`) primitives ([studio-engines.md](studio-engines.md)).
   - Respect the **Color Lock** (4 monochrome tones for structure; saturated accents ONLY for `focus[]` and invisible flows/liquid/gas/mist/packets).
   - Register every named part with a well-placed surface/centerline anchor (`stage.registerPart(id, obj, { anchor, accent })`), mechanically connect every 3D sub-assembly, and call `stage.removeMissing(activeIds)` in dynamic Engine C scenes.
   - Drive every visual motion/morph directly from `sim` inside `update(dt, sim, params, step)`.
   - Export `globalThis.STUDIO_SCENE = { mount }`.
3. **Storyboard & Builder (`<dir>/build.mjs`)**
   - Bundle `scene.mjs` via `esbuild.buildSync({ bundle: true, write: false, format: "iife", platform: "browser", target: ["es2022"], minify: true })`.
   - Call `studioPage({...})` ([studio-director.md](studio-director.md)):
     - Set `hint: "Drag to orbit · Scroll to zoom"` (default) for **Engine A**; pass `hint: ""` for **Engine C**.
     - **Never override variant-controlled keys inside `step.sim`**!
     - Use ≤ 2 callouts per step in Engine A; use **≤ 1 outer-margin callout** (`place: "top"` or `"bottom"`) in Engine C.
     - Keep `voice` conditional on `existsSync(join(HERE, "voice.json"))` so Stages 3–5 run cleanly before recording voiceover.

---

## Stage 3 — Automated Headless Chrome Gate & Screenshot Capture (~30s)

Build the standalone HTML and run the headless Chromium verification + screenshot harness:

```bash
node <dir>/build.mjs && node scripts/check-studio.mjs dist/<slug>.html --shots <dir>/shots
```

`check-studio.mjs` verifies automatically across `1440×900` and `1280×800`:
- Standalone HTML loads offline with **zero** console errors, page errors, unhandled rejections, or WebGL context failures.
- `#studio-canvas` renders real non-blank visual content (`>400×300`).
- `window.__studio` + `window.__studio.diagnostics()` sweeps every step, variant, and Light/Dark theme cleanly.
- Every telemetry KPI, subtitle, and challenge renders concrete values (no `NaN`, `undefined`, or `Infinity`).
- Every step obeys the **hard ≤ 2 callouts budget** with zero bounding-box overlap and full viewport containment.
- Captures 4 deterministic inspection PNGs into `<dir>/shots/`:
  - `step0-light.png`
  - `step0-dark.png`
  - `mid-focus.png`
  - `final-step.png`

---

## Stage 4 — MANDATORY 2 Parallel Fresh-Context Final Verifiers (Zero Self-Review)

> **HARD RULE:** The Builder MUST NEVER self-review. After Stage 3 exits `0`, generate the verifier briefs and dispatch **both** fresh-context, read-only verifiers **in parallel** before recording voiceover.

### 4.1 Generate the Verifier Briefs (and Exact SHA-256 Hashes)

```bash
node scripts/studio-review.mjs brief dist/<slug>.html --shots <dir>/shots --model <dir>/model.mjs --out <dir>/review.json
```

This prints the exact `htmlSha256`, `modelSha256`, and `shotSha256s` along with two ready-to-send prompts for the independent verifiers.

### 4.2 Dispatch Both Fresh Verifiers in Parallel (Cross-Harness)

Spawn **two disjoint read-only agents with zero prior build context** at the same time:
- **Claude Code:** call the `Agent` tool twice in parallel (read-only).
- **Codex:** call `spawn_agent` twice in parallel **with `fork_turns="none"`** (strict context isolation so neither verifier inherits build turns; or two fresh read-only `codex exec` runs).
- **Antigravity:** call `invoke_subagent` twice in parallel using the read-only `research` subagent.
- **No subagent tool available:** stop and hand the printed briefs + screenshot paths to the user — **never self-review**.

| Verifier | Inputs (Read-Only) | Scope & Pass Criteria |
| :--- | :--- | :--- |
| **Verifier 1 — End-to-End Concept & Physics Auditor** | `<dir>/model.mjs` + `STUDIO_CONFIG` extracted from `dist/<slug>.html` | 1. Real-world physics / algorithmic accuracy (correct laws, conservation, order of magnitude, no inverted causes).<br>2. `simModel` directionality (sliders & variants move every output in the true physical/algorithmic direction; no variant keys overwritten by `step.sim`).<br>3. Narration ↔ telemetry ↔ `tryOut` challenge alignment (every number spoken matches `simModel` defaults; challenge `checkSrc` is reachable from `controls` / `variants`).<br>4. End-to-end learner sense (steps build one clear causal story with zero jargon gaps or contradictions). |
| **Verifier 2 — Visual Design Director** | **ONLY** the 4 fresh PNGs with vision (`step0-light.png`, `step0-dark.png`, `mid-focus.png`, `final-step.png`) | 1. **3D CAD / 2D Tactile silhouette & framing**: recognizable physical 3D CAD cutaway (Engine A) or calm Braun/Rams tactile instrument (Engine C); zero dead space or edge cropping.<br>2. **Zero floating or clipped parts**: all shafts, blades, pipes, vessels, plungers, or tiles connect physically and stay clear of top bar, subtitle pill, bottom dock, and `Now you try` card.<br>3. **Zero overlapping labels / threads**: ≤ 2 callouts (≤ 1 outer-margin in Engine C), crisp leaders landing on named features, zero crossed active threads or badge soup.<br>4. **Crisp Light & Light-Faithful Dark contrast**: warm gallery paper (`#f6f5f0`) and obsidian (`#111317`) both show bright, legible solids/matte-ivory tiles, vivid saturated invisible forces (`ACCENT_TOKENS`), and clear Dim & Illuminate focus. |

### 4.3 Mandatory Fix Loop (`max_rounds = 2`)

Verifiers classify issues into **`blockers[]`** (must fix before shipping) and **`nits[]`** (non-blocking polish notes logged for reference):
- If **EITHER** verifier returns `status: "fail"` or reports any item in `blockers[]`:
  1. Builder fixes every reported conceptual, physics, framing, or visual blocker.
  2. Rebuild and re-capture fresh screenshots:
     ```bash
     node --test <dir>/model.test.mjs && node <dir>/build.mjs && node scripts/check-studio.mjs dist/<slug>.html --shots <dir>/shots
     ```
  3. Increment `round` (capped at `max_rounds = 2`), re-run `studio-review.mjs brief` (computing the updated `htmlSha256`, `modelSha256`, and `shotSha256s`), and re-dispatch the fresh verifier(s) until **BOTH** `conceptual` and `visual` return `status: "pass"` with `blockers: []`.
- Non-blocking `nits[]` may be recorded in `review.json` without triggering another round.

### 4.4 Write `review.json` & Pass the Automated Review Gate

Merge both passing verifier results into `<dir>/review.json` matching the exact `studio-review.mjs` schema:

```json
{
  "reviewer": "independent",
  "round": 1,
  "sceneId": "<slug>",
  "htmlSha256": "<exact sha256 printed by studio-review.mjs brief>",
  "modelSha256": "<exact model.mjs sha256 printed by studio-review.mjs brief>",
  "shotSha256s": {
    "step0-light.png": "<exact sha256>",
    "step0-dark.png": "<exact sha256>",
    "mid-focus.png": "<exact sha256>",
    "final-step.png": "<exact sha256>"
  },
  "conceptual": {
    "status": "pass",
    "summary": "Verified simModel directionality, narration-telemetry alignment, and reachable tryOut challenge.",
    "blockers": [],
    "nits": []
  },
  "visual": {
    "status": "pass",
    "summary": "All 4 PNGs verified: crisp silhouette, grounded geometry, zero overlaps, high-contrast light and dark modes.",
    "blockers": [],
    "nits": []
  }
}
```

Verify the gate **BEFORE** recording voiceover:

```bash
node scripts/studio-review.mjs verify dist/<slug>.html --review <dir>/review.json --shots <dir>/shots
```

`studio-review.mjs verify` fails if `"reviewer"` is not `"independent"`, if `round` exceeds `max_rounds = 2`, if `htmlSha256`, `modelSha256`, or any entry in `shotSha256s` is stale/mismatched after edits, if either `conceptual.status` or `visual.status` is not `"pass"`, or if any item remains in `conceptual.blockers` or `visual.blockers`.

---

## Stage 5 — Final Kokoro Voiceover, Final Build & Final Fast Gate (~30s)

**Only after `studio-review.mjs verify` exits `0`** (so voice clips are never synthesized twice):

```bash
node scripts/studio-voice.mjs --from-html dist/<slug>.html --out <dir>/voice.json \
  && node <dir>/build.mjs \
  && node scripts/check-studio.mjs dist/<slug>.html --fast
```

*(`studio-voice.mjs` automatically normalizes `O(1)`, `8:1`, `µm`, `kPa`, and `×` for natural pronunciation. Skip `studio-voice.mjs` when the user asks for `--fast` or `--no-voice`.)*

Confirm before delivering:
1. `node --test <dir>/model.test.mjs` passed.
2. `node scripts/studio-review.mjs verify dist/<slug>.html --review <dir>/review.json --shots <dir>/shots` passed on the pre-voice visual build (both `conceptual` and `visual` independent verifiers passed with `blockers: []`).
3. `<dir>/voice.json` was synthesized cleanly (unless `--fast` / `--no-voice`), embedded by the final `node <dir>/build.mjs`, and verified by `node scripts/check-studio.mjs dist/<slug>.html --fast`.

---

## Fast Failure-Recovery Triage

| Symptom | Likely Root Cause | One-Step Fix |
| :--- | :--- | :--- |
| Subject overlaps bottom subtitle / dock | Camera target too high or `zoom` too tight | Shift camera `target[1]` slightly negative (Engine A) or adjust stage `y` / `zoom` (Engine C) and lower `zoom` by `0.1`. |
| Callout chip crosses diagram or collides | Default auto-side placed chip across threads/parts | Set explicit `place: "top" \| "bottom" \| "left" \| "right"` on the callout and move `anchor` to the part's surface/centerline (Engine C: keep max 1 outer-margin callout per step). |
| 3D orbit hint appears on a 2D Engine C diagram | `hint` omitted in `studioPage()` | Pass `hint: ""` in `studioPage({...})` for every Engine C build. |
| Stale threads or nodes linger after switching steps in Engine C | Missing pruning call in `update()` | Track `activeIds` each frame and call `stage.removeMissing(activeIds)` before `stage.render(dt)`. |
| Switching variants resets back when stepping | Variant-controlled key placed inside `step.sim` | Remove variant-controlled keys from `step.sim`; keep them exclusively in `variants[].defaults`. |
| Part stays bright when unfocused (or vanishes) | Custom material bypassed `createClayMaterial` or part missing from `step.reveal` | Build meshes via Engine A primitives / `createClayMaterial`, and include the ID in `step.reveal` (or use `reveal: null`). |
| Telemetry shows blank / `NaN` / `? %` | `simModel` returned missing key or `formatSrc` threw | Verify `simModel` return keys in `model.test.mjs` and test `formatSrc` against every variant's defaults. |
| `tryOut` never verifies | Target threshold unreachable by `controls` min/max or `variants` | Check `controls` bounds + `variants[].defaults` against `tryOut.checkSrc` and adjust thresholds. |
| `studio-review.mjs verify` rejects `review.json` | `htmlSha256`/`modelSha256`/`shotSha256s` stale after edits, `"reviewer"` != `"independent"`, `conceptual` key misspelled, or open `blockers[]` | Rebuild, re-shoot, re-run the fresh verifier on the new HTML/shots, and update `review.json` with fresh hashes and `blockers: []`. |
