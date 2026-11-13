// Kit components for the editorial strip under the stage. Scenes compose
// these instead of writing their own markup and CSS.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Outcome of an item in a strip; colours come from the shared tones. */
export type StripStatus = "good" | "accent" | "bad" | "next" | "waiting" | "neutral";

export interface StripItem {
  label: string;
  /** Short word under the label, e.g. "hit", "lost". Hidden for waiting items. */
  note?: string;
  status: StripStatus;
  /** Entity id(s) for linked highlighting. */
  link?: string;
  /** data-key, for checks. */
  key?: string;
}

/** A row of chips: requests, events, attempts. */
export function strip(items: readonly StripItem[]): string {
  const chips = items
    .map((it) => {
      const attrs = [`data-status="${it.status}"`, it.link ? `data-link="${esc(it.link)}"` : "", it.key ? `data-key="${esc(it.key)}"` : ""].filter(Boolean).join(" ");
      // The note line is always present, so chips keep one height at every step.
      return `<li ${attrs}><b>${esc(it.label)}</b><span>${it.note ? esc(it.note) : "&nbsp;"}</span></li>`;
    })
    .join("");
  return `<ol class="vz-strip" style="--vz-strip-count:${items.length}">${chips}</ol>`;
}

export interface Total {
  value: string;
  label: string;
  /** data-key on the value, for checks. */
  key?: string;
  status?: "good" | "bad" | "neutral";
}

/** Large figures with a short unit, e.g. "2 charges". */
export function totals(items: readonly Total[]): string {
  return `<div class="vz-totals">${items
    .map((t) => `<span data-status="${t.status ?? "neutral"}"><b${t.key ? ` data-key="${esc(t.key)}"` : ""}>${esc(t.value)}</b> ${esc(t.label)}</span>`)
    .join("")}</div>`;
}

// ---- Sequence diagram ---------------------------------------------------------
// Protocols and retries are drawn by their field as lanes with time running
// down. The TCP eval drew two machines instead and lost the time axis, which was
// the subject. This flat panel sits beside the stage (`place: "side"`) and links
// to it: each message carries the stage entity's id.

export interface SequenceLane {
  id: string;
  label: string;
}

export interface SequenceMessage {
  /** Stable id; also the data-key, for checks. */
  id: string;
  from: string;
  to: string;
  /** Send time, in the scenario's unit. */
  at: number;
  /** Arrival time; omit with `lost` for a message that never arrives. */
  arrive?: number;
  label: string;
  status?: "good" | "bad" | "accent" | "neutral";
  lost?: boolean;
  /** Entity id(s) for linked highlighting with the stage. */
  link?: string;
}

export interface SequenceMark {
  /** A moment on one lane: a timer firing, a deadline that would have passed. */
  lane: string;
  at: number;
  label: string;
  status?: "good" | "bad" | "accent" | "neutral";
  /** Drawn faint: something that would have happened. */
  ghost?: boolean;
}

export interface SequenceOptions {
  lanes: readonly SequenceLane[];
  messages: readonly SequenceMessage[];
  marks?: readonly SequenceMark[];
  /** Time shown so far; later messages are not drawn yet. The panel keeps one height at every step. */
  now: number;
  /** Last time on the axis. */
  until: number;
  unit?: string;
}

const fx = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * Lanes left to right, time down. Messages up to `now` are drawn as sloped
 * arrows from send to arrival; the ones sent or arriving at `now` are lit;
 * lost ones stop halfway with a cross. The height depends only on `until`, so
 * the panel never changes size between steps.
 */
export function sequence({ lanes, messages, marks = [], now, until, unit = "ms" }: SequenceOptions): string {
  if (lanes.length < 2 || lanes.length > 4) throw new RangeError("A sequence diagram needs 2–4 lanes");
  if (!(until > 0) || !(now >= 0)) throw new RangeError("A sequence diagram needs a positive time axis");
  const W = 300, top = 30, H = 330, left = 40, right = W - 16;
  const x = new Map(lanes.map((l, i) => [l.id, left + ((right - left) * i) / (lanes.length - 1)]));
  for (const m of messages) if (!x.has(m.from) || !x.has(m.to)) throw new RangeError(`Message ${m.id} names an unknown lane`);
  const y = (t: number) => top + (Math.min(t, until) / until) * (H - top - 12);
  const parts: string[] = [];
  for (const l of lanes) {
    const lx = x.get(l.id)!;
    parts.push(`<text class="vz-seq-lane" x="${fx(lx)}" y="14" text-anchor="middle">${esc(l.label)}</text>`);
    parts.push(`<line class="vz-seq-life" x1="${fx(lx)}" y1="${top - 8}" x2="${fx(lx)}" y2="${H - 6}"/>`);
  }
  // A few time ticks on the left edge.
  for (let k = 0; k <= 4; k++) {
    const t = (until * k) / 4;
    parts.push(`<text class="vz-seq-tick" x="4" y="${fx(y(t) + 3.5)}">${esc(String(Math.round(t)))}${k === 0 ? esc(` ${unit}`) : ""}</text>`);
  }
  parts.push(`<line class="vz-seq-now" x1="${left - 6}" y1="${fx(y(now))}" x2="${right + 6}" y2="${fx(y(now))}"/>`);
  for (const m of messages) {
    if (m.at > now) continue;
    const x1 = x.get(m.from)!, x2 = x.get(m.to)!, y1 = y(m.at);
    const end = m.lost ? m.at + ((m.arrive ?? m.at + until / 8) - m.at) / 2 : m.arrive ?? m.at;
    const shown = Math.min(end, now);
    const u = end === m.at ? 1 : (shown - m.at) / (end - m.at);
    // A lost message stops halfway across.
    const ex = x1 + (x2 - x1) * u * (m.lost ? 0.5 : 1), ey = y(shown);
    const fresh = m.at === now || (m.arrive !== undefined && m.arrive === now);
    const attrs = `data-key="${esc(m.id)}" data-status="${m.status ?? "neutral"}"${m.link ? ` data-link="${esc(m.link)}"` : ""}${fresh ? " data-lit" : ""}`;
    const arrived = !m.lost && shown >= (m.arrive ?? m.at);
    parts.push(`<g class="vz-seq-msg" ${attrs}><line x1="${fx(x1)}" y1="${fx(y1)}" x2="${fx(ex)}" y2="${fx(ey)}"${m.lost ? ' stroke-dasharray="3 3"' : ""}/>`
      + (arrived ? `<path d="M${fx(ex)} ${fx(ey)} l${x2 > x1 ? -6 : 6} -3 v6 z"/>` : "")
      + (m.lost && shown >= end ? `<path class="vz-seq-x" d="M${fx(ex - 4)} ${fx(ey - 4)} l8 8 m0 -8 l-8 8"/>` : "")
      + `<text x="${fx((x1 + ex) / 2)}" y="${fx((y1 + ey) / 2 - 4)}" text-anchor="middle">${esc(m.label)}</text></g>`);
  }
  for (const k of marks) {
    if (!x.has(k.lane)) throw new RangeError(`Mark ${k.label} names an unknown lane`);
    if (k.at > now && !k.ghost) continue;
    const kx = x.get(k.lane)!, ky = y(k.at);
    const anchor = kx < W / 2 ? "start" : "end", tx = kx + (anchor === "start" ? 8 : -8);
    parts.push(`<g class="vz-seq-mark" data-status="${k.status ?? "neutral"}"${k.ghost ? " data-ghost" : ""}><circle cx="${fx(kx)}" cy="${fx(ky)}" r="3"/><text x="${fx(tx)}" y="${fx(ky + 4)}" text-anchor="${anchor}">${esc(k.label)}</text></g>`);
  }
  return `<svg class="vz-seq" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sequence of messages, time running down">${parts.join("")}</svg>`;
}
