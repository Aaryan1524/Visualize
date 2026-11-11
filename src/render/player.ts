import { compile, type Compiled, type Frame, type StepInfo } from "../core/scene.ts";
import { frameIndexAt } from "../core/timeline.ts";
import { TRUST_LABEL, TRUST_MEANING } from "../core/trust.ts";
import type { LabelMark, Panel, Resolved, Scene } from "../core/types.ts";
import { createStage, fitViewBox, type StageRenderer } from "./svg.ts";

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

export function mount<S, E>(host: HTMLElement, scene: Scene<S, E>, options: MountOptions = {}): PlayerApi {
  const page = options.page ?? false;
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
  const stage = createStage(viewBox, projection, `${scene.title}. ${scene.question} Use the step controls or the arrow keys.`);

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
  stageBox.append(stage.svg);
  const panelsBox = h("aside", { class: "vz-panels", "aria-label": "Details for the current step" });
  body.append(stageBox);
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
    heading.append(head.firstElementChild!, question);
    const utilities = h("div", { class: "vz-utilities" });
    utilities.append(detailsBtn, themeBtn);
    head.append(heading, chapters, utilities);

    // The primary view has one action. Longer evidence stays available in a
    // contained native dialog, with keyboard focus and Escape handled natively.
    const detailsBody = h("div", { class: "vz-drawer-body" });
    detailsBody.append(setup, h("h3", {}, "This step"), text, meta, foot);
    details.append(detailsBody);
    stageBox.append(caption);
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
  const fit = () => {
    let vb = geometryBox;
    for (let i = 0; i < 5; i++) {
      stage.setViewBox(vb);
      const r = stage.svg.getBoundingClientRect();
      // The viewBox is fitted with "meet", so the drawn scale is the smaller of the two fits.
      const scale = Math.min(r.width / vb[2], r.height / vb[3]);
      if (!(scale > 0)) return;
      const px = Math.min(LABEL_MAX, Math.max(LABEL_MIN, LABEL_UNITS * scale));
      stage.svg.style.setProperty("--label-size", `${px / scale}px`);
      const m = stage.measureLabels(stageLabels);
      if (!m) break;
      const pad = 4 / scale;
      const g = geometryBox;
      const x0 = Math.min(g[0], m[0] - pad), y0 = Math.min(g[1], m[1] - pad);
      const x1 = Math.max(g[0] + g[2], m[2] + pad), y1 = Math.max(g[1] + g[3], m[3] + pad);
      const next: [number, number, number, number] = [x0, y0, x1 - x0, y1 - y0];
      if (next.every((v, j) => Math.abs(v - vb[j]!) < 0.5)) break;
      vb = next;
    }
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
      panelsBox.append(n.section); // keeps declared order
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
  const showStep = (k: number, info: StepInfo) => {
    if (k === shown) return;
    shown = k;
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
    stage.render(current.marks as Resolved[]);
    const k = current.index === 0 || current.progress >= 0.5 ? current.index : current.index - 1;
    showStep(k, current.shown);
    range.value = String(Math.round(t));
    if (activeLink !== null) applyLink();
  };

  const writeHash = () => {
    if (!page) return;
    try {
      history.replaceState(null, "", `#step=${shown}`);
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
      root.remove();
      const w = window as unknown as { __viz?: PlayerApi };
      if (w.__viz === api) delete w.__viz;
    },
  };
  if (page) (window as unknown as { __viz?: PlayerApi }).__viz = api;
  return api;
}
