// Bloom filter: the figure, on Visualize's rig with its concept parts (src/rig/parts.ts). Every solid is
// drawn once; each frame only places it, swaps a printed value, or sets a tone by attribute.
//
//   const F = figure(M, camera)   // once per variant
//   F.parts                       // drawings put in the page once: { id, part, svg }
//   F.pose(state)                 // each frame: { items, at } (at: callout anchors on screen)
//
// The world: x along a row of bits, y away from the viewer, z up, mm. The sixteen bits stand in two
// rows of eight on a board, 0 to 7 behind and 8 to 15 in front, the way a textbook wraps a bit array;
// the word's card waits in front of them, and one arrow a hash function runs from the card to the bit
// it picks.

import { arrow, boardDrawing, cardDrawing, cellDrawing, CONCEPT_VIEW, decalAt, fitCamera, placeAt, railCentres, screenOf, valueText } from "../../src/rig/index.ts";
export { RigStage, screenOf } from "../../src/rig/index.ts";
export { practice } from "./story.mjs";

export const VIEW = CONCEPT_VIEW;
export const CELL = { w: 20, d: 20, h: 9, pitch: 25 };
const ROW = 8, ROWY = 44;
const CARD = { w: 34, d: 17, h: 4 };
const CARDY = -40;

/** Where things stand, for a filter of m bits. */
export function layout(M) {
  const rows = Math.ceil(M.m / ROW);
  const bits = Array.from({ length: rows }, (_, r) => railCentres(ROW, CELL.pitch, [0, (rows - 1 - r) * ROWY, 0])).flat().slice(0, M.m);
  const width = (ROW - 1) * CELL.pitch, back = (rows - 1) * ROWY;
  const y0 = CARDY - CARD.d / 2 - 10, y1 = back + CELL.d / 2 + 10;
  return { bits, width, rows, board: { at: [width / 2, (y0 + y1) / 2, 0], w: width + CELL.w + 30, d: y1 - y0 } };
}

/** The camera for one variant, fitted to the board and the bits on it. */
export function cameraFor(M, box) {
  const L = layout(M), pts = [];
  const bw = L.board.w / 2, bd = L.board.d / 2;
  for (const [x, y] of [[-bw, -bd], [bw, -bd], [bw, bd], [-bw, bd]]) pts.push([L.board.at[0] + x, L.board.at[1] + y, -3], [L.board.at[0] + x, L.board.at[1] + y, 20]);
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

/** Where the card stands for a word whose hashes pick `bits`: in front, below their middle. */
export function cardAt(L, bits) {
  const xs = bits.map((b) => L.bits[b][0]);
  const x = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : L.width / 2;
  return [Math.max(CARD.w / 2 - CELL.w / 2, Math.min(L.width - CARD.w / 2 + CELL.w / 2, x)), CARDY, 0];
}

export function figure(M, cam) {
  const L = layout(M), parts = [];
  const once = (id, part, svg) => parts.push({ id, part, svg });
  once("board", "board", boardDrawing(cam, { w: L.board.w, d: L.board.d }));
  const cell = cellDrawing(cam, CELL);
  for (let i = 0; i < M.m; i++) once(`bit${i}`, `bit${i}`, cell);
  // each bit's index, printed on the board in front of it: drawn once, in place
  for (let i = 0; i < M.m; i++) once(`index${i}`, `bit${i}`, `<g transform="${decalAt(cam, [L.bits[i][0], L.bits[i][1] - CELL.d / 2 - 6, 0.05])}">${valueText(String(i), 6, "rig-index")}</g>`);
  once("card", "card", cardDrawing(cam, CARD));

  /**
   * state: { bits: [0|1] as drawn, word: the card's word or null, picked: every bit the word's hashes
   *          pick (where the card stands), shown: [{ fn, bit }] arrows drawn so far, changed: bits this
   *          operation set or cleared, checked: bits it found (tone good when 1, bad when 0) }
   */
  function pose(st) {
    const items = [], at = {};
    items.push({ id: "board", key: 0, transform: placeAt(cam, L.board.at) });
    const changed = new Set(st.changed ?? []), checked = new Set(st.checked ?? []);
    for (let i = 0; i < M.m; i++) {
      const v = st.bits[i], s = L.bits[i];
      const hot = changed.has(i), chk = !hot && checked.has(i);
      const flags = { "t-hot": hot, "t-good": chk && v === 1, "t-bad": chk && v === 0, "t-set": !hot && !chk && v === 1 };
      // back to front, then left to right: a nearer cell is drawn over a farther one
      items.push({ id: `bit${i}`, key: 10 - s[1] * 0.01 + i * 0.0001, transform: placeAt(cam, s), flags });
      items.push({ id: `index${i}`, key: 5, transform: null });
      items.push({ id: `value${i}`, key: 10.00005 - s[1] * 0.01 + i * 0.0001, part: `bit${i}`, transform: decalAt(cam, [s[0], s[1], CELL.h]), svg: valueText(String(v), 10), flags });
      at[`bit${i}`] = screenOf(cam, [s[0], s[1], CELL.h]);
    }
    const card = cardAt(L, st.picked ?? []);
    if (st.word) {
      items.push({ id: "card", key: 20, transform: placeAt(cam, card) });
      items.push({ id: "cardValue", key: 21, part: "card", transform: decalAt(cam, [card[0], card[1], CARD.h]), svg: valueText(st.word, 9, "rig-value rig-on-card") });
    } else items.push({ id: "card", key: 20, hidden: true }, { id: "cardValue", key: 21, hidden: true });
    // one arrow a hash function, from the card's back edge to the near edge of its bit's top; two hashes
    // that pick the same bit arc at different heights
    const lanes = new Map();
    for (let j = 0; j < 8; j++) {
      const w = st.shown?.[j];
      if (!w) {
        items.push({ id: `arrow${j}`, key: 30 + j, hidden: true });
        continue;
      }
      const t = L.bits[w.bit], back = t[1] > 0, lane = lanes.get(w.bit) ?? 0;
      lanes.set(w.bit, lane + 1);
      const n = st.picked.length || 1, from = [card[0] + (j - (n - 1) / 2) * 3.5, card[1] + CARD.d / 2, CARD.h];
      // into the bit's front face, so the head never covers the value printed on its top; an arrow to
      // the back row arcs over the front row
      const to = [t[0], t[1] - CELL.d / 2 - 0.5, CELL.h * 0.55], lift = (back ? 14 : 5) + lane * 6;
      const a = arrow(cam, from, to, { lift, head: 4.6 });
      // (the arrows carry no h1, h2 names: at this size they sat on the cells and read as noise; the
      // caption and the lab print each function's working)
      items.push({ id: `arrow${j}`, key: 30 + j, part: "card", transform: null, svg: a.svg });
    }
    at.card = screenOf(cam, [card[0] - CARD.w / 2, card[1], CARD.h]);
    at.rail = screenOf(cam, [L.bits[0][0] - CELL.w / 2, L.bits[0][1], CELL.h / 2]);
    at.index = screenOf(cam, [L.bits[M.m - ROW][0], L.bits[M.m - ROW][1] - CELL.d / 2 - 6, 0]);
    at.front = screenOf(cam, [L.bits[L.bits.length - 1][0] + CELL.w / 2, L.bits[L.bits.length - 1][1], CELL.h / 2]);
    at.hashed = (st.picked ?? []).map((b) => at[`bit${b}`]);
    return { items, at };
  }
  return { parts, pose, layout: L };
}
