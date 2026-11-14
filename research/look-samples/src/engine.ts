// Shared engine for the look samples: the story, a directed camera that opens
// on the flat textbook view and lifts into 3D for each decision, labels that
// stay crisp and face the reader, and narration whose words light the parts
// they name. Each style only decides how a tile, the ground and the light look.

import * as THREE from "three";
import { parse, run, TARGET, VALUES, type Step } from "./story.ts";

export interface TileState {
  /** 0..1: raised as the middle being looked at. */
  lift: number;
  /** 0..1: dropped from play. */
  gone: number;
  /** 0..1: named by the narration right now. */
  lit: number;
  /** 0..1: the answer. */
  found: number;
}

export interface TileView {
  object: THREE.Object3D;
  apply(s: TileState): void;
  /** Where the number label sits, in world space. */
  labelAnchor(s: TileState): THREE.Vector3;
}

// ---- Sound: synthesised, quiet, and only for events that mean something --------
type Cue = "flip" | "slide" | "chime";
let audio: AudioContext | null = null;
function cue(kind: Cue, flavour: "paper" | "clay") {
  if (!audio) return;
  const a = audio, now = a.currentTime;
  const out = a.createGain();
  out.connect(a.destination);
  const noise = (dur: number) => {
    const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource();
    s.buffer = b;
    return s;
  };
  if (kind === "flip") {
    // A card turning (paper) or a soft key lifting (clay).
    const s = noise(0.16), f = a.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = flavour === "paper" ? 2600 : 900; f.Q.value = 0.9;
    out.gain.setValueAtTime(0.0001, now); out.gain.exponentialRampToValueAtTime(flavour === "paper" ? 0.22 : 0.3, now + 0.015); out.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    s.connect(f).connect(out); s.start(now);
  } else if (kind === "slide") {
    // The ruled-out half sliding away.
    const s = noise(0.55), f = a.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(flavour === "paper" ? 3200 : 1400, now); f.frequency.exponentialRampToValueAtTime(300, now + 0.5);
    out.gain.setValueAtTime(0.0001, now); out.gain.exponentialRampToValueAtTime(0.12, now + 0.08); out.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    s.connect(f).connect(out); s.start(now);
  } else {
    // Found: two soft bell tones.
    for (const [freq, delay] of [[659.25, 0], [987.77, 0.11]] as const) {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + delay); g.gain.exponentialRampToValueAtTime(0.16, now + delay + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.4);
      o.connect(g).connect(a.destination); o.start(now + delay); o.stop(now + delay + 1.5);
    }
  }
}

/** Narration rendered at build time by a local voice: one clip per step, with when each linked phrase is spoken. */
interface VoiceTrack { duration: number; audio: string; links: { start: number; end: number; ids: string[] }[] }
const VOICE: VoiceTrack[] | null = (globalThis as { __VOICE?: { steps: VoiceTrack[] } }).__VOICE?.steps ?? null;

export interface Style {
  id: string;
  title: string;
  /** Builds the ground, light and background. */
  setup(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void;
  tile(index: number, value: number, x: number): TileView;
  /** False when the style prints numbers into the tiles itself. */
  htmlNumbers: boolean;
  /** How the sound cues are voiced. */
  sound: "paper" | "clay";
  /** Called every frame with seconds elapsed, for ambient motion. */
  tick?(t: number): void;
}

const PITCH = 1.32;
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

interface Shot { pos: THREE.Vector3; look: THREE.Vector3; fov: number }

export function mount(style: Style) {
  const steps = run();
  const n = VALUES.length;
  const xOf = (i: number) => (i - (n - 1) / 2) * PITCH;

  // ---- DOM ------------------------------------------------------------------
  const root = document.getElementById("app")!;
  root.innerHTML = `
    <header class="head">
      <div class="kicker">${style.title} · look sample</div>
      <h1>How do four looks find ${TARGET} among ${n} numbers?</h1>
    </header>
    <div class="stage"><canvas></canvas><div class="labels"></div>
      <div class="hud"><span><b data-k="looks">0</b> looks</span><span><b data-k="left">${n}</b> still possible</span></div>
      <div class="target">Looking for <b>${TARGET}</b></div>
    </div>
    <section class="caption" aria-live="polite"><p class="say"></p></section>
    <nav class="controls">
      <button data-a="prev" aria-label="Previous step">‹</button>
      <button data-a="play" class="primary">Play the tour</button>
      <button data-a="next" aria-label="Next step">›</button>
      <ol class="dots"></ol>
      <button data-a="sound" class="voice" aria-pressed="true">Sound on</button>
      <button data-a="voice" aria-pressed="true">Voice on</button>
    </nav>`;
  const canvas = root.querySelector("canvas")!;
  const stage = root.querySelector(".stage") as HTMLElement;
  const labels = root.querySelector(".labels") as HTMLElement;
  const sayEl = root.querySelector(".say") as HTMLElement;
  const dots = root.querySelector(".dots") as HTMLElement;
  steps.forEach((s, k) => {
    const li = document.createElement("li");
    li.innerHTML = `<button aria-label="Step ${k}: ${s.chapter}"><span>${s.chapter}</span></button>`;
    li.querySelector("button")!.addEventListener("click", () => go(k, true));
    dots.append(li);
  });

  // ---- Three ------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  style.setup(scene, renderer);
  const tiles = VALUES.map((v, i) => {
    const t = style.tile(i, v, xOf(i));
    scene.add(t.object);
    return t;
  });

  // ---- Labels (HTML, always crisp, always facing the reader) -------------------
  const numberEls = VALUES.map((v, i) => {
    const el = document.createElement("div");
    el.className = "num";
    el.textContent = String(v);
    el.dataset.id = `t${i}`;
    if (style.htmlNumbers) labels.append(el);
    return el;
  });
  const markers = ["lo", "mid", "hi"].map((name) => {
    const el = document.createElement("div");
    el.className = `marker marker-${name}`;
    el.innerHTML = `<span>${name}</span>`;
    labels.append(el);
    return el;
  });

  // ---- State per step ----------------------------------------------------------
  const target = (s: Step): TileState[] => VALUES.map((_, i) => ({
    lift: s.mid === i && s.phase === "look" ? 1 : s.phase === "found" && i === s.mid ? 0.6 : 0,
    gone: i < s.lo || i > s.hi ? 1 : 0,
    lit: 0,
    found: s.phase === "found" && i === s.mid ? 1 : 0,
  }));
  const shotFor = (s: Step, k: number): Shot => {
    const cx = (xOf(s.lo) + xOf(s.hi)) / 2;
    const span = (s.hi - s.lo + 1) * PITCH;
    // Distance at which a width fills the given share of the frame.
    const fit = (width: number, fov: number, share: number) => {
      const h = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * camera.aspect);
      return width / share / 2 / Math.tan(h / 2);
    };
    // The opening and the answer are the flat textbook view, seen from above, with the whole row.
    if (s.phase === "start" || s.phase === "found") {
      const d = fit(n * PITCH, 24, 0.86);
      return { pos: new THREE.Vector3(0, d, d * 0.06), look: new THREE.Vector3(0, 0, 0), fov: 24 };
    }
    // Decisions are seen in depth. The whole row stays in frame, so what was dropped is still
    // seen; the camera leans toward what is left, more as it narrows.
    const lean = 0.35 + 0.4 * (1 - span / (n * PITCH));
    const look = new THREE.Vector3(cx * lean, 0.2, 0);
    const d = fit(n * PITCH * (1 - 0.3 * (1 - span / (n * PITCH))), 30, 0.94);
    const side = k % 4 < 2 ? -1 : 1;
    return { pos: new THREE.Vector3(look.x + side * d * 0.18, d * 0.66, d * 0.72), look, fov: 30 };
  };

  let index = 0;
  let from = { shot: shotFor(steps[0]!, 0), tiles: target(steps[0]!) };
  let to = from;
  let t0 = performance.now();
  const DURATION = 1700;
  let litIds = new Set<string>();
  const litLevel = new Map<string, number>();

  function current(now: number) {
    const u = ease(Math.min(1, (now - t0) / DURATION));
    const shot: Shot = { pos: from.shot.pos.clone().lerp(to.shot.pos, u), look: from.shot.look.clone().lerp(to.shot.look, u), fov: lerp(from.shot.fov, to.shot.fov, u) };
    const states = to.tiles.map((b, i) => {
      const a = from.tiles[i]!;
      return { lift: lerp(a.lift, b.lift, u), gone: lerp(a.gone, b.gone, u), lit: 0, found: lerp(a.found, b.found, u) };
    });
    return { u, shot, states };
  }

  function go(k: number, user = false) {
    if (k < 0 || k >= steps.length) return;
    const now = performance.now();
    const c = current(now);
    from = { shot: c.shot, tiles: c.states };
    to = { shot: shotFor(steps[k]!, k), tiles: target(steps[k]!) };
    t0 = now;
    const before = steps[index]!;
    index = k;
    if (soundOn && k !== 0) {
      const ph = steps[k]!.phase;
      timers.push(window.setTimeout(() => cue(ph === "look" ? "flip" : ph === "drop" ? "slide" : "chime", style.sound), ph === "found" ? 900 : 380));
    }
    void before;
    renderCaption();
    if (user) stopTour();
    narrate();
    root.querySelectorAll(".dots li").forEach((li, j) => li.toggleAttribute("data-current", j === k));
    (root.querySelector('[data-k="looks"]') as HTMLElement).textContent = String(steps[k]!.looks);
    (root.querySelector('[data-k="left"]') as HTMLElement).textContent = String(steps[k]!.hi - steps[k]!.lo + 1);
    history.replaceState(null, "", `#step=${k}`);
  }

  // ---- Caption and narration: words light what they name -------------------------
  let wordSpans: { el: HTMLElement; start: number; end: number; ids: string[] }[] = [];
  let plain = "";
  function renderCaption() {
    sayEl.replaceChildren();
    wordSpans = [];
    plain = "";
    for (const seg of parse(steps[index]!.say)) {
      for (const part of seg.text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { sayEl.append(part); plain += part; continue; }
        const el = document.createElement("span");
        el.textContent = part;
        if (seg.ids.length) el.className = "linked";
        sayEl.append(el);
        wordSpans.push({ el, start: plain.length, end: plain.length + part.length, ids: seg.ids });
        plain += part;
      }
    }
    for (const w of wordSpans) {
      w.el.addEventListener("mouseenter", () => light(w.ids));
      w.el.addEventListener("mouseleave", () => light([]));
    }
  }
  function light(ids: string[]) {
    litIds = new Set(ids);
    labels.querySelectorAll(".num").forEach((el) => (el as HTMLElement).classList.toggle("lit", litIds.has((el as HTMLElement).dataset.id!)));
    root.querySelector(".target")!.classList.toggle("lit", litIds.has("target"));
    root.querySelector(".hud")!.classList.toggle("lit", litIds.has("looks"));
  }
  /** While the recorded voice plays, mark the caption words that name the same parts. */
  function speakIds(ids: string[]) {
    const key = ids.join(" ");
    wordSpans.forEach((s) => s.el.classList.toggle("spoken", !!key && s.ids.join(" ") === key));
    light(ids);
  }
  function speakAt(charIndex: number) {
    const w = charIndex < 0 ? undefined : wordSpans.find((s) => charIndex >= s.start && charIndex < s.end) ?? wordSpans.find((s) => s.start >= charIndex);
    wordSpans.forEach((s) => s.el.classList.toggle("spoken", s === w));
    // A linked phrase keeps its parts lit for all its words.
    light(w?.ids.length ? w.ids : []);
  }

  let voiceOn = !!VOICE || "speechSynthesis" in window;
  let soundOn = true;
  let clip: HTMLAudioElement | null = null;
  let clipRaf = 0;
  let touring = false;
  let timers: number[] = [];
  const voiceBtn = root.querySelector('[data-a="voice"]') as HTMLButtonElement;
  const syncVoiceBtn = () => { voiceBtn.textContent = voiceOn ? "Voice on" : "Voice off"; voiceBtn.setAttribute("aria-pressed", String(voiceOn)); };
  syncVoiceBtn();
  function pickVoice(): SpeechSynthesisVoice | null {
    const vs = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
    return vs.find((v) => /Samantha|Daniel|Karen|Serena|Google UK English|Google US English|Natural/i.test(v.name)) ?? vs[0] ?? null;
  }
  function clearNarration() {
    timers.forEach(clearTimeout);
    timers = [];
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (clip) { clip.pause(); clip = null; }
    cancelAnimationFrame(clipRaf);
  }
  function narrate() {
    clearNarration();
    if (!touring) { speakAt(-1); return; }
    const done = () => { speakAt(-1); if (touring) timers.push(window.setTimeout(() => (index < steps.length - 1 ? go(index + 1) : stopTour()), 650)); };
    if (voiceOn && VOICE?.[index]) {
      const track = VOICE[index]!;
      const el = new Audio(`data:audio/mp4;base64,${track.audio}`);
      clip = el;
      el.onended = () => { cancelAnimationFrame(clipRaf); done(); };
      const follow = () => {
        if (clip !== el) return;
        const t = el.currentTime;
        const link = track.links.find((l) => t >= l.start - 0.05 && t < l.end + 0.25);
        speakIds(link?.ids ?? []);
        clipRaf = requestAnimationFrame(follow);
      };
      // Start once the camera has mostly arrived, so the voice names what you can see.
      timers.push(window.setTimeout(() => { if (clip === el) { void el.play().catch(() => simulate(true)); follow(); } }, 650));
      return;
    }
    if (voiceOn) {
      const u = new SpeechSynthesisUtterance(plain);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = 0.98;
      let boundaries = false;
      u.onboundary = (e) => { if (e.name === "word") { boundaries = true; speakAt(e.charIndex); } };
      u.onstart = () => { if (!boundaries) simulate(false); };
      u.onend = done;
      u.onerror = () => { simulate(true); };
      // Start after the camera has mostly arrived, so the voice names what you can see.
      timers.push(window.setTimeout(() => speechSynthesis.speak(u), 700));
    } else simulate(true);
    // Without boundary events (some voices), or without a voice, words are lit on a reading pace.
    function simulate(advance: boolean) {
      let t = 700;
      for (const w of wordSpans) {
        timers.push(window.setTimeout(() => speakAt(w.start), t));
        t += 140 + (w.end - w.start) * 55;
      }
      if (advance) timers.push(window.setTimeout(done, t + 300));
    }
  }
  function startTour() {
    // Browsers allow sound only after a click: this is that click.
    audio ??= new AudioContext();
    void audio.resume();
    touring = true; playBtn.textContent = "Pause"; if (index === steps.length - 1) go(0); else narrate(); }
  function stopTour() { touring = false; playBtn.textContent = "Play the tour"; clearNarration(); speakAt(-1); }
  const playBtn = root.querySelector('[data-a="play"]') as HTMLButtonElement;
  playBtn.addEventListener("click", () => (touring ? stopTour() : startTour()));
  root.querySelector('[data-a="prev"]')!.addEventListener("click", () => go(index - 1, true));
  root.querySelector('[data-a="next"]')!.addEventListener("click", () => go(index + 1, true));
  const soundBtn = root.querySelector('[data-a="sound"]') as HTMLButtonElement;
  soundBtn.addEventListener("click", () => { soundOn = !soundOn; soundBtn.textContent = soundOn ? "Sound on" : "Sound off"; soundBtn.setAttribute("aria-pressed", String(soundOn)); audio ??= new AudioContext(); });
  root.addEventListener("click", () => { audio ??= new AudioContext(); void audio.resume(); }, { once: true });
  voiceBtn.addEventListener("click", () => { voiceOn = !voiceOn && "speechSynthesis" in window; syncVoiceBtn(); if (touring) narrate(); });
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(index + 1, true);
    if (e.key === "ArrowLeft") go(index - 1, true);
    if (e.key === " ") { e.preventDefault(); touring ? stopTour() : startTour(); }
  });

  // ---- Frame -------------------------------------------------------------------
  const v = new THREE.Vector3();
  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  const start = performance.now();
  function frame(now: number) {
    const c = current(now);
    camera.position.copy(c.shot.pos);
    camera.fov = c.shot.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(c.shot.look);
    c.states.forEach((s, i) => {
      const want = litIds.has(`t${i}`) ? 1 : 0;
      const l = lerp(litLevel.get(`t${i}`) ?? 0, want, 0.18);
      litLevel.set(`t${i}`, l);
      s.lit = l;
      tiles[i]!.apply(s);
    });
    style.tick?.((now - start) / 1000);
    renderer.render(scene, camera);
    const r = stage.getBoundingClientRect();
    const place = (el: HTMLElement, p: THREE.Vector3, show = true) => {
      v.copy(p).project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px) translate(-50%, -50%)`;
      el.style.opacity = show && v.z < 1 ? "" : "0";
    };
    c.states.forEach((s, i) => {
      const el = numberEls[i]!;
      if (!style.htmlNumbers) return;
      place(el, tiles[i]!.labelAnchor(s));
      el.style.setProperty("--gone", String(s.gone));
      el.classList.toggle("found", s.found > 0.5);
      el.classList.toggle("mid", s.lift > 0.5);
    });
    // Pointers stand over their tiles, as in the textbook drawing.
    const st = steps[index]!;
    const at = (i: number) => tiles[i]!.labelAnchor(c.states[i]!).clone().add(new THREE.Vector3(0, 1.05, 0));
    const showMarkers = st.phase === "look" || st.phase === "drop";
    place(markers[0]!, at(st.lo), showMarkers && st.lo !== st.mid);
    place(markers[1]!, at(st.mid ?? st.lo), st.phase === "look");
    place(markers[2]!, at(st.hi), showMarkers && st.hi !== st.mid && st.hi !== st.lo);
    requestAnimationFrame(frame);
  }
  const fromHash = Number(new URLSearchParams(location.hash.slice(1)).get("step"));
  go(Number.isInteger(fromHash) && fromHash > 0 && fromHash < steps.length ? fromHash : 0);
  // A linked view opens settled, not mid-flight.
  t0 = performance.now() - DURATION;
  from = to;
  requestAnimationFrame(frame);
  (window as unknown as { __sample: unknown }).__sample = { go, steps, settle: () => { t0 = performance.now() - DURATION; from = to; } };
}
