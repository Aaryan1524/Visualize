import assert from "node:assert/strict";
import test from "node:test";
import { simulate, totalCharged, type Config } from "./model.ts";
import { SCENARIO } from "./scene.ts";

const last = (cfg: Config) => simulate(cfg).at(-1)!.state;

test("the scene's scenario: two charges without a key, one with", () => {
  const unsafe = last({ ...SCENARIO, idempotent: false });
  const safe = last({ ...SCENARIO, idempotent: true });
  assert.equal(unsafe.ledger.length, 2);
  assert.equal(totalCharged(unsafe), 2 * SCENARIO.amount);
  assert.equal(safe.ledger.length, 1);
  assert.equal(totalCharged(safe), SCENARIO.amount);
  assert.equal(unsafe.client.status, "paid");
  assert.equal(safe.client.status, "paid");
  assert.equal(safe.client.attempts, 2, "the client retried once in both worlds");
});

test("both worlds are identical until the retry reaches the server", () => {
  const a = simulate({ ...SCENARIO, idempotent: false });
  const b = simulate({ ...SCENARIO, idempotent: true });
  const firstDiff = a.findIndex((x, i) => x.event.type !== b[i]?.event.type);
  const diverge = a[firstDiff]!;
  assert.equal(diverge.event.type, "charge");
  assert.equal(b[firstDiff]!.event.type, "replay");
  assert.equal(diverge.event.t, b[firstDiff]!.event.t, "divergence happens at the same instant");
});

test("the simulation is deterministic", () => {
  assert.deepEqual(simulate({ ...SCENARIO, idempotent: true }), simulate({ ...SCENARIO, idempotent: true }));
});

test("time never goes backwards and every message is resolved", () => {
  for (const idempotent of [false, true]) {
    const run = simulate({ ...SCENARIO, idempotent });
    run.forEach((r, i) => i && assert.ok(r.event.t >= run[i - 1]!.event.t));
    assert.equal(run.at(-1)!.state.inflight.length, 0);
  }
});

/** Every combination of dropped requests and responses over three attempts. */
function faultSchedules(): string[][] {
  const ids = [1, 2, 3].flatMap((n) => [`request-${n}`, `response-${n}`]);
  const out: string[][] = [];
  for (let mask = 0; mask < 1 << ids.length; mask++) out.push(ids.filter((_, i) => mask & (1 << i)));
  return out;
}

test("with a key: never more than one charge, under any loss pattern", () => {
  for (const drop of faultSchedules()) {
    const s = last({ ...SCENARIO, idempotent: true, drop, maxAttempts: 3 });
    assert.ok(s.ledger.length <= 1, `drop ${drop.join(",")}: ${s.ledger.length} charges`);
    if (s.client.status === "paid") assert.equal(s.ledger.length, 1, "paid implies charged exactly once");
  }
});

test("without a key: one charge per request that reaches the server", () => {
  for (const drop of faultSchedules()) {
    const run = simulate({ ...SCENARIO, idempotent: false, drop, maxAttempts: 3 });
    const reached = run.filter((r) => r.event.type === "arrive" && r.event.message.kind === "request").length;
    assert.equal(run.at(-1)!.state.ledger.length, reached, `drop ${drop.join(",")}`);
  }
});

test("a lost request is retried, and the client gives up after the last attempt", () => {
  const all = ["request-1", "request-2", "request-3"];
  const s = last({ ...SCENARIO, idempotent: true, drop: all, maxAttempts: 3 });
  assert.equal(s.client.status, "failed");
  assert.equal(s.ledger.length, 0);
});

test("with a key, every attempt carries the one key the client made; without, none does", () => {
  const sent = (idempotent: boolean) =>
    simulate({ ...SCENARIO, idempotent }).flatMap((r) => (r.event.type === "send" && r.event.message.kind === "request" ? [r.event.message] : []));
  assert.deepEqual(sent(true).map((m) => m.key), [SCENARIO.key, SCENARIO.key]);
  assert.ok(sent(false).every((m) => m.key === undefined));
});

test("the reply leaves replyTime after the database work", () => {
  const run = simulate({ ...SCENARIO, idempotent: true });
  const charge = run.find((r) => r.event.type === "charge")!.event.t;
  const reply = run.find((r) => r.event.type === "send" && r.event.message.kind === "response")!.event.t;
  assert.equal(reply - charge, SCENARIO.replyTime);
});
