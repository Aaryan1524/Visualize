# Spatial Layout Solvers (`src/rig/layout.ts`)

**Never hand-guess `(x, y, z)` coordinates for multi-part mechanisms.** Hand-placed gears drift out of mesh, crash into neighboring barrels, leave sparse "empty ashtray" cavities, or squash layered assemblies into one colliding plane.

Compute exact geometry first with `src/rig/layout.ts`, verify clearance and cavity fill in `model.test.mjs` / `figure.mjs`, and feed the solved coordinates straight into `src/rig/objects.ts` and `src/rig/mech.ts`.

## API Reference

All five solvers are exported from `src/rig/layout.ts` (and re-exported from `src/rig/index.ts`):

| Function | Signature | What it guarantees |
|---|---|---|
| `solveGearTrain` | `solveGearTrain(specs, { origin?, minGap? })` | Computes exact `(x, y, z)`, `pitchR`, `outerR`, `ratioToRoot`, `omegaSign`, and overall `bounds` (`minX`, `maxX`, `minY`, `maxY`, `rBound`) for meshed gears and coaxial compound pinions. Enforces matching `module` across every meshed pair and runs `assertNoCollisions` per layer automatically. |
| `assertNoCollisions` | `assertNoCollisions(items, { minGap?, ignorePairs? })` | Deterministic clearance verifier across `{ name, x, y, r, layer? }[]`. Throws an Error naming the exact colliding pair and overlap distance whenever `dist < rA + rB + minGap` on the same `layer`. |
| `checkCavityFill` | `checkCavityFill(cavityR, items, minRatio = 0.25)` | Returns `{ ratio, ok, outside }` for circular parts inside a round case/plate of radius `cavityR`. Catches sparse "empty ashtray" layouts (`ratio < minRatio`) and parts poking outside the case perimeter (`outside > 0`). |
| `layoutFlowSpine` | `layoutFlowSpine(nodes, { axis?: "z" \| "x", origin? })` | Snaps sequential fluid, thermal, or energy stages end-to-end along a vertical (`"z"`) or horizontal (`"x"`) spine with zero overlap. Returns `Record<string, FlowSpineNode>` with `z0`, `z1`, `mid`, `anchorLeft`, `anchorRight`, and `r`. |
| `composeExplodedLayers` | `composeExplodedLayers(layers, { baseZ?, explode? })` | Computes monotonic vertical elevations `{ byName: Record<string, { name, z0, z1, midZ }>, totalHeight }` for `explode` in `[0, 1]` (tightly assembled at `0`, clean breathing gaps at `1`). |

### Key Types

- `GearNodeSpec`: `{ name, teeth, module, outerR?, driver?, coaxialWith?, angleDeg?, layer?, z? }`
  - `pitchR = (teeth * module) / 2`; `outerR` defaults to `pitchR + module`.
  - First (root) node omits `driver` and `coaxialWith`; every subsequent node specifies either `driver` (meshes at exact center distance `driver.pitchR + pitchR` along `angleDeg`, flips `omegaSign`, multiplies `ratioToRoot` by `driver.teeth / teeth`) or `coaxialWith` (shares arbor `(x, y)`, `ratioToRoot`, and `omegaSign`).
- `CollisionItem`: `{ name, x, y, r, layer? }` (default `layer = 0`).
- `FlowSpineNodeSpec`: `{ name, length, r, gap? }`.
- `ExplodedLayerSpec`: `{ name, thickness, gap? }` (default gap is `max(tallestThickness * 1.25, 1)`).

## Example 1 — Watch Gear Train + Exploded Layers

Solve the going train, assert balance-wheel clearance, check that the movement fills the calibre cavity (no empty ashtray), and separate flat layers vertically so nothing fights in one plane:

```js
import {
  solveGearTrain,
  assertNoCollisions,
  checkCavityFill,
  composeExplodedLayers,
} from "../../src/rig/layout.ts";

// 1. Vertical layer stack (explode: 0 assembled .. 1 exploded)
const layers = composeExplodedLayers(
  [
    { name: "mainplate", thickness: 2.2, gap: 6 },
    { name: "barrel", thickness: 3.6, gap: 7 },
    { name: "train", thickness: 2.4, gap: 7 },
    { name: "escapement", thickness: 2.2, gap: 8 },
    { name: "rotor", thickness: 2.0 },
  ],
  { baseZ: 0, explode: 0.75 },
);

// 2. Meshed gear train + coaxial compound pinions (zero hand-guessed x/y)
const train = solveGearTrain(
  [
    { name: "barrel", teeth: 72, module: 0.35, layer: 0, z: layers.byName.barrel.midZ },
    { name: "centerPinion", teeth: 12, module: 0.35, driver: "barrel", angleDeg: -35, layer: 0, z: layers.byName.barrel.midZ },
    { name: "centerWheel", teeth: 60, module: 0.25, coaxialWith: "centerPinion", layer: 1, z: layers.byName.train.midZ },
    { name: "thirdPinion", teeth: 10, module: 0.25, driver: "centerWheel", angleDeg: 35, layer: 1, z: layers.byName.train.midZ },
    { name: "thirdWheel", teeth: 48, module: 0.22, coaxialWith: "thirdPinion", layer: 2, z: layers.byName.train.z1 },
    { name: "fourthPinion", teeth: 10, module: 0.22, driver: "thirdWheel", angleDeg: -50, layer: 2, z: layers.byName.train.z1 },
  ],
  { origin: [-9, 4, 0], minGap: 0.4 },
);

// 3. Verify non-gear components (e.g. balance wheel) clear the barrel on the same plane
const balance = { name: "balance", x: 10, y: -9.5, r: 7.2, layer: 0 };
assertNoCollisions(
  [
    { name: "barrel", x: train.byName.barrel.x, y: train.byName.barrel.y, r: train.byName.barrel.outerR, layer: 0 },
    balance,
  ],
  { minGap: 0.6 },
);

// 4. Verify the calibre cavity isn't an "empty ashtray" and nothing pokes outside the case
const cavityR = 26;
const fill = checkCavityFill(
  cavityR,
  [
    ...train.list.map((g) => ({ x: g.x, y: g.y, r: g.outerR })),
    { x: balance.x, y: balance.y, r: balance.r },
  ],
  0.35,
);
if (!fill.ok) throw new Error(`Cavity fill failed: ratio=${fill.ratio.toFixed(2)}, outside=${fill.outside}`);
```

## Example 2 — Vertical Flow Spine for an Everyday Cutaway Object

Use `layoutFlowSpine` for bottles, pumps, syringes, coffee makers, batteries, or heat exchangers so every internal stage meets cleanly and callout anchors sit at exact outer radius `r`:

```js
import { layoutFlowSpine } from "../../src/rig/layout.ts";

const spine = layoutFlowSpine(
  [
    { name: "reservoir", length: 58, r: 30 },
    { name: "shoulder", length: 14, r: 18 },
    { name: "chamber", length: 18, r: 10 },
    { name: "nozzle", length: 16, r: 12, gap: 2 },
  ],
  { axis: "z", origin: [0, 0, 0] },
);

// Feed solved spans straight into objects.ts primitives:
// liquidColumn(cam, { r: 27, h: spine.reservoir.z1 * state.fillFrac, z0: spine.reservoir.z0 + 3 })
// dipTube(cam, { r: 2.2, z0: spine.reservoir.z0 + 4, z1: spine.chamber.z1 })
// Callout anchors: spine.nozzle.anchorLeft, spine.chamber.anchorLeft, spine.reservoir.anchorLeft
```

## When to Call Which Solver

- **Gears, watches, differentials, transmissions, escapements:** `solveGearTrain` + `assertNoCollisions` + `checkCavityFill` + `composeExplodedLayers`.
- **Fluid, thermal, pneumatic, or electrical everyday objects:** `layoutFlowSpine` (vertical `"z"` for bottles/pumps/coffees/batteries, horizontal `"x"` for syringes/turbines/pipes).
- **Unit tests (`model.test.mjs`):** Assert `fill.ok === true`, `assertNoCollisions(...)`, and exact gear ratios `train.byName[...].ratioToRoot` so layout defects fail in milliseconds before Chrome even launches.
