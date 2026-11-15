import { compile, type Compiled, type Frame, type StepInfo } from "../core/scene.ts";
import { frameIndexAt } from "../core/timeline.ts";
import { TRUST_LABEL, TRUST_MEANING } from "../core/trust.ts";
import type { LabelMark, Panel, Resolved, Scene } from "../core/types.ts";
import { createStage, fitViewBox, type StageRenderer } from "./svg.ts";
import { clearOf, silhouettes } from "./clear.ts";
import { createUnfoldStage, type UnfoldStage } from "../unfold/stage.ts";

/** Quiet synthesised cues for a listening tour: a card turning, a slide away, a found chime. */
function playCue(a: AudioContext, kind: "flip" | "slide" | "chime"): void {
  const now = a.currentTime, out = a.createGain();
  out.connect(a.destination);
  const noise = (dur: number) => {
    const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    let seed = 11;
    for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 1073741823.5 - 1) * (1 - i / d.length); }
    const src = a.createBufferSource();
    src.buffer = b;
    return src;
  };
  if (kind === "chime") {
    for (const [f, delay] of [[659.25, 0], [987.77, 0.11]] as const) {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + delay); g.gain.exponentialRampToValueAtTime(0.15, now + delay + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.4);
      o.connect(g).connect(a.destination); o.start(now + delay); o.stop(now + delay + 1.5);
    }
    return;
  }
  const s = noise(kind === "flip" ? 0.16 : 0.55), f = a.createBiquadFilter();
  f.type = kind === "flip" ? "bandpass" : "lowpass";
  f.frequency.setValueAtTime(kind === "flip" ? 2400 : 2600, now);
  if (kind === "slide") f.frequency.exponentialRampToValueAtTime(300, now + 0.5);
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(kind === "flip" ? 0.22 : 0.11, now + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "flip" ? 0.16 : 0.55));
  s.connect(f).connect(out);
  s.start(now);
}

/**
 * Labels scale with the drawing but stay readable: LABEL_UNITS world units
 * tall, clamped to LABEL_MIN..LABEL_MAX CSS px.
 */
const LABEL_UNITS = 6;
const LABEL_MIN = 11;
const LABEL_MAX = 14;

const ICONS = {
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h2v12H3zM14 2v12L6 8z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2h2v12h-2zM2 2v12l8-6z"/></svg>',
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h3.5v12H3zM9.5 2H13v12H9.5z"/></svg>',
  restart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3a5 5 0 1 1-4.9 6h1.7A3.4 3.4 0 1 0 8 4.6V7L4.5 3.8 8 .6z"/></svg>',
};

export interface PlayerApi {
  compiled: Compiled;
  stage: StageRenderer;
  root: HTMLElement;
  /** Show the frame at time t (ms). Pauses playback. */
  seek(t: number): void;
  /** Show step k at rest. Pauses playback. */
  seekStep(k: number): void;
  play(): void;
  pause(): void;
  time(): number;
  frame(): Frame;
  /** The step whose caption and panels are on screen. */
  shownIndex(): number;
  viewBox: [number, number, number, number];
  /** Stop playback, disconnect every listener and remove the figure. */
  destroy(): void;
}

export interface MountOptions {
  /**
   * Standalone page: read and write #step= in the URL, publish window.__viz
   * for checks, and theme the page body. Off by default, so several figures
   * can share a page or live inside an app.
   */
  page?: boolean;
  /** Force a theme instead of following the reader's preference. */
  theme?: "light" | "dark";
  /** Internal: the "What if?" family this scene was switched to from. */
  family?: { label: string; scene: Scene<any, any> }[];
  /** Internal: which member of the family is shown. */
  chosen?: number;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function readHashStep(): number | null {
  const m = /(?:^|[#&])step=(\d+)/.exec(location.hash);
  return m ? Number(m[1]) : null;
}

export function mount<S, E>(host: HTMLElement, sceneIn: Scene<S, E>, options: MountOptions = {}): PlayerApi {
  const page = options.page ?? false;
  // "What if?": the scene as told, then its alternatives. A page link can open one (#what=k).
  const family = options.family ?? (sceneIn.whatIf?.length ? [{ label: "As told", scene: sceneIn }, ...sceneIn.whatIf] : []);
  const whatHash = page && options.chosen === undefined ? Number(new URLSearchParams(location.hash.slice(1)).get("what") ?? 0) : 0;
  const chosen = options.chosen ?? (Number.isInteger(whatHash) && whatHash > 0 && whatHash < family.length ? whatHash : 0);
  if (chosen > 0 && options.chosen === undefined) return mount(host, family[chosen]!.scene as Scene<S, E>, { ...options, family, chosen });
  const scene = sceneIn;
  const cleanup: (() => void)[] = [];
  const compiled = compile(scene);
  const { steps, timeline } = compiled;
  const projection = scene.projection ?? "iso";
  const last = steps.length - 1;
  const editorial = scene.presentation === "editorial";

  const geometryBox = fitViewBox(
    steps.map((s) => editorial ? s.marks.filter((m) => m.kind !== "label") : s.marks),
    projection,
    editorial ? 10 : 18,
  );
  let viewBox = geometryBox;
  const stageLabel = `${scene.title}. ${scene.question} Use the step controls or the arrow keys.`;
  const unfold: UnfoldStage | null = scene.look ? createUnfoldStage(steps, scene.look, stageLabel) : null;
  const stage: StageRenderer = unfold ?? createStage(viewBox, projection, stageLabel);

  // ---- DOM -------------------------------------------------------------
  const root = h("div", { class: "vz", "data-scene": scene.id });
  if (editorial) root.dataset.presentation = "editorial";
  const card = h("article", { class: "vz-card" });
  const head = h("header", { class: "vz-head" });
  head.append(h("span", { class: "vz-kicker" }, escapeHtml(scene.title)));
  const themeBtn = h("button", { class: "vz-theme", type: "button" });
  head.append(themeBtn);
  const detailsBtn = h("button", {
    class: "vz-info", type: "button", "aria-haspopup": "dialog",
    "aria-controls": `${scene.id}-details`,
  }, "Details");
  const details = h("dialog", { class: "vz-drawer", id: `${scene.id}-details`, "aria-labelledby": `${scene.id}-details-title` });
  const detailsHead = h("div", { class: "vz-drawer-head" });
  const detailsClose = h("button", { class: "vz-info", type: "button", "aria-label": "Close details" }, "Close ×");
  detailsHead.append(h("h2", { id: `${scene.id}-details-title` }, "Behind the figure"), detailsClose);
  details.append(detailsHead);
  const question = h("h1", { class: "vz-question" }, escapeHtml(scene.question));
  const setup = h("p", {class:"vz-setup"},escapeHtml(scene.setup ?? ""));
  const chapters = h("nav",{class:"vz-chapters","aria-label":"Chapters"});
  const chapterButtons: {button: HTMLButtonElement; index: number}[] = [];
  if (editorial) {
    let previous = "";
    steps.forEach((s,index) => {
      if (!s.teaching || s.teaching.chapter === previous) return;
      previous = s.teaching.chapter;
      const button = h("button",{type:"button"},`<span>${String(chapterButtons.length+1).padStart(2,"0")}</span> ${escapeHtml(previous)}`);
      button.addEventListener("click",() => goTo(index));
      chapters.append(button);
      chapterButtons.push({button,index});
    });
  }

  const anyPanels = steps.some((s) => s.panels.length > 0);
  const body = h("div", { class: "vz-body", "data-panels": anyPanels ? "1" : "0" });
  const stageBox = h("div", {
    class: "vz-stage",
    tabindex: "0",
    role: "group",
    "aria-roledescription": "step-through figure",
    "aria-label": `${scene.title}. Left and right arrows step through the explanation; space plays and pauses.`,
  });
  stageBox.append(unfold ? unfold.host : stage.svg);
  // The drawing look carries the machine drawings' title block: the concept's name, what the
  // figure is computed from, and the legend as line keys.
  let tb: HTMLElement | null = null;
  if (scene.look === "drawing") {
    tb = h("div", { class: "vz-tblock", "aria-hidden": "true" });
    tb.append(h("div", { class: "vz-tb-title" }, escapeHtml(`${scene.title} · ${steps.length - 1} steps`)));
    tb.append(h("div", { class: "vz-tb-text" }, "Every position and number computed live from the model"));
    if (scene.legend?.length) {
      const keys = h("div", { class: "vz-tb-keys" });
      for (const item of scene.legend) {
        const k = h("span", { class: "vz-tb-key" });
        k.append(h("i", { "data-tone": item.tone }), document.createTextNode(item.label));
        keys.append(k);
      }
      tb.append(keys);
    }
    stageBox.append(tb);
  }
  // The camera moves, so no corner is always free: once a step settles, the title block takes the
  // first right-hand corner that no part or label covers, and steps aside when neither is free.
  let tbFor = "";
  const placeTitleBlock = (index: number) => {
    if (!tb || !unfold || tbFor === String(index)) return;
    tbFor = String(index);
    const box = stageBox.getBoundingClientRect();
    const covered = [
      ...unfold.inspect().map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
      ...[...stageBox.querySelectorAll(".vz-unfold-labels > div")].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }; }),
    ].filter((r) => r.w > 0 && r.h > 0);
    const w = tb.offsetWidth, ht = tb.offsetHeight, pad = 8;
    for (const corner of ["top", "bottom"] as const) {
      const y = corner === "top" ? 16 : box.height - 16 - ht, x = box.width - 18 - w;
      const clear = covered.every((r) => r.x > x + w + pad || r.x + r.w < x - pad || r.y > y + ht + pad || r.y + r.h < y - pad);
      if (clear) {
        tb.style.top = corner === "top" ? "16px" : "auto";
        tb.style.bottom = corner === "bottom" ? "16px" : "auto";
        tb.dataset.away = "false";
        return;
      }
    }
    tb.dataset.away = "true";
  };
  if (unfold) stageBox.dataset.renderer = "unfold";
  const panelsBox = h("aside", { class: "vz-panels", "aria-label": "Details for the current step" });
  const sideBox = h("aside", { class: "vz-side", "aria-label": "Linked mathematics for the current step" });
  const anySide = steps.some((s) => s.panels.some((p) => p.place === "side"));
  body.append(stageBox);
  if (anySide) {
    body.dataset.side = "";
    body.append(sideBox);
  }
  if (anyPanels) body.append(panelsBox);

  const caption = h("section", { class: "vz-caption", "aria-live": "polite", "aria-atomic": "true" });
  const count = h("span", { class: "vz-count", "data-role": "count" });
  const text = h("p", { class: "vz-text", "data-role": "caption" });
  const meta = h("div", { class: "vz-meta" });
  const trust = h("span", { class: "vz-trust", "data-role": "trust" });
  const readout = h("span", { class: "vz-readout", "data-role": "readout" });
  const source = h("span", { class: "vz-source", "data-role": "source" });
  meta.append(trust, readout, source);
  caption.append(count, text, meta);
  const stepHeading = h("h2",{class:"vz-step-heading", "data-role":"action"});
  // What the figure is about, top left of the stage, where the eye starts.
  // On the opening step the concept is written out too, so it can be read as well as heard.
  const concept = (steps[0]?.voice ?? "").replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1").replace(/\{([^}]+)\}/g, "$1").replace(/\bL R U\b/g, "LRU");
  const conceptEl = h("p", { class: "vz-concept" }, escapeHtml(concept));
  const prediction = h("section",{class:"vz-predict","aria-label":"Predict the next step"});
  prediction.hidden = true;
  if (editorial) {
    caption.prepend(stepHeading);
    caption.append(prediction);
  }

  const controls = h("div", { class: "vz-controls", role: "toolbar", "aria-label": "Playback" });
  const btn = (name: keyof typeof ICONS, label: string, primary = false) => {
    const b = h("button", { class: "vz-btn", type: "button", "aria-label": label, "data-action": name }, ICONS[name]);
    if (primary) b.setAttribute("data-primary", "");
    return b;
  };
  const prevBtn = btn("prev", "Previous step");
  const playBtn = btn("play", "Play", true);
  const nextBtn = btn("next", "Next step");
  const restartBtn = btn("restart", "Restart");
  const scrub = h("div", { class: "vz-scrub" });
  const range = h("input", {
    class: "vz-range",
    type: "range",
    min: "0",
    max: String(timeline.total),
    step: "1",
    value: "0",
    "aria-label": "Timeline",
  });
  scrub.append(range);
  controls.append(prevBtn, playBtn, nextBtn, scrub, restartBtn);

  const foot = h("footer", { class: "vz-foot" });
  if (scene.legend?.length) {
    const ul = h("ul", { class: "vz-legend", "aria-label": "Legend" });
    for (const item of scene.legend) {
      const li = h("li");
      li.append(h("span", { class: "vz-swatch", "data-tone":item.tone, style: `--tone: var(--t-${item.tone})`, "aria-hidden": "true" }), document.createTextNode(item.label));
      ul.append(li);
    }
    foot.append(ul);
  }
  if (scene.assumptions?.length) {
    const d = h("details", { class: "vz-details" });
    d.append(h("summary", {}, "What this model simplifies"));
    const ul = h("ul");
    for (const a of scene.assumptions) ul.append(h("li", {}, escapeHtml(a)));
    d.append(ul);
    foot.append(d);
  }
  const all = h("details", { class: "vz-details" });
  all.append(h("summary", {}, "All steps as text"));
  const ol = h("ol", { start: "0" });
  const items = steps.map((s) => {
    const li = h("li", {}, escapeHtml(s.caption) + (s.readout ? ` <span class="vz-dim">(${escapeHtml(s.readout)})</span>` : ""));
    ol.append(li);
    return li;
  });
  all.append(ol);
  foot.append(all);

  if (editorial) {
    const heading = h("div", { class: "vz-heading" });
    // The title is the concept's name, set in the display face; the question and kicker stay
    // in the Details drawer and the accessible name, not in the header.
    head.firstElementChild!.remove();
    const titleEl = h("h1", { class: "vz-title" }, escapeHtml(scene.title));
    heading.append(titleEl);
    if (scene.about) heading.append(h("p", { class: "vz-about" }, escapeHtml(scene.about)));
    setup.textContent = [scene.question, scene.setup].filter(Boolean).join(" ");
    const utilities = h("div", { class: "vz-utilities" });
    utilities.append(detailsBtn, themeBtn);
    head.append(heading, chapters, utilities);
    if (family.length > 1) {
      // "What if?": switching re-runs the model on other inputs; every version is computed.
      const bar = h("nav", { class: "vz-whatif", "aria-label": "What if" }, '<span>What if</span>');
      family.forEach((f, k) => {
        const b = h("button", { type: "button", "aria-pressed": String(k === chosen) }, escapeHtml(f.label));
        b.addEventListener("click", () => {
          if (k === chosen) return;
          const parent = root.parentElement!;
          api.destroy();
          if (page) try { history.replaceState(null, "", k ? `#what=${k}` : "#step=0"); } catch { /* sandboxed frames */ }
          const next = mount(parent, family[k]!.scene, { ...options, family, chosen: k });
          if (page) window.dispatchEvent(new Event("visualize:ready"));
          void next;
        });
        bar.append(b);
      });
      heading.append(bar);
    }

    // The primary view has one action. Longer evidence stays available in a
    // contained native dialog, with keyboard focus and Escape handled natively.
    const detailsBody = h("div", { class: "vz-drawer-body" });
    detailsBody.append(setup, h("h3", {}, "This step"), text, meta, foot);
    details.append(detailsBody);
    stageBox.append(caption);
    if (concept) stageBox.append(conceptEl);
    controls.insertBefore(count, scrub);
    card.append(head, body, controls, details);
  } else card.append(head, question, body, caption, controls, foot);
  root.append(card);
  host.append(root);
  detailsBtn.addEventListener("click", () => {
    api.pause();
    details.showModal();
  });
  detailsClose.addEventListener("click", () => details.close());
  details.addEventListener("click", (event) => {
    const r = details.getBoundingClientRect();
    if (event.target === details && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) details.close();
  });

  // ---- Theme -----------------------------------------------------------
  // The theme belongs to the figure; a standalone page mirrors it on its body.
  const media = matchMedia("(prefers-color-scheme: dark)");
  if (options.theme) root.dataset.theme = options.theme;
  const currentTheme = () => (root.dataset.theme as "light" | "dark" | undefined) ?? (media.matches ? "dark" : "light");
  const syncThemeBtn = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    themeBtn.textContent = next === "dark" ? "Dark" : "Light";
    themeBtn.setAttribute("aria-label", `Switch to ${next} theme`);
  };
  themeBtn.addEventListener("click", () => {
    root.dataset.theme = currentTheme() === "dark" ? "light" : "dark";
    if (page) document.body.dataset.theme = root.dataset.theme;
    syncThemeBtn();
    stage.refreshInk();
  });
  const onScheme = () => {
    syncThemeBtn();
    stage.refreshInk();
  };
  media.addEventListener("change", onScheme);
  cleanup.push(() => media.removeEventListener("change", onScheme));
  syncThemeBtn();

  // ---- Camera fit including labels ----------------------------------------------
  // Label size is set in screen px, so how much room labels need in world
  // units depends on the scale, which depends on the room: iterate.
  const stageLabels = (() => {
    const seen = new Map<string, LabelMark>();
    for (const st of steps) for (const m of st.marks) if (m.kind === "label" && !m.transient && !m.leaving) seen.set(`${m.key}|${m.text}|${m.at.join(",")}`, m);
    return [...seen.values()];
  })();
  // Set the view box and size labels for the scale it is actually drawn at.
  const sizeLabels = (vb: [number, number, number, number]) => {
    stage.setViewBox(vb);
    const r = stage.svg.getBoundingClientRect();
    // The viewBox is fitted with "meet", so the drawn scale is the smaller of the two fits.
    const scale = Math.min(r.width / vb[2], r.height / vb[3]);
    if (!(scale > 0)) return null;
    const px = Math.min(LABEL_MAX, Math.max(LABEL_MIN, LABEL_UNITS * scale));
    stage.svg.style.setProperty("--label-size", `${px / scale}px`);
    return scale;
  };
  const fitLabels = (g: [number, number, number, number]) => {
    let vb = g;
    for (let i = 0; i < 5; i++) {
      const scale = sizeLabels(vb);
      if (scale === null) return null;
      const m = stage.measureLabels(stageLabels);
      if (!m) break;
      const pad = 4 / scale;
      const x0 = Math.min(g[0], m[0] - pad), y0 = Math.min(g[1], m[1] - pad);
      const x1 = Math.max(g[0] + g[2], m[2] + pad), y1 = Math.max(g[1] + g[3], m[3] + pad);
      const next: [number, number, number, number] = [x0, y0, x1 - x0, y1 - y0];
      if (next.every((v, j) => Math.abs(v - vb[j]!) < 0.5)) break;
      vb = next;
    }
    return vb;
  };

  // ---- Keep the drawing clear of the caption ---------------------------------
  // The editorial caption overlays the stage's top-left. Its largest footprint
  // over every step (heading plus any prediction card with its feedback) is
  // reserved, and the view grows until no part is under it.
  const shapes = editorial ? silhouettes(steps.map((s) => s.marks), projection) : [];
  const captionFootprint = (): { left: number; top: number; width: number; height: number } | null => {
    if (!editorial || getComputedStyle(caption).position !== "absolute") return null;
    const probe = h("section", { class: "vz-caption", "aria-hidden": "true" });
    probe.style.visibility = "hidden";
    stageBox.append(probe);
    let height = 0;
    try {
      for (const s of steps) {
        const heading = h("h2", { class: "vz-step-heading" }, escapeHtml(s.teaching?.heading ?? ""));
        probe.replaceChildren(heading);
        const p = s.teaching?.prediction;
        if (p) {
          const card = h("section", { class: "vz-predict" });
          const options = h("div", { class: "vz-predict-options" });
          for (const c of p.choices) options.append(h("button", { type: "button", tabindex: "-1" }, escapeHtml(c)));
          card.append(h("span", { class: "vz-predict-kicker" }, "Predict"), h("p", {}, escapeHtml(p.question)), options, h("p", { class: "vz-predict-feedback" }, escapeHtml(p.explanation)));
          probe.append(card);
        }
        height = Math.max(height, probe.getBoundingClientRect().height);
      }
      const r = probe.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height };
    } finally {
      probe.remove();
    }
  };
  const fit = () => {
    // The Unfold stage frames itself with its camera.
    if (unfold) return;
    const cap = captionFootprint();
    let base = geometryBox;
    let vb = geometryBox;
    for (let round = 0; round < 3; round++) {
      const labelled = fitLabels(base);
      if (!labelled) return;
      vb = labelled;
      if (!cap || !shapes.length) break;
      const cleared = clearOf(vb, shapes, (box) => {
        stage.setViewBox(box);
        const r = stage.svg.getBoundingClientRect();
        const scale = Math.min(r.width / box[2], r.height / box[3]);
        if (!(scale > 0)) return null;
        const ox = r.left + (r.width - box[2] * scale) / 2, oy = r.top + (r.height - box[3] * scale) / 2;
        const gap = 12;
        return {
          x0: box[0] + (cap.left - gap - ox) / scale, x1: box[0] + (cap.left + cap.width + gap - ox) / scale,
          y0: box[1] + (cap.top - gap - oy) / scale, y1: box[1] + (cap.top + cap.height + gap - oy) / scale,
        };
      });
      if (cleared.every((v, j) => Math.abs(v - vb[j]!) < 0.5)) break;
      // Labels are sized from the scale, so fit them again around the grown view.
      base = cleared;
      vb = fitLabels(cleared) ?? cleared;
    }
    // The last fit round can end on a view box its labels were not sized for,
    // and the stage can change size with the view box: size them for the final one.
    sizeLabels(vb);
    viewBox = vb;
  };
  const resize = new ResizeObserver(fit);
  resize.observe(stage.svg);
  cleanup.push(() => resize.disconnect());
  fit();

  // ---- Linked highlighting --------------------------------------------------
  // data-link holds one or more entity ids separated by spaces. Pointing at an
  // element lights every element whose ids contain its ids or are contained
  // by them: a score cell "q-sat k-cat" lights the q-sat and k-cat vectors and
  // its own gauge, not the whole row and column; pointing at q-sat lights
  // every cell made from it.
  let activeLink: string | null = null;
  const idsOf = (v: string | null) => (v ? v.split(/\s+/).filter(Boolean) : []);
  const related = (a: string[], b: string[]) => a.every((id) => b.includes(id)) || b.every((id) => a.includes(id));
  const applyLink = () => {
    if (activeLink === null) {
      delete root.dataset.linking;
      for (const e of root.querySelectorAll(".is-linked")) e.classList.remove("is-linked");
      return;
    }
    root.dataset.linking = activeLink;
    const active = idsOf(activeLink);
    for (const e of root.querySelectorAll<HTMLElement | SVGElement>("[data-link]")) {
      e.classList.toggle("is-linked", related(active, idsOf(e.getAttribute("data-link"))));
    }
  };
  const linkOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-link]")?.getAttribute("data-link") ?? null : null);
  root.addEventListener("pointerover", (e) => {
    const id = linkOf(e.target);
    if (id !== activeLink) {
      activeLink = id;
      applyLink();
    }
  });
  root.addEventListener("pointerleave", () => {
    activeLink = null;
    applyLink();
  });
  root.addEventListener("focusin", (e) => {
    activeLink = linkOf(e.target);
    applyLink();
  });

  // ---- Panels -------------------------------------------------------------
  const panelNodes = new Map<string, { section: HTMLElement; title: HTMLElement; body: HTMLElement; html: string }>();
  const renderPanels = (panels: Panel[]) => {
    const live = new Set(panels.map((p) => p.key));
    for (const [k, n] of panelNodes) if (!live.has(k)) (n.section.remove(), panelNodes.delete(k));
    for (const p of panels) {
      let n = panelNodes.get(p.key);
      if (!n) {
        const section = h("section", { class: "vz-panel", "data-key": p.key });
        const title = h("h3");
        const pbody = h("div", { class: "vz-panel-body" });
        section.append(title, pbody);
        n = { section, title, body: pbody, html: "" };
        panelNodes.set(p.key, n);
      }
      (p.place === "side" ? sideBox : panelsBox).append(n.section); // keeps declared order
      n.title.textContent = p.title ?? "";
      n.title.hidden = !p.title;
      if (n.html !== p.html) {
        n.body.innerHTML = p.html;
        n.html = p.html;
        for (const e of n.body.querySelectorAll("[data-link]")) if (!e.hasAttribute("tabindex")) e.setAttribute("tabindex", "0");
      }
    }
  };

  // ---- Step info ------------------------------------------------------------
  let shown = -1;
  let predictionAnswered = false;
  let onStepShown: (k: number) => void = () => {};
  const showStep = (k: number, info: StepInfo) => {
    if (k === shown) return;
    shown = k;
    onStepShown(k);
    root.toggleAttribute("data-opening", k === 0);
    predictionAnswered = false;
    root.dataset.step = String(k);
    count.textContent = editorial ? `${String(k).padStart(2, "0")} / ${String(last).padStart(2, "0")}` : k === 0 ? `Start · ${last} steps` : `Step ${k} of ${last}`;
    text.textContent = info.caption;
    trust.textContent = TRUST_LABEL[info.trust];
    trust.dataset.trust = info.trust;
    trust.title = TRUST_MEANING[info.trust];
    readout.textContent = info.readout;
    source.innerHTML = info.source
      ? info.source.url
        ? `<a href="${escapeHtml(info.source.url)}" rel="noopener" target="_blank">${escapeHtml(info.source.label)}</a>`
        : escapeHtml(info.source.label)
      : "";
    renderPanels(info.panels);
    stepHeading.textContent = info.teaching?.heading ?? "";
    for (const {button,index} of chapterButtons) {
      const nextIndex = chapterButtons.find((c) => c.index > index)?.index ?? steps.length;
      if (k >= index && k < nextIndex) button.setAttribute("aria-current","step");
      else button.removeAttribute("aria-current");
    }
    prediction.replaceChildren();
    const prompt = info.teaching?.prediction;
    prediction.hidden = !prompt;
    if (prompt) {
      prediction.append(h("span",{class:"vz-predict-kicker"},"Predict"),h("p",{},escapeHtml(prompt.question)));
      const options = h("div",{class:"vz-predict-options"});
      const feedback = h("p",{class:"vz-predict-feedback","aria-live":"polite"});
      for (const choice of prompt.choices) {
        const b = h("button",{type:"button","aria-pressed":"false"},escapeHtml(choice));
        b.addEventListener("click",() => {
          predictionAnswered = true;
          for (const other of options.querySelectorAll("button")) {
            other.setAttribute("aria-pressed",String(other === b));
            other.dataset.correct = String(other.textContent === prompt.answer);
          }
          feedback.textContent = prompt.explanation;
        });
        options.append(b);
      }
      prediction.append(options,feedback);
    }
    items.forEach((li, i) => (i === k ? li.setAttribute("aria-current", "step") : li.removeAttribute("aria-current")));
    range.setAttribute("aria-valuetext", `${count.textContent}: ${info.caption}`);
  };

  // ---- Time -------------------------------------------------------------------
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let t = 0;
  let playing = false;
  let target: number | null = null;
  let raf = 0;
  let lastNow = 0;
  let current: Frame = compiled.frameAt(0);

  /** Under reduced motion every instant shows a step at rest. */
  const displayTime = (time: number) => {
    if (!still.matches) return time;
    const { index, progress } = frameIndexAt(timeline, time);
    return progress >= 1 ? time : compiled.restTime(progress >= 0.5 ? index : index - 1);
  };

  const draw = () => {
    current = compiled.frameAt(displayTime(t));
    unfold?.frame(current.index, current.progress);
    stage.render(current.marks as Resolved[]);
    if (tb) { if (current.progress >= 1) placeTitleBlock(current.index); else tbFor = ""; }
    const k = current.index === 0 || current.progress >= 0.5 ? current.index : current.index - 1;
    showStep(k, current.shown);
    range.value = String(Math.round(t));
    if (activeLink !== null) applyLink();
  };

  const writeHash = () => {
    if (!page) return;
    try {
      history.replaceState(null, "", `#${chosen ? `what=${chosen}&` : ""}step=${shown}`);
    } catch {
      /* file:// in some browsers */
    }
  };

  const setPlaying = (on: boolean) => {
    playing = on;
    playBtn.innerHTML = on ? ICONS.pause : ICONS.play;
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    root.toggleAttribute("data-playing", on);
    if (on && !raf) {
      lastNow = 0;
      raf = requestAnimationFrame(tick);
    }
    if (!on) writeHash();
  };

  function tick(now: number) {
    raf = 0;
    const dt = lastNow ? Math.min(now - lastNow, 64) : 16;
    lastNow = now;
    if (target !== null) {
      const dir = Math.sign(target - t);
      t += dir * dt;
      // Stepping skips the holds between transitions, in either direction.
      const at = frameIndexAt(timeline, t);
      if (at.progress >= 1) {
        if (dir > 0) {
          const ns = timeline.start[at.index + 1];
          if (ns !== undefined && t < ns) t = Math.min(ns, target);
        } else {
          const r = timeline.rest[at.index]!;
          if (t > r) t = Math.max(r, target);
        }
      }
      if ((dir >= 0 && t >= target) || (dir < 0 && t <= target)) {
        t = target;
        target = null;
        draw();
        setPlaying(false);
        return;
      }
    } else if (playing) {
      const stop = steps.findIndex((s,k) => s.teaching?.prediction && compiled.restTime(k) > t && compiled.restTime(k) <= t + dt);
      if (stop >= 0) {
        t = compiled.restTime(stop);
        draw();
        setPlaying(false);
        return;
      }
      t += dt;
      if (t >= timeline.total) {
        t = timeline.total;
        draw();
        setPlaying(false);
        return;
      }
    }
    draw();
    if (playing) raf = requestAnimationFrame(tick);
  }

  const seek = (time: number) => {
    target = null;
    if (playing) setPlaying(false);
    t = Math.min(Math.max(time, 0), timeline.total);
    draw();
  };

  /**
   * Go to step k at rest. One step away animates the transition (backwards
   * when rewinding); further jumps, and reduced motion, cut straight there.
   */
  const goTo = (k: number) => {
    const kk = Math.min(Math.max(k, 0), last);
    const goal = compiled.restTime(kk);
    const { index } = frameIndexAt(timeline, t);
    if (still.matches || Math.abs(kk - index) > 1 || goal === t) {
      seek(goal);
      writeHash();
      return;
    }
    target = goal;
    setPlaying(true);
  };

  // ---- Now you try: a fresh case from the model, marked by the model -------------
  if (scene.practice && editorial) {
    const tryBtn = h("button", { class: "vz-btn vz-try", type: "button" }, "Now you try");
    const card = h("section", { class: "vz-predict vz-practice", "aria-label": "Now you try" });
    card.hidden = true;
    caption.append(card);
    let seed = 0, right = 0, asked = 0;
    const ask = () => {
      const q = scene.practice!(seed++);
      asked++;
      card.replaceChildren();
      const options = h("div", { class: "vz-predict-options" });
      const feedback = h("p", { class: "vz-predict-feedback", "aria-live": "polite" });
      const score = h("span", { class: "vz-practice-score" });
      const another = h("button", { type: "button", class: "vz-practice-next" }, "Another");
      another.hidden = true;
      for (const choice of q.choices) {
        const b = h("button", { type: "button", "aria-pressed": "false" }, escapeHtml(choice));
        b.addEventListener("click", () => {
          if (!another.hidden) return;
          const ok = choice === q.answer;
          if (ok) right++;
          for (const o of options.querySelectorAll("button")) { o.setAttribute("aria-pressed", String(o === b)); o.dataset.correct = String(o.textContent === q.answer); }
          feedback.textContent = `${ok ? "Right." : `Not quite: ${q.answer}.`} ${q.explanation}`;
          score.textContent = `${right} of ${asked} right`;
          another.hidden = false;
          another.focus();
        });
        options.append(b);
      }
      another.addEventListener("click", ask);
      card.append(h("span", { class: "vz-predict-kicker" }, "Now you try"), h("p", {}, escapeHtml(q.question)), options, feedback, h("div", { class: "vz-practice-foot" }), );
      card.lastElementChild!.append(score, another);
      card.hidden = false;
      prediction.hidden = true;
      (options.querySelector("button") as HTMLButtonElement | null)?.focus();
    };
    tryBtn.addEventListener("click", () => { if (!card.hidden) { card.hidden = true; return; } goTo(last); ask(); });
    controls.insertBefore(tryBtn, restartBtn);
  }

  // ---- Listen: recorded narration that lights what it names -------------------
  // A tour plays each step's clip after the camera settles, lights the parts a
  // phrase names while it is spoken, and moves on. It stops at a prediction,
  // so the reader answers before hearing the answer.
  type Track = { duration: number; type: string; audio: string; links: { start: number; end: number; ids: string[] }[] } | null;
  // The clips are recorded for the scene as told; a what-if version has other steps, so it plays none.
  const voice: Track[] | null = (page && chosen === 0 ? (window as unknown as { __VZ_VOICE?: { steps: Track[] } }).__VZ_VOICE?.steps : null) ?? null;
  let listening = false, clip: HTMLAudioElement | null = null, listenTimer = 0, listenRaf = 0;
  let sound: AudioContext | null = null;
  const listenBtn = h("button", { class: "vz-btn vz-listen", type: "button", "aria-pressed": "false" }, "Play tour");
  const lightIds = (ids: string[]) => {
    activeLink = ids.length ? ids.join(" ") : null;
    applyLink();
    unfold?.highlight(ids);
  };
  const cueFor = (k: number) => {
    if (!sound || k === 0) return;
    const before = new Set(steps[k - 1]!.marks.map((m) => m.key)), now = steps[k]!.marks;
    const kind = k === last ? "chime" : now.some((m) => m.kind !== "label" && !before.has(m.key)) ? "flip" : "slide";
    playCue(sound, kind);
  };
  const stopListening = () => {
    listening = false;
    clearTimeout(listenTimer);
    cancelAnimationFrame(listenRaf);
    if (clip && !clip.paused) { const c = clip, t0 = performance.now(); const f = () => { const u = (performance.now() - t0) / 200; if (u >= 1) c.pause(); else { c.volume = 1 - u; requestAnimationFrame(f); } }; f(); }
    clip = null;
    lightIds([]);
    listenBtn.setAttribute("aria-pressed", "false");
    listenBtn.textContent = "Play tour";
    if (voice) { playBtn.innerHTML = ICONS.play; playBtn.setAttribute("aria-label", "Play"); }
  };
  const listenAt = (k: number) => {
    const track = voice?.[k];
    goTo(k);
    cueFor(k);
    if (!track) { listenTimer = window.setTimeout(() => (k < last && listening ? listenAt(k + 1) : stopListening()), 1600); return; }
    const el = new Audio(`data:${track.type};base64,${track.audio}`);
    clip = el;
    el.onended = () => {
      cancelAnimationFrame(listenRaf);
      lightIds([]);
      if (!listening) return;
      if (steps[k]?.teaching?.prediction && !predictionAnswered) { stopListening(); prediction.querySelector("button")?.focus(); return; }
      listenTimer = window.setTimeout(() => (k < last ? listenAt(k + 1) : stopListening()), 600);
    };
    const follow = () => {
      if (clip !== el) return;
      const at = el.currentTime;
      lightIds(track.links.find((l) => at >= l.start - 0.05 && at < l.end + 0.25)?.ids ?? []);
      listenRaf = requestAnimationFrame(follow);
    };
    // Speak once the move has mostly played, so the voice names what is on screen.
    listenTimer = window.setTimeout(() => { if (clip === el) { void el.play().catch(stopListening); follow(); } }, 700);
  };
  if (voice && editorial) {
    // Voice is always available and on by default: each step the reader goes to is spoken once the
    // move settles. "Voice" mutes it; "Listen" plays the whole tour without clicking.
    let voiceOn = true, armed = false, navTimer = 0, navClip: HTMLAudioElement | null = null, navRaf = 0;
    const voiceBtn = h("button", { class: "vz-btn vz-voice", type: "button", "aria-pressed": "true", "aria-label": "Voice narration" }, "Voice on");
    // A stopped clip fades out over 0.2 s: a hard stop in mid-word sounds like a cut.
    const fadeOut = (el: HTMLAudioElement | null) => {
      if (!el || el.paused || el.ended) return;
      const t0 = performance.now(), v0 = el.volume;
      const step = () => { const u = (performance.now() - t0) / 200; if (u >= 1) { el.pause(); return; } el.volume = v0 * (1 - u); requestAnimationFrame(step); };
      step();
    };
    const stopNav = () => { clearTimeout(navTimer); cancelAnimationFrame(navRaf); fadeOut(navClip); navClip = null; if (!listening) lightIds([]); };
    const speakNav = (k: number, then?: () => void) => {
      stopNav();
      const track = voice[k];
      if (!voiceOn || !armed || listening || !track) return;
      navTimer = window.setTimeout(() => {
        const el = new Audio(`data:${track.type};base64,${track.audio}`);
        navClip = el;
        el.onended = () => { cancelAnimationFrame(navRaf); if (!listening) lightIds([]); then?.(); };
        const follow = () => { if (navClip !== el) return; const at = el.currentTime; lightIds(track.links.find((l) => at >= l.start - 0.05 && at < l.end + 0.25)?.ids ?? []); navRaf = requestAnimationFrame(follow); };
        void el.play().then(follow).catch(() => {});
      }, 650);
    };
    onStepShown = speakNav;
    // Browsers only allow sound after a gesture: the first one arms the narration. If that
    // gesture is "go on" from the opening step, the concept is said first and the move waits for it.
    let introHeld = false, introPlayed = false;
    const holdForIntro = (go: () => void) => {
      introHeld = true;
      armed = true;
      root.dataset.intro = "playing";
      speakNav(0, () => { introHeld = false; introPlayed = true; delete root.dataset.intro; go(); });
    };
    root.addEventListener("click", (e) => {
      if (armed || introHeld) return;
      const t = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-action="next"],[data-action="play"]') : null;
      if (e.target instanceof Element && e.target.closest(".vz-listen, .vz-voice")) { armed = true; return; }
      if (!t || shown !== 0 || !voiceOn || !voice[0]) { armed = true; speakNav(shown); return; }
      e.stopImmediatePropagation(); e.preventDefault();
      holdForIntro(() => t.click());
    }, true);
    root.addEventListener("keydown", (e) => {
      if (armed || introHeld) return;
      const go = e.key === "ArrowRight" || e.key === " ";
      if (!go || shown !== 0 || !voiceOn || !voice[0]) { armed = true; speakNav(shown); return; }
      e.stopImmediatePropagation(); e.preventDefault();
      holdForIntro(() => nextBtn.click());
    }, true);
    voiceBtn.addEventListener("click", () => {
      voiceOn = !voiceOn;
      voiceBtn.setAttribute("aria-pressed", String(voiceOn));
      voiceBtn.textContent = voiceOn ? "Voice on" : "Voice off";
      if (!voiceOn) { stopNav(); if (listening) stopListening(); } else speakNav(shown);
    });
    cleanup.push(stopNav);
    controls.insertBefore(voiceBtn, restartBtn);
    // ▶ is the tour while the voice is on, so there is no separate tour button.
    const startTour = (from: number) => {
      sound ??= new AudioContext();
      void sound.resume();
      listening = true;
      listenBtn.setAttribute("aria-pressed", "true");
      listenBtn.textContent = "Stop";
      playBtn.innerHTML = ICONS.pause;
      playBtn.setAttribute("aria-label", "Pause");
      listenAt(from);
    };
    listenBtn.addEventListener("click", () => (listening ? stopListening() : startTour(shown >= last ? 0 : Math.max(shown, 0))));
    // While the voice is on, ▶ is the narrated tour: a step moves on only when its sentence has
    // been said. Timed autoplay cut each sentence as the next part came in.
    root.addEventListener("click", (e) => {
      if (!voiceOn || !(e.target instanceof Element) || !e.target.closest('[data-action="play"]')) return;
      e.stopImmediatePropagation();
      if (listening) return stopListening();
      startTour(shown >= last ? 0 : shown === 0 && introPlayed ? 1 : shown);
    }, true);
    for (const b of [prevBtn, nextBtn, restartBtn]) b.addEventListener("click", stopListening);
    root.addEventListener("keydown", (e) => { if (e.key !== " ") stopListening(); });
    cleanup.push(stopListening);
  }

  const stepNow = () => {
    const { index, progress } = frameIndexAt(timeline, t);
    return { index, settled: progress >= 1 };
  };
  const next = () => {
    if (steps[shown]?.teaching?.prediction && !predictionAnswered) {
      prediction.querySelector("button")?.focus();
      return;
    }
    const { index, settled } = stepNow();
    goTo(settled ? index + 1 : index);
  };
  const prev = () => {
    const { index } = stepNow();
    goTo(index - 1);
  };

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  restartBtn.addEventListener("click", () => seek(0));
  playBtn.addEventListener("click", () => {
    if (playing) {
      target = null;
      setPlaying(false);
      return;
    }
    if (steps[shown]?.teaching?.prediction && !predictionAnswered) {
      prediction.querySelector("button")?.focus();
      return;
    }
    if (t >= timeline.total) t = 0;
    target = null;
    setPlaying(true);
  });
  range.addEventListener("input", () => seek(Number(range.value)));
  range.addEventListener("change", writeHash);

  root.addEventListener("keydown", (e) => {
    if (details.open) return;
    const k = e.key;
    if (e.target === themeBtn || (e.target instanceof HTMLButtonElement && (k === " " || k === "Enter"))) return;
    if (k === "ArrowRight") next();
    else if (k === "ArrowLeft") prev();
    else if (k === "Home") seek(0);
    else if (k === "End") seek(timeline.total);
    else if (k === " ") playBtn.click();
    else return;
    e.preventDefault();
  });

  // A standalone page is the figure, so its keys work before anything is clicked: a key pressed
  // with nothing focused goes to the figure. Embedded in a host page, the figure takes keys only
  // when it has focus, so it never steals the host's arrows.
  if (page) {
    const forward = (e: KeyboardEvent) => {
      if (e.target !== document.body && e.target !== document.documentElement) return;
      const copy = new KeyboardEvent("keydown", { key: e.key, code: e.code, bubbles: true, cancelable: true, shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey });
      root.dispatchEvent(copy);
      if (copy.defaultPrevented) e.preventDefault();
    };
    document.addEventListener("keydown", forward);
    cleanup.push(() => document.removeEventListener("keydown", forward));
  }

  const fromHash = page ? readHashStep() : null;
  if (fromHash !== null) t = compiled.restTime(fromHash);
  draw();

  const api: PlayerApi = {
    compiled,
    stage,
    root,
    get viewBox() {
      return viewBox;
    },
    seek,
    seekStep: (k) => seek(compiled.restTime(k)),
    play: () => setPlaying(true),
    pause: () => {
      target = null;
      setPlaying(false);
    },
    time: () => t,
    frame: () => current,
    shownIndex: () => shown,
    destroy: () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      playing = false;
      for (const undo of cleanup.splice(0)) undo();
      unfold?.destroy();
      root.remove();
      const w = window as unknown as { __viz?: PlayerApi };
      if (w.__viz === api) delete w.__viz;
    },
  };
  // Embedded hosts can mount before the bundled fonts finish loading.
  // Refit against their real metrics without changing playback or time.
  void document.fonts.ready.then(() => { if (root.isConnected) { fit(); draw(); } });
  if (page) (window as unknown as { __viz?: PlayerApi }).__viz = api;
  return api;
}
