# Changelog

One version covers the kit and the skill (`package.json` `version` and `SKILL.md` `metadata.version` move together). Each entry names the failure that caused it, so the reason for a rule is never lost.

## 0.3.0 (unreleased)

The look and the decisions.

- **Focus.** "Too much remains equally prominent throughout." Each editorial step now focuses what changed since the last one and lets everything else recede toward the stage. Emphasis is interpolated, so seeking stays exact. Checked by `focus`, with two planted faults.
- **The causal moment stays visible.** "The reply is lost." showed a fully dimmed scene: the loss happened mid-transition and left no trace at rest. The lost reply now lies on the wire for its step. If nothing focused is still drawn at rest, nothing recedes.
- **A decision table in `SKILL.md`.** Lint: "SKILL.md never states a default." Every choice a one-line prompt leaves open now has a default and a reason. Three are marked as the user's to make.
- **Scope tiers, a draft gate and a delivery report.** Agents jumped to polishing before the representation was right, and reported in their own shapes.
- **Reproducible builds and CI.** The step-5 gate was never checked. `pnpm check:reproducible` requires byte-identical rebuilds, and `.github/workflows/ci.yml` runs every gate.
- **A revisited step serialised differently from a fresh one.** An emptied `style` attribute was left behind by the emphasis variable. It is now removed, and reduced motion caught it.

## 0.2.0

Second reference, finished parts, outputs and packaging.

- **Network parts:** terminal, server, ledger, key store, plate, cable and message, each with named anchors. Retries was built from boxes that "said nothing about what each one was".
- **Turned cylinders, side-face panels, vents, seams and lamps,** for "large plain block faces" and "limited material depth".
- **Label rules:**
  - Unfit labels are hidden, after screen text spilled off a phone-sized terminal.
  - Optional labels drop, after slot numbers landed on a guide rail.
  - Leaders leave from the text's edge, after they crossed their own labels.
  - Chips keep one height, after a 6 px strip made the camera history-dependent.
- **Checks:**
  - A free label lying on a part, after "Idempotency key" sat across the terminal.
  - Stage size changing between steps.
  - A hidden value failing `text`, after gauges showed no numbers while verify passed.
  - Cable ends on parts.
  - Part tests found floating coins and an anchor in mid-air.
- **Outputs:** SVG export checked against the live stage, a React adapter, and scoped embedding with `destroy()`.
- **Packaging:** `SKILL.md`, `references/`, `evals/` and the `new-scene` scaffold. A clean npm install and a separate project were both tested.

## 0.1.0

The prototype: trace, keyed marks, a pure timeline, the isometric stage, the player, verify with planted faults, and the LRU, attention and retries examples. `research/PROTOTYPE_FINDINGS.md` records what it showed.
