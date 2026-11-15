// node --test examples/lock/model.test.mjs
//
// The reference for "does this key open this lock?" is written here on its own: compare the
// key's cut depths with the lock's pin depths, and allow a miss of at most the tolerance.
// The model never reads the key code; it finds each stack's height by contact between the
// chamfered key-pin tip and the blade profile. These tests check that the two agree, plus the
// physical properties the drawing relies on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK, PINNING, KEYS, VARIANTS, MODELS, makeModel, stacks, keyPinTip, bladeTop, cutRoot, keyPinLength, pinX, tipRise, macs, keyCount, keyOutline, OFFSETS, bindingOrder, pickStacks } from "./model.mjs";

const L = LOCK;
// Independent reference: opens iff every cut is within the tolerance of its pin's depth.
const refOpens = (pinning, cuts, tol) => pinning.every((d, i) => Math.abs(cuts[i] - d) * L.step <= tol + 1e-9);
const rng = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const opens = (pinning, cuts, tol) => stacks(pinning, cuts, L.Ltip, tol).every((s) => s.block === null);

test("the stated numbers", () => {
  assert.equal(PINNING.length, 5);
  assert.ok(Math.abs(cutRoot(0) - 3.3) < 1e-12 && Math.abs(cutRoot(9) - (3.3 - 9 * 0.381)) < 1e-12);
  assert.ok(Math.abs(keyPinLength(0) - 3.05) < 1e-9 && Math.abs(keyPinLength(9) - 6.479) < 1e-9);
  assert.ok(Math.abs(pinX(4) - (5.87 + 4 * 3.96)) < 1e-12);
  assert.equal(MODELS.tight.combinations, 100000);
  // the depth step is wider than the tight tolerance and narrower than the loose one
  assert.ok(L.step > VARIANTS.tight.tol && L.step < VARIANTS.loose.tol);
  // the right key really is the lock's pinning, the wrong key differs in one cut by one depth
  assert.deepEqual(KEYS.right, PINNING);
  const diff = KEYS.wrong.map((c, i) => c - PINNING[i]).filter((v) => v);
  assert.deepEqual(diff, [-1]);
});

test("each cut keeps its full root after its neighbours and the tip ramp are applied", () => {
  const r = rng(11);
  for (let n = 0; n < 300; n++) {
    const cuts = [Math.floor(r() * 10)];
    while (cuts.length < 5) cuts.push(Math.max(0, Math.min(9, cuts.at(-1) + Math.floor(r() * 17) - 8)));
    for (let i = 0; i < cuts.length; i++)
      for (const dx of [-L.rootW / 2, 0, L.rootW / 2]) {
        const y = bladeTop(cuts, pinX(i) + dx);
        assert.ok(Math.abs(y - cutRoot(cuts[i])) < 1e-9, `cut ${i} of ${cuts} at ${dx}: ${y}`);
      }
  }
});

test("the MACS is exactly where a neighbour's flank starts to eat a root", () => {
  const m = macs();
  assert.equal(m, 8);
  const ok = [0, m, 0, 0, 0], bad = [0, m + 1, 0, 0, 0];
  assert.ok(Math.abs(bladeTop(ok, pinX(0) + L.rootW / 2) - cutRoot(0)) < 1e-9);
  assert.ok(bladeTop(bad, pinX(0) + L.rootW / 2) < cutRoot(0) - 0.1);
  // counting by brute force over all 10^5 keys agrees with the model's count
  let n = 0;
  for (let k = 0; k < 1e5; k++) {
    const c = String(k).padStart(5, "0").split("").map(Number);
    if (c.every((d, i) => i === 0 || Math.abs(d - c[i - 1]) <= m)) n++;
  }
  assert.equal(keyCount(5), n);
});

test("with no key every stack blocks the plug with its driver pin, for every depth", () => {
  for (let d = 0; d < L.depths; d++)
    for (const tol of Object.values(VARIANTS).map((v) => v.tol)) {
      const [s] = stacks([d], null, 0, tol);
      assert.equal(s.block, "driver", `depth ${d}`);
      assert.ok(s.keyTop < L.R - tol && s.keyTop + L.driver > L.R + tol, "the driver spans the shear line");
    }
});

for (const [name, M] of Object.entries(MODELS)) {
  test(`${name}: the right key, fully in, puts every gap on the shear line`, () => {
    for (const s of M.stackAt("right", L.Ltip)) assert.ok(Math.abs(s.miss) < 1e-9, `chamber ${s.i}: ${s.miss}`);
    assert.equal(M.turns("right"), true);
    assert.equal(M.turnLimit("right", L.Ltip), 90);
  });

  test(`${name}: geometric model agrees with the reference on every one-off key and 2000 random keys`, () => {
    let n = 0;
    for (let i = 0; i < PINNING.length; i++)
      for (let d = 0; d < L.depths; d++) {
        const cuts = PINNING.slice();
        cuts[i] = d;
        assert.equal(opens(PINNING, cuts, M.tol), refOpens(PINNING, cuts, M.tol), `${cuts}`);
        n++;
      }
    const r = rng(5);
    for (let k = 0; k < 2000; k++) {
      const pin = PINNING.map(() => Math.floor(r() * 10));
      const cuts = pin.map((d) => (r() < 0.5 ? d : Math.max(0, Math.min(9, d + Math.floor(r() * 5) - 2))));
      assert.equal(opens(pin, cuts, M.tol), refOpens(pin, cuts, M.tol), `${pin} / ${cuts}`);
      n++;
    }
    assert.ok(n > 2000);
  });

  test(`${name}: a too-shallow cut blocks with the key pin, a too-deep cut with the driver`, () => {
    for (let i = 0; i < PINNING.length; i++) {
      const lo = PINNING.slice(), hi = PINNING.slice();
      lo[i] = PINNING[i] - 2; // shallower by two depths: lifts the key pin 0.76 mm too high
      hi[i] = PINNING[i] + 2;
      if (lo[i] >= 0) assert.equal(stacks(PINNING, lo, L.Ltip, M.tol)[i].block, "key");
      if (hi[i] <= 9) assert.equal(stacks(PINNING, hi, L.Ltip, M.tol)[i].block, "driver");
    }
  });

  test(`${name}: the wrong key's outcome`, () => {
    const s = M.stackAt("wrong", L.Ltip)[2];
    assert.ok(Math.abs(s.miss - L.step) < 1e-9, "the third key pin sits one depth step too high");
    if (name === "tight") assert.deepEqual([M.turns("wrong"), s.block], [false, "key"]);
    else assert.deepEqual([M.turns("wrong"), s.block], [true, null]);
  });
}

// Sweep a key in, 0.02 mm at a time: the pin tip never enters the blade, and no spring is
// ever crushed past solid. `tipFn` is the contact rule under test.
function sweep(tipFn, cuts, lock = L) {
  const fails = [];
  for (let ins = 0; ins <= lock.Ltip + 1e-9; ins += 0.02) {
    const shoulder = ins - lock.Ltip;
    for (let i = 0; i < PINNING.length; i++) {
      const tip = tipFn(cuts, ins, i);
      for (let dx = -lock.pinD / 2; dx <= lock.pinD / 2 + 1e-9; dx += 0.01) {
        const top = bladeTop(cuts, pinX(i) + dx - shoulder);
        if (tip + tipRise(dx) < top - 0.002) fails.push(`pin ${i} enters the blade by ${(top - tip - tipRise(dx)).toFixed(3)} at ins ${ins.toFixed(2)}`);
      }
      const spring = lock.chamberTop - (tip + keyPinLength(PINNING[i]) + lock.driver);
      if (spring < lock.springSolid) fails.push(`spring ${i} crushed (${spring.toFixed(2)}) at ins ${ins.toFixed(2)}`);
    }
  }
  return fails;
}

test("insertion sweep: no pin enters the blade, no spring goes solid (contact found to 2 µm), for both keys", () => {
  for (const cuts of Object.values(KEYS)) assert.deepEqual(sweep((c, ins, i) => keyPinTip(c, ins, i), cuts).slice(0, 3), []);
  // an uncut key blank lifts every stack highest: the chambers must still hold them
  assert.deepEqual(sweep((c, ins, i) => keyPinTip(c, ins, i), [0, 0, 0, 0, 0]).slice(0, 3), []);
});

test("planted fault: point contact at the pin axis lets the chamfer cut into the blade", () => {
  const pointContact = (cuts, ins, i) => Math.max(L.rest, bladeTop(cuts, pinX(i) - (ins - L.Ltip)));
  assert.ok(sweep(pointContact, KEYS.right).length > 0, "the sweep must catch a penetrating pin");
});

test("planted fault: a chamber 3 mm too short crushes a spring", () => {
  const short = { ...L, chamberTop: L.chamberTop - 3 };
  assert.ok(sweep((c, ins, i) => keyPinTip(c, ins, i), [0, 0, 0, 0, 0], short).some((f) => f.includes("crushed")));
});

test("a stack only rises as far as the blade under it requires (it rests on the blade)", () => {
  const M = makeModel();
  for (let ins = 10; ins <= L.Ltip; ins += 0.37)
    for (const s of M.stackAt("right", ins)) {
      if (s.tip <= L.rest + 1e-9) continue;
      // somewhere under the pin, the tip surface touches the blade
      let touch = Infinity;
      for (let dx = -L.pinD / 2; dx <= L.pinD / 2; dx += 0.0025) touch = Math.min(touch, s.tip + tipRise(dx) - bladeTop(KEYS.right, s.x + dx - (ins - L.Ltip)));
      assert.ok(touch < 0.02, `stack ${s.i} floats ${touch.toFixed(3)} above the blade at ins ${ins}`);
    }
});

// ---------------------------------------------------------------- picking
// A stack blocks while any of its parts crosses the shear line.
const crosses = (s) => (s.keyTop > L.R + 1e-9 && s.tip < L.R - 1e-9) || (s.drvBot < L.R - 1e-9 && s.drvTop > L.R + 1e-9);

test("picking: chambers bind in order of their offset, one at a time", () => {
  const order = bindingOrder();
  assert.equal(new Set(order).size, PINNING.length);
  for (let k = 1; k < order.length; k++) assert.ok(OFFSETS[order[k - 1]] > OFFSETS[order[k]], "offsets are distinct, so exactly one chamber binds at a time");
  // the binding chamber is the one furthest off among those not yet set
  for (let j = 0; j < order.length; j++) {
    const loose = order.slice(j);
    assert.equal(order[j], loose.reduce((a, b) => (OFFSETS[b] > OFFSETS[a] ? b : a)));
  }
});

test("picking: each set chamber leaves nothing across the shear line; all set, the plug is free", () => {
  const n = PINNING.length;
  for (let j = 0; j <= n; j++) {
    const st = pickStacks(PINNING, j, 0);
    st.forEach((s) => {
      if (s.set) {
        assert.ok(!crosses(s), `chamber ${s.i + 1} is set but blocks`);
        assert.ok(Math.abs(s.drvBot - L.R) < 1e-9, "a set driver pin rests on the plug's edge");
        assert.ok(Math.abs(s.tip - L.rest) < 1e-9, "a set chamber's key pin drops back to rest");
      } else assert.ok(crosses(s), `chamber ${s.i + 1} is not set, so its driver pin still crosses`);
    });
  }
  assert.ok(pickStacks(PINNING, n, 0).every((s) => !crosses(s)));
});

test("picking: lifting the binding stack fully puts its gap on the shear line, and no further", () => {
  const order = bindingOrder();
  for (let j = 0; j < order.length; j++) {
    const s = pickStacks(PINNING, j, 1)[order[j]];
    assert.ok(Math.abs(s.keyTop - L.R) < 1e-9);
    assert.ok(s.drvTop <= L.chamberTop - L.springSolid + 1e-9, "the spring is not crushed solid");
  }
});

test("planted fault: a lock with two equal offsets has no single binding chamber, and the check sees it", () => {
  const flawed = [0.02, 0.02, 0.01, 0.0, -0.01];
  const order = bindingOrder(flawed);
  const distinct = order.every((c, k) => k === 0 || flawed[order[k - 1]] > flawed[c]);
  assert.equal(distinct, false);
  // and the representative lock binds in an order a picker has to discover, not front to back
  assert.notDeepEqual(bindingOrder(), [...PINNING.keys()]);
});

test("the key outline follows the blade: every point of the bitting is on the model's profile", () => {
  for (const cuts of [KEYS.right, KEYS.wrong, [0, 9, 0, 9, 0].map((d, i) => Math.min(d, 5 + i))]) {
    const out = keyOutline(cuts);
    const blade = out.filter(([u, y]) => u > 0 && u < L.Ltip && y > 0);
    assert.ok(blade.length > 400);
    for (const [u, y] of blade) {
      const top = bladeTop(cuts, u);
      assert.ok(Math.abs(y - top) < 1e-9 || y < top, `outline above the blade at u=${u}`);
    }
  }
});

test("the lab's whole range: any key the reader can cut seats without crushing a spring, and the verdict matches the reference within the MACS", () => {
  const r = rng(29);
  for (const [name, M] of Object.entries(MODELS)) {
    for (let n = 0; n < 3000; n++) {
      const cuts = PINNING.map(() => Math.floor(r() * 10));
      const st = stacks(PINNING, cuts, L.Ltip, M.tol);
      for (const s of st) assert.ok(s.spring >= L.springSolid - 1e-9, `${name}: spring crushed for ${cuts}`);
      const withinMacs = cuts.every((c, i) => i === 0 || Math.abs(c - cuts[i - 1]) <= macs());
      if (withinMacs) assert.equal(st.every((s) => s.block === null), refOpens(PINNING, cuts, M.tol), `${name}: ${cuts}`);
    }
  }
});
