// Multi-agent orchestration on Visualize's upgraded rig (src/rig + src/rig/concept.ts):
// Three elevated architectural planes (Control Plane, Execution Plane, Tools & Memory Plane)
// with sculpted 3D instruments, calibrated context-window wafer stacks, routed 3D bus conduits,
// gliding 3D packet shuttles and a synchronized View A execution trace + context budget lens.
//
// Performance contract: every solid mesh is drawn ONCE into <defs> and placed via <use> or a
// single SVG translate transform, keeping 60 fps playback well inside check-drawing's 8 ms budget.

import {
  agentBlade, axesOf, budgetMetersSvg, conduitSvg, deckTier, fitCamera, ganttTraceSvg, hubChassis,
  inspectorFrame, n1, pathThrough, portValve, RigStage, samplePath, screenOf, shuttleSvg,
  vaultCore, waferStack,
} from "../../src/rig/index.ts";
import { snapshotAt } from "./model.mjs";
export { RigStage, screenOf } from "../../src/rig/index.ts";

export const VIEW = { azimuth: 248, elevation: 24 };

// 3D Architectural Layout (world units, z up)
export const POS = {
  zTools: 0,
  zExec: 38,
  zCtrl: 76,
  orch: [-10, 0, 76],
  orchStack: [24, -4, 76],
  workers: [
    [-46, -2, 38], // Researcher
    [-4, -2, 38],  // Coder
    [38, -2, 38],  // Tester
  ],
  workerStacks: [
    [-62, -10, 38],
    [-20, -10, 38],
    [22, -10, 38],
  ],
  valves: [
    [-46, -6, 0],  // Search API
    [-4, -6, 0],   // Code Sandbox
    [38, -6, 0],   // Test Runner
  ],
  verifier: [52, 14, 0],
  vault: [66, -6, 0],
};

// 3D Routed Conduits (clean orthogonal bus bends between tiers)
function buildRoutes() {
  const dispatch = POS.workers.map((w, i) => {
    const dropX = w[0];
    return [
      [POS.orch[0] + (i - 1) * 8, POS.orch[1] - 12, POS.zCtrl + 4],
      [dropX, POS.orch[1] - 12, POS.zCtrl + 4],
      [dropX, w[1] + 9, POS.zExec + 13],
      [w[0], w[1] + 9, POS.zExec + 5],
    ];
  });
  const tools = POS.workers.map((w, i) => {
    const v = POS.valves[i];
    return [
      [w[0], w[1] - 9, POS.zExec + 3],
      [w[0], v[1] - 9, POS.zExec + 3],
      [v[0], v[1] - 9, POS.zTools + 12],
      [v[0], v[1], POS.zTools + 10],
    ];
  });
  // Monolith single-lane tool routes: all 3 tool valves routed strictly from center active blade!
  const monoTools = POS.valves.map((v) => {
    const w = POS.workers[1];
    return [
      [w[0], w[1] - 9, POS.zExec + 3],
      [v[0], w[1] - 9, POS.zExec + 3],
      [v[0], v[1] - 9, POS.zTools + 12],
      [v[0], v[1], POS.zTools + 10],
    ];
  });
  const toVerifier = POS.workers.map((w) => [
    [w[0] + 10, w[1] + 8, POS.zExec + 3],
    [POS.verifier[0], w[1] + 8, POS.zExec + 3],
    [POS.verifier[0], POS.verifier[1], POS.zTools + 11],
  ]);
  const verifyToVault = [
    [POS.verifier[0] + 4, POS.verifier[1] - 6, POS.zTools + 6],
    [POS.vault[0] - 8, POS.vault[1] + 4, POS.zTools + 6],
  ];
  const verifyToOrch = [
    [POS.verifier[0], POS.verifier[1] + 6, POS.zTools + 11],
    [POS.verifier[0], POS.verifier[1] + 6, POS.zCtrl + 4],
    [POS.orch[0] + 14, POS.orch[1] + 10, POS.zCtrl + 4],
  ];
  return { dispatch, tools, monoTools, toVerifier, verifyToVault, verifyToOrch };
}

export const ROUTES = buildRoutes();

/** Fit the main isometric camera across all three architectural planes + tall overflow stacks. */
export function cameraFor(box) {
  const pts = [
    [-78, -32, -4], [82, 32, -4],
    [-78, 32, 46], [82, -32, 46],
    [-58, -26, 98], [46, 26, 118],
  ];
  return fitCamera(pts, box, VIEW.azimuth, VIEW.elevation);
}

const STATUS_MAT = {
  idle: "slate",
  think: "cobalt",
  tool: "amber",
  retry: "ruby",
  done: "teal",
};

/**
 * Build the complete multi-agent figure for one camera.
 * Pre-renders every 3D solid state into <defs> on demand so runtime frames only swap <use> hrefs
 * and set lightweight 2D translate transforms.
 */
export function figure(cam, opts = {}) {
  const px = opts.prefix ?? "ma";
  const ax = axesOf(cam.azimuth, cam.elevation);
  const S = (p) => screenOf(cam, p, ax);
  const parts = [];
  const defs = new Map();
  const once = (id, part, svg) => parts.push({ id: `${px}-${id}`, part, svg });
  const tpl = (id, make) => {
    const full = `${px}-${id}`;
    if (!defs.has(full)) defs.set(full, { svg: `<g id="${full}">${make()}</g>`, sent: false });
    return `#${full}`;
  };
  const drainDefs = () => {
    const out = [];
    for (const d of defs.values()) if (!d.sent) ((d.sent = true), out.push(d.svg));
    return out;
  };

  // ---- Static architectural planes (drawn once)
  once("deck-tools", "tools", deckTier(cam, {
    center: [10, 2, POS.zTools], w: 162, d: 56, thickness: 4.0, bevel: 1.0, material: "frame", gridStep: 18, shadow: true,
  }));
  once("deck-exec", "workers", deckTier(cam, {
    center: [-6, -2, POS.zExec], w: 152, d: 50, thickness: 3.6, bevel: 0.9, material: "ceramic", gridStep: 18, standoffs: true, standoffH: POS.zExec - 4.0, shadow: true,
  }));
  once("deck-ctrl", "orchestrator", deckTier(cam, {
    center: [4, -1, POS.zCtrl], w: 94, d: 44, thickness: 3.6, bevel: 0.9, material: "ceramic", gridStep: 16, standoffs: true, standoffH: POS.zCtrl - POS.zExec - 3.6, shadow: true,
  }));

  // ---- Cached instrument templates (drawn once per distinct state)
  const hubTpl = (coreMat, bin) => tpl(`hub-${coreMat}-${bin}`, () => hubChassis(cam, POS.orch, {
    r: 16.5, h: 11, material: "obsidian", bezelMaterial: "alloy", coreMaterial: coreMat, phase: (bin * Math.PI * 2) / 16,
  }));
  const bladeTpl = (idx, beaconMat, dimmed) => tpl(`blade-${idx}-${beaconMat}-${dimmed ? 1 : 0}`, () => agentBlade(cam, POS.workers[idx], {
    w: 25, d: 18, h: 9.2,
    material: dimmed ? "frame" : "slate",
    hoodMaterial: dimmed ? "frame" : "ceramic",
    beaconMaterial: dimmed ? "frame" : beaconMat,
    fins: 4,
  }));
  const valveTpl = (idx, capMat, big = false) => tpl(`valve-${idx}-${capMat}-${big ? 1 : 0}`, () => portValve(
    cam,
    big ? POS.verifier : POS.valves[idx],
    { r: big ? 10.5 : 8.2, h: big ? 10.5 : 8.8, bodyMaterial: "steel", collarMaterial: big ? "brass" : "alloy", capMaterial: capMat },
  ));
  const vaultTpl = (capMat) => tpl(`vault-${capMat}`, () => vaultCore(cam, POS.vault, {
    r: 12.2, h: 13, material: "alloy", capMaterial: capMat,
  }));
  const stackTpl = (slot, base, count, capCount, mat) => tpl(`stk-${slot}-${count}-${capCount}-${mat}`, () => waferStack(cam, base, {
    count, capCount, w: slot === "orch" ? 13 : 10.5, d: slot === "orch" ? 13 : 10.5,
    sliceH: 2.0, gap: 0.65, material: mat, overMaterial: "ruby", postSide: slot === "orch" ? 1 : -1,
  }));
  // Pre-rendered shuttles centred at world origin [0,0,0], moved by 2D screen translate
  const oScreen = S([0, 0, 0]);
  const shuttleTpl = (mat) => tpl(`shuttle-${mat}`, () => shuttleSvg(cam, [0, 0, 0], { r: 3.4, h: 3.0, material: mat }));
  const conduitTpl = (key, pts, active, tone) => tpl(`c-${key}-${active ? 1 : 0}-${tone}`, () => conduitSvg(cam, pts, { active, tone }));

  // Fixed anchor table for tracking callout leaders
  const at = {
    orchestrator: S([POS.orch[0] - 10, POS.orch[1] + 4, POS.zCtrl + 11]),
    rootStack: S([POS.orchStack[0] + 6, POS.orchStack[1] - 4, POS.zCtrl + 16]),
    worker0: S([POS.workers[0][0] - 8, POS.workers[0][1], POS.zExec + 9]),
    worker1: S([POS.workers[1][0], POS.workers[1][1] - 7, POS.zExec + 9]),
    worker2: S([POS.workers[2][0] + 10, POS.workers[2][1], POS.zExec + 9]),
    workerStack: S([POS.workerStacks[0][0] - 5, POS.workerStacks[0][1] - 4, POS.zExec + 10]),
    tools: S([POS.valves[0][0] - 6, POS.valves[0][1] - 4, POS.zTools + 8]),
    retryValve: S([POS.valves[2][0] + 5, POS.valves[2][1] - 6, POS.zTools + 8]),
    verifier: S([POS.verifier[0] + 6, POS.verifier[1] + 4, POS.zTools + 10]),
    vault: S([POS.vault[0] + 8, POS.vault[1] - 4, POS.zTools + 11]),
  };

  /** Compute one 60fps frame for the given simulated run & wall-clock time tMs. */
  function pose(st) {
    const { run, tMs, showUncompressed } = st;
    const snap = snapshotAt(run, tMs);
    const items = [];
    const mono = run.mode === "monolith";

    // Painter's keys: strictly ordered bottom tier (10..29) -> middle tier (30..59) -> top tier (60..89)
    items.push({ id: `${px}-deck-tools`, key: 10 });

    // Conduits on bottom/lower inter-tier
    const anyVerify = !mono && snap.verifierStatus !== "idle";
    items.push({ id: `${px}-c-v2vault`, part: "vault", key: 13, hidden: mono, href: conduitTpl("v2vault", ROUTES.verifyToVault, snap.vaultCommitted, "teal") });

    // Verifier (hidden/powered down in single monolithic agent since monolith has no second verifier agent!)
    const vCap = snap.verifierStatus === "active" ? "amber" : snap.verifierStatus === "done" ? "teal" : "frame";
    items.push({ id: `${px}-verifier`, part: "verifier", key: 15, hidden: mono, href: valveTpl("v", vCap, true) });

    // Tool valves (sorted back-left to front-right along +x)
    for (let i = 0; i < 3; i++) {
      const task = snap.taskStates[i];
      const activeTool = task && (task.status === "tool" || task.status === "retry");
      const cap = !task ? "slate" : task.status === "retry" ? "ruby" : task.status === "tool" ? "amber" : task.status === "done" ? "teal" : "slate";
      items.push({ id: `${px}-valve-${i}`, part: i === 2 && task?.status === "retry" ? "retry" : "tools", key: 18 + i, href: valveTpl(i, cap, false) });
      // Tool conduit: routes strictly from center blade in monolith mode, from each worker in orchestrated mode
      const cTone = task?.status === "retry" ? "ruby" : "amber";
      const routePts = mono ? ROUTES.monoTools[i] : ROUTES.tools[i];
      items.push({ id: `${px}-c-tool-${i}`, part: i === 2 && task?.status === "retry" ? "retry" : "tools", key: 24 + i, href: conduitTpl(`${mono ? "mt" : "t"}${i}`, routePts, !!activeTool, cTone) });
    }
    // Artifact Vault (far-right front of bottom tier)
    items.push({ id: `${px}-vault`, part: "vault", key: 22, href: vaultTpl(snap.vaultCommitted ? "teal" : "slate") });

    // Return conduit from Verifier to Orchestrator (orchestrated only)
    items.push({ id: `${px}-c-v2orch`, part: "verifier", key: 28, hidden: mono, href: conduitTpl("v2orch", ROUTES.verifyToOrch, snap.phase === "synth" || snap.phase === "done", "teal") });

    // Middle tier deck (Execution Plane)
    items.push({ id: `${px}-deck-exec`, key: 32 });

    // Conduits from workers to verifier (orchestrated only)
    for (let i = 0; i < 3; i++) {
      const done = snap.taskStates[i]?.status === "done";
      items.push({ id: `${px}-c-w2v-${i}`, part: "verifier", key: 34 + i, hidden: mono, href: conduitTpl(`w2v${i}`, ROUTES.toVerifier[i], done && anyVerify, "teal") });
    }

    // Worker blades + their isolated context wafer stacks
    const capW = run.capWafers;
    for (let i = 0; i < 3; i++) {
      // Map visible 3 blades to active tasks cleanly even when Lab selects 2..6 subtasks
      const laneTasks = snap.taskStates.filter((ts) => (mono ? i === 1 : ts.lane % 3 === i));
      const activeT = laneTasks.find((ts) => ts.status !== "idle" && ts.status !== "done")
        ?? laneTasks.findLast?.((ts) => ts.status === "done")
        ?? laneTasks[0];
      const status = activeT ? activeT.status : "idle";
      const dimmed = mono ? i !== 1 : i >= run.maxParallel;
      const beacon = STATUS_MAT[status] ?? "slate";
      const partName = status === "retry" ? "retry" : "workers";
      items.push({ id: `${px}-blade-${i}`, part: partName, key: 40 + i * 2, href: bladeTpl(i, beacon, dimmed) });

      // Local isolated context stack (hidden in monolith since all tokens go to the single root stack!)
      const localTok = mono ? 0 : Math.max(0, ...laneTasks.map((ts) => ts.localTokens));
      const wCount = dimmed || mono ? 0 : Math.min(14, run.wafersFor(localTok));
      const sMat = status === "retry" ? "amber" : status === "done" ? "teal" : "cobalt";
      items.push({
        id: `${px}-wstk-${i}`,
        part: "context",
        key: 41 + i * 2,
        hidden: dimmed || mono,
        href: stackTpl(`w${i}`, POS.workerStacks[i], wCount, capW, sMat),
      });
    }

    // Dispatch conduits from Orchestrator down to Workers (only center lane in monolith)
    for (let i = 0; i < 3; i++) {
      const t = snap.taskStates[i];
      const active = !mono ? !!(t && t.status !== "idle") : i === 1 && snap.phase !== "plan";
      const tone = t?.status === "retry" ? "ruby" : t?.status === "done" ? "teal" : "cobalt";
      items.push({ id: `${px}-c-disp-${i}`, part: "dispatch", key: 52 + i, hidden: mono && i !== 1, href: conduitTpl(`d${i}`, ROUTES.dispatch[i], active, tone) });
    }

    // Top tier deck (Control Plane)
    items.push({ id: `${px}-deck-ctrl`, key: 60 });

    // Orchestrator Hub (uses strictly documented legend tones: cobalt for Plan/Think/Synth, teal when done)
    const hubMat = snap.phase === "done" ? "teal" : "cobalt";
    const dialBin = Math.floor(((tMs / 180) % 16 + 16) % 16);
    items.push({ id: `${px}-hub`, part: "orchestrator", key: 65, href: hubTpl(hubMat, dialBin) });

    // Root Context Window Stack (physically explodes past red 32k collar if uncompressed or monolith!)
    const shownOrchTok = showUncompressed ? run.rawPeakIfUncompressed : snap.orchTokens;
    const orchWafers = Math.min(15, run.wafersFor(shownOrchTok));
    const orchMat = shownOrchTok > run.contextCliff ? "cobalt" : snap.phase === "done" ? "teal" : "cobalt";
    items.push({ id: `${px}-orch-stk`, part: "context", key: 68, href: stackTpl("orch", POS.orchStack, orchWafers, capW, orchMat) });

    // Dynamic anchor for top of root context stack so callout tracks its height
    const rootTopZ = POS.zCtrl + 2 + Math.max(4, orchWafers * 2.65);
    const liveAt = {
      ...at,
      rootStack: S([POS.orchStack[0] + 7, POS.orchStack[1] - 4, rootTopZ]),
      workerStack: mono ? S([POS.workers[1][0] - 8, POS.workers[1][1], POS.zExec + 8]) : at.workerStack,
    };

    // Live 60fps gliding 3D packet shuttles along conduits (zero mesh rebuilds!)
    for (let i = 0; i < 3; i++) {
      const task = snap.taskStates[i];
      const sh = task?.shuttle;
      const laneIdx = mono ? 1 : (task ? task.lane % 3 : i);
      let pt = null, mat = "subject";
      const toolRoute = mono ? ROUTES.monoTools[i] : ROUTES.tools[i];
      if (sh) {
        if (sh.kind === "dispatch") {
          pt = samplePath(ROUTES.dispatch[laneIdx], sh.u).point;
          mat = "cobalt";
        } else if (sh.kind === "toolOut") {
          pt = samplePath(toolRoute, sh.u).point;
          mat = "amber";
        } else if (sh.kind === "toolBack") {
          pt = samplePath(toolRoute, 1 - sh.u).point;
          mat = "amber";
        } else if (sh.kind === "retry") {
          const bounce = sh.u < 0.5 ? sh.u * 2 : 2 - sh.u * 2;
          pt = samplePath(toolRoute, bounce).point;
          mat = "ruby";
        } else if (sh.kind === "return") {
          pt = samplePath(ROUTES.dispatch[laneIdx], 1 - sh.u).point;
          mat = "teal";
        }
      }
      if (pt) {
        const sc = S(pt);
        items.push({
          id: `${px}-sh-${i}`,
          part: sh.kind === "retry" ? "retry" : "dispatch",
          key: 80 + i,
          href: shuttleTpl(mat),
          transform: `translate(${n1(sc[0] - oScreen[0])} ${n1(sc[1] - oScreen[1])})`,
        });
      } else {
        items.push({ id: `${px}-sh-${i}`, key: 80 + i, hidden: true });
      }
    }

    // Verifier -> Orchestrator synthesis shuttle (orchestrated only)
    if (!mono && snap.phase === "synth") {
      const u = Math.max(0, Math.min(1, (tMs - run.synthStart) / Math.max(1, run.synthEnd - run.synthStart)));
      const sc = S(samplePath(ROUTES.verifyToOrch, u).point);
      items.push({
        id: `${px}-sh-synth`,
        part: "verifier",
        key: 85,
        href: shuttleTpl("teal"),
        transform: `translate(${n1(sc[0] - oScreen[0])} ${n1(sc[1] - oScreen[1])})`,
      });
    } else {
      items.push({ id: `${px}-sh-synth`, key: 85, hidden: true });
    }

    return { items, at: liveAt, defs: drainDefs(), snap };
  }

  return { parts, pose };
}

/** Render the synchronized View A Inspector SVG (Live Gantt Timeline + Context Window Budget). */
export function renderViewA(box, run, snap, hideRawComparison = false) {
  const ganttBox = { x: box.x + 60, y: box.y + 370, w: box.w - 120, h: 1960 };
  const dividerY = box.y + 2440;
  const budgetBox = { x: box.x + 60, y: box.y + 2560, w: box.w - 120, h: box.h - 2620 };
  const tMax = Math.max(14000, Math.ceil(run.totalMs / 2000) * 2000);
  const ticks = [];
  const step = tMax <= 14000 ? 2000 : 4000;
  for (let tk = 0; tk <= tMax; tk += step) ticks.push(tk);

  const rootVal = snap.orchTokens;
  const workerVal = run.mode === "monolith" ? 0 : Math.max(0, ...snap.taskStates.map((s) => s.localTokens));
  const rows = run.mode === "monolith"
    ? (hideRawComparison
        ? [{ label: "Single agent", value: rootVal, tone: "cobalt" }]
        : [
            { label: "Single agent", value: rootVal, tone: "cobalt" },
            { label: "End of run", value: run.orchestratorContext, tone: "ruby" },
          ])
    : [
        { label: "Orchestrator", value: rootVal, tone: "teal" },
        { label: "Peak worker", value: workerVal, tone: "cobalt" },
        ...(hideRawComparison ? [] : [{ label: "If raw fan-in", value: run.rawFanInIfUncompressed, tone: "ruby" }]),
      ];

  const sub = `${(snap.tMs / 1000).toFixed(1)}s / ${(run.totalMs / 1000).toFixed(1)}s`;
  return inspectorFrame(box, "VIEW A · TRACE & CONTEXT", sub)
    + ganttTraceSvg(ganttBox, { lanes: run.lanes, tNow: snap.tMs, tMax, unit: "s", ticks })
    + `<path class="lens-rule" d="M${n1(box.x + 110)},${n1(dividerY)}H${n1(box.x + box.w - 110)}"/>`
    + `<text class="lens-sub" x="${n1(box.x + 120)}" y="${n1(dividerY + 150)}">CONTEXT OCCUPANCY (K TOKENS)</text>`
    + budgetMetersSvg(budgetBox, {
      rows,
      cap: run.contextCliff,
      maxScale: Math.max(60, run.rawPeakIfUncompressed + 6, run.contextCliff + 8),
      unit: "k",
      capLabel: `${run.contextCliff}k cliff`,
    });
}
