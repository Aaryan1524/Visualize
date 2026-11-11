# Visualize visual standard 01 — candidate

Status: implemented for visual review on `feat/premium-redesign`. The reference is payment retries. Acceptance is a visual decision; passing verification is required but does not establish that the style is approved.

## Identity

Clear mechanisms, quiet surfaces. Visualize represents a concept through its own structure and lets a verified sequence explain the behavior. Neutral housings and restrained depth separate structure from coloured evidence. The silhouette should read at normal size before small construction detail becomes visible in a close-up.

The style uses directional surface shading, thickness, painter's order, rounded corners, edge light and contact shadows to create volume. It does not reproduce Anatomy's visual treatment. No upstream drawing implementation or reference artwork is included in this checkpoint.

## Shared code

| Responsibility | Source |
|---|---|
| Paired light/dark material and signal palette, stage, screen, shadow and radius tokens | `src/render/tokens.css` |
| Typography, shell, surface treatments, controls and component rules | `src/render/styles.css` |
| Bundled fonts and licenses | `src/render/fonts.css`, `src/render/fonts/` |
| Shared CSS bundling with inline font assets | `scripts/lib/styles.mjs` |
| Subject geometry and surface orientation | `src/iso/solids.ts`, `src/iso/surface.ts` |
| Terminal/server proportions and surface details | `src/parts/network.ts` |
| Example composition | `examples/retries/scene.ts` |
| Reproducible visual-review captures | `scripts/review-standard.mjs` |

No appearance rule is selected by the retries scene id. Other editorial figures inherit the tokens and fonts. Attention retains its earlier presentation in this checkpoint; this is not the planned rollout to all three examples.

## Colour and materials

| Role | Light | Dark | Meaning |
|---|---|---|---|
| Foundation | `#e1e4e6` | `#303b49` | Fitted supporting plate |
| Structure | `#a8b1ba` | `#65778a` | Mounts, casing, guides |
| Subject | `#c0c7ce` | `#8899aa` | Neutral concept element |
| Muted | `#dce1e5` | `#405265` | Waiting/supporting content |
| Request | `#426fa8` | `#81a8dc` | Request or stored input |
| Processing | `#ad7534` | `#d6a56a` | Processing, cache miss/load |
| Success | `#317b6c` | `#74beaa` | Successful response/record, cache hit |
| Error | `#b34d49` | `#e4928a` | Loss or unwanted duplicate/eviction |

Themes preserve these meanings. Model events choose semantic roles; authors do not put raw colours into scenes. A legend explains the concrete meaning in each domain. Neutral ink marks navigation, keyboard focus and linked selection; those interactions do not introduce an extra outcome colour.

Volumes use the fixed isometric camera and existing normal-based side shading. Top mix is 80%; supporting faces remain distinct from tops. Edge light is thin, with a restrained silhouette. Foundation and subject shadows have separate tokens. The stage is a flat surface; no radial gradients or decorative idle effects. Surface wells and panels are still face graphics, not excavated geometry; more general profiles/recesses remain later capabilities.

## Typography and spacing

- Manrope, locally bundled Latin variable subset, weights 400–700: titles, actions, controls, labels and diagram annotations.
- IBM Plex Mono, locally bundled Latin subset at weight 500: values on the diagram, time, counts and strip values, with tabular numerals.
- Desktop question: 28 px, weight 600, line-height 1.16, tracking −.04 em.
- Current action: 21 px, weight 500, line-height 1.35. Up to 12 words.
- Kicker: 11 px, weight 500, sentence case. Title: up to eight words.
- Diagram labels: existing 11–14 px clamped sizing; essential text must remain readable. Text alternatives and full captions remain in Details.
- Interface controls and notes retain the existing 11 px minimum. Necessary mathematical scripts use the separately checked math policy.
- Card radius 16 px; stage radius 10 px; strip radius 5 px.
- Card inset: 22 px vertically, 28 px horizontally; stage action inset: 24 px vertically, 26 px horizontally. Strip height: 48 px, independent of content, so the camera cannot shift with a changed note.

Standalone pages load the fonts before initial camera measurement. Embedded figures refit when fonts finish loading without changing playback or timeline time. HTML and SVG embed font data. A host bundler importing `styles.css` must handle its CSS imports and WOFF2 assets. The supplied font files cover Latin; other scripts use the system fallback, and need their own typography review before being advertised as supported.

### Diagram text roles

`textRole` selects a shared treatment, not arbitrary per-scene CSS:

| Role | Treatment | Content rule |
|---|---|---|
| `name` | Manrope 500 | Short sentence-case part name |
| `status` | Manrope 500, standard label size | Human-readable status: Ready, Waiting, Retrying, Paid |
| `value` | IBM Plex Mono 500, tabular numerals | Preserve the model's currency, sign, precision and units |
| `symbol` | Manrope 600, larger on a solid | Preserve identifiers and scientific notation exactly, including case |

Identifiers stay upright and centred on their faces; screen statuses follow the side face’s plane with padding in both dimensions. External names and values stay upright with consistent baseline, weight and leader treatment. The renderer never converts case or rewrites model values. Whole numeric annotations default to `value`; authors can override the role. Finished cartridges declare `symbol` even for a numeric key; terminal screens declare `status`. The browser typography audit checks the chosen role's font and weight, plus face-label centring and actual screen-opening containment in both themes. Planted wrong-font and flattened-screen-text styles must fail it.

## Composition

The default explanation fits 1440×900 and 1920×1080 desktop windows, with the diagram, one current action, essential outcomes and playback together. A readable fallback remains for short windows and high zoom.

The reference tightens lane spacing and plate depth, reduces terminal/server height, and places the money annotations clear of the key store. Existing model counts, outcomes and the seekable timeline remain the same. Light/dark rendering uses identical geometry.

The three review moments are:

1. Lost response: step 5 at 65% of its transition, so the lost capsule is still visible. The ledger already has the successful charge.
2. Key lookup and divergence: resting step 8. The keyless system charges again; the keyed system replays its saved response.
3. Outcome: resting step 10, $40 versus $20.

The same camera fits all moments. The review page can switch these moments, theme and the saved previous version. It is a review tool, not new explanation UI.

## Required production flow

Brief → executable model → storyboard → composition → render → mechanical audits → visual critique → verified export.

Each scene declares its causal moment, model-derived values, short action and essential information. Existing audits cover model agreement, depth, replay, visibility, text/contrast, labels, semantic colours, desktop fit and interaction. The reviewer inspects the result at normal size, both themes, at 4× junctions, and during transitions. A screenshot alone is insufficient evidence for motion or teaching.

This checkpoint establishes the visual specification and three rendered moments. The following remain subsequent checkpoints: explicit focus/reveal behavior; typed dynamic attachment references and shared routes; subject-only coverage and stronger geometry audits; full rollout; fresh generation evaluations; stable package exports and distribution. Evaluation prompts must stay held out until those runs.

## Reproduce the review

```sh
pnpm build
node scripts/review-standard.mjs
```

Open `shots/visual-standard/index.html`. Captures include the three moments in light/dark, the outcome at 1920×1080, and 4× front-assembly close-ups. `style-guide.html` displays the actual shared tokens and bundled type in both themes. If a prior version was saved as `before.html`, the review also provides a matched before/after toggle.

Verification results are recorded in `research/PREMIUM_REDESIGN.md` after the final checks complete.
