# Concept Rig: Instruments for Layered Systems & Abstract Concepts

`src/rig/concept.ts` provides sculpted architectural instruments for multi-tier systems, distributed protocols, ML architectures, and theoretical processes on the shared Drawing page (`src/drawing/page.mjs`), complementing the flat-board parts in `src/rig/parts.ts` (`examples/bloom/`).

`examples/multi-agent/` demonstrates this route: a 3-tier Concept Plate with per-step camera shots (`src/drawing/camera.mjs`), a synchronized trace lens, studio materials (`references/look.md`), a `What if` architecture contrast, an interactive Lab, and Now you try.

## The six principles

1. **Sculpted instruments in studio materials (`references/look.md`).**
   Use `src/rig/concept.ts` (`deckTier`, `hubChassis`, `agentBlade`, `waferStack`, `portValve`, `vaultCore`, `conduitSvg`, `shuttleSvg`) and `src/rig/shapes.ts` (`chamferPlate`, `turned`, `rod`, `tube`, `gearOutline`, `arcOutline`). Every solid carries true outward normals, continuous `oklab` key-light shading with wide cap-vs-wall contrast, heavy silhouettes (`1.5 px`), finer creases (`0.7 px`), specular lines on lit edges, and soft contact shadows (`plateShadow` for concave or holed parts, `contactShadow` for convex slabs).
2. **Spatial hierarchy by plane or depth.**
   Separate distinct conceptual responsibilities in 3D space (for example Control Plane → Execution Plane → Tools & Memory Plane on chamfered decks with steel standoffs), rather than flattening everything onto one tray. Choose the camera azimuth and elevation from the assembly's shape rather than a fixed angle.
3. **Per-step camera shots (`src/drawing/camera.mjs`) and optional `View A` trace lens.**
   Give every focused step its own `shot`, `subject`, and `around` in `DATA.camera` (at most `2×` zoom, centred in the clear area) so the camera frames what the step teaches instead of staying fixed on the overview; `check-drawing.mjs` fails pages that hold the same framing for more than four steps in a row. When the subject also needs a synchronized timeline or budget readout, pair the 3D rig with a `View A` frame (`inspectorFrame`, `ganttTraceSvg`, `budgetMetersSvg`) marked `data-camera-avoid` so zoomed shots never slide under it.
4. **Physical evidence of limits and failure modes.**
   Never bury limits in captions. Draw a calibrated capacity collar (`waferStack` with a `ruby` cliff ring where overflow slices turn `ruby`), dashed fault conduits, or bouncing retry shuttles so the causal failure reads at a glance.
5. **Continuous 60 fps motion, draw once then move.**
   Pre-render every solid template into `<defs>` once; each animation frame only swaps `<use>` hrefs and applies lightweight 2D transforms (`translate`, `moveInPlane`, or `turningPart()` for any turning thick solid so screen skew stays under `1 px`). Keep `check-drawing.mjs` playback p95 under 8 ms.
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
| `waferStack` | Context windows, memory buffers, queues, token budgets, ledgers | Counted beveled wafers beside a calibrated post with `ruby` cliff collar |
| `portValve` | External tools, APIs, semaphores, rate-limit gates, circuit breakers | Turned flanged cylinder, brass/alloy collar, semantic status cap |
| `vaultCore` | Shared artifact stores, databases, checkpoints, vector stores | Stepped grooved cylinder with sealed commit ring |
| `conduitSvg` + `shuttleSvg` | Multi-tier data buses, RPC channels, token streams, event pipes | Routed 3D casing + active semantic inner stroke + gliding 3D hexagonal shuttles |
| `inspectorFrame` + `ganttTraceSvg` + `budgetMetersSvg` | Synchronized `View A` trace, critical-path timeline & capacity gauges | Technical frame (`data-camera-avoid`), live orange playhead, dashed threshold cliff line |

## Material semantics (`src/rig/rig.css`, `references/look.md`)

Follow the studio restraint and OKLab contrast rules in `references/look.md`. Keep structural bodies neutral (`frame`, `ceramic`, `cell`, `steel`, `alloy`, `obsidian`, `slate`) so tops stay off the stage white and caps separate cleanly from walls in both themes; let out-of-focus parts recede by tone (`--recede`), never by opacity. Reserve semantic materials for one signal colour (`subject`) plus at most three functional meanings listed in the title block legend:

- `subject` (orange): the single followed moving part, playhead, or primary highlight
- `cobalt`: primary compute / planning / active safe state
- `amber`: external I/O / tool calls / waiting / queues
- `teal`: verified / compressed / committed / healthy completion
- `ruby`: faults, timeouts, retries, or tokens past a hard cliff

## Verification gate

Build with `node examples/<name>/build.mjs`, record narration with `node examples/<name>/voice.mjs`, run an independent review via `scripts/review-brief.mjs`, and pass:

```sh
node --test examples/<name>/model.test.mjs
node scripts/check-drawing.mjs dist/<name>.html   # must print: drawing: passed
```

`check-drawing.mjs` runs the camera checks and the look checks (`scripts/lib/look.mjs`: OKLab cap-vs-wall and subject-vs-stage contrast, framing variety, subject span, leader length/crossing, and visibility). Shoot every step in both light and dark themes (`scripts/shoot-steps.mjs`) and inspect callout clearance, `View A` alignment, leader lines after switching `What if`, and detail sharpness.
