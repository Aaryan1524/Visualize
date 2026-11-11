# Kit reference

The world: x and y on the floor, z up, in units of about one screen pixel at 1×. The camera is a fixed 30° isometric view from the (+x, +y, +z) side. On screen, +x runs down-right and +y down-left; the faces you see are the top, the +y face ("left") and the +x face ("right"). Everything here is in `src/`.

## Marks (`src/core/types.ts`)

Every mark has `key`, the model entity id. The key is identity across steps: the engine matches marks by key and moves them. Common fields:

| Field | Meaning |
|---|---|
| `tone` | `base`, `structure`, `subject`, `muted`, `accent`, `good`, `bad`, `cold`, `hot`. Give each a meaning in the scene's `legend`. |
| `lit` | The one thing to watch in this state: a stronger edge in its own colour. |
| `link` | Entity id(s), space-separated. Pointing at an element lights every element whose ids contain its ids or are contained by them. |
| `enter`, `exit` | `drop`, `grow`, `fade`, `none` / `fall`, `lift`, `fade`, `shrink`, `none`. Exits finish before entries start. |
| `leaving` | In the next state: where the previous mark with this key goes as it leaves (evicted off the end, consumed, delivered). Never drawn at rest. |
| `arc` | Height of a hop over neighbours during the move. |
| `transient` + `travel` | Drawn only while transitioning, along `travel.from` → `travel.to`. |
| `effect` | `pulse` (grows from its base) or `shake`; both cancel out by the end of the move. |
| `title` | Accessible name. |

**`box`**: `at` is the minimum corner and `size` is `[w, d, h]`.
- `radius`: rounded plan corners; side facets are lit by their normal.
- `inset`: a rim on the top face.
- `role`: `foundation` for plates (drop shadow) or `subject` for the things that matter.
- `label` and `labelFace` (`top`, `left`, `right`): upright text on a face. Use a side when something sits on top.
- `surface`: owned details that follow the solid's motion and painter's order:

| Detail | Shape | Notes |
|---|---|---|
| `seam: f`, `seams: [f…]` | Housing lines at height fractions | Wrap the visible sides |
| `panel: { face, from, to, inset }` | Recessed glass on a side face | A label on the same face becomes lit text centred on the panel |
| `vents: { face, from, to, count, length }` | Horizontal slots | Kept inside the flat part of the face |
| `lamp: { face, u, at, radius, tone }` | A status disc | The tone shows state: `good`, `accent`, `bad`, `cold` |
| `fasteners: { inset, radius }` | Four screws on the top | |
| `ticks: { step, majorEvery }` | A scale on the top | Each tick ends on the edge |
| `well: inset` | A recessed floor | |

**`cylinder`**: `at` is the centre of the bottom face, with `radius` and `height`. It is turned: the side is faceted and lit like rounded boxes, with a rim highlight. It takes `label` on the top or the near side.

**`label`**: `at`, `text`, `anchor`, and `size` (`small`, `normal`, `large`).
- `target: { key, at }`: a leader from the text's nearest edge to a point on the named solid.
- `optional: true`: the label is dropped wherever it would sit on a standing part or another label.

**`link`**: `from`, `to` and `via` waypoints, with `width` and `dashed`.
- `cable: true`: a cased cable.
- `layer`: `floor` (on the ground plate, under standing parts) or `overlay`.

### Label rules the renderer enforces

- Labels keep 11–14 px on screen whatever the stage size, and the camera fit grows to contain them.
- A face label that does not fit the room on its face is not drawn, rather than spilling.
- Colliding labels are nudged apart vertically: larger and earlier labels keep their place.
- Leaders are attached after nudging.
- Face-label ink (white or dark) is chosen by measured contrast with the face.

## Parts (`src/parts/`)

Each part returns `{ marks, anchor }`. Spread `marks` into the view, and use `anchor` points for cables, messages, label targets and neighbours.

```ts
const rail = railAssembly({ key: "", slots: 3 });        // 1–12 slots; cell 28×24×17, pitch 42
marks.push(...rail.marks, cartridge({ key: "entry-A", at: rail.slot(0), size: RAIL_CELL, label: "A", tone: "subject" }));

const term = terminal("safe/terminal", [0, 0, 0], { status: "waiting", lit });
const srv = server("safe/server", [96, -4.5, 0], { lamp: "accent" });   // lamp tone shows activity
const led = ledger("safe/ledger", [214, 12.5, 0], coins);                // one coin per record: { id, tone, lit }
marks.push(...plate("safe/plate", [-18, -20, 0], [254, 80]).marks,
  cable("safe/wire", term.anchor.port, srv.anchor.inPort),
  ...term.marks, ...srv.marks, ...led.marks,
  message("safe/msg-1", term.anchor.outbox, "request"));                 // request = cold, response = good
```

| Part | Footprint | Anchors |
|---|---|---|
| `railAssembly` | `(slots-1)·pitch + cell[0]` long | `slot(i)` (minimum corner of an entry at rest), `anchor.first`, `anchor.last`, `length` |
| `cartridge(mark)` | the size you give | adds radius, inset, seam and the subject role |
| `terminal` | 45 × 26, 32 tall | `port`, `outbox`, `top`, `screen` |
| `server` | 40 × 34, 54 tall | `inPort`, `inbox`, `outPort`, `top`, `front` |
| `ledger` | radius 19, 4.2 per coin | `inPort`, `top`, `front` |
| `keyStore` | 28 × 22 | `top`, `front`; `stored`, `lit`, `pulse` options |
| `plate` | `[w, d]`, at least 40 × 30 | `frontLeft`, `backRight` |

Parts validate their inputs and throw a `RangeError` on impossible sizes or positions.

**Adding a part:** compose boxes and cylinders, give every piece a key under the part's prefix, put detail in `surface`, derive anchors from the same dimensions, add a test (bounds disjoint, supported, anchors on surfaces) and a fixture under `test/fixtures/`.

## Components and maths

- `strip(items)`: chips with `label`, `note`, a `status` of `good`, `accent`, `bad`, `next`, `waiting` or `neutral`, plus `link` and `key`. Chips have a fixed height, so the stage never shifts.
- `totals(items)`: large values with a unit and `key` for checks.
- `tex(source, { display })`: KaTeX in which only `\htmlData` is trusted.
- `linked(ids, body)`: a term linked to entities.
- `grid(values, { rows, cols, link, key, tone, blank, digits })`: a number table.

## Motion and time

`frameAt(t)` is pure. The page at any time is a function of that time alone, so seeking, rewinding and links to `#step=k` are exact.

Per-event `timing` sets the duration. Phases run in a fixed order: exits, then moves, then entries. Non-geometric properties (tone, label) switch at the middle of a move.
