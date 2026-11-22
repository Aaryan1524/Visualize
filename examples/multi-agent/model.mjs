// Multi-agent orchestration model, in milliseconds and thousands of tokens (k).
// Pure and import-free: build.mjs inlines this file into the standalone page, so the page,
// the audit and the unit tests run the exact same scheduler and context-budget equations.
//
// Grounded in:
//  - Anthropic, "Building Effective Agents" (Orchestrator-Workers, Context Isolation &
//    Compression, Evaluator-Optimizer verification loop, aggregate token-cost trade-off)
//  - DAG critical-path scheduling (Amdahl's law: wall time = serial overhead + critical branch)
//  - Effective LLM context-window ceiling ("context rot" past the safe working budget)

export const MA = {
  planMs: 900, // Orchestrator decomposition & dispatch (or single-agent initial planning)
  planTokens: 3.0, // System prompt + goal + plan (k tokens)
  verifyMs: 1000, // Independent Verifier cross-module contract check (orchestrated only)
  verifyRubricTokens: 0.8, // Fixed verifier rubric overhead added on top of merged summaries
  verifyTokens: 6.4, // Default 3-module verifier context: 5.6k merged summaries + 0.8k rubric
  synthMs: 1100, // Final answer synthesis (or single-agent self-check & synthesis)
  synthTokens: 2.4, // Synthesis tokens added to root context (k tokens)
  contextCliff: 32, // Safe effective context budget before attention degrades (k tokens)
  retryMs: 1700, // Bounded tool-timeout backoff + retry (ms)
  retryTokens: 2.0, // Extra error trace tokens kept inside the retrying worker (k tokens)
  waferStep: 4.0, // Each 3D context wafer represents 4k tokens
  // Six genuinely data-independent module audit/patch tasks (first 3 are the default scenario).
  // Each task executes an authentic agent turn: Think -> Tool I/O (+ Retry on fault) -> Distill.
  catalog: [
    { id: "auth", name: "Auth module", tool: "Auth Test API", thinkMs: 800, toolMs: 1400, distillMs: 400, rawTokens: 14.0, summaryTokens: 1.8 },
    { id: "billing", name: "Billing module", tool: "Billing Sandbox", thinkMs: 1100, toolMs: 1800, distillMs: 500, rawTokens: 18.0, summaryTokens: 2.2 },
    { id: "search", name: "Search module", tool: "Search Runner", thinkMs: 700, toolMs: 1500, distillMs: 400, rawTokens: 15.0, summaryTokens: 1.6 },
    { id: "docs", name: "Docs module", tool: "Schema Index", thinkMs: 700, toolMs: 1300, distillMs: 300, rawTokens: 12.0, summaryTokens: 1.5 },
    { id: "policy", name: "Policy module", tool: "Policy Gate", thinkMs: 900, toolMs: 1500, distillMs: 400, rawTokens: 16.0, summaryTokens: 1.9 },
    { id: "metrics", name: "Metrics module", tool: "Bench Suite", thinkMs: 800, toolMs: 1600, distillMs: 400, rawTokens: 15.0, summaryTokens: 1.7 },
  ],
};

export const VARIANTS = {
  orchestrated: {
    key: "orchestrated",
    label: "Parallel orchestrator",
    mode: "orchestrated",
    maxParallel: 3,
    compress: true,
    subtasks: 3,
  },
  monolith: {
    key: "monolith",
    label: "Single monolithic agent",
    mode: "monolith",
    maxParallel: 1,
    compress: false,
    subtasks: 3,
  },
};

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * Deterministic DAG list scheduler + context-window budget model.
 * - Orchestrated mode: Plan -> Parallel Worker Lanes (Think -> Tool -> [Retry] -> Distill) ->
 *   Independent Verifier Gate -> Synthesis.
 * - Single monolithic agent mode: genuinely ONE agent in ONE lane (Plan -> Serial Modules ->
 *   Self-check & Synthesis inside the same window; no separate Verifier agent).
 */
export function simulate(opts = {}) {
  const D = MA;
  const mode = opts.mode ?? "orchestrated";
  const isMono = mode === "monolith";
  const subtasks = Math.max(2, Math.min(D.catalog.length, Math.round(opts.subtasks ?? 3)));
  const maxParallel = isMono ? 1 : Math.max(1, Math.min(4, Math.round(opts.maxParallel ?? 3)));
  const compress = isMono ? false : (opts.compress ?? true);
  const contextCliff = Math.max(16, Math.min(64, Number(opts.contextCliff ?? D.contextCliff)));
  const faults = Math.max(0, Math.min(3, Math.round(opts.faults ?? 0)));

  const tasks = D.catalog.slice(0, subtasks).map((t, i) => ({ ...t, index: i, faults: 0 }));
  // Assign transient tool timeouts deterministically, starting with Search module (index 2) when present.
  const faultOrder = subtasks >= 3 ? [2, 1, 0] : [subtasks - 1, 0];
  for (let f = 0; f < faults; f++) {
    const idx = faultOrder[f % faultOrder.length];
    tasks[idx].faults += 1;
  }

  const planStart = 0;
  const planEnd = D.planMs;
  const laneFree = new Array(maxParallel).fill(planEnd);
  const scheduled = [];
  let sumTaskMs = 0;
  let sumTaskWithRetryMs = 0;
  let sumToolMs = 0;
  let totalToolCalls = 0;
  let totalRetries = 0;
  let rawTotal = 0;
  let summaryTotal = 0;
  let retryTokensTotal = 0;

  for (const t of tasks) {
    let lane = 0;
    for (let l = 1; l < maxParallel; l++) if (laneFree[l] < laneFree[lane]) lane = l;
    const t0 = laneFree[lane];
    const thinkEnd = t0 + t.thinkMs;
    const toolEnd = thinkEnd + t.toolMs;
    const retryExtra = t.faults * D.retryMs;
    const retryEnd = toolEnd + retryExtra;
    const end = retryEnd + t.distillMs;
    laneFree[lane] = end;

    const cleanMs = t.thinkMs + t.toolMs + t.distillMs;
    sumTaskMs += cleanMs;
    sumTaskWithRetryMs += cleanMs + retryExtra;
    sumToolMs += t.toolMs;
    totalToolCalls += 1 + t.faults;
    totalRetries += t.faults;
    rawTotal += t.rawTokens;
    summaryTotal += t.summaryTokens;
    const localRetryTok = t.faults * D.retryTokens;
    retryTokensTotal += localRetryTok;
    const localContext = r1(t.rawTokens + localRetryTok);

    const segments = [
      { t0, t1: thinkEnd, kind: "think" },
      { t0: thinkEnd, t1: toolEnd, kind: "tool" },
    ];
    if (retryExtra > 0) segments.push({ t0: toolEnd, t1: retryEnd, kind: "retry" });
    segments.push({ t0: retryEnd, t1: end, kind: "think" }); // post-tool distillation turn

    scheduled.push({
      ...t,
      lane,
      t0,
      thinkEnd,
      toolEnd,
      retryEnd,
      end,
      durationMs: end - t0,
      cleanMs,
      retryExtra,
      localContext,
      segments,
    });
  }

  const workEnd = Math.max(...scheduled.map((s) => s.end));
  const workSpanMs = workEnd - planEnd;
  // Orchestrated mode pays an explicit independent Verifier gate; single agent has no second verifier agent.
  const verifyMs = isMono ? 0 : D.verifyMs;
  const verifyStart = workEnd;
  const verifyEnd = verifyStart + verifyMs;
  const synthStart = verifyEnd;
  const synthEnd = synthStart + D.synthMs;
  const totalMs = synthEnd;

  // Genuine single-agent serial baseline (Plan + Serial Modules + Self-check/Synth, no separate verifier)
  const serialTotalMs = D.planMs + sumTaskWithRetryMs + D.synthMs;
  const speedup = r2(serialTotalMs / totalMs);
  const workSpeedup = r2(sumTaskWithRetryMs / workSpanMs);
  const criticalTask = scheduled.reduce((a, b) => (b.end > a.end ? b : a), scheduled[0]);

  // Context window accounting: distinguish fan-in occupancy (before synthesis) from end-of-run total
  const returnedTokens = compress ? summaryTotal : rawTotal + retryTokensTotal;
  const fanInContext = r1(D.planTokens + returnedTokens);
  const orchestratorContext = r1(fanInContext + D.synthTokens);
  const maxWorkerContext = isMono
    ? orchestratorContext
    : Math.max(...scheduled.map((s) => s.localContext));
  const peakContext = Math.max(orchestratorContext, maxWorkerContext);
  const orchestratorOverflow = orchestratorContext > contextCliff;
  const peakOverflow = peakContext > contextCliff;
  const compressionRatio = r2(rawTotal / summaryTotal);
  const rawFanInIfUncompressed = r1(D.planTokens + rawTotal + retryTokensTotal);
  const rawPeakIfUncompressed = r1(rawFanInIfUncompressed + D.synthTokens);
  // Aggregate tokens across ALL context windows (verifier scales dynamically with summaryTotal!)
  const verifyTokens = isMono ? 0 : r1(summaryTotal + D.verifyRubricTokens);
  const workerSumTokens = scheduled.reduce((a, s) => a + s.localContext, 0);
  const aggregateTokens = isMono
    ? orchestratorContext
    : r1(orchestratorContext + workerSumTokens + verifyTokens);

  // Build Gantt lanes for View A (single agent truly has 1 lane!)
  const lanes = [];
  lanes.push({
    name: isMono ? "Single agent" : "Orchestrator",
    segments: [
      { t0: planStart, t1: planEnd, kind: "think" },
      ...(isMono ? scheduled.flatMap((s) => s.segments) : []),
      { t0: synthStart, t1: synthEnd, kind: "think" }, // uses documented Think/Plan/Synth cobalt tone
    ],
  });
  if (!isMono) {
    for (let l = 0; l < Math.min(3, maxParallel); l++) {
      const myTasks = scheduled.filter((s) => s.lane === l);
      const label = myTasks.length === 1 ? myTasks[0].name.replace(" module", "") : `Worker ${l + 1}`;
      lanes.push({ name: label, segments: myTasks.flatMap((s) => s.segments) });
    }
    if (maxParallel === 4) {
      const l3 = scheduled.filter((s) => s.lane === 3);
      lanes.push({ name: l3.length === 1 ? l3[0].name.replace(" module", "") : "Worker 4", segments: l3.flatMap((s) => s.segments) });
    }
    lanes.push({
      name: "Verifier",
      segments: [{ t0: verifyStart, t1: verifyEnd, kind: "verify" }],
    });
  }

  return {
    mode,
    subtasks,
    maxParallel,
    compress,
    contextCliff,
    faults,
    tasks: scheduled,
    planStart,
    planEnd,
    workEnd,
    workSpanMs,
    verifyStart,
    verifyEnd,
    verifyMs,
    synthStart,
    synthEnd,
    totalMs,
    serialTotalMs,
    speedup,
    workSpeedup,
    criticalTaskId: criticalTask.id,
    criticalTaskName: criticalTask.name,
    sumTaskMs,
    sumTaskWithRetryMs,
    sumToolMs,
    totalToolCalls,
    totalRetries,
    rawTotal: r1(rawTotal),
    summaryTotal: r1(summaryTotal),
    returnedTokens: r1(returnedTokens),
    fanInContext,
    orchestratorContext,
    maxWorkerContext,
    peakContext,
    orchestratorOverflow,
    peakOverflow,
    compressionRatio,
    rawFanInIfUncompressed,
    rawPeakIfUncompressed,
    verifyTokens,
    aggregateTokens,
    lanes,
    wafersFor: (tok) => Math.max(0, Math.ceil(tok / D.waferStep)),
    capWafers: Math.round(contextCliff / D.waferStep),
  };
}

/**
 * Snapshot of the live system at wall-clock time `tMs` inside a simulated run.
 * Drives both the 3D rig (worker beacons, context wafers, flying shuttles) and View A.
 */
export function snapshotAt(run, tMs) {
  const t = Math.max(0, Math.min(run.totalMs, tMs));
  const isMono = run.mode === "monolith";
  const phase = t < run.planEnd
    ? "plan"
    : t < run.workEnd
      ? "work"
      : !isMono && t < run.verifyEnd
        ? "verify"
        : t < run.synthEnd
          ? "synth"
          : "done";

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  let orchTokens = MA.planTokens * clamp01(t / Math.max(1, run.planEnd));
  let activeWorkers = 0;
  let toolCallsDone = 0;
  let retriesTriggered = 0;
  let completedTasks = 0;

  const taskStates = run.tasks.map((task) => {
    let status = "idle";
    let localTokens = 0;
    let shuttle = null;

    if (t >= task.t0) {
      if (t < task.thinkEnd) {
        status = "think";
        const u = clamp01((t - task.t0) / Math.max(1, task.thinkMs));
        localTokens = task.rawTokens * 0.25 * u;
        if (!isMono && u < 0.4) shuttle = { kind: "dispatch", u: u / 0.4 };
      } else if (t < task.toolEnd) {
        status = "tool";
        const u = clamp01((t - task.thinkEnd) / Math.max(1, task.toolMs));
        localTokens = task.rawTokens * (0.25 + 0.75 * u);
        toolCallsDone += 1;
        shuttle = u < 0.5 ? { kind: "toolOut", u: u * 2 } : { kind: "toolBack", u: (u - 0.5) * 2 };
      } else if (t < task.retryEnd) {
        status = "retry";
        const u = clamp01((t - task.toolEnd) / Math.max(1, task.retryExtra));
        localTokens = task.rawTokens + task.faults * MA.retryTokens * u;
        toolCallsDone += 1 + Math.ceil(u * task.faults);
        retriesTriggered += Math.ceil(u * task.faults);
        shuttle = { kind: "retry", u };
      } else if (t < task.end) {
        status = "think"; // post-tool distillation turn
        localTokens = task.localContext;
        toolCallsDone += 1 + task.faults;
        retriesTriggered += task.faults;
      } else {
        status = "done";
        localTokens = task.localContext;
        toolCallsDone += 1 + task.faults;
        retriesTriggered += task.faults;
        completedTasks += 1;
        const retSpan = 420;
        if (!isMono && t < task.end + retSpan) shuttle = { kind: "return", u: clamp01((t - task.end) / retSpan) };
      }
      if (status !== "done") activeWorkers += 1;
    }

    if (isMono) {
      orchTokens += localTokens;
    }

    return { id: task.id, name: task.name, lane: task.lane, status, localTokens: r1(localTokens), shuttle };
  });

  // Barrier fan-in in orchestrated mode: worker summaries merge into Orchestrator once workEnd is reached
  if (!isMono && t >= run.workEnd) {
    orchTokens += run.returnedTokens;
  }

  if (t >= run.synthStart) {
    orchTokens += MA.synthTokens * clamp01((t - run.synthStart) / Math.max(1, MA.synthMs));
  }
  orchTokens = r1(orchTokens);

  const verifierStatus = isMono ? "disabled" : t < run.verifyStart ? "idle" : t < run.verifyEnd ? "active" : "done";
  const vaultCommitted = isMono ? t >= run.synthEnd : t >= run.verifyEnd;
  const peakNow = Math.max(orchTokens, ...taskStates.map((s) => (isMono ? 0 : s.localTokens)));

  return {
    tMs: t,
    phase,
    orchTokens,
    peakNow: r1(peakNow),
    activeWorkers: isMono ? (phase === "work" ? 1 : 0) : activeWorkers,
    toolCallsDone,
    retriesTriggered,
    completedTasks,
    verifierStatus,
    vaultCommitted,
    taskStates,
  };
}

export function makeModel(over = {}) {
  const v = over.variant || VARIANTS.orchestrated;
  const clean = simulate({ mode: v.mode, maxParallel: v.maxParallel, compress: v.compress, subtasks: v.subtasks, faults: 0 });
  const withFault = simulate({ mode: v.mode, maxParallel: v.maxParallel, compress: v.compress, subtasks: v.subtasks, faults: 1 });
  const uncompressed = simulate({ mode: v.mode, maxParallel: v.maxParallel, compress: false, subtasks: v.subtasks, faults: 0 });
  const faultWallDeltaMs = withFault.totalMs - clean.totalMs;
  const overlapSavedMs = MA.retryMs - faultWallDeltaMs;
  // Direct retry overlap with concurrent clean critical branch (Search retry 3.1-4.8 s vs Billing end 4.3 s = 1.2 s)
  const ft = withFault.tasks.find((x) => x.faults > 0);
  const retryOverlapMs = v.mode === "monolith" || !ft ? 0 : Math.max(0, Math.min(ft.retryEnd, clean.workEnd) - ft.toolEnd);

  return {
    D: MA,
    v,
    clean,
    withFault,
    uncompressed,
    N: {
      subtasks: v.subtasks,
      workers: v.maxParallel,
      planS: r1(MA.planMs / 1000),
      verifyS: r1(MA.verifyMs / 1000),
      synthS: r1(MA.synthMs / 1000),
      retryS: r1(MA.retryMs / 1000),
      workCleanS: r1(clean.workSpanMs / 1000),
      sumWorkS: r1(clean.sumTaskMs / 1000),
      cleanTotalS: r1(clean.totalMs / 1000),
      faultTotalS: r1(withFault.totalMs / 1000),
      faultDeltaS: r1(faultWallDeltaMs / 1000),
      overlapSavedS: r1(overlapSavedMs / 1000),
      retryOverlapS: r1(retryOverlapMs / 1000),
      serialTotalS: r1(clean.serialTotalMs / 1000),
      speedup: clean.speedup,
      workSpeedup: clean.workSpeedup,
      rawTotal: clean.rawTotal,
      summaryTotal: clean.summaryTotal,
      fanInContext: clean.fanInContext,
      orchContext: clean.orchestratorContext,
      peakWorker: clean.maxWorkerContext,
      peakContext: clean.peakContext,
      uncompressedFanIn: uncompressed.fanInContext,
      uncompressedOrch: uncompressed.orchestratorContext,
      aggregateTokens: clean.aggregateTokens,
      contextCliff: MA.contextCliff,
      compressionRatio: clean.compressionRatio,
      fanInPct: Math.round((clean.fanInContext / MA.contextCliff) * 100),
      orchPct: Math.round((clean.orchestratorContext / MA.contextCliff) * 100),
      uncompressedFanInPct: Math.round((uncompressed.fanInContext / MA.contextCliff) * 100),
      uncompressedPct: Math.round((uncompressed.orchestratorContext / MA.contextCliff) * 100),
      peakPct: Math.round((clean.peakContext / MA.contextCliff) * 100),
      faultOrchContext: withFault.orchestratorContext,
      faultFanInContext: withFault.fanInContext,
      faultPeakWorker: withFault.maxWorkerContext,
    },
  };
}

export const MODELS = Object.fromEntries(Object.entries(VARIANTS).map(([k, variant]) => [k, makeModel({ variant })]));
