import { test } from "node:test";
import assert from "node:assert/strict";
import { MA, MODELS, simulate, snapshotAt } from "./model.mjs";

// Independent reference scheduler (direct formula for 3 data-independent module tasks)
function refClean(parallel) {
  const durs = MA.catalog.slice(0, 3).map((t) => t.thinkMs + t.toolMs + t.distillMs);
  const work = parallel ? Math.max(...durs) : durs.reduce((a, b) => a + b, 0);
  const verify = parallel ? MA.verifyMs : 0; // only orchestrated mode has an independent verifier agent
  return MA.planMs + work + verify + MA.synthMs;
}

test("multi-agent: clean wall-clock totals match independent DAG reference (including honest monolith baseline)", () => {
  const orch = MODELS.orchestrated;
  const mono = MODELS.monolith;
  assert.equal(orch.clean.totalMs, refClean(true));
  assert.equal(mono.clean.totalMs, refClean(false));
  assert.equal(orch.clean.totalMs, 6400);
  assert.equal(mono.clean.totalMs, 10600);
  assert.equal(mono.clean.lanes.length, 1, "single monolithic agent truly has 1 lane, no second verifier lane");
  assert.ok(Math.abs(orch.clean.speedup - 10600 / 6400) < 0.01);
  assert.equal(mono.clean.speedup, 1);
});

test("multi-agent: worker agent turn includes Think -> Tool I/O -> post-tool Distill", () => {
  for (const t of MODELS.orchestrated.clean.tasks) {
    assert.equal(t.segments.length, 3);
    assert.deepEqual(t.segments.map((s) => s.kind), ["think", "tool", "think"]);
    assert.ok(t.distillMs > 0);
  }
});

test("multi-agent: context isolation separates fan-in (8.6k vs 50.0k), end-of-run (11.0k vs 52.4k) and aggregate cost (64.4k vs 52.4k)", () => {
  const orch = MODELS.orchestrated;
  const mono = MODELS.monolith;
  assert.equal(orch.clean.rawTotal, 47.0);
  assert.equal(orch.clean.summaryTotal, 5.6);
  assert.equal(orch.clean.fanInContext, 8.6);
  assert.equal(orch.clean.orchestratorContext, 11.0);
  assert.equal(orch.clean.peakContext, 18.0);
  assert.equal(orch.clean.peakOverflow, false);
  // Verifier context must exceed the 5.6k merged summaries it inspects
  assert.ok(MA.verifyTokens > orch.clean.summaryTotal);
  // Aggregate token trade-off: orchestrated uses more total tokens (64.4k) than monolith (52.4k)
  assert.equal(orch.clean.aggregateTokens, 64.4);
  assert.equal(mono.clean.aggregateTokens, 52.4);
  assert.ok(orch.clean.aggregateTokens > mono.clean.aggregateTokens);
  // Monolith & uncompressed fan-in overflow the 32k cliff
  assert.equal(mono.clean.fanInContext, 50.0);
  assert.equal(mono.clean.orchestratorContext, 52.4);
  assert.equal(mono.clean.peakOverflow, true);
  assert.equal(orch.uncompressed.fanInContext, 50.0);
  assert.equal(orch.uncompressed.orchestratorOverflow, true);
});

test("multi-agent: localized tool retry overlaps 1.2 s of Billing (hiding 0.8 s net delay) instead of adding full 1.7 s", () => {
  const orch = MODELS.orchestrated;
  const mono = MODELS.monolith;
  assert.equal(orch.withFault.totalMs - orch.clean.totalMs, 900);
  assert.equal(orch.N.retryOverlapS, 1.2);
  assert.equal(orch.N.overlapSavedS, 0.8);
  assert.equal(mono.withFault.totalMs - mono.clean.totalMs, MA.retryMs);
  assert.equal(orch.withFault.orchestratorContext, orch.clean.orchestratorContext);
  assert.equal(mono.withFault.orchestratorContext, mono.clean.orchestratorContext + MA.retryTokens);
  // Pre-fan-in snapshot (workEnd - 150 ms) holds 47.0k raw worker logs while root still holds 3.0k!
  const preFanIn = snapshotAt(orch.clean, orch.clean.workEnd - 150);
  assert.equal(preFanIn.orchTokens, MA.planTokens);
  assert.equal(preFanIn.taskStates.reduce((a, s) => a + s.localTokens, 0), 47.0);
  // Verifier scales cleanly above summaryTotal across all lab module counts (2..6)
  for (const subtasks of [2, 3, 4, 5, 6]) {
    const r = simulate({ mode: "orchestrated", subtasks, maxParallel: 3 });
    assert.ok(r.verifyTokens > r.summaryTotal);
  }
});

test("multi-agent: snapshots are monotonic and reach exact end totals", () => {
  for (const M of Object.values(MODELS)) {
    for (const run of [M.clean, M.withFault]) {
      let prevOrch = -1;
      for (let i = 0; i <= 40; i++) {
        const snap = snapshotAt(run, (run.totalMs * i) / 40);
        assert.ok(snap.orchTokens >= prevOrch - 1e-6);
        prevOrch = snap.orchTokens;
      }
      const end = snapshotAt(run, run.totalMs);
      assert.equal(end.orchTokens, run.orchestratorContext);
      assert.equal(end.toolCallsDone, run.totalToolCalls);
      assert.equal(end.retriesTriggered, run.totalRetries);
      assert.equal(end.vaultCommitted, true);
    }
  }
});

test("multi-agent: lab parameter sweep produces valid schedules across entire slider range", () => {
  for (const mode of ["orchestrated", "monolith"]) {
    for (const subtasks of [2, 3, 4, 5, 6]) {
      for (const maxParallel of [1, 2, 3, 4]) {
        for (const contextCliff of [16, 32, 64]) {
          for (const faults of [0, 1, 2, 3]) {
            const run = simulate({ mode, subtasks, maxParallel, contextCliff, faults });
            assert.ok(run.totalMs > 0);
            assert.equal(run.totalRetries, faults);
            assert.equal(run.tasks.length, subtasks);
            assert.equal(run.peakOverflow, run.peakContext > contextCliff);
          }
        }
      }
    }
  }
});

test("multi-agent: planted fault — removing compression triggers context overflow even with parallel workers", () => {
  const broken = simulate({ mode: "orchestrated", maxParallel: 3, compress: false, subtasks: 3, contextCliff: 32 });
  assert.equal(broken.orchestratorOverflow, true);
  assert.ok(broken.fanInContext === 50.0);
});
