#!/usr/bin/env node
// Automated Headless Chrome Visual QA & Strict Content Correctness Gate for Studio pages.
//
//   node scripts/check-studio.mjs <page.html> [--shots <dir>] [--fast] [--all-steps]
//
// Exits 0 with "studio: passed" when every invariant holds, or exits 1 listing every failure.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { chromePath } from "./lib/browser.mjs";

export const BAD_VALUE_RE = /(?:^|[^A-Za-z0-9_])(?:-?Infinity|NaN|undefined)(?:$|[^A-Za-z0-9_])/;

export function normalizeEngineId(engine) {
  if (!engine) return "A";
  const norm = String(engine).trim().toLowerCase();
  if (norm === "c" || norm === "engine-c" || norm === "engine_c" || norm === "2d") return "C";
  return "A";
}

/**
 * Strict telemetry hygiene predicate.
 * Rejects null/undefined, blank/whitespace-only strings, any `?` placeholder (e.g. `?`, `? %`),
 * and any NaN / undefined / Infinity / -Infinity token.
 */
export function isBadTelemetryValue(value) {
  if (value === null || value === undefined) return true;
  const str = String(value).trim();
  if (str.length === 0) return true;
  if (str.includes("?")) return true;
  if (BAD_VALUE_RE.test(str)) return true;
  return false;
}

function boxesOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/**
 * Checks whether any rendered callout box overlaps visible Director chrome
 * (`#sd-subtitle`, `#sd-challenge`, `.sd-dock`) beyond `tolerance` pixels on both axes.
 */
export function checkCalloutChromeOverlap(callouts, chromeRects, tolerance = 2) {
  const conflicts = [];
  if (!Array.isArray(callouts) || !Array.isArray(chromeRects)) return conflicts;

  for (const box of callouts) {
    if (!box || !(box.w > 0) || !(box.h > 0)) continue;
    for (const chrome of chromeRects) {
      if (!chrome || !(chrome.w > 0) || !(chrome.h > 0)) continue;
      const overlapX = Math.min(box.x + box.w, chrome.x + chrome.w) - Math.max(box.x, chrome.x);
      const overlapY = Math.min(box.y + box.h, chrome.y + chrome.h) - Math.max(box.y, chrome.y);
      if (overlapX > tolerance && overlapY > tolerance) {
        conflicts.push({
          calloutLabel: box.label ?? "",
          calloutTarget: box.target ?? "",
          chromeName: chrome.name ?? "chrome",
          overlapX: Math.round(overlapX * 10) / 10,
          overlapY: Math.round(overlapY * 10) / 10,
          message: `callout "${box.label ?? box.target ?? ""}" overlaps ${chrome.name ?? "chrome"} by ${Math.round(overlapX)}x${Math.round(overlapY)}px`,
        });
      }
    }
  }
  return conflicts;
}

/**
 * Identifies keys whose default values differ across variants.
 */
export function computeVariantKeys(variants) {
  if (!Array.isArray(variants) || variants.length < 2) return [];
  const allKeys = new Set();
  for (const v of variants) {
    if (v?.defaults && typeof v.defaults === "object") {
      for (const k of Object.keys(v.defaults)) allKeys.add(k);
    }
  }
  const diffKeys = [];
  const firstDefaults = variants[0]?.defaults || {};
  for (const k of allKeys) {
    const first = firstDefaults[k];
    if (variants.some((v) => v?.defaults?.[k] !== first)) {
      diffKeys.push(k);
    }
  }
  return diffKeys;
}

/**
 * Fails if ANY step's `sim` patch explicitly overrides a distinguishing variant key,
 * preventing active variant pill desync.
 */
export function checkVariantOverrideConflict(stepsMeta, variantKeys) {
  const conflicts = [];
  const keySet =
    variantKeys instanceof Set
      ? variantKeys
      : new Set(Array.isArray(variantKeys) ? variantKeys : []);
  if (keySet.size === 0 || !Array.isArray(stepsMeta)) return conflicts;

  for (let i = 0; i < stepsMeta.length; i++) {
    const step = stepsMeta[i];
    if (!step) continue;
    const stepIdx = typeof step.step === "number" ? step.step : i;
    const simKeys = Array.isArray(step.simKeys)
      ? step.simKeys
      : step.sim && typeof step.sim === "object"
        ? Object.keys(step.sim)
        : [];
    for (const key of simKeys) {
      if (keySet.has(key)) {
        conflicts.push({
          step: stepIdx,
          key,
          message: `step ${stepIdx}: step.sim explicitly overrides variant key "${key}" (causes variant pill desync)`,
        });
      }
    }
  }
  return conflicts;
}

/**
 * Pure step-level correctness & content audit.
 * Used both by headless Chrome QA (`auditViewport`) and unit tests (`check-studio.test.mjs`).
 */
export function auditStepMeta(stepMeta, context = {}) {
  const failures = [];
  if (!stepMeta || typeof stepMeta !== "object") return failures;

  const stepIdx = typeof stepMeta.step === "number" ? stepMeta.step : 0;
  const prefix = `step ${stepIdx}`;
  const engine = normalizeEngineId(context.engine);
  const maxCallouts = engine === "C" ? 1 : 2;

  // 1. Raw callout budget (BEFORE silent truncation)
  const declaredCallouts = Array.isArray(stepMeta.callouts) ? stepMeta.callouts : [];
  const rawCalloutCount =
    typeof stepMeta.rawCalloutCount === "number"
      ? stepMeta.rawCalloutCount
      : declaredCallouts.length;
  if (rawCalloutCount > maxCallouts) {
    failures.push(
      `${prefix}: raw callout budget exceeded for Engine ${engine} (${rawCalloutCount} > ${maxCallouts})`,
    );
  }

  // 2. Strict ID validation against registeredIds (focus, reveal, callout targets)
  const registeredSet =
    context.registeredIds instanceof Set
      ? context.registeredIds
      : Array.isArray(context.registeredIds) && context.registeredIds.length > 0
        ? new Set(context.registeredIds)
        : null;

  if (registeredSet && registeredSet.size > 0) {
    for (const id of Array.isArray(stepMeta.focus) ? stepMeta.focus : []) {
      if (!registeredSet.has(id)) {
        failures.push(`${prefix}: unknown focus ID "${id}" (not in registeredIds)`);
      }
    }
    for (const id of Array.isArray(stepMeta.reveal) ? stepMeta.reveal : []) {
      if (!registeredSet.has(id)) {
        failures.push(`${prefix}: unknown reveal ID "${id}" (not in registeredIds)`);
      }
    }
    for (const c of declaredCallouts) {
      const target = typeof c === "string" ? c : c?.target;
      if (target && !registeredSet.has(target)) {
        failures.push(`${prefix}: unknown callout target "${target}" (not in registeredIds)`);
      }
    }
  }

  // 3. Strict camera preset validation
  const presetSet =
    context.cameraPresets instanceof Set
      ? context.cameraPresets
      : Array.isArray(context.cameraPresets) && context.cameraPresets.length > 0
        ? new Set(context.cameraPresets)
        : null;
  const cameraPreset = stepMeta.cameraPreset ?? stepMeta.camera?.preset;
  if (presetSet && presetSet.size > 0 && typeof cameraPreset === "string" && cameraPreset.length > 0) {
    if (!presetSet.has(cameraPreset)) {
      failures.push(`${prefix}: unknown camera preset "${cameraPreset}" (not in cameraPresets)`);
    }
  }

  // 4. Rendered callout visibility, bounds, pairwise overlap & chrome overlap
  if (Array.isArray(stepMeta.visibleCallouts)) {
    const visibleCallouts = stepMeta.visibleCallouts;
    if (visibleCallouts.length > maxCallouts) {
      failures.push(
        `${prefix}: visible callout budget exceeded for Engine ${engine} (${visibleCallouts.length} > ${maxCallouts})`,
      );
    }

    const expectedCount = Math.min(declaredCallouts.length, 2);
    if (visibleCallouts.length < expectedCount) {
      const visibleTargets = new Set(visibleCallouts.map((c) => c?.target).filter(Boolean));
      const missing = declaredCallouts
        .slice(0, expectedCount)
        .map((c) => (typeof c === "string" ? c : c?.target))
        .filter((t) => t && !visibleTargets.has(t));
      const detail = missing.length ? ` (missing anchors: ${missing.join(", ")})` : "";
      failures.push(
        `${prefix}: expected ${expectedCount} visible callout(s) but only ${visibleCallouts.length} projected on screen${detail}`,
      );
    }

    const vw = context.viewport?.width;
    const vh = context.viewport?.height;
    for (const box of visibleCallouts) {
      if (
        !Number.isFinite(box.x) ||
        !Number.isFinite(box.y) ||
        !Number.isFinite(box.w) ||
        !Number.isFinite(box.h) ||
        box.w <= 0 ||
        box.h <= 0
      ) {
        failures.push(`${prefix}: callout "${box.label}" has invalid box ${JSON.stringify(box)}`);
      } else if (
        Number.isFinite(vw) &&
        Number.isFinite(vh) &&
        (box.x < -1 || box.y < -1 || box.x + box.w > vw + 1 || box.y + box.h > vh + 1)
      ) {
        failures.push(
          `${prefix}: callout "${box.label}" out of viewport (${box.x},${box.y} ${box.w}x${box.h} in ${vw}x${vh})`,
        );
      }
    }

    for (let i = 0; i < visibleCallouts.length; i++) {
      for (let j = i + 1; j < visibleCallouts.length; j++) {
        if (boxesOverlap(visibleCallouts[i], visibleCallouts[j])) {
          failures.push(
            `${prefix}: callout overlap between "${visibleCallouts[i].label}" and "${visibleCallouts[j].label}"`,
          );
        }
      }
    }

    if (Array.isArray(stepMeta.chromeRects) && stepMeta.chromeRects.length > 0) {
      const chromeConflicts = checkCalloutChromeOverlap(
        visibleCallouts,
        stepMeta.chromeRects,
        context.chromeTolerance ?? 2,
      );
      for (const c of chromeConflicts) {
        failures.push(`${prefix}: ${c.message}`);
      }
    }
  }

  // 5. Strict telemetry hygiene (zero blank, `?`, NaN/undefined/Infinity)
  for (const item of Array.isArray(stepMeta.telemetry) ? stepMeta.telemetry : []) {
    if (isBadTelemetryValue(item?.value)) {
      failures.push(
        `${prefix}: telemetry "${item?.id ?? "unknown"}" has invalid/blank/placeholder value ("${item?.value ?? ""}")`,
      );
    }
    if (item?.label != null && BAD_VALUE_RE.test(String(item.label))) {
      failures.push(`${prefix}: telemetry "${item?.id ?? "unknown"}" label contains invalid token ("${item.label}")`);
    }
  }

  // 6. Variant-key override conflict (when variantKeys passed into context)
  if (context.variantKeys) {
    const conflicts = checkVariantOverrideConflict([stepMeta], context.variantKeys);
    for (const c of conflicts) {
      failures.push(c.message);
    }
  }

  // 7. TryOut challenge compilation & non-trivial arrival state
  if (stepMeta.tryOutCompiledOk === false) {
    failures.push(`${prefix}: tryOut checkSrc failed to compile`);
  }
  if (stepMeta.hasTryOut && stepMeta.challengeVerifiedOnArrival === true) {
    failures.push(`${prefix}: tryOut challenge is already verified on initial arrival (trivially pre-solved)`);
  }

  return failures;
}

/**
 * Extracts and parses the embedded `STUDIO_CONFIG` JSON object from a standalone Studio HTML page.
 * Returns null if not found or invalid JSON.
 */
export function parseStudioConfigFromHtml(html) {
  if (typeof html !== "string") return null;
  const marker = "const STUDIO_CONFIG = ";
  const startIdx = html.indexOf(marker);
  if (startIdx < 0) return null;
  const jsonStart = html.indexOf("{", startIdx + marker.length);
  if (jsonStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(jsonStart, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

export function parseArgs(argv) {
  let file = null;
  let shotsDir = null;
  let fast = false;
  let allSteps = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--shots") {
      shotsDir = argv[++i] ?? null;
    } else if (arg === "--fast") {
      fast = true;
    } else if (arg === "--all-steps") {
      allSteps = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(
        "Usage: node scripts/check-studio.mjs <page.html> [--shots <dir>] [--fast] [--all-steps]",
      );
      process.exit(0);
    } else if (!arg.startsWith("--") && !file) {
      file = arg;
    }
  }
  return { file, shotsDir, fast, allSteps };
}

async function launchStudioChrome() {
  try {
    return await puppeteer.launch({
      executablePath: chromePath(),
      headless: true,
      args: [
        "--allow-file-access-from-files",
        "--font-render-hinting=none",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
  } catch (e) {
    const hint =
      "Chrome could not start. If running inside a sandbox, run this command outside the sandbox or in a normal terminal.";
    throw new Error(`${e?.message ?? e}\n${hint}`, { cause: e });
  }
}

async function settleFrames(page, frames = 4) {
  await page.evaluate(
    (n) =>
      new Promise((resolveFrame) => {
        let count = 0;
        const step = () => {
          count += 1;
          if (count >= n) resolveFrame();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    frames,
  );
}

async function waitForTransition(page, ms = 360) {
  await new Promise((r) => setTimeout(r, ms));
  await settleFrames(page, 4);
}

async function checkCanvasNonBlank(page) {
  const canvasEl = await page.$("#studio-canvas");
  if (!canvasEl) {
    return { ok: false, reason: "Missing #studio-canvas element." };
  }

  const box = await canvasEl.boundingBox();
  if (!box || box.width <= 400 || box.height <= 300) {
    const w = box ? Math.round(box.width) : 0;
    const h = box ? Math.round(box.height) : 0;
    return { ok: false, reason: `Canvas dimensions too small (${w}x${h}, require >400x300).` };
  }

  const b64 = await canvasEl.screenshot({ encoding: "base64" });
  const analysis = await page.evaluate(async (pngBase64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${pngBase64}`;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    const w = 160;
    const h = 100;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Measure color variety against the top-left background pixel.
    const r0 = data[0];
    const g0 = data[1];
    const b0 = data[2];
    let diffPixels = 0;
    const buckets = new Set();
    const total = w * h;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const delta = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);
      if (delta > 14) diffPixels += 1;
      buckets.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
    return {
      diffRatio: diffPixels / total,
      colorBuckets: buckets.size,
    };
  }, b64);

  if (analysis.diffRatio < 0.004 || analysis.colorBuckets < 3) {
    return {
      ok: false,
      reason: `Canvas appears blank or flat (${(analysis.diffRatio * 100).toFixed(2)}% non-bg pixels, ${analysis.colorBuckets} color buckets).`,
    };
  }

  return { ok: true, width: Math.round(box.width), height: Math.round(box.height), ...analysis };
}

function snapMid(min, max, step) {
  const raw = (min + max) / 2;
  if (!Number.isFinite(step) || step <= 0) return raw;
  const snapped = min + Math.round((raw - min) / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
}

async function restoreInitialState(page, defaultVariant) {
  await page.evaluate((vName) => {
    window.__studio.toggleControls?.(false);
    if (vName) window.__studio.setVariant(vName);
    window.__studio.setTheme("light");
    window.__studio.seekStep(0);
  }, defaultVariant);
  await settleFrames(page, 4);
}

async function auditViewport(browser, url, vp, { shotsDir, allSteps, parsedConfig }) {
  const failures = [];
  const savedShots = [];
  let stepCount = 0;
  let variantNames = [];

  const page = await browser.newPage();
  const runtimeErrors = [];

  page.on("pageerror", (err) => {
    runtimeErrors.push(`pageerror: ${err?.message ?? String(err)}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      runtimeErrors.push(`console.error: ${msg.text()}`);
    }
  });

  await page.evaluateOnNewDocument(() => {
    window.__studioQaRejections = [];
    window.addEventListener("unhandledrejection", (ev) => {
      const reason = ev?.reason;
      window.__studioQaRejections.push(
        reason && typeof reason === "object" && "message" in reason
          ? String(reason.message)
          : String(reason),
      );
    });
  });

  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });

  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.__studio), { timeout: 6000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await settleFrames(page, 6);

    // 1. Contract & Diagnostics check
    const contract = await page.evaluate(() => {
      const s = window.__studio;
      if (!s) return { present: false, missing: ["window.__studio"] };
      const missing = [];
      for (const fn of ["seekStep", "setVariant", "setSim", "setTheme", "state"]) {
        if (typeof s[fn] !== "function") missing.push(`__studio.${fn}`);
      }
      const steps = Array.isArray(s.steps) ? s.steps : [];
      const variants = [...document.querySelectorAll(".sd-variant-btn")]
        .map((b) => b.dataset.variant)
        .filter(Boolean);
      const domControls = [...document.querySelectorAll("input[data-control]")].map((el) => ({
        id: el.dataset.control,
        min: Number(el.min),
        max: Number(el.max),
        step: Number(el.step) || 0,
      }));
      const diag = typeof s.diagnostics === "function" ? s.diagnostics() : null;
      const detectedEngine = diag?.engine || (document.querySelector("svg.ec-svg") ? "C" : "A");

      // Verify tryOut checkSrc compilation as a fallback if diagnostics() doesn't report it
      const compiledTryOut = steps.map((st) => {
        if (!st?.tryOut) return null;
        const src = st.tryOut.checkSrc;
        if (!src) return false;
        try {
          const fn = new Function("return (" + src + ");")();
          return typeof fn === "function";
        } catch {
          return false;
        }
      });

      return {
        present: true,
        missing,
        stepsLen: steps.length,
        steps,
        variants,
        domControls,
        diag,
        detectedEngine,
        compiledTryOut,
      };
    });

    if (!contract.present || contract.missing.length) {
      failures.push(`[${vp.label}] Missing Studio contract: ${contract.missing.join(", ")}`);
      return { failures, savedShots, stepCount, variantNames };
    }
    if (contract.stepsLen < 2) {
      failures.push(`[${vp.label}] Expected steps.length >= 2, got ${contract.stepsLen}`);
    }
    stepCount = contract.stepsLen;
    variantNames = contract.variants;
    const defaultVariant = variantNames[0] ?? null;
    const engine = normalizeEngineId(contract.detectedEngine);
    const diag = contract.diag || {};
    const diagStepsMeta = Array.isArray(diag.stepsMeta) ? diag.stepsMeta : [];
    const parsedSteps = Array.isArray(parsedConfig?.steps) ? parsedConfig.steps : [];

    // Variant-key override conflict check (prevents variant pill desync)
    const variantKeys =
      Array.isArray(diag.variantKeys) && diag.variantKeys.length > 0
        ? diag.variantKeys
        : computeVariantKeys(diag.variants ?? parsedConfig?.variants ?? []);
    const stepsForVariantCheck = Array.from({ length: stepCount }, (_, idx) => {
      const dStep = diagStepsMeta[idx];
      const pStep = parsedSteps[idx];
      const sStep = contract.steps[idx];
      return {
        step: idx,
        sim: dStep?.sim ?? pStep?.sim ?? sStep?.sim ?? {},
        simKeys: dStep?.simKeys,
      };
    });
    for (const conflict of checkVariantOverrideConflict(stepsForVariantCheck, variantKeys)) {
      failures.push(`[${vp.label}] ${conflict.message}`);
    }

    // Resolve controls list
    const controls = (
      Array.isArray(diag.controls) && diag.controls.length > 0
        ? diag.controls
        : Array.isArray(parsedConfig?.controls) && parsedConfig.controls.length > 0
          ? parsedConfig.controls
          : contract.domControls
    ).filter((c) => c && c.id && Number.isFinite(Number(c.min)) && Number.isFinite(Number(c.max)));

    // 2. Canvas dimensions & non-blank visual content
    const canvasRes = await checkCanvasNonBlank(page);
    if (!canvasRes.ok) {
      failures.push(`[${vp.label}] ${canvasRes.reason}`);
    }

    // 3. Step-by-step walk: raw callout budget, anchor visibility, registered IDs, camera presets,
    //    telemetry hygiene, callout/chrome overlap, challenge compile & non-trivial arrival
    const tryOutStepIndices = [];

    for (let k = 0; k < stepCount; k++) {
      await page.evaluate((idx) => window.__studio.seekStep(idx), k);
      await settleFrames(page, 6);

      const snap = await page.evaluate(() => {
        const st = window.__studio.state();
        const liveDiag =
          typeof window.__studio.diagnostics === "function" ? window.__studio.diagnostics() : null;
        const subEl = document.getElementById("sd-subtitle");
        const subTextEl = document.getElementById("sd-subtitle-text");
        const chEl = document.getElementById("sd-challenge");
        const chPrompt = document.getElementById("sd-challenge-prompt");
        const chStatus = document.getElementById("sd-challenge-status");
        const telEl = document.getElementById("sd-telemetry");

        const isVisibleEl = (el) => {
          if (!el || el.hidden) return false;
          const cs = window.getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) {
            return false;
          }
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };

        const chromeRects = [];
        for (const [selector, name] of [
          ["#sd-subtitle", "#sd-subtitle"],
          ["#sd-challenge", "#sd-challenge"],
          [".sd-dock", ".sd-dock"],
        ]) {
          const el = document.querySelector(selector);
          if (isVisibleEl(el)) {
            const r = el.getBoundingClientRect();
            chromeRects.push({ name, x: r.left, y: r.top, w: r.width, h: r.height });
          }
        }

        return {
          state: st,
          liveDiag,
          vw: window.innerWidth,
          vh: window.innerHeight,
          chromeRects,
          telemetryText: telEl ? telEl.textContent || "" : "",
          subtitleText: subTextEl ? subTextEl.textContent || "" : "",
          challengeVisible: Boolean(chEl && !chEl.hidden),
          challengeText:
            chEl && !chEl.hidden
              ? `${chPrompt?.textContent || ""} ${chStatus?.textContent || ""}`
              : "",
        };
      });

      const { state, liveDiag, vw, vh, chromeRects } = snap;
      if (state.step !== k) {
        failures.push(`[${vp.label}] step ${k}: seekStep(${k}) landed on step ${state.step}`);
      }

      const dStep = liveDiag?.stepsMeta?.[k] ?? diagStepsMeta[k] ?? null;
      const pStep = parsedSteps[k] ?? null;
      const sStep = contract.steps[k] ?? {};

      const declaredCallouts = Array.isArray(dStep?.callouts)
        ? dStep.callouts
        : Array.isArray(dStep?.calloutTargets) && dStep.calloutTargets.length > 0
          ? dStep.calloutTargets.map((t) => ({ target: String(t), label: String(t) }))
          : Array.isArray(sStep.callouts)
            ? sStep.callouts
            : [];
      const rawCalloutCount =
        typeof dStep?.rawCalloutCount === "number"
          ? dStep.rawCalloutCount
          : typeof pStep?.rawCalloutCount === "number"
            ? pStep.rawCalloutCount
            : declaredCallouts.length;

      const hasTryOut = Boolean(dStep?.hasTryOut ?? sStep.tryOut);
      const tryOutCompiledOk =
        typeof dStep?.tryOutCompiledOk === "boolean"
          ? dStep.tryOutCompiledOk
          : typeof dStep?.tryOutOk === "boolean"
            ? dStep.tryOutOk
            : contract.compiledTryOut[k];

      if (hasTryOut && tryOutCompiledOk !== false) {
        tryOutStepIndices.push(k);
      }

      const stepFailures = auditStepMeta(
        {
          step: k,
          tab: sStep.tab,
          title: sStep.title,
          rawCalloutCount,
          callouts: declaredCallouts,
          visibleCallouts: Array.isArray(state.callouts) ? state.callouts : [],
          focus: dStep?.focus ?? sStep.focus ?? null,
          reveal: dStep?.reveal ?? sStep.reveal ?? null,
          camera: dStep?.camera ?? sStep.camera ?? null,
          cameraPreset: dStep?.cameraPreset ?? sStep.camera?.preset ?? null,
          telemetry: Array.isArray(state.telemetry) ? state.telemetry : [],
          hasTryOut,
          tryOutCompiledOk,
          challengeVerifiedOnArrival: Boolean(state.challenge?.verified),
          chromeRects,
        },
        {
          engine,
          registeredIds: liveDiag?.registeredIds ?? diag.registeredIds ?? null,
          cameraPresets: liveDiag?.cameraPresets ?? diag.cameraPresets ?? null,
          viewport: { width: vw, height: vh },
          chromeTolerance: 2,
        },
      );

      for (const f of stepFailures) {
        failures.push(`[${vp.label}] ${f}`);
      }

      if (BAD_VALUE_RE.test(snap.telemetryText)) {
        failures.push(
          `[${vp.label}] step ${k}: telemetry strip contains invalid token ("${snap.telemetryText.trim()}")`,
        );
      }
      if (BAD_VALUE_RE.test(snap.subtitleText)) {
        failures.push(
          `[${vp.label}] step ${k}: subtitle contains invalid token ("${snap.subtitleText.trim()}")`,
        );
      }
      if (snap.challengeVisible && BAD_VALUE_RE.test(snap.challengeText)) {
        failures.push(
          `[${vp.label}] step ${k}: challenge text contains invalid token ("${snap.challengeText.trim()}")`,
        );
      }
    }

    // 4. Variant switching check
    await page.evaluate(() => window.__studio.seekStep(0));
    await settleFrames(page, 4);
    const variantSnapshots = [];
    for (const vName of variantNames) {
      await page.evaluate((v) => window.__studio.setVariant(v), vName);
      await settleFrames(page, 5);
      const vSnap = await page.evaluate(() => {
        const st = window.__studio.state();
        return {
          variant: st.variant,
          params: st.params,
          telemetry: st.telemetry,
        };
      });
      if (vSnap.variant !== vName) {
        failures.push(`[${vp.label}] variant "${vName}": state.variant was "${vSnap.variant}"`);
      }
      for (const item of vSnap.telemetry || []) {
        if (isBadTelemetryValue(item?.value)) {
          failures.push(
            `[${vp.label}] variant "${vName}": telemetry "${item?.id}" invalid ("${item?.value ?? ""}")`,
          );
        }
      }
      variantSnapshots.push(JSON.stringify({ params: vSnap.params, telemetry: vSnap.telemetry }));
    }
    if (variantNames.length >= 2 && new Set(variantSnapshots).size < 2) {
      failures.push(
        `[${vp.label}] variants (${variantNames.join(", ")}) produced identical params and telemetry`,
      );
    }
    if (defaultVariant) {
      await page.evaluate((v) => window.__studio.setVariant(v), defaultVariant);
      await settleFrames(page, 3);
    }

    // 5. Light & Dark theme toggle check
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => window.__studio.setTheme(t), theme);
      await settleFrames(page, 4);
      const tCheck = await page.evaluate(() => ({
        domTheme: document.documentElement.dataset.theme,
        stateTheme: window.__studio.state().theme,
      }));
      if (tCheck.domTheme !== theme || tCheck.stateTheme !== theme) {
        failures.push(
          `[${vp.label}] setTheme("${theme}") mismatch (dom="${tCheck.domTheme}", state="${tCheck.stateTheme}")`,
        );
      }
    }

    // 6. Full Slider Min / Mid / Max Sweep on every variant
    if (controls.length > 0) {
      const variantsToSweep = variantNames.length > 0 ? variantNames : [null];
      for (const vName of variantsToSweep) {
        await page.evaluate((v) => {
          if (v) window.__studio.setVariant(v);
          window.__studio.seekStep(0);
        }, vName);
        await settleFrames(page, 2);

        for (const ctrl of controls) {
          const min = Number(ctrl.min);
          const max = Number(ctrl.max);
          const step = Number(ctrl.step) || 0;
          const mid = snapMid(min, max, step);
          const probeVals = [min, mid, max];

          for (const val of probeVals) {
            await page.evaluate(
              ({ id, v }) => window.__studio.setSim({ [id]: v }),
              { id: ctrl.id, v: val },
            );
            await settleFrames(page, 2);
            const telemetry = await page.evaluate(() => window.__studio.state().telemetry || []);
            for (const item of telemetry) {
              if (isBadTelemetryValue(item?.value)) {
                failures.push(
                  `[${vp.label}] slider sweep (${vName ?? "default"}, ${ctrl.id}=${val}): telemetry "${item?.id}" invalid ("${item?.value ?? ""}")`,
                );
              }
            }
          }

          // Restore step 0 baseline between controls
          await page.evaluate((v) => {
            if (v) window.__studio.setVariant(v);
            window.__studio.seekStep(0);
          }, vName);
        }
      }
    }

    // Restore initial state cleanly before shooting PNGs
    await restoreInitialState(page, defaultVariant);

    // 7. Optional screenshots on primary viewport
    if (shotsDir) {
      mkdirSync(shotsDir, { recursive: true });
      const midIdx = Math.min(stepCount - 1, Math.max(1, Math.floor(stepCount / 2)));
      const finalIdx = Math.max(0, stepCount - 1);

      const captures = [
        { name: "step0-light.png", step: 0, theme: "light" },
        { name: "step0-dark.png", step: 0, theme: "dark" },
        { name: "mid-focus.png", step: midIdx, theme: "light" },
        { name: "final-step.png", step: finalIdx, theme: "light" },
      ];

      if (allSteps) {
        for (let k = 0; k < stepCount; k++) {
          captures.push({ name: `step${k}-light.png`, step: k, theme: "light" });
        }
      }

      for (const cap of captures) {
        await page.evaluate(
          ({ step, theme }) => {
            window.__studio.toggleControls?.(false);
            window.__studio.setTheme(theme);
            window.__studio.seekStep(step);
          },
          cap,
        );
        await waitForTransition(page, 380);
        const shotPath = join(shotsDir, cap.name);
        await page.screenshot({ path: shotPath });
        savedShots.push(shotPath);
      }
    }

    // 8. Challenge reachability sweep (variants × control extremes)
    // Runs after PNG capture so latching verifiedSteps never alters unverified final-step screenshots.
    if (tryOutStepIndices.length > 0) {
      const reachVariants = variantNames.length > 0 ? variantNames : [null];
      for (const k of tryOutStepIndices) {
        const reached = await page.evaluate(
          ({ stepIdx, variantsList, ctrls }) => {
            const snapVal = (min, max, step, frac) => {
              const raw = min + (max - min) * frac;
              if (!Number.isFinite(step) || step <= 0) return raw;
              const s = min + Math.round((raw - min) / step) * step;
              return Math.min(max, Math.max(min, Number(s.toFixed(6))));
            };

            const checkVerified = () => Boolean(window.__studio.state()?.challenge?.verified);

            for (const vName of variantsList) {
              window.__studio.seekStep(stepIdx);
              if (vName) window.__studio.setVariant(vName);
              if (checkVerified()) return true;

              // Single-control sweeps across [min, 25%, mid, 75%, max]
              for (const c of ctrls) {
                const min = Number(c.min);
                const max = Number(c.max);
                const step = Number(c.step) || 0;
                for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
                  window.__studio.seekStep(stepIdx);
                  if (vName) window.__studio.setVariant(vName);
                  window.__studio.setSim({ [c.id]: snapVal(min, max, step, frac) });
                  if (checkVerified()) return true;
                }
              }

              // Multi-control combinations of extremes
              if (ctrls.length >= 2 && ctrls.length <= 5) {
                const total = 1 << ctrls.length;
                for (let mask = 0; mask < total; mask++) {
                  window.__studio.seekStep(stepIdx);
                  if (vName) window.__studio.setVariant(vName);
                  const patch = {};
                  for (let bit = 0; bit < ctrls.length; bit++) {
                    const c = ctrls[bit];
                    patch[c.id] = mask & (1 << bit) ? Number(c.max) : Number(c.min);
                  }
                  window.__studio.setSim(patch);
                  if (checkVerified()) return true;
                }
              } else if (ctrls.length > 5) {
                for (const frac of [0, 0.5, 1]) {
                  window.__studio.seekStep(stepIdx);
                  if (vName) window.__studio.setVariant(vName);
                  const patch = {};
                  for (const c of ctrls) {
                    patch[c.id] = snapVal(Number(c.min), Number(c.max), Number(c.step) || 0, frac);
                  }
                  window.__studio.setSim(patch);
                  if (checkVerified()) return true;
                }
                for (let i = 0; i < ctrls.length; i++) {
                  for (let j = i + 1; j < ctrls.length; j++) {
                    for (const vi of [Number(ctrls[i].min), Number(ctrls[i].max)]) {
                      for (const vj of [Number(ctrls[j].min), Number(ctrls[j].max)]) {
                        window.__studio.seekStep(stepIdx);
                        if (vName) window.__studio.setVariant(vName);
                        window.__studio.setSim({ [ctrls[i].id]: vi, [ctrls[j].id]: vj });
                        if (checkVerified()) return true;
                      }
                    }
                  }
                }
              }
            }
            return false;
          },
          { stepIdx: k, variantsList: reachVariants, ctrls: controls },
        );
        await settleFrames(page, 2);
        if (!reached) {
          failures.push(
            `[${vp.label}] step ${k}: tryOut challenge is unreachable across all tested variant × control min/mid/max combinations`,
          );
        }
      }
      await restoreInitialState(page, defaultVariant);
    }

    // 9. Collect any unhandled promise rejections, diagnostics errors & runtime errors
    const { rejections, diagErrors } = await page.evaluate(() => ({
      rejections: window.__studioQaRejections || [],
      diagErrors:
        typeof window.__studio?.diagnostics === "function" &&
        Array.isArray(window.__studio.diagnostics()?.errors)
          ? window.__studio.diagnostics().errors
          : [],
    }));
    for (const r of rejections) {
      runtimeErrors.push(`unhandledrejection: ${r}`);
    }
    for (const e of diagErrors) {
      runtimeErrors.push(`diagnostics.error: ${e}`);
    }
    for (const err of runtimeErrors) {
      failures.push(`[${vp.label}] ${err}`);
    }
  } finally {
    await page.close();
  }

  return { failures, savedShots, stepCount, variantNames };
}

async function main() {
  const { file, shotsDir, fast, allSteps } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error(
      "Usage: node scripts/check-studio.mjs <page.html> [--shots <dir>] [--fast] [--all-steps]",
    );
    process.exit(1);
  }

  const absFile = resolve(file);
  if (!existsSync(absFile)) {
    console.error(`FAIL: File not found: ${absFile}`);
    process.exit(1);
  }

  const html = readFileSync(absFile, "utf8");
  const parsedConfig = parseStudioConfigFromHtml(html);

  const url = pathToFileURL(absFile).href;
  const viewports = fast
    ? [{ label: "1440x900", width: 1440, height: 900 }]
    : [
        { label: "1440x900", width: 1440, height: 900 },
        { label: "1280x800", width: 1280, height: 800 },
      ];

  const browser = await launchStudioChrome();
  const allFailures = [];
  let savedShots = [];
  let stepsSummary = 0;
  let variantsSummary = 0;

  try {
    for (let i = 0; i < viewports.length; i++) {
      const vp = viewports[i];
      const res = await auditViewport(browser, url, vp, {
        shotsDir: i === 0 && shotsDir ? resolve(shotsDir) : null,
        allSteps: i === 0 && allSteps,
        parsedConfig,
      });
      allFailures.push(...res.failures);
      if (i === 0) {
        savedShots = res.savedShots;
        stepsSummary = res.stepCount;
        variantsSummary = res.variantNames.length;
      }
    }
  } finally {
    await browser.close();
  }

  if (savedShots.length) {
    console.log("Saved Studio QA screenshots:");
    for (const p of savedShots) console.log(`  - ${p}`);
    console.log("Vision QA Checklist:");
    console.log("  1. Hero silhouette & framing: subject centered cleanly with breathing room around top/bottom chrome.");
    console.log("  2. Callouts & leader lines: <= 2 crisp labels per step (<= 1 on Engine C), no clipping, no overlap, anchors land on named parts.");
    console.log("  3. Light & Dark themes: strong figure-ground contrast, legible architectural edges and telemetry in both modes.");
    console.log("  4. Mid-step focus & progressive reveal: non-focus parts dim cleanly while focal parts pop with accent tint.");
    console.log("  5. Final step & challenge card: floating challenge card stays clear of the primary visual focal point.");
  }

  if (allFailures.length) {
    for (const f of allFailures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }

  console.log(
    `studio: passed (${file}, ${stepsSummary} steps, ${variantsSummary} variants, ${viewports.map((v) => v.label).join(" + ")})`,
  );
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(`FAIL: ${err?.message ?? err}`);
    process.exit(1);
  });
}
