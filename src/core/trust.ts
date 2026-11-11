import type { Trust } from "./types.ts";

export const TRUST_LEVELS: readonly Trust[] = ["sourced", "computed", "model", "analogy", "unverified"];

/** Short label shown next to a caption. */
export const TRUST_LABEL: Record<Trust, string> = {
  sourced: "From the source",
  computed: "Computed live",
  model: "Simplified model",
  analogy: "Analogy",
  unverified: "Unverified",
};

/** One-sentence meaning, used for the badge's accessible description. */
export const TRUST_MEANING: Record<Trust, string> = {
  sourced: "Taken from an identifiable location in the source.",
  computed: "Calculated by the model running on this page.",
  model: "A simplified model: the behaviour is real, the scale and details are not.",
  analogy: "An analogy: only the stated relationships carry over.",
  unverified: "An interpretation that has not been checked.",
};
