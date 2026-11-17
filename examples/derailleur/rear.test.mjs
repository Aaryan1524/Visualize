// node --test examples/derailleur/rear.test.mjs
//
// View A is a true rear elevation: its camera is straight behind and level, each cog's bar stands at
// the model's lateral position, and the offset written between the cog's centreline and the guide
// pulley's is the model's off-line value, across the lab's whole range.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, indexing } from "./model.mjs";
import { rearView, VIEW_A } from "./rear.mjs";
import { axesOf, dot } from "../../src/rig/index.ts";

const SCALE = 2000 / 50; // as the page: 50 mm either side of the window's centre
const PX = 10; // svg units per screen pixel at 1440 x 900
const W = (x, y, e) => [x, -e, y];
const numbersIn = (svg) => [...svg.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

test("View A's camera is straight from behind and level: azimuth 180°, elevation 0", () => {
  assert.equal(VIEW_A.azimuth, 180);
  assert.equal(VIEW_A.elevation, 0);
  const R = rearView(MODELS.road, { scale: SCALE });
  assert.equal(R.cam.azimuth, 180);
  assert.equal(R.cam.elevation, 0);
  // so fore and aft drops out, outboard is to the right and up is up
  const ax = axesOf(R.cam.azimuth, R.cam.elevation);
  assert.ok(Math.abs(dot(W(1, 0, 0), ax.right)) < 1e-12 && Math.abs(dot(W(1, 0, 0), ax.up)) < 1e-12, "a fore-and-aft step does not show");
  assert.ok(Math.abs(dot(W(0, 0, 1), ax.right) - 1) < 1e-12, "outboard is to the right");
  assert.ok(Math.abs(dot(W(0, 1, 0), ax.up) - 1) < 1e-12, "up is up");
});

for (const [name, M] of Object.entries(MODELS)) {
  test(`${name}: each cog's bar stands at the model's lateral position, as wide as the cog, within a pixel`, () => {
    const R = rearView(M, { scale: SCALE });
    for (let k = 0; k <= M.last; k++) {
      const part = R.parts.find((p) => p.id === `a-cog${k}`);
      const x = Number(part.svg.match(/translate\((-?[\d.]+) 0\)/)[1]);
      assert.ok(Math.abs(x - SCALE * -M.cogZ(k)) < PX, `cog ${k + 1}: at ${x}, the model has ${SCALE * -M.cogZ(k)}`);
      const xs = numbersIn(part.svg).map((p) => p[0]);
      const half = (Math.max(...xs) - Math.min(...xs)) / 2, mid = (Math.max(...xs) + Math.min(...xs)) / 2;
      assert.ok(Math.abs(mid) < PX / 2, `cog ${k + 1}: the bar is centred on its line (${mid})`);
      assert.ok(Math.abs(half - (1.8 / 2) * SCALE) < PX, `cog ${k + 1}: the bar is the cog's thickness (${(2 * half / SCALE).toFixed(2)} mm)`);
    }
  });

  test(`${name}: the offset drawn between the cog's and the guide pulley's centrelines is the model's, across the lab`, () => {
    const R = rearView(M, { scale: SCALE });
    let shown = 0, checked = 0;
    for (let gear = 1; gear <= M.n; gear++)
      for (let e10 = -30; e10 <= 30; e10++)
        for (let l2 = 0; l2 <= 12; l2++) {
          const err = e10 / 10, lOut = l2 / 2;
          const x = indexing(M, gear, err, lOut), pose = M.pose(x.pull, x.on, lOut);
          assert.ok(Math.abs(pose.off - x.off) < 1e-12, "the page's pose and the lab agree");
          const out = R.pose({ pose, roll: 0 });
          const drawn = (out.at.cogLine - out.at.pulleyLine) / SCALE;
          assert.ok(Math.abs(drawn - x.off) < 1e-9, `gear ${gear}, error ${err}, L out ${lOut}: drawn ${drawn}, model ${x.off}`);
          const label = out.items.find((i) => i.id === "a-gapText");
          if (Math.abs(x.off) >= 0.005) {
            assert.ok(!label.hidden && label.svg.includes(`${Math.abs(x.off).toFixed(2)} mm ${x.off > 0 ? "inboard" : "outboard"}`), `gear ${gear}, error ${err}: the label says ${label.svg}`);
            shown++;
          } else assert.ok(label.hidden, `gear ${gear}, error ${err}: on line, no label`);
          checked++;
        }
    assert.ok(checked > 8000 && shown > 1000, `${checked} states, ${shown} with a label`);
  });

  test(`${name}: from behind, the parts only slide: cogs stay put, and pulleys, chain links and knuckles move by a translate`, () => {
    const R = rearView(M, { scale: SCALE });
    for (const k of [0, 4, M.last]) {
      const pose = M.pose(M.pullFor(k), k);
      for (const roll of [0, 23.7]) {
        const out = R.pose({ pose, roll });
        for (const it of out.items) {
          if (it.hidden || !it.transform) continue;
          if (/^a-(cage|link|arm|gapBar)/.test(it.id)) continue; // stretched to a length: the cage's height, a link's span, the gap
          assert.match(it.transform, /^translate\(/, `${it.id} moves by ${it.transform}`);
        }
        const chain = out.items.filter((i) => /^a-cn\d+$/.test(i.id) && !i.hidden);
        assert.ok(chain.length >= 8, `the chain shows ${chain.length} links`);
      }
    }
  });
}
