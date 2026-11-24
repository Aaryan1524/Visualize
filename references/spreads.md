# Page Spread Design System & Figma-Ready SVG Export (`src/rig/spreads.ts`)

**Never hand-guess `VBW`, `BOX`, `CLEAR`, `HUD_CAM`, or raw callout `(x, y)` coordinates on a Drawing page.** Every Visualize stage is a canonical `14200 × 6550` canvas (`~10 units/px` at `1440×900`) shared by the heading, hero 3D object, callout rails, upper-right HUD stack, bottom-right Predict card, and left Lab/Practice drawer. Hand-picked rectangles inevitably collide at `1280×800` or when Predict/Lab opens.

`src/rig/spreads.ts` locks in **6 Figma-style Spread Presets** whose zones are mathematically proven to have **zero overlap** at both `1440×900` and `1280×800` (enforced by `src/rig/spreads.test.ts`), plus `distributeCallouts()` and `renderHudStack()`.

---

## Shared Chrome Safe Zones (`14200 × 6550`)

Every spread reserves the exact worst-case union of the interactive chrome across `1440×900` and `1280×800`:

| Safe Zone | Bounds (`x0, y0 → x1, y1`) | Reserved For |
|---|---|---|
| `safeZones.heading` | `150, 150 → 3220, 1600` | Top-left step heading (`.vz-step-heading`) |
| `safeZones.predict` | `9000, 4650 → 14080, 6450` | Bottom-right Predict / concept card |
| `safeZones.lab` | `250, 700 → 5050, 5900` | Left-hand interactive Lab & *Now you try* drawer |
| `safeZones.hud` | Spread-specific (`x0 ≥ 9800, y0: 200 → x1: 14050, y1 ≤ 3250`) | Upper-right `explainerCard` + up to 2 stacked `meterBar`s (`#explainer`) |

**Mathematical invariants held by all 6 spreads:**
- `box` (overview fit) never overlaps `heading`, `hud`, or `predict`.
- `clear` (zoomed shots) never overlaps `heading` or `hud`.
- `predictClear` (Predict-open shots) never overlaps `heading`, `hud`, or `predict`.
- `cardClear` (Lab / Practice-open shots) never overlaps `lab` or `hud`.
- `predict.y0 - hud.y1 ≥ 1200` units, leaving a clean right-rail band for callouts between the HUD stack and Predict card.

---

## The 6 Universal Page Spread Presets

Pick the spread matching the hero's silhouette and axis:

| Spread Kind | Studio View (`az° / el°`) | `fs` | Pick when explaining… |
|---|---|---|---|
| **`cutaway-vessel`** | `238° / 22°` (`OBJECT_VIEW`) | `152` | Vertical bottles, chambers, batteries, syringes, or boilers cut open in front with internal fluid or pistons |
| **`exploded-stack`** | `236° / 27°` | `152` | Coaxial vertical assemblies separated along `Z`: watch movements, camera lenses, clutches, loudspeakers |
| **`axial-cutaway`** | `234° / 22°` | `150` | Wide horizontal machines along `X`: jet/turbofan engines, differentials, lock cylinders, hydraulic spool valves |
| **`linked-train`** | `240° / 28°` | `150` | Meshed mechanical linkages and gear trains: gearboxes, rear derailleurs, escapements, crank linkages |
| **`concept-plate`** | `247° / 32°` (`CONCEPT_VIEW`) | `150` | Abstract algorithms & data structures built from 3D cells, rails, rings, and tokens (Bloom filter, hash table, B-tree) |
| **`system-tiers`** | `235° / 26°` | `150` | Multi-plane architectural stacks: multi-agent orchestration, microservices, network stacks, transformer layers |

### Exact Guaranteed Zero-Overlap Zones

| Spread Kind | `box` (`x, y, w × h`) | `clear` (`x0, y0 → x1, y1`) | `predictClear` | `cardClear` | `rails` (`lx / rx`, `yMin..yMax`) | `hud` (`x`, `scale`, `w`, `meterY`) |
|---|---|---|---|---|---|---|
| **`cutaway-vessel`** | `3450, 450, 5150×5500` | `3280, 200 → 9600, 6250` | `3280, 200 → 8800, 6250` | `5400, 200 → 9550, 6250` | `2850 / 9400`, `1800..5600` | `x: 9850`, `s: 105`, `w: 39`, `y: [1960, 2680]` |
| **`exploded-stack`** | `3300, 340, 5150×5820` | `3450, 240 → 9800, 6200` | `3450, 240 → 8800, 6200` | `5400, 200 → 9750, 6250` | `2780 / 9500`, `1780..5500` | `x: 10100`, `s: 98`, `w: 38.5`, `y: [1920, 2640]` |
| **`axial-cutaway`** | `3350, 550, 6450×3950` | `3300, 240 → 9850, 6150` | `3300, 240 → 9850, 4520` | `5300, 300 → 9820, 6100` | `2950 / 10050`, `1800..5400` | `x: 10100`, `s: 98`, `w: 38.5`, `y: [1920, 2640]` |
| **`linked-train`** | `3350, 450, 5450×5450` | `3300, 220 → 9700, 6200` | `3300, 220 → 8820, 6200` | `5350, 240 → 9680, 6200` | `2900 / 9550`, `1800..5500` | `x: 9950`, `s: 100`, `w: 39`, `y: [1940, 2660]` |
| **`concept-plate`** | `3320, 380, 6520×4140` | `3280, 180 → 9860, 6150` | `3280, 180 → 9860, 4520` | `5320, 220 → 9840, 6150` | `3000 / 10050`, `1820..5200` | `x: 10100`, `s: 98`, `w: 38.5`, `y: [1920, 2640]` |
| **`system-tiers`** | `3320, 460, 5500×5440` | `3280, 200 → 9660, 6250` | `3280, 200 → 8820, 6250` | `5350, 220 → 9640, 6250` | `2820 / 9450`, `1800..5600` | `x: 9900`, `s: 100`, `w: 39`, `y: [1940, 2660]` |

---

## Wiring a Page with `spread()`, `distributeCallouts()`, and `renderHudStack()`

### In `build.mjs`

```js
import { distributeCallouts, spread } from "../../src/rig/index.ts";

const S = spread("cutaway-vessel"); // returns an isolated deep copy; throws RangeError on invalid kind

// Automatically spaces callouts along left (below heading) and right (strictly between HUD and Predict)
const LABELS = distributeCallouts(S, [
  { id: "nozzle", text: "Plunger", to: "nozzle", side: "left", beats: [0, 1] },
  { id: "tube", text: "Dip tube", to: "tube", side: "left", beats: [0, 1] },
  { id: "liquid", text: "Liquid", to: "liquid", side: "left", beats: [0, 1] },
  { id: "spray", text: "Mist cone", to: "spray", side: "right", beats: [0, 3] },
]);

const labelSvg = (l) =>
  `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

// Put #explainer outside [data-camera] with data-camera-avoid="" so zoomed shots never cover it
const skeleton = () =>
  `<defs id="rigDefs"></defs><g id="scene" data-camera=""></g><g id="explainer" data-camera-avoid=""></g><g id="labels">${LABELS.map(labelSvg).join("")}</g>`;

// Pass only numeric layout bounds into DATA (keep S.css & S.viewBox.str out of DATA so audit.mjs
// does not scan CSS pixel sizes as model prose numbers; figure.mjs loads the same spread directly).
const DATA = {
  box: S.box,
  camera: { clear: S.clear, /* ... */ },
  /* ... */
};

const CSS = `
${readFileSync(new URL("../../src/rig/rig.css", import.meta.url), "utf8")}
${S.css}
`;

// In drawingPage({ ... }):
//   viewBox: S.viewBox.str,
//   css: CSS,
```

### In `figure.mjs`

```js
import { fitCamera, renderHudStack, spread } from "../../src/rig/index.ts";

export const SPREAD = spread("cutaway-vessel");
export const VIEW = SPREAD.view;

export function cameraFor(M, box = SPREAD.box) {
  return fitCamera(heroBounds(M), box, VIEW.azimuth, VIEW.elevation);
}

export function figure(M, cam, spec = SPREAD) {
  // ... build static parts once ...
  function pose(st) {
    const explainer = renderHudStack(
      spec,
      {
        title: "Inside the pump",
        badge: st.statusLabel,
        tone: st.tone,
        rows: [
          `Chamber: ${st.chamberLabel}`,
          `Bottle: ${st.remainingMl.toFixed(1)} mL`,
        ],
      },
      [
        { label: "Chamber pressure", fraction: st.pressureFrac, valueText: st.pressureLabel, tone: st.tone },
        { label: "Bottle fill", fraction: st.fillFrac, valueText: `${Math.round(st.fillFrac * 100)}%`, tone: "good" },
      ],
    );
    return { items, at, explainer };
  }
  return { parts, pose };
}
```

- `spread(kind)` returns a fresh deep copy of `SPREADS[kind]` and throws `RangeError` for unknown kinds.
- `distributeCallouts(spec, items)` defaults `side` to `"left"` (`anchor: "end"`, below `safeZones.heading.y1`) and `beats` to `[0]`. Right-side items (`side: "right"`, `anchor: "start"`) are strictly bounded between `safeZones.hud.y1` and `safeZones.predict.y0`.
- `renderHudStack(spec, card, meters?)` renders the `explainerCard` and up to 2 stacked `meterBar`s locked into `spec.hud`.

---

## Figma-Ready Editable SVG Export (`scripts/export-drawing-svg.mjs`)

Any built Drawing page can be exported at a chosen step, variant, and theme into a **100% standalone, editable vector `.svg`** that pastes or imports cleanly into Figma, Illustrator, or Keynote:

```sh
node scripts/export-drawing-svg.mjs <built-page.html> --out <file.svg> [--step k] [--variant <name>] [--theme light|dark] [--include-hud | --no-hud]

# or via npm script:
npm run export:drawing-svg -- dist/watch-everyday.html --out watch-step0.svg --step 0 --theme light
```

| Flag | Default | Purpose |
|---|---|---|
| `--out <file.svg>` | `<stem>-step<k>-<theme>.svg` beside the HTML | Output path for the standalone SVG |
| `--step <k>` | `0` | Zero-based step index to seek and settle before exporting |
| `--variant <name>` | default variant | Select a *What if* variant before exporting |
| `--theme light\|dark` | `light` | Bake either the studio light stage or light-faithful dark watchmaker's mat |
| `--include-hud` / `--no-hud` | `--include-hud` | Include or strip `#explainer`, title block, and inset lenses (use `--no-hud` for pure diagram assets) |

### Why it pastes cleanly into Figma

Live Visualize Drawing pages rely on browser-only CSS features (`var(--rig-lit)`, CSS Color 5 `color-mix(in oklab, ...)`, `<use href="#...">` symbol instances, and `vector-effect="non-scaling-stroke"`) that Figma silently drops on SVG import. `export-drawing-svg.mjs` resolves every one of them in headless Chrome:

1. **In-place `<use>` expansion:** Expands every `<use>` instance directly inside the live DOM so state selectors (`[data-recede]`, `[data-named]`, `[data-t-hot]`, material classes) cascade identically to what the browser renders.
2. **Static hex baking:** Evaluates every computed fill, stroke, and gradient stop through an offscreen 1×1 canvas, converting `var(--...)`, `color-mix()`, `oklab()`, and `color(srgb ...)` into flat `#rrggbb` + `fill-opacity` / `stroke-opacity` presentation attributes.
3. **ViewBox stroke scaling:** Reads each element's live `getScreenCTM()` scale and converts `vector-effect="non-scaling-stroke"` widths and `stroke-dasharray` lengths into exact viewBox user units so line weights match 1:1 in Figma.
4. **Clean semantic Figma layers:** Strips hidden/degenerate nodes and organizes the document into named groups ready for direct selection in Figma's Layers panel:
   - `#stage-background` (solid stage backdrop rect)
   - `#diagram` containing `<g id="part-...">` for every rigged solid
   - `#callouts` containing `<g id="callout-...">` for leaders and text
   - `#explainer` (HUD card + meter bars, omitted with `--no-hud`)
   - `#title-block` (when present, omitted with `--no-hud`)
5. **Automated validation:** Every export is validated to contain zero `var(--...)`, zero `color-mix()`, zero `oklab`/`oklch`, zero unexpanded `<use>` tags, and zero `NaN` values.
