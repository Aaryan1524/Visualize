// Frameless Cinema-Minimal Unified Director Shell.
// Build-time module emitting a standalone, zero-external-dependency HTML page.
//
//   import { studioPage } from "./director.mjs";
//   writeFileSync(out, studioPage({ ... }));
//
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "../render/fonts");

const fontBase64 = (name) => readFileSync(join(FONTS, name)).toString("base64");

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function safeScript(src) {
  return String(src ?? "").replace(/<\/(script)/gi, "<\\/$1");
}

function stripExports(src) {
  return String(src ?? "").replace(
    /^\s*export\s+(?:default\s+)?(?=(?:async\s+)?(?:function|const|let|var|class)\b)/gm,
    "",
  );
}

/** Inlines Manrope & IBM Plex Mono woff2 fonts as base64 into director.css. */
export function directorCss() {
  return readFileSync(join(HERE, "director.css"), "utf8").replace(
    /\$\{font\("([^"]+)"\)\}/g,
    (_, file) => fontBase64(file),
  );
}

const ICONS = {
  prev: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h1.8v11H3zM13.5 2.5v11L5.8 8z"/></svg>`,
  next: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.2 2.5H13v11h-1.8zM2.5 2.5v11L10.2 8z"/></svg>`,
  play: `<svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 2.4v11.2L13.4 8z"/></svg>`,
  pause: `<svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h2.8v11H4zM9.2 2.5H12v11H9.2z"/></svg>`,
  tune: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h3.5a1.5 1.5 0 0 0 3 0H14v1.4H8.5a1.5 1.5 0 0 0-3 0H2V4zm0 6.6h6.5a1.5 1.5 0 0 0 3 0H14V12h-2.5a1.5 1.5 0 0 0-3 0H2v-1.4z"/></svg>`,
  reset: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8a5.2 5.2 0 1 1-5 6.5h1.6A3.6 3.6 0 1 0 8 4.4v2.3L4.4 3.6 8 .5z"/></svg>`,
  sound: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.2h2.6l3.4-2.8v9.2L5.1 9.8H2.5z"/><path class="sd-sound-wave" d="M11 5.3a3.8 3.8 0 0 1 0 5.4M12.9 3.6a6.2 6.2 0 0 1 0 8.8"/></svg>`,
  theme: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.4"/><path d="M8 1.6v1.4M8 13v1.4M1.6 8H3M13 8h1.4M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1"/></svg>`,
};

function normalizeSteps(steps) {
  return (Array.isArray(steps) ? steps : []).map((s, idx) => {
    const rawCallouts = Array.isArray(s?.callouts) ? s.callouts : [];
    // HARD LABEL BUDGET: strictly cap at max 2 callouts per step in serialized output.
    const callouts = rawCallouts.slice(0, 2).map((c) => ({
      target: String(c?.target ?? ""),
      label: String(c?.label ?? ""),
      ...(c?.place ? { place: String(c.place) } : {}),
    }));

    let tryOut = null;
    if (s?.tryOut && typeof s.tryOut === "object") {
      const fnSrc =
        typeof s.tryOut.checkSrc === "function"
          ? s.tryOut.checkSrc.toString()
          : typeof s.tryOut.check === "function"
            ? s.tryOut.check.toString()
            : s.tryOut.checkSrc != null
              ? String(s.tryOut.checkSrc)
              : "() => false";
      tryOut = {
        prompt: String(s.tryOut.prompt ?? ""),
        successText: String(s.tryOut.successText ?? ""),
        checkSrc: fnSrc,
      };
    }

    return {
      step: typeof s?.step === "number" ? s.step : idx,
      tab: String(s?.tab ?? `Step ${idx + 1}`),
      title: String(s?.title ?? s?.tab ?? `Step ${idx + 1}`),
      narration: String(s?.narration ?? ""),
      focus: Array.isArray(s?.focus) ? s.focus.map(String) : null,
      accents: s?.accents && typeof s.accents === "object" ? { ...s.accents } : null,
      reveal: Array.isArray(s?.reveal) ? s.reveal.map(String) : null,
      camera: s?.camera && typeof s.camera === "object"
        ? { preset: String(s.camera.preset ?? "hero"), zoom: Number(s.camera.zoom ?? 1) }
        : { preset: "hero", zoom: 1 },
      sim: s?.sim && typeof s.sim === "object" ? { ...s.sim } : {},
      rawCalloutCount: rawCallouts.length,
      callouts,
      tryOut,
    };
  });
}

function normalizeTelemetry(telemetry) {
  return (Array.isArray(telemetry) ? telemetry : []).map((t) => ({
    id: String(t?.id ?? ""),
    label: String(t?.label ?? t?.id ?? ""),
    formatSrc:
      typeof t?.formatSrc === "function"
        ? t.formatSrc.toString()
        : typeof t?.format === "function"
          ? t.format.toString()
          : t?.formatSrc != null
            ? String(t.formatSrc)
            : null,
  }));
}

function normalizeVariants(variants) {
  return (Array.isArray(variants) ? variants : []).map((v) => ({
    name: String(v?.name ?? "default"),
    label: String(v?.label ?? v?.name ?? "Default"),
    defaults: v?.defaults && typeof v.defaults === "object" ? { ...v.defaults } : {},
  }));
}

function normalizeControls(controls) {
  return (Array.isArray(controls) ? controls : []).map((c) => ({
    id: String(c?.id ?? ""),
    label: String(c?.label ?? c?.id ?? ""),
    min: Number(c?.min ?? 0),
    max: Number(c?.max ?? 1),
    step: Number(c?.step ?? 0.01),
    unit: String(c?.unit ?? ""),
  }));
}

// Browser-side Director runtime. Serialized via toString() into the standalone HTML page,
// so it must not reference any module-scoped identifiers outside its own body.
function directorRuntime(CONFIG, externalSimModel) {
  const $ = (id) => document.getElementById(id);
  const canvas = $("studio-canvas");
  const stepsNav = $("sd-steps");
  const telemetryEl = $("sd-telemetry");
  const themeBtn = $("sd-theme-btn");
  const soundBtn = $("sd-sound-btn");
  const calloutLayer = $("sd-callouts");
  const calloutSvg = $("sd-callout-svg");
  const challengeEl = $("sd-challenge");
  const challengePromptEl = $("sd-challenge-prompt");
  const challengeStatusEl = $("sd-challenge-status");
  const continueBtn = $("sd-continue-btn");
  const subtitleBtn = $("sd-subtitle");
  const subtitleTextEl = $("sd-subtitle-text");
  const subProgressFill = $("sd-sub-progress-fill");
  const tunePanel = $("sd-tune");
  const tuneBtn = $("sd-tune-btn");
  const challengeBtn = $("sd-challenge-btn");
  const prevBtn = $("sd-prev");
  const playBtn = $("sd-play");
  const nextBtn = $("sd-next");
  const resetBtn = $("sd-reset-btn");

  const STEPS = CONFIG.steps || [];
  const VARIANTS = CONFIG.variants || [];
  const CONTROLS = CONFIG.controls || [];
  const TELEMETRY = CONFIG.telemetry || [];
  const VOICE = CONFIG.voice || null;

  const compileErrors = [];
  const runtimeIssues = [];
  const tryOutCompileErrors = new Set();

  const recordIssue = (kind, label, err) => {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
    if (runtimeIssues.length < 100) {
      runtimeIssues.push({ kind, label, message });
    }
    return message;
  };

  const compileFn = (src, fallback, label) => {
    if (!src) return fallback;
    try {
      const fn = new Function("return (" + src + ");")();
      if (typeof fn === "function") return fn;
      const msg = `Expression for ${label} did not evaluate to a function`;
      console.error("[studio] failed to compile " + label + ":", msg);
      compileErrors.push({ label, message: msg });
      recordIssue("compile", label, msg);
      return fallback;
    } catch (err) {
      console.error("[studio] failed to compile " + label + ":", err);
      const message = recordIssue("compile", label, err);
      compileErrors.push({ label, message });
      return fallback;
    }
  };

  const telemetryFns = TELEMETRY.map((t) =>
    compileFn(
      t.formatSrc,
      (sim) => (sim && sim[t.id] != null ? String(sim[t.id]) : ""),
      `telemetry:${t.id}`,
    ),
  );
  const tryOutFns = STEPS.map((s, idx) => {
    if (!s.tryOut) return null;
    const beforeCount = compileErrors.length;
    const fn = compileFn(s.tryOut.checkSrc, () => false, `tryOut:step${idx}`);
    if (compileErrors.length > beforeCount) {
      tryOutCompileErrors.add(idx);
    }
    return fn;
  });

  // Identify keys whose values differ across variants so variant choice persists across steps.
  const variantKeys = new Set();
  if (VARIANTS.length > 1) {
    const allKeys = new Set();
    for (const v of VARIANTS) {
      for (const k of Object.keys(v.defaults || {})) allKeys.add(k);
    }
    for (const k of allKeys) {
      const first = VARIANTS[0].defaults?.[k];
      if (VARIANTS.some((v) => v.defaults?.[k] !== first)) variantKeys.add(k);
    }
  }

  const getVariantObj = (name) =>
    VARIANTS.find((v) => v.name === name) || VARIANTS[0] || { name: "default", label: "Default", defaults: {} };

  const initialVariant = VARIANTS[0]?.name || "default";
  const state = {
    step: 0,
    variant: initialVariant,
    theme: CONFIG.themeDefault === "dark" ? "dark" : "light",
    playing: false,
    soundOn: true,
    controlsOpen: false,
    captionsCollapsed: false,
    challengePinned: false,
    verifiedSteps: new Set(),
    userTouched: new Set(),
    params: { ...(VARIANTS[0]?.defaults || {}), ...(STEPS[0]?.sim || {}) },
    simOut: {},
    telemetrySnapshot: [],
    calloutBoxes: [],
  };

  let controller = null;
  let audioEl = null;
  let silentTimerStart = 0;
  let silentDuration = 5.5;
  let lastFrameTime = performance.now();
  let stepStartTime = lastFrameTime;
  let calloutNodes = [];
  const loggedStepErrors = new Set();

  function logStepError(key, prefix, err) {
    if (loggedStepErrors.has(key)) return;
    loggedStepErrors.add(key);
    console.error(prefix, err);
    recordIssue("runtime", key, err);
  }

  function getSimFn() {
    return typeof externalSimModel === "function"
      ? externalSimModel
      : typeof globalThis.simModel === "function"
        ? globalThis.simModel
        : null;
  }

  function runSim(params, variantName, t = 0, throttlePerStep = false) {
    const fn = getSimFn();
    if (!fn) return { ...params };
    try {
      const out = fn({ ...params }, variantName, t);
      return out && typeof out === "object" ? out : { ...params };
    } catch (err) {
      if (throttlePerStep) {
        logStepError("simModel", "[studio] simModel threw:", err);
      } else {
        console.error("[studio] simModel threw:", err);
        recordIssue("runtime", "simModel", err);
      }
      return { ...params };
    }
  }

  function formatControlValue(ctrl, val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return "";
    const stepStr = String(ctrl.step || 1);
    const decimals = stepStr.includes(".") ? stepStr.split(".")[1].length : 0;
    const isPercent01 = ctrl.unit === "%" && ctrl.max <= 1.0001 && ctrl.min >= 0;
    if (isPercent01) return `${Math.round(num * 100)}%`;
    const formatted =
      decimals > 0
        ? num.toFixed(Math.min(decimals, 2)).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")
        : String(Math.round(num));
    return ctrl.unit ? `${formatted}${ctrl.unit}` : formatted;
  }

  function getVoiceClip(stepIdx, variantName) {
    if (!VOICE) return null;
    const map = VOICE.variants && typeof VOICE.variants === "object" ? VOICE.variants : VOICE;
    const list =
      (Array.isArray(map?.[variantName]) && map[variantName]) ||
      (Array.isArray(map?.[VARIANTS[0]?.name]) && map[VARIANTS[0]?.name]) ||
      (Array.isArray(VOICE) ? VOICE : null) ||
      (map && typeof map === "object" ? Object.values(map).find((v) => Array.isArray(v)) : null);
    if (!list) return null;
    return list[stepIdx] || null;
  }

  function stopAudio() {
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.onended = null;
        audioEl.onerror = null;
        audioEl.src = "";
      } catch {}
      audioEl = null;
    }
  }

  function setProgress(ratio) {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    if (subProgressFill) subProgressFill.style.width = `${(clamped * 100).toFixed(1)}%`;
  }

  function updateThemeUI() {
    document.documentElement.dataset.theme = state.theme;
    document.body.dataset.theme = state.theme;
    if (themeBtn) {
      const label = themeBtn.querySelector("span");
      if (label) label.textContent = state.theme === "dark" ? "Light" : "Dark";
      themeBtn.setAttribute("aria-label", state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
  }

  function updateSoundUI() {
    if (!soundBtn) return;
    soundBtn.setAttribute("aria-pressed", String(state.soundOn));
    const label = soundBtn.querySelector("span");
    if (label) label.textContent = state.soundOn ? "Sound" : "Muted";
    const wave = soundBtn.querySelector(".sd-sound-wave");
    if (wave) wave.style.opacity = state.soundOn ? "1" : "0.2";
  }

  function updatePlayUI() {
    if (!playBtn) return;
    playBtn.dataset.playing = String(state.playing);
    playBtn.setAttribute("aria-label", state.playing ? "Pause narration" : "Play narration");
    const label = playBtn.querySelector(".sd-play-label");
    if (label) label.textContent = state.playing ? "Pause" : "Play";
  }

  function syncSlidersFromParams() {
    if (!tunePanel) return;
    for (const ctrl of CONTROLS) {
      const input = tunePanel.querySelector(`input[data-control="${ctrl.id}"]`);
      const out = tunePanel.querySelector(`[data-control-val="${ctrl.id}"]`);
      const val = state.params[ctrl.id];
      if (input && val != null) input.value = String(val);
      if (out && val != null) out.textContent = formatControlValue(ctrl, val);
    }
  }

  function syncVariantButtons() {
    for (const btn of document.querySelectorAll(".sd-variant-btn")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.variant === state.variant));
    }
  }

  function syncStepPills() {
    if (!stepsNav) return;
    for (const btn of stepsNav.querySelectorAll(".sd-step")) {
      const idx = Number(btn.dataset.step);
      if (idx === state.step) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    }
  }

  function updateTelemetry(throttlePerStep = false) {
    if (!telemetryEl) return;
    const snap = [];
    for (let i = 0; i < TELEMETRY.length; i++) {
      const item = TELEMETRY[i];
      let val = "";
      try {
        const res = telemetryFns[i](state.simOut, state.params, state.variant);
        val = res == null ? "" : String(res);
      } catch (err) {
        if (throttlePerStep) {
          logStepError(
            `telemetry:${item.id}`,
            "[studio] telemetry formatter threw (" + item.id + "):",
            err,
          );
        } else {
          console.error("[studio] telemetry formatter threw (" + item.id + "):", err);
          recordIssue("runtime", `telemetry:${item.id}`, err);
        }
        val = "";
      }
      snap.push({ id: item.id, label: item.label, value: val });
    }
    const unchanged =
      snap.length === state.telemetrySnapshot.length &&
      snap.every((s, idx) => s.value === state.telemetrySnapshot[idx]?.value);
    if (unchanged && state.telemetrySnapshot.length > 0) return;

    const frag = document.createDocumentFragment();
    for (const item of snap) {
      const span = document.createElement("span");
      span.className = "sd-tel-item";
      const lbl = document.createElement("span");
      lbl.className = "sd-tel-label";
      lbl.textContent = item.label;
      const num = document.createElement("span");
      num.className = "sd-tel-val";
      num.textContent = item.value;
      span.append(lbl, num);
      frag.appendChild(span);
    }
    telemetryEl.replaceChildren(frag);
    state.telemetrySnapshot = snap;
  }

  function updateSubtitle() {
    const step = STEPS[state.step];
    const clip = getVoiceClip(state.step, state.variant);
    const text = (clip && clip.text) || step?.narration || step?.title || "";
    if (subtitleTextEl) subtitleTextEl.textContent = text;
    if (subtitleBtn) {
      subtitleBtn.dataset.collapsed = String(state.captionsCollapsed);
      subtitleBtn.setAttribute("aria-pressed", String(!state.captionsCollapsed));
      subtitleBtn.style.display = text ? "" : "none";
    }
  }

  function evaluateChallenge(throttlePerStep = false) {
    const step = STEPS[state.step];
    const tryOut = step?.tryOut;
    const hasTryOut = Boolean(tryOut);

    if (challengeBtn) {
      challengeBtn.setAttribute("aria-pressed", String(hasTryOut && !challengeEl?.hidden));
    }
    if (!challengeEl) return;

    if (!hasTryOut) {
      challengeEl.hidden = true;
      challengeEl.dataset.verified = "false";
      return;
    }

    let ok = state.verifiedSteps.has(state.step);
    if (!ok && tryOutFns[state.step]) {
      try {
        ok = Boolean(tryOutFns[state.step](state.simOut, state.params, state.variant));
      } catch (err) {
        if (throttlePerStep) {
          logStepError(`tryOut:step${state.step}`, "[studio] tryOut check threw:", err);
        } else {
          console.error("[studio] tryOut check threw:", err);
          recordIssue("runtime", `tryOut:step${state.step}`, err);
        }
        ok = false;
      }
      if (ok) state.verifiedSteps.add(state.step);
    }

    challengeEl.hidden = false;
    challengeEl.dataset.verified = String(ok);
    if (challengePromptEl) challengePromptEl.textContent = tryOut.prompt;
    if (challengeStatusEl) {
      challengeStatusEl.textContent = ok
        ? tryOut.successText || "Verified with the live simulation."
        : "Use the presets or Tune sliders below — verified live.";
    }
    if (continueBtn) {
      continueBtn.textContent = state.step < STEPS.length - 1 ? "Continue →" : "Finish ✓";
    }
  }

  function recomputeSim(syncSceneNow) {
    const elapsedSec = Math.max(0, (performance.now() - stepStartTime) / 1000);
    state.simOut = runSim(state.params, state.variant, elapsedSec);
    updateTelemetry();
    evaluateChallenge();
    if (syncSceneNow && controller?.update) {
      try {
        controller.update(0, state.simOut, { ...state.params }, STEPS[state.step]);
      } catch (err) {
        logStepError("controller.update", "[studio] controller.update threw:", err);
      }
    }
  }

  // ---- Collision-Aware Floating Callout Layer (HARD BUDGET: MAX 2) ----
  function rebuildCalloutDom() {
    if (!calloutLayer || !calloutSvg) return;
    for (const n of calloutNodes) n.chip.remove();
    calloutNodes = [];
    calloutSvg.replaceChildren();

    const step = STEPS[state.step];
    const list = (step?.callouts || []).slice(0, 2);
    const NS = "http://www.w3.org/2000/svg";

    for (const item of list) {
      const chip = document.createElement("div");
      chip.className = "sd-callout-chip";
      chip.dataset.target = item.target;
      chip.dataset.visible = "false";
      chip.textContent = item.label;
      calloutLayer.appendChild(chip);

      const line = document.createElementNS(NS, "path");
      line.setAttribute("class", "sd-callout-line");
      line.style.display = "none";
      const halo = document.createElementNS(NS, "circle");
      halo.setAttribute("class", "sd-callout-halo");
      halo.setAttribute("r", "5.5");
      halo.style.display = "none";
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("class", "sd-callout-dot");
      dot.setAttribute("r", "3");
      dot.style.display = "none";

      calloutSvg.append(line, halo, dot);
      calloutNodes.push({ item, chip, line, halo, dot });
    }
  }

  function layoutCallouts() {
    if (!calloutNodes.length) {
      state.calloutBoxes = [];
      return;
    }
    const W = window.innerWidth || 1280;
    const H = window.innerHeight || 720;
    const marginX = 20;
    const minY = 88;
    const bottomReserve = state.controlsOpen ? 196 : 144;
    const maxYBase = Math.max(minY + 40, H - bottomReserve);

    const visible = [];
    for (const node of calloutNodes) {
      let pos = null;
      try {
        pos = controller?.getCalloutPos?.(node.item.target) ?? null;
      } catch (err) {
        logStepError(
          `callout:${node.item.target}`,
          "[studio] getCalloutPos threw (" + node.item.target + "):",
          err,
        );
        pos = null;
      }
      let ax = NaN;
      let ay = NaN;
      let ok = false;
      if (Array.isArray(pos) && pos.length >= 2) {
        ax = Number(pos[0]);
        ay = Number(pos[1]);
        ok = Number.isFinite(ax) && Number.isFinite(ay);
      } else if (pos && typeof pos === "object" && pos.visible !== false) {
        ax = Number(pos.x);
        ay = Number(pos.y);
        ok = Number.isFinite(ax) && Number.isFinite(ay);
      }

      if (!ok || ax < -30 || ax > W + 30 || ay < -30 || ay > H + 30) {
        node.chip.dataset.visible = "false";
        node.line.style.display = "none";
        node.halo.style.display = "none";
        node.dot.style.display = "none";
        continue;
      }

      const w = node.chip.offsetWidth || Math.min(220, Math.max(90, node.item.label.length * 7.2 + 24));
      const h = node.chip.offsetHeight || 29;
      const place = node.item.place;
      let rawX;
      let rawY;
      if (place === "top") {
        rawX = ax - w / 2;
        rawY = ay - 52 - h;
      } else if (place === "bottom") {
        rawX = ax - w / 2;
        rawY = ay + 46;
      } else if (place === "left") {
        rawX = ax - 54 - w;
        rawY = ay - h / 2;
      } else if (place === "right") {
        rawX = ax + 54;
        rawY = ay - h / 2;
      } else {
        const side = ax < W * 0.5 ? -1 : 1;
        const dy = ay < H * 0.44 ? -44 : 36;
        rawX = side < 0 ? ax - 54 - w : ax + 54;
        rawY = ay + dy - h / 2;
      }

      const clampBox = (b) => {
        b.x = Math.max(marginX, Math.min(W - b.w - marginX, b.x));
        b.y = Math.max(minY, Math.min(maxYBase - b.h, b.y));
      };

      const box = { node, ax, ay, x: rawX, y: rawY, w, h };
      clampBox(box);
      visible.push(box);
    }

    // Deterministic 2D AABB repulsion when 2 callouts are visible
    if (visible.length === 2) {
      const pad = 14;
      const clamp = (b) => {
        b.x = Math.max(marginX, Math.min(W - b.w - marginX, b.x));
        b.y = Math.max(minY, Math.min(maxYBase - b.h, b.y));
      };
      const [a, b] = visible;
      for (let iter = 0; iter < 6; iter++) {
        const ox = Math.min(a.x + a.w + pad, b.x + b.w + pad) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h + pad, b.y + b.h + pad) - Math.max(a.y, b.y);
        if (ox <= 0 || oy <= 0) break;

        if (oy <= ox * 1.35) {
          const aFirst = a.ay < b.ay || (a.ay === b.ay && a.y <= b.y);
          const half = oy * 0.5 + 1;
          if (aFirst) {
            a.y -= half;
            b.y += half;
          } else {
            b.y -= half;
            a.y += half;
          }
          clamp(a);
          clamp(b);
        } else {
          const aLeft = a.ax < b.ax || (a.ax === b.ax && a.x <= b.x);
          const half = ox * 0.5 + 1;
          if (aLeft) {
            a.x -= half;
            b.x += half;
          } else {
            b.x -= half;
            a.x += half;
          }
          clamp(a);
          clamp(b);
        }

        // If still overlapping after clamping one axis, separate on the alternate axis
        const ox2 = Math.min(a.x + a.w + pad, b.x + b.w + pad) - Math.max(a.x, b.x);
        const oy2 = Math.min(a.y + a.h + pad, b.y + b.h + pad) - Math.max(a.y, b.y);
        if (ox2 > 0 && oy2 > 0) {
          const aLeft = a.ax <= b.ax;
          const shift = ox2 * 0.5 + 2;
          if (aLeft) {
            a.x -= shift;
            b.x += shift;
          } else {
            b.x -= shift;
            a.x += shift;
          }
          clamp(a);
          clamp(b);
        }
      }
    }

    const snap = [];
    for (const box of visible) {
      const { node, ax, ay, x, y, w, h } = box;
      node.chip.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      node.chip.dataset.visible = "true";

      // Attach leader hairline to the nearest horizontal edge of the chip
      let ex = x + w / 2;
      let ey = y + h / 2;
      let elbowX = ex;
      if (ax < x) {
        ex = x;
        elbowX = Math.max(ax, x - 12);
      } else if (ax > x + w) {
        ex = x + w;
        elbowX = Math.min(ax, x + w + 12);
      } else {
        ey = ay < y ? y : y + h;
        elbowX = ex;
      }

      const d = `M${ax.toFixed(1)},${ay.toFixed(1)} L${elbowX.toFixed(1)},${ey.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`;
      node.line.setAttribute("d", d);
      node.line.style.display = "";
      node.halo.setAttribute("cx", ax.toFixed(1));
      node.halo.setAttribute("cy", ay.toFixed(1));
      node.halo.style.display = "";
      node.dot.setAttribute("cx", ax.toFixed(1));
      node.dot.setAttribute("cy", ay.toFixed(1));
      node.dot.style.display = "";

      snap.push({
        target: node.item.target,
        label: node.item.label,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
        ax: Math.round(ax),
        ay: Math.round(ay),
      });
    }
    state.calloutBoxes = snap;
  }

  // ---- Playback & Audio Sequencing ----
  function onStepMediaFinished() {
    if (!state.playing) return;
    const step = STEPS[state.step];
    // Pause cleanly on interactive micro-challenges until verified!
    if (step?.tryOut && !state.verifiedSteps.has(state.step)) {
      pausePlayback();
      setProgress(1);
      return;
    }
    if (state.step < STEPS.length - 1) {
      seekStep(state.step + 1, { keepPlaying: true });
    } else {
      pausePlayback();
      setProgress(1);
    }
  }

  function startCurrentStepMedia() {
    stopAudio();
    setProgress(0);
    if (!state.playing) return;

    const clip = getVoiceClip(state.step, state.variant);
    if (state.soundOn && clip && clip.audio) {
      const src = String(clip.audio).startsWith("data:")
        ? clip.audio
        : `data:${clip.type || "audio/mpeg"};base64,${clip.audio}`;
      const el = new Audio(src);
      audioEl = el;
      el.onended = () => {
        if (audioEl !== el) return;
        setProgress(1);
        onStepMediaFinished();
      };
      el.onerror = () => {
        if (audioEl !== el) return;
        audioEl = null;
        silentDuration = Number(clip.duration) || 5.5;
        silentTimerStart = performance.now();
      };
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (audioEl !== el) return;
          audioEl = null;
          silentDuration = Number(clip.duration) || 5.5;
          silentTimerStart = performance.now();
        });
      }
      return;
    }

    silentDuration = Number(clip?.duration) || 5.5;
    silentTimerStart = performance.now();
  }

  function startPlayback() {
    if (!STEPS.length) return;
    if (state.step >= STEPS.length - 1 && !STEPS[state.step]?.tryOut) {
      seekStep(0, { keepPlaying: true });
      return;
    }
    state.playing = true;
    updatePlayUI();
    startCurrentStepMedia();
  }

  function pausePlayback() {
    state.playing = false;
    stopAudio();
    updatePlayUI();
  }

  // ---- Director State Mutations ----
  function seekStep(k, opts = {}) {
    if (!STEPS.length) return;
    const clamped = Math.max(0, Math.min(STEPS.length - 1, Number(k) || 0));
    state.step = clamped;
    stepStartTime = performance.now();
    loggedStepErrors.clear();
    state.userTouched.clear();

    const step = STEPS[clamped];
    const vObj = getVariantObj(state.variant);
    const nextParams = { ...(vObj.defaults || {}), ...(step.sim || {}) };
    // Preserve active non-default variant's distinguishing parameters across steps
    if (VARIANTS.length > 1 && state.variant !== VARIANTS[0].name) {
      for (const vk of variantKeys) {
        if (vObj.defaults && vk in vObj.defaults) nextParams[vk] = vObj.defaults[vk];
      }
    }
    state.params = nextParams;

    if (!opts.keepPlaying) {
      pausePlayback();
      setProgress(0);
    }

    syncStepPills();
    syncSlidersFromParams();
    updateSubtitle();

    if (controller) {
      try {
        controller.setFocus?.(step.focus, step.accents || null);
      } catch (err) {
        console.error("[studio] setFocus threw:", err);
        recordIssue("runtime", "setFocus", err);
      }
      try {
        controller.setReveal?.(step.reveal);
      } catch (err) {
        console.error("[studio] setReveal threw:", err);
        recordIssue("runtime", "setReveal", err);
      }
      try {
        controller.setCamera?.(step.camera?.preset ?? "hero", step.camera?.zoom ?? 1);
      } catch (err) {
        console.error("[studio] setCamera threw:", err);
        recordIssue("runtime", "setCamera", err);
      }
    }

    recomputeSim(true);
    rebuildCalloutDom();
    layoutCallouts();

    if (opts.keepPlaying) startCurrentStepMedia();
  }

  function setVariant(name) {
    const vObj = VARIANTS.find((v) => v.name === name);
    if (!vObj) return;
    state.variant = vObj.name;
    const next = { ...state.params };
    for (const [k, val] of Object.entries(vObj.defaults || {})) {
      if (variantKeys.has(k) || !state.userTouched.has(k)) next[k] = val;
    }
    state.params = next;
    syncVariantButtons();
    syncSlidersFromParams();
    updateSubtitle();
    recomputeSim(true);
    layoutCallouts();
    if (state.playing) startCurrentStepMedia();
  }

  function setSim(patch) {
    if (!patch || typeof patch !== "object") return;
    for (const [k, v] of Object.entries(patch)) {
      state.params[k] = v;
      state.userTouched.add(k);
    }
    syncSlidersFromParams();
    recomputeSim(true);
    layoutCallouts();
  }

  function setTheme(theme) {
    state.theme = theme === "dark" ? "dark" : "light";
    updateThemeUI();
    try {
      controller?.setTheme?.(state.theme);
    } catch (err) {
      console.error("[studio] setTheme threw:", err);
      recordIssue("runtime", "setTheme", err);
    }
  }

  function toggleControls(open) {
    state.controlsOpen = typeof open === "boolean" ? open : !state.controlsOpen;
    if (tunePanel) tunePanel.hidden = !state.controlsOpen;
    if (tuneBtn) tuneBtn.setAttribute("aria-pressed", String(state.controlsOpen));
    document.body.dataset.controlsOpen = String(state.controlsOpen);
    layoutCallouts();
  }

  function parseHash() {
    const raw = (window.location.hash || "").replace(/^#/, "");
    if (!raw) return {};
    const params = new URLSearchParams(raw);
    const out = {};
    if (params.has("theme")) out.theme = params.get("theme");
    if (params.has("variant")) out.variant = params.get("variant");
    if (params.has("step")) {
      const n = Number(params.get("step"));
      if (Number.isFinite(n)) out.step = n;
    }
    return out;
  }

  function applyHash() {
    const h = parseHash();
    if (h.theme === "dark" || h.theme === "light") setTheme(h.theme);
    if (h.variant && VARIANTS.some((v) => v.name === h.variant)) {
      state.variant = h.variant;
      syncVariantButtons();
    }
    if (typeof h.step === "number") {
      seekStep(h.step);
    } else if (h.variant) {
      setVariant(h.variant);
    }
  }

  // ---- Wire DOM Events ----
  if (stepsNav) {
    stepsNav.addEventListener("click", (e) => {
      const btn = e.target.closest(".sd-step");
      if (!btn) return;
      seekStep(Number(btn.dataset.step));
    });
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
  }

  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      state.soundOn = !state.soundOn;
      updateSoundUI();
      if (!state.soundOn) stopAudio();
      else if (state.playing) startCurrentStepMedia();
    });
  }

  if (subtitleBtn) {
    subtitleBtn.addEventListener("click", () => {
      state.captionsCollapsed = !state.captionsCollapsed;
      updateSubtitle();
    });
  }

  if (prevBtn) prevBtn.addEventListener("click", () => seekStep(state.step - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => seekStep(state.step + 1));
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (state.playing) pausePlayback();
      else startPlayback();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      try {
        controller?.resetCamera?.();
      } catch (err) {
        console.error("[studio] resetCamera threw:", err);
        recordIssue("runtime", "resetCamera", err);
      }
      const cam = STEPS[state.step]?.camera;
      if (cam) {
        try {
          controller?.setCamera?.(cam.preset, cam.zoom);
        } catch (err) {
          console.error("[studio] setCamera threw:", err);
          recordIssue("runtime", "setCamera", err);
        }
      }
    });
  }

  if (tuneBtn) tuneBtn.addEventListener("click", () => toggleControls());

  if (tunePanel) {
    tunePanel.addEventListener("input", (e) => {
      const input = e.target.closest("input[data-control]");
      if (!input) return;
      const id = input.dataset.control;
      const val = Number(input.value);
      if (Number.isFinite(val)) setSim({ [id]: val });
    });
  }

  for (const btn of document.querySelectorAll(".sd-variant-btn")) {
    btn.addEventListener("click", () => setVariant(btn.dataset.variant));
  }

  if (challengeBtn) {
    challengeBtn.addEventListener("click", () => {
      const currHas = Boolean(STEPS[state.step]?.tryOut);
      if (currHas && challengeEl) {
        challengeEl.hidden = !challengeEl.hidden;
        challengeBtn.setAttribute("aria-pressed", String(!challengeEl.hidden));
        return;
      }
      const nextIdx = STEPS.findIndex((s, i) => i >= state.step && s.tryOut);
      const anyIdx = nextIdx >= 0 ? nextIdx : STEPS.findIndex((s) => s.tryOut);
      if (anyIdx >= 0) seekStep(anyIdx);
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (state.step < STEPS.length - 1) seekStep(state.step + 1);
      else if (challengeEl) challengeEl.hidden = true;
    });
  }

  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      seekStep(state.step + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekStep(state.step - 1);
    } else if (e.key === " " && tag !== "BUTTON") {
      e.preventDefault();
      if (state.playing) pausePlayback();
      else startPlayback();
    } else if (e.key === "r" || e.key === "R") {
      resetBtn?.click();
    } else if (e.key === "t" || e.key === "T") {
      if (CONTROLS.length) toggleControls();
    } else if (e.key === "d" || e.key === "D") {
      setTheme(state.theme === "dark" ? "light" : "dark");
    } else if (e.key === "m" || e.key === "M") {
      soundBtn?.click();
    }
  });

  window.addEventListener("resize", () => {
    try {
      controller?.resize?.();
    } catch (err) {
      console.error("[studio] resize threw:", err);
      recordIssue("runtime", "resize", err);
    }
    layoutCallouts();
  });

  window.addEventListener("hashchange", applyHash);

  // ---- Mount Scene Engine ----
  const initialHash = parseHash();
  if (initialHash.theme === "dark" || initialHash.theme === "light") {
    state.theme = initialHash.theme;
  }
  if (initialHash.variant && VARIANTS.some((v) => v.name === initialHash.variant)) {
    state.variant = initialHash.variant;
  }
  if (typeof initialHash.step === "number") {
    state.step = Math.max(0, Math.min(Math.max(0, STEPS.length - 1), initialHash.step));
  }

  updateThemeUI();
  updateSoundUI();
  updatePlayUI();
  syncVariantButtons();

  if (globalThis.STUDIO_SCENE && typeof globalThis.STUDIO_SCENE.mount === "function" && canvas) {
    try {
      controller = globalThis.STUDIO_SCENE.mount(canvas, {
        sceneId: CONFIG.sceneId,
        theme: state.theme,
        variant: state.variant,
        params: { ...state.params },
        step: STEPS[state.step] || null,
        steps: STEPS,
        simModel: runSim,
        getSize: () => ({
          width: canvas.clientWidth || window.innerWidth,
          height: canvas.clientHeight || window.innerHeight,
          dpr: Math.min(window.devicePixelRatio || 1, 2),
        }),
      });
    } catch (err) {
      console.error("[studio] scene mount failed:", err);
    }
  }

  // Apply initial step & theme to mounted scene
  if (controller?.setTheme) {
    try {
      controller.setTheme(state.theme);
    } catch (err) {
      console.error("[studio] setTheme threw:", err);
      recordIssue("runtime", "setTheme", err);
    }
  }
  seekStep(state.step);

  // ---- Main Render & Media Sync Loop ----
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    const simFn = getSimFn();
    if (simFn && simFn.length >= 3) {
      const elapsedSec = Math.max(0, (now - stepStartTime) / 1000);
      state.simOut = runSim(state.params, state.variant, elapsedSec, true);
      updateTelemetry(true);
      evaluateChallenge(true);
    }

    if (controller?.update) {
      try {
        controller.update(dt, state.simOut, { ...state.params }, STEPS[state.step]);
      } catch (err) {
        logStepError("controller.update", "[studio] controller.update threw:", err);
      }
    }

    if (state.playing) {
      if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
        setProgress(audioEl.currentTime / audioEl.duration);
      } else if (!audioEl) {
        const elapsed = (now - silentTimerStart) / 1000;
        setProgress(elapsed / Math.max(0.5, silentDuration));
        if (elapsed >= silentDuration) onStepMediaFinished();
      }
    }

    layoutCallouts();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---- Deterministic Headless QA API ----
  window.__studio = {
    get steps() {
      return STEPS;
    },
    get currentStep() {
      return state.step;
    },
    get variant() {
      return state.variant;
    },
    seekStep: (k) => seekStep(k),
    setVariant: (name) => setVariant(name),
    setSim: (patch) => setSim(patch),
    setTheme: (t) => setTheme(t),
    toggleControls: (open) => toggleControls(open),
    diagnostics: () => ({
      engineKind: controller?.engineKind ?? (document.querySelector?.(".ec-svg") ? "C" : "A"),
      registeredIds: typeof controller?.getRegisteredIds === "function" ? controller.getRegisteredIds() : null,
      cameraPresets: typeof controller?.getCameraPresets === "function" ? controller.getCameraPresets() : null,
      variantKeys: Array.from(variantKeys),
      controls: CONTROLS.slice(),
      stepsMeta: STEPS.map((s, idx) => ({
        step: idx,
        rawCalloutCount: s.rawCalloutCount ?? (s.callouts || []).length,
        callouts: (s.callouts || []).map((c) => c.target),
        focus: s.focus,
        reveal: s.reveal,
        cameraPreset: s.camera?.preset ?? null,
        simKeys: Object.keys(s.sim || {}),
        hasTryOut: Boolean(s.tryOut),
        tryOutCompiledOk: s.tryOut ? !tryOutCompileErrors.has(idx) : true,
      })),
      compileErrors: compileErrors.slice(),
      runtimeIssues: runtimeIssues.slice(),
    }),
    state: () => ({
      sceneId: CONFIG.sceneId,
      step: state.step,
      stepTitle: STEPS[state.step]?.title ?? "",
      variant: state.variant,
      theme: state.theme,
      playing: state.playing,
      soundOn: state.soundOn,
      controlsOpen: state.controlsOpen,
      captionsOpen: !state.captionsCollapsed,
      params: { ...state.params },
      sim: state.simOut,
      telemetry: state.telemetrySnapshot.slice(),
      callouts: state.calloutBoxes.slice(),
      challenge: {
        active: Boolean(STEPS[state.step]?.tryOut && challengeEl && !challengeEl.hidden),
        verified: state.verifiedSteps.has(state.step),
        prompt: STEPS[state.step]?.tryOut?.prompt ?? null,
      },
    }),
  };
}

/**
 * Generates a complete standalone HTML string for the frameless Cinema-Minimal Director shell.
 *
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.about]
 * @param {string} [o.sceneId]
 * @param {"light"|"dark"} [o.themeDefault="light"]
 * @param {{ name: string, label: string, defaults?: Record<string, number|string|boolean> }[]} [o.variants]
 * @param {{ id: string, label: string, min: number, max: number, step?: number, unit?: string }[]} [o.controls]
 * @param {object[]} [o.steps]
 * @param {{ id: string, label: string, formatSrc?: string|Function }[]} [o.telemetry]
 * @param {object|null} [o.voice]
 * @param {string} [o.modelSrc]
 * @param {string} [o.engineBundle]
 */
export function studioPage(o = {}) {
  const title = String(o.title ?? "Studio");
  const about = String(o.about ?? "");
  const hint = o.hint === undefined ? "Drag to orbit · Scroll to zoom" : String(o.hint ?? "");
  const sceneId = String(o.sceneId ?? "studio");
  const themeDefault = o.themeDefault === "dark" ? "dark" : "light";
  const variants = normalizeVariants(o.variants);
  const controls = normalizeControls(o.controls);
  const steps = normalizeSteps(o.steps);
  const telemetry = normalizeTelemetry(o.telemetry);
  const hasAnyChallenge = steps.some((s) => Boolean(s.tryOut));

  const config = {
    title,
    about,
    sceneId,
    themeDefault,
    variants,
    controls,
    steps,
    telemetry,
    voice: o.voice ?? null,
  };

  const stepPillsHtml = steps
    .map(
      (s, i) =>
        `<button type="button" class="sd-step" data-step="${i}" title="${esc(s.title)}"${i === 0 ? ' aria-current="step"' : ""}><span class="sd-step-num">${String(i + 1).padStart(2, "0")}</span><span class="sd-step-name">${esc(s.tab)}</span></button>`,
    )
    .join("");

  const variantsHtml = variants.length
    ? `<div class="sd-divider" aria-hidden="true"></div><div class="sd-variants" role="group" aria-label="What-if presets">${variants
        .map(
          (v, i) =>
            `<button type="button" class="sd-variant-btn" data-variant="${esc(v.name)}" aria-pressed="${i === 0}">${esc(v.label)}</button>`,
        )
        .join("")}</div>`
    : "";

  const controlsHtml = controls
    .map(
      (c) =>
        `<label class="sd-control"><span class="sd-control-label">${esc(c.label)}</span><input type="range" data-control="${esc(c.id)}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.min}" aria-label="${esc(c.label)}"><span class="sd-control-val" data-control-val="${esc(c.id)}"></span></label>`,
    )
    .join("");

  const tuneToggleHtml = controls.length
    ? `<button type="button" class="sd-btn sd-btn-toggle" id="sd-tune-btn" aria-pressed="false" aria-controls="sd-tune">${ICONS.tune}<span>Tune</span></button>`
    : "";

  const challengeToggleHtml = hasAnyChallenge
    ? `<button type="button" class="sd-btn sd-btn-toggle" id="sd-challenge-btn" aria-pressed="false" aria-controls="sd-challenge"><span>Challenge</span></button>`
    : "";

  const extrasDivider = controls.length || hasAnyChallenge ? `<div class="sd-divider" aria-hidden="true"></div>` : "";
  const cleanedModel = safeScript(stripExports(o.modelSrc));
  const cleanedBundle = safeScript(o.engineBundle);

  return `<!doctype html>
<html lang="en" data-theme="${themeDefault}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
${directorCss()}
</style>
</head>
<body data-theme="${themeDefault}" data-scene="${esc(sceneId)}" data-controls-open="false">
  <main class="sd-stage" aria-label="${esc(title)} interactive stage">
    <canvas id="studio-canvas"></canvas>
  </main>

  <div class="sd-callouts" id="sd-callouts" aria-hidden="true">
    <svg class="sd-callout-svg" id="sd-callout-svg"></svg>
  </div>

  <header class="sd-top">
    <div class="sd-brand">
      <h1 class="sd-title">${esc(title)}</h1>
      ${about ? `<p class="sd-about">${esc(about)}</p>` : ""}
      ${hint ? `<span class="sd-hint">${esc(hint)}</span>` : ""}
    </div>
    <nav class="sd-steps" id="sd-steps" aria-label="Story steps">${stepPillsHtml}</nav>
    <div class="sd-right">
      <div class="sd-telemetry" id="sd-telemetry" aria-live="polite"></div>
      <div class="sd-utils">
        <button type="button" class="sd-util-btn" id="sd-theme-btn" aria-label="Toggle color theme">${ICONS.theme}<span>${themeDefault === "dark" ? "Light" : "Dark"}</span></button>
        <button type="button" class="sd-util-btn" id="sd-sound-btn" aria-pressed="true" aria-label="Toggle narration sound">${ICONS.sound}<span>Sound</span></button>
      </div>
    </div>
  </header>

  <aside class="sd-challenge" id="sd-challenge" data-verified="false" aria-live="polite" hidden>
    <div class="sd-challenge-head">
      <span class="sd-challenge-kicker">Now you try</span>
      <span class="sd-challenge-badge">✓ Verified</span>
    </div>
    <p class="sd-challenge-prompt" id="sd-challenge-prompt"></p>
    <p class="sd-challenge-status" id="sd-challenge-status"></p>
    <div class="sd-challenge-actions">
      <button type="button" class="sd-continue-btn" id="sd-continue-btn">Continue →</button>
    </div>
  </aside>

  <div class="sd-subtitle-wrap">
    <button type="button" class="sd-subtitle" id="sd-subtitle" data-collapsed="false" aria-pressed="true" title="Click to toggle captions">
      <span class="sd-subtitle-text" id="sd-subtitle-text"></span>
      <span class="sd-subtitle-cc">CC</span>
      <span class="sd-sub-progress" aria-hidden="true"><i id="sd-sub-progress-fill"></i></span>
    </button>
  </div>

  <section class="sd-tune" id="sd-tune" aria-label="Live simulation controls" hidden>${controlsHtml}</section>

  <footer class="sd-dock" role="toolbar" aria-label="Playback and controls">
    <div class="sd-dock-group">
      <button type="button" class="sd-btn sd-btn-icon" id="sd-prev" aria-label="Previous step">${ICONS.prev}</button>
      <button type="button" class="sd-btn sd-btn-play" id="sd-play" data-playing="false" aria-label="Play narration">${ICONS.play}${ICONS.pause}<span class="sd-play-label">Play</span></button>
      <button type="button" class="sd-btn sd-btn-icon" id="sd-next" aria-label="Next step">${ICONS.next}</button>
    </div>
    ${variantsHtml}
    ${extrasDivider}
    <div class="sd-dock-group">
      ${tuneToggleHtml}
      ${challengeToggleHtml}
      <button type="button" class="sd-btn sd-btn-icon" id="sd-reset-btn" aria-label="Reset camera view" title="Reset view">${ICONS.reset}</button>
    </div>
  </footer>

<script>
${cleanedModel}
${cleanedBundle}
const STUDIO_CONFIG = ${safeJson(config)};
(${directorRuntime.toString()})(STUDIO_CONFIG, typeof simModel === "function" ? simModel : null);
</script>
</body>
</html>
`;
}
