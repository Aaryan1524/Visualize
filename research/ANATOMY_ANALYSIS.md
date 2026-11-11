# Anatomy: analysis

Anatomy ([github.com/wheresryan22/anatomy](https://github.com/wheresryan22/anatomy), MIT, about 26.7k stars as of 2026-11-11) is an Agent Skill for interactive isometric SVG figures that explain an idea as a physical object. This analysis is based on reading its `SKILL.md`, the kit reference, motion, verification and craft guides, its evals, the source of `kit/iso-kit.ts` and `kit/audit.mjs`, and the `dial-indicator` example build. Its shipped push-button example (`examples/push-button/push-button-light.html` in the skill) was also rendered in headless Chrome next to our LRU figure ([images/lru.png](images/lru.png)); that screenshot is not committed here because it is Anatomy's output. No Anatomy code is used in this repository.

## How it works

**Authoring.** Each figure is a Node build script, about 275 lines for the smallest example, `dial-indicator/build.mjs`. The script calls kit functions that return SVG path strings:

- `slabOf` and `extrude` make prisms from rounded floor plans;
- `cylinder` makes round parts, and `kit/lathe.mjs` makes solids of revolution on any axis;
- `kit/tube.mjs` makes pipes and cables;
- detail helpers add knurls, ticks, coils, seams and screw dots.

Parts are placed by hand with numeric constants (`PLATE`, `MAG`, `DIAL`, `CARRIAGE`…). The script writes one standalone HTML page with the kit inlined. React components mirror the same kit.

**Camera.** `fitProjection` fits a parametric projection (azimuth 45° and elevation 30° by default, both adjustable) around chosen extreme points.

**Shading.** `extrude` buckets visible side faces into four tones by facing, plus a lighter top. Tone roles are fixed: base `lo`, structure `mid`, subject `hi`, and exactly one `lit` accent.

**Depth.** Simple figures sort repeated parts by `depthOf` and split wrapping parts (springs around rods) into back and front halves by hand. Complex figures record each item's true shape in an audit recorder. `settle` then ray-casts every overlapping pair to set the painter's keys, including the replayed frames of an explode animation.

**Motion.** Live code runs a `requestAnimationFrame` loop with exponential follow, sub-stepped springs and envelopes for one-shot events. Static art is built once and moved with transforms; rotating parts are rebuilt per frame. An idle tour plays when nobody interacts. "Use cases" are named model states played by buttons, with the changed parts and numbers tinted in one hue.

**Verification.** Three layers:

- `kit/audit.mjs` proves geometry from recorded shapes: clearances, terminals, support, folds, crowding, coverage of stand-in shapes, profile wobble and depth order;
- `scripts/lines.mjs` checks that every drawn line ends on something;
- `scripts/capture.mjs` and `scripts/drive.mjs` take headless-Chrome screenshots, close-ups and slowed contact sheets.

The skill insists on reading every PNG at 4× zoom.

## Strongest ideas

1. **One model drives motion, readout and caption.** The skill tells authors to write the truth as a small pure module first.
2. **Verification is part of the kit and is falsifiable.** The audit reports failures in a form that points at the fix. The 3D browser checks each run a control that must fail first, and the orbit audit lists a planted fault for each of its lines.
3. **A representation ladder.** The real object first, then the concept's own parts, and an analogy only with a part-to-concept table. This blocks the default of reaching for a metaphor.
4. **Craft rules written as rejected work.** "Lines resolve", "a texture ends on a real edge or fades", one lit accent and density at 4× zoom, each with the fault that taught it.
5. **Honest sizing.** Figure, Hero or Epic, with time estimates, and an Epic is not started without consent.

## Limits for a general explanation engine

1. **One representation.** Everything becomes an isometric physical object. Equations, matrices, message timelines and proofs have no native form; the closest is text drawn on a face.
2. **The audit proves physical coherence, not explanatory truth.** Nothing compares a number shown on the page with the model; the readout is trusted to come from the same code.
3. **Time is a live loop.** There is no seekable timeline, so there is no "step 7", no scrubbing, and no check that a state is the same however it was reached.
4. **High cost per figure.** Hand-placed geometry of 275 lines for the smallest example, and hours for a Hero. Its own page reports about 1 h 54 min for a watch and about 14 h for a turbofan.
5. **No notion of sources or trust.** Nothing distinguishes a sourced value from a computed or illustrative one.

## What this project took, and what it did differently

| Anatomy | This engine |
|---|---|
| Physical object as the explanation | Isometric stage plus flat linked panels for maths and data |
| Hand-placed parts, rich detail | Keyed marks from a view function, sparse detail so far |
| Live spring loop | Pure `frameAt(t)` over a trace; step, scrub, rewind, `#step=` links |
| Geometry audit over recorded shapes | Page-versus-model checks over the rendered DOM, plus an independent ray-cast depth check |
| Monochrome tones, one lit accent | Semantic colour tones, trust labels on every step |

The side-by-side screenshot shows the two are visually distinct: Anatomy's paper-white hairline machine against our coloured blocks with labels and panels. It also shows that Anatomy's level of craft is well beyond ours today. Closing that gap without copying its look is the main open design problem.

## Article follow-up: construction and interaction

Read [Ryan's “How I built it”](https://skills.wheresryan.sh/anatomy/how-i-built-it) on 2026-11-11 and inspected the installed dial-indicator/test-rig geometry and motion sources. The article's central method is repeated visual criticism turned into reusable rules. Geometry, line markup and appearance receive distinct checks. Interaction follows the mechanism, and close-ups plus motion sequences expose defects a resting screenshot misses.

### Application to Visualize

These are implementation recommendations for this project, not additional shipped capabilities:

- Model the visible mechanism of lookup, stored response and replay; let the changing relationship carry more of the explanation than the actor housing.
- Add focus/reveal to teaching beats and semantic attachment references to parts. Keep `frameAt(t)` pure so rewind, export and comparisons stay reproducible.
- Offer meaningful scenario controls: which message is lost, whether a key is supplied, and retry timing. Regenerate the model trace from each choice and keep keyboard/reduced-motion behavior equivalent.
- Add part inspection and a selected-operation view where these answer a real question. Use smooth transitions with continuous event emphasis rather than decorative motion.
- Extend real shape/support/route records before introducing richer profiles or arbitrary rotation. Measure render cost and motion continuity for each new capability.
- Keep vector SVG as the primary renderer for crisp documents and exports. Evaluate a canvas/shader layer only for an effect essential to a future subject. Camera rotation is a separate optional capability with substantial depth-order and interaction testing.
- Record visual failures and remedies beside the reference captures. Preserve your own colour/type identity, minimal explanation copy and desktop viewport contract.

The typography checkpoint implements the four shared text roles and a falsifiable font/weight audit. It does not implement the interaction proposals above; those remain the following review checkpoints.
