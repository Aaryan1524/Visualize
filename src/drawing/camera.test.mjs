import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraKit } from "./camera.mjs";

const K = cameraKit();
const C = { x0: 4000, y0: 150, x1: 9300, y1: 6400 }; // a clear area, in figure units
const SHORT = Math.min(C.x1 - C.x0, C.y1 - C.y0);
const rng = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const box = (x, y, w, h) => ({ x0: x, y0: y, x1: x + w, y1: y + h });
const inside = (r, c, tol = 1e-6) => r.x0 >= c.x0 - tol && r.x1 <= c.x1 + tol && r.y0 >= c.y0 - tol && r.y1 <= c.y1 + tol;
// the fastest the picture moves over a track, sampled at 240 Hz, in clear-area short sides a second
const fastest = (track, t0, t1, cut = false) => {
  let top = 0, prev = K.at(track, t0, false, cut);
  for (let t = t0 + 1 / 240; t <= t1; t += 1 / 240) {
    const m = K.at(track, t, false, cut);
    top = Math.max(top, K.dist(prev, m, C) * 240);
    prev = m;
  }
  return top;
};

test("camera: the kit runs on its own, as the page serializes it", () => {
  const again = new Function(`return (${cameraKit.toString()})();`)();
  assert.deepEqual(Object.keys(again), Object.keys(K));
  assert.deepEqual(again.frame(box(6000, 3000, 400, 300), C), K.frame(box(6000, 3000, 400, 300), C));
});

test("camera: a shot centres its parts in the clear area, zoomed no further than the cap and never below 1", () => {
  const r = rng(3);
  for (let i = 0; i < 200; i++) {
    const w = 50 + r() * 6000, h = 50 + r() * 6000, b = box(3000 + r() * 6000, r() * 5000, w, h);
    const m = K.frame(b, C);
    assert.ok(m.s >= 1 && m.s <= K.CAP + 1e-9, `scale ${m.s}`);
    const on = K.onScreen(m, b);
    if (m.s > 1 || inside(b, C)) {
      // fits: inside the clear area (with its padding) and centred
      if (m.s > 1) {
        assert.ok(inside(on, C, 1e-3), `bounds ${JSON.stringify(on)} leave the clear area`);
        assert.ok(Math.abs((on.x0 + on.x1) / 2 - (C.x0 + C.x1) / 2) < 1e-6 && Math.abs((on.y0 + on.y1) / 2 - (C.y0 + C.y1) / 2) < 1e-6);
      } else assert.deepEqual(m, K.ID, "already in the clear area at full size: the camera stays put");
    }
  }
  assert.equal(K.frame(box(6000, 3000, 10, 10), C).s, K.CAP, "a small part is zoomed to the cap, no further");
  assert.deepEqual(K.frame(null, C), K.ID, "no bounds: the whole figure");
});

test("camera: framed() asks for the part inside the clear area and at least MIN_FRAC of its shorter side", () => {
  const b = box(6000, 3000, 400, 300);
  assert.ok(K.framed(b, K.frame(b, C), C));
  assert.ok(!K.framed(box(6000, 3000, 0.05 * SHORT, 0.05 * SHORT), K.ID, C), "too small to read");
  assert.ok(K.framed(box(6000, 3000, 0.07 * SHORT, 0.05 * SHORT), K.ID, C));
  assert.ok(!K.framed(box(9200, 3000, 400, 300), K.ID, C), "partly outside");
  assert.ok(!K.framed(null, K.ID, C));
});

test("camera: between two shots the zoom changes geometrically and the view's centre moves straight", () => {
  const a = K.frame(box(5000, 1000, 2000, 2000), C), b = K.frame(box(8000, 5000, 200, 200), C);
  assert.deepEqual(K.lerp(a, b, 0, C), a);
  assert.deepEqual(K.lerp(a, b, 1, C), b);
  const mid = K.lerp(a, b, 0.5, C);
  assert.ok(Math.abs(mid.s - Math.sqrt(a.s * b.s)) < 1e-9);
  const centre = (m) => [((C.x0 + C.x1) / 2 - m.x) / m.s, ((C.y0 + C.y1) / 2 - m.y) / m.s];
  const [ca, cb, cm] = [centre(a), centre(b), centre(mid)];
  assert.ok(Math.hypot(cm[0] - (ca[0] + cb[0]) / 2, cm[1] - (ca[1] + cb[1]) / 2) < 1e-6);
});

test("camera: a move takes long enough that the picture never moves faster than SPEED", () => {
  const r = rng(7);
  for (let i = 0; i < 60; i++) {
    const a = K.frame(box(4500 + r() * 4000, 500 + r() * 5000, 40 + r() * 3000, 40 + r() * 3000), C);
    const b = K.frame(box(4500 + r() * 4000, 500 + r() * 5000, 40 + r() * 3000, 40 + r() * 3000), C);
    const d = K.duration(a, b, C);
    if (K.same(a, b)) {
      assert.equal(d, 0);
      continue;
    }
    assert.ok(d >= K.MIN_DUR);
    const track = { shot: a, moves: [{ t0: 0, d, from: a, to: b, ids: [] }], clear: C };
    assert.ok(fastest(track, 0, d) <= K.SPEED + 1e-6, `${fastest(track, 0, d)} over ${K.SPEED}`);
  }
});

const SHOT = K.frame(box(5500, 2000, 2000, 2000), C);
const FAR = box(8600, 5800, 150, 150); // a small part away from the shot
const NEAR = box(6000, 2500, 900, 900); // a part the shot already frames well

test("camera: a part the step's shot frames well needs no move; a step that arrives from another camera eases in first", () => {
  const t = K.stepTrack({ start: 10, end: 30, shot: SHOT, links: [{ a: 15, b: 16, ids: ["near"], bounds: NEAR }] }, C);
  assert.equal(t.moves.length, 0);
  assert.deepEqual(K.at(t, 15.5), SHOT);
  const e = K.stepTrack({ start: 10, end: 30, shot: SHOT, from: K.ID, links: [] }, C);
  assert.equal(e.moves.length, 1);
  assert.ok(e.moves[0].enter && e.moves[0].t0 === 10 && e.enter > 0);
  assert.deepEqual(K.at(e, 10), K.ID, "at the step's start: the camera it arrived with");
  assert.deepEqual(K.at(e, 10 + e.enter), SHOT);
  assert.deepEqual(K.at(e, 10, false, true), SHOT, "not arriving from the step before: straight to the shot");
});

test("camera: a voice-led shot arrives before its words, holds, and comes back to the step's shot", () => {
  const t = K.stepTrack({ start: 10, end: 40, shot: SHOT, links: [{ a: 20, b: 21, ids: ["far"], bounds: FAR }] }, C);
  assert.equal(t.moves.length, 2);
  const [go, back] = t.moves;
  assert.ok(go.t0 + go.d <= 20 + 1e-9, "framed by the time the words begin");
  assert.ok(K.framed(FAR, K.at(t, 20), C));
  assert.ok(back.t0 >= go.t0 + go.d + K.HOLD - 1e-9, "held at least HOLD");
  assert.ok(back.t0 >= 21 - 1e-9, "held until the words end");
  assert.deepEqual(back.to, SHOT);
  assert.ok(back.t0 + back.d + K.HOLD <= 40 + 1e-9);
  assert.ok(fastest(t, 10, 40) <= K.SPEED + 1e-6);
});

test("camera: links too close to have a shot each share one; the camera never chases every word", () => {
  const OTHER = box(4300, 5900, 150, 150);
  const t = K.stepTrack({ start: 10, end: 40, shot: SHOT, links: [{ a: 20, b: 20.3, ids: ["far"], bounds: FAR }, { a: 20.5, b: 21, ids: ["other"], bounds: OTHER }] }, C);
  const voiced = t.moves.filter((m) => m.ids.length);
  assert.equal(voiced.length, 1, "one shot for both");
  assert.deepEqual(voiced[0].ids.sort(), ["far", "other"]);
  assert.ok(K.framed(FAR, voiced[0].to, C) || inside(K.onScreen(voiced[0].to, FAR), C));
  assert.ok(inside(K.onScreen(voiced[0].to, OTHER), C));
  // every stop between moves lasts at least HOLD
  for (let i = 1; i < t.moves.length; i++) assert.ok(t.moves[i].t0 - (t.moves[i - 1].t0 + t.moves[i - 1].d) >= K.HOLD - 1e-9);
});

test("camera: with no room to come back between two links, the camera goes from one shot straight to the next", () => {
  const OTHER = box(4300, 5900, 150, 150);
  const t = K.stepTrack({ start: 10, end: 40, shot: SHOT, links: [{ a: 20, b: 21, ids: ["far"], bounds: FAR }, { a: 24.2, b: 25, ids: ["other"], bounds: OTHER }] }, C);
  assert.deepEqual(t.moves.map((m) => m.ids.join() || "shot"), ["far", "other", "shot"]);
  // with room, it comes back in between
  const spaced = K.stepTrack({ start: 10, end: 40, shot: SHOT, links: [{ a: 20, b: 21, ids: ["far"], bounds: FAR }, { a: 30, b: 31, ids: ["other"], bounds: OTHER }] }, C);
  assert.deepEqual(spaced.moves.map((m) => m.ids.join() || "shot"), ["far", "shot", "other", "shot"]);
  for (let i = 1; i < t.moves.length; i++) assert.ok(t.moves[i].t0 - (t.moves[i - 1].t0 + t.moves[i - 1].d) >= K.HOLD - 1e-9);
  assert.ok(fastest(t, 10, 40) <= K.SPEED + 1e-6);
});

test("camera: reduced motion jumps to each shot instead of easing", () => {
  const t = K.stepTrack({ start: 10, end: 40, shot: SHOT, from: K.ID, links: [{ a: 20, b: 21, ids: ["far"], bounds: FAR }] }, C);
  const go = t.moves.find((m) => m.ids.length);
  assert.deepEqual(K.at(t, go.t0 + go.d / 2, true), go.to);
  assert.deepEqual(K.at(t, 10 + t.enter / 2, true), SHOT);
});
