// The look checks of check-drawing.mjs: what a rig figure must show for a reader to see solids,
// a subject and a callout's target at first glance. Each one came from a page that passed every
// other check and still looked wrong (the first automatic watch: near-white tops and sides, the
// same framing on every step, a leader running the figure's full height, the key part hidden).
//
// The functions named `in*` run in the page (check-drawing passes them to page.evaluate, which
// serializes them, so they use nothing from this module); they gather raw values. The rest run in
// Node and judge those values, so they can be tested without a browser (look.test.mjs).

// ---------------------------------------------------------------- thresholds
// Calibrated on escalator, lock, derailleur and bloom (the bar); the measured values are in
// references/verify.md, "Look checks".
export const LOOK = {
  // a turned thick part: the worst screen error its placement may leave, in px (the rig's contract)
  turnErrPx: 1.0,
  // a lit part's top against its sides: the least OKLab lightness difference (derailleur 0.055, bloom 0.091)
  capWall: 0.04,
  // a part the step is about, its top against the stage: the least OKLab lightness difference (bloom's white card 0.023)
  capStage: 0.02,
  // two steps in the same framing: the camera moves less than this many clear-area short sides between them
  sameShot: 0.05,
  // more than this many steps in a row in the same framing fails (derailleur 1; bloom 2, and 4 in its "six" What if)
  sameRun: 4,
  // the part a step is about: the least share of the stage's shorter side it spans (derailleur 16%, bloom 35%)
  subjectSpan: 0.12,
  // a callout's leader: the longest it may be, in stage shorter sides (derailleur 0.74)
  leaderLong: 0.8,
  // a leader over another part that matters now: the most it may run across it, in stage shorter sides (derailleur 0.19)
  leaderCross: 0.25,
  // a part the step is about: the least share of it that must be on top, not under other parts (the derailleur's
  // guide pulley is 7% on top behind the knuckle in its "wide" What if, so this only catches a part buried whole)
  visible: 0.05,
};

// ---------------------------------------------------------------- colour
/** OKLab lightness (0 black to 1 white) of an 8-bit sRGB colour. */
export function oklabL([r, g, b]) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** The weighted median of [value, weight] pairs, or null for none. */
export function weightedMedian(pairs) {
  const xs = pairs.filter(([, w]) => w > 0).sort((a, b) => a[0] - b[0]);
  if (!xs.length) return null;
  const total = xs.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of xs) if ((acc += w) >= total / 2) return v;
  return xs.at(-1)[0];
}

/**
 * How far a part's top reads from its sides: the weighted median lightness of all its caps, against
 * each shade of its walls that holds at least a tenth of their weight; the farthest such shade counts
 * (a solid reads as one when one of its sides stands clearly off its top). Solids are { caps, walls,
 * material } with faces as [r, g, b, weight]. Null when the part has no caps or no walls.
 */
export function partContrast(solids) {
  const caps = solids.flatMap((s) => s.caps), walls = solids.flatMap((s) => s.walls.map((f) => [...f, s.material]));
  if (!caps.length || !walls.length) return null;
  const cap = weightedMedian(caps.map(([r, g, b, w]) => [oklabL([r, g, b]), w]));
  const total = walls.reduce((a, f) => a + f[3], 0);
  let best = null;
  for (const [r, g, b, w, material] of walls) {
    if (w < total / 10) continue;
    const wall = oklabL([r, g, b]);
    if (!best || Math.abs(cap - wall) > Math.abs(best.cap - best.wall)) best = { cap, wall, material };
  }
  return best;
}

// ---------------------------------------------------------------- transforms
/**
 * Does a 2D linear part [a b c d] turn what it draws (anything but a translate or a uniform scale)?
 * A mirror or a half turn (a = d < 0 with no shear) turns it too.
 */
export function turns(a, b, c, d) {
  const k = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), 1e-9), eps = 1e-3 * k;
  return Math.abs(b) > eps || Math.abs(c) > eps || Math.abs(a - d) > eps || a < 0;
}

// ---------------------------------------------------------------- framing
/** How far the picture moves from camera a to camera b, in the clear area's shorter side (as check-drawing's calm). */
export function moved(a, b, c) {
  let d = 0;
  for (const m of [a, b])
    for (const [sx, sy] of [[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1]]) {
      const q = [(sx - m.x) / m.s, (sy - m.y) / m.s];
      d = Math.max(d, Math.hypot((a.s - b.s) * q[0] + a.x - b.x, (a.s - b.s) * q[1] + a.y - b.y));
    }
  return d / Math.min(c.x1 - c.x0, c.y1 - c.y0);
}

/** The longest run of consecutive steps whose framing is the same; ms[i] is step i + 1's camera. Returns { len, from, to } in steps. */
export function longestSameRun(ms, clear, same = LOOK.sameShot) {
  if (!ms.length) return { len: 0, from: 0, to: 0 };
  let best = { len: 1, from: 1, to: 1 }, from = 0;
  for (let i = 1; i < ms.length; i++) {
    if (moved(ms[i - 1], ms[i], clear) >= same) from = i;
    if (i - from + 1 > best.len) best = { len: i - from + 1, from: from + 1, to: i + 1 };
  }
  return best;
}

// ---------------------------------------------------------------- in the page
/**
 * The turn audit through the story: seek every `stepMs` and list every visible .rig-part whose own
 * transform turns (by `turnsSrc`, the source of `turns` above) while it draws walls (.rig-wall, in
 * itself or in the template its <use> shows) and carries no data-rig-turn. Then the turn record.
 */
export function inTurnSweep(stepMs, turnsSrc) {
  const turnsFn = (0, eval)(`(${turnsSrc})`);
  const max = Number(document.getElementById("scrub").max) * 1000;
  const walls = new Map();
  const hasWall = (g) => {
    if (g.querySelector(".rig-wall")) return true;
    for (const u of g.querySelectorAll("use")) {
      const h = u.getAttribute("href") ?? u.getAttribute("xlink:href") ?? "";
      if (!walls.has(h)) {
        const t = h.startsWith("#") ? document.getElementById(h.slice(1)) : null;
        walls.set(h, !!t && (t.matches(".rig-wall") || !!t.querySelector(".rig-wall")));
      }
      if (walls.get(h)) return true;
    }
    return false;
  };
  const bad = new Map();
  let samples = 0, turned = 0;
  for (let t = 0; t <= max; t += stepMs) {
    window.__viz.seek(t);
    samples++;
    for (const g of document.querySelectorAll("#fig .rig-part")) {
      if (g.style.display === "none") continue;
      const list = g.transform?.baseVal;
      if (!list || !list.numberOfItems) continue;
      let m = new DOMMatrix();
      for (let i = 0; i < list.numberOfItems; i++) m = m.multiply(DOMMatrix.fromMatrix(list.getItem(i).matrix));
      if (!turnsFn(m.a, m.b, m.c, m.d)) continue;
      turned++;
      if (g.hasAttribute("data-rig-turn") || !hasWall(g)) continue;
      const id = g.dataset.item ?? g.dataset.part ?? "?";
      if (!bad.has(id)) bad.set(id, { part: g.dataset.part, t: t / 1000, m: [m.a, m.b, m.c, m.d].map((x) => +x.toFixed(3)) });
    }
  }
  const rec = globalThis.__rig?.turns;
  return { samples, turned, bad: [...bad].map(([id, v]) => ({ id, ...v })), record: rec ? [...rec].map(([id, v]) => ({ id, maxErrPx: v.maxErrPx, n: v.n })) : [] };
}

/**
 * The faces of every lit (not receded, shown) rig part right now: per part, each solid's caps and
 * walls as [r, g, b, weight] (weight: the face's box area), and the stage's colour. Faces inside a
 * <use> are read from its template (a lit part's template resolves the same tokens).
 */
export function inFaces() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true }), cache = new Map();
  const rgb = (css) => {
    if (cache.has(css)) return cache.get(css);
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000";
    cx.fillStyle = css;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data, v = [d[0], d[1], d[2]];
    cache.set(css, v);
    return v;
  };
  const shown = (el) => {
    for (let e = el; e && e.id !== "fig"; e = e.parentElement) if (e.style?.display === "none") return false;
    return true;
  };
  const solidsOf = (root) => {
    const out = [];
    for (const s of root.matches?.(".rig-solid") ? [root] : root.querySelectorAll(".rig-solid")) {
      const face = (f) => {
        const b = f.getBBox();
        return [...rgb(getComputedStyle(f).fill), b.width * b.height];
      };
      const caps = [...s.querySelectorAll(".rig-cap")].map(face), walls = [...s.querySelectorAll(".rig-wall")].map(face);
      if (caps.length || walls.length) out.push({ material: [...s.classList].find((c) => c.startsWith("rig-m-")) ?? "", caps, walls });
    }
    return out;
  };
  const parts = new Map();
  for (const g of document.querySelectorAll("#fig .rig-part")) {
    if (g.hasAttribute("data-recede") || !shown(g)) continue;
    const r = g.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let solids = solidsOf(g);
    for (const u of g.querySelectorAll("use")) {
      const h = u.getAttribute("href") ?? "", t = h.startsWith("#") ? document.getElementById(h.slice(1)) : null;
      if (t) solids = solids.concat(solidsOf(t));
    }
    if (!solids.length) continue;
    const p = g.dataset.part ?? g.dataset.item ?? "?", was = parts.get(p);
    if (was) was.solids.push(...solids), (was.named ||= g.hasAttribute("data-named"));
    else parts.set(p, { part: p, named: g.hasAttribute("data-named"), solids });
  }
  const stage = document.querySelector(".vz-stage");
  return { theme: document.querySelector(".vz")?.dataset.theme ?? document.documentElement.dataset.theme ?? "", stage: rgb(getComputedStyle(stage).backgroundColor), parts: [...parts.values()] };
}

/**
 * Every shown callout's leader right now, in page pixels: its length, the part it names, and how far
 * it runs inside each other named part's box (other callouts' parts and the parts lit now). Bounds come
 * from __viz.partsOnScreen, or else from the part's groups on screen.
 */
export function inLeaders() {
  const sb = document.querySelector(".vz-stage").getBoundingClientRect();
  const short = Math.min(sb.width, sb.height);
  const vis = (g) => g.style.display !== "none" && g.getAttribute("visibility") !== "hidden" && getComputedStyle(g).display !== "none" && getComputedStyle(g).visibility !== "hidden";
  const labels = [...document.querySelectorAll("#fig g.label")].filter((g) => vis(g) && g.querySelector(".leader")?.getAttribute("d"));
  const nameOf = (g) => g.dataset.at ?? g.dataset.label ?? "";
  // the parts that matter now: other callouts' parts and the parts lit now
  const names = new Set(labels.map(nameOf).filter(Boolean));
  for (const g of document.querySelectorAll("#fig .rig-part[data-named]")) if (g.dataset.part && g.style.display !== "none") names.add(g.dataset.part);
  const partAt = (x, y) => {
    for (const e of document.elementsFromPoint(x, y)) {
      const g = e.closest?.("#fig .rig-part");
      if (g) return g.dataset.part ?? null;
    }
    return null;
  };
  const style = document.createElement("style");
  style.textContent = ".rig-contact,.rig-sil,.rig-crease,.rig-shine,#fig g.label,#fig g.label *{pointer-events:none!important}";
  document.head.append(style);
  const out = [];
  for (const g of labels) {
    const path = g.querySelector(".leader"), m = path.getScreenCTM(), L = path.getTotalLength();
    const pts = [];
    for (let d = 0; d <= L; d += Math.max(L / 120, 0.5)) {
      const q = path.getPointAtLength(d);
      pts.push([m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]);
    }
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    // the part the leader ends on is its target, whatever the callout calls it
    const own = nameOf(g), end = pts.at(-1) ?? [0, 0], target = partAt(end[0], end[1]), cross = new Map();
    for (let i = 1; i < pts.length; i++) {
      const x = (pts[i][0] + pts[i - 1][0]) / 2, y = (pts[i][1] + pts[i - 1][1]) / 2;
      const n = partAt(x, y);
      if (!n || n === own || n === target || !names.has(n)) continue;
      cross.set(n, (cross.get(n) ?? 0) + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    out.push({ label: g.querySelector("text")?.textContent.trim() ?? own, part: own, len, cross: [...cross].map(([part, px]) => ({ part, px })) });
  }
  style.remove();
  return { short, leaders: out };
}

/**
 * How much of each named part is on top: a grid over its box on screen, and at each point that hits
 * the part at all, whether it is the first rig part hit (labels, leaders and cards are not parts).
 */
export function inVisible(names) {
  const sb = document.querySelector(".vz-stage").getBoundingClientRect(), out = [];
  // outlines and contact shadows lie over neighbours by design; they do not hide them
  const style = document.createElement("style");
  style.textContent = ".rig-contact,.rig-sil,.rig-crease,.rig-shine,.rig-arrow,.rig-arrow *,#fig g.label,#fig g.label *{pointer-events:none!important}";
  document.head.append(style);
  for (const n of names) {
    const gs = [...document.querySelectorAll(`#fig .rig-part[data-part="${CSS.escape(n)}"]`)].filter((g) => g.style.display !== "none");
    let b = null;
    for (const g of gs) {
      const q = g.getBoundingClientRect();
      if (!q.width && !q.height) continue;
      b = b ? { x: Math.min(b.x, q.left), y: Math.min(b.y, q.top), r: Math.max(b.r, q.right), b: Math.max(b.b, q.bottom) } : { x: q.left, y: q.top, r: q.right, b: q.bottom };
    }
    if (!b) continue;
    const x0 = Math.max(b.x, sb.left + 1), x1 = Math.min(b.r, sb.right - 1), y0 = Math.max(b.y, sb.top + 1), y1 = Math.min(b.b, sb.bottom - 1);
    if (x1 <= x0 || y1 <= y0) continue;
    const N = 16;
    let hits = 0, top = 0;
    const over = new Map();
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / N, y = y0 + ((j + 0.5) * (y1 - y0)) / N;
        const parts = document.elementsFromPoint(x, y).map((e) => e.closest?.("#fig .rig-part")).filter(Boolean);
        if (!parts.some((g) => g.dataset.part === n)) continue;
        hits++;
        if (parts[0].dataset.part === n) top++;
        else over.set(parts[0].dataset.part, (over.get(parts[0].dataset.part) ?? 0) + 1);
      }
    if (!hits) continue;
    const worst = [...over].sort((a, b) => b[1] - a[1])[0];
    out.push({ part: n, hits, share: top / hits, by: worst?.[0] ?? null });
  }
  style.remove();
  return out;
}
