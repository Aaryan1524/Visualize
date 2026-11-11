import type { TextRole } from "../core/types.ts";

/** Choose a type treatment without changing the author's text or model value. */
export function textRole(text: string, explicit: TextRole | undefined, fallback: TextRole): TextRole {
  if (explicit) return explicit;
  // Whole numeric values only: identifiers such as Q, A1 and pay_7f3a stay symbols.
  return /^[+−-]?(?:[$€£])?\d+(?:[.,]\d+)*(?:[eE][+−-]?\d+)?%?$/.test(text.trim()) ? "value" : fallback;
}
