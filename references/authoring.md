# Authoring a scene

A scene is a module with a default export from `defineScene`. Start from `node scripts/new-scene.mjs <name>`, which builds and verifies as generated.

```ts
export default defineScene<State, Event>({
  id: "lru", title: "LRU cache", question: "Why not drop the oldest?",   // question: at most 8 words
  presentation: "editorial",                 // figure-first desktop layout
  setup: "One sentence shown in Details.",
  trust: "computed",                         // sourced | computed | model | analogy | unverified
  assumptions: ["What the model simplifies…"],
  trace: () => ({ initial, intro: "…", steps: [{ event, state, caption: "…", trust?, source? }] }),
  view: (state, event) => marks,             // parts; keys are model entity ids
  teaching: (state, event, index) => ({ chapter, heading, prediction? }),
  observe: (state, event, index) => observations,
  panels: (state, event) => [{ key, title, html }],   // usually strip() + totals()
  readout: (state) => "one line in the model's units",
  timing: (event) => ({ duration: 1300 }),
  legend: [{ tone: "good", label: "Hit: read from the cache" }],
});
```

## The model

- Pure functions; the state after every event; no randomness unless it is seeded.
- A test against a separately written reference implementation, edge cases, and properties over generated inputs. For example, `examples/retries` checks all 64 loss patterns.
- Choose inputs so the cases worth seeing actually happen, and assert that they do in a test.
- A claim about anything outside the model is computed, not written. The LRU caption compares with FIFO only where a real FIFO run holds the same keys.

## Teaching beats

- **Chapters:** 3–5 short names (Fill, Refresh, Evict, Remember). They become the navigation.
- **Heading:** one action per step, 12 words at most: "B leaves. D enters."
- **Prediction:** at most one or two per scene, just before the causal moment. Give the question (12 words or fewer), the choices, the answer, and an explanation that states the answer: "2: without a key, the retry looks like a new payment." Playback pauses there, and Next waits for an answer.
- Captions, assumptions, sources and the transcript live in the Details drawer. Paragraphs never appear on the figure.

## Observations

| Type | Asserts |
|---|---|
| `text` | the visible text of the element keyed `key` equals the model value |
| `order` | keys appear in this order along screen `x` or `y` |
| `visible` | the element can be seen: unobstructed at 15% or more of its area, or not drawn at all |
| `extent` | a solid is drawn at the world size `[w, d, h]` (cylinders `[2r, 2r, h]`), with `radius` for rounded boxes |
| `tone` | its semantic tone equals the model's |
| `lit` | it is the highlighted one |

Declare every value shown, every size that encodes a number, every outcome that must be visible, and everything that must be gone. A scene with no observations fails verification.

## Trust

Every step carries a trust level shown with the action. Use `sourced` only with a `source: { label, url }` for the exact location, and keep the source's hedges ("the authors suspect…").

## Outputs

- **Standalone page:** `node scripts/build.mjs <dir>` writes `dist/<id>.html`, one file that opens from disk.
- **SVG of one step:** `node scripts/export-svg.mjs dist/<id>.html --step k --out f.svg [--frame] [--theme dark]`. `--frame` adds the title, the step's action and the legend around the drawing, for an image that must read on its own. Every style is resolved onto its element (inherited values are left out). The file is opened alone and compared with the live stage, both by structure (labels, shapes) and by pixels.
- **React:** import the component and your scene by path from the skill folder, and bundle them with any TypeScript-aware bundler (esbuild, Vite, Next.js). This is the route `pnpm check:embed` tests (`test/embed/app.tsx`).

  ```tsx
  import { Figure } from "<skill>/src/react/Figure.tsx";
  import scene from "./explanations/my-scene/scene.ts";
  <Figure scene={scene} theme="dark" onReady={(player) => player.seekStep(4)} />
  ```

  Load `<skill>/src/render/styles.css` once. Scenes with equations also need `katex/dist/katex.min.css`, served with its `fonts/` folder beside it. Figures are scoped to their own root: several can share a page, they do not touch the URL or globals, and unmounting removes them. `pnpm check:embed` proves this with three figures, one of them with maths, and a planted page-mode figure that must fail. The package is not published to npm.
- **Plain DOM:** `mount(host, scene, { theme? })` returns a player with `seek`, `seekStep`, `play`, `pause` and `destroy`. Pass `{ page: true }` only for a standalone page that owns the URL.

## The Unfold stage, voice and teach-back

```ts
export default defineScene({
  ...scene,
  look: "paper",                       // or "clay"; omit for the isometric SVG stage
  voice: (s, e, k) => !e ? "Here's a cache with room for three keys..." : `[${e.key}|entry-${e.key}] is new...`,
  practice: (seed) => ({ question, choices, answer, explanation }),   // all computed by the model
  whatIf: [{ label: "Four slots", scene: makeScene({ capacity: 4 }) }],
});
```

- **look:** the camera is directed from the model: step 0 and the last step are the plan view, every other step frames the marks still in focus with some of the whole. `teaching.shot: "plan"` forces the flat view on a step.
- **voice:** write for the ear: short sentences, numbers in words, a reason in every step. `[phrase|ids]` lights the marks with that key, owner or link id while the phrase is spoken. Record with `node scripts/voice.mjs <dir>`; the clips land in `<dir>/voice/` and travel inside the built page.
- **practice:** draw a random case from `seed`, run the model, and ask about its outcome. Never type an answer: verify asks 40 seeds and rejects an answer that is not a choice.
- **whatIf:** build each version with the same scene factory, so every one is computed and verified (verify opens each at `#what=k`). Keep labels to the one input that changes.
