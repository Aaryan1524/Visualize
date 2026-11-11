# Engine concepts

Twenty candidate architectures: fifteen starting hypotheses and five new ones. **The scores are judgment**, made before and during prototyping. Only the four concepts marked *prototyped* have evidence behind them, which is recorded in [PROTOTYPE_FINDINGS.md](PROTOTYPE_FINDINGS.md).

## Criteria

Each concept is scored 1 (poor) to 5 (strong) on:

| Code | Criterion |
|---|---|
| **G** | Generatability: can a coding agent produce correct artifacts with it reliably? |
| **V** | Validatability: can correctness be checked deterministically? |
| **R** | Reach: how many kinds of concept does it serve well? |
| **Q** | Quality ceiling: how good can the output look? |
| **C** | Cost: lower implementation and per-scene cost scores higher |
| **D** | Distinctiveness: would it make a recognisable product? |

The total is unweighted. The table lists the selected layers first, then the rest in the order they were considered; G and V matter most for this project.

## Concepts

| # | Concept | New capability | Serves well | Serves poorly | G | V | R | Q | C | D | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Temporal world** (event-sourced trace, seekable) *prototyped* | Any instant is a pure function of time; step, scrub, rewind, links | Algorithms, protocols, simulations | Continuous fields, proofs without steps | 5 | 5 | 4 | 3 | 4 | 4 | **25** |
| 2 | **Witness marks** (marks keyed by entity, checked against the model) *prototyped* | The page can be audited against the model | Anything with discrete entities | Continuous imagery | 4 | 5 | 4 | 2 | 4 | 5 | **24** |
| 3 | **Lens stack** (one state, linked representations) *prototyped* | Pointing at one view lights the same entity in all | Maths, ML, data | Purely spatial objects | 4 | 4 | 4 | 4 | 3 | 5 | **24** |
| 4 | **Semantic motion language** | Motions named by meaning (`leaving`, `arc`, travel) | All step-based scenes | Expressive one-off choreography | 4 | 4 | 4 | 3 | 4 | 4 | **23** |
| 5 | **Counterfactual twin worlds** *prototyped* | The same faults, one premise changed, played in sync | Reliability, policy, ablations | Single-path processes | 4 | 5 | 3 | 3 | 4 | 5 | **24** |
| 6 | **Trust-typed ink** | Every claim carries sourced / computed / model / analogy / unverified | Papers, science | (applies everywhere) | 5 | 4 | 5 | 2 | 5 | 4 | **25** |
| 7 | **Observations as tests** | Each step declares what the reader should see; the checker asserts it | All | Aesthetic intent | 4 | 5 | 5 | 1 | 4 | 4 | **23** |
| 8 | Living mathematics engine (value graph behind equations) | Equation terms bound to computed values | Derivations, ML maths | Systems, biology | 3 | 5 | 3 | 4 | 2 | 4 | 21 |
| 9 | Causal animation engine (motion from an executable model) | Physically driven motion | Physics, control | Discrete logic | 3 | 4 | 3 | 4 | 2 | 3 | 19 |
| 10 | Semantic scene graph (declarative entities and relations) | Layout from meaning | Architectures | Time-heavy scenes | 3 | 3 | 4 | 3 | 3 | 2 | 18 |
| 11 | Dataflow cinema (track identity through a system) | Follow one datum end to end | Pipelines, ML | Static structure | 4 | 4 | 3 | 3 | 3 | 3 | 20 |
| 12 | Multiscale explanation (zoom without losing context) | Overview to mechanism | Systems, biology | Small concepts | 2 | 3 | 4 | 5 | 2 | 4 | 20 |
| 13 | Exploded concept engine | Abstract parts separated in depth | Architectures | Processes | 3 | 3 | 3 | 5 | 2 | 3 | 19 |
| 14 | Visual proof engine (steps with logical dependencies) | Proofs as checked transformations | Mathematics | Everything else | 2 | 4 | 2 | 4 | 1 | 5 | 18 |
| 15 | Research figure reconstruction | Original figures re-drawn and animated from data | Papers | Papers without data | 2 | 3 | 2 | 4 | 2 | 4 | 17 |
| 16 | Scientific experiment stage | Controlled experiments and measurements | Science | Software | 3 | 3 | 2 | 4 | 2 | 3 | 17 |
| 17 | Visual analogy composer | Mapping tables from concept to metaphor | Intuition | Exact mechanisms | 2 | 2 | 4 | 4 | 3 | 3 | 18 |
| 18 | Constraint-based world (solved layout and physics) | Consistency by construction | Dense diagrams | Generation speed, determinism | 2 | 4 | 4 | 4 | 1 | 3 | 18 |
| 19 | Generative diagram grammar | Novel compositions from constraints | Static diagrams | Motion | 2 | 2 | 4 | 3 | 2 | 3 | 16 |
| 20 | Hybrid renderer orchestrator | Picks SVG, Canvas or WebGL per scene | Large scenes | Small ones; adds complexity | 3 | 2 | 5 | 4 | 1 | 2 | 17 |

## What was selected

The engine combines 1, 2, 3, 4, 5, 6 and 7. They are not competing architectures: they are layers of one design.

- 1, the temporal world, is the substrate.
- 2 and 7 make it checkable.
- 3 and 5 are two ways of composing views on top of it.
- 4 and 6 are vocabularies the author uses.

Concept 8, the value graph, was the intended source of truth for the maths prototype, but it was not built: equation identity uses an id naming convention. Whether a real value graph pays for itself is still open.

## Deferred, with reasons

- **12 and 13 (multiscale, exploded views):** high craft cost, and the stage vocabulary is still too sparse to make them worth it.
- **15 (figure reconstruction):** needs the paper adapter first.
- **18 and 19 (constraint layout, generative grammar):** solved layouts are hard to keep deterministic and stable across animation frames. Hand placement plus checks proved workable at this scale.
- **20 (orchestrator):** every scene so far fits SVG, so there is nothing to orchestrate yet.

## How this would be re-ranked

The benchmark in the brief, the same prompts with and without the skill under the same budget, is what should replace these judgment scores. It has not been run.
