import { test } from "node:test";
import assert from "node:assert/strict";
import { axesOf, nearness, fitCamera, insetCamera, screenOf, type Camera } from "./camera.ts";
import {
  arcOutline, chamferPlate, circlePoints, escapeWheelOutline, gearOutline, planeOf, plate, pointOn,
  regularPolygon, rod, roundedRect, spiralPoints, spokedHoles, sprocket, tube, turned, type Mesh,
} from "./shapes.ts";
import {
  agentBlade, budgetMetersSvg, conduitSvg, deckTier, ganttTraceSvg, hubChassis, inspectorFrame,
  portValve, samplePath, shuttleSvg, vaultCore, waferStack,
} from "./concept.ts";
import { contactShadow, drawMesh, drawSpiralRibbon, keyLight, paintGroups, plateShadow, shadeOf } from "./draw.ts";
import { applyAffine, moveInPlane, planeKey, slotKey, turningPart, type Affine } from "./motion.ts";
import { spiralStrip } from "./shapes.ts";
import { keepInPlace } from "./stage.ts";
import { carry, checkContacts } from "./contacts.ts";
import { arrow, cellDrawing, CONCEPT_VIEW, decalAt, placeAt, railCentres, ringSlots, turnAt, workingStrip } from "./parts.ts";
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
  const faces = [...svg.matchAll(/<path class="rig-face[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.ok(faces.at(-1)!.includes("evenodd"), "the cap comes last");
  assert.match(svg, /class="rig-sil"/);
  // seen exactly edge-on, the plate still draws: its rim is its walls
  const edge = drawMesh(plate(pl, { outer: circlePoints(20, 24) }, 0, 2), { ...cam, azimuth: 0, elevation: 0 }, { material: "steel" });
  assert.match(edge, /class="rig-face[^"]*"/);
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

test("parts: an arrow routed through points passes them and ends at its end; the working strip fits its rows", () => {
  const cam = { ...CONCEPT_VIEW, scale: 30, origin: [500, 400] as P2 };
  const via: V3 = [20, 30, 12], a = arrow(cam, [0, 0, 5], [40, 60, 5], { via: [via] });
  const want = screenOf(cam, [40, 60, 5]);
  assert.ok(Math.hypot(a.b[0] - want[0], a.b[1] - want[1]) < 1e-6, "the head is at the end");
  const v = screenOf(cam, via), d = a.svg.match(/class="rig-arrow-line" d="([^"]+)"/)![1]!;
  const pts = [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(pts.some(([x, y]) => Math.hypot(x! - v[0], y! - v[1]) < 1), "the curve passes through the point it is routed by");
  const s = workingStrip(["h1  2,668,802,083 mod 16 = 3", "h2  9 mod 16 = 9"], [10, 20], 100);
  assert.equal((s.svg.match(/<text/g) ?? []).length, 2);
  assert.ok(s.w >= 28 * 100 * 0.6 && s.h > 2 * 100, "wide enough for its longest row, tall enough for both");
  assert.match(s.svg, /translate\(10 20\)/);
});

// ---------------------------------------------------------------- extended shapes & concept instruments
test("shapes: chamferPlate is closed, every edge shared by two faces, with outward bevel normals", () => {
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  for (const outer of [roundedRect(30, 20, 3), regularPolygon(8, 16, 0, 0, Math.PI / 8)]) {
    const m = chamferPlate(pl, outer, 0, 8, 1.5);
    for (const [k, n] of edgeUse(m)) assert.equal(n, 2, `chamferPlate edge ${k} used ${n} times`);
    const walls = m.faces.filter((f) => f.role === "wall");
    assert.ok(walls.some((f) => f.normal[2] > 0.4), "top bevel faces upward");
    assert.ok(walls.some((f) => f.normal[2] < -0.4), "bottom bevel faces downward");
    for (const f of walls) {
      const c = centroid(m, f.loops[0]!);
      assert.ok(dot(f.normal, [c[0], c[1], 0]) > 0, "wall and bevel normals point outward radially");
    }
  }
});

test("shapes: horological gear, spoked holes, escape wheel and rotor arc form closed plates", () => {
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const gear = plate(pl, { outer: gearOutline(48, 24), holes: [circlePoints(3, 16), ...spokedHoles(6, 18, 5)] }, 0, 1.4);
  for (const [k, n] of edgeUse(gear)) assert.equal(n, 2, `gear edge ${k}`);
  const escWheel = plate(pl, { outer: escapeWheelOutline(15, 14, 9.5), holes: [circlePoints(2.2, 16), ...spokedHoles(3.4, 8.2, 3)] }, 0, 1.0);
  for (const [k, n] of edgeUse(escWheel)) assert.equal(n, 2, `escape wheel edge ${k}`);
  const rotor = plate(pl, { outer: arcOutline(8, 24, -Math.PI / 2, Math.PI / 2, 24) }, 0, 2.0);
  for (const [k, n] of edgeUse(rotor)) assert.equal(n, 2, `rotor arc edge ${k}`);
});

test("shapes: 3D tube along a spiral is closed, watertight, with outward normals", () => {
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const pts = spiralPoints(pl, 3, 14, 3, 60, 0, 2);
  const m = tube(pts, 0.5, 10);
  for (const [k, n] of edgeUse(m)) assert.equal(n, 2, `tube edge ${k} used ${n} times`);
  assert.equal(m.faces.filter((f) => f.role === "end").length, 2);
});

test("concept: sculpted architectural instruments and synchronized View A render valid SVG", () => {
  const cam: Camera = { azimuth: 225, elevation: 28, scale: 30, origin: [4000, 3000] };
  const parts = [
    deckTier(cam, { center: [0, 0, 0], w: 120, d: 80, gridStep: 20, standoffs: true }),
    hubChassis(cam, [0, 0, 0], { phase: 0.8 }),
    agentBlade(cam, [30, 10, 0], { beaconMaterial: "teal" }),
    waferStack(cam, [45, 10, 0], { count: 6, capCount: 4 }),
    portValve(cam, [-30, 20, 0], { capMaterial: "amber" }),
    vaultCore(cam, [0, -30, 0]),
    conduitSvg(cam, [[0, 0, 4], [15, 0, 4], [15, 20, 4]], { active: true, tone: "cobalt" }),
    shuttleSvg(cam, [15, 10, 4], { material: "subject" }),
  ];
  for (const svg of parts) {
    assert.ok(svg.length > 50);
    assert.ok(!svg.includes("NaN") && !svg.includes("undefined"));
  }
  const mid = samplePath([[0, 0, 0], [10, 0, 0], [10, 10, 0]], 0.5);
  assert.ok(Math.hypot(mid.point[0] - 10, mid.point[1] - 0, mid.point[2] - 0) < 1e-6);
  const lens = inspectorFrame({ x: 9000, y: 400, w: 4800, h: 4200 }, "VIEW A", "TRACE")
    + ganttTraceSvg({ x: 9000, y: 760, w: 4800, h: 2000 }, { lanes: [{ name: "Orch", segments: [{ t0: 0, t1: 1000, kind: "think" }] }], tNow: 600, tMax: 4000 })
    + budgetMetersSvg({ x: 9000, y: 2800, w: 4800, h: 1600 }, { rows: [{ label: "Orch", value: 11 }, { label: "Mono", value: 52.4 }], cap: 32, maxScale: 60, unit: "k" });
  assert.ok(!lens.includes("NaN") && lens.includes("lens-playhead") && lens.includes("is-over"));
});

// ---------------------------------------------------------------- turning thick parts
const parseMatrix = (t: string): Affine => t.match(/matrix\(([^)]+)\)/)![1]!.split(/[ ,]+/).map(Number) as Affine;
const rot2 = (a: number, b: number, t: number): [number, number] => [Math.cos(t) * a - Math.sin(t) * b, Math.sin(t) * a + Math.cos(t) * b];
/** The worst screen error, px, of a placement against an exact 3D redraw of the part at `theta`. */
function measured(cam: Camera, pl: { origin: V3; u: V3; v: V3; n: V3 }, m: Affine, drawnAt: number, theta: number, to: P2, shift: number, ns: number[], upp: number): number {
  let worst = 0;
  for (const n of ns)
    for (const [a, b] of [[14, 0], [0, 9], [-11, 6], [5, -13]] as const) {
      const [da, db] = rot2(a, b, drawnAt), [wa, wb] = rot2(a, b, theta);
      const moved = applyAffine(m, screenOf(cam, pointOn(pl, da, db, n)));
      const want = screenOf(cam, pointOn(pl, wa + to[0], wb + to[1], n + shift));
      worst = Math.max(worst, Math.hypot(moved[0] - want[0], moved[1] - want[1]) / upp);
    }
  return worst;
}
const tiltedPlane = (r: () => number) => {
  const p = planeOf([0, 0, 0], [r() - 0.5, r() - 0.5, r() + 0.2], [r(), r(), r()]);
  return { origin: [r() * 20, r() * 20, r() * 20] as V3, u: p.u, v: p.v, n: p.n };
};

for (const [az, el, sc] of [[230, 26, 40], [244, 21, 55], [112, 40, 30], [37, 61, 70]] as const) {
  test(`turningPart: across a full sweep of its symmetry, the drawn part placed by its transform stays under maxErrPx of an exact redraw, and says so exactly (camera ${az}°, ${el}°)`, () => {
    const cam: Camera = { azimuth: az, elevation: el, scale: sc, origin: [4000, 3000] };
    const r = rng(az * 7 + el);
    for (const [period, n0, n1] of [[(2 * Math.PI) / 20, 0, 1.5], [(2 * Math.PI) / 3, -2.5, 1.2], [2 * Math.PI, 1.95, 3.25]] as const) {
      const pl = tiltedPlane(r), upp = 10, maxErrPx = 0.5;
      const part = turningPart(cam, pl, { id: "p", period, n0, n1, maxErrPx, unitsPerPx: upp, draw: () => "<path/>" });
      assert.ok(part.worstErrPx < maxErrPx && part.mid === (n0 + n1) / 2);
      let worst = 0;
      for (let i = 0; i <= 240; i++) {
        const theta = (period * i) / 240 + 0.0137, to: P2 = [r() * 30 - 15, r() * 30 - 15], shift = r() * 10 - 5;
        const t = part.place(theta, to, shift);
        // the drawing shown is the part turned to its bin (a whole number of periods aside: the part repeats)
        assert.ok(Math.abs(((theta - t.rest - t.bin * part.step) / period) - Math.round((theta - t.rest - t.bin * part.step) / period)) < 1e-9);
        const got = measured(cam, pl, parseMatrix(t.transform), theta - t.rest, theta, to, shift, [n0, n1, (n0 + n1) / 2], upp);
        worst = Math.max(worst, got);
        assert.ok(got < maxErrPx, `off by ${got.toFixed(3)} px at ${theta.toFixed(3)}`);
        // what it reports is exactly the error its placement leaves; the transform string adds only its rounding
        const exact = measured(cam, pl, moveInPlane(cam, pl, t.rest, to, part.mid, part.mid + shift), theta - t.rest, theta, to, shift, [n0, n1], upp);
        assert.ok(Math.abs(exact - t.turnErrPx) < 1e-6, `reports ${t.turnErrPx.toFixed(4)} px, leaves ${exact.toFixed(4)}`);
        assert.ok(Math.abs(got - exact) < 0.005, `the transform string rounds by ${Math.abs(got - exact).toFixed(3)} px`);
      }
      // the fewest bins: one fewer would break the budget
      if (part.bins > 1) {
        const fewer = turningPart(cam, pl, { id: "q", period, n0, n1, maxErrPx: Infinity, minBins: part.bins - 1, unitsPerPx: upp, draw: () => "" });
        assert.ok(fewer.bins === part.bins - 1 && fewer.worstErrPx >= 0.98 * maxErrPx, `one fewer drawing still holds: ${fewer.worstErrPx}`);
      }
      assert.ok(worst > 0.05, "the sweep really turned thick parts");
    }
  });
}

test("turningPart, planted faults: too few drawings, or a part placed by its cap, are caught", () => {
  const cam: Camera = { azimuth: 230, elevation: 26, scale: 60, origin: [4000, 3000] };
  const r = rng(5), pl = tiltedPlane(r), upp = 10, n0 = 0, n1 = 3.1, period = 2 * Math.PI;
  // too few bins: a part drawn at 6 angles across a turn misses by more than its budget, and reports it
  const few = turningPart(cam, pl, { id: "few", period, n0, n1, maxErrPx: Infinity, minBins: 6, unitsPerPx: upp, draw: () => "" });
  let worst = 0, reported = 0;
  for (let i = 0; i <= 120; i++) {
    const theta = (period * i) / 120, t = few.place(theta, [0, 0], 0);
    worst = Math.max(worst, measured(cam, pl, parseMatrix(t.transform), theta - t.rest, theta, [0, 0], 0, [n0, n1], upp));
    reported = Math.max(reported, t.turnErrPx);
  }
  assert.ok(worst > 1, `six drawings across a turn miss by ${worst.toFixed(2)} px`);
  assert.ok(Math.abs(worst - reported) < 0.01, "and the stage is told so");
  // placed by its cap instead of its mid-plane: the far cap misses by twice what it reports
  const good = turningPart(cam, pl, { id: "good", period, n0, n1, unitsPerPx: upp, draw: () => "" });
  let capWorst = 0, capReported = 0;
  for (let i = 0; i <= 120; i++) {
    const theta = (period * i) / 120, t = good.place(theta, [0, 0], 0);
    const m = moveInPlane(cam, pl, t.rest, [0, 0], n1, n1);
    capWorst = Math.max(capWorst, measured(cam, pl, m, theta - t.rest, theta, [0, 0], 0, [n0, n1], upp));
    capReported = Math.max(capReported, t.turnErrPx);
  }
  assert.ok(capWorst > 1.8 * capReported, `placed by its cap: ${capWorst.toFixed(3)} px against ${capReported.toFixed(3)} reported`);
});

test("turningPart: draws each bin once, through the figure's own registry or its own", () => {
  const cam: Camera = { azimuth: 230, elevation: 26, scale: 40, origin: [4000, 3000] };
  const pl = { origin: [0, 0, 0] as V3, u: [1, 0, 0] as V3, v: [0, 1, 0] as V3, n: [0, 0, 1] as V3 };
  let calls = 0;
  const part = turningPart(cam, pl, { id: "w", period: Math.PI / 5, n0: 0, n1: 1.6, minBins: 4, draw: (rot) => (calls++, `<path d="${rot.toFixed(3)}"/>`) });
  part.drawAll();
  for (let i = 0; i < 100; i++) part.place(i * 0.21, [0, 0], 2);
  assert.equal(calls, part.bins);
  const out = part.drain();
  assert.equal(out.length, part.bins);
  assert.match(out[0]!, /^<g id="w-0">/);
  assert.equal(part.drain().length, 0);
  const seen = new Map<string, string>();
  const viaDef = turningPart(cam, pl, { id: "x", n0: -2.5, n1: 1.2, minBins: 72, draw: () => "", def: (id, make) => (seen.set(id, make()), `#fig-${id}`) });
  viaDef.drawAll(-0.7, 0.7);
  assert.ok(seen.size < viaDef.bins && seen.size >= Math.floor(1.4 / viaDef.step), "a part that swings draws only the angles it reaches");
  assert.match(viaDef.place(-0.5, [0, 0], 0).href, /^#fig-x-\d+$/);
});

// ---------------------------------------------------------------- face order, bevels, springs, shadows
test("drawing: face sort paints a coil's near turns over its far ones, where bucket sort does not", () => {
  const cam: Camera = { azimuth: 90, elevation: 12, scale: 20, origin: [600, 400] };
  const helix: V3[] = Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * 3 * 2 * Math.PI;
    return [-12 + (i / 120) * 24, 10 * Math.cos(t), 10 * Math.sin(t)];
  });
  const m = tube(helix, 0.9, 10);
  assert.equal(m.sort, "face", "a tube asks for face order");
  const ax = axesOf(cam.azimuth, cam.elevation);
  const scr = m.faces.map((f) => f.loops[0]!.map((k) => screenOf(cam, m.verts[k]!, ax)));
  const dep = m.faces.map((f) => f.loops[0]!.reduce((s, k) => s + nearness(cam, m.verts[k]!, ax), 0) / f.loops[0]!.length);
  const inside = (p: P2, poly: P2[]) => {
    let w = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!, b = poly[j]!;
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) w = !w;
    }
    return w;
  };
  const violations = (sort: "face" | "bucket") => {
    const { groups, seen } = paintGroups(m, cam, sort);
    const at = new Map<number, number>();
    groups.forEach((g, k) => g.forEach((i) => at.set(i, k)));
    let bad = 0, pairs = 0;
    for (let i = 0; i < m.faces.length; i++) {
      if (!seen[i]) continue;
      const c = scr[i]!.reduce((s, p) => [s[0] + p[0] / scr[i]!.length, s[1] + p[1] / scr[i]!.length] as P2, [0, 0] as P2);
      for (let j = 0; j < m.faces.length; j++) {
        if (!seen[j] || dep[i]! - dep[j]! < 4 || !inside(c, scr[j]!)) continue; // i is in front of j, over it
        pairs++;
        if (at.get(i)! <= at.get(j)!) bad++;
      }
    }
    return { bad, pairs };
  };
  const face = violations("face"), bucket = violations("bucket");
  assert.ok(face.pairs > 10, `${face.pairs} overlapping pairs checked`);
  assert.equal(face.bad, 0, "face order: every near turn paints after the far turn it covers");
  assert.ok(bucket.bad > 0, "bucket order merges far and near turns into the same paths");
  // and its outlines go with its faces, so a far turn's silhouette never strokes over a near turn
  const svg = drawMesh(m, cam, { material: "steel" });
  assert.ok((svg.match(/class="rig-sil"/g) ?? []).length > 3, "silhouettes are drawn turn by turn");
  const firstSil = svg.indexOf('class="rig-sil"'), lastFace = svg.lastIndexOf('class="rig-face');
  assert.ok(firstSil < lastFace, "a far silhouette comes before the near faces");
});

test("drawing: a chamfered plate paints walls, then the bevel next to the cap it shows, then that cap; a concave one in face order", () => {
  const cam: Camera = { azimuth: 230, elevation: 26, scale: 30, origin: [2000, 1500] };
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const cShape = arcOutline(10, 24, 0.6, 2 * Math.PI - 0.6, 40);
  for (const [outer, sort] of [[roundedRect(30, 20, 4), "bucket"], [cShape, "face"]] as const) {
    const m = chamferPlate(pl, outer, 0, 4, 0.8);
    assert.equal(m.sort ?? "bucket", sort);
    assert.ok(m.faces.filter((f) => f.bevel).every((f) => f.role === "wall"), "a bevel is still a wall");
    for (const s of ["bucket", "face"] as const) {
      const svg = drawMesh(m, cam, { material: "alloy", sort: s });
      const classes = [...svg.matchAll(/<path class="(rig-face[^"]*)"/g)].map((x) => x[1]!);
      const firstBevel = classes.findIndex((c) => c.includes("rig-bevel"));
      const lastPlainWall = classes.findLastIndex((c) => c.includes("rig-wall") && !c.includes("rig-bevel"));
      const lastBevel = classes.findLastIndex((c) => c.includes("rig-bevel"));
      const firstCap = classes.findIndex((c) => c.includes("rig-cap"));
      assert.ok(firstBevel > lastPlainWall && lastBevel < firstCap, `${s}: walls, bevels, cap: ${classes.map((c) => c.replace("rig-face ", "")).join(",")}`);
      assert.ok(classes.filter((c) => c.includes("rig-bevel")).every((c) => c.includes("rig-wall")), "a bevel keeps rig-wall");
    }
  }
  // seen from below, the bevel next to the bottom cap is the one painted late
  const under: Camera = { ...cam, elevation: -30 };
  const m = chamferPlate(pl, roundedRect(30, 20, 4), 0, 4, 0.8);
  const { groups, tier } = paintGroups(m, under);
  const lateBevels = groups.flat().filter((i) => tier[i] === 1).map((i) => m.faces[i]!.bevel);
  assert.ok(lateBevels.length > 0 && lateBevels.every((b) => b === "low"));
});

test("drawing: a coiled spring strip is closed, painted face by face, with wall and cap faces", () => {
  const cam: Camera = { azimuth: 230, elevation: 26, scale: 40, origin: [2000, 1500] };
  const pl = planeOf([3, 4, 0], [0, 0, 1], [1, 0, 0]);
  const strip = { r0: 2, r1: 11, turns: 4, t0: 0, t1: 1.2, thick: 0.25, steps: 90, phase: 0.3 };
  const m = spiralStrip(pl, strip);
  for (const [k, n] of edgeUse(m)) assert.equal(n, 2, `spring edge ${k} used ${n} times`);
  assert.equal(m.sort, "face");
  const svg = drawSpiralRibbon(cam, pl, strip, { material: "cobalt", shine: true });
  assert.match(svg, /class="rig-face rig-wall"/);
  assert.match(svg, /class="rig-face rig-cap"/);
  assert.ok(!svg.includes("NaN"));
  // the walls of each coil face out of and into the spiral
  for (const f of m.faces.filter((f) => f.role === "wall")) {
    const c = centroid(m, f.loops[0]!);
    assert.ok(Math.abs(dot(f.normal, [0, 0, 1])) < 1e-6, "a spring's walls stand upright");
    assert.ok(Math.abs(dot(f.normal, sub(c, [3, 4, c[2]]))) > 0, "and face across the coil");
  }
});

/** The area a shadow path covers, by the nonzero rule, sampled on a grid. */
function coveredArea(svg: string, step = 2): number {
  const d = svg.match(/ d="([^"]+)"/)![1]!;
  const loops = d.split("Z").filter(Boolean).map((sp) => [...sp.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((x) => [Number(x[1]), Number(x[2])] as P2));
  const all = loops.flat(), xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  let n = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += step)
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
      let w = 0;
      for (const l of loops)
        for (let i = 0; i < l.length; i++) {
          const a = l[i]!, b = l[(i + 1) % l.length]!;
          if (a[1] <= y && b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) w++;
          else if (a[1] > y && b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) w--;
        }
      if (w !== 0) n++;
    }
  return n * step * step;
}

test("shadows: a plate shadow keeps a C's opening and a plate's holes, where the contact shadow fills them", () => {
  const cam: Camera = { azimuth: 230, elevation: 26, scale: 12, origin: [600, 500] };
  const pl = planeOf([0, 0, 0], [0, 0, 1], [1, 0, 0]);
  const off: V3 = [0.6, -0.4, -1.5];
  const c = plate(pl, { outer: arcOutline(14, 24, 0.7, 2 * Math.PI - 0.7, 40) }, 0, 2);
  const real = coveredArea(plateShadow(c, cam, off)), hull = coveredArea(contactShadow(c, cam, off));
  assert.ok(real < 0.75 * hull, `a C's shadow covers ${(real / hull * 100).toFixed(0)}% of its hull`);
  assert.ok(real > 0.3 * hull, "but still covers the C itself");
  // a ring: light passes through the hole
  const ring = plate(pl, { outer: circlePoints(20, 40), holes: [circlePoints(12, 32)] }, 0, 1);
  const sh = plateShadow(ring, cam, [0, 0, 0]);
  const centre = screenOf(cam, [0, 0, 0]);
  assert.ok(coveredArea(sh) < 0.8 * coveredArea(contactShadow(ring, cam, [0, 0, 0])));
  assert.match(sh, /class="rig-contact"/);
  void centre;
});
