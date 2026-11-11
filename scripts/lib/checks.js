// In-page checks, injected by verify.mjs. Deliberately independent of the
// engine's own code: depth is judged by casting the line of sight against
// the true geometry and asking the browser what is actually painted on top.
(() => {
  const C = Math.cos(Math.PI / 6);
  const viz = () => window.__viz;
  const svg = () => viz().stage.svg;
  const projection = () => svg().getAttribute("data-projection") || "iso";
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

  const byKey = (key) => viz().root.querySelector(`[data-key="${CSS.escape(key)}"]`);

  function isShown(el) {
    if (!el) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      if (e.getAttribute && e.getAttribute("opacity") === "0") return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function centre(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  // ---- Observations --------------------------------------------------------
  function observe(list) {
    const failures = [];
    for (const o of list) {
      const el = byKey(o.key ?? (o.keys && o.keys[0]));
      if (o.type === "text") {
        if (!el) failures.push(`text ${o.key}: no element`);
        else if (!isShown(el)) failures.push(`text ${o.key}: not visible`);
        else {
          const text = el.querySelector(".vz-solid-label")?.textContent ?? el.textContent;
          if (norm(text) !== norm(o.equals)) failures.push(`text ${o.key}: shows "${norm(text)}", model says "${o.equals}"`);
        }
      } else if (o.type === "visible") {
        const shown = isShown(el);
        if (!o.visible) {
          if (shown) failures.push(`visible ${o.key}: should not be drawn, but is`);
        } else if (!shown) failures.push(`visible ${o.key}: not drawn`);
        else {
          const share = seenShare(el);
          if (share < MIN_SEEN) failures.push(`visible ${o.key}: drawn but only ${(share * 100).toFixed(0)}% of it can be seen (min ${MIN_SEEN * 100}%)`);
        }
      } else if (o.type === "extent") {
        const problem = extentProblem(el, o);
        if (problem) failures.push(`extent ${o.key}: ${problem}`);
      } else if (o.type === "lit") {
        if (!el || !el.hasAttribute("data-lit")) failures.push(`lit ${o.key}: not highlighted`);
      } else if (o.type === "tone") {
        if (!el || el.getAttribute("data-tone") !== o.equals) failures.push(`tone ${o.key}: expected ${o.equals}, got ${el?.getAttribute("data-tone") ?? "missing"}`);
      } else if (o.type === "order") {
        const els = o.keys.map(byKey);
        const missing = o.keys.filter((_, i) => !els[i] || !isShown(els[i]));
        if (missing.length) {
          failures.push(`order: not drawn: ${missing.join(", ")}`);
          continue;
        }
        const axis = o.axis === "x" ? 0 : 1;
        const pos = els.map((e) => centre(e)[axis]);
        for (let i = 1; i < pos.length; i++) {
          if (!(pos[i] > pos[i - 1])) {
            const seen = o.keys.map((k, j) => [k, pos[j]]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
            failures.push(`order (${o.axis}): drawn ${seen.join(" < ")}, model says ${o.keys.join(" < ")}`);
            break;
          }
        }
      }
    }
    return failures;
  }

  // ---- Seen, not just present ---------------------------------------------------
  const MIN_SEEN = 0.15;
  const NO_HIT = '[data-layer="overlay"],[data-layer="labels"],.vz-solid-label{pointer-events:none!important}';

  /**
   * Share of an element's area where the browser reports it on top. For a
   * solid, sample its drawn outline; for a line, sample along it; for HTML,
   * sample its box.
   */
  function seenShare(el) {
    const guard = document.createElement("style");
    guard.textContent = NO_HIT;
    document.head.append(guard);
    try {
      const pts = [];
      const edge = el.querySelector && el.querySelector(".vz-edge");
      const line = el.querySelector && el.querySelector("line.vz-link");
      if (edge) {
        const poly = parsePoints(edge.getAttribute("points"));
        const ctm = edge.getScreenCTM();
        const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const N = 9;
        for (let i = 0; i < N; i++)
          for (let j = 0; j < N; j++) {
            const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y0 + ((j + 0.5) / N) * (y1 - y0);
            if (inside(poly, x, y)) pts.push([ctm.a * x + ctm.c * y + ctm.e, ctm.b * x + ctm.d * y + ctm.f]);
          }
      } else if (line) {
        const ctm = line.getScreenCTM();
        const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((a) => Number(line.getAttribute(a)));
        for (let i = 1; i < 12; i++) {
          const x = x1 + ((x2 - x1) * i) / 12, y = y1 + ((y2 - y1) * i) / 12;
          pts.push([ctm.a * x + ctm.c * y + ctm.e, ctm.b * x + ctm.d * y + ctm.f]);
        }
      } else {
        if (el instanceof SVGElement && el.closest('[data-layer="labels"]')) return 1; // labels are drawn above everything
        const r = el.getBoundingClientRect();
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) pts.push([r.left + ((i + 0.5) / 3) * r.width, r.top + ((j + 0.5) / 3) * r.height]);
      }
      if (!pts.length) return 0;
      let seen = 0;
      for (const [x, y] of pts) {
        const top = document.elementFromPoint(x, y);
        if (top && (top === el || el.contains(top))) seen++;
      }
      return seen / pts.length;
    } finally {
      guard.remove();
    }
  }

  /**
   * Compare a solid's drawn outline with the screen box its declared world
   * size must project to. Isometric: a box w×d×h spans (w+d)·cos30° by
   * (w+d)/2 + h; a cylinder of diameter D spans √2·cos30°·D by h + D/√2.
   * Front: w by h.
   */
  function extentProblem(el, o) {
    const edge = el && el.querySelector(".vz-edge");
    if (!edge) return "no solid with this key";
    const b = edge.getBBox();
    const [w, d, h] = o.size;
    const cyl = el.getAttribute("data-kind") === "cylinder";
    let W, H;
    if (projection() === "front") [W, H] = [w, h];
    else if (cyl) [W, H] = [Math.SQRT2 * C * w, h + w / Math.SQRT2];
    else {
      const r = Math.min(Math.max(o.radius ?? 0, 0), w / 2, d / 2);
      const trim = 2 * r * (2 - Math.SQRT2);
      [W, H] = [(w + d - trim) * C, (w + d - trim) / 2 + h];
    }
    const tol = o.tolerance ?? 0.6;
    if (Math.abs(b.width - W) > tol || Math.abs(b.height - H) > tol) {
      return `drawn ${b.width.toFixed(1)}×${b.height.toFixed(1)}, a ${o.size.join("×")} ${cyl ? "cylinder" : "box"} projects to ${W.toFixed(1)}×${H.toFixed(1)}`;
    }
    return null;
  }

  // ---- Geometry helpers ------------------------------------------------------
  function parsePoints(attr) {
    return (attr || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p.split(",").map(Number));
  }

  function inside(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function edgeDistance(poly, x, y) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
    return best;
  }

  /** Nearness of the first surface hit along the line of sight, or null. Larger is nearer. */
  function hit(m, sx, sy, proj) {
    if (proj === "front") {
      const x = sx, z = -sy;
      if (m.kind === "box") {
        if (x < m.at[0] || x > m.at[0] + m.size[0] || z < m.at[2] || z > m.at[2] + m.size[2]) return null;
        return -m.at[1];
      }
      const dx = x - m.at[0];
      if (Math.abs(dx) > m.radius || z < m.at[2] || z > m.at[2] + m.height) return null;
      return -(m.at[1] - Math.sqrt(m.radius * m.radius - dx * dx));
    }
    const u = sx / C, v = 2 * sy;
    const bx = (u + v) / 2, by = (v - u) / 2;
    if (m.kind === "box") {
      let t0 = -Infinity, t1 = Infinity;
      const base = [bx, by, 0];
      for (let i = 0; i < 3; i++) {
        t0 = Math.max(t0, m.at[i] - base[i]);
        t1 = Math.min(t1, m.at[i] + m.size[i] - base[i]);
      }
      if (t0 >= t1) return null;
      const r = Math.min(Math.max(m.radius ?? 0, 0),m.size[0]/2,m.size[1]/2);
      if (!r) return t1;
      const x = bx+t1, y = by+t1;
      const cx = Math.max(m.at[0]+r,Math.min(x,m.at[0]+m.size[0]-r));
      const cy = Math.max(m.at[1]+r,Math.min(y,m.at[1]+m.size[1]-r));
      if ((x-cx)**2+(y-cy)**2 <= r*r) return t1;
      const dx=bx-cx, dy=by-cy;
      const b=2*(dx+dy), c=dx*dx+dy*dy-r*r, disc=b*b-8*c;
      if (disc<0) return null;
      const lo=Math.max(t0,(-b-Math.sqrt(disc))/4), hi=Math.min(t1,(-b+Math.sqrt(disc))/4);
      return lo<hi ? hi : null;
    }
    // Vertical cylinder: 2t² + 2t(dx + dy) + dx² + dy² − r² ≤ 0, and z0 ≤ t ≤ z1.
    const dx = bx - m.at[0], dy = by - m.at[1];
    const a = 2, b = 2 * (dx + dy), c = dx * dx + dy * dy - m.radius * m.radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const r = Math.sqrt(disc);
    const t0 = Math.max((-b - r) / (2 * a), m.at[2]);
    const t1 = Math.min((-b + r) / (2 * a), m.at[2] + m.height);
    return t0 < t1 ? t1 : null;
  }

  // ---- Depth order -----------------------------------------------------------
  function depth() {
    const s = svg();
    const proj = projection();
    const solids = viz().frame().marks.filter((m) => m.kind === "box" || m.kind === "cylinder");
    const ctm = s.getScreenCTM();
    const inv = ctm.inverse();
    const pxPerUnit = Math.hypot(ctm.a, ctm.b);
    const margin = 2.5 / pxPerUnit;
    const outlines = new Map();
    for (const m of solids) {
      const g = byKey(m.key);
      const edge = g && g.querySelector(".vz-edge");
      if (edge) outlines.set(m.key, parsePoints(edge.getAttribute("points")));
    }
    const pt = s.createSVGPoint();
    const toClient = (x, y) => {
      pt.x = x;
      pt.y = y;
      const p = pt.matrixTransform(ctm);
      return [p.x, p.y];
    };
    void inv;

    const guard = document.createElement("style");
    guard.textContent = '[data-layer="overlay"],[data-layer="labels"],.vz-solid-label{pointer-events:none!important}';
    document.head.append(guard);

    const wrong = [];
    let samples = 0;
    try {
      const keys = [...outlines.keys()];
      const all = [...outlines.values()];
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const A = outlines.get(keys[i]), B = outlines.get(keys[j]);
          const bb = (p) => [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))];
          const a = bb(A), b = bb(B);
          const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
          if (x1 - x0 < margin * 2 || y1 - y0 < margin * 2) continue;
          const N = 7;
          for (let gx = 0; gx < N; gx++) {
            for (let gy = 0; gy < N; gy++) {
              const x = x0 + ((gx + 0.5) / N) * (x1 - x0);
              const y = y0 + ((gy + 0.5) / N) * (y1 - y0);
              if (!inside(A, x, y) || !inside(B, x, y)) continue;
              // Keep clear of every outline, not just this pair's: a third solid's
              // stroke would otherwise win the hit test a hair outside its shape.
              if (all.some((poly) => edgeDistance(poly, x, y) < margin)) continue;
              // The truly nearest surface among every solid on the line of sight.
              let best = null, bestT = -Infinity, secondT = -Infinity;
              for (const m of solids) {
                const t = hit(m, x, y, proj);
                if (t === null) continue;
                if (t > bestT) [secondT, bestT, best] = [bestT, t, m.key];
                else if (t > secondT) secondT = t;
              }
              if (!best || bestT - secondT < 0.05) continue;
              const [cx, cy] = toClient(x, y);
              const el = document.elementFromPoint(cx, cy);
              const shown = el && el.closest("[data-key]");
              const got = shown && shown.getAttribute("data-key");
              samples++;
              if (got !== best) wrong.push({ at: [Math.round(cx), Math.round(cy)], vb: [x, y], pair: [keys[i], keys[j]], expected: best, painted: got });
            }
          }
        }
      }
    } finally {
      guard.remove();
    }
    return { samples, wrong, conflicts: viz().stage.conflicts() };
  }

  // ---- Colour ----------------------------------------------------------------
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  function rgba(css) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }
  function luminance([r, g, b]) {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function ratio(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }
  function backgroundOf(el) {
    for (let e = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c[3] > 0.5) return c;
    }
    return rgba(getComputedStyle(document.body).backgroundColor);
  }

  /** The face a solid's label is drawn on. */
  function labelFace(label) {
    const g = label.closest("[data-key]");
    const shade = label.getAttribute("data-face") || "top";
    return g.querySelector(`.vz-face[data-shade="${shade}"]:not([display="none"])`) || g.querySelector(".vz-face:not([display=\"none\"])");
  }

  // ---- Text: size, contrast, overlap, occlusion ----------------------------------
  function textNodes() {
    const root = viz().root;
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      // Zero-width characters (KaTeX layout struts) are not text anyone reads.
      if (!norm(n.textContent.replace(/[\u200b-\u200d\u2060\ufeff]/g, ""))) continue;
      const el = n.parentElement;
      if (!el || el.closest("details:not([open]) > :not(summary)") || el.closest("title") || el.closest(".vz-sr") || el.closest(".katex-mathml")) continue;
      if (!isShown(el)) continue;
      out.push(el);
    }
    return [...new Set(out)];
  }

  function text() {
    const small = [], faint = [];
    for (const el of textNodes()) {
      const inSvg = el instanceof SVGElement;
      let px;
      if (inSvg) {
        px = parseFloat(getComputedStyle(el).fontSize) * Math.hypot(el.getScreenCTM().a, el.getScreenCTM().b);
      } else px = parseFloat(getComputedStyle(el).fontSize);
      const script = el.closest(".msupsub, .mfrac .vlist");
      const min = script ? 9.5 : 11;
      if (px < min - 0.05) small.push(`${norm(el.textContent).slice(0, 30)} at ${px.toFixed(1)}px (min ${min})`);

      const cs = getComputedStyle(el);
      const fg = rgba(inSvg ? cs.fill : cs.color);
      let bg;
      if (inSvg && el.classList.contains("vz-solid-label")) {
        bg = rgba(getComputedStyle(labelFace(el)).fill);
      } else bg = backgroundOf(inSvg ? viz().stage.svg.parentElement : el);
      const r = ratio(fg, bg);
      const need = px >= 18 || (px >= 14 && Number(cs.fontWeight) >= 600) ? 3 : 4.5;
      if (r < need) faint.push(`"${norm(el.textContent).slice(0, 30)}" contrast ${r.toFixed(2)} < ${need}`);
    }
    return { small, faint };
  }

  function labels() {
    const s = svg();
    const els = [...s.querySelectorAll(".vz-label, .vz-solid-label")].filter((e) => norm(e.textContent) && isShown(e));
    const rects = els.map((e) => e.getBoundingClientRect());
    const overlaps = [];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = rects[i], b = rects[j];
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) overlaps.push(`"${norm(els[i].textContent)}" overlaps "${norm(els[j].textContent)}"`);
      }
    }
    const spill = [], hidden = [], clipped = [];
    const card = viz().root.querySelector(".vz-card").getBoundingClientRect();
    const guard = document.createElement("style");
    guard.textContent = '[data-layer="labels"],[data-layer="overlay"],.vz-solid-label{pointer-events:none!important}';
    document.head.append(guard);
    try {
      els.forEach((e, i) => {
        const r = rects[i];
        if (r.left < card.left || r.right > card.right || r.top < card.top || r.bottom > card.bottom) clipped.push(`"${norm(e.textContent)}" outside the card`);
        if (!e.classList.contains("vz-solid-label")) return;
        const g = e.closest("[data-key]");
        const fr = labelFace(e).getBoundingClientRect();
        if (r.width > fr.width * 0.92) spill.push(`"${norm(e.textContent)}" is wider than its face (${r.width.toFixed(0)} > ${fr.width.toFixed(0)} px)`);
        else if (r.height > fr.height * 1.05) spill.push(`"${norm(e.textContent)}" is taller than its face (${r.height.toFixed(0)} > ${fr.height.toFixed(0)} px)`);
        const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
        const under = document.elementFromPoint(cx, cy);
        const owner = under && under.closest("[data-key]");
        if (owner !== g) hidden.push(`"${norm(e.textContent)}" on ${g.getAttribute("data-key")} is covered by ${owner ? owner.getAttribute("data-key") : "nothing"}`);
      });
    } finally {
      guard.remove();
    }
    const panels = [...viz().root.querySelectorAll(".vz-panel-body")].filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => `panel ${p.parentElement.getAttribute("data-key")} overflows by ${p.scrollWidth - p.clientWidth}px`);
    return { overlaps, spill, hidden, clipped, panels };
  }

  /**
   * Canonical serialization: tag, attributes sorted by name, text. Attribute
   * order is an artefact of removal and re-insertion, not visible state.
   */
  function canonical(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const attrs = [...node.attributes].map((a) => `${a.name}=${JSON.stringify(a.value)}`).sort().join(" ");
    return `<${node.localName} ${attrs}>${[...node.childNodes].map(canonical).join("")}</${node.localName}>`;
  }

  /** Everything visible that a seek could leave behind. */
  function snapshot() {
    const r = viz().root;
    return [
      canonical(svg()),
      r.querySelector('[data-role="caption"]').textContent,
      r.querySelector('[data-role="readout"]').textContent,
      r.querySelector('[data-role="count"]').textContent,
      [...r.querySelectorAll(".vz-panel")].map(canonical).join(""),
    ].join("\u0000");
  }

  function shown() {
    const r = viz().root;
    return {
      action: norm(r.querySelector('[data-role="action"]')?.textContent),
      caption: norm(r.querySelector('[data-role="caption"]').textContent),
      readout: norm(r.querySelector('[data-role="readout"]').textContent),
      trust: r.querySelector('[data-role="trust"]').dataset.trust,
    };
  }

  /** The default desktop page must fit, without hiding content to do so. */
  function desktop() {
    const root = viz().root;
    const viewport = [], copy = [];
    const page = document.scrollingElement;
    if (page.scrollWidth > innerWidth + 1 || page.scrollHeight > innerHeight + 1) {
      viewport.push(`page exceeds ${innerWidth}×${innerHeight}: ${page.scrollWidth}×${page.scrollHeight}`);
    }
    for (const selector of [".vz-head", ".vz-stage", ".vz-panels", ".vz-controls", ".vz-caption"]) {
      const e = root.querySelector(selector);
      if (!isShown(e)) { viewport.push(`${selector} is not visible`); continue; }
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) viewport.push(`${selector} falls outside the viewport`);
    }
    const stage = root.querySelector(".vz-stage").getBoundingClientRect();
    const card = root.querySelector(".vz-card").getBoundingClientRect();
    if (stage.height < card.height * .55) viewport.push("diagram stage uses less than 55% of the card height");
    for (const solid of svg().querySelectorAll(".vz-solid")) {
      if (!isShown(solid) || Number(solid.getAttribute("opacity") ?? 1) < .3) continue;
      const r = solid.getBoundingClientRect();
      if (r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1 || r.bottom > stage.bottom + 1) viewport.push(`${solid.dataset.key} is clipped by the stage`);
    }
    // A budget is a review guard, not an instruction to truncate meaningful text.
    for (const [selector, budget] of [[".vz-question", 8], [".vz-step-heading", 12], [".vz-predict > p:not(.vz-predict-feedback)", 12], [".vz-predict-feedback", 12]]) {
      const e = root.querySelector(selector);
      if (!isShown(e)) continue;
      const words = norm(e.textContent).split(/\s+/).filter(Boolean).length;
      if (words > budget) copy.push(`${selector} has ${words} words (budget ${budget})`);
    }
    for (const selector of [".vz-text", ".vz-setup", ".vz-meta", ".vz-foot"]) {
      if (isShown(root.querySelector(selector))) copy.push(`${selector} is visible outside Details`);
    }
    return { viewport, copy };
  }

  function design() {
    const root=viz().root;
    const composition=[], semantics=[], callouts=[];
    if (root.dataset.presentation !== "editorial") return {composition,semantics,callouts};
    const stage=root.querySelector(".vz-stage").getBoundingClientRect();
    const body=root.querySelector(".vz-body").getBoundingClientRect();
    if (stage.width < body.width*.9) composition.push("figure stage occupies less than 90% of the body width");
    const solids=[...svg().querySelectorAll(".vz-solid")].filter(isShown).map(e=>e.getBoundingClientRect());
    if (solids.length) {
      const width=Math.max(...solids.map(r=>r.right))-Math.min(...solids.map(r=>r.left));
      if (width/stage.width < .42) composition.push(`solid figure occupies only ${(100*width/stage.width).toFixed(0)}% of the stage width (min 42%)`);
    }
    const colour=css=>{const e=document.createElement("span");e.style.color=css;root.append(e);const c=getComputedStyle(e).color;e.remove();return c;};
    for (const swatch of root.querySelectorAll(".vz-swatch[data-tone]")) {
      const tone=swatch.dataset.tone;
      for (const solid of svg().querySelectorAll(`.vz-solid[data-tone="${tone}"]`)) {
        if (colour(getComputedStyle(swatch).backgroundColor)!==colour(getComputedStyle(solid).getPropertyValue("--tone"))) semantics.push(`${tone}: solid colour differs from its legend`);
        if (solid.hasAttribute("data-lit")) {
          const edge=getComputedStyle(solid.querySelector(".vz-edge")).stroke;
          if (colour(edge)!==colour(getComputedStyle(solid).getPropertyValue("--tone"))) semantics.push(`${tone}: highlight introduces a different semantic colour`);
        }
      }
    }
    for (const label of svg().querySelectorAll(".vz-label-g[data-target]")) {
      const key=label.dataset.target;
      const target=viz().frame().marks.find(m=>m.key===key);
      const authored=viz().frame().marks.find(m=>m.key===label.dataset.key);
      if (!target || !authored?.target) {callouts.push(`${label.dataset.key}: missing target ${key}`);continue;}
      const p=authored.target.at;
      const inside=target.kind==="box" ? p.every((v,i)=>v>=target.at[i]-.05 && v<=target.at[i]+target.size[i]+.05) : target.kind==="cylinder" && Math.hypot(p[0]-target.at[0],p[1]-target.at[1])<=target.radius+.05 && p[2]>=target.at[2]-.05 && p[2]<=target.at[2]+target.height+.05;
      if (!inside) callouts.push(`${label.dataset.key}: pin is outside ${key}`);
      if (target.kind==="box" && !p.some((v,i)=>Math.abs(v-target.at[i])<.05 || Math.abs(v-target.at[i]-target.size[i])<.05)) callouts.push(`${label.dataset.key}: pin does not sit on a surface of ${key}`);
      const expected=projection()==="front" ? [p[0],-p[2]] : [(p[0]-p[1])*C,(p[0]+p[1])*.5-p[2]];
      const line=label.querySelector(".vz-leader");
      if (!line || Math.hypot(Number(line.getAttribute("x2"))-expected[0],Number(line.getAttribute("y2"))-expected[1])>.1) callouts.push(`${label.dataset.key}: leader misses its model anchor`);
    }
    return {composition,semantics,callouts};
  }

  window.__vzCheck = { observe, depth, text, labels, snapshot, shown, design, desktop };
})();
