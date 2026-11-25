# Studio Engines — The 2-Engine Deterministic Studio Kit

Build industrial-design-studio visual explanations in **60–140 lines** using two deterministic, color-locked rendering engines. Both engines share the exact same `globalThis.STUDIO_SCENE = { mount }` contract with the Unified Director Shell ([studio-director.md](studio-director.md)).

---

## 1. Strict 2-Engine Routing Table (`routeTopic` / `--engine A|C`)

Scaffold with `node scripts/new-studio.mjs <slug> --topic "<prompt>" --dir <dir>` (which calls `routeTopic(topic)` automatically) or override explicitly with `--engine A|C`.

| Engine | Module | Visual Idiom | Route Here For | Flagship Examples |
| :--- | :--- | :--- | :--- | :--- |
| **A — 3D Physical CAD Studio** | `src/studio/engine-a.ts` | **Three.js Orthographic Matte-Clay 3D CAD** + `EdgesGeometry` architectural contour lines + 4-point museum lighting + damped `OrbitControls` | **EVERY physical object, machine, fluid/thermal/optical device, hardware, watch, battery, atomizer, or organ** (NO flat 2D drawings for physical objects!) | `examples/turbofan-studio/` (`dist/turbofan-studio.html`), `examples/venturi-atomizer/` (`dist/venturi-atomizer.html`) |
| **C — 2D Tactile Conceptual Studio** | `src/studio/engine-c.ts` | **Braun/Rams Tactile Kinetic Instruments** on warm drafting paper (switchboard strips, milled sliding rails, lift-arc spring physics, single-active-thread Bézier arcs) | **EVERY conceptual / abstract topic**: algorithms, data structures, protocols, distributed systems, ML/transformers, math, finance, circuits/logic | `examples/lru-studio/` (`dist/lru-studio.html`) |

**Strict split rule:**
- Does the topic exist as a **physical 3D object, machine, vessel, fluid/thermal/optical device, hardware assembly, or biological organ**? → **Engine A** (always 3D cutaway CAD — never fall back to flat 2D schematics for physical objects).
- Is the topic **conceptual or abstract** (CS algorithms, data structures, protocols, distributed systems, ML/transformers, math, finance, or symbolic circuits/logic)? → **Engine C**.

---

## 2. Universal Scene Mount Contract

Every `scene.mjs` (for Engine A or Engine C) exposes a single `mount(canvas, ctx)` function on `globalThis.STUDIO_SCENE`:

```js
export function mount(canvas, ctx) {
  // ctx = { sceneId, theme, variant, params, step, steps, simModel, getSize }
  return {
    setFocus(ids, accents) {},       // string[] | null, Record<string, AccentKey> | null
    setReveal(ids) {},               // string[] | null (progressive assembly / cutaway peel)
    setCamera(preset, zoom) {},      // smooth transition to named preset
    resetCamera() {},                // snap/ease back to current step preset
    setTheme(theme) {},              // "light" | "dark"
    resize() {},                     // respond to viewport resize
    getCalloutPos(targetId) {},      // returns { x, y, visible } in CSS px (or null)
    update(dt, sim, params, step) {},// called every animation frame; sim comes from simModel()
  };
}

globalThis.STUDIO_SCENE = { mount };
```

---

## 3. Strict Anti-Slop Aesthetic Guardrails

These rules are enforced directly in the engine tokens and shaders — do **not** bypass them:

1. **Color Lock (4 Monochrome + 5 Accent Tokens)**
   - **Structure** (casings, plates, shafts, vessels, strips, rails, tiles) MUST use only the 4 monochrome tones in `MONOCHROME_TOKENS`:
     - `clayLight`: `#f1f0ea` (`0xf1f0ea`) — outer housings, primary plates, matte ceramic cards
     - `clayMid`: `#d6d4cc` (`0xd6d4cc`) — secondary casings, sub-assemblies, inner baffles
     - `clayDark`: `#9b9991` (`0x9b9991`) — dense structural frames, combustor liners, collars
     - `graphite`: `#4b4e54` (`0x4b4e54`) — shafts, fasteners, nozzles, dark machined hardware
   - **Saturated Accents** (`ACCENT_TOKENS`) are strictly reserved for **active `focus[]` highlights** and **invisible forces/phenomena** (airflow, liquid, gas, mist, heat, pressure, electric current, active data packets/threads):
     - `orange`: `#e05a1e` (`0xe05a1e`) — mechanical drive, energy transfer, primary highlight
     - `cobalt`: `#2563eb` (`0x2563eb`) — cool air/fluid, reads, stable streams
     - `ember`: `#ef4444` (`0xef4444`) — combustion, heat, high pressure, hot jets, evictions
     - `teal`: `#0d9488` (`0x0d9488`) — verified state, clean flow, liquid/mist accents, secondary signal
     - `gold`: `#d69624` (`0xd69624`) — compression, torque, amber fluid, key state transitions
   - Never paint an entire machine or diagram in rainbow primaries.

2. **Light-Faithful Dark Mode**
   - Light canvas sits on warm gallery paper (`#f6f5f0`) with soft contact shadows.
   - Dark canvas sits on deep obsidian (`#111317`) where 3D matte-clay solids and 2D matte-ivory ceramic tiles remain **luminous and high-contrast** under balanced key + rim lighting — never muddy dark-on-dark wireframes or neon glow soup.

3. **Zero Raw 2.5D SVG Bézier Slop & Zero SaaS Dashboards**
   - Never hand-code 400 lines of raw 2.5D SVG paths, fake drop-shadow gradients, or manual arrow splines.
   - A 60–140 line Engine A or Engine C assembly solves lighting, architectural contours, physical vessel/fluid geometry, spring lift-arc motion, theme switching, and smooth camera transitions deterministically.

---

## 4. Engine A — 3D Physical CAD Studio (`src/studio/engine-a.ts`)

Use Engine A for **every physical object, machine, fluid/thermal/optical device, hardware, watch, battery, atomizer, or organ**. Always pair Engine A scenes with `studioPage({ hint: "Drag to orbit · Scroll to zoom", ... })` (the default).

### 4 Concrete 3D CAD & Volumetric WebGL Craft Rules
1. **Mechanically connect every sub-assembly:** join housings, rotors, vessels, manifolds, and actuators with real struts, collars, flanges, or necks — **zero floating parts**!
2. **Lift camera `target.y` slightly negative:** aim camera presets slightly below vertical center (e.g. `target: [0, -0.25, 0]`) so subjects sit slightly higher in the viewport and clear the bottom subtitle bar and expandable `Tune` strip.
3. **Anchor callouts directly on the part's surface or centerline:** register local anchors via `stage.registerPart(id, obj, { anchor, accent })` directly on the feature (remember: `anchor` is in the registered object's **local** space!) so leaders land accurately and follow moving parts automatically.
4. **Use real WebGL volumetric shaders for invisible forces — NEVER rigid plastic tubes:**
   - **Wide / diffused airflow, cooling, wind, or intake streams** → use **`airVolume()`** (seamless 360° GLSL domain-warped 3D fBM mist + soft billowing vapor puffs with optical rim-depth weighting so the cutaway core stays razor-sharp).
   - **High-energy hot exhaust, rocket thrust, afterburners, or torches** → use **`jetPlume()`** (nested incandescent inner supersonic core with Mach shock diamonds + turbulent fiery crimson shear sheath + kinetic ember streaks, contained cleanly inside the frame).
   - **Combustion chambers** → `combustorRing()` renders volumetric orthographic-Fresnel flickering GLSL flames automatically.
   - **Narrow channeled streams (Venturi throats, dip tubes, narrow manifolds)** → use feathered **`flowRibbon({ curves, colorStops })`** with physically accurate axial thermal stops (`start` → `mid` → `end`).
   - **Light + Dark theme safety:** never use naive `AdditiveBlending` alone (it washes out to white on cream Light mode). Engine A's `airVolume` and `jetPlume` automatically receive `uDarkMode` from `stage.setTheme()` so Light mode stays richly pigmented and Dark mode glows cleanly.

### Complete Primitive & Stage Cheat-Sheet (All 17 Primitives — Type-Exact)

| Export | Exact TypeScript Options / Return Shape | Purpose |
| :--- | :--- | :--- |
| `createStudioStage` | `(canvas, { theme?, frustumSize?, cameraPresets?, initialCamera?, pixelRatioCap? })` | Builds orthographic museum stage, 4-point lighting, PMREM `RoomEnvironment`, damped `OrbitControls`, and Director bridge (`registerPart`, `setFocus`, `setReveal`, `goToCamera`, `resetCamera`, `setCameraPreset`, `projectAnchor`, `setTheme`, `render`, `resize`, `dispose`). Built-in presets: `hero`, `iso`, `side`, `front`, `intake`, `rear`, `exhaust`, `top`, `closeup`. |
| `cutawayCylinder` | `{ length, rOuter, rInner, rOuterEnd?, rInnerEnd?, openDeg?, startDeg?, x0?, axis?: "x"\|"y"\|"z", tone?, metalness?, roughness?, segments?: 84, edgeThresholdDeg?: 26 }` | Smooth machined-looking watertight thick-walled revolved shell or tapered cone along `X` (or `Y`/`Z` via `axis`) with closed end rims and clean cutaway faces. |
| `bladeRing` | `{ rHub, rTip, blades, chord?, thick?, twistDeg?, pitchDeg?, noseLen?, x?, hubLength?, tone?, hubTone? }` | Hub + optional ogive spinner nose + N twisted 3D airfoil blades along `X`. Spin via `.rotation.x += omega`. |
| `combustorRing` | `{ rInner, rOuter, length, cans?, x?, tone?, openDeg? }` | Cutaway annular burner liner + fuel nozzles + volumetric flickering GLSL flames exposed at `group.userData.flameMeshes` (drive `flame.material.uniforms.uIntensity.value`). |
| `shaft` | `{ length, r, x0?, tone?, collars?, metalness?, roughness? }` | Turned coaxial drive shaft along `X` with beveled collars. |
| `pipe` | `{ points: [number, number, number][], r, tone?, tubularSegments?, radialSegments?, metalness?, roughness?, flanges? }` | Smooth Catmull-Rom `TubeGeometry` conduit with optional machined end flanges (`flanges !== false`). |
| `spring` | `{ r, length, turns, wireR?, axis?: "x"\|"y"\|"z", tone?, tubularSegments?, radialSegments? }` | True 3D helical spring with spherical wire end caps. |
| `gear` | `{ teeth, module, thickness, boreR?, axis?: "x"\|"y"\|"z", tone?, bevel? }` | Extruded involute-style spur gear with bore hole and beveled edges. |
| `glassVessel` | `{ height, rOuter, rInner, rOuterTop?, rInnerTop?, y0?, openDeg?, startDeg?, neckHeight?, neckROuter?, neckRInner?, shoulderHeight?, baseThick?, opacity?, segments?, axis?: "y"\|"x", color?, edgeThresholdDeg? }` | Watertight frosted-glass cutaway bottle, flask, syringe barrel, or chamber along `Y` (or `X`) with solid base, optional shoulder + neck, and crisp contour edges. |
| `liquidVolume` | `{ height, radius, y0?, openDeg?, startDeg?, color?, opacity?, segments? }` | Watertight cutaway liquid column along `Y` matching vessel bore, with luminous top meniscus rim (`group.userData.liquidMesh`, `group.userData.meniscusMesh`). |
| `gasVolume` | `{ height, radius, y0?, openDeg?, startDeg?, color?, opacity?, segments? }` → returns `{ group, setHeight(h), setColor(hexOrAccent), setOpacity(o) }` | Compressible cutaway gas/vapor/combustion cylinder along `Y` with live height, color, and opacity setters without geometry reallocation. |
| `boxPlate` | `{ w, h, d, tone?, roughness?, metalness?, edgeThresholdDeg? }` | Color-locked matte-clay rectangular structural plate, bracket, manifold block, or bulkhead with `EdgesGeometry` contours. |
| `pistonPlunger` | `{ r, headLength?, rodLength?, springTurns?, withSpring?: boolean, axis?: "x"\|"y", tone?, rodTone? }` → returns `{ group, setStroke(offset) }` | Machined piston head + dual sealing O-rings + crown boss + connecting rod + push cap + optional coaxial return spring (`withSpring`). Animate travel with `handle.setStroke(offset)`. |
| `mistCone` | `{ origin: [x,y,z], length, startRadius?, endRadius?, count?, color?, speed?, dropletRadius?, opacity?, direction?: [x,y,z] }` → returns `{ group, update(dt, { speedScale?, dropletScale?, spreadScale?, opacityScale?, gravitySag?, colorHex? }) }` | Volumetric 3D spray veil + instanced micro-droplet cone bursting along `direction` (default `[1, 0, 0]`). |
| `baseMount` | `{ y, radius? }` | Soft radial Gaussian studio contact shadow + subtle directional catcher + architectural ground contact ring. Adapts automatically to Light & Dark themes. |
| `airVolume` | `{ x0, length, rInner, rOuter, rInnerEnd?, rOuterEnd?, intakeFlare?, color?, secondaryColor?, opacity?, speed?, puffCount?, swirl? }` → returns `{ group, update(dt, { speedScale?, opacityScale?, colorHex?, darkMode? }) }` | **Preferred for wide diffused airflow/wind/cooling:** 3 nested seamless 360° GLSL domain-warped 3D fBM mist shells with optical rim-depth weighting + ultra-soft billowing Gaussian vapor puffs. |
| `jetPlume` | `{ x0, length, rStart, rEnd?, speed?, intensity?, opacity?, sparkCount?, machDiamonds? }` → returns `{ group, update(dt, { speedScale?, intensity?, lengthScale?, opacityScale?, darkMode? }) }` | **Preferred for fiery hot exhaust / rockets / afterburners:** nested incandescent supersonic core with Mach shock diamonds + turbulent fiery crimson outer shear sheath + fast kinetic ember streaks. |
| `flowRibbon` | `{ curves: [number, number, number][][], radius?, color, colorStops?: { start, mid?, end?, midAt? }, speed?, particleCount?, opacity?, swirlAmp?, swirlFreq? }` → returns `{ group, update(dt, { speedScale?, opacityScale?, radiusScale?, colorHex? }) }` | **For narrow channeled conduits/throats:** feathered crossed orthogonal aerodynamic ribbon shader with multi-harmonic scrolling wisps, optional 3-stop axial thermal gradient (`colorStops`), and fine wind-mote speed needles. |
| `createClayMaterial` | `(tone?: MonochromeKey, { roughness?, metalness?, side? })` | Color-locked PBR matte-clay / satin-metal material compatible with Dim & Illuminate. |
| `addArchitecturalEdges` | `(mesh, thresholdDeg = 18, { color?, opacity? })` | Attaches crisp `EdgesGeometry` architectural contour lines to custom Three.js meshes. |
| `MONOCHROME_TOKENS` / `ACCENT_TOKENS` | Const hex maps | Strict color-lock palette constants. |

### Minimal Assembly Example (~32 lines)

```js
import {
  ACCENT_TOKENS, baseMount, bladeRing, createStudioStage,
  cutawayCylinder, flowRibbon, shaft,
} from "../../src/studio/engine-a.ts";

export function mount(canvas, ctx = {}) {
  const stage = createStudioStage(canvas, {
    theme: ctx.theme,
    frustumSize: 6.2,
    cameraPresets: { hero: { position: [8.5, 4.6, 9.2], target: [0, -0.25, 0], zoom: 1.0 } },
  });
  stage.root.add(baseMount({ y: -2.0, radius: 3.8 }));

  const casing = cutawayCylinder({ x0: -2, length: 4, rOuter: 1.6, rInner: 1.44, openDeg: 145, tone: "clayLight" });
  const rotor = bladeRing({ x: -1.4, rHub: 0.38, rTip: 1.38, blades: 16, noseLen: 0.65, tone: "clayLight", hubTone: "graphite" });
  const axle = shaft({ x0: -1.5, length: 3.2, r: 0.14, collars: 3, tone: "graphite" });
  const flow = flowRibbon({ curves: [[[-2.8, 0.9, 0.4], [-0.4, 1.0, 0.4], [2.8, 0.85, 0.4]]], color: "cobalt", speed: 0.6 });

  stage.registerPart("casing", casing, { anchor: [0, 1.5, 0.5], accent: "cobalt" });
  stage.registerPart("rotor", rotor, { anchor: [-1.4, 1.2, 0.4], accent: "orange" });
  stage.registerPart("axle", axle, { anchor: [0.2, -0.1, 0.2], accent: "orange" });
  stage.registerPart("flow", flow.group, { anchor: [1.4, 0.95, 0.4], accent: "cobalt" });

  return {
    setFocus: (ids, acc) => stage.setFocus(ids, acc),
    setReveal: (ids) => stage.setReveal(ids),
    setCamera: (p, z) => stage.goToCamera(p, z),
    resetCamera: () => stage.resetCamera(),
    setTheme: (t) => stage.setTheme(t),
    resize: () => stage.resize(),
    getCalloutPos: (id) => stage.projectAnchor(id),
    update(dt, sim = {}) {
      const spin = (1.5 + 3.0 * (sim.speed ?? 0.8)) * dt;
      rotor.rotation.x += spin;
      axle.rotation.x += spin;
      flow.update(dt, { speedScale: 0.7 + (sim.flowRate ?? 0.8), colorHex: ACCENT_TOKENS.cobalt });
      stage.render(dt);
    },
  };
}
globalThis.STUDIO_SCENE = { mount };
```

*Flagship references:* `examples/turbofan-studio/` (aerospace rotary cutaway) and `examples/venturi-atomizer/` (3D cutaway fluid/vessel atomizer using `glassVessel`, `liquidVolume`, `pistonPlunger`, `mistCone`, and `flowRibbon`).

---

## 5. Engine C — 2D Tactile Conceptual Studio (`src/studio/engine-c.ts`)

Use Engine C for **every conceptual or abstract topic** (algorithms, data structures, protocols, distributed systems, ML/transformers, math, finance, circuits/logic).

**Design Mandate (Zero SaaS Dashboards):** Never build conceptual diagrams out of nested dashed boxes, stacked headers, top operation banners, or badge pill soup. Treat abstract concepts like **Braun / Dieter Rams tactile instruments** on warm drafting paper (`#f6f5f0`):
- **Intentional Light-Faithful Ceramic Tiles on Dark Obsidian:** In dark mode, the stage switches to `#111317` obsidian while keeping **matte-ivory ceramic tiles (`#eceae2`) with crisp dark ink (`#1b1b19`)** — this is intentional high-contrast industrial-instrument styling, never muddy dark-on-dark cards.
- **Zero nested dashed SaaS boxes** — group regions with generous negative space and one quiet uppercase mono eyebrow (`HASH MAP`, `RECENCY RAIL`).
- **Zero top operation banner & zero badge soup** — render pure data tokens (bold key + tiny muted value underneath); let slot position and spring lift-arc motion carry rank & state instead of printing badges.
- **Single Active Thread** — inactive pointers stay whisper-thin (`12–15%` opacity) smooth cubic Bézier arcs; only the active pointer illuminates with a single animated pulse dot.
- **Tactile instruments over bare box-and-arrow flowcharts** — do not build an Engine C scene solely out of `stageNode` boxes and `arcLink` trees when the topic has pipelines, queues, token sequences, active worker pools, or message channels. Map sequential stages/keys/tokens/registers to `strip`, active pools/queues/windows/rails to `track`, and directional packet/message lanes to `flowPipe` (with canonical `±laneOffset` for opposite-direction pipes so labels never collide). Keep `stageNode` for discrete endpoints (e.g., Client/Server, Orchestrator/Result), state-machine states, or true tree/graph vertices.
- **Max 1 outer-margin callout per step** — place it cleanly outside the instrument using `place: "top"` or `place: "bottom"`, and pass `hint: ""` to `studioPage()` so flat 2D conceptual stages have zero overlapping labels and zero 3D orbit chrome.

### The 5 Locked Braun/Rams Kinetic Primitives + Pruning (`stage`)

| Method on `stage` | Exact TypeScript Spec Options | Purpose |
| :--- | :--- | :--- |
| `stage.strip(id, spec)` | `{ x, y, eyebrow?, items: [{ id, key, active?, occupied?, dimmed?, accent? }], itemW?, itemH?, gap?, group?, visible? }` | Razor-thin mechanical switchboard / index strip (hash maps, memory tapes, token strips, logic registers). Active keycap physically depresses with a glowing dot underneath. |
| `stage.track(id, spec)` | `{ x, y, eyebrow?, slots, tiles: [{ id, key, sublabel?, state?: "idle"\|"active"\|"promoted"\|"evicting", accent? }], evictedTiles?, slotW?, slotH?, gap?, evictEdge?, leftTick?, rightTick?, evictLabel?, showLinks?, group?, visible? }` | Physical milled rail with recessed numbered cavities (`01..0N`), subtle hairline end-cap ticks (`\|← MRU`, `LRU →\|`), open `evict ↘` drop-off edge, and built-in **parabolic lift-arc spring reorder & slide-off eviction physics**. |
| `stage.arcLink(id, spec)` | `{ from, to, active?, pulse?, accent?, curveDip?, pulseSpeed?, group?, visible? }` | Smooth cubic Bézier tension thread tracking live spring positions. Dims to whisper-thin 14% ink when inactive; illuminates with a single gliding pulse dot when active. |
| `stage.stageNode(id, spec)` | `{ x, y, w?, h?, r?, shape?: "tile"\|"circle", value, sublabel?, state?: "idle"\|"active"\|"muted", accent?, group?, visible? }` | Minimal tactile ceramic tile or instrument dial circle for trees, graphs, state machines, logic gates, attention heads, and B-trees. |
| `stage.flowPipe(id, spec)` | `{ from, to, rate?, active?, accent?, label?, laneOffset?, arrowhead?, group?, visible? }` | Clean hairline conduit with smooth animated packet beads and directional arrowhead (`arrowhead !== false`) for TCP handshakes, queues, ML pipelines, signal busses, and financial ledgers. Use `laneOffset` (px perpendicular offset, e.g. `+14`/`-14`) for parallel bidirectional lanes; `label` preserves exact capitalization (e.g. `SYN-ACK`, `HTTP/2`, `O(1)`). |
| `stage.removeMissing(activeIds)` | `(activeIds: Set<string> \| string[])` | **Always call at the end of dynamic sync** to remove stale `arcLink`, `flowPipe`, or `stageNode` IDs no longer present on the current step or variant! |

### Minimal Assembly Example (~34 lines)

```js
import { createEditorialStage } from "../../src/studio/engine-c.ts";

export function mount(canvas, ctx = {}) {
  const stage = createEditorialStage(canvas, { width: 1120, height: 640, theme: ctx.theme });

  return {
    setFocus: (ids, acc) => stage.setFocus(ids ?? null, acc || undefined),
    setReveal: (ids) => stage.setReveal(ids ?? null),
    setCamera: (p, z) => stage.setCamera(p || "overview", z),
    resetCamera: () => stage.resetCamera(),
    setTheme: (t) => stage.setTheme(t),
    resize: () => stage.resize(),
    getCalloutPos: (id) => stage.projectAnchor(id),
    update(dt, sim = {}) {
      const activeIds = new Set(["hashmap", "rail"]);
      stage.strip("hashmap", {
        x: 310, y: 152, eyebrow: "HASH MAP",
        items: ["A", "B", "C", "D"].map((k) => ({
          id: `slot_${k}`, key: k, occupied: sim.keys.includes(k), active: sim.activeKey === k, accent: "cobalt",
        })),
      });
      stage.track("rail", {
        x: 244, y: 376, eyebrow: "RECENCY RAIL", slots: sim.capacity, evictEdge: true,
        tiles: sim.order.map((e) => ({
          id: `tile_${e.key}`, key: e.key, sublabel: String(e.val),
          state: e.key === sim.activeKey ? "active" : "idle", accent: "teal",
        })),
        evictedTiles: sim.evicted
          ? [{ id: `tile_${sim.evicted.key}`, key: sim.evicted.key, sublabel: String(sim.evicted.val), state: "evicting", accent: "ember" }]
          : [],
      });
      for (const e of sim.order) {
        const arcId = `arc_${e.key}`;
        activeIds.add(arcId);
        stage.arcLink(arcId, {
          from: `slot_${e.key}`, to: `tile_${e.key}`,
          active: e.key === sim.activeKey, pulse: e.key === sim.activeKey, accent: "cobalt",
        });
      }
      stage.removeMissing(activeIds);
      stage.render(dt);
    },
  };
}
globalThis.STUDIO_SCENE = { mount };
```

*Flagship reference:* `examples/lru-studio/` (`dist/lru-studio.html`).
