# Concept Rig: Elevating Abstract Concepts & Theories to Machine-Grade Craft

Why this guide exists: the mechanical flagships (`examples/derailleur/`, `examples/escalator/`, `examples/lock/`, `examples/automatic-watch/`) read like plates from a master engineering monograph because they combine sculpted directional-shaded vector geometry (`src/rig/`), a synchronized magnified lens (`View A`), continuous 60 fps dynamics, real `What if` contrasts and an interactive Lab. Earlier concept scenes (`examples/lru-3d/`, `examples/retries/`, `examples/attention/`) reduced theories to rounded boxes and cylinders on flat slabs with no lab and no micro-lens.

`examples/multi-agent/` is the new bar for abstract concepts and theories. Build every systems architecture, distributed protocol, ML mechanism, algorithm or theoretical process to its standard using `src/rig/` + `src/rig/concept.ts` on the shared Drawing page (`src/drawing/`).

## The six principles

1. **Sculpted architectural instruments, never bare slabs.**
   Use `src/rig/concept.ts` (`deckTier`, `hubChassis`, `agentBlade`, `waferStack`, `portValve`, `vaultCore`, `conduitSvg`, `shuttleSvg`) and `src/rig/shapes.ts` (`chamferPlate`, `turned`, `rod`, `tube`, `gearOutline`, `arcOutline`). Every solid carries true outward normals, continuous `oklab` key-light shading, heavy silhouettes (`1.5 px`), finer creases (`0.7 px`), metallic specular lines and grounded contact shadows in razor-sharp vector SVG.
2. **Spatial hierarchy by plane or depth.**
   Separate distinct conceptual responsibilities in 3D space (for example Control Plane → Execution Plane → Tools & Memory Plane on chamfered decks with steel standoffs), rather than flattening everything onto one tray.
3. **Dual-lens storytelling (Macro 3D Topology + Synchronized `View A` Inspector).**
   Pair the 3D rig on the left/centre with a live synchronized `View A` technical frame on the top-right (`inspectorFrame`, `ganttTraceSvg`, `budgetMetersSvg`, or a domain-native state/math/loupe view). Every packet or state change on the 3D rig must match the live cursor, gauge or phase badge in `View A` at the exact millisecond.
4. **Physical evidence of limits and failure modes.**
   Never bury limits in captions. Draw a calibrated capacity collar (`waferStack` with a red cliff ring where overflow slices turn `ruby`), dashed fault conduits, bouncing retry shuttles or slipping clutches so the causal failure reads at a single glance.
5. **Continuous 60 fps motion, draw once then move.**
   Pre-render every solid template into `<defs>` once; each animation frame only swaps `<use>` hrefs and applies lightweight 2D transforms (`translate` or `moveInPlane`). Keep `check-drawing.mjs` playback p95 well under 8 ms (typically 1–3 ms).
6. **Full interactive depth on concepts too.**
   Every Concept Plate ships on `src/drawing/page.mjs` with:
   - **Problem first** (Step 0 states the concrete bottleneck and number that makes the idea necessary);
   - **One prediction** before the causal mechanism;
   - **The second idea** (the failure mode or safeguard the field teaches next, e.g. Verifier Gate after parallel workers);
   - **What if** comparing two genuine architectures computed by the same executable model (e.g. Parallel Orchestrator vs Single Monolithic Agent);
   - **Interactive Lab** (`DATA.lab`) where readers tune real parameters and see the 3D rig, `View A`, readouts and verdict react live;
   - **Now you try** seeded model-generated questions + **Kokoro voice narration** + **Correctness Audit** (`src/claims/audit.mjs` + independent `review.json`).

## Reusable Concept Rig instruments (`src/rig/concept.ts`)

| Instrument | Use it for | Key visual craft |
|---|---|---|
| `deckTier` | Architectural layers / planes (Control, Compute, Storage, Network) | Chamfered slab, projected blueprint grid (`rig-deck-grid`), steel corner standoffs |
| `hubChassis` | Orchestrators, routers, schedulers, consensus leaders, load balancers | Octagonal beveled housing, alloy bezel ring, telemetry dome, live phase needle |
| `agentBlade` | Specialist workers, microservices, model experts, compute nodes | Chamfered plinth + ceramic hood, machined cooling fins, live status beacon |
| `waferStack` | Context windows, memory buffers, queues, token budgets, ledgers | Counted beveled wafers beside a calibrated post with red `ruby` cliff collar |
| `portValve` | External tools, APIs, semaphores, rate-limit gates, circuit breakers | Turned flanged cylinder, brass/alloy collar, semantic status cap |
| `vaultCore` | Shared artifact stores, databases, checkpoints, vector stores | Stepped grooved cylinder with sealed commit ring |
| `conduitSvg` + `shuttleSvg` | Multi-tier data buses, RPC channels, token streams, event pipes | Routed 3D casing + active semantic inner stroke + gliding 3D hexagonal shuttles |
| `inspectorFrame` + `ganttTraceSvg` + `budgetMetersSvg` | Synchronized `View A` trace, critical-path timeline & capacity gauges | Editorial monograph frame, live orange playhead, dashed threshold cliff line |

## Material semantics (`src/rig/rig.css`)

Keep structural parts neutral (`frame`, `ceramic`, `steel`, `alloy`, `obsidian`, `slate`) and reserve semantic materials for at most three to four meanings listed in the title block legend:

- `cobalt`: primary compute / planning / active safe state / springs
- `amber`: external I/O / tool calls / waiting / queues
- `teal`: verified / compressed / committed / healthy completion
- `subject` (vermilion): the single followed moving part, playhead, or primary highlight
- `ruby`: faults, timeouts, retries, jewel bearings, or tokens past a hard cliff
- `brass`: precision horological gears, collars, and mechanical drums

## Verification gate

Build with `node examples/<name>/build.mjs`, record narration with `node examples/<name>/voice.mjs`, run an independent review via `scripts/review-brief.mjs`, and pass:

```sh
node --test examples/<name>/model.test.mjs
node scripts/check-drawing.mjs dist/<name>.html   # must print: drawing: passed
```

Then shoot every step in both light and dark themes and visually inspect callout clearance, View A alignment, leader lines after switching `What if`, and detail sharpness.
