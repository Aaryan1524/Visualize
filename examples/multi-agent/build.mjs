// node examples/multi-agent/build.mjs  ->  dist/multi-agent.html (or --out <file>).
// Multi-agent orchestration as an elevated Concept Plate on Visualize's upgraded rig
// (src/rig + src/rig/concept.ts) inside the shared Drawing page and player (src/drawing/).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { MA, MODELS, VARIANTS, makeModel, simulate, snapshotAt } from "./model.mjs";
import { drawingPage, esc } from "../../src/drawing/page.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");

const VBW = 14200, VBH = 6550, FS = 148;
const BOX = { x: 2250, y: 580, w: 5850, h: 5400 };
const LENS = { x: 9040, y: 200, w: 5060, h: 4060 };

const PRED_STEP = 3;
const STEPS = [
  { tab: null, heading: "How do multiple agents beat one big prompt?", focus: null },
  { tab: "Three planes", heading: "Control, execution and tool planes isolate work and state.", focus: null },
  { tab: "Fan out", heading: null, focus: ["orchestrator", "dispatch", "workers"] },
  { tab: "Parallel work", heading: null, focus: ["workers", "tools", "dispatch"] },
  { tab: "Context cliff", heading: null, focus: ["context", "orchestrator", "workers"] },
  { tab: "Localized retry", heading: null, focus: ["retry", "tools", "workers", "context"] },
  { tab: "Verifier gate", heading: null, focus: ["verifier", "vault", "orchestrator"] },
];

const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);

function headings(M) {
  const N = M.N, mono = MODELS.monolith.N, orch = MODELS.orchestrated.N;
  if (M.v.mode === "monolith") {
    return {
      1: "One serial lane and one shared window carry every module.",
      2: `Plan in ${f1(N.planS)} s, then queue all ${N.subtasks} module audits in one lane.`,
      3: `Serial work branches take ${f1(N.sumWorkS)} s, stretching the run to ${f1(N.cleanTotalS)} s.`,
      4: `One shared window hits ${f1(N.fanInContext)}k after work (${f1(N.orchContext)}k total) — past ${N.contextCliff}k.`,
      5: `A ${f1(N.retryS)} s tool retry adds the full ${f1(N.retryS)} s delay (${f1(N.faultTotalS)} s total).`,
      6: `No separate verifier: the agent self-checks inside its ${f1(N.orchContext)}k window.`,
    };
  }
  return {
    2: `Plan in ${f1(N.planS)} s and dispatch ${N.subtasks} independent module specs at once.`,
    3: `Parallel worker branches finish in ${f1(orch.workCleanS)} s instead of ${f1(mono.sumWorkS)} s.`,
    4: `Summaries keep root context at ${f1(orch.fanInContext)}k at fan-in (${f1(orch.orchContext)}k total) vs ${f1(orch.uncompressedFanIn)}k raw.`,
    5: `A ${f1(N.retryS)} s timeout on Search adds only ${f1(orch.faultDeltaS)} s to wall time.`,
    6: `An independent verifier checks the merged contracts (${f1(N.verifyS)} s) before commit.`,
  };
}

function captions(M) {
  const N = M.N, D = M.D, orch = MODELS.orchestrated.N, mono = MODELS.monolith.N;
  const c0 = D.catalog[0], c1 = D.catalog[1], c2 = D.catalog[2];
  const d0 = (c0.thinkMs + c0.toolMs + c0.distillMs) / 1000;
  const d1 = (c1.thinkMs + c1.toolMs + c1.distillMs) / 1000;
  const d2 = (c2.thinkMs + c2.toolMs + c2.distillMs) / 1000;

  if (M.v.mode === "monolith") {
    return [
      `Auditing three independent code modules — Auth (${f1(d0)} s, ${f1(c0.rawTokens)}k tokens), Billing (${f1(d1)} s, ${f1(c1.rawTokens)}k tokens) and Search (${f1(d2)} s, ${f1(c2.rawTokens)}k tokens) — in one monolithic agent runs them serially in ${f1(mono.cleanTotalS)} s (including ${f1(N.planS)} s planning and ${f1(N.synthS)} s self-check and synthesis, with no separate verifier). Every raw tool output stays in one shared window, reaching ${f1(mono.fanInContext)}k tokens after work and ${f1(mono.orchContext)}k tokens at completion (${mono.orchPct}% of the ${N.contextCliff}k cliff).`,
      `In the single monolithic agent layout, one active core on top shares a single growing context stack. Only the center compute lane runs, routing sequentially to all three external tool valves (Auth Test API, Billing Sandbox and Search Runner) before committing to the Artifact Vault. There are no isolated worker context trays and no independent verifier gate.`,
      `The single agent spends ${f1(N.planS)} s and ${f1(D.planTokens)}k tokens outlining the three-module audit, then enters the Auth module alone while Billing and Search wait in the serial queue.`,
      `Each module executes its full Think, Tool I/O and post-tool Distill turn one after another in a single lane (${f1(d0)} s + ${f1(d1)} s + ${f1(d2)} s = ${f1(mono.sumWorkS)} s of work). Combined with ${f1(N.planS)} s planning and ${f1(N.synthS)} s synthesis, total wall time stretches to ${f1(mono.cleanTotalS)} s.`,
      `Because every tool log appends straight into one shared context window, occupancy hits ${f1(D.planTokens)}k + ${f1(mono.rawTotal)}k = ${f1(mono.fanInContext)}k tokens at the end of the work phase (${mono.uncompressedFanInPct}% of the ${N.contextCliff}k cliff) and ${f1(mono.orchContext)}k tokens after synthesis (${mono.orchPct}%), bursting past the red ${N.contextCliff}k collar into context rot. Note the upside: aggregate billed tokens are ${f1(mono.aggregateTokens)}k versus ${f1(orch.aggregateTokens)}k across five windows in the orchestrated architecture.`,
      `When Search Runner times out on the third module, the ${f1(N.retryS)} s bounded retry cannot overlap any other work: it adds the full ${f1(N.retryS)} s onto the serial trace (${f1(mono.faultTotalS)} s total) and appends ${f1(D.retryTokens)}k error-trace tokens straight into the shared window (${f1(mono.faultFanInContext)}k after work, ${f1(mono.faultOrchContext)}k at completion).`,
      `With no second verifier agent, the single monolithic agent self-checks and synthesizes its final answer in ${f1(N.synthS)} s (${f1(D.synthTokens)}k tokens) inside its already overflowing ${f1(mono.orchContext)}k window before writing to the Artifact Vault. For tightly coupled sequential edits, a single agent avoids cross-agent handoff overhead; for independent multi-module work, parallel orchestration wins.`,
    ];
  }

  return [
    `Auditing and patching three independent code modules — Auth (${f1(d0)} s, ${f1(c0.rawTokens)}k tokens), Billing (${f1(d1)} s, ${f1(c1.rawTokens)}k tokens) and Search (${f1(d2)} s, ${f1(c2.rawTokens)}k tokens) — in one monolithic agent runs them serially in ${f1(mono.cleanTotalS)} s and piles ${f1(mono.orchContext)}k tokens into one window, breaking past the ${N.contextCliff}k context-rot cliff (${mono.orchPct}% of safe budget). Multi-agent orchestration cuts wall time to ${f1(orch.cleanTotalS)} s (${f2(orch.speedup)}x speedup, even while paying ${f1(N.verifyS)} s for an independent verifier) and keeps coordinator context at ${f1(orch.orchContext)}k tokens.`,
    `The system separates three architectural planes. The Control Plane holds the Orchestrator hub and its root context wafer stack. The Execution Plane holds three specialist module blades (Auth, Billing and Search), each with its own calibrated context stack. The Tools & Memory Plane holds three external tool valves (Auth Test API, Billing Sandbox, Search Runner), an independent Verifier gate and the Shared Artifact Vault.`,
    `The Orchestrator spends ${f1(N.planS)} s and ${f1(D.planTokens)}k tokens decomposing the goal into ${N.subtasks} data-independent module tasks with explicit tool scopes and output contracts, then launches compact task envelopes down all three conduits at once. Sequentially dependent stages (such as editing a file and then testing that exact diff) stay inside one worker's turn rather than fanning out.`,
    `Each worker executes a complete agent turn: pre-tool reasoning, an external tool call (Auth ${f1(c0.toolMs / 1000)} s, Billing ${f1(c1.toolMs / 1000)} s, Search ${f1(c2.toolMs / 1000)} s), and a post-tool distillation turn (${f1(c0.distillMs / 1000)}–${f1(c1.distillMs / 1000)} s) that compresses raw tool output. Because the three independent module branches run concurrently, the work phase finishes in ${f1(orch.workCleanS)} s (bounded by Billing's branch) rather than the serial sum ${f1(orch.sumWorkS)} s — a ${f2(orch.workSpeedup)}x work-phase speedup, and ${f2(orch.speedup)}x end to end (${f1(orch.cleanTotalS)} s vs ${f1(mono.cleanTotalS)} s).`,
    `At fan-in, the three workers hold ${f1(orch.rawTotal)}k tokens of raw tool logs (${f1(c0.rawTokens)}k + ${f1(c1.rawTokens)}k + ${f1(c2.rawTokens)}k), yet no individual worker exceeds ${f1(orch.peakWorker)}k tokens (${orch.peakPct}% of the ${N.contextCliff}k cliff). Each returns only a distilled summary (${f1(c0.summaryTokens)}k + ${f1(c1.summaryTokens)}k + ${f1(c2.summaryTokens)}k = ${f1(orch.summaryTotal)}k tokens — an ${f2(orch.compressionRatio)}x reduction), holding Orchestrator context at ${f1(orch.fanInContext)}k at fan-in (${orch.fanInPct}% of budget, ${f1(orch.orchContext)}k after ${f1(D.synthTokens)}k synthesis) versus ${f1(orch.uncompressedFanIn)}k raw (${orch.uncompressedFanInPct}%, ${f1(orch.uncompressedOrch)}k after synthesis). The trade-off: aggregate billed tokens across all five windows rise to ${f1(orch.aggregateTokens)}k vs ${f1(mono.aggregateTokens)}k in a single agent, and lossy compression can drop subtle details if summary contracts are underspecified.`,
    `External tools fail. When Search Runner times out on the third worker, a bounded retry takes ${f1(N.retryS)} s and adds ${f1(D.retryTokens)}k error-trace tokens inside Search's isolated tray only (${f1(c2.rawTokens + D.retryTokens)}k total, still well below ${N.contextCliff}k). Because ${f1(orch.retryOverlapS)} s of Search's retry overlaps Billing's remaining work (hiding ${f1(orch.overlapSavedS)} s of net delay after Search's ${f1(c2.distillMs / 1000)} s distill turn), total wall time rises by only ${f1(orch.faultDeltaS)} s (from ${f1(orch.cleanTotalS)} s to ${f1(orch.faultTotalS)} s), and Orchestrator context remains untouched at ${f1(orch.faultOrchContext)}k tokens. In the single agent, the same retry adds the full ${f1(N.retryS)} s (${f1(mono.faultTotalS)} s total) and appends error noise to ${f1(mono.faultOrchContext)}k tokens.`,
    `Isolated module workers cannot see cross-module contract conflicts on their own. Before synthesis, an independent Verifier gate inspects the ${f1(orch.summaryTotal)}k of merged module summaries and contract diffs for ${f1(N.verifyS)} s inside a clean ${f1(D.verifyTokens)}k context window. In an evaluator-optimizer loop, a failed check routes a targeted critique back to the affected worker for a revision pass; once clean, the Verifier commits the verified bundle to the Shared Artifact Vault and hands control to the Orchestrator for ${f1(N.synthS)} s synthesis (${f1(D.synthTokens)}k tokens, finishing at ${f1(orch.orchContext)}k).`,
  ];
}

const VOICE = existsSync(join(HERE, "voice.json")) ? JSON.parse(readFileSync(join(HERE, "voice.json"), "utf8")) : null;

const label = (id, text, x, y, to, beats, anchor = "end") => ({ id, text, at: [x, y], to, beats, anchor });
const LX = 2160;
function labelsFor(mode) {
  if (mode === "monolith") {
    return [
      label("orch", "Single agent core", LX, 2240, "orchestrator", [1, 2, 6], "end"),
      label("root", "Shared window (32k cliff)", 6200, 420, "rootStack", [1, 4, 5], "start"),
      label("w0", "Active serial lane", LX, 3140, "worker1", [1, 2, 3, 4], "end"),
      label("tools", "Tool valves", LX, 4880, "tools", [1, 3], "end"),
      label("retry", "Serial retry (+1.7 s)", 8780, 6160, "retryValve", [5], "end"),
      label("vault", "Artifact vault", 8760, 6240, "vault", [1, 6], "end"),
    ];
  }
  return [
    label("orch", "Orchestrator hub", LX, 2240, "orchestrator", [1, 2, 6], "end"),
    label("root", "Root context (32k cliff)", 6200, 420, "rootStack", [1, 4, 5], "start"),
    label("w0", "Auth module blade", LX, 3140, "worker0", [1, 2, 3], "end"),
    label("wstk", "Isolated context", LX, 3860, "workerStack", [1, 4], "end"),
    label("tools", "Tool valves", LX, 4880, "tools", [1, 3], "end"),
    label("retry", "Bounded retry (+1.7 s)", 8780, 6160, "retryValve", [5], "end"),
    label("verifier", "Verifier gate", 8840, 3960, "verifier", [1, 6], "end"),
    label("vault", "Artifact vault", 8760, 6240, "vault", [1, 6], "end"),
  ];
}
const labelSvg = (l) => `<g class="label" data-label="${l.id}" data-beats="${l.beats.join(" ")}" data-at="${l.to}" data-to="${l.at[0]},${l.at[1]}"><path class="leader"/><circle class="ldot" r="26"/><text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}">${esc(l.text)}</text></g>`;

function skeleton(M) {
  const N = M.N;
  const x0 = 9040, x1 = VBW - 100, y0 = 4900, y1 = VBH - 80;
  let tb = `<g class="tblock"><path class="tb-frame" d="M${x0},${y0}H${x1}V${y1}H${x0}Z"/><path class="tb-rule" d="M${x0},${y0 + 340}H${x1}M${x0},${y1 - 300}H${x1}"/>`;
  tb += `<text class="tb-title" x="${x0 + 110}" y="${y0 + 225}">MULTI-AGENT ORCHESTRATION · ${esc(M.v.label.toUpperCase())}</text><text class="tb-small" x="${x1 - 110}" y="${y0 + 225}" text-anchor="end">s · k tok</text>`;
  const facts = [
    `${N.subtasks} modules · ${N.workers} ${N.workers === 1 ? "serial lane" : "parallel lanes"} · context cliff ${N.contextCliff}k tokens`,
    `Clean run ${f1(N.cleanTotalS)} s (${f2(N.speedup)}x vs serial) · root ${f1(N.orchContext)}k (${N.orchPct}%) · agg ${f1(N.aggregateTokens)}k`,
    `Wafer stack: ${MA.waferStep}k tokens per wafer; red collar marks ${N.contextCliff}k cliff.`,
  ];
  facts.forEach((t, i) => (tb += `<text class="tb-text" x="${x0 + 110}" y="${y0 + 570 + i * 200}">${esc(t)}</text>`));
  tb += `<g id="tbkey" data-x0="${x0 + 110}">`;
  for (const [cls, t] of [["k-blue", "Plan / Think / Synth"], ["k-amber", "Tool I/O"], ["k-teal", "Verify / Summary"], ["k-red", "Retry / Overflow"]]) {
    tb += `<g class="tbk"><path class="${cls}" d="M0,${y1 - 140}h200"/><text class="tb-text tb-key" x="0" y="${y1 - 100}">${t}</text></g>`;
  }
  tb += "</g></g>";
  return `<defs id="rigDefs"></defs><g id="scene"></g><g id="lensHost" class="inset"></g><g id="labels">${labelsFor(M.v.mode).map(labelSvg).join("")}</g>${tb}`;
}

function variantData(name) {
  const v = VARIANTS[name], M = MODELS[name], N = M.N;
  const tracks = VOICE?.variants?.[name] ?? null;
  const orch = MODELS.orchestrated.N;
  const meet = (tracks || []).map((tr) => 0.8 * tr.duration);
  return {
    name,
    label: v.label,
    svg: skeleton(M),
    heads: headings(M),
    captions: captions(M),
    voice: tracks,
    meet,
    explanation: `Raw logs total ${f1(orch.rawTotal)}k tokens. Added to the ${f1(MA.planTokens)}k plan, full transcripts hit ${f1(orch.uncompressedFanIn)}k tokens at fan-in (${orch.uncompressedFanInPct}% of the ${N.contextCliff}k cliff, rising to ${f1(orch.uncompressedOrch)}k after ${f1(MA.synthTokens)}k synthesis). Returning distilled summaries (${f1(orch.summaryTotal)}k) holds the Orchestrator at ${f1(orch.fanInContext)}k at fan-in (${f1(orch.orchContext)}k at completion).`,
  };
}
const VARIANT_DATA = Object.fromEntries(Object.keys(VARIANTS).map((n) => [n, variantData(n)]));

// ---------------------------------------------------------------- in-page controller
function machine(DATA) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz");
  const clamp = (u) => Math.max(0, Math.min(1, u));
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  let V = null, model = null, cur = null;
  let figM = null, stageM = null, defsM = null, lensEl = null;
  let lastAt = null, lastFocus = { focus: null, lit: [] }, lastLensKey = "";

  const anim = (k) => (V?.voice?.[k] ? Math.max(2.5, V.meet[k]) : 0.78 * DATA.plain);
  // Step 3 poses right before barrier fan-in (workEnd - 150 ms in orchestrated, where all 3 tool calls have
  // finished and workers hold 47.0k raw logs while root still holds 3.0k; mid-work in monolith so Predict isn't spoiled!)
  const POSE = [0.62, 0.45, 0.92, 1.0, 0.96, 0.56, 1.0];

  function stateAt(k, u) {
    const m = model;
    const isFaultStep = k === 5;
    const run = isFaultStep ? m.withFault : m.clean;
    const lerp = (a, b, f) => a + (b - a) * f;
    let tMs = run.totalMs;
    if (k === 0) tMs = lerp(0, run.totalMs, ease(u));
    else if (k === 1) tMs = lerp(run.planEnd * 0.6, run.planEnd + 1600, ease(u));
    else if (k === 2) tMs = lerp(0, run.planEnd + 700, ease(u));
    else if (k === 3) {
      const endT = run.mode === "monolith" ? run.planEnd + 3200 : run.workEnd - 150;
      tMs = lerp(run.planEnd, endT, ease(u));
    }
    else if (k === 4) tMs = lerp(run.workEnd - 300, run.workEnd + (run.mode === "monolith" ? 0 : 420), ease(u));
    else if (k === 5) {
      const ft = run.tasks.find((x) => x.faults > 0) || run.tasks[run.tasks.length - 1];
      tMs = lerp(ft.toolEnd - 650, ft.retryEnd + 250, ease(u));
    } else if (k === 6) {
      tMs = lerp(run.mode === "monolith" ? run.synthStart : run.verifyStart, run.totalMs, ease(u));
    }
    return { run, tMs, k, u, hideRaw: k === DATA.predict.step };
  }

  const at = (k, t, still, SEG) => {
    const tt = still ? POSE[k] * anim(k) : Math.max(0, t - SEG.lead);
    return stateAt(k, clamp(tt / anim(k)));
  };
  const stillAt = (k, SEG) => SEG.lead + POSE[k] * anim(k);

  function mount(v, m) {
    V = v;
    model = m;
    lastLensKey = "";
    const cam = FIG.cameraFor(DATA.box);
    figM = FIG.figure(cam, { prefix: "ma" });
    defsM = $("rigDefs");
    lensEl = $("lensHost");
    defsM.replaceChildren();
    $("scene").replaceChildren();
    stageM = new FIG.RigStage($("scene"));
    for (const pt of figM.parts) stageM.add(pt.id, pt.part, pt.svg);
  }

  const R = {};
  const setText = (id, v) => {
    if (R[id] !== v) ((R[id] = v), ($(id).textContent = v));
  };

  function readouts(st, snap) {
    const run = st.run;
    setText("r-time", (snap.tMs / 1000).toFixed(1));
    setText("r-total", `/ ${(run.totalMs / 1000).toFixed(1)} s`);
    setText("r-speedup", `${run.speedup.toFixed(2)}×`);
    setText("r-orch", `${snap.orchTokens.toFixed(1)}k`);
    setText("r-peak", `${snap.peakNow.toFixed(1)}k`);
    setText("r-workers", `${snap.activeWorkers} / ${run.maxParallel}`);
    setText("r-retries", `${snap.retriesTriggered}`);
  }

  function focusParts() {
    const { focus, lit } = lastFocus;
    const lab = root.hasAttribute("data-lab");
    const test = (part) => ({
      recede: lit.length ? !lit.includes(part) : !lab && focus ? !focus.includes(part) : false,
      named: lit.includes(part),
    });
    stageM?.focus(test);
  }
  const focus = (f) => {
    lastFocus = f;
    focusParts();
  };

  function render(st) {
    cur = st;
    const out = figM.pose(st);
    if (out.defs.length) defsM.insertAdjacentHTML("beforeend", out.defs.join(""));
    stageM.apply(out.items);
    lastAt = out.at;
    const qT = Math.round(st.tMs / 25) * 25;
    const lensKey = `${st.run.mode}|${st.run.subtasks}|${st.run.maxParallel}|${st.run.contextCliff}|${st.run.faults}|${qT}|${st.hideRaw ? 1 : 0}`;
    if (lensKey !== lastLensKey) {
      lastLensKey = lensKey;
      lensEl.innerHTML = FIG.renderViewA(DATA.lens, st.run, out.snap, !!st.hideRaw);
    }
    focusParts();
    readouts(st, out.snap);
  }

  function lab(values) {
    const subtasks = Number(values.subtasks);
    const maxParallel = Number(values.parallel);
    const contextCliff = Number(values.cliff);
    const faults = Number(values.faults);
    const mode = model.v.mode;
    const isMono = mode === "monolith";
    const run = simulate({ mode, subtasks, maxParallel, contextCliff, faults, compress: !isMono });
    const rows = [
      `Schedule: ${(run.totalMs / 1000).toFixed(1)} s wall time vs ${(run.serialTotalMs / 1000).toFixed(1)} s serial (${run.speedup.toFixed(2)}× speedup); critical path on ${run.criticalTaskName}.`,
      isMono
        ? `Single-agent baseline: 1 serial lane (Workers slider applies in Parallel orchestrator); compression off — shared window hits ${run.orchestratorContext.toFixed(1)}k vs ${contextCliff}k cliff.`
        : `Context: root holds ${run.orchestratorContext.toFixed(1)}k, peak worker ${run.maxWorkerContext.toFixed(1)}k vs ${contextCliff}k cliff; aggregate across all windows ${run.aggregateTokens.toFixed(1)}k.`,
      isMono
        ? `Tools: ${run.totalToolCalls} calls (${run.totalRetries} serial ${run.totalRetries === 1 ? "retry" : "retries"}); all ${run.rawTotal.toFixed(1)}k raw logs stay uncompressed in one window.`
        : `Tools: ${run.totalToolCalls} calls (${run.totalRetries} localized ${run.totalRetries === 1 ? "retry" : "retries"}); ${run.rawTotal.toFixed(1)}k raw logs distilled to ${run.summaryTotal.toFixed(1)}k summaries.`,
    ];
    let ok = true, verdict = "";
    if (run.peakOverflow) {
      ok = false;
      verdict = run.orchestratorOverflow
        ? `Context overflow: root reaches ${run.orchestratorContext.toFixed(1)}k tokens, past the ${contextCliff}k cliff.`
        : `Worker context overflow: peak worker hits ${run.maxWorkerContext.toFixed(1)}k past ${contextCliff}k — split tasks finer.`;
    } else if (run.speedup < 1.0) {
      ok = false;
      verdict = `Slower than single agent (${run.speedup.toFixed(2)}×): verifier overhead outweighs ${run.maxParallel} ${run.maxParallel === 1 ? "lane" : "lanes"} — add parallel workers.`;
    } else if (isMono) {
      ok = faults === 0 && subtasks <= 2;
      verdict = faults > 0
        ? `Serial retries under ${faults} ${faults === 1 ? "fault" : "faults"}: adds full ${(faults * MA.retryMs / 1000).toFixed(1)} s onto wall time (${(run.totalMs / 1000).toFixed(1)} s).`
        : `Single serial lane (${run.speedup.toFixed(2)}×): switch What if to Parallel orchestrator to fan out.`;
    } else if (run.speedup < 1.3 && subtasks >= 3) {
      ok = false;
      verdict = `Serial bottleneck: ${run.speedup.toFixed(2)}× speedup — increase Workers beyond ${run.maxParallel} ${run.maxParallel === 1 ? "lane" : "lanes"}.`;
    } else if (faults >= 2) {
      ok = true;
      verdict = `Resilient under ${faults} faults: localized retries finish in ${(run.totalMs / 1000).toFixed(1)} s with zero context overflow.`;
    } else {
      ok = true;
      verdict = `Healthy orchestration: ${run.speedup.toFixed(2)}× faster than serial, peaking at ${run.peakContext.toFixed(1)}k of ${contextCliff}k tokens.`;
    }
    return {
      ok, verdict, rows,
      state: { run, tMs: run.totalMs, k: 6, u: 1, lab: true, hideRaw: false },
    };
  }

  const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
  function question(n, r) {
    const kind = n % 5;
    const orch = MODELS_IN_PAGE.orchestrated;
    if (kind === 0) {
      const sub = pick(r, [3, 4, 5]);
      const par = simulate({ mode: "orchestrated", subtasks: sub, maxParallel: 3, compress: true });
      const ser = simulate({ mode: "monolith", subtasks: sub, maxParallel: 1, compress: false });
      return {
        q: `Auditing ${sub} independent modules with 3 parallel workers finishes in ${(par.totalMs / 1000).toFixed(1)} s vs ${(ser.totalMs / 1000).toFixed(1)} s serially. What sets the work-phase duration across concurrent lanes?`,
        choices: [
          `The slowest concurrent branch (${(par.workSpanMs / 1000).toFixed(1)} s)`,
          `The sum of all branches (${(par.sumTaskMs / 1000).toFixed(1)} s)`,
          `The fastest branch alone`,
        ],
        explain: `Parallel fan-out cannot proceed to verification until the longest branch finishes: ${(par.workSpanMs / 1000).toFixed(1)} s instead of the serial sum ${(par.sumTaskMs / 1000).toFixed(1)} s.`,
      };
    }
    if (kind === 1) {
      return {
        q: `The 3 module workers hold ${orch.N.rawTotal.toFixed(1)}k tokens of raw logs, but distill ${orch.N.summaryTotal.toFixed(1)}k tokens of summaries. With ${MA.planTokens.toFixed(1)}k plan tokens, what is the Orchestrator's context at fan-in (before synthesis)?`,
        choices: [
          `${orch.N.fanInContext.toFixed(1)}k tokens`,
          `${orch.N.uncompressedFanIn.toFixed(1)}k tokens`,
          `${orch.N.rawTotal.toFixed(1)}k tokens`,
        ],
        explain: `${MA.planTokens.toFixed(1)}k + ${orch.N.summaryTotal.toFixed(1)}k = ${orch.N.fanInContext.toFixed(1)}k tokens at fan-in (${orch.N.orchContext.toFixed(1)}k after ${MA.synthTokens.toFixed(1)}k synthesis), safely under the ${MA.contextCliff}k cliff instead of ${orch.N.uncompressedFanIn.toFixed(1)}k.`,
      };
    }
    if (kind === 2) {
      return {
        q: `Search module takes 2.6 s and Billing takes 3.4 s concurrently. If Search hits a ${orch.N.retryS.toFixed(1)} s tool retry, how much wall-clock time is added to the run?`,
        choices: [
          `${orch.N.faultDeltaS.toFixed(1)} s (partially hidden behind Billing)`,
          `The full ${orch.N.retryS.toFixed(1)} s`,
          `Zero seconds`,
        ],
        explain: `Search's branch extends from 2.6 s to 4.3 s while Billing already takes 3.4 s, absorbing ${orch.N.overlapSavedS.toFixed(1)} s of schedule slack so total wall time rises by only ${orch.N.faultDeltaS.toFixed(1)} s.`,
      };
    }
    if (kind === 3) {
      return {
        q: `Multi-agent orchestration keeps every window under ${orch.N.peakWorker.toFixed(1)}k tokens (vs ${MODELS_IN_PAGE.monolith.N.orchContext.toFixed(1)}k in a single agent). What happens to total aggregate tokens processed across all windows?`,
        choices: [
          `They increase to ${orch.N.aggregateTokens.toFixed(1)}k (trading total tokens for clean windows & speed)`,
          `They drop to ${orch.N.orchContext.toFixed(1)}k`,
          `They stay identical at ${MODELS_IN_PAGE.monolith.N.orchContext.toFixed(1)}k`,
        ],
        explain: `Each specialist window plus the independent Verifier (${MA.verifyTokens.toFixed(1)}k) still processes tokens: ${orch.N.orchContext.toFixed(1)}k + ${orch.N.rawTotal.toFixed(1)}k + ${MA.verifyTokens.toFixed(1)}k = ${orch.N.aggregateTokens.toFixed(1)}k aggregate vs ${MODELS_IN_PAGE.monolith.N.aggregateTokens.toFixed(1)}k in one agent.`,
      };
    }
    return {
      q: `Why does the parallel architecture add an independent Verifier gate after all module workers finish?`,
      choices: [
        `To catch cross-module contract conflicts that isolated workers cannot see alone`,
        `To reduce aggregate token spend`,
        `To skip worker distillation turns`,
      ],
      explain: `Because each worker sees only its isolated module, an independent verifier (${orch.N.verifyS.toFixed(1)} s, ${MA.verifyTokens.toFixed(1)}k context) inspects the combined contracts and can loop critique back on failure.`,
    };
  }

  return {
    model: (v) => MODELS_IN_PAGE[v.name],
    mount, at, stillAt, render, focus,
    anchors: () => lastAt,
    lab, question,
    heading: (k) => V.heads[k] ?? null,
    info: () => (cur ? { mode: cur.run.mode, tMs: cur.tMs, totalMs: cur.run.totalMs, orchContext: cur.run.orchestratorContext, speedup: cur.run.speedup, lab: !!cur.lab } : {}),
  };
}

// ---------------------------------------------------------------- build page + correctness audit
const bundle = buildSync({ entryPoints: [join(HERE, "figure.mjs")], bundle: true, format: "iife", globalName: "FIG", write: false, minify: true, legalComments: "none" }).outputFiles[0].text;
if (/<\/script/i.test(bundle)) throw new Error("the figure bundle contains </script");
const modelSrc = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "") + "\nconst MODELS_IN_PAGE = MODELS;\n";
const std = VARIANT_DATA.orchestrated, M0 = MODELS.orchestrated;

const DATA = {
  box: BOX,
  lens: LENS,
  plain: 7,
  base: "orchestrated",
  steps: STEPS.map(({ heading, focus }) => ({ heading, focus })),
  alias: {
    orchestrator: ["orchestrator", "dispatch"],
    workers: ["workers", "context"],
    tools: ["tools"],
    retry: ["retry", "tools"],
    verifier: ["verifier", "vault"],
  },
  predict: {
    step: PRED_STEP,
    question: `Workers hold ${f1(M0.N.rawTotal)}k raw logs; root holds ${f1(MA.planTokens)}k. What hits root at fan-in without summaries?`,
    choices: [
      `${f1(M0.N.uncompressedFanIn)}k (past ${M0.N.contextCliff}k cliff)`,
      `${f1(M0.N.fanInContext)}k (same as summaries)`,
      "Parallelism cancels tokens",
    ],
    answer: 0,
    explanation: Object.fromEntries(Object.entries(VARIANT_DATA).map(([k, v]) => [k, v.explanation])),
    locked: "Locked in. Press play to see how context isolation works.",
  },
  lab: {
    button: "Tune system",
    title: "Tune modules, parallelism, context cliff & faults",
    heading: "Does your orchestration stay fast and clean?",
    intro: "Adjust independent module count, parallel worker lanes, safe context ceiling and transient tool timeouts; the 3D rig and View A recompute live.",
    inputs: [
      { id: "subtasks", label: "Modules", min: 2, max: 6, step: 1, value: 3 },
      { id: "parallel", label: "Workers", min: 1, max: 4, step: 1, value: 3 },
      { id: "cliff", label: "Context cliff", min: 16, max: 64, step: 4, value: 32, format: "{}k" },
      { id: "faults", label: "Tool faults", min: 0, max: 3, step: 1, value: 0 },
    ],
  },
  variants: VARIANT_DATA,
};

const CSS = `
${readFileSync(join(ROOT, "src/rig/rig.css"), "utf8")}
#fig{shape-rendering:geometricPrecision}
path,circle,rect{vector-effect:non-scaling-stroke}
text{font-family:var(--sans);fill:var(--ink)}
.vz[data-practice] #fig .inset,.vz[data-practice] #fig .label{visibility:hidden}
.leader{fill:none;stroke:var(--ink);stroke-width:.55}
.ldot{fill:var(--ink)}
.label text{font-size:172px;font-weight:500;paint-order:stroke;stroke:var(--stage);stroke-width:34px;stroke-linejoin:round}
.tb-frame{fill:none;stroke:var(--ink);stroke-width:.9}
.tb-rule{fill:none;stroke:var(--ink);stroke-width:.5}
.tb-title{font-size:${FS * 0.78}px;font-weight:600;letter-spacing:.05em}
.tb-text{font-size:${FS * 0.78}px}
.tb-key{font-size:${FS * 0.74}px}
.tb-small{font-size:${FS * 0.78}px;fill:var(--ink-2)!important}
.k-blue{stroke:var(--blue);stroke-width:2}.k-amber{stroke:#c27d1c;stroke-width:2}.k-teal{stroke:var(--teal);stroke-width:2}.k-red{stroke:var(--t-bad);stroke-width:2}
`;

const AUDIT = {
  models: Object.values(MODELS),
  facts: [
    ...MA.catalog.slice(0, 3).flatMap((t) => [t.rawTokens, t.summaryTokens, t.toolMs / 1000, t.distillMs / 1000, (t.thinkMs + t.toolMs + t.distillMs) / 1000]),
    MA.catalog[2].rawTokens + MA.retryTokens,
    MA.waferStep,
    2, 4, 5, 6, 16, 64,
  ],
  allow: [
    { value: 0, why: "zero retries/overflows in healthy runs" },
  ],
  claims: [
    {
      text: "Multi-agent orchestration cuts wall time to 6.4 s (1.66x speedup, even while paying 1.0 s for an independent verifier) and keeps coordinator context at 11.0k tokens",
      test: () => MODELS.orchestrated.N.cleanTotalS === 6.4 && MODELS.orchestrated.N.speedup === 1.66 && MODELS.orchestrated.N.orchContext === 11.0,
    },
    {
      text: "in one monolithic agent runs them serially in 10.6 s",
      test: () => MODELS.monolith.N.cleanTotalS === 10.6 && MODELS.monolith.clean.lanes.length === 1,
    },
    {
      text: "the work phase finishes in 3.4 s (bounded by Billing's branch) rather than the serial sum 8.6 s",
      test: () => MODELS.orchestrated.N.workCleanS === 3.4 && MODELS.orchestrated.N.sumWorkS === 8.6,
    },
    {
      text: "no individual worker exceeds 18.0k tokens",
      test: () => MODELS.orchestrated.N.peakWorker === 18.0 && MODELS.orchestrated.clean.tasks.every((t) => t.localContext <= 18.0),
    },
    {
      text: "holding Orchestrator context at 8.6k at fan-in (27% of budget, 11.0k after 2.4k synthesis) versus 50.0k raw (156%, 52.4k after synthesis)",
      test: () => MODELS.orchestrated.N.fanInContext === 8.6 && MODELS.orchestrated.N.uncompressedFanIn === 50.0 && MODELS.orchestrated.N.uncompressedOrch === 52.4,
    },
    {
      text: "aggregate billed tokens across all five windows rise to 64.4k vs 52.4k in a single agent",
      test: () => MODELS.orchestrated.N.aggregateTokens === 64.4 && MODELS.monolith.N.aggregateTokens === 52.4,
    },
    {
      text: "Because 1.2 s of Search's retry overlaps Billing's remaining work (hiding 0.8 s of net delay after Search's 0.4 s distill turn), total wall time rises by only 0.9 s",
      test: () => MODELS.orchestrated.N.retryOverlapS === 1.2 && MODELS.orchestrated.N.overlapSavedS === 0.8 && MODELS.orchestrated.N.faultDeltaS === 0.9 && MODELS.orchestrated.N.faultTotalS === 7.3,
    },
    {
      text: "In the single agent, the same retry adds the full 1.7 s (12.3 s total) and appends error noise to 54.4k tokens",
      test: () => MODELS.monolith.N.faultDeltaS === 1.7 && MODELS.monolith.N.faultTotalS === 12.3 && MODELS.monolith.N.faultOrchContext === 54.4,
    },
  ],
  coverage: {
    source: "Anthropic, Building Effective Agents (Orchestrator-Workers, Context Isolation and Compression, Evaluator-Optimizer verification loop, aggregate token cost vs peak context trade-offs); Amdahl's Law and DAG critical-path scheduling",
    topics: [
      { topic: "architectural separation into control, execution and tool planes", where: "step:1" },
      { topic: "task decomposition and parallel fan-out of data-independent modules", where: "step:2" },
      { topic: "parallel worker branches (Think -> Tool -> Distill) bounded by the critical branch", where: "step:3" },
      { topic: "context isolation, summary compression vs context rot, and aggregate token trade-off", where: "step:4" },
      { topic: "fault containment and localized retry overlapping parallel work", where: "step:5" },
      { topic: "independent evaluator-optimizer verifier gate, rejection critique loop and artifact commit", where: "step:6" },
      { topic: "single monolithic agent vs parallel orchestrator comparison", where: "whatif" },
      { topic: "scaling independent modules, worker concurrency, context cliff and fault count", where: "lab" },
      { topic: "peer-to-peer decentralized swarm routing", core: false, where: "deferred", why: "uses message-board consensus instead of a central orchestrator; named in Details" },
    ],
  },
  reviewFile: join(HERE, "review.json"),
  report: join(ROOT, "dist", "multi-agent.audit.json"),
};

const HTML = drawingPage({
  title: "Multi-Agent Orchestration",
  about: "One coordinator, isolated specialist contexts and a verifier gate turn slow serial prompts into fast, resilient execution.",
  scene: "multi-agent",
  steps: STEPS,
  stageLabel: "Multi-agent orchestration architecture in isometric 3D with live execution trace. Left and right arrows step through; space plays.",
  viewBox: `0 0 ${VBW} ${VBH}`,
  figLabel: "Three-tier isometric architecture of a multi-agent orchestration system (Control Plane, Execution Plane, Tools and Memory Plane) alongside View A showing a live Gantt timeline and context-window occupancy meters",
  concept: std.voice ? std.voice[0].text : std.captions[0],
  setup: std.captions[0],
  whatIf: { label: "Architecture", variants: Object.entries(VARIANTS).map(([k, v]) => [k, v.label]) },
  totals: `            <span><b id="r-time">0.0</b> <span id="r-total">/ ${f1(M0.N.cleanTotalS)} s</span></span>
            <span><b id="r-speedup">${f2(M0.N.speedup)}×</b> speedup</span>
            <span><b id="r-orch">0.0k</b> root context</span>
            <span><b id="r-peak">0.0k</b> peak context</span>
            <span><b id="r-workers">0 / ${M0.N.workers}</b> active workers</span>
            <span><b id="r-retries">0</b> retries</span>`,
  readoutNote: "Every schedule timestamp, wafer stack and speedup is computed live by the model",
  legend: [
    ["var(--blue)", "LLM planning, reasoning, post-tool distillation, synthesis and safe context wafers"],
    ["#c27d1c", "External tool valve calls and I/O waits"],
    ["var(--teal)", "Distilled summaries, independent verification and committed artifacts"],
    ["var(--t-bad)", "Tool timeouts, localized retries and tokens past the 32k context cliff"],
  ],
  facts: [
    `DAG scheduling: each independent module branch runs Think -> Tool I/O (+ ${f1(MA.retryMs / 1000)} s per transient timeout) -> post-tool Distill (${f1(MA.catalog[0].distillMs / 1000)}–${f1(MA.catalog[1].distillMs / 1000)} s). With ${M0.N.workers} parallel lanes, the work phase completes in ${f1(M0.N.workCleanS)} s (Billing's branch) instead of ${f1(M0.N.sumWorkS)} s serially (${f2(M0.N.workSpeedup)}x work-phase speedup). Even after paying ${f1(M0.N.verifyS)} s for an independent Verifier gate that the single monolithic agent lacks, end-to-end wall time drops from ${f1(MODELS.monolith.N.cleanTotalS)} s to ${f1(M0.N.cleanTotalS)} s (${f2(M0.N.speedup)}x). Sequentially dependent stages must stay serial inside one branch.`,
    `Context isolation & aggregate token trade-off: raw logs across the three modules total ${f1(M0.N.rawTotal)}k tokens (${f1(MA.catalog[0].rawTokens)}k + ${f1(MA.catalog[1].rawTokens)}k + ${f1(MA.catalog[2].rawTokens)}k). Distilled summaries total ${f1(M0.N.summaryTotal)}k (${f2(M0.N.compressionRatio)}x reduction), holding Orchestrator context at ${f1(M0.N.fanInContext)}k at fan-in (${M0.N.fanInPct}% of ${MA.contextCliff}k) and ${f1(M0.N.orchContext)}k after ${f1(MA.synthTokens)}k synthesis, vs ${f1(M0.N.uncompressedFanIn)}k fan-in / ${f1(M0.N.uncompressedOrch)}k total uncompressed. Trade-off: aggregate tokens across all 5 windows total ${f1(M0.N.aggregateTokens)}k (${f1(M0.N.orchContext)}k + ${f1(M0.N.rawTotal)}k + ${f1(MA.verifyTokens)}k Verifier) vs ${f1(MODELS.monolith.N.aggregateTokens)}k in one agent, and lossy compression can drop detail when contracts are vague.`,
    `Fault containment & verification: a ${f1(M0.N.retryS)} s timeout on Search adds ${f1(MA.retryTokens)}k error tokens inside Search's tray (${f1(MA.catalog[2].rawTokens + MA.retryTokens)}k total), overlaps ${f1(M0.N.retryOverlapS)} s of Billing's branch (hiding ${f1(M0.N.overlapSavedS)} s of net delay after Search's ${f1(MA.catalog[2].distillMs / 1000)} s distill turn), and adds only ${f1(M0.N.faultDeltaS)} s (${f1(M0.N.faultTotalS)} s vs ${f1(MODELS.monolith.N.faultTotalS)} s in the single agent). The independent Verifier (${f1(MA.verifyTokens)}k context) inspects the ${f1(M0.N.summaryTotal)}k merged contracts and triggers a revision critique loop on cross-module failure.`,
    `When a single agent wins: tightly coupled sequential edits with heavy shared state avoid cross-agent handoff overhead and lossy compression. Not covered here: peer-to-peer decentralized swarm routing (uses message-board consensus instead of a central orchestrator).`,
    `Built on Visualize's upgraded Concept Rig (src/rig + src/rig/concept.ts): sculpted chamfered planes, continuous directional shading, 3D routed conduits, counted wafer stacks and a synchronized View A execution trace rendered live in vector SVG.`,
  ],
  css: CSS,
  scripts: bundle,
  modelSrc,
  machine,
  data: DATA,
  audit: AUDIT,
});

const outArg = process.argv.indexOf("--out");
const out = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, "dist", "multi-agent.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, HTML);
console.log(`wrote ${out} (${(HTML.length / 1024 / 1024).toFixed(2)} MB)`);
