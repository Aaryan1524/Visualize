// Multi-agent orchestration on Visualize's upgraded rig (src/rig + src/rig/concept.ts):
// Three elevated architectural planes (Control Plane, Execution Plane, Tools & Memory Plane)
// with sculpted 3D instruments, calibrated context-window wafer stacks, routed 3D bus conduits,
// distinct raw-cargo vs distilled-summary 3D shuttles, a bounded ruby retry loop, a Verifier
// archway gate, a stateful Shared Artifact Vault and a synchronized View A inspector lens.
//
// Performance contract: every solid mesh is drawn ONCE into <defs> and placed via <use> or a
// single SVG translate transform, keeping 60 fps playback well inside check-drawing's 8 ms budget.

import {
  add, agentBlade, axesOf, budgetMetersSvg, chamferPlate, circlePoints, conduitSvg,
  contactShadow, deckTier, drawMesh, fitCamera, floorPlane, ganttTraceSvg, hubChassis,
  inspectorFrame, linesOn, n1, pathThrough, plate, portValve, regularPolygon, RigStage,
  rod, roundedRect, samplePath, screenOf, shadowVector, turned,
} from "../../src/rig/index.ts";
import { snapshotAt } from "./model.mjs";
export { RigStage, screenOf } from "../../src/rig/index.ts";

export const VIEW = { azimuth: 248, elevation: 24 };
const Z_UP = [0, 0, 1];

// 3D Architectural Layout (world units, z up)
export const POS = {
  zTools: 0,
  zExec: 38,
  zCtrl: 76,
  orch: [-10, 0, 76],
  orchStack: [24, -4, 76],
  workers: [
    [-46, -2, 38], // Auth
    [-4, -2, 38],  // Billing
    [38, -2, 38],  // Search
  ],
  workerStacks: [
    [-62, -10, 38],
    [-20, -10, 38],
    [22, -10, 38],
  ],
  valves: [
    [-46, -6, 0],  // Auth Test API
    [-4, -6, 0],   // Billing Sandbox
    [38, -6, 0],   // Search Runner
  ],
  verifier: [56, 12, 0],
  vault: [72, -6, 0],
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
  // Bounded retry loop strictly contained inside the Search lane (Search Runner valve -> Search blade)
  const sv = POS.valves[2], sw = POS.workers[2], mw = POS.workers[1];
  const retryArcOrch = [
    [sv[0] + 6, sv[1] - 4, POS.zTools + 8],
    [sv[0] + 14, sv[1] - 11, POS.zTools + 15],
    [sv[0] + 16, sv[1] - 11, POS.zTools + 28],
    [sw[0] + 15, sw[1] - 9, POS.zExec + 2],
    [sw[0] + 11, sw[1] - 7, POS.zExec + 8],
  ];
  const retryArcMono = [
    [sv[0] + 5, sv[1] - 5, POS.zTools + 8],
    [sv[0] + 11, sv[1] - 12, POS.zTools + 18],
    [(sv[0] + mw[0]) / 2 + 6, sv[1] - 14, POS.zTools + 33],
    [mw[0] + 12, mw[1] - 11, POS.zExec + 5],
    [mw[0] + 8, mw[1] - 7, POS.zExec + 8],
  ];
  const toVerifier = POS.workers.map((w) => [
    [w[0] + 10, w[1] + 8, POS.zExec + 3],
    [POS.verifier[0] - 8, w[1] + 8, POS.zExec + 3],
    [POS.verifier[0] - 8, POS.verifier[1], POS.zTools + 9],
  ]);
  const verifyToVault = [
    [POS.verifier[0] + 7, POS.verifier[1] - 5, POS.zTools + 6],
    [POS.vault[0] - 10, POS.vault[1] + 4, POS.zTools + 6],
  ];
  const verifyToOrch = [
    [POS.verifier[0], POS.verifier[1] + 6, POS.zTools + 14],
    [POS.verifier[0], POS.verifier[1] + 6, POS.zCtrl + 4],
    [POS.orch[0] + 14, POS.orch[1] + 10, POS.zCtrl + 4],
  ];
  // Monolith direct self-check commit conduit (core -> vault, no verifier)
  const monoToVault = [
    [POS.orch[0] + 14, POS.orch[1] + 10, POS.zCtrl + 4],
    [POS.vault[0] - 4, POS.orch[1] + 10, POS.zCtrl + 4],
    [POS.vault[0] - 4, POS.vault[1] + 8, POS.zTools + 12],
    [POS.vault[0], POS.vault[1] + 4, POS.zTools + 10],
  ];
  return { dispatch, tools, monoTools, retryArcOrch, retryArcMono, toVerifier, verifyToVault, verifyToOrch, monoToVault };
}

export const ROUTES = buildRoutes();

/** Fit the main isometric camera across all three architectural planes + tall overflow stacks. */
export function cameraFor(box) {
  const pts = [
    [-78, -32, -4], [90, 32, -4],
    [-78, 32, 46], [84, -32, 46],
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

// ---------------------------------------------------------------- Sculpted Concept Hardware

/**
 * Upgraded calibrated context-window wafer stack:
 * - Steel base tray + alloy gauge post with 8k tick rings and a red 32k cliff collar.
 * - When count > capCount (overflow), clamps a circumferential ruby cliff-breach ring around
 *   the stack at the exact 32k level and towers pressurized crimson wafers past it.
 */
function richWaferStack(cam, base, o) {
  const w = o.w ?? 12, d = o.d ?? 12, sh = o.sliceH ?? 2.0, gap = o.gap ?? 0.65;
  const pitch = sh + gap;
  const side = o.postSide ?? -1;
  const over = o.count > o.capCount;
  const tray = chamferPlate(floorPlane(base[2], base[0], base[1]), roundedRect(w + 2.8, d + 2.8, 1.9), 0, 2.0, 0.5);
  const capZ = base[2] + 2.0 + o.capCount * pitch;
  const postH = Math.max(capZ - base[2] + 3.0, 2.0 + o.count * pitch + 2.0);
  const postAt = add(base, [side * (w / 2 + 2.8), 0, 0]);
  const post = rod(postAt, add(postAt, [0, 0, postH]), 0.9, 12);
  const collar = turned(add(postAt, [0, 0, capZ - base[2] - 0.8]), Z_UP, [[0, 2.0], [1.6, 2.0]], 16);
  // Caliper indicator arm extending from the 32k collar toward the wafer column
  const armEnd = add(postAt, [-side * 2.2, 0, capZ - base[2]]);
  const arm = rod(add(postAt, [0, 0, capZ - base[2]]), armEnd, 0.48, 8);

  let out = contactShadow(tray, cam, shadowVector(cam, 2.0))
    + drawMesh(tray, cam, { material: "steel", shine: false })
    + drawMesh(post, cam, { material: "alloy", shine: true });

  // Subtle calibration ticks at 8k, 16k, 24k along the post
  const ticks = [];
  for (let t = 2; t < o.capCount; t += 2) {
    const tz = base[2] + 2.0 + t * pitch;
    ticks.push([add(postAt, [0, -1.0, tz - base[2]]), add(postAt, [-side * 1.4, -1.0, tz - base[2]])]);
  }
  if (ticks.length) out += linesOn(cam, ticks, "rig-crease");

  // Safe wafers up to capCount
  const safeN = Math.min(o.count, o.capCount);
  for (let i = 0; i < safeN; i++) {
    const z = base[2] + 2.1 + i * pitch;
    const wafer = chamferPlate(floorPlane(z, base[0], base[1]), roundedRect(w, d, 1.4), 0, sh, 0.42);
    out += drawMesh(wafer, cam, { material: o.material ?? "cobalt", shine: true, crease: 34 });
  }

  // Red 32k cliff collar + caliper arm (+ full breach clamp ring when overflowing!)
  out += drawMesh(collar, cam, { material: "ruby", shine: true });
  out += drawMesh(arm, cam, { material: "ruby", shine: false });
  if (over) {
    const ring = plate(
      floorPlane(capZ - 0.65, base[0], base[1]),
      { outer: roundedRect(w + 2.8, d + 2.8, 1.8), holes: [roundedRect(w + 0.5, d + 0.5, 1.1)] },
      0,
      1.3,
    );
    out += drawMesh(ring, cam, { material: "ruby", shine: true });
  }

  // Overflow wafers bursting past the 32k collar in pressurized ruby
  for (let i = o.capCount; i < o.count; i++) {
    const z = base[2] + 2.1 + i * pitch;
    const wafer = chamferPlate(floorPlane(z, base[0], base[1]), roundedRect(w + 0.7, d + 0.7, 1.4), 0, sh + 0.12, 0.42);
    out += drawMesh(wafer, cam, { material: "ruby", shine: true, crease: 32 });
  }
  return out;
}

/**
 * Unmistakable Verifier Gate inspection archway housing:
 * Dual slate pylons, machined alu gantry bridge, brass bezel crown and a live check-indicator
 * beacon + inspection scan bar that lights amber during review and crisp teal on pass.
 */
function richVerifierGate(cam, base, status) {
  const plinth = chamferPlate(floorPlane(base[2], base[0], base[1]), roundedRect(22, 16, 2.2), 0, 2.2, 0.5);
  const pylonL = chamferPlate(floorPlane(base[2] + 2.2, base[0] - 6.8, base[1]), roundedRect(4.6, 11.5, 1.1), 0, 8.8, 0.5);
  const pylonR = chamferPlate(floorPlane(base[2] + 2.2, base[0] + 6.8, base[1]), roundedRect(4.6, 11.5, 1.1), 0, 8.8, 0.5);
  const bridge = chamferPlate(floorPlane(base[2] + 10.6, base[0], base[1]), roundedRect(21.5, 13.5, 2.0), 0, 3.2, 0.75);
  const bezel = turned(add(base, [0, 0, 13.8]), Z_UP, [[0, 4.9], [1.1, 4.9], [1.7, 4.0], [1.7, 3.2]], 28);
  const beaconMat = status === "active" ? "amber" : status === "done" ? "teal" : "slate";
  const beacon = turned(add(base, [0, 0, 14.3]), Z_UP, [[0, 3.3], [1.4, 3.3], [2.4, 2.2], [2.7, 0.2]], 24);
  const scanBar = chamferPlate(floorPlane(base[2] + 5.8, base[0], base[1]), roundedRect(9.2, 2.4, 0.6), 0, 1.6, 0.3);

  const slits = [];
  for (let i = -2; i <= 2; i++) {
    const sx = base[0] + i * 2.8;
    slits.push([[sx, base[1] - 5.2, base[2] + 13.85], [sx, base[1] - 3.0, base[2] + 13.85]]);
  }

  return (
    contactShadow(plinth, cam, shadowVector(cam, 2.4))
    + drawMesh(plinth, cam, { material: "steel", shine: false })
    + drawMesh(pylonL, cam, { material: "slate", shine: true })
    + drawMesh(scanBar, cam, { material: status === "idle" ? "steel" : beaconMat, shine: true })
    + drawMesh(pylonR, cam, { material: "slate", shine: true })
    + drawMesh(bridge, cam, { material: "alu", shine: true })
    + linesOn(cam, slits, "rig-crease")
    + drawMesh(bezel, cam, { material: "brass", shine: true })
    + drawMesh(beacon, cam, { material: beaconMat, shine: true })
  );
}

/**
 * Physical Shared Artifact Vault with three unmistakable mechanical states:
 * - "unsealed": open armored chamber with dark obsidian interior and parked side collar (pre-commit)
 * - "verified": locked brass collar + risen faceted teal verified artifact core + teal seal ring
 * - "selfcheck": monolith unverified self-check commit (amber core with caution ruby collar)
 */
function richArtifactVault(cam, base, mode) {
  const r = 12.6, h = 11.4;
  const prof = [
    [0, r], [2.0, r], [2.5, r * 0.90], [5.2, r * 0.90], [5.7, r * 0.97],
    [8.4, r * 0.97], [8.9, r * 0.88], [h, r * 0.88],
  ];
  const body = turned(base, Z_UP, prof, 32);
  const rimRing = plate(
    floorPlane(base[2] + h, base[0], base[1]),
    { outer: circlePoints(r * 0.90, 32), holes: [circlePoints(r * 0.60, 28)] },
    0,
    1.5,
  );

  let out = contactShadow(body, cam, shadowVector(cam, 2.5))
    + drawMesh(body, cam, { material: "steel", shine: true });

  if (mode === "unsealed") {
    // Open recessed chamber cavity waiting for commit + muted amber standby rim
    const cavity = turned(add(base, [0, 0, h - 0.2]), Z_UP, [[0, r * 0.61], [0.9, r * 0.61]], 24);
    const latch = chamferPlate(floorPlane(base[2] + h + 1.4, base[0] + r * 0.56, base[1] + 2.5), roundedRect(5.8, 5.8, 1.4), 0, 1.5, 0.35);
    out += drawMesh(cavity, cam, { material: "obsidian", shine: false })
      + drawMesh(rimRing, cam, { material: "alloy", shine: true })
      + drawMesh(latch, cam, { material: "amber", shine: true });
  } else if (mode === "verified") {
    // Locked brass bezel + elevated faceted teal verified artifact crystal core + teal seal
    const sealRing = plate(
      floorPlane(base[2] + h + 1.5, base[0], base[1]),
      { outer: circlePoints(r * 0.72, 28), holes: [circlePoints(r * 0.46, 24)] },
      0,
      1.2,
    );
    const core = chamferPlate(floorPlane(base[2] + h + 1.4, base[0], base[1]), regularPolygon(6, r * 0.45, 0, 0, Math.PI / 6), 0, 6.2, 1.35);
    out += drawMesh(rimRing, cam, { material: "brass", shine: true })
      + drawMesh(sealRing, cam, { material: "teal", shine: true })
      + drawMesh(core, cam, { material: "teal", shine: true });
  } else {
    // Monolith unverified self-check commit: amber core seated in caution ruby collar
    const warnRing = plate(
      floorPlane(base[2] + h + 1.5, base[0], base[1]),
      { outer: circlePoints(r * 0.70, 28), holes: [circlePoints(r * 0.48, 24)] },
      0,
      1.1,
    );
    const core = chamferPlate(floorPlane(base[2] + h + 1.2, base[0], base[1]), regularPolygon(6, r * 0.44, 0, 0, Math.PI / 6), 0, 4.4, 1.0);
    out += drawMesh(rimRing, cam, { material: "slate", shine: true })
      + drawMesh(warnRing, cam, { material: "ruby", shine: true })
      + drawMesh(core, cam, { material: "amber", shine: true });
  }
  return out;
}

/** Distinct 3D shuttles: heavy raw tool crate (amber), sleek dispatch capsule (cobalt), compact summary puck (teal), fault diamond (ruby). */
function richShuttleSvg(cam, kind) {
  const at = [0, 0, 0];
  if (kind === "raw") {
    // Heavy chunky amber cargo crate (visibly larger than distilled summary!)
    const pl = floorPlane(-2.2, at[0], at[1]);
    const crate = chamferPlate(pl, roundedRect(8.8, 6.6, 1.3), 0, 4.4, 0.85);
    const band = chamferPlate(floorPlane(2.2, at[0], at[1]), roundedRect(2.4, 6.0, 0.5), 0, 0.65, 0.2);
    return contactShadow(crate, cam, shadowVector(cam, 1.8))
      + drawMesh(crate, cam, { material: "amber", shine: true })
      + drawMesh(band, cam, { material: "steel", shine: false });
  }
  if (kind === "summary") {
    // Compact, clean distilled summary puck (visibly smaller than heavy amber tool traffic!)
    const pl = floorPlane(-1.0, at[0], at[1]);
    const puck = chamferPlate(pl, regularPolygon(6, 2.5, 0, 0, 0), 0, 2.0, 0.55);
    return contactShadow(puck, cam, shadowVector(cam, 1.2))
      + drawMesh(puck, cam, { material: "teal", shine: true });
  }
  if (kind === "retry") {
    const pl = floorPlane(-1.6, at[0], at[1]);
    const gem = chamferPlate(pl, regularPolygon(8, 3.6, 0, 0, Math.PI / 8), 0, 3.2, 0.9);
    return contactShadow(gem, cam, shadowVector(cam, 1.6))
      + drawMesh(gem, cam, { material: "ruby", shine: true });
  }
  // Dispatch spec capsule (cobalt)
  const pl = floorPlane(-1.5, at[0], at[1]);
  const cap = chamferPlate(pl, regularPolygon(6, 3.3, 0, 0, 0), 0, 3.0, 0.8);
  return contactShadow(cap, cam, shadowVector(cam, 1.5))
    + drawMesh(cap, cam, { material: "cobalt", shine: true });
}

/** Bold dashed ruby retry arc with stage halo and directional return arrowhead. */
function retryArcSvg(cam, pts, active) {
  const ax = axesOf(cam.azimuth, cam.elevation);
  const spts = pts.map((p) => screenOf(cam, p, ax));
  const d = pathThrough(spts, false);
  const tip = spts[spts.length - 1];
  const prev = spts[spts.length - 2];
  const dx = tip[0] - prev[0], dy = tip[1] - prev[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const ah = 135, aw = 68;
  const p1 = [tip[0] - ux * ah + nx * aw, tip[1] - uy * ah + ny * aw];
  const p2 = [tip[0] - ux * ah - nx * aw, tip[1] - uy * ah - ny * aw];
  const head = `M${n1(tip[0])} ${n1(tip[1])}L${n1(p1[0])} ${n1(p1[1])}L${n1(p2[0])} ${n1(p2[1])}Z`;
  const cls = active ? "retry-arc is-hot" : "retry-arc";
  return `<g class="${cls}"><path class="retry-arc-halo" d="${d}"/><path class="retry-arc-line" d="${d}"/><path class="retry-arc-head" d="${head}"/></g>`;
}

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

  // ---- Static architectural planes (drawn once in calm studio neutral frame; part="deck" so
  //      they recede cleanly on zoomed shots and never bloat instrument camera bounds!)
  once("deck-tools", "deck", deckTier(cam, {
    center: [12, 2, POS.zTools], w: 168, d: 56, thickness: 4.0, bevel: 1.0, material: "frame", gridStep: 18, shadow: true,
  }));
  once("deck-exec", "deck", deckTier(cam, {
    center: [-6, -2, POS.zExec], w: 152, d: 50, thickness: 3.6, bevel: 0.9, material: "frame", gridStep: 18, standoffs: true, standoffH: POS.zExec - 4.0, shadow: true,
  }));
  once("deck-ctrl", "deck", deckTier(cam, {
    center: [4, -1, POS.zCtrl], w: 94, d: 44, thickness: 3.6, bevel: 0.9, material: "frame", gridStep: 16, standoffs: true, standoffH: POS.zCtrl - POS.zExec - 3.6, shadow: true,
  }));

  // ---- Cached instrument templates (drawn once per distinct state)
  const hubTpl = (coreMat, bin) => tpl(`hub-${coreMat}-${bin}`, () => hubChassis(cam, POS.orch, {
    r: 16.5, h: 11, material: "obsidian", bezelMaterial: "alloy", coreMaterial: coreMat, phase: (bin * Math.PI * 2) / 16,
  }));
  // Active blades use bead-blasted alu hoods (crisp top-vs-stage & top-vs-side OKLab contrast in both themes!)
  const bladeTpl = (idx, beaconMat, dimmed) => tpl(`blade-${idx}-${beaconMat}-${dimmed ? 1 : 0}`, () => agentBlade(cam, POS.workers[idx], {
    w: 25, d: 18, h: 9.2,
    material: dimmed ? "frame" : "slate",
    hoodMaterial: dimmed ? "frame" : "alu",
    beaconMaterial: dimmed ? "slate" : beaconMat,
    fins: 4,
  }));
  const valveTpl = (idx, capMat) => tpl(`valve-${idx}-${capMat}`, () => portValve(
    cam,
    POS.valves[idx],
    { r: 8.2, h: 8.8, bodyMaterial: "steel", collarMaterial: "alloy", capMaterial: capMat },
  ));
  const verifierTpl = (status) => tpl(`verif-${status}`, () => richVerifierGate(cam, POS.verifier, status));
  const vaultTpl = (mode) => tpl(`vault-${mode}`, () => richArtifactVault(cam, POS.vault, mode));
  const stackTpl = (slot, base, count, capCount, mat) => tpl(`stk-${slot}-${count}-${capCount}-${mat}`, () => richWaferStack(cam, base, {
    count, capCount, w: slot === "orch" ? 13 : 10.5, d: slot === "orch" ? 13 : 10.5,
    sliceH: 2.0, gap: 0.65, material: mat, postSide: slot === "orch" ? 1 : -1,
  }));
  // Pre-rendered shuttles centred at world origin [0,0,0], moved by 2D screen translate
  const oScreen = S([0, 0, 0]);
  const shuttleTpl = (kind) => tpl(`sh-${kind}`, () => richShuttleSvg(cam, kind));
  const conduitTpl = (key, pts, active, tone) => tpl(`c-${key}-${active ? 1 : 0}-${tone}`, () => conduitSvg(cam, pts, { active, tone }));
  const retryArcTpl = (mono, active) => tpl(`rarc-${mono ? 1 : 0}-${active ? 1 : 0}`, () => retryArcSvg(cam, mono ? ROUTES.retryArcMono : ROUTES.retryArcOrch, active));

  // Fixed anchor table for tracking callout leaders
  const at = {
    orchestrator: S([POS.orch[0] - 10, POS.orch[1] + 4, POS.zCtrl + 11]),
    rootStack: S([POS.orchStack[0] + 6, POS.orchStack[1] - 4, POS.zCtrl + 16]),
    worker0: S([POS.workers[0][0] - 8, POS.workers[0][1], POS.zExec + 9]),
    worker1: S([POS.workers[1][0], POS.workers[1][1] - 7, POS.zExec + 9]),
    worker2: S([POS.workers[2][0] + 10, POS.workers[2][1], POS.zExec + 9]),
    workerStack: S([POS.workerStacks[0][0] - 5, POS.workerStacks[0][1] - 4, POS.zExec + 10]),
    tools: S([POS.valves[0][0] - 6, POS.valves[0][1] - 4, POS.zTools + 8]),
    retryValve: S([POS.valves[2][0] + 6, POS.valves[2][1] - 6, POS.zTools + 8]),
    verifier: S([POS.verifier[0] + 5, POS.verifier[1] + 4, POS.zTools + 12]),
    vault: S([POS.vault[0] + 8, POS.vault[1] - 4, POS.zTools + 12]),
  };

  /** Compute one 60fps frame for the given simulated run & wall-clock time tMs. */
  function pose(st) {
    const { run, tMs, showUncompressed } = st;
    const snap = snapshotAt(run, tMs);
    const items = [];
    const mono = run.mode === "monolith";
    const isRetryStep = st.k === 5;
    const anyRetryActive = snap.taskStates.some((ts) => ts.status === "retry");

    // Painter's keys: strictly ordered bottom tier (10..29) -> middle tier (30..59) -> top tier (60..89)
    items.push({ id: `${px}-deck-tools`, key: 10 });

    // Conduits on bottom/lower inter-tier
    const anyVerify = !mono && snap.verifierStatus !== "idle";
    items.push({ id: `${px}-c-v2vault`, part: "vault", key: 13, hidden: mono, href: conduitTpl("v2vault", ROUTES.verifyToVault, snap.vaultCommitted, "teal") });

    // Monolith direct self-check commit conduit (visible in monolith mode, active on synth/done)
    items.push({ id: `${px}-c-m2vault`, part: "vault", key: 14, hidden: !mono, href: conduitTpl("m2vault", ROUTES.monoToVault, snap.phase === "synth" || snap.phase === "done", "amber") });

    // Verifier Gate inspection archway (hidden in single monolithic agent!)
    items.push({ id: `${px}-verifier`, part: "verifier", key: 15, hidden: mono, href: verifierTpl(snap.verifierStatus === "disabled" ? "idle" : snap.verifierStatus) });

    // Tool valves (sorted back-left to front-right along +x)
    for (let i = 0; i < 3; i++) {
      const task = snap.taskStates[i];
      const activeTool = task && (task.status === "tool" || task.status === "retry");
      const cap = !task ? "slate" : task.status === "retry" ? "ruby" : task.status === "tool" ? "amber" : task.status === "done" ? "teal" : "slate";
      const isRetryValve = i === 2 && (isRetryStep || task?.status === "retry");
      items.push({ id: `${px}-valve-${i}`, part: isRetryValve ? "retry" : "tools", key: 18 + i, href: valveTpl(i, cap) });
      // Tool conduit: routes strictly from center blade in monolith mode, from each worker in orchestrated mode
      const cTone = task?.status === "retry" ? "ruby" : "amber";
      const routePts = mono ? ROUTES.monoTools[i] : ROUTES.tools[i];
      items.push({ id: `${px}-c-tool-${i}`, part: isRetryValve ? "retry" : "tools", key: 24 + i, href: conduitTpl(`${mono ? "mt" : "t"}${i}`, routePts, !!activeTool, cTone) });
    }

    // Shared Artifact Vault (far-right front of bottom tier: unsealed -> teal verified / amber self-check)
    const vaultMode = !snap.vaultCommitted ? "unsealed" : mono ? "selfcheck" : "verified";
    items.push({ id: `${px}-vault`, part: "vault", key: 22, href: vaultTpl(vaultMode) });

    // Return conduit from Verifier to Orchestrator (orchestrated only)
    items.push({ id: `${px}-c-v2orch`, part: "verifier", key: 28, hidden: mono, href: conduitTpl("v2orch", ROUTES.verifyToOrch, snap.phase === "synth" || snap.phase === "done", "teal") });

    // Middle tier deck (Execution Plane)
    items.push({ id: `${px}-deck-exec`, key: 32 });

    // Conduits from workers to verifier (orchestrated only; separate part="w2v" so verifier bounds stay compact)
    for (let i = 0; i < 3; i++) {
      const done = snap.taskStates[i]?.status === "done";
      items.push({ id: `${px}-c-w2v-${i}`, part: "w2v", key: 34 + i, hidden: mono, href: conduitTpl(`w2v${i}`, ROUTES.toVerifier[i], done && (anyVerify || tMs >= run.workEnd - 250), "teal") });
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
      const isRetryBlade = isRetryStep ? (mono ? i === 1 : i === 2) : status === "retry";
      const partName = dimmed ? "idleLane" : isRetryBlade ? "retry" : "workers";
      items.push({ id: `${px}-blade-${i}`, part: partName, key: 40 + i * 2, href: bladeTpl(i, beacon, dimmed) });

      // Local isolated context stack (hidden in monolith since all tokens go to the single root stack!)
      const localTok = mono ? 0 : Math.max(0, ...laneTasks.map((ts) => ts.localTokens));
      const wCount = dimmed || mono ? 0 : Math.min(14, run.wafersFor(localTok));
      const sMat = status === "retry" ? "amber" : status === "done" ? "teal" : "cobalt";
      items.push({
        id: `${px}-wstk-${i}`,
        part: !mono && isRetryStep && i === 2 ? "retry" : "context",
        key: 41 + i * 2,
        hidden: dimmed || mono,
        href: stackTpl(`w${i}`, POS.workerStacks[i], wCount, capW, sMat),
      });
    }

    // Bold dashed ruby retry arc looping strictly between Search blade and Search Runner valve
    const showRetryArc = isRetryStep || anyRetryActive;
    items.push({
      id: `${px}-c-retry-arc`,
      part: "retry",
      key: 49,
      hidden: !showRetryArc,
      href: retryArcTpl(mono, anyRetryActive || isRetryStep),
    });

    // Dispatch conduits from Orchestrator down to Workers (only center lane in monolith)
    for (let i = 0; i < 3; i++) {
      const t = snap.taskStates[i];
      const active = !mono ? !!(t && t.status !== "idle") : i === 1 && snap.phase !== "plan";
      const tone = t?.status === "retry" ? "ruby" : t?.status === "done" ? "teal" : "cobalt";
      items.push({ id: `${px}-c-disp-${i}`, part: "dispatch", key: 52 + i, hidden: mono && i !== 1, href: conduitTpl(`d${i}`, ROUTES.dispatch[i], active, tone) });
    }

    // Top tier deck (Control Plane)
    items.push({ id: `${px}-deck-ctrl`, key: 60 });

    // Orchestrator Hub (cobalt for Plan/Think/Synth, teal when done; orange live dial needle)
    const hubMat = snap.phase === "done" ? "teal" : "cobalt";
    const dialBin = Math.floor(((tMs / 180) % 16 + 16) % 16);
    items.push({ id: `${px}-hub`, part: "orchestrator", key: 65, href: hubTpl(hubMat, dialBin) });

    // Root Context Window Stack (physically bursts past red 32k collar if uncompressed or monolith!)
    const shownOrchTok = showUncompressed ? run.rawPeakIfUncompressed : snap.orchTokens;
    const orchWafers = Math.min(15, run.wafersFor(shownOrchTok));
    const orchMat = shownOrchTok > run.contextCliff ? "cobalt" : (!mono && tMs >= run.workEnd) ? "teal" : "cobalt";
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
      let pt = null, kind = "dispatch", partName = "dispatch";
      const toolRoute = mono ? ROUTES.monoTools[i] : ROUTES.tools[i];
      if (sh) {
        if (sh.kind === "dispatch") {
          pt = samplePath(ROUTES.dispatch[laneIdx], sh.u).point;
          kind = "dispatch";
          partName = "dispatch";
        } else if (sh.kind === "toolOut") {
          pt = samplePath(toolRoute, sh.u).point;
          kind = "raw";
          partName = isRetryStep && i === 2 ? "retry" : "tools";
        } else if (sh.kind === "toolBack") {
          pt = samplePath(toolRoute, 1 - sh.u).point;
          kind = "raw";
          partName = isRetryStep && i === 2 ? "retry" : "tools";
        } else if (sh.kind === "retry") {
          // Orbit the dedicated bounded ruby retry arc during the retry turn!
          const arc = mono ? ROUTES.retryArcMono : ROUTES.retryArcOrch;
          pt = samplePath(arc, sh.u).point;
          kind = "retry";
          partName = "retry";
        } else if (sh.kind === "return") {
          // Compact teal distilled summary rising UP return conduit to Orchestrator
          pt = samplePath(ROUTES.dispatch[laneIdx], 1 - sh.u).point;
          kind = "summary";
          partName = st.k === 4 ? "context" : "dispatch";
        }
      } else if (!mono && st.k === 4 && tMs >= run.workEnd - 150 && tMs <= run.workEnd + 460) {
        // Show all three compact teal summaries gliding up the return conduits at fan-in!
        const frac = Math.max(0.08, Math.min(0.92, (tMs - (run.workEnd - 150) + i * 70) / 620));
        pt = samplePath(ROUTES.dispatch[laneIdx], 1 - frac).point;
        kind = "summary";
        partName = "context";
      }
      if (pt) {
        const sc = S(pt);
        items.push({
          id: `${px}-sh-${i}`,
          part: partName,
          key: 80 + i,
          href: shuttleTpl(kind),
          transform: `translate(${n1(sc[0] - oScreen[0])} ${n1(sc[1] - oScreen[1])})`,
        });
      } else {
        items.push({ id: `${px}-sh-${i}`, key: 80 + i, hidden: true });
      }
    }

    // Compact teal summary shuttles converging along toVerifier conduits into Verifier gate
    for (let i = 0; i < 3; i++) {
      const showW2V = !mono && tMs >= run.workEnd - 100 && tMs < run.verifyStart + 650;
      if (showW2V) {
        const u = Math.max(0.05, Math.min(0.96, (tMs - (run.workEnd - 100) + i * 80) / 720));
        const sc = S(samplePath(ROUTES.toVerifier[i], u).point);
        items.push({
          id: `${px}-sh-w2v-${i}`,
          part: "w2v",
          key: 74 + i,
          href: shuttleTpl("summary"),
          transform: `translate(${n1(sc[0] - oScreen[0])} ${n1(sc[1] - oScreen[1])})`,
        });
      } else {
        items.push({ id: `${px}-sh-w2v-${i}`, key: 74 + i, hidden: true });
      }
    }

    // Verifier -> Orchestrator synthesis summary shuttle (orchestrated) or Core -> Vault self-check shuttle (monolith)
    if (!mono && (snap.phase === "synth" || (st.k === 6 && snap.phase === "done"))) {
      const u = snap.phase === "done"
        ? 0.72
        : Math.max(0.05, Math.min(0.95, (tMs - run.synthStart) / Math.max(1, run.synthEnd - run.synthStart)));
      const sc = S(samplePath(ROUTES.verifyToOrch, u).point);
      items.push({
        id: `${px}-sh-synth`,
        part: "verifier",
        key: 85,
        href: shuttleTpl("summary"),
        transform: `translate(${n1(sc[0] - oScreen[0])} ${n1(sc[1] - oScreen[1])})`,
      });
    } else if (mono && (snap.phase === "synth" || (st.k === 6 && snap.phase === "done"))) {
      const u = snap.phase === "done"
        ? 0.78
        : Math.max(0.05, Math.min(0.95, (tMs - run.synthStart) / Math.max(1, run.synthEnd - run.synthStart)));
      const sc = S(samplePath(ROUTES.monoToVault, u).point);
      items.push({
        id: `${px}-sh-synth`,
        part: "vault",
        key: 85,
        href: shuttleTpl("raw"),
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
  // Opaque stage halo pad behind View A so zoomed peripheral 3D lines never visually bleed into the frame
  const halo = `<rect class="lens-backdrop" x="${n1(box.x - 90)}" y="${n1(box.y - 100)}" width="${n1(box.w + 180)}" height="${n1(box.h + 200)}" rx="120"/>`;
  return halo
    + inspectorFrame(box, "VIEW A · TRACE & CONTEXT", sub)
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
