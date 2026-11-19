// The figure's camera: zoom and pan only, as one transform on the figure's group, so nothing is redrawn.
//
// A shot is a list of part names, the subject, with optional parts around it to keep in view. The
// machine's boundsOf(names) gives their bounds in the figure's own units; frame() turns bounds into the
// zoom and offset that centre the subject in the stage's clear area, never
// past the zoom cap and never below 1 (shot 0, the whole figure, is the identity). stepTrack() lays out,
// for each step, the move into the step's shot, then the voice-led shots: when the narration names a part the
// current shot does not frame well, the camera eases to it before the words reach it, holds at least
// HOLD seconds, and comes back. Moves take long enough that no point on the stage moves faster than
// SPEED stage short-sides a second.
//
// The kit runs in the page: page.mjs serializes cameraKit with toString(), so it must not reference
// anything outside its own body. Tests import it directly.
export function cameraKit() {
  // CAP: the closest the camera goes. At 3x the derailleur lost its context (a field of teeth around a
  // 4 mm part); at 2x the parts a part attaches to stay recognisable.
  const CAP = 2, PAD = 0.12, MIN_FRAC = 0.06, HOLD = 0.8, MIN_DUR = 0.6, SPEED = 2.0;
  const ID = { s: 1, x: 0, y: 0 };
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u)); // smoothstep: peak speed 1.5x the mean
  const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
  const apply = (m, p) => [m.s * p[0] + m.x, m.s * p[1] + m.y];
  const onScreen = (m, b) => ({ x0: m.s * b.x0 + m.x, y0: m.s * b.y0 + m.y, x1: m.s * b.x1 + m.x, y1: m.s * b.y1 + m.y });
  const short = (c) => Math.min(c.x1 - c.x0, c.y1 - c.y0);
  const same = (a, b) => Math.abs(a.s - b.s) < 1e-9 && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

  /**
   * The camera that sets bounds `b` (the subject) in the clear area `c`: centred, zoomed up to the cap and
   * never below 1. `keep` (bounds that hold the subject wherever it moves, and the parts around it the
   * reader needs to recognise it) stays in the clear area too: it limits the zoom, and the subject moves
   * off centre only as far as keeping it in view needs.
   */
  function frame(b, c, { cap = CAP, pad = PAD, keep = null, min = 1 } = {}) {
    if (!b) return { ...ID };
    const k = union(b, keep);
    const kw = Math.max(1e-6, k.x1 - k.x0), kh = Math.max(1e-6, k.y1 - k.y0), padU = pad * Math.max(b.x1 - b.x0, b.y1 - b.y0, 1e-6);
    let s = Math.min(cap, (c.x1 - c.x0) / (kw + 2 * padU), (c.y1 - c.y0) / (kh + 2 * padU));
    // no zoom is needed: keep the figure where it was laid out, if it already sits in the clear area
    if (s <= 1) {
      const inside = k.x0 >= c.x0 && k.x1 <= c.x1 && k.y0 >= c.y0 && k.y1 <= c.y1;
      if (inside) return { ...ID };
      s = Math.min(1, Math.max(min, s)); // 1 for a step's shot; below it only where a caller allows (a card's view)
    }
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    let x = cx - (s * (b.x0 + b.x1)) / 2, y = cy - (s * (b.y0 + b.y1)) / 2;
    // slide (no further than needed) so what must stay in view does
    const slide = (lo, hi, c0, c1) => (hi - lo > c1 - c0 ? (c0 + c1) / 2 - (lo + hi) / 2 : lo < c0 ? c0 - lo : hi > c1 ? c1 - hi : 0);
    x += slide(s * k.x0 + x, s * k.x1 + x, c.x0, c.x1);
    y += slide(s * k.y0 + y, s * k.y1 + y, c.y0, c.y1);
    return { s, x, y };
  }

  /** Is `b`, seen through camera `m`, inside the clear area and large enough to read? */
  function framed(b, m, c, tol = 1) {
    if (!b) return false;
    const r = onScreen(m, b);
    const inside = r.x0 >= c.x0 - tol && r.x1 <= c.x1 + tol && r.y0 >= c.y0 - tol && r.y1 <= c.y1 + tol;
    return inside && Math.max(r.x1 - r.x0, r.y1 - r.y0) >= MIN_FRAC * short(c) - tol;
  }

  // Between two cameras: the window of the figure each shows moves its centre in a straight line and
  // its size geometrically, so a zoom reads as one move, not a slide and a zoom.
  const view = (m, c) => ({ cx: ((c.x0 + c.x1) / 2 - m.x) / m.s, cy: ((c.y0 + c.y1) / 2 - m.y) / m.s, z: Math.log(m.s) });
  function lerp(a, b, u, c) {
    if (u <= 0) return { ...a };
    if (u >= 1) return { ...b };
    const va = view(a, c), vb = view(b, c);
    const s = Math.exp(va.z + (vb.z - va.z) * u), cx = va.cx + (vb.cx - va.cx) * u, cy = va.cy + (vb.cy - va.cy) * u;
    return { s, x: (c.x0 + c.x1) / 2 - s * cx, y: (c.y0 + c.y1) / 2 - s * cy };
  }
  /** How far the picture moves between two cameras: the largest move of any point on the stage, in stage short-sides. */
  function dist(a, b, c) {
    let d = 0;
    for (const m of [a, b])
      for (const [sx, sy] of [[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1]]) {
        const q = [(sx - m.x) / m.s, (sy - m.y) / m.s]; // the figure point under that corner
        const pa = apply(a, q), pb = apply(b, q);
        d = Math.max(d, Math.hypot(pa[0] - pb[0], pa[1] - pb[1]));
      }
    return d / short(c);
  }
  /** Long enough that the eased move's peak speed stays under SPEED. */
  const duration = (a, b, c) => (same(a, b) ? 0 : Math.max(MIN_DUR, (1.5 * dist(a, b, c)) / SPEED * 1.05));

  /**
   * The camera's track through one step, in seconds of the story.
   * step: { start, end, shot (a camera), from (the camera the story arrives with, at the end of the step
   *         before), links: [{ a, b, ids, bounds }] (when each named part is spoken, and its bounds) }
   * Returns { shot, enter, moves: [{ t0, d, from, to, ids }] }: the first move eases from `from` into the
   * step's shot at the step's start; each move eases from `from` to `to` over d seconds from t0. So the
   * camera is a function of the story time alone, however that time was reached.
   */
  function stepTrack(step, c) {
    const shot = step.shot, from = step.from ?? shot;
    const enter = same(from, shot) ? 0 : Math.min(duration(from, shot, c), Math.max(0, step.end - step.start));
    const first = enter ? [{ t0: step.start, d: enter, from, to: shot, ids: [], enter: true }] : [];
    // groups of links that share one shot; a link already framed by the step's shot needs none
    let groups = step.links.filter((l) => l.bounds).map((l) => ({ a: l.a, b: l.b, ids: [...l.ids], bounds: l.bounds }));
    const plan = () => {
      const moves = [...first];
      let cur = shot, arrive = step.start + enter, onLink = false, linkEnd = 0, ok = true, bad = -1;
      groups.forEach((g, i) => {
        if (framed(g.bounds, cur, c)) {
          if (onLink) linkEnd = Math.max(linkEnd, g.b);
          return;
        }
        const to = frame(g.bounds, c);
        // come back to the step's shot in between, if there is room for that shot's hold
        if (onLink) {
          const r0 = Math.max(linkEnd, arrive + HOLD), dr = duration(cur, shot, c), d2 = duration(shot, to, c);
          if (Math.max(g.a - d2, r0 + dr + HOLD) + d2 <= g.a + 1e-9) {
            moves.push({ t0: r0, d: dr, from: cur, to: shot, ids: [] });
            cur = shot;
            arrive = r0 + dr;
          }
        }
        const d = duration(cur, to, c), t0 = Math.max(g.a - d, arrive + HOLD);
        if (t0 + d > g.a + 1e-9 && ok) ((ok = false), (bad = i));
        moves.push({ t0, d, from: cur, to, ids: g.ids });
        cur = to;
        arrive = t0 + d;
        onLink = true;
        linkEnd = Math.max(g.b, arrive + HOLD);
      });
      // back to the step's shot at the end, if that shot can then be held before the step ends
      if (onLink) {
        const r0 = Math.max(linkEnd, arrive + HOLD), dr = duration(cur, shot, c);
        if (r0 + dr + HOLD <= step.end) moves.push({ t0: r0, d: dr, from: cur, to: shot, ids: [] });
      }
      return { moves, ok, bad };
    };
    let p = plan();
    // a shot that cannot arrive before its words: share one shot with the link before it
    while (!p.ok && p.bad > 0) {
      const i = p.bad, prev = groups[i - 1], g = groups[i];
      groups.splice(i - 1, 2, { a: prev.a, b: Math.max(prev.b, g.b), ids: [...new Set([...prev.ids, ...g.ids])], bounds: union(prev.bounds, g.bounds) });
      p = plan();
    }
    return { shot, enter, moves: p.moves, clear: c, start: step.start, end: step.end };
  }

  /**
   * The camera at story time T within a step's track (jump: no easing, for reduced motion; cut: the
   * story was not arriving from the step before, so there is no move into the step's shot).
   */
  function at(track, T, jump = false, cut = false) {
    let m = track.shot;
    for (const mv of track.moves) {
      if (cut && mv.enter) continue;
      if (T < mv.t0) {
        if (mv.enter) m = mv.from; // the move into the step's shot has not begun: the camera it arrived with
        break;
      }
      m = jump || T >= mv.t0 + mv.d ? mv.to : lerp(mv.from, mv.to, ease((T - mv.t0) / mv.d), track.clear);
    }
    return m;
  }

  /** What the camera is showing at T: the names of the voice-led shot it is on or moving to, or null for the step's own shot. */
  function subjectAt(track, T, cut = false) {
    let ids = null;
    for (const mv of track.moves) {
      if (cut && mv.enter) continue;
      if (T < mv.t0) break;
      ids = mv.ids.length ? mv.ids : null;
    }
    return ids;
  }

  return { subjectAt, CAP, PAD, MIN_FRAC, HOLD, MIN_DUR, SPEED, ID, ease, union, apply, onScreen, frame, framed, lerp, dist, duration, stepTrack, at, same };
}
