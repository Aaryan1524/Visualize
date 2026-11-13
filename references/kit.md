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
| `owner` | The part this piece belongs to; parts set it. Focus lights all pieces of an owner together. |
| `emphasis` | 0–1, set by the engine from the step's focus. Receding marks mix toward the stage colour (opaque, so painter's order holds). Plates and labels never recede. |
| `textRole` | `name`, `status`, `value` or `symbol`: shared typography, preserving the authored text. Values use mono/tabular numerals; names, statuses and symbols use the main face. |

**`box`**: `at` is the minimum corner and `size` is `[w, d, h]`.
- `radius`: rounded plan corners; side facets are lit by their normal.
- `inset`: a rim on the top face.
- `role`: `foundation` for plates (drop shadow) or `subject` for the things that matter.
- `label` and `labelFace` (`top`, `left`, `right`): upright text on a face; screen text follows the side panel’s plane. Use a side when something sits on top.
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
const rail = railAssembly({ key: "", slots: 3 });        // 1–16 slots; cell 28×24×17, pitch 42
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
| `railAssembly` | `(slots-1)·pitch + cell[0]` long | `slot(i)` (minimum corner of an entry at rest), `front(i)` (floor spot for a marker, straight below the slot on screen), `port(i)` (with `ports: true`), `anchor.first`, `anchor.last`, `length`. `slotLabel: i => name` names slots (never dropped); the default numbers are optional; `null` draws none |
| `ringAssembly` (`flow.ts`) | plinth radius `radius + 16`; 3–16 slots, slot 0 at the back, clockwise on screen | `slot(i)` (pad top centre), `outside(i)` (floor spot for a marker), `side(i)` (where that marker's name goes), `angle(i)`, `anchor.centre`, `anchor.front`. Same `slotLabel` rule |
| `puck(mark)` | radius 7.5, 9 tall | an entry on a ring slot; value on top |
| `marker(key, at, name, { tone, lane, side, height, hop })` | foot radius 3.4, 30 tall | `tip`, `foot`. Hops over what it passes (`arc` 26). `lane` 1–3 stands a second pointer beside the first on one slot. Its name is pinned to its cap and never dropped |
| `reservoir(key, centre, { capacity, items, unit })` | radius 17; 3.6 per item; up to 20 | `top` (where the next item lands), `take` (the top item), `front`, `capacity` (top of the capacity post). Items alternate radius so the stack can be counted; they `drop` in |
| `source(key, over, { rate, height })` | column 36 behind `over`, hopper `height` above it | `out` (the hopper's mouth), `body`. Its rate is written beside it. Put it over a reservoir so dropped items fall from it |
| `gate(key, at, { open, lit })` | 8 × 30, lane along +x | `in`, `out`, `reject` (where turned-away requests go), `top`. `open: true` raises the bar, `false` lowers it, `null` is idle |
| `cartridge(mark)` | the size you give | adds radius, inset, seam and the subject role |
| `terminal` | 45 × 26, body top 27 (slot top 28.2) | `port`, `outbox`, `top`, `screen` |
| `server` | 40 × 34, 42 tall | `inPort`, `inbox`, `outPort`, `top`, `front` |
| `ledger` | radius 19, 4.2 per coin | `inPort`, `top`, `front` |
| `keyStore` | 28 × 22 | `top`, `front`; `stored`, `lit`, `pulse` options |
| `plate` | `[w, d]`, at least 40 × 30 | `frontLeft`, `backRight` |

Parts validate their inputs and throw a `RangeError` on impossible sizes or positions.

**Pick the part from the field's picture, not the other way round.** If the concept is circular, use the ring; if a caller takes something from a stock, show the stock, where it is refilled and the gate where it is taken, and send what is taken to the caller (`leaving`). A pointer stands at its slot as a `marker`.

**Adding a part:** compose boxes and cylinders, give every piece a key under the part's prefix, put detail in `surface`, derive anchors from the same dimensions, add a test (bounds disjoint, supported, anchors on surfaces) and a fixture under `test/fixtures/`.

## Components and maths

- `strip(items)`: chips with `label`, `note`, a `status` of `good`, `accent`, `bad`, `next`, `waiting` or `neutral`, plus `link` and `key`. Chips have a fixed height, so the stage never shifts.
- `totals(items)`: large values with a unit and `key` for checks.
- `tex(source, { display })`: KaTeX in which only `\htmlData` is trusted.
- `linked(ids, body)`: a term linked to entities.
- `grid(values, { rows, cols, link, key, tone, blank, digits })`: a number table.
- `sequence({ lanes, messages, marks, now, until, unit })`: a sequence diagram for a `place: "side"` panel. Lanes run left to right and time runs down. Messages up to `now` are drawn send to arrival, and those sent or arriving at `now` are lit. A `lost` message stops halfway with a cross. `marks` are moments on a lane (a timer firing); `ghost` marks show what would have happened. The panel keeps one height at every step. Give messages the stage entity's id as `link`.
- Cables: a toned cable shows state at 1× (in use, carrying, failing); leave idle ones untoned.

## Focus

In editorial scenes the engine computes each step's focus: the owners of marks that changed since the previous step. Changed means moved, appeared, changed tone or text, or is leaving or in flight. Everything else recedes to `RECEDE` (0.42).

- Override per step with `teaching.focus: ["safe/server", "unsafe/ledger"]`, or `"all"`.
- If nothing focused is still drawn at rest, nothing recedes.
- Give a message that is absorbed by a part that part as its `owner`, so the receiver lights up.
- The `focus` check compares the drawn emphasis with the model's and requires receding solids to look different.

## Motion and time

`frameAt(t)` is pure. The page at any time is a function of that time alone, so seeking, rewinding and links to `#step=k` are exact.

Per-event `timing` sets the duration. Phases run in a fixed order: exits, then moves, then entries. Non-geometric properties (tone, label) switch at the middle of a move.
