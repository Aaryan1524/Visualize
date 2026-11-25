# Studio Director — Unified Frameless Shell & Storyboard Contract

`src/studio/director.mjs` compiles your math model, engine scene bundle, storyboard beats, and offline Kokoro voiceover into **one standalone, zero-external-dependency HTML file** with Cinema-Minimal chrome, Dim & Illuminate focus, Progressive Reveal, collision-free callouts, and live-verified micro-challenges.

---

## 1. `studioPage(options)` Contract

```js
import { studioPage } from "../../src/studio/director.mjs";

const html = studioPage({
  title: "How a Jet Engine Works",
  about: "High-bypass cutaway turbofan · Interactive 3D CAD studio",
  hint: "Drag to orbit · Scroll to zoom", // default for Engine A; pass "" for Engine C!
  sceneId: "turbofan-studio",
  themeDefault: "light", // "light" | "dark"
  variants: [
    { name: "airliner", label: "Airliner (8:1)", defaults: { bypassRatio: 8, throttlePct: 85 } },
    { name: "fighter",  label: "Fighter (1:1)",  defaults: { bypassRatio: 1, throttlePct: 85 } },
  ],
  controls: [
    { id: "throttlePct", label: "Throttle",     min: 20, max: 100, step: 1, unit: "%" },
    { id: "bypassRatio", label: "Bypass ratio", min: 1,  max: 10,  step: 1, unit: ":1" },
  ],
  telemetry: [
    { id: "bypassRatio",   label: "Bypass",   formatSrc: "(s) => `${s.bypassRatio}:1`" },
    { id: "fanPushPct",    label: "Fan push", formatSrc: "(s) => `${s.fanPushPct}%`" },
    { id: "corePushPct",   label: "Core jet", formatSrc: "(s) => `${s.corePushPct}%`" },
    { id: "squeezeFactor", label: "Squeeze",  formatSrc: "(s) => `${s.squeezeFactor}×`" },
  ],
  steps: STEPS,
  voice: VOICE,        // parsed voice.json or null before recording
  modelSrc,            // raw JS source defining `function simModel(params, variant, t?)`
  engineBundle,        // esbuild IIFE bundle of scene.mjs + engine-a.ts or engine-c.ts
});
```

### Top-Level Options Reference

| Option | Type | Required | Notes |
| :--- | :--- | :---: | :--- |
| `title` | `string` | Yes | Page `<title>` and top-left `<h1>`. Keep concise (3–6 words). |
| `about` | `string` | No | Quiet single-line caption under `title`. |
| `hint` | `string` | No | Subtle interaction hint under `about`. Defaults to `"Drag to orbit · Scroll to zoom"` (ideal for **Engine A** 3D CAD stages). Pass `hint: ""` for **Engine C** 2D tactile stages so no 3D orbit text is rendered. |
| `sceneId` | `string` | Yes | Slug written to `body[data-scene]` and `window.__studio.state().sceneId`. |
| `themeDefault` | `"light" \| "dark"` | No | Defaults to `"light"`. Users and QA can toggle anytime (`D` or `#theme=dark`). |
| `variants` | `{ name, label, defaults? }[]` | No | What-if preset pills in the bottom dock. Keys whose defaults differ across variants persist automatically when stepping through the story — **never override variant-controlled keys inside `step.sim`**! |
| `controls` | `{ id, label, min, max, step?, unit? }[]` | No | Live sliders tucked inside the collapsible **Tune** drawer (`T`). Values 0–1 with `unit: "%"` auto-format as `0%–100%`. |
| `telemetry` | `{ id, label, formatSrc? }[]` | No | 2–4 quiet monospace KPIs in the top-right strip. `formatSrc` (string or function) receives `(sim, params, variant)` and returns a formatted string. |
| `steps` | `Step[]` | Yes | 5–7 storyboard beats (schema below). |
| `voice` | `object \| null` | No | Parsed JSON from `scripts/studio-voice.mjs` (`{ variants: { [name]: [{ text, audio, type, duration }] } }`). |
| `modelSrc` | `string` | Yes | Raw JS string defining `function simModel(params, variant, t?)`. Leading `export` keywords are stripped automatically. |
| `engineBundle` | `string` | Yes | Browser IIFE bundle (via `esbuild.buildSync`) that assigns `globalThis.STUDIO_SCENE = { mount }`. |

---

## 2. Step Storyboard JSON Schema

Every entry in `steps[]` follows this exact contract:

```js
{
  step: 4,                                // 0-based step index
  tab: "Squeeze & burn",                  // 1–3 words for top step pill
  title: "30× compression and steady burning", // headline tooltip & QA state title
  narration:
    "Inside the core, tight spinning compressor blades squeeze the incoming air thirty times tighter. Then fuel sprays into the glowing annular burner ring, where it burns steadily and expands outward with huge force.",
  focus: ["compressor", "combustor", "core_flow"], // string[] | null (null = all neutral)
  accents: { compressor: "gold", combustor: "ember", core_flow: "ember" }, // optional per-part AccentKey overrides
  reveal: ["fan", "core_casing", "compressor", "combustor", "turbine", "shaft", "core_flow"], // string[] | null
  camera: { preset: "core_burner", zoom: 1.52 },   // named camera preset + optional zoom multiplier
  sim: { throttlePct: 100 },              // step parameter overrides — NEVER override variant-controlled keys!
  callouts: [                             // HARD BUDGET: MAX 2 per step (MAX 1 outer-margin in Engine C)!
    { target: "compressor", label: "30× axial compressor", place: "top" },
    { target: "combustor",  label: "Steady annular burner", place: "bottom" },
  ],
  tryOut: null,                           // or { prompt, checkSrc, successText }
}
```

> **Variant Key Rule (`step.sim`):** Never put a variant-controlled parameter (any key whose value differs across `variants[].defaults`, such as `bypassRatio` or `capacity`) inside `step.sim`. Doing so fights the user's active What-if preset when stepping through the story. Keep `step.sim` strictly to step-specific progression parameters (e.g. `throttlePct`, `opIndex`, `phase`).

### Callout `place` Property (Outer-Margin Placement)

Each item in `steps[].callouts` accepts an optional `place` hint controlling which outer side of the target anchor the callout chip sits on:

| Value | Placement | Best For |
| :--- | :--- | :--- |
| `"top"` | Centered cleanly **above** the anchor (`ay - 52 - h`) | Top switchboard strips (`Engine C`), upper housings (`Engine A`) |
| `"bottom"` | Centered cleanly **below** the anchor (`ay + 46`) | Lower sliding rails / eviction edges (`Engine C`), under-slung components (`Engine A`) |
| `"left"` | Offset to the **left** margin (`ax - 54 - w`) | Intake / left-edge anchors (`Engine A`) |
| `"right"` | Offset to the **right** margin (`ax + 54`) | Exhaust / nozzle / right-edge anchors (`Engine A`) |
| *(omitted)* | Automatic side selection away from viewport center + 2D AABB repulsion | Default for 3D orbiting rigs (`Engine A`) |

> **Engine C Rule:** Use **at most 1 callout per step** with `place: "top"` or `place: "bottom"` on an outer margin anchor so the callout chip and leader line never cross active tiles or Bézier tension threads.

### `tryOut` Micro-Challenge Schema

Include **1–2** verified micro-challenges on synthesis or final comparison steps:

```js
tryOut: {
  prompt: "Switch to Fighter (1:1) below and open Tune to push Throttle past 90% — watch the core jet take over thrust.",
  checkSrc: "(sim, params, variant) => sim.bypassRatio <= 2 && sim.throttlePct >= 90",
  successText: "Verified! At 1:1 bypass and ≥90% throttle, the nacelle slims down and the blazing core jet delivers 65% of thrust.",
}
```

- `checkSrc` may be a function or stringified arrow function receiving `(sim, params, variant)` and returning a boolean.
- Prefer testing `sim.*` (the Single Source of Truth output) rather than raw DOM state.

---

## 3. The 4 Automatic Director Behaviors

1. **Dim & Illuminate**
   - When `step.focus` is an array of part IDs, the Director calls `controller.setFocus(step.focus, step.accents)` so focused parts stay crisp and accent-tinted while all non-focused parts automatically dim into quiet background monochrome.
   - When `step.focus` is `null` (typically overview & final comparison steps), the entire assembly renders in balanced architectural monochrome with live saturated flows/packets.

2. **Progressive Reveal**
   - `step.reveal` lets you build up an architecture layer-by-layer OR peel back outer shells (e.g., hiding `nacelle` on a macro core step) via `controller.setReveal(step.reveal)`.
   - Pass `reveal: null` or `ALL_PARTS` to show the full assembly.

3. **Cinema-Minimal Chrome (≥85% Unobstructed Canvas)**
   - **Full-bleed stage** (`100vw × 100vh`) with embedded `Manrope` + `IBM Plex Mono` fonts (zero CDN requests).
   - **Top translucent bar**: title/about (left), numbered step pills (center), quiet monospace telemetry strip + Dark/Light & Sound toggles (right).
   - **Collision-aware callouts**: hard-capped at **max 2** per step (`normalizeSteps` slices to 2). Deterministic 2D AABB repulsion keeps chips separated and draws hairline elbow leaders + halo dots to each part's `getCalloutPos(target)`.
   - **Floating subtitle bar**: displays spoken narration with a live playback progress bar; click to collapse (`CC`).
   - **Bottom pill dock**: `Prev / Play / Next`, variant preset switcher, collapsible `Tune` drawer (closed by default), `Challenge` jump toggle, and `Reset` camera.
   - **Keyboard & Deep-Link support**: `←/→` steps, `Space` play/pause, `T` Tune, `D` Dark/Light, `M` mute, `R` reset view; URL hash `#step=3&theme=dark&variant=fighter`.

4. **Verified "Now You Try" Micro-Challenges**
   - When playing narrated steps, the Director **automatically pauses** at the end of any step with an unverified `tryOut` card.
   - Every slider drag or variant click re-runs `simModel` and re-evaluates `checkSrc(sim, params, variant)`.
   - Once `true`, the card marks `data-verified="true"`, shows `✓ Verified` + `successText`, and highlights `Continue →`.

---

## 4. Single Source of Truth (`simModel`)

**One pure function in `model.mjs` drives everything:**

```js
export function simModel(params, variant, t = 0) {
  // Pure, deterministic math — zero DOM, zero randomness, zero NaN.
  // Optional 3rd argument `t` (elapsed seconds) supports cyclic machines
  // (4-stroke pistons, pumps, heartbeats, waves, escapements) while keeping
  // static/stateful models working identically with `simModel(params, variant)`.
  return { bypassRatio, throttlePct, fanPushPct, corePushPct, squeezeFactor, fanSpeed, burnerGlow };
}
```

The Director automatically feeds the exact same `sim` object from `simModel(params, variant, t)` into:
1. **Scene animation**: `controller.update(dt, sim, params, step)`
2. **Telemetry strip**: `telemetry[i].formatSrc(sim, params, variant)`
3. **Micro-challenges**: `tryOut.checkSrc(sim, params, variant)`

**Rules:**
- Never hardcode telemetry strings or display `? %` / `NaN` / `undefined`.
- Never override a variant-controlled parameter inside `step.sim`.
- Keep all numbers cited in `narration` and `callouts` consistent with `simModel` defaults (verify with unit tests in `model.test.mjs`).
- For cyclic machines accepting `t`, make sure `simModel(params, variant, 0)` (and omitting `t`) produces valid, non-`NaN` resting/reference telemetry values.

---

## 5. Offline Kokoro Voiceover Workflow

Record narration **only after** visual QA and `studio-review.mjs verify` pass so you never re-synthesize clips twice:

```bash
# 1. Extract steps & variants from built HTML and synthesize offline Kokoro audio clips
#    (automatically normalizes O(1), 8:1, µm, kPa, × for natural pronunciation)
node scripts/studio-voice.mjs --from-html dist/<slug>.html --out <dir>/voice.json

# 2. Rebuild standalone HTML with embedded base64 voiceover
node <dir>/build.mjs
```

In `build.mjs`, load `voice.json` conditionally so the build works cleanly both before and after voice recording:

```js
const voicePath = join(HERE, "voice.json");
const VOICE = existsSync(voicePath) ? JSON.parse(readFileSync(voicePath, "utf8")) : null;
```

When `voice` is `null` or Sound is muted, the Director falls back to a smooth timed subtitle progress loop (`~5.5s` per beat) so playback always works offline.

---

## 6. Headless QA Bridge (`window.__studio`)

Every built Studio page exposes a deterministic API for automated inspection, diagnostics, and screenshot capture (`scripts/check-studio.mjs`):

```js
window.__studio.steps             // normalized Step[]
window.__studio.currentStep       // number
window.__studio.variant           // string
window.__studio.seekStep(k)       // jump to step k (pauses audio, applies camera/focus/reveal/sim)
window.__studio.setVariant(name)  // switch what-if variant
window.__studio.setSim(patch)     // merge live slider overrides & re-run simModel + challenge check
window.__studio.setTheme(t)       // "light" | "dark"
window.__studio.toggleControls(b) // open/close Tune drawer
window.__studio.state()           // { sceneId, step, stepTitle, variant, theme, playing, soundOn,
                                  //   controlsOpen, captionsOpen, params, sim, telemetry,
                                  //   callouts, challenge: { active, verified, prompt } }
window.__studio.diagnostics()     // { engineKind, registeredIds, cameraPresets, variantKeys,
                                  //   controls, stepsMeta, compileErrors, runtimeIssues }
                                  // used by check-studio.mjs to catch unknown IDs, missing presets,
                                  // step.sim overrides of variantKeys, and runtime/compile errors
```
