import { test } from "node:test";
import assert from "node:assert/strict";
import type { Camera } from "./camera.ts";
import {
  arbor, assertMeshed, bridge, centreLines, cutawayShell, drawAssembly, drawPart, explodedStack, facingCamera, gearProfile,
  helicalSpring, jewelSetting, meshCentres, moduleOf, pinion, readableTeeth, screw, shifted, spokedWheel, tipRadius,
  type MechPart,
} from "./mech.ts";
import type { Mesh } from "./shapes.ts";
import { cross, dot, sub, type P2, type V3 } from "./vec.ts";

const CAM: Camera = { azimuth: 230, elevation: 28, scale: 10, origin: [400, 300] };

// ---------------------------------------------------------------- mesh checks
const edgeUse = (m: Mesh) => {
  const use = new Map<string, number>();
  for (const f of m.faces) for (const l of f.loops) for (let k = 0; k < l.length; k++) {
    const a = l[k]!, b = l[(k + 1) % l.length]!;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    use.set(key, (use.get(key) ?? 0) + 1);
  }
  return use;
};
/** Newell's normal of a loop: the direction its winding points. */
const newell = (m: Mesh, loop: number[]): V3 => {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = m.verts[loop[i]!]!, b = m.verts[loop[(i + 1) % loop.length]!]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
};
/** Signed volume by the divergence theorem: positive when every face winds outward. */
const volume = (m: Mesh) => {
  let v = 0;
  for (const f of m.faces) for (const l of f.loops) {
    const o = m.verts[l[0]!]!;
    for (let i = 1; i + 1 < l.length; i++) v += dot(o, cross(m.verts[l[i]!]!, m.verts[l[i + 1]!]!)) / 6;
  }
  return v;
};
const checkSolid = (name: string, m: Mesh) => {
  for (const [k, n] of edgeUse(m)) assert.equal(n, 2, `${name}: edge ${k} is used ${n} times`);
  for (const [i, f] of m.faces.entries()) {
    const w = newell(m, f.loops[0]!), wl = Math.hypot(...w);
    if (wl < 1e-12) continue; // a degenerate sliver has no direction to check
    assert.ok(dot(w, f.normal) / wl > 0.5, `${name}: face ${i} (${f.role}) winds against its normal`);
  }
  assert.ok(volume(m) > 0, `${name}: the solid is inside out`);
};
const checkPart = (name: string, p: MechPart) => {
  assert.ok(p.pieces.length > 0, `${name} has pieces`);
  for (const pc of p.pieces) checkSolid(`${name}/${pc.name}`, pc.mesh);
};

/** Is p on a face of the mesh (within tol)? Point in the face's plane and inside its loops. */
const onMesh = (m: Mesh, p: V3, tol = 1e-6): boolean => m.faces.some((f) => {
  const outer = f.loops[0]!;
  const n = f.normal;
  if (Math.abs(dot(n, sub(p, m.verts[outer[0]!]!))) > tol) return false;
  // project onto the plane's two largest axes
  const ax = Math.abs(n[0]) > Math.abs(n[1]) && Math.abs(n[0]) > Math.abs(n[2]) ? 0 : Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2;
  const pr = (v: V3): P2 => (ax === 0 ? [v[1], v[2]] : ax === 1 ? [v[2], v[0]] : [v[0], v[1]]);
  const q = pr(p);
  const inside = (loop: number[]) => {
    let c = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = pr(m.verts[loop[i]!]!), b = pr(m.verts[loop[j]!]!);
      // on the edge counts as on the face
      const ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey || 1;
      const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ex + (q[1] - a[1]) * ey) / L2));
      if (Math.hypot(q[0] - a[0] - ex * t, q[1] - a[1] - ey * t) < tol) return true;
      if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (ex * (q[1] - a[1])) / ey + a[0]) c = !c;
    }
    return c;
  };
  return inside(outer) && f.loops.slice(1).every((h) => !inside(h));
});
test("mech: the on-the-part check refuses points off the part (planted faults)", () => {
  const w = spokedWheel(60, 12, 0.8);
  const on = (p: V3) => w.pieces.some((pc) => onMesh(pc.mesh, p));
  assert.ok(on(w.anchors.top!) && on(w.anchors.pitch!));
  const t = w.anchors.top!;
  assert.ok(!on([t[0], t[1], t[2] + 5]), "lifted off the part");
  assert.ok(!on([8.6 * Math.cos(Math.PI / 5), 8.6 * Math.sin(Math.PI / 5), 0.8]), "in a spoke window, level with the top");
  assert.ok(!on([0, 13.5, 0.8]), "between two teeth, beyond the root");
  const b = bridge({ outline: [[-8, -5], [8, -5], [8, 5], [-8, 5]] }, 2, { screwHoles: [[4, 0]], fill: false });
  assert.ok(!b.pieces.some((pc) => onMesh(pc.mesh, [4, 0, 2])), "in an empty hole's mouth");
});

const checkAnchors = (name: string, p: MechPart) => {
  const names = Object.keys(p.anchors);
  assert.ok(names.length > 0, `${name} names its anchors`);
  for (const k of names) assert.ok(p.pieces.some((pc) => onMesh(pc.mesh, p.anchors[k]!)), `${name}: anchor ${k} is not on the part`);
};

const pointIn = (loop: readonly P2[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!, b = loop[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

// ---------------------------------------------------------------- every part
const PARTS: [string, () => MechPart][] = [
  ["spokedWheel clock", () => spokedWheel(60, 12, 0.8, { at: [3, -2, 1], rot: 0.3 })],
  ["spokedWheel involute, solid web", () => spokedWheel(24, 6, 2, { form: "involute", spokes: 0 })],
  ["spokedWheel, fine module (default spokes fit any size)", () => spokedWheel(130, 4, 0.4)],
  ["spokedWheel on a tilted axis, no collet", () => spokedWheel(40, 10, 1, { axis: [1, 1, 0.3], colletR: 0, spokes: 4 })],
  ["pinion clock", () => pinion(10, 2, 1.6, { at: [1, 1, 0] })],
  ["pinion involute", () => pinion(12, 3, 2, { form: "involute", axis: [0, 1, 0] })],
  ["arbor", () => arbor(0.5, 6)],
  ["arbor broken in three", () => arbor(0.5, 6, { breaks: [2, 3.1], at: [2, 2, 0] })],
  ["arbor with a span hidden in a wheel", () => arbor(0.5, 6, { inside: [[1.2, 2.5]], breaks: [4] })],
  ["jewelSetting", () => jewelSetting(1.2, { at: [0, 0, 2] })],
  ["screw slotted", () => screw(1.4, { at: [5, 0, 1] })],
  ["screw plain with shank", () => screw(1.4, { slot: false, shank: 3 })],
  ["screw slotted with shank", () => screw(1, { shank: 2, slotAngle: 1.2 })],
  ["bridge from points", () => bridge({ points: [[0, 0], [10, 3], [16, -4]], width: 5 }, 1.6, { screwHoles: [[16, -4]], jewelHoles: [[0, 0], [10, 3]] })],
  ["bridge from an outline, empty holes", () => bridge({ outline: [[-8, -5], [8, -5], [8, 5], [-8, 5]] }, 2, { jewelHoles: [[-4, 0]], screwHoles: [[4, 0]], fill: false })],
  ["cutawayShell", () => cutawayShell({ r: 20, h: 8, wall: 2, facing: 0.7 })],
  ["cutawayShell open wide", () => cutawayShell({ r: 20, h: 8, wall: 2, openAngle: 4, facing: facingCamera(CAM) })],
  ["helicalSpring", () => helicalSpring(3, 0.4, 12, 6)],
];

for (const [name, make] of PARTS) {
  test(`mech: ${name} is closed, wound outward, and its anchors lie on it`, () => {
    const p = make();
    checkPart(name, p);
    checkAnchors(name, p);
    const svg = drawPart(p, CAM, { shadow: true });
    assert.match(svg, /rig-sil/);
    assert.doesNotMatch(svg, /NaN|undefined/);
  });
}

test("mech: shifted parts move their meshes and anchors together", () => {
  const p = shifted(spokedWheel(30, 6, 0.6), [1, 2, 3]);
  checkAnchors("shifted wheel", p);
});

// ---------------------------------------------------------------- meshing
test("mech: meshCentres puts every pair exactly tangent on the pitch circles, and assertMeshed agrees", () => {
  const m = 0.4;
  const stages = [
    { driver: { teeth: 60, pitchR: 30 * m }, driven: { teeth: 10, pitchR: 5 * m }, angle: 0.4 },
    { driver: { teeth: 48, pitchR: 24 * m }, driven: { teeth: 8, pitchR: 4 * m }, angle: -1.2 },
  ];
  const at = meshCentres([2, -1], stages);
  assert.equal(at.length, 3);
  for (const [i, s] of stages.entries()) {
    const d = Math.hypot(at[i + 1]!.at[0] - at[i]!.at[0], at[i + 1]!.at[1] - at[i]!.at[1]);
    assert.ok(Math.abs(d - (s.driver.pitchR + s.driven.pitchR)) < 1e-12, `stage ${i} is off by ${d - s.driver.pitchR - s.driven.pitchR}`);
    assertMeshed({ ...s.driver, at: at[i]!.at }, { ...s.driven, at: at[i + 1]!.at });
  }
  assert.ok(Math.abs(at[1]!.speed + 6) < 1e-12 && Math.abs(at[2]!.speed - 36) < 1e-12, "ratios 60:10 then 48:8, alternating direction");
  assert.throws(() => assertMeshed({ teeth: 60, pitchR: 12, at: [0, 0] }, { teeth: 10, pitchR: 2, at: [14.01, 0] }), /miss/);
  assert.throws(() => assertMeshed({ teeth: 60, pitchR: 12, at: [0, 0] }, { teeth: 10, pitchR: 2, at: [13.9, 0] }), /overlap/);
  assert.throws(() => assertMeshed({ teeth: 60, pitchR: 12, at: [0, 0] }, { teeth: 11, pitchR: 2, at: [14, 0] }), /module/);
});

for (const form of ["clock", "involute"] as const) {
  test(`mech: meshed ${form} outlines interleave (no tooth inside the other gear) as the train turns`, () => {
    const big = { teeth: 48, pitchR: 9.6 }, small = { teeth: form === "clock" ? 8 : 14, pitchR: (form === "clock" ? 8 : 14) * 0.2 };
    for (const angle of [0, 0.7, 2.1, -2.6]) {
      for (const rot0 of [0, 0.05, 0.11]) {
        const [a, b] = meshCentres([0, 0], [{ driver: big, driven: small, angle }], rot0);
        // turn the pair through a tooth: B turns -A·(tA/tB)
        for (const turn of [0, 0.25, 0.5, 0.75].map((f) => (f * 2 * Math.PI) / big.teeth)) {
          const A = gearProfile(big.teeth, big.pitchR, { form, rot: a!.rot + turn });
          const B = gearProfile(small.teeth, small.pitchR, { form, kind: "pinion", rot: b!.rot - turn * (big.teeth / small.teeth) }).map(([x, y]) => [x + b!.at[0], y + b!.at[1]] as P2);
          const near = (p: P2) => Math.hypot(p[0] - b!.at[0], p[1] - b!.at[1]) < small.pitchR * 3;
          for (const p of A) if (near(p)) assert.ok(!pointIn(B, p[0], p[1]), `${form}: a wheel tooth is inside the pinion (angle ${angle}, turn ${turn.toFixed(3)})`);
          for (const p of B) assert.ok(!pointIn(A, p[0], p[1]), `${form}: a pinion leaf is inside the wheel (angle ${angle}, turn ${turn.toFixed(3)})`);
        }
      }
    }
    // and the teeth reach in: tips pass the other's pitch circle
    assert.ok(tipRadius(big.teeth, big.pitchR, { form }) > big.pitchR && tipRadius(small.teeth, small.pitchR, { form, kind: "pinion" }) > small.pitchR);
  });
}

test("mech: the readability rule refuses a wheel too dense for its size on screen", () => {
  assert.equal(readableTeeth(10, 3, 6), Math.floor((2 * Math.PI * 10 * 3) / 6));
  assert.equal(readableTeeth(10, 3), Math.floor((2 * Math.PI * 10 * 3) / 8), "8 px by default");
  assert.throws(() => spokedWheel(80, 4, 0.5, { pxPerUnit: 8 }), RangeError);
  assert.doesNotThrow(() => spokedWheel(24, 4, 0.5, { pxPerUnit: 8 }));
  assert.throws(() => pinion(14, 1, 1, { pxPerUnit: 4 }), RangeError);
  assert.equal(moduleOf(60, 12), 0.4);
});

// ---------------------------------------------------------------- the exploded stack
test("mech: explodedStack is assembled at 0 and pulls layers apart monotonically", () => {
  const layers = [{ thickness: 2 }, { thickness: 4, axes: [[0, 0], [5, 1]] as P2[] }, { thickness: 1.5, axes: [[0, 0]] as P2[] }];
  const closed = explodedStack(layers, 0);
  assert.deepEqual(closed.offsets, [0, 0, 0]);
  assert.deepEqual(closed.bases, [0, 2, 6]);
  assert.ok(closed.guides.every((g) => g.length === 0), "no guide lines when nothing is apart");
  let prev: number[] | null = null;
  for (const e of [0, 0.2, 0.6, 1]) {
    const s = explodedStack(layers, e, { spread: 5 });
    for (let i = 1; i < s.offsets.length; i++) {
      assert.ok(s.offsets[i]! >= s.offsets[i - 1]!, "offsets never decrease up the stack");
      assert.ok(s.bases[i]! >= s.bases[i - 1]! + layers[i - 1]!.thickness - 1e-12, "a layer never sinks into the one below");
    }
    if (prev) for (let i = 0; i < prev.length; i++) assert.ok(s.offsets[i]! >= prev[i]!, "more explode never pulls a layer back");
    prev = s.offsets;
    if (e > 0) {
      assert.equal(s.guides[1]!.length, 2);
      const [a, b] = s.guides[1]![0]!;
      assert.ok(Math.abs(a[2] - (s.bases[0]! + 2)) < 1e-12 && Math.abs(b[2] - s.bases[1]!) < 1e-12, "a guide spans exactly the gap");
    }
  }
  assert.match(centreLines(CAM, explodedStack(layers, 0.6).guides[1]!), /stroke-dasharray/);
});

// ---------------------------------------------------------------- bad input
test("mech: bad input throws RangeError", () => {
  const bad: [string, () => unknown][] = [
    ["wheel teeth 0", () => spokedWheel(0, 5, 1)],
    ["wheel fractional teeth", () => spokedWheel(30.5, 5, 1)],
    ["wheel radius -1", () => spokedWheel(30, -1, 1)],
    ["wheel thickness NaN", () => spokedWheel(30, 5, NaN)],
    ["wheel 2 spokes", () => spokedWheel(30, 5, 1, { spokes: 2 })],
    ["wheel hub larger than rim", () => spokedWheel(30, 5, 1, { hubR: 6 })],
    ["profile with no root", () => gearProfile(3, 1)],
    ["pinion 3 leaves", () => pinion(3, 1, 1)],
    ["arbor length 0", () => arbor(0.5, 0)],
    ["arbor break outside", () => arbor(0.5, 5, { breaks: [6] })],
    ["arbor pivots longer than it", () => arbor(0.5, 2, { pivotLength: 1.5 })],
    ["arbor hidden end to end", () => arbor(0.5, 2, { inside: [[0, 2]] })],
    ["mesh angle NaN", () => meshCentres([0, 0], [{ driver: { teeth: 20, pitchR: 4 }, driven: { teeth: 10, pitchR: 2 }, angle: NaN }])],
    ["mesh modules differ", () => meshCentres([0, 0], [{ driver: { teeth: 20, pitchR: 4 }, driven: { teeth: 10, pitchR: 3 }, angle: 0 }])],
    ["jewel r 0", () => jewelSetting(0)],
    ["screw negative shank", () => screw(1, { shank: -1 })],
    ["bridge no points", () => bridge({ points: [], width: 3 }, 1)],
    ["bridge hole off the edge", () => bridge({ points: [[0, 0], [10, 0]], width: 4 }, 1, { screwHoles: [[5, 2.5]] })],
    ["bridge flat outline", () => bridge({ outline: [[0, 0], [1, 0], [2, 0]] }, 1)],
    ["shell wall thicker than radius", () => cutawayShell({ r: 2, h: 2, wall: 3 })],
    ["shell open 0", () => cutawayShell({ r: 5, h: 2, wall: 1, openAngle: 0 })],
    ["spring too many turns", () => helicalSpring(2, 0.5, 3, 10)],
    ["stack explode 2", () => explodedStack([{ thickness: 1 }], 2)],
    ["stack empty", () => explodedStack([], 0.5)],
    ["stack negative thickness", () => explodedStack([{ thickness: -1 }], 0.5)],
    ["readable px 0", () => readableTeeth(5, 0)],
  ];
  for (const [what, f] of bad) assert.throws(f, RangeError, what);
});

test("mech: an assembly draws its case back first and the case front last", () => {
  const shell = cutawayShell({ r: 20, h: 8, wall: 2, openAngle: 2, facing: facingCamera(CAM) });
  const wheel = spokedWheel(40, 10, 1, { at: [0, 0, 0.5] });
  const svg = drawAssembly([wheel, shell], CAM);
  const groups = [...svg.matchAll(/<g class="rig-solid rig-m-(\w+)/g)].map((m) => m[1]);
  assert.equal(groups[0], "steel", "the case floor first");
  assert.equal(groups.at(-1), "steel", "a front piece of the wall last");
  assert.ok(groups.includes("brass"));
});
