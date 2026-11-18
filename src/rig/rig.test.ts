import { test } from "node:test";
import assert from "node:assert/strict";
import { axesOf, nearness, fitCamera, insetCamera, screenOf, type Camera } from "./camera.ts";
import { plate, planeOf, pointOn, circlePoints, rod, sprocket, turned, type Mesh } from "./shapes.ts";
import { drawMesh, keyLight, shadeOf } from "./draw.ts";
import { applyAffine, moveInPlane, planeKey, slotKey } from "./motion.ts";
import { keepInPlace } from "./stage.ts";
import { carry, checkContacts } from "./contacts.ts";
import { arrow, cellDrawing, CONCEPT_VIEW, decalAt, placeAt, railCentres, ringSlots, turnAt } from "./parts.ts";
import { dot, sub, type P2, type V3 } from "./vec.ts";

const rng = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------- camera
test("camera: fitting puts every point inside the box, and fills it in one direction", () => {
  const r = rng(1);
  const pts: V3[] = Array.from({ length: 50 }, () => [r() * 80 - 40, r() * 30, r() * 60]);
  const box = { x: 100, y: 50, w: 800, h: 400 };
  const cam = fitCamera(pts, box, 120, 25);
  const s = pts.map((p) => screenOf(cam, p));
  const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
  for (const p of s) assert.ok(p[0] >= box.x - 1e-6 && p[0] <= box.x + box.w + 1e-6 && p[1] >= box.y - 1e-6 && p[1] <= box.y + box.h + 1e-6);
  const fillW = (Math.max(...xs) - Math.min(...xs)) / box.w, fillH = (Math.max(...ys) - Math.min(...ys)) / box.h;
  assert.ok(Math.abs(Math.max(fillW, fillH) - 1) < 1e-9);
});

test("camera: up is up on screen, depth grows toward the viewer, and azimuth turns the view", () => {
  const cam: Camera = { azimuth: 0, elevation: 0, scale: 10, origin: [0, 0] };
  assert.ok(screenOf(cam, [0, 0, 1])[1] < screenOf(cam, [0, 0, 0])[1], "z up draws higher");
  assert.ok(screenOf(cam, [0, 1, 0])[0] > 0, "seen from +x, +y is to the right");
  assert.ok(nearness(cam, [1, 0, 0]) > nearness(cam, [-1, 0, 0]), "+x is nearer a viewer at +x");
  const ax = axesOf(90, 30);
  assert.ok(Math.abs(dot(ax.right, ax.up)) < 1e-12 && Math.abs(dot(ax.up, ax.toward)) < 1e-12, "the axes are square");
  const inset = insetCamera(150, 15, 40, [3, 4, 5], [700, 200]);
  const f = screenOf(inset, [3, 4, 5]);
  assert.ok(Math.hypot(f[0] - 700, f[1] - 200) < 1e-9, "the inset puts its focus where asked");
});

// ---------------------------------------------------------------- shapes
const edgeUse = (m: Mesh) => {
  const use = new Map<string, number>();
  for (const f of m.faces) for (const l of f.loops) for (let k = 0; k < l.length; k++) {
    const a = l[k]!, b = l[(k + 1) % l.length]!;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    use.set(key, (use.get(key) ?? 0) + 1);
  }
  return use;
};
const centroid = (m: Mesh, loop: number[]): V3 => {
  const s = loop.reduce((a, k) => [a[0] + m.verts[k]![0], a[1] + m.verts[k]![1], a[2] + m.verts[k]![2]] as V3, [0, 0, 0] as V3);
  return [s[0] / loop.length, s[1] / loop.length, s[2] / loop.length];
};

test("shapes: a plate with teeth and windows is closed, every edge shared by two faces", () => {
  const pl = planeOf([0, 0, 0], [0, 1, 0], [1, 0, 0]);
  const m = plate(pl, { outer: sprocket(17, 34, 3.2), holes: [circlePoints(8, 20, 12, 0), circlePoints(6, 16, -14, 4)] }, -0.9, 0.9);
  for (const [k, n] of edgeUse(m)) assert.equal(n, 2, `edge ${k} is used ${n} times`);
  assert.equal(m.faces.filter((f) => f.role === "cap").length, 2);
  assert.equal(m.faces.filter((f) => f.role === "cap")[0]!.loops.length, 3, "the cap carries its two holes");
});

test("shapes: walls face out of the material: away from the centre outside, into each hole", () => {
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const m = plate(pl, { outer: circlePoints(20, 32), holes: [circlePoints(5, 16, 8, 0)] }, 0, 2);
  for (const f of m.faces.filter((f) => f.role === "wall")) {
    const c = centroid(m, f.loops[0]!);
    const r = Math.hypot(c[0], c[1]);
    if (r > 15) assert.ok(dot(f.normal, [c[0], c[1], 0]) > 0, "outer wall points outward");
    else assert.ok(dot(f.normal, [c[0] - 8, c[1], 0]) < 0, "hole wall points into the hole");
  }
  const caps = m.faces.filter((f) => f.role === "cap");
  assert.ok(caps.some((f) => f.normal[2] > 0.99) && caps.some((f) => f.normal[2] < -0.99));
});

test("shapes: turned parts and rods are closed, with normals pointing away from the axis", () => {
  const m = turned([0, 0, 0], [1, 0, 0], [[0, 4], [2, 6], [5, 6], [6, 3]], 24);
  for (const [k, n] of edgeUse(m)) assert.equal(n, 2, `edge ${k}`);
  for (const f of m.faces.filter((f) => f.role === "band")) {
    const c = centroid(m, f.loops[0]!);
    assert.ok(dot(f.normal, [0, c[1], c[2]]) > 0);
  }
  const r = rod([0, 0, 0], [0, 0, 10], 2);
  for (const [, n] of edgeUse(r)) assert.equal(n, 2);
});

// ---------------------------------------------------------------- shading and drawing
test("shading: a face turned to the key light is lighter than one turned away, and never darker than the floor", () => {
  const ax = axesOf(112, 22), L = keyLight(ax);
  assert.ok(shadeOf(L, L) > shadeOf([-L[0], -L[1], -L[2]], L));
  assert.ok(shadeOf([-L[0], -L[1], -L[2]], L) >= 0.16 - 1e-12);
  // the light comes from above the viewer's horizon
  assert.ok(dot(L, ax.up) > 0 && dot(L, ax.toward) > 0);
});

test("drawing: a plate seen face-on draws its near cap last and outlines its silhouette", () => {
  const cam: Camera = { azimuth: 90, elevation: 10, scale: 10, origin: [500, 500] };
  const pl = planeOf([0, 0, 0], [0, 1, 0], [1, 0, 0]);
  const svg = drawMesh(plate(pl, { outer: circlePoints(20, 24) }, 0, 2), cam, { material: "steel" });
  const faces = [...svg.matchAll(/<path class="rig-face"[^>]*>/g)].map((m) => m[0]);
  assert.ok(faces.at(-1)!.includes("evenodd"), "the cap comes last");
  assert.match(svg, /class="rig-sil"/);
  // seen exactly edge-on, the plate still draws: its rim is its walls
  const edge = drawMesh(plate(pl, { outer: circlePoints(20, 24) }, 0, 2), { ...cam, azimuth: 0, elevation: 0 }, { material: "steel" });
  assert.match(edge, /class="rig-face"/);
});

// ---------------------------------------------------------------- draw once, then move
for (const [az, el] of [[112, 22], [150, 16], [37, 61]] as const) {
  test(`motion: moving a drawn part is exact (camera ${az}°, ${el}°)`, () => {
    const cam: Camera = { azimuth: az, elevation: el, scale: 23, origin: [400, 300] };
    const r = rng(az);
    for (let n = 0; n < 300; n++) {
      const pl = { origin: [r() * 10, r() * 10, r() * 10] as V3, ...(() => { const p = planeOf([0, 0, 0], [r() - 0.5, r() - 0.5, r() - 0.5], [r(), r(), r()]); return { u: p.u, v: p.v, n: p.n }; })() };
      const th = (r() - 0.5) * 7, to = [(r() - 0.5) * 80, (r() - 0.5) * 80] as const, fromN = (r() - 0.5) * 20, toN = (r() - 0.5) * 20;
      const m = moveInPlane(cam, pl, th, to, fromN, toN);
      const P = { ...pl, origin: pl.origin };
      for (let j = 0; j < 4; j++) {
        const a = (r() - 0.5) * 50, b = (r() - 0.5) * 50;
        const moved = applyAffine(m, screenOf(cam, pointOn(P, a, b, fromN)));
        const want = screenOf(cam, pointOn(P, Math.cos(th) * a - Math.sin(th) * b + to[0], Math.sin(th) * a + Math.cos(th) * b + to[1], toN));
        assert.ok(Math.hypot(moved[0] - want[0], moved[1] - want[1]) < 1e-6, `off by ${Math.hypot(moved[0] - want[0], moved[1] - want[1])}`);
      }
    }
  });
}

test("motion, planted faults: a forgotten shift along the normal is caught, and an edge-on plane is refused", () => {
  const cam: Camera = { azimuth: 112, elevation: 22, scale: 23, origin: [400, 300] };
  const pl = { origin: [0, 0, 0] as V3, u: [1, 0, 0] as V3, v: [0, 0, 1] as V3, n: [0, -1, 0] as V3 };
  const right = moveInPlane(cam, pl, 0.4, [10, 5], 0, 12);
  const wrong = moveInPlane(cam, pl, 0.4, [10, 5], 0, 0);
  const p = screenOf(cam, pointOn(pl, 3, 4, 0));
  const d = sub([...applyAffine(right, p), 0] as V3, [...applyAffine(wrong, p), 0] as V3);
  assert.ok(Math.hypot(d[0], d[1]) > 50, "the shift along the normal matters");
  // a camera at azimuth 0 looks along -x, so the plane y = 0 (normal along y) is seen edge-on
  const edgeOn: Camera = { azimuth: 0, elevation: 0, scale: 10, origin: [0, 0] };
  assert.throws(() => moveInPlane(edgeOn, { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] }, 0, [0, 0], 0, 0));
});

test("slots: parts between parallel slabs sort by the gap they sit in, and hold still between crossings", () => {
  const planes = [-10, -5, 0, 5];
  assert.ok(slotKey(planes, -7, 0.5) > planeKey(0) && slotKey(planes, -7, 0.5) < planeKey(1));
  assert.ok(slotKey(planes, 6, 0.1) > planeKey(3));
  assert.ok(slotKey(planes, -11, 0.9) < planeKey(0));
  assert.equal(slotKey(planes, -4.9, 0.3), slotKey(planes, -0.1, 0.3), "moving inside one gap does not change the key");
  assert.ok(slotKey(planes, 0, 0.2) > planeKey(2), "a part on a slab's own plane paints after the slab");
});

test("stage: reordering moves as few groups as it can: one part crossing the whole list is one move", () => {
  const moves = (positions: number[]) => positions.length - keepInPlace(positions).size;
  assert.equal(moves([0, 1, 2, 3, 4, 5]), 0, "nothing out of place");
  assert.equal(moves([1, 2, 3, 4, 5, 0]), 1, "the first part now wanted last");
  assert.equal(moves([5, 0, 1, 2, 3, 4]), 1, "the last part now wanted first");
  assert.equal(moves([0, 1, 5, 2, 3, 4]), 1, "a part jumped forward");
  assert.equal(moves([0, -1, 1, 2]), 1, "a new part is the only move");
  assert.equal(moves([3, 2, 1, 0]), 3, "a reversal is the worst case");
  // the kept entries really are in order, and the moves are never more than any other choice would need (brute force)
  const r = rng(7);
  for (let n = 0; n < 200; n++) {
    const len = 2 + Math.floor(r() * 7), pos = Array.from({ length: len }, (_, i) => i).sort(() => r() - 0.5);
    const stay = [...keepInPlace(pos)].sort((a, b) => a - b);
    for (let i = 1; i < stay.length; i++) assert.ok(pos[stay[i]!]! > pos[stay[i - 1]!]!, "kept parts are in order");
    let best = 0;
    for (let mask = 0; mask < 1 << len; mask++) {
      const idx = [...Array(len).keys()].filter((i) => mask >> i & 1);
      if (idx.every((v, k) => k === 0 || pos[v]! > pos[idx[k - 1]!]!)) best = Math.max(best, idx.length);
    }
    assert.equal(stay.length, best, `keeps the most it can in ${pos}`);
  }
});

// ---------------------------------------------------------------- contacts
test("contacts: a wheel moving with its chain passes; reversed, stopped or slow, it fails", () => {
  const along = (p: P2, d: P2): readonly [P2, P2] => [p, [p[0] + d[0], p[1] + d[1]]];
  const good = { where: "cog", chain: along([0, 0], [3, 1]), wheel: along([0, 0], [3.1, 0.9]) };
  assert.deepEqual(checkContacts([good]).faults, []);
  assert.equal(checkContacts([good]).byWhere.cog, 1);
  // a planted fault: the wheel turned the wrong way
  const reversed = { where: "guide", chain: along([0, 0], [3, 1]), wheel: along([0, 0], [-3, -1]) };
  assert.match(checkContacts([good, reversed]).faults.join(), /^guide: the wheel moves against the chain/);
  assert.match(checkContacts([{ where: "t", chain: along([0, 0], [3, 0]), wheel: along([0, 0], [0.1, 0]) }]).faults.join(), /does not move/);
  assert.match(checkContacts([{ where: "t", chain: along([0, 0], [3, 0]), wheel: along([0, 0], [1.5, 0]) }]).faults.join(), /0\.50 of the chain's speed/);
  assert.equal(checkContacts([]).checked, 0, "an empty list checks nothing, so a caller must assert its counts");
});

test("contacts: carry() takes a point drawn under one transform to where the next one puts it", () => {
  assert.deepEqual(carry(null, "translate(5 -2)", [1, 1]), [6, -1]);
  const p = carry("matrix(0 1 -1 0 10 0)", "matrix(1 0 0 1 0 0)", [10, 1]);
  assert.ok(Math.abs(p[0] - 1) < 1e-12 && Math.abs(p[1]) < 1e-12);
});

// ---------------------------------------------------------------- concept parts
test("parts: a cell drawn once and placed by a translate lands where drawing it there would", () => {
  const cam = { ...CONCEPT_VIEW, scale: 30, origin: [500, 400] as P2 };
  const svg = cellDrawing(cam, { w: 20, d: 20, h: 9 });
  assert.match(svg, /rig-m-cell/);
  const at: V3 = [44, -6, 0], m = placeAt(cam, at).match(/translate\(([-\d.]+) ([-\d.]+)\)/)!;
  const want = sub(screenOf(cam, at) as unknown as V3, [...screenOf(cam, [0, 0, 0]), 0] as unknown as V3);
  assert.ok(Math.abs(Number(m[1]) - want[0]) < 0.06 && Math.abs(Number(m[2]) - want[1]) < 0.06);
});

test("parts: a decal on a face maps the face's own millimetres to the screen", () => {
  const cam = { ...CONCEPT_VIEW, scale: 30, origin: [500, 400] as P2 };
  const c: V3 = [10, 4, 9], t = decalAt(cam, c).match(/matrix\(([^)]*)\)/)![1]!.split(" ").map(Number);
  const on = (x: number, y: number): P2 => [t[0]! * x + t[2]! * y + t[4]!, t[1]! * x + t[3]! * y + t[5]!];
  for (const [x, y] of [[0, 0], [3, 0], [0, 2], [-4, 5]] as const) {
    const want = screenOf(cam, [c[0] + x, c[1] - y, c[2]]), got = on(x, y);
    assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) < 0.2, `(${x}, ${y})`);
  }
});

test("parts: rails, rings and arrows are where they say", () => {
  assert.deepEqual(railCentres(3, 25, [10, 0, 0]).map((p) => p[0]), [10, 35, 60]);
  const r = ringSlots(4, 30);
  assert.ok(Math.abs(r[0]!.at[1] + 30) < 1e-9 && Math.abs(r[0]!.at[0]) < 1e-9, "the first slot is at the front");
  const cam = { ...CONCEPT_VIEW, scale: 30, origin: [500, 400] as P2 };
  const a = arrow(cam, [0, 0, 5], [40, 0, 5]);
  const want = screenOf(cam, [40, 0, 5]);
  assert.ok(Math.hypot(a.b[0] - want[0], a.b[1] - want[1]) < 1e-6, "the head is at the end");
  assert.match(turnAt(cam, Math.PI / 2, [5, 5, 0]), /^matrix\(/);
});
