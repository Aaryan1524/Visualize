# Everyday Physical Objects (`--kind object`, `src/rig/objects.ts`)

`src/rig/objects.ts` lets Visualize draw **recognizable everyday 3D objects** — a perfume bottle, a wristwatch, a battery, a syringe, a coffee maker — cut open so the reader immediately sees what is happening inside, paired with a clean plain-English `explainerCard` and `meterBar` beside it.

Use this kit so a learner asking *"how does a perfume bottle spray?"* or *"how does a watch keep time?"* sees the **real object** instead of abstract numbered boxes. `examples/perfume-atomizer/` is the flagship reference.

## Choosing `--kind object` vs `--kind machine` vs `--kind concept`

| Visual Lane | Choose when… | Concrete examples | Rig module |
|---|---|---|---|
| **`--kind object`** *(default for physical subjects)* | The prompt names an everyday physical object, appliance, vessel, tool, or physical/biological phenomenon where instant recognition and intuitive cause-and-effect matter most. | Perfume bottle / atomizer, everyday wristwatch, coffee maker, battery, syringe, airplane wing, lungs, microwave, thermos, bicycle pump | `src/rig/objects.ts` |
| **`--kind machine`** | The prompt asks for intricate meshed gear trains, linkages, or precision mechanical engineering — especially with `--technical` or `--deep`. | Exploded 6-layer mechanical watch calibre (`examples/automatic-watch/`), open differential (`examples/differential/`), rear derailleur (`examples/derailleur/`), 4-stroke engine | `src/rig/mech.ts` |
| **`--kind concept`** | The subject has no single physical body — it is an algorithm, data structure, protocol, distributed system, or ML mechanism. | Bloom filter (`examples/bloom/`), hash table, LRU cache, multi-agent orchestration (`examples/multi-agent/`), TCP congestion control | `src/rig/parts.ts`, `src/rig/concept.ts` |

**Rule of thumb:** If you can hold the subject in your hand (or see it in everyday life), start with `--kind object`. Upgrade to `--kind machine` when the user wants `--technical` / `--deep` precision gear-train detail. **Never** use `cellDrawing` or abstract boxes-and-arrows to stand in for a real physical object.

## Composing the Object + Side Explainer Layout

Every `--kind object` page shares a calm two-zone stage composition:

1. **Camera (`OBJECT_VIEW`):** Start from `OBJECT_VIEW = { azimuth: 238, elevation: 22 }` — a natural three-quarter front elevation where cylindrical vessels, cutaway walls, watch dials, and internal tubes/springs read immediately with clean top-vs-side contrast.
2. **Hero 3D Object (left / center):** Place the recognizable physical object so it dominates the stage. Open cutaways toward the camera (`cutaway` on `vesselShell` or `watchCaseDial`) so the reader sees the liquid column, dip tube, piston chamber, or coiled spring working inside without rotating the camera.
3. **Side Explainer (`explainerCard` + `meterBar`, right of object):** Place a crisp upright `explainerCard` and optional live `meterBar` cleanly beside the object:
   - Never overlap the object silhouette or the bottom-right interactive cards (Predict / Lab / Now you try).
   - **Never recede the explainer card** when the object is focused — keep it crisp and legible in both light and dark themes.
   - Drive every row value, badge, and meter `fraction` directly from `model.mjs` so `audit.mjs` and `check-arithmetic.mjs` verify every number automatically.
4. **Per-step camera shots:** Frame the specific part causing each step's change (e.g. the plunger and spray nozzle on the mist step, the dip tube foot on the refill step) while letting unrelated context parts recede by tone (`--recede`), never by opacity.

```js
import { makeCamera } from "../../src/rig/camera.ts";
import {
  OBJECT_VIEW,
  vesselShell,
  liquidColumn,
  dipTube,
  plungerNozzle,
  sprayCone,
  explainerCard,
  meterBar,
} from "../../src/rig/objects.ts";

const cam = makeCamera(OBJECT_VIEW);
```

## Primitives API (`src/rig/objects.ts`)

All 3D primitives return shaded rig drawings / SVG elements built on `src/rig/shapes.ts` and `src/rig/draw.ts`, shaded with studio OKLab materials from `src/rig/rig.css`. Draw static geometry once in `figure()`, and move or swap live states in `pose(state)`.

| Export | Signature | Use for |
|---|---|---|
| `OBJECT_VIEW` | `{ azimuth: 238, elevation: 22 }` | Standard three-quarter front elevation for everyday physical objects |
| `vesselShell` | `vesselShell(cam, { r, h, neckR?, neckH?, shoulderH?, wall?, cutaway?, material?, segments? })` | Bottles, flasks, syringes, battery casings, cylinders with optional shoulder, neck, wall thickness, and camera-facing cutaway |
| `liquidColumn` | `liquidColumn(cam, { r, h, z0?, material?, segments? })` | Fluid levels inside a cutaway vessel (perfume, water, electrolyte, coffee) with shaded meniscus top |
| `dipTube` | `dipTube(cam, { r, z0, z1, offset?, material? })` | Straw, dip tube, fuel pickup, or internal conduit running vertically between `z0` and `z1` |
| `plungerNozzle` | `plungerNozzle(cam, { r, h, spoutLen?, spoutDir?, material? })` | Pressable spray heads, pump plungers, and side-spout nozzles that translate along their stroke |
| `sprayCone` | `sprayCone(cam, { origin, dir, length, spreadDeg?, intensity?, seed?, droplets? })` | Deterministic atomized mist cone and droplet cloud emitted from a nozzle (`seed` guarantees reproducible builds) |
| `watchCaseDial` | `watchCaseDial(cam, { r, h?, lugs?, cutaway?, bezelMaterial?, dialMaterial? })` | Recognizable wristwatch case, optional lugs, dial face, and cutaway window into the movement |
| `watchHand` | `watchHand(cam, { len, width?, tail?, z?, material? })` | Hour, minute, or sweeping second hand pivoted cleanly at the dial centre |
| `coiledSpring` | `coiledSpring(cam, { rInner, rOuter, turns, z?, thickness?, material? })` | Spiral mainspring, hairspring, or flat energy-storage coil sorted cleanly without face-merge artefacts |
| `explainerCard` | `explainerCard(cam, { at, title, rows, badge?, tone?, width? })` | Upright plain-English callout card beside the object with structured label/value rows and optional status badge |
| `meterBar` | `meterBar(cam, { at, w, h?, fraction, label, valueText?, tone? })` | Compact live gauge bar (pressure, battery charge, liquid remaining, spring tension) driven by a `[0, 1]` model fraction |

### Quick usage snippets

**Cutaway bottle + spray mechanism:**
```js
const body = vesselShell(cam, {
  r: 34, h: 78, neckR: 11, neckH: 14, shoulderH: 16,
  wall: 3.5, cutaway: true, material: "glass",
});
const liquid = liquidColumn(cam, { r: 29, h: state.liquidHeight, z0: 4, material: "liquid" });
const straw = dipTube(cam, { r: 2.4, z0: 6, z1: 92, offset: [0, 0], material: "rubber" });
const head = plungerNozzle(cam, { r: 12, h: 16, spoutLen: 10, spoutDir: [1, 0, 0], material: "subject" });
const mist = sprayCone(cam, {
  origin: [22, 0, state.nozzleZ], dir: [1, 0, 0.08],
  length: 62, spreadDeg: 28, intensity: state.sprayStrength, seed: 7, droplets: 24,
});
```

**Everyday watch + side explainer:**
```js
const watch = watchCaseDial(cam, {
  r: 42, h: 12, lugs: true, cutaway: true,
  bezelMaterial: "steel", dialMaterial: "ceramic",
});
const spring = coiledSpring(cam, { rInner: 6, rOuter: 22, turns: 4.5, z: 3, thickness: 1.8, material: "blued" });
const secondHand = watchHand(cam, { len: 34, width: 1.6, tail: 8, z: 12.5, material: "subject" });

const card = explainerCard(cam, {
  at: [72, 0, 48],
  title: "Inside one press",
  badge: state.phaseLabel,
  tone: state.isSpraying ? "hot" : "good",
  width: 170,
  rows: [
    ["Chamber", state.chamberStatus],
    ["Pressure", state.pressureWord],
    ["Sprays left", String(state.spraysLeft)],
  ],
});

const bar = meterBar(cam, {
  at: [72, 0, 8],
  w: 168, h: 10,
  fraction: state.pressureFrac,
  label: "Chamber pressure",
  valueText: state.pressureWord,
  tone: state.pressureFrac > 0.7 ? "hot" : "good",
});
```

## Everyday Studio Materials (`src/rig/rig.css`)

In addition to the metal and concept materials in `references/look.md`, `src/rig/rig.css` provides five everyday materials tuned for OKLab contrast in both light and dark themes:

| Material | Use for | Visual intent |
|---|---|---|
| `glass` | Perfume bottles, lab flasks, watch crystals, syringe barrels | Cool translucent-feeling shell with clean rim contrast in light and dark themes |
| `liquid` | Perfume, water, coffee, fuel, electrolyte columns | Warm or tinted fluid fill that separates clearly from `glass` walls |
| `mist` | Atomized spray plumes, steam, vapour droplets | Crisp airy particles that read against both `#fdfdfc` light and `#141416` dark stages |
| `rubber` | Seals, gaskets, O-rings, flexible plungers, grips | Low-key matte elastomer with enough lit-to-dark span to read its form |
| `wood` | Handles, instrument bodies, tabletop bases, acoustic chambers | Warm organic tone that contrasts naturally with `steel`, `brass`, and `glass` |

> **Theme contrast note:** `data-t-bad` dark-mode ink and fill contrast is tuned in `src/rig/rig.css` so warning/fault states on `explainerCard`, `meterBar`, and cells remain legible in both light and dark themes. Always inspect both themes in `shoot-steps.mjs`.

## Everyday Language Checklist

> **"Speak to a bright college student, not a PhD committee."**

In default **`everyday`** mode, the engineering underneath stays 100% real while the words stay clear and human:

- [ ] **Real model underneath, plain English on screen:** `model.mjs` computes genuine physics (volumes, strokes, pressure ratios, spring energy, counts), tested against an independent reference in `model.test.mjs`. Every number printed anywhere still comes from `model.mjs`.
- [ ] **Translate units into intuition:** Prefer *"half full"*, *"about 10 sprays"*, *"1 squeeze pushes 0.1 mL up the straw"*, or *"pressure climbs 3×"* over unrequested `N·mm`, `µPa·s`, `Re = 4.2×10³`, or dense symbolic equations. Save exact SI derivations and symbolic formulas for `--technical`.
- [ ] **Cut unprompted jargon:** Avoid domain gatekeeping words (*isochronism*, *Venturi cavitation coefficient*, *hysteresis loop*) unless the user asked for `--technical` or the step specifically defines the word in one plain sentence.
- [ ] **Show the cause visibly:** Every step changes something the eye catches immediately (plunger depressed, liquid drawn up the dip tube, mist cone firing, spring unwinding) and the `explainerCard` / `meterBar` reflects the exact same moment.
- [ ] **Keep voice natural:** Write `script(M)` in spoken sentences — never read out raw symbols, abbreviations, or variable names aloud.

## Scaffold & Verification

```sh
node scripts/new-figure.mjs <name> --kind object --mode everyday --dir <folder>
node --test <folder>/*.test.mjs
node <folder>/voice.mjs
node <folder>/build.mjs
node scripts/check-drawing.mjs <page>
node scripts/check-arithmetic.mjs <page>
node scripts/shoot-steps.mjs <page> --out <folder>/shots
node scripts/review-brief.mjs <audit> <folder>/review.json <page> --shots <folder>/shots --mode everyday
```
