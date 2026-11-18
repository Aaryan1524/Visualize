// node --test examples/derailleur/figure.test.mjs
//
// The figure draws each part once and moves it with one SVG transform per frame. These tests check
// that a part placed that way lands where drawing it again would put it (to well under a pixel,
// across the part's thickness), that the painter's keys keep the chain on either side of its cog,
// and that every part a frame places has a drawing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS } from "./model.mjs";
import { figure, cameraFor, W, BINS } from "./figure.mjs";
import { pathAt } from "./model.mjs";
import { angleBin, applyAffine, carry, checkContacts, moveInPlane, planeOf, screenOf } from "../../src/rig/index.ts";

const BOX = { x: 4300, y: 260, w: 5100, h: 6080 };
const PX = 10; // svg units per screen pixel at 1440 x 900
const SIDE = planeOf([0, 0, 0], [0, -1, 0], [1, 0, 0]);
const AX = { origin: [0, 0, 0], u: SIDE.u, v: SIDE.v, n: SIDE.n };
// a point of a part in the side plane: side (a, b), lateral e
const at = (a, b, e) => W(a, b, e);

for (const [name, M] of Object.entries(MODELS)) {
  const cam = cameraFor(M, BOX);
  test(`${name}: a cog drawn once and turned by its transform lands within half a pixel of a redraw, across its thickness`, () => {
    for (const k of [0, 5, M.last]) {
      const N = M.cogs[k], e = M.cogE(k), R = M.Rk[k];
      for (let i = 0; i < 40; i++) {
        const theta = i * 0.173;
        const { bin, rest } = angleBin(theta, (2 * Math.PI) / N, BINS.cog);
        const drawnAt = (bin * 2 * Math.PI) / N / BINS.cog;
        const m = moveInPlane(cam, AX, rest, [0, 0], e, e);
        for (const de of [-0.85, 0, 0.85]) {
          // a tooth tip as drawn (at the bin's angle), and the same tip turned all the way
          const a0 = drawnAt + 0.1, a1 = a0 + rest;
          const drawn = screenOf(cam, at(R * Math.cos(a0), R * Math.sin(a0), e + de));
          const moved = applyAffine(m, drawn);
          const want = screenOf(cam, at(R * Math.cos(a1), R * Math.sin(a1), e + de));
          assert.ok(Math.hypot(moved[0] - want[0], moved[1] - want[1]) < 0.5 * PX, `cog ${k}: off by ${(Math.hypot(moved[0] - want[0], moved[1] - want[1]) / PX).toFixed(2)} px`);
        }
      }
    }
  });

  // Every other turning part: the turn left to its transform at most, and how far its points lie
  // from the plane it is placed by. Each must land within a pixel of a redraw.
  const parts = [
    ["a chain's outer plates and rivets", Math.PI / BINS.link, [2.75 - BINS.placeBy.outer, 1.95 - BINS.placeBy.outer, 3.25 - BINS.placeBy.outer]],
    ["an inner link's plate and rollers", Math.PI / BINS.link, [1.9 - BINS.placeBy.inner, -1.15 - BINS.placeBy.inner, 1.15 - BINS.placeBy.inner]],
    ["an inner link's far plate", Math.PI / BINS.link, [-1.9 + BINS.placeBy.inner, -1.15 + BINS.placeBy.inner]],
    ["a cage plate and its bolts", BINS.cageStep / 2, [0.8, -0.8, 2.5]],
    ["a pulley", Math.PI / 11 / BINS.pulley, [1.4, -1.4]],
  ];
  for (const [what, restMax, offsets] of parts) {
    test(`${name}: ${what}, turned by its transform, lands within a pixel of a redraw`, () => {
      let worst = 0;
      for (const rest of [restMax, -restMax, restMax / 2])
        for (const dn of offsets)
          for (const [a, b] of [[12, 0], [0, 12], [-9, 7], [6.35, 3.9]]) {
            const m = moveInPlane(cam, AX, rest, [20, -30], 0, -4);
            const moved = applyAffine(m, screenOf(cam, at(a, b, dn)));
            const want = screenOf(cam, at(Math.cos(rest) * a - Math.sin(rest) * b + 20, Math.sin(rest) * a + Math.cos(rest) * b - 30, -4 + dn));
            worst = Math.max(worst, Math.hypot(moved[0] - want[0], moved[1] - want[1]));
          }
      if (process.env.SHOW) console.log(`${name} ${what}: ${(worst / PX).toFixed(2)} px`);
      assert.ok(worst < 1 * PX, `${what}: off by ${(worst / PX).toFixed(2)} px`);
    });
  }

  test(`${name}: planted fault: one drawing of a cog turned half a turn by transform misses by more than a pixel`, () => {
    const k = 0, e = M.cogE(k), R = M.Rk[k], rest = Math.PI;
    const m = moveInPlane(cam, AX, rest, [0, 0], e, e);
    const drawn = screenOf(cam, at(R, 0, e + 0.85));
    const moved = applyAffine(m, drawn);
    const want = screenOf(cam, at(R * Math.cos(rest), R * Math.sin(rest), e + 0.85));
    assert.ok(Math.hypot(moved[0] - want[0], moved[1] - want[1]) > 1 * PX);
  });

  test(`${name}: in every gear the chain's far plates paint before its cog and its near plates after; every placed part has a drawing`, () => {
    const F = figure(M, cam, { prefix: "t" });
    const drawn = new Set(F.parts.map((p) => p.id));
    for (let k = 0; k < M.n; k++) {
      const pose = M.pose(M.pullFor(k), k);
      const { items, defs } = F.pose({ pose, roll: 0, show: {} });
      for (const d of defs) drawn.add(`#${d.match(/id="([^"]+)"/)[1]}`);
      const cog = items.find((i) => i.id === `t-cog${k}`);
      assert.ok(cog?.flags?.on, `gear ${k + 1}: the cog the chain is on is marked`);
      const far = items.filter((i) => /^t-cf\d+$/.test(i.id) && !i.hidden).map((i) => i.key);
      const near = items.filter((i) => /^t-cn\d+$/.test(i.id) && !i.hidden).map((i) => i.key);
      assert.ok(far.some((x) => x < cog.key) && near.some((x) => x > cog.key), `gear ${k + 1}: the chain straddles its cog`);
      for (const i of items) {
        if (i.hidden || i.svg !== undefined) continue;
        assert.ok(i.href ? drawn.has(i.href) : drawn.has(i.id), `${i.id} has no drawing`);
      }
    }
  });
}

// The chain drives every wheel it touches: where it meets a cog or a pulley, the tooth there must move
// on screen with the chain, the same way and at the same speed (src/rig/contacts.ts). A sign slip
// anywhere (a pulley turned the wrong way, a cassette angle that runs backward) shows up here.
function contactsOf(M, cam, { reverse = null } = {}) {
  const F = figure(M, cam, { prefix: "v" });
  const dr = 0.4; // mm of chain between the two frames
  const contacts = [];
  for (const k of [0, 3, M.last]) {
    const pose = M.pose(M.pullFor(k), k);
    const total = pose.path.total, p = M.D.p;
    for (const roll of [0, 37, 151.3]) {
      const a = F.pose({ pose, roll, show: {} }).items, b = F.pose({ pose, roll: roll + dr, show: {} }).items;
      const byId = (list, id) => list.find((i) => i.id === id);
      for (const [wrap, wheel] of [["cog", `v-cog${k}`], ["guide", "v-guideTeeth"], ["tension", "v-tensionTeeth"]]) {
        const wa = byId(a, wheel), wb = byId(b, wheel);
        if (wa.href !== wb.href) continue; // a different drawing between the frames: skip this pair
        // a chain link lying on this wrap: its centre, as drawn in both frames
        for (let i = 0; i < M.links; i++) {
          const q0 = pathAt(pose.path, (((-roll + i * p) % total) + total) % total), q1 = pathAt(pose.path, (((-roll + (i + 1) * p) % total) + total) % total);
          if (q0.on !== wrap || q1.on !== wrap) continue;
          const la = byId(a, `v-cn${i}`), lb = byId(b, `v-cn${i}`);
          if (!la || !lb || la.hidden || lb.hidden || la.href !== lb.href) continue;
          // each part is moved exactly on the plane it is placed by: the link's near plate, the
          // cog's or pulley's mid-plane; take the point at the contact on each
          const e = wrap === "cog" ? pose.chainE : pose.e, sm = BINS.placeBy[i % 2 === 0 ? "outer" : "inner"];
          const mx = (q0.p[0] + q1.p[0]) / 2, my = (q0.p[1] + q1.p[1]) / 2;
          const atLink = screenOf(cam, W(mx, my, e + sm)), atWheel = screenOf(cam, W(mx, my, e));
          const wheelMoved = reverse === wrap ? carry(wb.transform, wa.transform, atWheel) : carry(wa.transform, wb.transform, atWheel);
          contacts.push({ where: wrap, chain: [atLink, carry(la.transform, lb.transform, atLink)], wheel: [atWheel, wheelMoved] });
          break;
        }
      }
    }
  }
  return contacts;
}
for (const [name, M] of Object.entries(MODELS)) {
  test(`${name}: where the chain meets the cog and both pulleys, the teeth move with the chain`, () => {
    const r = checkContacts(contactsOf(M, cameraFor(M, BOX)));
    assert.deepEqual(r.faults, []);
    // never pass with nothing checked: every kind of contact, several times
    for (const where of ["cog", "guide", "tension"]) assert.ok((r.byWhere[where] ?? 0) >= 3, `${name}: only ${r.byWhere[where] ?? 0} ${where} contacts checked`);
  });
}
test("a planted fault: a guide pulley turned the wrong way fails the contact test", () => {
  const M = MODELS.road, r = checkContacts(contactsOf(M, cameraFor(M, BOX), { reverse: "guide" }));
  assert.ok(r.faults.some((f) => f.startsWith("guide: the wheel moves against the chain")), r.faults.join("; "));
  assert.ok(!r.faults.some((f) => f.startsWith("cog") || f.startsWith("tension")));
});
