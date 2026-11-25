import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeDisplayText, normalizeSpokenText } from "./studio-voice.mjs";

describe("scripts/studio-voice.mjs Kokoro spoken-text normalizer", () => {
  it("normalizes Big-O complexity notation cleanly for TTS", () => {
    assert.equal(
      normalizeSpokenText("An LRU cache answers every lookup in O(1) time."),
      "An LRU cache answers every lookup in big O of 1 time.",
    );
    assert.equal(
      normalizeSpokenText("Linear search scans in O(n) steps."),
      "Linear search scans in big O of n steps.",
    );
    assert.equal(
      normalizeSpokenText("Balanced trees search in O(log n) and merge sort runs in O(n log n)."),
      "Balanced trees search in big O of log n and merge sort runs in big O of n log n.",
    );
    assert.equal(
      normalizeSpokenText("Naive quadratic loops take O(n^2) time."),
      "Naive quadratic loops take big O of n squared time.",
    );
  });

  it("normalizes ratios while leaving timestamps untouched", () => {
    assert.equal(
      normalizeSpokenText("High-bypass turbofans reach an 8:1 bypass ratio versus 1:1 in early jets."),
      "High-bypass turbofans reach an 8 to 1 bypass ratio versus 1 to 1 in early jets.",
    );
    assert.equal(
      normalizeSpokenText("Aspect ratio is 16:9 at 12:30:45."),
      "Aspect ratio is 16 to 9 at 12:30:45.",
    );
  });

  it("normalizes multipliers (× and x) without mangling hex literals or CSS units", () => {
    assert.equal(
      normalizeSpokenText("Pressure rises 26× across the compressor, or 30x at takeoff."),
      "Pressure rises 26 times across the compressor, or 30 times at takeoff.",
    );
    assert.equal(
      normalizeSpokenText("A 2.5× speedup beats 16px margins and 0x1F flags."),
      "A 2.5 times speedup beats 16px margins and 0x1F flags.",
    );
  });

  it("normalizes physics units and comparison/arrow symbols", () => {
    assert.equal(
      normalizeSpokenText("Throat ΔP reaches 14 kPa at 45 m/s, atomizing droplets to 33 µm through a 1.2 mm nozzle."),
      "Throat pressure drop reaches 14 kilopascals at 45 meters per second, atomizing droplets to 33 micrometers through a 1.2 millimeters nozzle.",
    );
    assert.equal(
      normalizeSpokenText("Greek mu 25μm also expands cleanly."),
      "Greek mu 25 micrometers also expands cleanly.",
    );
    assert.equal(
      normalizeSpokenText("Set throttle ≥85% and capacity ≤3 to watch A → B and B ↔ C."),
      "Set throttle at least 85% and capacity at most 3 to watch A to B and B and C.",
    );
  });

  it("preserves explicit phonetic markers in spoken text while keeping crisp symbols in display text", () => {
    const raw = "Follow [A|ay] → {B} in O(1) time with ΔP ≥ 12 kPa and 8:1 ratio (26×).";
    assert.equal(
      normalizeSpokenText(raw),
      "Follow ay to bee in big O of 1 time with pressure drop at least 12 kilopascals and 8 to 1 ratio (26 times).",
    );
    assert.equal(
      normalizeDisplayText(raw),
      "Follow A → B in O(1) time with ΔP ≥ 12 kPa and 8:1 ratio (26×).",
    );
  });
});
