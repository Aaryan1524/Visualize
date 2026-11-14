import assert from "node:assert/strict";
import test from "node:test";
import type { Mark, SolidMark, LinkMark } from "../core/types.ts";
import { boundsOf, type Bounds } from "../iso/solids.ts";
import { puck } from "./flow.ts";
import { TREE_PAD, TREE_PUCK, treeAssembly } from "./tree.ts";

const solids = (marks: Mark[]) => marks.filter((m): m is SolidMark => m.kind === "box" || m.kind === "cylinder");
const EPS = 1e-6;
const interpenetrate = (a: Bounds, b: Bounds) => [0, 1, 2].every((i) => a.max[i]! > b.min[i]! + EPS && b.max[i]! > a.min[i]! + EPS);

function supported(parts: SolidMark[], floor: number): string[] {
  const b = parts.map(boundsOf);
  return parts.filter((_, i) => {
    const z = b[i]!.min[2];
    if (Math.abs(z - floor) < EPS) return false;
    return !b.some((o, j) => j !== i && Math.abs(o.max[2] - z) < EPS && o.min[0] < b[i]!.max[0] && b[i]!.min[0] < o.max[0] && o.min[1] < b[i]!.max[1] && b[i]!.min[1] < o.max[1]);
  }).map((m) => m.key);
}

for (const levels of [1, 2, 3, 4]) {
  const tree = treeAssembly({ key: "t", levels, at: [3, 4, 0] });
  const marks = [...tree.marks, ...Array.from({ length: tree.size }, (_, i) => puck({ key: `v${i}`, at: tree.slot(i), label: String(i), tone: "subject", ...TREE_PUCK }))];
  test(`tree of ${levels} levels: ${tree.size} pads, no two solids interpenetrate`, () => {
    assert.equal(marks.filter((m) => m.key.startsWith("t/pad-")).length, tree.size);
    const s = solids(marks);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.ok(!interpenetrate(boundsOf(s[i]!), boundsOf(s[j]!)), `${s[i]!.key} and ${s[j]!.key}`);
  });
  test(`tree of ${levels} levels: every piece rests on the floor or another piece`, () => {
    assert.deepEqual(supported(solids(marks), 0), []);
  });
  test(`tree of ${levels} levels: keys unique, every piece owned by the tree`, () => {
    const keys = marks.map((m) => m.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(tree.marks.every((m) => m.owner === "t"));
  });
  test(`tree of ${levels} levels: children sit under their parent, nearer the reader`, () => {
    for (let i = 1; i < tree.size; i++) {
      const p = (i - 1) >> 1, c = tree.slot(i), q = tree.slot(p);
      assert.ok(c[1] > q[1], `child ${i} is nearer than parent ${p}`);
      assert.equal(tree.depth(i), tree.depth(p) + 1);
      if (i % 2 === 1) assert.ok(c[0] < q[0], `left child ${i} is left of ${p}`);
      else assert.ok(c[0] > q[0], `right child ${i} is right of ${p}`);
      const edge = tree.marks.find((m) => m.key === tree.edge(i)) as LinkMark;
      assert.deepEqual([edge.from[0], edge.from[1]], [q[0], q[1]]);
      assert.deepEqual([edge.to[0], edge.to[1]], [c[0], c[1]]);
    }
  });
  test(`tree of ${levels} levels: slots lie on pad tops, inside the plinth`, () => {
    const plinth = boundsOf(solids(tree.marks).find((m) => m.key === "t/plinth")!);
    for (let i = 0; i < tree.size; i++) {
      const pad = boundsOf(solids(tree.marks).find((m) => m.key === `t/pad-${i}`)!);
      const s = tree.slot(i);
      assert.ok(Math.abs(s[2] - pad.max[2]) < EPS);
      assert.ok(s[0] - TREE_PAD >= plinth.min[0] && s[0] + TREE_PAD <= plinth.max[0] && s[1] - TREE_PAD >= plinth.min[1] && s[1] + TREE_PAD <= plinth.max[1]);
    }
  });
}

test("edge tones mark a comparison; idle edges stay structural", () => {
  const tree = treeAssembly({ key: "t", levels: 3, edgeTone: (i) => (i === 5 ? "accent" : undefined) });
  const edges = tree.marks.filter((m): m is LinkMark => m.kind === "link");
  assert.equal(edges.length, 6);
  assert.deepEqual(edges.filter((e) => e.tone === "accent").map((e) => e.key), ["t/edge-5"]);
});

test("impossible trees are refused", () => {
  assert.throws(() => treeAssembly({ key: "t", levels: 0 }), RangeError);
  assert.throws(() => treeAssembly({ key: "t", levels: 5 }), RangeError);
  assert.throws(() => treeAssembly({ key: "t", levels: 3, leafPitch: 20 }), RangeError);
  assert.throws(() => treeAssembly({ key: "t", levels: 3, at: [NaN, 0, 0] }), RangeError);
  const t = treeAssembly({ key: "t", levels: 2 });
  assert.throws(() => t.slot(3), RangeError);
  assert.throws(() => t.edge(0), RangeError);
});
