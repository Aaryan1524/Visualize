// node --test examples/differential/figure.test.mjs
//
// Verifies the 3D cutaway Open Differential figure:
//   - Every fixed-axis turning solid uses turningPart() with worst-case error < 0.5 px
//   - Direct 3D contact tests (src/rig/contacts.ts) for:
//       1) 11T drive pinion <-> 41T ring gear (90° bevel final drive)
//       2) 10T spider gear <-> 16T left & right sun gears (straight, cornering, and ice trap)
//     plus planted reversed-gear faults that MUST fail
//   - Every placed item references a real drawing / def
//   - Frame pose computation stays fast (< 2 ms / frame)

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, anglesAt } from "./model.mjs";
import {
  AXLE_AXES,
  GEO,
  PINION_AXES,
  PINION_RING_CONTACT,
  cameraFor,
  figure,
  pinDir,
  spiderSunContact,
} from "./figure.mjs";
import {
  add,
  applyAffine,
  carry,
  checkContacts,
  cross,
  moveInPlane,
  scale,
  screenOf,
} from "../../src/rig/index.ts";

const BOX = { x: 3750, y: 500, w: 6600, h: 5200 }; // matches build.mjs
const PX = 10; // SVG units per screen pixel at 1440×900

/**
 * Advance a material point fixed on spider gear 1 (starting at `side * rSpider` along X from the
 * spider's center at `carrierRad0`, `spiderRad0`) to (`carrierRad1`, `spiderRad1`).
 */
function spiderMaterialPoint(carrierRad0, spiderRad0, carrierRad1, spiderRad1, side) {
  const p1 = pinDir(carrierRad1);
  const center1 = scale(p1, GEO.rSun);
  // Local basis on spider 1 at carrierRad1: u = [1, 0, 0], v = cross(p1, u) = t1
  const t1 = cross(p1, [1, 0, 0]);
  const dSpin = spiderRad1 - spiderRad0;
  // Point started at (side * rSpider, 0) in spider local frame, rotated by dSpin from u toward t1
  const rx = side * GEO.rSpider * Math.cos(dSpin);
  const rt = side * GEO.rSpider * Math.sin(dSpin);
  return add(center1, add([rx, 0, 0], scale(t1, rt)));
}

for (const [name, M] of Object.entries(MODELS)) {
  const cam = cameraFor(M, BOX);
  const F = figure(M, cam, { prefix: "t" });

  test(`${name}: every turningPart stays strictly under 0.5 px worst-case error and across 40 poses`, () => {
    const names = Object.keys(F.turningParts);
    assert.ok(names.length >= 12, `expected >= 12 turningParts, got ${names.length}`);
    for (const [id, tp] of Object.entries(F.turningParts)) {
      assert.ok(tp.worstErrPx < 0.5, `${id}: worstErrPx ${tp.worstErrPx.toFixed(3)} >= 0.5 px`);
    }
    for (let i = 0; i < 40; i++) {
      const a = anglesAt(i * 0.237, M.corner.deltaFrac);
      const { items } = F.pose({ ...a, show: { forces: i % 2 === 0, ice: i % 3 === 0 } });
      for (const it of items) {
        if (it.turnErrPx !== undefined) {
          assert.ok(it.turnErrPx < 0.5, `${it.id}: turnErrPx ${it.turnErrPx.toFixed(3)} >= 0.5 px`);
        }
      }
    }
  });

  test(`${name}: thick turning gears land within 0.5 px of a true 3D re-projection across their face width`, () => {
    // Independently check the ring gear (thickest large gear) at front & back faces across 30 angles
    const tp = F.turningParts.ringTeeth;
    for (let i = 0; i < 30; i++) {
      const theta = i * 0.193;
      const placed = tp.place(theta, [0, 0], 0);
      const drawnAt = placed.bin * tp.step;
      const m = moveInPlane(cam, AXLE_AXES, placed.rest, [0, 0], tp.mid, tp.mid);
      for (const dx of [-GEO.ringThick / 2, 0, GEO.ringThick / 2]) {
        const x = GEO.xRing + dx;
        const a0 = drawnAt + 0.4;
        const a1 = a0 + placed.rest;
        const drawn = screenOf(cam, [x, GEO.rRing * Math.sin(a0), GEO.rRing * Math.cos(a0)]);
        const moved = applyAffine(m, drawn);
        const want = screenOf(cam, [x, GEO.rRing * Math.sin(a1), GEO.rRing * Math.cos(a1)]);
        const errPx = Math.hypot(moved[0] - want[0], moved[1] - want[1]) / PX;
        assert.ok(errPx < 0.5, `ring gear at dx=${dx}: off by ${errPx.toFixed(3)} px`);
      }
    }
    // And check the drive pinion (Y-axis turningPart) across its length
    const pt = F.turningParts.pinion;
    for (let i = 0; i < 20; i++) {
      const theta = i * 0.271;
      const placed = pt.place(theta, [0, 0], 0);
      const drawnAt = placed.bin * pt.step;
      const m = moveInPlane(cam, PINION_AXES, placed.rest, [0, 0], pt.mid, pt.mid);
      for (const dy of [-GEO.pinionLen / 2, 0, GEO.pinionLen / 2]) {
        const y = GEO.yPinion + dy;
        const a0 = drawnAt + 0.25;
        const a1 = a0 + placed.rest;
        const drawn = screenOf(cam, [GEO.xPinion + GEO.rPinion * Math.cos(a0), y, -GEO.rPinion * Math.sin(a0)]);
        const moved = applyAffine(m, drawn);
        const want = screenOf(cam, [GEO.xPinion + GEO.rPinion * Math.cos(a1), y, -GEO.rPinion * Math.sin(a1)]);
        const errPx = Math.hypot(moved[0] - want[0], moved[1] - want[1]) / PX;
        assert.ok(errPx < 0.5, `drive pinion at dy=${dy}: off by ${errPx.toFixed(3)} px`);
      }
    }
  });

  test(`${name}: every placed item has a real drawing or def and finite screen anchors`, () => {
    const F2 = figure(M, cam, { prefix: "d" });
    const drawn = new Set(F2.parts.map((p) => p.id));
    for (const show of [{}, { forces: true }, { ice: true, slip: true }]) {
      const out = F2.pose({ ...anglesAt(0.4, M.corner.deltaFrac), show });
      for (const d of out.defs) drawn.add(`#${d.match(/id="([^"]+)"/)[1]}`);
      for (const it of out.items) {
        if (it.hidden || it.svg !== undefined) continue;
        assert.ok(it.href ? drawn.has(it.href) : drawn.has(it.id), `${it.id} missing drawing (${it.href ?? it.id})`);
      }
      for (const [k, pt] of Object.entries(out.at)) {
        assert.ok(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), `anchor ${k} not finite`);
      }
    }
  });

  // Contact test helper: final drive (11T pinion <-> 41T ring gear)
  function finalDriveContacts(reverse = false) {
    const contacts = [];
    const dc = 0.008; // carrier rad step
    const P = screenOf(cam, PINION_RING_CONTACT);
    for (let i = 0; i < 24; i++) {
      const c0 = 0.1 + i * 0.21;
      const a = F.pose(anglesAt(c0, 0)).items;
      const b = F.pose(anglesAt(c0 + dc, 0)).items;
      const byId = (list, id) => list.find((x) => x.id === id);
      const pa = byId(a, "t-pinion"), pb = byId(b, "t-pinion");
      const ra = byId(a, "t-ringTeeth"), rb = byId(b, "t-ringTeeth");
      if (pa.href !== pb.href || ra.href !== rb.href) continue;
      contacts.push({
        where: "finalDrive",
        chain: [P, carry(pa.transform, pb.transform, P)],
        wheel: [P, reverse ? carry(rb.transform, ra.transform, P) : carry(ra.transform, rb.transform, P)],
      });
    }
    return contacts;
  }

  test(`${name}: drive pinion and ring gear move together at their 90° bevel contact`, () => {
    const r = checkContacts(finalDriveContacts(false));
    assert.deepEqual(r.faults, []);
    assert.ok((r.byWhere.finalDrive ?? 0) >= 6, `only ${r.byWhere.finalDrive ?? 0} finalDrive contacts checked`);
  });

  test(`${name}: planted fault — reversing the ring gear fails the final-drive contact test`, () => {
    const r = checkContacts(finalDriveContacts(true));
    assert.ok(r.faults.some((f) => f.includes("moves against the chain")), r.faults.join("; "));
  });

  // Contact test helper: bevel spider gear <-> left & right sun gears (straight & cornering)
  function spiderSunContacts(deltaFrac, reverseSpider = false) {
    const contacts = [];
    const dc = 0.012;
    for (let i = 0; i < 24; i++) {
      const c0 = 0.12 + i * 0.19;
      const a0 = anglesAt(c0, deltaFrac);
      const a1 = anglesAt(c0 + dc, deltaFrac);
      const items0 = F.pose(a0).items;
      const items1 = F.pose(a1).items;
      const byId = (list, id) => list.find((x) => x.id === id);
      const spin1 = reverseSpider ? a0.spiderRad - (a1.spiderRad - a0.spiderRad) : a1.spiderRad;

      for (const [side, where, sunId] of [[-1, "spider-sunL", "t-sunLTeeth"], [1, "spider-sunR", "t-sunRTeeth"]]) {
        const sa = byId(items0, sunId), sb = byId(items1, sunId);
        if (sa.href !== sb.href) continue;
        // Take the contact's pitch-circle point on each part's own placing mid-plane (as in derailleur/figure.test.mjs):
        // spider at x = side * rSpider; sun gear at its mid-plane x = side * (rSpider + sunThick / 2).
        const p3_0 = spiderSunContact(a0.carrierRad, side, 1);
        const p3_1 = spiderMaterialPoint(a0.carrierRad, a0.spiderRad, a1.carrierRad, spin1, side);
        const sunX = side * (GEO.rSpider + GEO.sunThick / 2);
        const p0Spider = screenOf(cam, p3_0);
        const p1Spider = screenOf(cam, p3_1);
        const p0Sun = screenOf(cam, [sunX, p3_0[1], p3_0[2]]);
        const p1Sun = carry(sa.transform, sb.transform, p0Sun);
        // Skip near-foreshortened angles where motion lies along the view ray
        if (Math.hypot(p1Sun[0] - p0Sun[0], p1Sun[1] - p0Sun[1]) < 3) continue;
        contacts.push({ where, chain: [p0Spider, p1Spider], wheel: [p0Sun, p1Sun] });
      }
    }
    return contacts;
  }

  test(`${name}: spider gear meshes cleanly with both left and right sun gears (straight & cornering)`, () => {
    for (const delta of [0, M.corner.deltaFrac]) {
      const r = checkContacts(spiderSunContacts(delta, false));
      assert.deepEqual(r.faults, [], `delta=${delta}: ${r.faults.join("; ")}`);
      assert.ok((r.byWhere["spider-sunL"] ?? 0) >= 4);
      assert.ok((r.byWhere["spider-sunR"] ?? 0) >= 4);
    }
  });

  test(`${name}: on the ice trap, spider tooth cancels motion at the stopped right sun and doubles speed at the icy left sun`, () => {
    const dc = 0.015;
    const a0 = anglesAt(0.25, -1); // left wheel on ice (2ωc), right wheel stopped (0)
    const a1 = anglesAt(0.25 + dc, -1);
    const items0 = F.pose(a0).items, items1 = F.pose(a1).items;
    const byId = (list, id) => list.find((x) => x.id === id);

    // At the stopped right sun (side = +1), the spider tooth's net world motion must be ~0!
    const pR0 = spiderSunContact(a0.carrierRad, 1, 1);
    const pR1 = spiderMaterialPoint(a0.carrierRad, a0.spiderRad, a1.carrierRad, a1.spiderRad, 1);
    const moveR = Math.hypot(pR1[0] - pR0[0], pR1[1] - pR0[1], pR1[2] - pR0[2]);
    assert.ok(moveR < 0.01, `spider tooth should stay stationary against stopped right sun, moved ${moveR}`);

    // At the icy left sun (side = -1), spider and left sun move together at 2ωc across multiple angles!
    const iceContacts = [];
    const dcIce = 0.004;
    for (let i = 0; i < 24; i++) {
      const c0 = 0.08 + i * 0.13;
      const b0 = anglesAt(c0, -1), b1 = anglesAt(c0 + dcIce, -1);
      const it0 = F.pose(b0).items, it1 = F.pose(b1).items;
      const la = byId(it0, "t-sunLTeeth"), lb = byId(it1, "t-sunLTeeth");
      if (la.href !== lb.href) continue;
      const p3 = spiderSunContact(b0.carrierRad, -1, 1);
      const pL0 = screenOf(cam, p3);
      const pL1Spider = screenOf(cam, spiderMaterialPoint(b0.carrierRad, b0.spiderRad, b1.carrierRad, b1.spiderRad, -1));
      const pSun0 = screenOf(cam, [-(GEO.rSpider + GEO.sunThick / 2), p3[1], p3[2]]);
      const pSun1 = carry(la.transform, lb.transform, pSun0);
      if (Math.hypot(pSun1[0] - pSun0[0], pSun1[1] - pSun0[1]) < 2) continue;
      iceContacts.push({ where: "ice-left", chain: [pL0, pL1Spider], wheel: [pSun0, pSun1] });
    }
    const r = checkContacts(iceContacts);
    assert.deepEqual(r.faults, []);
    assert.ok((r.byWhere["ice-left"] ?? 0) >= 6, `checked ${r.byWhere["ice-left"] ?? 0} ice contacts`);
  });

  test(`${name}: planted fault — flipping spider spin direction fails the cornering sun-gear contact test`, () => {
    const r = checkContacts(spiderSunContacts(M.corner.deltaFrac, true), { speedTol: 0.12 });
    assert.ok(r.faults.length > 0, "flipped spider spin must fail speed/direction contact check");
  });
}

test("performance: 100 live frames pose cleanly well under 2 ms/frame", () => {
  const M = MODELS.tight;
  const cam = cameraFor(M, BOX);
  const F = figure(M, cam, { prefix: "p" });
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) {
    F.pose({ ...anglesAt(i * 0.05, M.corner.deltaFrac), show: { forces: i % 2 === 0 } });
  }
  const avgMs = (performance.now() - t0) / 100;
  assert.ok(avgMs < 2.0, `average pose took ${avgMs.toFixed(2)} ms (> 2 ms)`);
});
