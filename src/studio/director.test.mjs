import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { studioPage, esc } from "./director.mjs";

const sampleSpec = () => ({
  title: "High-Bypass Turbofan",
  about: "Why the giant front fan moves most of the thrust.",
  sceneId: "turbofan",
  themeDefault: "light",
  variants: [
    { name: "airliner", label: "Airliner 8:1", defaults: { bypassRatio: 8, throttle: 0.85 } },
    { name: "fighter", label: "Fighter 1:1", defaults: { bypassRatio: 1, throttle: 0.85 } },
  ],
  controls: [
    { id: "throttle", label: "Throttle", min: 0.2, max: 1.0, step: 0.05, unit: "%" },
    { id: "bypassRatio", label: "Bypass ratio", min: 1, max: 12, step: 0.5, unit: ":1" },
  ],
  steps: [
    {
      step: 0,
      tab: "Overview",
      title: "Two air streams, one shaft",
      narration: "Most air bypasses the hot core entirely.",
      focus: null,
      accents: null,
      reveal: null,
      camera: { preset: "hero", zoom: 1.0 },
      sim: { throttle: 0.85, bypassRatio: 8 },
      callouts: [
        { target: "fan", label: "Giant front fan" },
        { target: "core", label: "Hot gas core" },
        { target: "nozzle", label: "Should be dropped by max-2 cap" },
        { target: "shroud", label: "Also dropped" },
      ],
      tryOut: null,
    },
    {
      step: 1,
      tab: "Challenge",
      title: "Push a fighter to full power",
      narration: "Switch to Fighter (1:1) and push throttle past 90%.",
      focus: ["core", "nozzle"],
      accents: { core: "orange" },
      reveal: ["fan", "core", "nozzle"],
      camera: { preset: "rear", zoom: 1.15 },
      sim: { throttle: 0.75, bypassRatio: 8 },
      callouts: [{ target: "nozzle", label: "Core jet exhaust" }],
      tryOut: {
        prompt: "Switch to Fighter (1:1) and push throttle past 90% to see why exhaust dominates thrust.",
        successText: "At 1:1 bypass and >90% throttle, high-velocity core exhaust dominates thrust.",
        checkSrc: (sim, params, variant) => variant === "fighter" && params.throttle >= 0.9 && sim.coreShare > 0.45,
      },
    },
  ],
  telemetry: [
    { id: "bypass", label: "Bypass", formatSrc: "(sim, p) => `${p.bypassRatio}:1`" },
    { id: "fanShare", label: "Fan push", formatSrc: (sim) => `${Math.round(sim.fanShare * 100)}%` },
  ],
  voice: {
    variants: {
      airliner: [
        { audio: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=", duration: 3.2, text: "Most air bypasses the hot core." },
        { audio: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=", duration: 2.8, text: "Now test a fighter ratio." },
      ],
    },
  },
  modelSrc: `export function simModel(params, variant) {
    const bpr = Number(params.bypassRatio ?? 8);
    const fanShare = bpr / (bpr + 1.8);
    return { bypassRatio: bpr, throttle: params.throttle, fanShare, coreShare: 1 - fanShare, variant };
  }`,
  engineBundle: `globalThis.STUDIO_SCENE = { mount() { return { update() {}, setCamera() {}, setFocus() {}, setReveal() {}, getCalloutPos() { return null; }, setTheme() {}, resetCamera() {} }; } };`,
});

function extractConfig(html) {
  const m = html.match(/const STUDIO_CONFIG = (\{[\s\S]*?\});\n\(/);
  assert.ok(m, "STUDIO_CONFIG JSON should be embedded in the page script");
  return JSON.parse(m[1]);
}

function extractInlineScript(html) {
  const m = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
  assert.ok(m, "Inline <script> block should exist");
  return m[1];
}

test("studioPage generates standalone HTML with zero external script/link dependencies and inlined fonts", () => {
  const html = studioPage(sampleSpec());
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<canvas id="studio-canvas"><\/canvas>/);
  assert.match(html, /data:font\/woff2;base64,/);

  // Zero external script src or link href or CSS http url imports
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=/i);
  assert.doesNotMatch(html, /url\(\s*["']?https?:\/\//i);

  // Inline script parses cleanly with zero syntax errors
  const script = extractInlineScript(html);
  assert.doesNotThrow(() => new vm.Script(script));
});

test("studioPage embeds simModel (export stripped) and engineBundle", () => {
  const html = studioPage(sampleSpec());
  const script = extractInlineScript(html);
  assert.match(script, /function simModel\(params, variant\)/);
  assert.doesNotMatch(script, /^\s*export\s+function\s+simModel/m);
  assert.match(script, /globalThis\.STUDIO_SCENE\s*=/);
  assert.match(script, /window\.__studio\s*=/);
});

test("studioPage enforces hard max-2 callouts cap in serialized step data", () => {
  const html = studioPage(sampleSpec());
  const cfg = extractConfig(html);
  assert.equal(cfg.steps[0].callouts.length, 2);
  assert.deepEqual(cfg.steps[0].callouts, [
    { target: "fan", label: "Giant front fan" },
    { target: "core", label: "Hot gas core" },
  ]);
  assert.equal(cfg.steps[1].callouts.length, 1);
  assert.doesNotMatch(html, /Should be dropped by max-2 cap/);
});

test("studioPage handles voice tracks cleanly (both populated and null)", () => {
  const withVoice = extractConfig(studioPage(sampleSpec()));
  assert.equal(withVoice.voice.variants.airliner.length, 2);
  assert.equal(withVoice.voice.variants.airliner[0].duration, 3.2);

  const specNoVoice = { ...sampleSpec(), voice: null };
  const withoutVoice = extractConfig(studioPage(specNoVoice));
  assert.equal(withoutVoice.voice, null);
  assert.doesNotThrow(() => new vm.Script(extractInlineScript(studioPage(specNoVoice))));
});

test("studioPage serializes tryOut predicates and telemetry formatters from both strings and functions", () => {
  const cfg = extractConfig(studioPage(sampleSpec()));
  assert.equal(typeof cfg.steps[1].tryOut.checkSrc, "string");
  assert.match(cfg.steps[1].tryOut.checkSrc, /fighter/);
  assert.equal(typeof cfg.telemetry[0].formatSrc, "string");
  assert.equal(typeof cfg.telemetry[1].formatSrc, "string");
  assert.match(cfg.telemetry[1].formatSrc, /fanShare/);
});

test("studioPage escapes HTML in titles, subtitles, tabs, labels, and prevents </script> breakout", () => {
  const xssSpec = {
    ...sampleSpec(),
    title: `Jet <img src=x onerror=alert(1)> & "Turbo"`,
    about: `<b>Bold</b> & 'quoted'`,
    sceneId: `bad" onclick="x`,
    variants: [{ name: `v"1`, label: `<script>evil()</script>`, defaults: {} }],
    controls: [{ id: "c1", label: `<svg onload=1>`, min: 0, max: 1, step: 0.1, unit: "" }],
    steps: [
      {
        step: 0,
        tab: `<b>Tab</b>`,
        title: `Title </script><script>alert(1)</script>`,
        narration: `Close </script> safely`,
        callouts: [{ target: "a", label: `<script>x</script>` }],
      },
    ],
  };

  const html = studioPage(xssSpec);
  assert.equal(esc(`<a "b" 'c' &>`), "&lt;a &quot;b&quot; &#39;c&#39; &amp;&gt;");
  assert.match(html, /<title>Jet &lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;Turbo&quot;<\/title>/);
  assert.match(html, /&lt;b&gt;Bold&lt;\/b&gt; &amp; &#39;quoted&#39;/);
  assert.match(html, /&lt;b&gt;Tab&lt;\/b&gt;/);
  assert.match(html, /&lt;svg onload=1&gt;/);

  // Exactly one opening and one closing script tag in the entire document
  assert.equal((html.match(/<script>/gi) || []).length, 1);
  assert.equal((html.match(/<\/script>/gi) || []).length, 1);
  assert.doesNotThrow(() => new vm.Script(extractInlineScript(html)));
});

test("embedded runtime exposes window.__studio, evaluates live tryOut, and resolves overlapping callouts", () => {
  const spec = sampleSpec();
  // Engine returning two identical projected coordinates to test deterministic 2D AABB repulsion
  spec.engineBundle = `
    globalThis.__calls = [];
    globalThis.STUDIO_SCENE = {
      mount(canvas, ctx) {
        return {
          update(dt, simOut, params, step) { globalThis.__lastUpdate = { simOut, params, step }; },
          setCamera(preset, zoom) { globalThis.__calls.push(["camera", preset, zoom]); },
          setFocus(ids, accents) { globalThis.__calls.push(["focus", ids, accents]); },
          setReveal(ids) { globalThis.__calls.push(["reveal", ids]); },
          getCalloutPos(target) {
            if (target === "fan") return { x: 640, y: 360, visible: true };
            if (target === "core") return { x: 642, y: 362, visible: true };
            if (target === "nozzle") return { x: 700, y: 360, visible: true };
            return null;
          },
          setTheme(t) { globalThis.__calls.push(["theme", t]); },
          resetCamera() { globalThis.__calls.push(["reset"]); },
        };
      },
    };
  `;

  const html = studioPage(spec);
  const script = extractInlineScript(html);

  const makeEl = (tag = "div") => {
    const attrs = new Map();
    const children = [];
    const el = {
      tagName: tag.toUpperCase(),
      dataset: {},
      style: {},
      hidden: false,
      textContent: "",
      value: "",
      offsetWidth: 130,
      offsetHeight: 30,
      clientWidth: 1280,
      clientHeight: 720,
      children,
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) ?? null; },
      removeAttribute(k) { attrs.delete(k); },
      addEventListener() {},
      append(...nodes) { children.push(...nodes); },
      appendChild(node) { children.push(node); return node; },
      replaceChildren(...nodes) { children.length = 0; children.push(...nodes); },
      remove() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
    };
    return el;
  };

  const ids = new Map(
    [
      "studio-canvas", "sd-steps", "sd-telemetry", "sd-theme-btn", "sd-sound-btn",
      "sd-callouts", "sd-callout-svg", "sd-challenge", "sd-challenge-prompt",
      "sd-challenge-status", "sd-continue-btn", "sd-subtitle", "sd-subtitle-text",
      "sd-sub-progress-fill", "sd-tune", "sd-tune-btn", "sd-challenge-btn",
      "sd-prev", "sd-play", "sd-next", "sd-reset-btn",
    ].map((id) => [id, makeEl()]),
  );

  const documentMock = {
    documentElement: makeEl("html"),
    body: makeEl("body"),
    getElementById: (id) => ids.get(id) ?? null,
    createElement: (tag) => makeEl(tag),
    createElementNS: (_ns, tag) => makeEl(tag),
    createDocumentFragment: () => makeEl("fragment"),
    querySelectorAll: () => [],
  };

  const windowMock = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    location: { hash: "#theme=dark&step=0" },
    addEventListener() {},
    document: documentMock,
  };

  const sandbox = {
    window: windowMock,
    document: documentMock,
    performance: { now: () => 1000 },
    requestAnimationFrame: () => 1,
    URLSearchParams,
    Audio: class { play() { return Promise.resolve(); } pause() {} },
    console,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(script, sandbox);

  const api = windowMock.__studio;
  assert.ok(api, "window.__studio should be exposed");
  assert.equal(api.state().theme, "dark");
  assert.equal(api.currentStep, 0);
  assert.equal(api.variant, "airliner");

  // Callout repulsion check: 2 nearly identical anchors must NOT overlap each other
  const boxes = api.state().callouts;
  assert.equal(boxes.length, 2);
  const [a, b] = boxes;
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  assert.ok(overlapX <= 0 || overlapY <= 0, `Callouts must not overlap: ${JSON.stringify(boxes)}`);

  // Micro-challenge live verification check
  api.seekStep(1);
  assert.equal(api.currentStep, 1);
  assert.equal(api.state().challenge.active, true);
  assert.equal(api.state().challenge.verified, false);

  api.setVariant("fighter");
  api.setSim({ throttle: 0.95 });
  assert.equal(api.variant, "fighter");
  assert.equal(api.state().challenge.verified, true);

  // Controls toggle & theme switch
  api.toggleControls(true);
  assert.equal(api.state().controlsOpen, true);
  api.setTheme("light");
  assert.equal(api.state().theme, "light");
});

function runRuntime(spec, opts = {}) {
  const html = studioPage(spec);
  const script = extractInlineScript(html);

  const makeEl = (tag = "div") => {
    const attrs = new Map();
    const children = [];
    return {
      tagName: tag.toUpperCase(),
      dataset: {},
      style: {},
      hidden: false,
      textContent: "",
      value: "",
      offsetWidth: 130,
      offsetHeight: 30,
      clientWidth: 1280,
      clientHeight: 720,
      children,
      setAttribute(k, v) { attrs.set(k, String(v)); },
      getAttribute(k) { return attrs.get(k) ?? null; },
      removeAttribute(k) { attrs.delete(k); },
      addEventListener() {},
      append(...nodes) { children.push(...nodes); },
      appendChild(node) { children.push(node); return node; },
      replaceChildren(...nodes) { children.length = 0; children.push(...nodes); },
      remove() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
    };
  };

  const ids = new Map(
    [
      "studio-canvas", "sd-steps", "sd-telemetry", "sd-theme-btn", "sd-sound-btn",
      "sd-callouts", "sd-callout-svg", "sd-challenge", "sd-challenge-prompt",
      "sd-challenge-status", "sd-continue-btn", "sd-subtitle", "sd-subtitle-text",
      "sd-sub-progress-fill", "sd-tune", "sd-tune-btn", "sd-challenge-btn",
      "sd-prev", "sd-play", "sd-next", "sd-reset-btn",
    ].map((id) => [id, makeEl()]),
  );

  const documentMock = {
    documentElement: makeEl("html"),
    body: makeEl("body"),
    getElementById: (id) => ids.get(id) ?? null,
    createElement: (tag) => makeEl(tag),
    createElementNS: (_ns, tag) => makeEl(tag),
    createDocumentFragment: () => makeEl("fragment"),
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  const windowMock = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    location: { hash: opts.hash ?? "" },
    addEventListener() {},
    document: documentMock,
  };

  let nowMs = opts.initialNow ?? 1000;
  let rafCallback = null;
  const errors = [];
  const consoleMock = {
    log: () => {},
    warn: () => {},
    error: (...args) => { errors.push(args); },
  };

  const sandbox = {
    window: windowMock,
    document: documentMock,
    performance: { now: () => nowMs },
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    URLSearchParams,
    Audio: class { play() { return Promise.resolve(); } pause() {} },
    console: consoleMock,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(script, sandbox);

  return {
    api: windowMock.__studio,
    errors,
    stepFrame(deltaMs) {
      nowMs += deltaMs;
      const cb = rafCallback;
      rafCallback = null;
      if (cb) cb(nowMs);
    },
    setNow(ms) { nowMs = ms; },
    sandbox,
  };
}

test("diagnostics() exposes rawCalloutCount, registeredIds, cameraPresets, controls, and clean compile state", () => {
  const spec = sampleSpec();
  spec.engineBundle = `
    globalThis.STUDIO_SCENE = {
      mount() {
        return {
          engineKind: "A",
          getRegisteredIds() { return ["fan", "core", "nozzle"]; },
          getCameraPresets() { return ["hero", "rear", "side"]; },
          update() {},
          setCamera() {},
          setFocus() {},
          setReveal() {},
          getCalloutPos() { return { x: 400, y: 300, visible: true }; },
          setTheme() {},
          resetCamera() {},
        };
      },
    };
  `;

  const cfg = extractConfig(studioPage(spec));
  assert.equal(cfg.steps[0].rawCalloutCount, 4);
  assert.equal(cfg.steps[0].callouts.length, 2);
  assert.equal(cfg.steps[1].rawCalloutCount, 1);

  const { api, errors } = runRuntime(spec);
  assert.equal(errors.length, 0);

  const diag = JSON.parse(JSON.stringify(api.diagnostics()));
  assert.equal(diag.engineKind, "A");
  assert.deepEqual(diag.registeredIds, ["fan", "core", "nozzle"]);
  assert.deepEqual(diag.cameraPresets, ["hero", "rear", "side"]);
  assert.deepEqual(diag.variantKeys, ["bypassRatio"]);
  assert.equal(diag.controls.length, 2);
  assert.deepEqual(diag.compileErrors, []);
  assert.equal(diag.stepsMeta.length, 2);
  assert.equal(diag.stepsMeta[0].rawCalloutCount, 4);
  assert.deepEqual(diag.stepsMeta[0].callouts, ["fan", "core"]);
  assert.equal(diag.stepsMeta[0].cameraPreset, "hero");
  assert.equal(diag.stepsMeta[1].hasTryOut, true);
  assert.equal(diag.stepsMeta[1].tryOutCompiledOk, true);
});

test("runtime logs console.error on broken checkSrc, throwing simModel, telemetry, and controller.update (throttled per step)", () => {
  const spec = sampleSpec();
  spec.steps[1].tryOut.checkSrc = "((broken syntax =>";
  spec.telemetry = [
    { id: "badTel", label: "Broken", formatSrc: "() => { throw new Error('tel-boom'); }" },
  ];
  spec.modelSrc = `export function simModel(params) {
    if (params.throttle > 0.9) throw new Error("sim-boom");
    return { ...params, fanShare: 0.7, coreShare: 0.3 };
  }`;
  spec.engineBundle = `
    globalThis.STUDIO_SCENE = {
      mount() {
        return {
          update() { throw new Error("update-boom"); },
          setCamera() {},
          setFocus() {},
          setReveal() {},
          getCalloutPos() { return null; },
          setTheme() {},
          resetCamera() {},
        };
      },
    };
  `;

  const { api, errors, stepFrame } = runRuntime(spec);

  const messages = () => errors.map((args) => args.map(String).join(" "));
  assert.ok(
    messages().some((m) => m.includes("[studio] failed to compile tryOut:step1")),
    `expected tryOut compile error, got: ${JSON.stringify(messages())}`,
  );
  assert.ok(
    messages().some((m) => m.includes("[studio] telemetry formatter threw (badTel)")),
    `expected telemetry error, got: ${JSON.stringify(messages())}`,
  );
  assert.ok(
    messages().some((m) => m.includes("[studio] controller.update threw")),
    `expected update error, got: ${JSON.stringify(messages())}`,
  );

  const diag = api.diagnostics();
  assert.equal(diag.compileErrors.length, 1);
  assert.equal(diag.stepsMeta[1].tryOutCompiledOk, false);

  // Repeated RAF frames on the same step should throttle controller.update errors to once per step
  const updateErrCountBefore = messages().filter((m) => m.includes("controller.update threw")).length;
  stepFrame(16);
  stepFrame(16);
  stepFrame(16);
  const updateErrCountAfter = messages().filter((m) => m.includes("controller.update threw")).length;
  assert.equal(updateErrCountAfter, updateErrCountBefore);

  // Trigger simModel throw
  api.setSim({ throttle: 0.99 });
  assert.ok(
    messages().some((m) => m.includes("[studio] simModel threw")),
    `expected simModel error, got: ${JSON.stringify(messages())}`,
  );

  // Seeking to another step clears per-step throttle so update error logs again on the new step
  api.seekStep(1);
  const updateErrCountStep1 = messages().filter((m) => m.includes("controller.update threw")).length;
  assert.equal(updateErrCountStep1, updateErrCountAfter + 1);
});

test("3-arg simModel(params, variant, t) receives live elapsed seconds on tick while 2-arg simModel does not re-run per frame", () => {
  // 3-arg cyclic simModel
  const spec3 = sampleSpec();
  spec3.telemetry = [{ id: "angle", label: "Angle", formatSrc: "(sim) => `${Math.round(sim.angle)}deg`" }];
  spec3.modelSrc = `
    globalThis.__simCalls = [];
    export function simModel(params, variant, t) {
      globalThis.__simCalls.push(t);
      return { ...params, variant, t, angle: (t * 360) % 720, fanShare: 0.5, coreShare: 0.5 };
    }
  `;
  const r3 = runRuntime(spec3, { initialNow: 5000 });
  assert.equal(r3.api.state().sim.t, 0);
  r3.stepFrame(500);
  assert.ok(Math.abs(r3.api.state().sim.t - 0.5) < 1e-6, `expected t=0.5, got ${r3.api.state().sim.t}`);
  assert.equal(r3.api.state().telemetry[0].value, "180deg");

  // Seeking resets step elapsed clock to 0
  r3.api.seekStep(1);
  assert.equal(r3.api.state().sim.t, 0);
  r3.stepFrame(250);
  assert.ok(Math.abs(r3.api.state().sim.t - 0.25) < 1e-6);

  // 2-arg simModel should NOT be invoked by RAF tick
  const spec2 = sampleSpec();
  spec2.modelSrc = `
    globalThis.__sim2Count = 0;
    export function simModel(params, variant) {
      globalThis.__sim2Count++;
      return { ...params, variant, fanShare: 0.8, coreShare: 0.2 };
    }
  `;
  const r2 = runRuntime(spec2);
  const countAfterInit = r2.sandbox.__sim2Count;
  r2.stepFrame(16);
  r2.stepFrame(16);
  assert.equal(r2.sandbox.__sim2Count, countAfterInit);
});
