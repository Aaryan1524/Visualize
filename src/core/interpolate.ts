import { bump, easeIn, easeInOut, easeOut, lerp, lerp3 } from "./ease.ts";
import { local } from "./timeline.ts";
import type { Mark, Phases, Resolved, Vec3 } from "./types.ts";

/** World units a dropping or falling solid travels. */
export const DROP = 48;
const SHAKE = 2.5;
const PULSE = 0.12;

function shift(at: Vec3, dz: number, dx = 0): Vec3 {
  return [at[0] + dx, at[1], at[2] + dz];
}

/** Move a mark bodily by a world offset. */
function offset(m: Mark, dx: number, dz: number): Mark {
  switch (m.kind) {
    case "box":
    case "cylinder":
    case "label":
      return { ...m, at: shift(m.at, dz, dx) };
    case "link":
      return { ...m, from: shift(m.from, dz, dx), to: shift(m.to, dz, dx) };
  }
}

/** Scale a solid about its centre (pulse, shrink, grow). */
function scaled(m: Mark, s: number, heightOnly = false): Mark {
  if (m.kind === "box") {
    const [w, d, h] = m.size;
    const sw = heightOnly ? w : w * s;
    const sd = heightOnly ? d : d * s;
    const sh = h * s;
    const at: Vec3 = heightOnly
      ? m.at
      : [m.at[0] + (w - sw) / 2, m.at[1] + (d - sd) / 2, m.at[2] + (h - sh) / 2];
    return { ...m, at, size: [sw, sd, sh] };
  }
  if (m.kind === "cylinder") {
    const h = m.height * s;
    return {
      ...m,
      radius: heightOnly ? m.radius : m.radius * s,
      height: h,
      at: heightOnly ? m.at : shift(m.at, (m.height - h) / 2),
    };
  }
  return m;
}

function between(a: Mark, b: Mark, t: number): Mark {
  const discrete = t >= 0.5 ? b : a;
  if (a.kind !== b.kind) return discrete;
  switch (b.kind) {
    case "box": {
      const p = a as typeof b;
      return { ...discrete, kind: "box", at: lerp3(p.at, b.at, t), size: lerp3(p.size, b.size, t) } as Mark;
    }
    case "cylinder": {
      const p = a as typeof b;
      return {
        ...discrete,
        kind: "cylinder",
        at: lerp3(p.at, b.at, t),
        radius: lerp(p.radius, b.radius, t),
        height: lerp(p.height, b.height, t),
      } as Mark;
    }
    case "label": {
      const p = a as typeof b;
      return { ...discrete, kind: "label", at: lerp3(p.at, b.at, t) } as Mark;
    }
    case "link": {
      const p = a as typeof b;
      return {
        ...discrete,
        kind: "link",
        from: lerp3(p.from, b.from, t),
        to: lerp3(p.to, b.to, t),
        width: lerp(p.width ?? 1, b.width ?? 1, t),
      } as Mark;
    }
  }
}

function withEffect(m: Mark, u: number): Mark {
  if (!m.effect || u <= 0 || u >= 1) return m;
  if (m.effect === "shake") return offset(m, Math.sin(u * Math.PI * 6) * SHAKE * bump(u), 0);
  return scaled(m, 1 + PULSE * bump(u));
}

function entering(m: Mark, u: number): Resolved {
  const e = easeOut(u);
  switch (m.enter ?? "fade") {
    case "none":
      return { ...m, opacity: u > 0 ? 1 : 0 };
    case "drop":
      return { ...offset(m, 0, DROP * (1 - e)), opacity: Math.min(1, u * 2.5) };
    case "grow":
      return m.kind === "box" || m.kind === "cylinder"
        ? { ...scaled(m, Math.max(e, 0.001), true), opacity: u > 0 ? 1 : 0 }
        : { ...m, opacity: e };
    case "fade":
      return { ...m, opacity: e };
  }
}

function exiting(m: Mark, u: number): Resolved {
  switch (m.exit ?? "fade") {
    case "none":
      return { ...m, opacity: u < 1 ? 1 : 0 };
    case "fall":
      return { ...offset(m, 0, -DROP * easeIn(u)), opacity: 1 - easeIn(u) };
    case "lift":
      return { ...offset(m, 0, DROP * easeOut(u)), opacity: 1 - u };
    case "shrink":
      return { ...scaled(m, Math.max(1 - easeInOut(u), 0.001)), opacity: 1 - u };
    case "fade":
      return { ...m, opacity: 1 - easeInOut(u) };
  }
}

function travelling(m: Mark, u: number): Resolved | null {
  if (u <= 0 || u >= 1) return null;
  const fade = Math.min(1, u / 0.12, (1 - u) / 0.12);
  if (!m.travel) return { ...m, opacity: fade };
  const at = lerp3(m.travel.from, m.travel.to, easeInOut(u));
  if (m.kind === "link") return { ...m, opacity: fade };
  return { ...(m as Exclude<Mark, { kind: "link" }>), at, opacity: fade } as Resolved;
}

export function isStatic(m: Mark): boolean {
  return !m.transient && !m.leaving;
}

/** The hop belongs to the destination, so it applies over the whole move. */
function hop(m: Mark, moveU: number, arc: number | undefined): Mark {
  return arc ? offset(m, 0, arc * bump(moveU)) : m;
}

/**
 * Resolve the marks drawn at `progress` through the transition from
 * `prev` (the previous state's marks) to `next` (this state's marks).
 * Pure and order-deterministic: next's order, then exits in prev's order,
 * then transients.
 */
export function resolveFrame(
  prev: readonly Mark[],
  next: readonly Mark[],
  progress: number,
  phases: Phases,
): Resolved[] {
  const before = prev.filter(isStatic);
  const after = next.filter(isStatic);
  if (progress >= 1) return after.map((m) => ({ ...m, opacity: 1 }));

  const exitU = local(progress, phases.exit);
  const moveU = local(progress, phases.move);
  const enterU = local(progress, phases.enter);
  const moveE = easeInOut(moveU);

  const byKey = new Map(before.map((m) => [m.key, m]));
  const nextKeys = new Set(after.map((m) => m.key));
  const out: Resolved[] = [];

  const leaving = new Map(next.filter((m) => m.leaving && !m.transient).map((m) => [m.key, m]));

  for (const m of after) {
    const p = byKey.get(m.key);
    if (p) out.push({ ...withEffect(hop(between(p, m, moveE), moveU, m.arc), moveU), opacity: 1 });
    else {
      const r = entering(m, enterU);
      if (r.opacity > 0) out.push(r);
    }
  }
  for (const m of before) {
    if (nextKeys.has(m.key)) continue;
    const goal = leaving.get(m.key);
    if (goal) {
      // Follow the move to where the next state says it goes, fading over the last part.
      const fade = 1 - local(moveU, [0.55, 1]);
      if (moveU < 1 && fade > 0) out.push({ ...hop(between(m, goal, moveE), moveU, goal.arc), opacity: fade });
      continue;
    }
    const r = exiting(m, exitU);
    if (r.opacity > 0) out.push(r);
  }
  for (const m of next) {
    if (!m.transient) continue;
    const r = travelling(m, moveU);
    if (r) out.push(r);
  }
  return out;
}
