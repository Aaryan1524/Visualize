# Landscape

Sixteen tools compared for building AI-generated visual explanations. Facts were gathered on 2026-11-11:

- **Licences and versions** come from the npm registry (`npm view`) or the GitHub API (`gh api repos/…`).
- **Descriptions** are the maintainers' own repository descriptions, or that project's documentation fetched the same day, which is linked.

The **Assessment** column is this project's judgment, not a verified fact. Anything not checked at a primary source is marked *unverified*.

## Comparison

| Tool | Core abstraction (source) | Output | Licence | Assessment for this project |
|---|---|---|---|---|
| **Manim Community** (Python) | A `Scene` subclass whose `construct()` calls `self.play(...)` on `Mobject`s and `Animation`s ([quickstart](https://docs.manim.community/en/stable/tutorials/quickstart.html)) | Rendered video, e.g. MP4 | MIT (GitHub) | The reference for mathematical animation. The output is video, so it can't be inspected, scrubbed by state or checked against a model in the browser. Avoid as a runtime; learn from its transform vocabulary. |
| **Motion Canvas** | Scenes are generator functions; `yield` hands back a frame, and flow helpers `all`, `chain`, `sequence` and `delay` compose animations ([flow docs](https://motioncanvas.io/docs/flow)) | Canvas animation (editor and export not verified) | MIT (npm, GitHub) | Strong timing model, but time lives in generator code rather than in a model trace, so seeking to "step 7" means replaying. Avoid as a core. |
| **Three.js** | "JavaScript 3D Library." (GitHub) | WebGL | MIT | Right for true 3D; overkill for fixed-angle isometric, and text is harder. Defer. |
| **React Three Fiber** | "A React renderer for Three.js" (GitHub) | WebGL via React | MIT | Same as Three.js, plus a React dependency. Defer. |
| **D3** | "Bring data to life with SVG, Canvas and HTML." (GitHub) | SVG, Canvas, HTML | ISC | A toolkit, not a scene model; strong scales and shapes. A candidate for chart panels later. |
| **Observable Plot** | "A concise API for exploratory data visualization implementing a layered grammar of graphics" (GitHub; the docs page returned HTTP 429) | SVG (*unverified* here) | ISC | Good for evidence panels (results, ablations). Integrate later for charts, not for the stage. |
| **Vega-Lite** | "A high-level grammar of interactive graphics" with a "concise, declarative JSON syntax"; compiles to Vega ([site](https://vega.github.io/vega-lite/)) | Vega runtime (Canvas or SVG, *unverified*) | BSD-3-Clause | Declarative and very generatable, but limited to charts. Possible for evidence panels. |
| **React Flow** (xyflow) | Libraries "for building node-based UIs" (GitHub) | HTML and SVG via React | MIT | Node editors. Exactly the boxes-and-arrows look to avoid as a default. Avoid. |
| **GSAP** | "A JavaScript animation library for the modern web" (GitHub) | Animates the DOM, SVG and canvas values | Standard "no charge" licence; commercial use allowed, but a field-of-use restriction on tools competing with Webflow's animation builder. Not OSI open source ([licence](https://gsap.com/standard-license)) | Stateful tweens conflict with a pure `frameAt(t)`, and the licence is awkward for an open-source engine. Avoid. |
| **Theatre.js** | A project holds sheets; sheets hold objects "animated together", each sheet with a sequence ([manual](https://www.theatrejs.com/docs/latest/manual/sheets)) | Animates JS values, DOM and 3D | Core Apache-2.0, studio AGPL-3.0-only (npm); repository last pushed 2024-08-14 | A keyframe editor for hand-authored motion, not model-driven. Avoid. |
| **Remotion** | "Make videos programmatically with React" (GitHub) | Video | Source-available two-tier licence: free for individuals and companies of up to 3 employees, a company licence above that (LICENSE.md). Not OSI open source | Video, not interactive; licence unsuitable as a dependency. Avoid; perhaps a future export path. |
| **KaTeX** | "Fast math typesetting for the web." (GitHub) | HTML and MathML | MIT | **Integrated.** `\htmlData` with only that command trusted gives per-term ids (tested in this repository). |
| **MathJax** | "Beautiful and accessible math in all browsers" (GitHub) | HTML, SVG, MathML (*unverified* here) | Apache-2.0 | An alternative to KaTeX; not needed while KaTeX's term linking works. |
| **Penrose** | Three languages: Domain (types, predicates, functions), Substance (objects and relations), Style (how to draw them); layout comes from "converting the three programs into an optimization problem" ([reference](https://penrose.cs.cmu.edu/docs/ref)) | SVG diagrams (*unverified* here) | MIT (npm, GitHub) | The closest prior art for separating meaning from drawing. Optimisation layout is powerful but hard to make deterministic and fast across animation frames (judgment, not tested). Learn from its semantics/style split. |
| **Bluefish** | "Build complex diagrams from simpler building blocks like alignment, spacing, and arrows"; Vanilla JS or Solid JSX ([site](https://bluefishjs.org/)) | *Unverified* | MIT (npm, GitHub) | Relational layout could replace our hand-placed coordinates. Version 0.0.x, so it's early. Watch. |
| **Mafs** | "React components for interactive math" ([site](https://mafs.dev/)) | React and SVG (*unverified*) | MIT | Good for 2D function and geometry panels. Possibly a panel lens later. |
| **Idyll** | "Create explorable explanations and interactive essays." (GitHub) | Web pages | MIT; repository last pushed 2023-02-04 | The right genre, a document-first model, but inactive. Learn from it. |

Agent-facing prior art in the same space:

| Project | What it says it does (GitHub description) | Licence | Notes |
|---|---|---|---|
| **Anatomy** | "An agent skill for creating detailed, interactive isometric illustrations of real-world machines and complex systems." | MIT | See [ANATOMY_ANALYSIS.md](ANATOMY_ANALYSIS.md). |
| **vumichien/manim-skill** | "Turn ideas, papers, and math into Manim animations via a 4-role Claude Code agent pipeline." | Apache-2.0 | Video output; quality not evaluated here. |
| **HarleyCoops/Math-To-Manim** | "Create Epic Math and Physics Animations & Study Notes From Text and Images." | MIT | Video output; quality not evaluated here. |

## The gap

None of the tools above provides all three of the following at once. This is judgment, based on the abstractions listed.

1. **An executable model as the single source of truth for a seekable timeline.** Manim, Motion Canvas, Remotion and Theatre.js own time in animation code or keyframes; Anatomy owns it in a live loop. None of them makes "the page at step k" a pure function that can be checked.
2. **Checks that the rendered page agrees with the model.** Anatomy proves geometric coherence, and the others leave correctness to the author. Nobody checks displayed values, drawn sizes, visibility or depth order against an independent model run.
3. **Several linked representations of one state.** Spatial stage, equation terms and number grids sharing entity ids, so pointing at one lights the others. KaTeX makes the equation side possible; no listed tool composes it with a stage.

That is the layer this repository prototypes. Charting grammars (Plot, Vega-Lite) and math components (Mafs) are good candidates to plug in as additional panel lenses rather than to compete with.
