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
