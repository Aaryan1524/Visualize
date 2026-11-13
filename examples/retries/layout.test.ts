import assert from "node:assert/strict";
import test from "node:test";
import { compile, defineScene } from "../../src/core/scene.ts";
import type { LabelMark, LinkMark, Mark, SolidMark, Vec3 } from "../../src/core/types.ts";
import { boundsOf, type Bounds } from "../../src/iso/solids.ts";
import scene, { LAYOUT, viewWith, type Layout } from "./scene.ts";

// Moving actors must not need any other edit: cables, messages and label pins
// come from the parts' anchors, so they follow wherever the parts stand.

const solid = (m: Mark): m is SolidMark => m.kind === "box" || m.kind === "cylinder";
const foundation = (m: SolidMark) => m.kind === "box" && m.role === "foundation";
const near = (p: Vec3, b: Bounds, slack = 1.5) => [0, 1, 2].every((i) => p[i]! >= b.min[i]! - slack && p[i]! <= b.max[i]! + slack);
const overlap = (a: Bounds, b: Bounds) => [0, 1, 2].every((i) => a.max[i]! > b.min[i]! + 1e-6 && b.max[i]! > a.min[i]! + 1e-6);

function problems(L: Layout): string[] {
  const out: string[] = [];
  const steps = compile(defineScene({ ...scene, view: viewWith(L) })).steps;
  steps.forEach((st, k) => {
    const solids = st.marks.filter(solid);
    const ownerSolids = (o: string) => solids.filter((m) => (m.owner ?? m.key) === o && !foundation(m));
    for (const m of st.marks) {
      if (m.kind === "link" && (m as LinkMark).ends) {
        const c = m as LinkMark;
        [c.from, c.to].forEach((p, i) => {
          if (!ownerSolids(c.ends![i]!).some((s) => near(p, boundsOf(s)))) out.push(`step ${k}: ${c.key} end ${i} is not on ${c.ends![i]}`);
        });
      }
      if (m.kind === "label" && (m as LabelMark).target) {
        const t = (m as LabelMark).target!;
        const piece = solids.find((s) => s.key === t.key);
        if (!piece) out.push(`step ${k}: ${m.key} pins ${t.key}, which is not drawn`);
        else if (!near(t.at, boundsOf(piece))) out.push(`step ${k}: ${m.key} pin is not on ${t.key}`);
      }
    }
    // Messages resting on the wire never sink into an actor.
    for (const msg of solids.filter((m) => m.key.includes("/msg-") && !m.leaving)) {
      for (const s of solids) {
        if (s === msg || foundation(s)) continue;
        if (overlap(boundsOf(msg), boundsOf(s))) out.push(`step ${k}: ${msg.key} intersects ${s.key}`);
      }
    }
  });
  return out;
}

test("the shipped layout: cables, pins and messages all sit on their parts", () => {
  assert.deepEqual(problems(LAYOUT), []);
});

test("moving and spreading the actors needs no other edit", () => {
  const moved: Layout = { lane: LAYOUT.lane + 18, terminalX: LAYOUT.terminalX - 20, serverX: LAYOUT.serverX + 17, storeX: LAYOUT.storeX + 26, ledgerX: LAYOUT.ledgerX + 41 };
  assert.deepEqual(problems(moved), []);
});

test("the check is not vacuous: a cable bound to the wrong part is reported", () => {
  const broken = defineScene({
    ...scene,
    view: (s, e) => viewWith(LAYOUT)(s, e).map((m) => (m.kind === "link" && (m as LinkMark).ends ? { ...m, ends: ["safe/ledger", "safe/terminal"] as const } : m)),
  });
  const steps = compile(broken).steps;
  const link = steps[1]!.marks.find((m) => m.kind === "link" && (m as LinkMark).ends) as LinkMark;
  const solids = steps[1]!.marks.filter(solid).filter((m) => (m.owner ?? m.key) === "safe/ledger");
  assert.ok(!solids.some((s) => near(link.from, boundsOf(s))), "the planted end would be caught");
});
