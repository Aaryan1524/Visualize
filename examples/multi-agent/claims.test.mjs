// node --test examples/multi-agent/claims.test.mjs
//
// Verifies that every audited claim, coverage topic, voice script, and camera shot
// in examples/multi-agent/ matches model.mjs and figure.mjs geometry.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS } from "./model.mjs";
import { cameraFor, figure } from "./figure.mjs";
import { script } from "./voice.mjs";
import { cameraKit } from "../../src/drawing/camera.mjs";
import { LOOK, longestSameRun } from "../../scripts/lib/look.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const AUDIT_PATH = join(ROOT, "dist", "multi-agent.audit.json");
const REVIEW_PATH = join(HERE, "review.json");

test("multi-agent claims: audited numbers hold in model.mjs", () => {
  const orch = MODELS.orchestrated.N;
  const mono = MODELS.monolith.N;
  assert.equal(orch.cleanTotalS, 6.4);
  assert.equal(mono.cleanTotalS, 10.6);
  assert.equal(orch.speedup, 1.66);
  assert.equal(orch.workCleanS, 3.4);
  assert.equal(orch.sumWorkS, 8.6);
  assert.equal(orch.peakWorker, 18.0);
  assert.equal(orch.fanInContext, 8.6);
  assert.equal(orch.orchContext, 11.0);
  assert.equal(orch.uncompressedFanIn, 50.0);
  assert.equal(orch.uncompressedOrch, 52.4);
  assert.equal(orch.aggregateTokens, 64.4);
  assert.equal(mono.aggregateTokens, 52.4);
  assert.equal(orch.retryOverlapS, 1.2);
  assert.equal(orch.overlapSavedS, 0.8);
  assert.equal(orch.faultDeltaS, 0.9);
  assert.equal(orch.faultTotalS, 7.3);
  assert.equal(mono.faultDeltaS, 1.7);
  assert.equal(mono.faultTotalS, 12.3);
  assert.equal(mono.faultOrchContext, 54.4);
});

test("multi-agent claims: narration scripts carry distinct variant wording without contradictions", () => {
  const orchLines = script(MODELS.orchestrated);
  const monoLines = script(MODELS.monolith);
  assert.equal(orchLines.length, 7);
  assert.equal(monoLines.length, 7);
  const plain = (s) => s.replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1");
  for (let k = 0; k < 7; k++) {
    assert.notEqual(plain(orchLines[k]), plain(monoLines[k]), `step ${k} voice should differ between variants`);
    assert.ok(!/\b(orchestrator|coordinator)\b/i.test(plain(monoLines[k])), `monolith step ${k} must not speak orchestrator/coordinator`);
  }
  assert.ok(orchLines[0].includes("6.4 seconds"));
  assert.ok(monoLines[0].includes("10.6 seconds"));
  assert.ok(orchLines[4].includes("8.6 thousand tokens"));
  assert.ok(monoLines[4].includes("50.0 thousand tokens"));
});

test("multi-agent claims: built audit report has zero problems and current review stamp", () => {
  if (!existsSync(AUDIT_PATH)) execFileSync(process.execPath, [join(HERE, "build.mjs")], { cwd: ROOT, stdio: "pipe" });
  assert.ok(existsSync(AUDIT_PATH), "dist/multi-agent.audit.json must exist after build.mjs");
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
  const review = JSON.parse(readFileSync(REVIEW_PATH, "utf8"));
  assert.deepEqual(audit.problems, []);
  assert.equal(audit.review, "current");
  assert.equal(audit.stamp, review.stamp);
  assert.ok(audit.claims.length >= 8);
});

test("multi-agent camera: per-step shots satisfy sameRun, subjectSpan, bounds sanity, and clear-area separation", () => {
  const CAM = cameraKit();
  const VBH = 6550;
  const BOX = { x: 2720, y: 580, w: 5580, h: 5400 };
  const CLEAR = { x0: 3260, y0: 180, x1: 8800, y1: 6370 };
  const LENS = { x0: 9040, y0: 200, x1: 14100, y1: 4260 };
  const STEPS = [
    {},
    {},
    { shot: ["orchestrator", "dispatch"], around: ["workers"] },
    { shot: ["workers", "tools"] },
    { shot: ["context"] },
    { shot: ["retry"] },
    { shot: ["commit"] },
  ];
  const POSE = [0.62, 0.45, 0.92, 1.0, 0.72, 0.56, 1.0];
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const lerp = (a, b, f) => a + (b - a) * f;

  function bboxOfSvg(svg, tx = 0, ty = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of svg.matchAll(/\bd="([^"]+)"/g)) {
      const nums = m[1].match(/-?\d+(?:\.\d+)?/g);
      if (!nums) continue;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = +nums[i] + tx, y = +nums[i + 1] + ty;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
  }

  const cam = cameraFor(BOX);
  for (const mode of ["orchestrated", "monolith"]) {
    const M = MODELS[mode];
    const fig = figure(cam, { prefix: "ma" });
    const defMap = new Map();
    const partMap = new Map(fig.parts.map((p) => [p.id, { part: p.part, svg: p.svg }]));
    const expand = (names) => names.flatMap((n) => (
      n === "commit" ? (mode === "monolith" ? ["orchestrator", "vault"] : ["verifier", "vault", "orchestrator"]) : [n]
    ));

    const ms = [];
    for (let k = 0; k < STEPS.length; k++) {
      const run = k === 5 ? M.withFault : M.clean;
      const u = POSE[k];
      let tMs = run.totalMs;
      if (k === 0) tMs = lerp(0, run.totalMs, ease(u));
      else if (k === 1) tMs = lerp(run.planEnd * 0.6, run.planEnd + 1600, ease(u));
      else if (k === 2) tMs = lerp(0, run.planEnd + 700, ease(u));
      else if (k === 3) tMs = lerp(run.planEnd, mode === "monolith" ? run.planEnd + 3200 : run.workEnd - 150, ease(u));
      else if (k === 4) tMs = lerp(run.workEnd - 300, run.workEnd + (mode === "monolith" ? 0 : 420), ease(u));
      else if (k === 5) {
        const ft = run.tasks.find((x) => x.faults > 0) || run.tasks[run.tasks.length - 1];
        tMs = lerp(ft.toolEnd - 650, ft.retryEnd + 250, ease(u));
      } else if (k === 6) tMs = lerp(mode === "monolith" ? run.synthStart : run.verifyStart, run.totalMs, ease(u));

      const out = fig.pose({ run, tMs, k, u });
      for (const d of out.defs) {
        const id = d.match(/id="([^"]+)"/)?.[1];
        if (id) defMap.set("#" + id, d);
      }
      const byPart = new Map();
      let F = null;
      for (const it of out.items) {
        if (it.hidden) continue;
        let tx = 0, ty = 0;
        const tm = it.transform?.match(/translate\(([^ ]+) ([^)]+)\)/);
        if (tm) ((tx = +tm[1]), (ty = +tm[2]));
        const svg = it.href ? defMap.get(it.href) : partMap.get(it.id)?.svg;
        const part = it.part ?? partMap.get(it.id)?.part;
        const b = svg && bboxOfSvg(svg, tx, ty);
        if (!b) continue;
        F = CAM.union(F, b);
        if (part) byPart.set(part, CAM.union(byPart.get(part), b));
      }
      const boundsOf = (names) => expand(names).reduce((acc, n) => CAM.union(acc, byPart.get(n) ?? null), null);
      const step = STEPS[k];
      const shot = step.shot ? CAM.frame(boundsOf(step.shot), CLEAR, { keep: boundsOf([...step.shot, ...(step.around ?? [])]) }) : CAM.ID;
      if (k > 0) ms.push(shot);

      if (step.shot) {
        const bSub = boundsOf(step.shot);
        assert.ok(bSub, `${mode} step ${k} shot must have bounds`);
        const scr = CAM.onScreen(shot, bSub);
        assert.ok(scr.x0 >= CLEAR.x0 - 1 && scr.x1 <= CLEAR.x1 + 1, `${mode} step ${k} subject stays in CLEAR x`);
        assert.ok(scr.y0 >= CLEAR.y0 - 1 && scr.y1 <= CLEAR.y1 + 1, `${mode} step ${k} subject stays in CLEAR y`);
        assert.ok(scr.x1 < LENS.x0, `${mode} step ${k} subject never collides with View A`);
        const span = Math.max(scr.x1 - scr.x0, scr.y1 - scr.y0) / VBH;
        assert.ok(span >= LOOK.subjectSpan, `${mode} step ${k} subjectSpan ${span.toFixed(2)} >= ${LOOK.subjectSpan}`);
        const FW = F.x1 - F.x0, FH = F.y1 - F.y0;
        for (const n of step.shot) {
          const bn = boundsOf([n]);
          assert.ok((bn.x1 - bn.x0) * (bn.y1 - bn.y0) <= 0.5 * FW * FH, `${mode} step ${k} "${n}" bounds <= 50% of figure`);
        }
      }
    }
    const run = longestSameRun(ms, CLEAR);
    assert.ok(run.len <= LOOK.sameRun, `${mode} sameRun ${run.len} <= ${LOOK.sameRun}`);
  }
});
