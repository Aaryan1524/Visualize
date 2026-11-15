// The Drawing page's player: story timeline, steps, voice tour, prediction, Now you try, What if,
// Details, theme and keyboard. It runs in the page: page.mjs serializes it with toString(), so it
// must not reference anything outside its own body. Everything about one machine comes from the
// `machine` object an example passes in (see references/drawing.md, "The machine hooks"):
//
//   model(V)            the example's model for a variant (usually makeModel(V.over))
//   mount(V, model)     build the moving elements inside #fig after the variant's SVG is in place
//   at(k, t, still, SEG) the machine's state t seconds into step k; still is true for a still frame
//                       (SEG: the timeline, { d, s, total, lead }; lead is the pause before a step's voice)
//   stillAt(k, SEG)     seconds into step k for its still frame (a screenshot, a link, a paused step)
//   render(state, S)    draw one moment, readouts included (S: the player's state, read only)
//   question(n, r)      Now you try, from seed n and a seeded random r(): { q, choices: [right, ...wrong], explain }
//   heading(k)          optional, the step heading when it depends on the variant
//   lit(ids)            optional, after the parts named by the voice are lit
//   info(state)         optional, extra fields for __viz.state()
//   lab(values)         optional, the free-input lab: { state, verdict, rows: [string] } for the
//                       reader's own values (DATA.lab lists the inputs); state is drawn by render()
//
// The timeline runs once, from the concept to the last step. Each step lasts as long as its
// narration (or PLAIN seconds without a voice); play stops at the prediction and at the end.
export function player(DATA, machine) {
  const $ = (id) => document.getElementById(id);
  const root = $("vz"), fig = $("fig");
  const fx = (v) => v.toFixed(1);
  const pad2 = (n) => String(n).padStart(2, "0");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STEPS = DATA.steps, LAST = STEPS.length - 1, PRED = DATA.predict.step;
  const ALIAS = DATA.alias || {};
  const S = { variant: null, step: -1, T: 0, pinPose: true, state: null, running: false, touring: false, voiceOn: true, armed: false, answer: null, last: 0, lit: [], heard: -1 };
  let V = null, E = null;

  // ------------------------------------------------ one drawing per variant
  function mount(name) {
    V = DATA.variants[name];
    S.variant = name;
    const model = machine.model(V);
    fig.innerHTML = V.svg;
    machine.mount(V, model);
    E = {
      parts: [...fig.querySelectorAll("#scene .part")],
      details: [...fig.querySelectorAll(".detail[data-full]")],
      labels: [...fig.querySelectorAll(".label")],
      beats: [...fig.querySelectorAll("[data-beats]")],
    };
    layoutText();
    document.fonts.ready.then(layoutText);
    for (const b of document.querySelectorAll(".vz-whatif button")) b.setAttribute("aria-pressed", String(b.dataset.variant === name));
    SEG = timeline();
    scrub.max = String(SEG.total);
    marks.replaceChildren(...SEG.s.slice(1, LAST + 1).map((t) => {
      const m = document.createElement("span");
      m.style.left = `${(t / SEG.total) * 100}%`;
      return m;
    }));
  }

  // Leaders run from the measured text box to the dot on the part, and the title-block key is
  // laid out by measured widths; both wait for the web fonts, or they measure the fallback face.
  function layoutText() {
    for (const g of E.labels) {
      const lead = g.querySelector(".leader");
      if (!lead || !g.dataset.to) continue;
      const bb = g.querySelector("text").getBBox();
      const [tx, ty] = g.dataset.to.split(",").map(Number);
      const cy = bb.y + bb.height * 0.56;
      const right = tx > bb.x + bb.width / 2;
      const ax = right ? bb.x + bb.width + 45 : bb.x - 45, ex = ax + (right ? 110 : -110);
      lead.setAttribute("d", `M${fx(ax)},${fx(cy)}L${fx(ex)},${fx(cy)}L${fx(tx)},${fx(ty)}`);
    }
    const key = fig.querySelector("#tbkey");
    if (!key) return;
    let x = +key.dataset.x0;
    for (const g of key.querySelectorAll(".tbk")) {
      const t = g.querySelector("text");
      t.setAttribute("x", "300");
      g.setAttribute("transform", `translate(${fx(x)},0)`);
      x += 300 + t.getComputedTextLength() + 170;
    }
  }

  // ------------------------------------------------ focus, and the parts the voice names
  function applyFocus() {
    const focus = STEPS[S.step]?.focus;
    const lit = S.lit.flatMap((id) => [id, ...(ALIAS[id] || [])]);
    for (const el of E.parts) {
      const part = el.dataset.part;
      let o = !focus || focus.includes(part) ? 1 : 0.35;
      if (lit.length) o = lit.includes(part) ? 1 : 0.2;
      el.style.opacity = String(o);
      el.classList.toggle("lit", S.lit.includes(part));
    }
    machine.lit?.(S.lit);
  }
  function light(ids) {
    const key = ids.join(" ");
    if (key === S.lit.join(" ")) return;
    S.lit = ids;
    applyFocus();
  }

  // ------------------------------------------------ steps and the story timeline
  const tabs = [...document.querySelectorAll(".vz-chapters button")];
  const heading = $("heading"), count = $("count"), concept = $("concept");
  const predict = $("predict"), practice = $("practice");
  const scrub = $("scrub"), marks = $("marks"), playBtn = $("play"), voiceBtn = $("voice"), tryBtn = $("try");
  const LEAD = 0.3, GAP = 0.6, PLAIN = 8;
  let SEG = null;
  function timeline() {
    const d = [];
    for (let k = 0; k <= LAST; k++) {
      const tr = V.voice?.[k];
      d.push(tr ? LEAD + tr.duration + GAP : PLAIN);
    }
    const s = [0];
    d.forEach((x, i) => s.push(s[i] + x));
    return { d, s, total: s[LAST + 1], lead: V.voice ? LEAD : 0 };
  }
  const segOf = (T) => {
    let k = 0;
    for (let i = 1; i <= LAST; i++) if (T >= SEG.s[i] - 1e-6) k = i;
    return k;
  };
  // The still frame of a step sits inside its stretch of the bar, at the moment the voice meets it.
  const poseT = (k) => {
    if (k === 0) return 0;
    const t = SEG.s[k] + machine.stillAt(k, SEG);
    return Math.min(SEG.s[k + 1] - 0.01, Math.max(SEG.s[k], t));
  };
  const headOf = (k) => machine.heading?.(k) ?? STEPS[k].heading;
  function setStep(k) {
    if (k === S.step) return;
    S.step = k;
    S.heard = -1;
    root.dataset.step = String(k);
    root.toggleAttribute("data-opening", k === 0);
    heading.textContent = headOf(k);
    count.textContent = `${pad2(k)} / ${pad2(LAST)}`;
    tabs.forEach((t, i) => (i + 1 === k ? t.setAttribute("aria-current", "step") : t.removeAttribute("aria-current")));
    for (const g of E.beats) g.style.display = g.dataset.beats.split(" ").includes(String(k)) ? "" : "none";
    for (const g of E.details) {
      const full = g.dataset.full.split(" ").includes(String(k)), dim = g.dataset.dim.split(" ").includes(String(k));
      g.classList.toggle("dim", dim && !full);
      g.classList.toggle("off", !full && !dim);
    }
    S.lit = [];
    applyFocus();
    showPredict();
    $("d-step").textContent = V.captions[k];
    $("d-count").textContent = `${pad2(k)} / ${pad2(LAST)}`;
    scrub.setAttribute("aria-valuetext", `${count.textContent}: ${headOf(k)}`);
    try {
      history.replaceState(null, "", `#step=${k}${S.variant !== DATA.base ? `&what=${S.variant}` : ""}`);
    } catch {
      /* sandboxed frames */
    }
  }
  function draw() {
    const k = segOf(S.T);
    const still = reduced || S.pinPose;
    S.state = machine.at(k, still ? poseT(k) - SEG.s[k] : S.T - SEG.s[k], still, SEG);
    machine.render(S.state, S);
    scrub.value = String(S.T);
  }
  // Go to a step: paused, show its still frame; running, start the step from its beginning.
  function goTo(k, how = {}) {
    k = Math.max(0, Math.min(LAST, k));
    setStep(k);
    S.T = S.running && !how.pose ? SEG.s[k] : poseT(k);
    S.pinPose = !S.running || !!how.pose;
    draw();
    if (how.speak !== false) speakNav(k);
  }
  const unanswered = () => S.step === PRED && S.answer === null;

  // ------------------------------------------------ time
  let stillTimer = 0;
  function setRunning(on) {
    S.running = on && !reduced;
    playBtn.dataset.state = on ? "pause" : "play";
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    clearInterval(stillTimer);
    // Reduced motion: no continuous movement; play moves from one still frame to the next.
    if (on && reduced && !S.touring) {
      S.stillOn = true;
      stillTimer = setInterval(() => {
        if (unanswered()) return stop(true);
        if (S.step >= LAST) return setRunning(false);
        goTo(S.step + 1, { pose: true, speak: false });
      }, 4000);
    } else S.stillOn = false;
    if (S.running) {
      S.last = performance.now();
      requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    if (!S.running) return;
    const dt = Math.min(0.1, (now - S.last) / 1000);
    S.last = now;
    S.pinPose = false;
    if (S.touring) {
      // The voice moves the story on; within a step the bar runs with it and waits at the step's end.
      S.T = Math.min(S.T + dt, SEG.s[S.step + 1] - 1e-3);
    } else {
      S.T += dt;
      const k = segOf(S.T);
      // The prediction holds the story: stop where the answer would begin.
      if (S.step <= PRED && k > PRED && S.answer === null) {
        S.T = SEG.s[PRED + 1] - 1e-3;
        draw();
        return stop(true);
      }
      if (S.T >= SEG.total) {
        S.T = SEG.total - 1e-3;
        draw();
        return setRunning(false);
      }
      if (k !== S.step) setStep(k);
    }
    draw();
    requestAnimationFrame(tick);
  }
  // Continuous play runs the step from its start if the machine is elsewhere (after a tour, say).
  function startPlain() {
    if (S.pinPose || segOf(S.T) !== S.step) S.T = SEG.s[S.step];
    S.pinPose = false;
    setRunning(true);
  }
  function stop(toPredict) {
    stopTour();
    setRunning(false);
    if (toPredict) predict.querySelector("button")?.focus();
  }

  // ------------------------------------------------ voice: recorded narration that lights what it names
  let clip = null, clipRaf = 0, tourTimer = 0, navTimer = 0;
  const hasVoice = () => !!(V && V.voice);
  const fadeOut = (el) => {
    if (!el || el.paused || el.ended) return;
    const t0 = performance.now(), v0 = el.volume;
    const f = () => {
      const u = (performance.now() - t0) / 200;
      if (u >= 1) return el.pause();
      el.volume = v0 * (1 - u);
      requestAnimationFrame(f);
    };
    f();
  };
  function stopClip() {
    clearTimeout(navTimer);
    cancelAnimationFrame(clipRaf);
    fadeOut(clip);
    clip = null;
    light([]);
  }
  function playClip(k, then) {
    stopClip();
    const track = V.voice?.[k];
    if (!track || !S.voiceOn) return false;
    const el = new Audio(`data:${track.type};base64,${track.audio}`);
    clip = el;
    el.onended = () => {
      cancelAnimationFrame(clipRaf);
      if (clip === el) light([]);
      S.heard = k;
      then?.();
    };
    const follow = () => {
      if (clip !== el) return;
      const at = el.currentTime;
      light(track.links.find((l) => at >= l.start - 0.05 && at < l.end + 0.25)?.ids ?? []);
      clipRaf = requestAnimationFrame(follow);
    };
    el.play().then(follow).catch(() => {});
    return true;
  }
  // Each step the reader goes to is spoken once the move settles (after the first gesture).
  function speakNav(k) {
    if (S.touring || !S.armed || !S.voiceOn || !hasVoice()) return;
    stopClip();
    navTimer = setTimeout(() => playClip(k), 650);
  }
  // With the voice on, play is the narrated tour: a step moves on only when its clip has ended.
  function tourAt(k) {
    setStep(k);
    S.T = SEG.s[k];
    S.pinPose = false;
    draw();
    setRunning(true);
    playBtn.dataset.state = "pause";
    tourTimer = setTimeout(() => {
      const ok = playClip(k, () => {
        if (!S.touring) return;
        if (k === PRED && S.answer === null) return stop(true);
        tourTimer = setTimeout(() => (k < LAST ? tourAt(k + 1) : stopTour(true)), GAP * 1000);
      });
      if (!ok) tourTimer = setTimeout(() => (k < LAST && S.touring ? tourAt(k + 1) : stopTour(true)), PLAIN * 1000);
    }, LEAD * 1000);
  }
  function startTour(from) {
    S.touring = true;
    S.armed = true;
    tourAt(from);
  }
  function stopTour(andMachine) {
    if (!S.touring) return;
    S.touring = false;
    clearTimeout(tourTimer);
    stopClip();
    if (andMachine) setRunning(false);
    playBtn.dataset.state = S.running ? "pause" : "play";
  }

  playBtn.addEventListener("click", () => {
    S.armed = true;
    if (S.touring || S.running || S.stillOn) return stop(false);
    if (labOpen) closeLab();
    if (unanswered()) return predict.querySelector("button")?.focus();
    if (S.voiceOn && hasVoice()) return startTour(S.step >= LAST ? 0 : S.heard === S.step ? S.step + 1 : S.step);
    if (S.step >= LAST && S.T >= SEG.total - 0.01) goTo(0, { speak: false });
    startPlain();
  });
  voiceBtn.addEventListener("click", () => {
    S.voiceOn = !S.voiceOn;
    S.armed = true;
    voiceBtn.setAttribute("aria-pressed", String(S.voiceOn));
    voiceBtn.textContent = S.voiceOn ? "Voice on" : "Voice off";
    if (!S.voiceOn) {
      const wasTour = S.touring;
      stopTour(false);
      stopClip();
      if (wasTour) startPlain(); // keep the machine running, now without narration
    } else if (!S.touring) speakNav(S.step);
  });
  const nav = (k) => {
    if (labOpen) closeLab();
    S.armed = true;
    if (S.touring) stopTour(true);
    goTo(k);
  };
  $("prev").addEventListener("click", () => nav(S.step - 1));
  $("next").addEventListener("click", () => (unanswered() ? predict.querySelector("button")?.focus() : nav(S.step + 1)));
  $("restart").addEventListener("click", () => {
    if (labOpen) closeLab();
    stop(false);
    S.answer = null;
    goTo(0, { speak: false });
  });
  tabs.forEach((t, i) => t.addEventListener("click", () => nav(i + 1)));
  scrub.addEventListener("input", () => {
    if (labOpen) closeLab();
    S.armed = true;
    stopTour(false);
    S.T = Number(scrub.value);
    S.pinPose = false;
    setStep(segOf(S.T));
    draw();
  });

  // ------------------------------------------------ predict, just before the causal moment
  const PR = DATA.predict;
  const answerOf = () => (typeof PR.answer === "number" ? PR.answer : PR.answer[S.variant]);
  function showPredict() {
    const k = S.step;
    const show = !practiceOpen && !labOpen && (k === PRED || (k === PRED + 1 && S.answer !== null));
    predict.hidden = !show;
    concept.hidden = !(k === 0 && !practiceOpen && !labOpen);
    syncCards();
    if (!show) return;
    const reveal = k === PRED + 1;
    predict.replaceChildren();
    const kicker = Object.assign(document.createElement("span"), { className: "vz-predict-kicker", textContent: reveal ? "Your prediction" : "Predict" });
    const q = Object.assign(document.createElement("p"), { textContent: PR.question });
    const opts = Object.assign(document.createElement("div"), { className: "vz-predict-options" });
    const fb = Object.assign(document.createElement("p"), { className: "vz-predict-feedback" });
    fb.setAttribute("aria-live", "polite");
    PR.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.setAttribute("aria-pressed", String(S.answer === i));
      if (reveal) b.dataset.correct = String(i === answerOf());
      b.addEventListener("click", () => {
        if (reveal) return;
        S.answer = i;
        S.armed = true;
        for (const o of opts.children) o.setAttribute("aria-pressed", String(o === b));
        fb.textContent = PR.locked;
      });
      opts.append(b);
    });
    const explanation = typeof PR.explanation === "string" ? PR.explanation : PR.explanation[S.variant];
    if (reveal) fb.textContent = (S.answer === answerOf() ? "Right. " : "Not quite. ") + explanation;
    else if (S.answer !== null) fb.textContent = PR.locked;
    predict.append(kicker, q, opts, fb);
  }
  // A card sits over the title block's corner; while one is up, the title block steps aside.
  const syncCards = () => root.toggleAttribute("data-card", !predict.hidden || !concept.hidden);

  // ------------------------------------------------ now you try: questions made from the model
  let practiceOpen = false, seed = 7, right = 0, tried = 0;
  const rng = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = (r, xs) => xs.map((x) => [r(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  function renderPractice() {
    const Q = machine.question(seed, rng(seed * 2654435761));
    const r = rng(seed * 31 + 7);
    const order = shuffle(r, Q.choices.map((_, i) => i));
    practice.replaceChildren();
    const kicker = Object.assign(document.createElement("span"), { className: "vz-predict-kicker", textContent: "Now you try" });
    const q = Object.assign(document.createElement("p"), { textContent: Q.q });
    const opts = Object.assign(document.createElement("div"), { className: "vz-predict-options" });
    const fb = Object.assign(document.createElement("p"), { className: "vz-predict-feedback" });
    fb.setAttribute("aria-live", "polite");
    const foot = Object.assign(document.createElement("div"), { className: "vz-practice-foot" });
    const score = Object.assign(document.createElement("span"), { className: "vz-practice-score", textContent: tried ? `${right} of ${tried} right` : "Worked from the model on this page" });
    const another = Object.assign(document.createElement("button"), { type: "button", className: "vz-practice-next", textContent: "New question" });
    another.addEventListener("click", () => {
      seed += 1;
      renderPractice();
      practice.querySelector(".vz-predict-options button")?.focus();
    });
    let done = false;
    for (const i of order) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = Q.choices[i];
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        if (done) return;
        done = true;
        tried += 1;
        if (i === 0) right += 1;
        for (const o of opts.children) o.dataset.correct = String(o === opts.children[order.indexOf(0)]);
        b.setAttribute("aria-pressed", "true");
        fb.textContent = (i === 0 ? "Right. " : "Not quite. ") + Q.explain;
        score.textContent = `${right} of ${tried} right`;
      });
      opts.append(b);
    }
    foot.append(score, another);
    practice.append(kicker, q, opts, fb, foot);
  }
  tryBtn.addEventListener("click", () => {
    if (labOpen) closeLab();
    practiceOpen = !practiceOpen;
    root.toggleAttribute("data-practice", practiceOpen);
    tryBtn.setAttribute("aria-pressed", String(practiceOpen));
    practice.hidden = !practiceOpen;
    if (practiceOpen) renderPractice();
    showPredict();
    syncCards();
    if (practiceOpen) practice.querySelector(".vz-predict-options button")?.focus();
  });

  // ------------------------------------------------ the lab: the reader's own values, drawn by the model
  // Outside the story: opening it pauses play; closing it returns to the step's frame.
  const lab = $("lab"), labBtn = $("labBtn");
  let labOpen = false;
  const labValues = {};
  for (const inp of DATA.lab?.inputs ?? []) labValues[inp.id] = inp.value;
  function renderLab() {
    const out = machine.lab(labValues, S.variant);
    machine.render(out.state, S);
    S.state = out.state;
    $("lab-verdict").textContent = out.verdict;
    $("lab-verdict").dataset.ok = String(!!out.ok);
    $("lab-rows").replaceChildren(...out.rows.map((r) => Object.assign(document.createElement("li"), { textContent: r })));
    for (const inp of DATA.lab.inputs) $("lab-v-" + inp.id).textContent = inp.format ? inp.format.replace("{}", labValues[inp.id]) : String(labValues[inp.id]);
  }
  function openLab() {
    if (practiceOpen) tryBtn.click();
    stop(false);
    stopClip();
    labOpen = true;
    root.toggleAttribute("data-lab", true);
    labBtn.setAttribute("aria-pressed", "true");
    lab.hidden = false;
    for (const g of E.beats) g.style.display = "none";
    heading.textContent = DATA.lab.heading ?? DATA.lab.title;
    showPredict();
    syncCards();
    renderLab();
    lab.querySelector("input")?.focus();
  }
  function closeLab() {
    labOpen = false;
    root.toggleAttribute("data-lab", false);
    labBtn.setAttribute("aria-pressed", "false");
    lab.hidden = true;
    const k = S.step;
    S.step = -1;
    setStep(k);
    draw();
  }
  if (lab) {
    labBtn.addEventListener("click", () => (labOpen ? closeLab() : openLab()));
    for (const inp of lab.querySelectorAll("input[type=range]")) {
      inp.addEventListener("input", () => {
        labValues[inp.dataset.id] = Number(inp.value);
        renderLab();
      });
    }
  }

  // ------------------------------------------------ what if
  for (const b of document.querySelectorAll(".vz-whatif button")) {
    b.addEventListener("click", () => {
      if (b.dataset.variant === S.variant) return;
      const k = S.step;
      stop(false);
      stopClip();
      mount(b.dataset.variant);
      S.step = -1;
      goTo(k, { pose: true, speak: false });
      if (labOpen) {
        for (const g of E.beats) g.style.display = "none";
        heading.textContent = DATA.lab.heading ?? DATA.lab.title;
        renderLab();
      }
    });
  }

  // ------------------------------------------------ details, theme, keyboard
  const drawer = $("details");
  for (const b of document.querySelectorAll("[data-details]")) b.addEventListener("click", () => (drawer.open ? drawer.close() : drawer.showModal()));
  const themeBtn = $("theme");
  const applyTheme = (th) => {
    root.dataset.theme = th;
    document.body.dataset.theme = th;
    themeBtn.textContent = th === "dark" ? "Light" : "Dark";
    themeBtn.setAttribute("aria-label", `Switch to ${th === "dark" ? "light" : "dark"} theme`);
  };
  applyTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  themeBtn.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark"));
  // On the document, so the arrows work on a fresh page before anything has focus.
  document.addEventListener("keydown", (e) => {
    if (drawer.open || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (e.target instanceof HTMLButtonElement && (k === " " || k === "Enter")) return;
    if (e.target instanceof HTMLInputElement && (k !== " " || e.target.closest("#lab"))) return;
    if (k === "ArrowRight") $("next").click();
    else if (k === "ArrowLeft") $("prev").click();
    else if (k === "Home") nav(0);
    else if (k === "End") nav(LAST);
    else if (k === " ") playBtn.click();
    else return;
    e.preventDefault();
  });

  // ------------------------------------------------ start
  const hash = new URLSearchParams(location.hash.slice(1));
  const what = DATA.variants[hash.get("what")] ? hash.get("what") : DATA.base;
  const first = Math.max(0, Math.min(LAST, Number(hash.get("step") ?? 0) || 0));
  mount(what);
  goTo(first, { pose: true, speak: false });
  setRunning(false);
  window.__viz = {
    steps: LAST + 1,
    predictStep: PRED,
    seekStep(k) {
      root.classList.add("instant");
      if (labOpen) closeLab();
      stop(false);
      goTo(Number(k) || 0, { pose: true, speak: false });
    },
    seek(ms) {
      root.classList.add("instant");
      if (labOpen) closeLab();
      stop(false);
      S.T = Math.min(SEG.total, Number(ms) / 1000);
      S.pinPose = false;
      setStep(segOf(S.T));
      draw();
    },
    variant(name) {
      document.querySelector(`.vz-whatif button[data-variant="${name}"]`)?.click();
    },
    variants: Object.keys(DATA.variants),
    answer(i) {
      S.answer = i;
      showPredict();
    },
    practice(n) {
      if (n !== undefined) seed = n;
      if (!practiceOpen) tryBtn.click();
      else renderPractice();
    },
    question: (n) => machine.question(n, rng(n * 2654435761)),
    lab(values) {
      if (!lab) return null;
      if (!labOpen) openLab();
      for (const [id, v] of Object.entries(values ?? {})) {
        labValues[id] = v;
        const inp = lab.querySelector(`input[data-id="${id}"]`);
        if (inp) inp.value = String(v);
      }
      renderLab();
      return machine.lab(labValues, S.variant);
    },
    labInputs: () => DATA.lab?.inputs ?? [],
    audit: DATA.audit ?? null,
    closeLab: () => labOpen && closeLab(),
    state: () => ({ step: S.step, ...(machine.info?.(S.state) ?? {}), ...(labOpen ? { lab: true } : {}), running: S.running, touring: S.touring, voiceOn: S.voiceOn, answer: S.answer, variant: S.variant, lit: S.lit.slice() }),
  };
}
