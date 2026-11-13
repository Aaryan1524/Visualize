import assert from "node:assert/strict";
import test from "node:test";
import type { Mark, SolidMark, Vec3 } from "../core/types.ts";
import { boundsOf, type Bounds } from "../iso/solids.ts";
import { cable, keyStore, ledger, message, plate, server, terminal, MESSAGE_SIZE } from "./network.ts";

const solids = (marks: Mark[]) => marks.filter((m): m is SolidMark => m.kind === "box" || m.kind === "cylinder");
const EPS = 1e-6;

function interpenetrate(a: Bounds, b: Bounds): boolean {
  for (let i = 0; i < 3; i++) if (a.max[i]! <= b.min[i]! + EPS || b.max[i]! <= a.min[i]! + EPS) return false;
  return true;
}

/** Every piece stands on the ground (z = 0) or on the top of another piece it overlaps in plan. */
function supported(parts: SolidMark[]): string[] {
  const out: string[] = [];
  const b = parts.map(boundsOf);
  parts.forEach((m, i) => {
    const z = b[i]!.min[2];
    if (Math.abs(z) < EPS || z < 0) return;
    const ok = b.some((o, j) => j !== i && Math.abs(o.max[2] - z) < EPS && o.min[0] < b[i]!.max[0] && b[i]!.min[0] < o.max[0] && o.min[1] < b[i]!.max[1] && b[i]!.min[1] < o.max[1]);
    if (!ok) out.push(m.key);
  });
  return out;
}

function onSurface(p: Vec3, parts: SolidMark[], slack = 1.5): boolean {
  return parts.map(boundsOf).some((b) => [0, 1, 2].every((i) => p[i]! >= b.min[i]! - slack && p[i]! <= b.max[i]! + slack));
}

const at: Vec3 = [10, 20, 0];
const cases = {
  terminal: terminal("t", at, { status: "paid" }),
  server: server("s", at, { lamp: "accent" }),
  ledger: ledger("l", [40, 40, 0], [{ id: "1", tone: "good" }, { id: "2", tone: "bad" }, { id: "3", tone: "bad" }]),
  keyStore: keyStore("k", at, { stored: true }),
  plate: plate("p", at, [120, 60]),
};

for (const [name, part] of Object.entries(cases)) {
  test(`${name}: no two pieces interpenetrate`, () => {
    const s = solids(part.marks);
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) assert.ok(!interpenetrate(boundsOf(s[i]!), boundsOf(s[j]!)), `${s[i]!.key} and ${s[j]!.key}`);
  });
  test(`${name}: every piece rests on the ground or on another piece`, () => {
    assert.deepEqual(supported(solids(part.marks).filter((m) => boundsOf(m).max[2] > EPS)), []);
  });
  test(`${name}: keys are unique and share the part's prefix`, () => {
    const keys = part.marks.map((m) => m.key);
    assert.equal(new Set(keys).size, keys.length);
    const prefix = keys[0]!.split("/")[0]!;
    assert.ok(keys.every((k) => k === prefix || k.startsWith(`${prefix}/`)), keys.join(", "));
  });
}

test("anchors lie on or beside their part", () => {
  const t = cases.terminal, s = cases.server, l = cases.ledger;
  for (const name of ["port", "top", "screen", "foot"] as const) assert.ok(onSurface(t.anchor[name], solids(t.marks)), `terminal ${name}`);
  for (const name of ["inPort", "outPort", "top", "front", "foot"] as const) assert.ok(onSurface(s.anchor[name], solids(s.marks)), `server ${name}`);
  for (const name of ["inPort", "top", "front"] as const) assert.ok(onSurface(l.anchor[name], solids(l.marks)), `ledger ${name}`);
});

test("pins name a real piece of the part, and lie on it", () => {
  for (const [p, name] of [[cases.terminal, "foot"], [cases.server, "foot"], [cases.ledger, "front"], [cases.keyStore, "front"]] as const) {
    const pin = (p.pin as (n: string) => { key: string; at: Vec3 })(name);
    const piece = solids(p.marks).find((m) => m.key === pin.key);
    assert.ok(piece, `${p.key} pin ${name} names ${pin.key}`);
    assert.ok(onSurface(pin.at, [piece!]), `${p.key} pin ${name} lies on ${pin.key}`);
  }
});

test("a cable bound to anchors records the parts its ends belong to", () => {
  const c = cable("c", [cases.terminal, "port"], [cases.server, "inPort"]);
  assert.deepEqual(c.ends, ["t", "s"]);
  assert.deepEqual([c.from[0], c.from[1]], [cases.terminal.anchor.port[0], cases.terminal.anchor.port[1]]);
  assert.throws(() => cable("x", [cases.terminal, "nope"], [cases.server, "inPort"]), RangeError);
});

test("a message waiting at the terminal's outbox sits on the cable, clear of the terminal", () => {
  const t = cases.terminal;
  const msg = boundsOf(message("m", t.anchor.outbox!, "request"));
  for (const piece of solids(t.marks)) assert.ok(!interpenetrate(msg, boundsOf(piece)), piece.key);
  assert.ok(msg.min[2] > 0 && msg.min[2] < 1, "rests just above the cable");
  assert.deepEqual(msg.max.map((v, i) => v - msg.min[i]!), [...MESSAGE_SIZE]);
});

test("the ledger stacks exactly one coin per record, each on the one below", () => {
  const coins = solids(cases.ledger.marks).filter((m) => m.key.includes("/coin-"));
  assert.equal(coins.length, 3);
  const b = coins.map(boundsOf).sort((p, q) => p.min[2] - q.min[2]);
  for (let i = 1; i < b.length; i++) assert.ok(b[i]!.min[2] >= b[i - 1]!.max[2] - EPS, "coins do not overlap");
});

test("the server's lamp tone and the terminal's status come from the options", () => {
  const tower = cases.server.marks.find((m) => m.key === "s/tower");
  assert.equal(tower?.kind === "box" ? tower.surface?.lamp?.tone : undefined, "accent");
  const body = cases.terminal.marks.find((m) => m.key === "t/body");
  assert.equal(body?.kind === "box" ? body.label : undefined, "paid");
});

test("cables lie on the plate and keep their route", () => {
  const c = cable("c", [0, 0, 7], [50, 0, 3], [[25, 10, 9]]);
  assert.equal(c.cable, true);
  assert.ok([c.from, c.to, ...(c.via ?? [])].every((p) => p[2] === 0.4));
});

test("impossible inputs are rejected", () => {
  assert.throws(() => plate("p", at, [10, 10]), RangeError);
  assert.throws(() => terminal("t", [Number.NaN, 0, 0]), RangeError);
  assert.throws(() => ledger("l", [0, Infinity, 0], []), RangeError);
});
