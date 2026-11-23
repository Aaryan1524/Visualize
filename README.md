<h1 align="center">Visualize</h1>

<p align="center">
  <b>Turn a one-line prompt into a narrated, interactive 3D cutaway or explainer you can actually trust.</b><br>
  To-scale mechanical cutaways for real machines. Matching ink-and-metal 3D figures for algorithms, protocols, and systems.<br>
  Every number is proved by a running model, checked in headless Chrome, and signed off by an independent reviewer.
</p>

<p align="center">
  <a href="#install"><img src="https://img.shields.io/badge/Claude_Code-skill-1b1b19?style=flat-square&logo=claude&logoColor=white" alt="Claude Code skill"></a>
  <a href="#install"><img src="https://img.shields.io/badge/Codex-skill-1b1b19?style=flat-square" alt="Codex skill"></a>
  <a href="#install"><img src="https://img.shields.io/badge/Antigravity-skill-1b1b19?style=flat-square" alt="Antigravity skill"></a>
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/Agent_Skills-open_standard-1b1b19?style=flat-square" alt="Agent Skills open standard"></a>
  <a href="#requirements"><img src="https://img.shields.io/badge/node-%E2%89%A5%2024-1b1b19?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node 24 or later"></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.1.0-c85a17?style=flat-square" alt="Version 1.1.0"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-1b1b19?style=flat-square" alt="MIT license"></a>
  <a href="https://github.com/Aaryan1524/Visualize/actions/workflows/ci.yml"><img src="https://github.com/Aaryan1524/Visualize/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <a href="#30-second-quick-start">Quick start</a> ·
  <a href="#built-from-a-one-line-prompt">Showcase</a> ·
  <a href="#why-it-doesnt-hallucinate">How it works</a> ·
  <a href="#what-the-reader-gets">Features</a> ·
  <a href="#install">Install</a> ·
  <a href="#prompts-to-try">Prompts</a> ·
  <a href="#requirements">Requirements</a>
</p>

<p align="center">
  <a href="https://github.com/Aaryan1524/Visualize/releases/download/v1.0.0/derailleur-tour.mp4"><img src=".github/assets/derailleur.gif" width="780" alt="Rear Derailleur interactive cutaway playing: a shaded rear derailleur under an eleven-cog cassette shifts the chain from cog to cog while the cage swings to take up slack, with a magnified detail lens and live readouts below."></a>
</p>

<p align="center"><sub><b>Rear Derailleur</b> — generated from <code>/visualize explain how a bicycle rear derailleur works</code>.<br>A real spring-and-chain physics model drives the geometry; a local voice narrates each step; a lab lets you back out the limit screw.<br><a href="https://github.com/Aaryan1524/Visualize/releases/download/v1.0.0/derailleur-tour.mp4"><b>▶ Watch the full narrated tour (MP4, with sound)</b></a></sub></p>

---

## 30-second quick start

Works out of the box in **Claude Code**, **Codex**, and **Antigravity** (and any [Agent Skills](https://agentskills.io)-compatible agent).

**1. Clone into your agent's skills folder & install once:**

```sh
# Claude Code
git clone https://github.com/Aaryan1524/Visualize.git ~/.claude/skills/visualize && cd ~/.claude/skills/visualize && npm install

# Codex
git clone https://github.com/Aaryan1524/Visualize.git ~/.agents/skills/visualize && cd ~/.agents/skills/visualize && npm install

# Antigravity (CLI)
git clone https://github.com/Aaryan1524/Visualize.git ~/.gemini/config/skills/visualize && cd ~/.gemini/config/skills/visualize && npm install
```

*(Using the Antigravity desktop app or want a per-project install? See [Install](#install).)*

**2. Open a new session and ask for anything:**

```text
/visualize explain how a car's open differential works
```

*(In Codex, type `$visualize ...`. Want a multi-chapter deep dive? Add `--deep`.)*

You get **one standalone HTML file** — offline, light & dark themes, interactive 3D camera, voice narration, prediction checkpoints, and an interactive lab.

---

## Built from a one-line prompt

Every image below is an unedited screenshot of a standalone HTML page built from [`examples/`](examples), verified in headless Chrome, and rendered in the v1.1.0 studio rig.

<table>
  <tr>
    <td width="50%"><img src=".github/assets/automatic-watch.jpg" alt="Automatic Watch exploded 6-layer mechanical calibre in studio light theme with chapter tabs and live escapement readouts."></td>
    <td width="50%"><img src=".github/assets/multi-agent.jpg" alt="Multi-Agent Orchestration 3-tier concept plate with live Gantt Trace, Context Occupancy lens, and interactive Predict card."></td>
  </tr>
  <tr>
    <td><sub><b>Automatic Mechanical Watch (<code>--deep</code>, 14 steps · 4 chapters)</b><br><code>/visualize --deep explain how an automatic mechanical watch keeps time</code><br>6-layer exploded calibre on dashed centre lines, live balance-wheel beat, Swiss lever escapement, and mainspring torque curve.</sub></td>
    <td><sub><b>Multi-Agent Orchestration (<code>--deep</code>, 14 steps · 4 chapters)</b><br><code>/visualize --deep explain multi-agent orchestration</code><br>3-tier Concept Plate with per-step camera moves, live Gantt Trace + Context Occupancy lens, and interactive Predict checkpoints.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/differential.jpg" alt="Open Differential cutaway in light theme showing bevel spider gears, brass sun gears, crown ring gear, and 5-spoke wheels."></td>
    <td width="50%"><img src=".github/assets/differential-dark.jpg" alt="Open Differential in dark theme on the Glare Ice trap step, showing one wheel spinning freely on translucent blue ice while the other stays parked."></td>
  </tr>
  <tr>
    <td><sub><b>Open Differential — Light Theme</b><br><code>/visualize explain how an open differential works</code><br>Cutaway steel carrier, orbiting bevel spiders, brass sun gears, and <code>ω_L + ω_R = 2·ω_ring</code> enforced by the physics model.</sub></td>
    <td><sub><b>Open Differential — Dark Theme (Glare-Ice Trap)</b><br>Every page ships with a one-click <b>Dark</b> toggle (or <code>#theme=dark</code>). Here, low traction on the left wheel stalls the right wheel at 0 rpm.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/bloom.jpg" alt="Bloom Filter 16-bit array on studio rig with routed hash arrows, word card, and live modulo arithmetic strip."></td>
    <td width="50%"><img src=".github/assets/escalator.jpg" alt="Escalator to-scale technical cutaway showing dual offset wheel tracks keeping every tread level with Detail A magnification."></td>
  </tr>
  <tr>
    <td><sub><b>Bloom Filter</b><br><code>/visualize explain how a Bloom filter works</code><br>16-bit array on the Concept Plate rig, routed hash arrows, live <code>h₁/h₂/h₃ mod 16</code> working strip, and false-positive proof.</sub></td>
    <td><sub><b>Escalator</b><br><code>/visualize explain how an escalator keeps its steps level</code><br>Two wheels on two offset tracks, drawn to scale from a kinematic model, with a 2.6× Detail A lens and a 30°/35° lab.</sub></td>
  </tr>
</table>

<details>
<summary><b>More examples</b> — Pin Tumbler Lock, LRU Cache (Drawing &amp; Clay), Attention, Idempotent Retries</summary>

<br>

<table>
  <tr>
    <td width="50%"><img src=".github/assets/lock.jpg" alt="Pin Tumbler Lock cutaway on its Picking step with tension wrench, pick, five pin stacks, shear line, and Section A-A detail."></td>
    <td width="50%"><img src=".github/assets/lru-cache-predict.jpg" alt="LRU Cache in drawing look paused on a prediction card before eviction."></td>
  </tr>
  <tr>
    <td><sub><b>Pin Tumbler Lock</b> — why only 1 of ~92,000 keys turns, how picking exploits binding order, and a key-cutting lab.</sub></td>
    <td><sub><b>LRU Cache</b> — paused on a prediction before the first eviction; hit/miss strip driven directly by the model.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src=".github/assets/attention.jpg" alt="Scaled dot-product attention isometric board with Q/K/V bars, softmax weights, and linked equation panel."></td>
    <td width="50%"><img src=".github/assets/retries.jpg" alt="Side-by-side payment worlds with and without an idempotency key and millisecond timeline strip."></td>
  </tr>
  <tr>
    <td><sub><b>Scaled Dot-Product Attention</b> — hovering a softmax weight lights the query and key vectors that produced it.</sub></td>
    <td><sub><b>Idempotent Retries</b> — two synced worlds side by side showing why a lost reply double-charges without a key.</sub></td>
  </tr>
</table>

</details>

---

## Why it doesn't hallucinate

Most AI-generated diagrams look pretty for two seconds and break the moment you read the numbers — mismatched gear ratios, floating labels, impossible physics, or prose that contradicts the drawing.

Visualize runs a strict **7-stage engineering pipeline** designed to deliver the same studio-grade result across **Claude, Codex, and Gemini**:

```text
  Prompt ──▶ 1. PLAN      Pick Machine vs. Concept look, story arc, key moments, and chapters
         ──▶ 2. SCAFFOLD  `new-figure.mjs` stamps out the studio shell (rig, palette, dark mode, tests)
         ──▶ 3. MODEL     Write a real executable model + independent reference test (physics or state trace)
         ──▶ 4. RIG       Draw every frame from model outputs using `mech.ts` / `concept.ts` 3D primitives
         ──▶ 5. VOICE     Record offline narration that lights up each part in sync as it names it
         ──▶ 6. CHECKS    Headless Chrome audits: layout, label overlap, contrast, FPS, arithmetic claims
         ──▶ 7. REVIEW    Mandatory fresh-context reviewer inspects every step PNG, concept truth, and math
```

- **Zero hand-waved math.** [`check-arithmetic.mjs`](scripts/check-arithmetic.mjs) parses equations and readouts in the built HTML and flags any mismatch against the model.
- **Zero visual regressions.** [`check-drawing.mjs`](scripts/check-drawing.mjs) opens the page in headless Chrome across light & dark themes, checks label collisions, bounding-box clipping, contrast, and frame pacing.
- **Zero self-grading.** Before any visualization is marked done, [`review-brief.mjs`](scripts/review-brief.mjs) packages the rendered step screenshots and audit output for a **fresh-context reviewer** (independent subagent or dedicated pass) that can only pass when both the studio craft *and* the underlying domain truth hold up.

---

## What the reader gets

| Capability | What it actually does |
|---|---|
| **Model-verified visuals** | Every position, angle, count, highlight, and caption is computed by a tested model and verified against the live DOM in headless Chrome. |
| **Machine Cutaways & Concept Plates** | Physical devices render as to-scale 3D technical cutaways (`src/rig/mech.ts` + `parts.ts`). Algorithms, protocols, and architectures render on the matching 3D Concept Plate (`src/rig/concept.ts`) with per-step camera framing. |
| **Synced voice narration** | Recorded locally via an open-source TTS model (offline after one ~90 MB download). Explains the big idea first, then walks step-by-step and highlights each part the moment it's spoken. |
| **Active learning built in** | **Predict** cards pause before the twist; **Labs / What if** let the reader change real parameters (cut a key, drop traction to ice, flood a queue); **Now you try** quizzes are generated and graded by the model. |
| **One standalone HTML file** | Zero external runtime dependencies. Share via Slack, embed in docs, or open offline. Includes Light/Dark theme toggle, keyboard navigation (`←` `→` `Space`), `#step=` deep links, reduced motion, and full text transcripts. Also exports static **SVG** or **React** components. |

---

## Install

Visualize follows the open [Agent Skills](https://agentskills.io) standard — this repository *is* the skill folder. Clone it into your agent's skills directory under the name `visualize`, then run `npm install` once.

| Agent | Install command | Invoke with |
|---|---|---|
| **Claude Code** | `git clone https://github.com/Aaryan1524/Visualize.git ~/.claude/skills/visualize` | `/visualize …` |
| **Codex** | `git clone https://github.com/Aaryan1524/Visualize.git ~/.agents/skills/visualize` | `$visualize …` |
| **Antigravity (CLI)** | `git clone https://github.com/Aaryan1524/Visualize.git ~/.gemini/config/skills/visualize` | `/visualize …` |
| **Antigravity (App)** | `git clone https://github.com/Aaryan1524/Visualize.git ~/.gemini/antigravity/skills/visualize` | `/visualize …` |
| **Single project** | Clone into `.claude/skills/visualize` or `.agents/skills/visualize` inside your repo | as above |

Then install dependencies once inside that folder:

```sh
cd <your-visualize-folder> && npm install
```

Start a new agent session and you're ready. Update anytime with `git pull`.

<details>
<summary><b>Codex: if headless Chrome checks are blocked by the sandbox</b></summary>

<br>

Visualize checks every built page in headless Chrome. Codex's sandbox can prevent Chrome from launching — the HTML page still builds cleanly, and only the browser check fails with a clear message. Approve running the check command outside the sandbox when prompted (requires default `approval_policy = "on-request"`), or run it directly in your terminal:

```sh
node ~/.agents/skills/visualize/scripts/verify.mjs <scene-folder>
```

</details>

<details>
<summary><b>Antigravity: running headless (<code>agy -p</code>) without prompts</b></summary>

<br>

Add allow rules for the skill folder and `node` under `permissions.allow` in `settings.json` (or pass via `--settings`):

```json
{
  "permissions": {
    "allow": [
      "read_file(~/.gemini/config/skills/visualize)",
      "command(node ~/.gemini/config/skills/visualize/scripts/)"
    ]
  }
}
```

Add `read_file` / `write_file` rules for your project directory as well. In the interactive app, simply approve commands when prompted.

</details>

---

## Prompts to try

You don't even have to type `/visualize` — the skill also triggers automatically when you ask for a machine, algorithm, protocol, or system to be explained visually or step by step.

```text
# Real machines (to-scale 3D cutaways)
/visualize explain how a car's open differential works
/visualize explain how a four-stroke internal combustion engine works
/visualize --deep explain how an automatic mechanical watch keeps time

# Systems, protocols & ML (3D Concept Plates + live lenses)
/visualize --deep explain multi-agent orchestration
/visualize explain how a Bloom filter works with 16 bits and 3 hash functions
/visualize explain a token-bucket rate limiter: capacity 10, refill 2/s, show a burst draining it and recovery
/visualize explain TCP fast retransmit: lose a segment, show 3 duplicate ACKs, and export an SVG of the key step
/visualize explain database connection pooling (pool of 4) and give me a React component for our Next.js docs
```

### Deep mode (`--deep`)

Add `--deep` (or say *"in depth"* / *"deep dive"*) for a **4–6 chapter, 10–15 minute** interactive tour: core mechanism → failure modes → trade-offs → real-world variants → edge cases. Each chapter gets its own header tab, prediction checkpoint, and saved reading progress.

**Three tips for the best output:**
1. **Include real numbers** (capacities, gear teeth, rates, bit counts) — the model runs directly on them.
2. **Name the dramatic moment** (*"glare ice stalls one wheel"*, *"a burst drains the bucket"*) — it becomes the Predict checkpoint.
3. **Name the target format** if you want more than standalone HTML (e.g., *"also export an SVG"* or *"give me a React component"*).

---

## How it works

<details>
<summary><b>Repository layout</b></summary>

<br>

```text
visualize/
├── SKILL.md                 Governing workflow, studio contract, and mandatory review gates
├── src/
│   ├── rig/                 3D studio projection, shading, lighting (`mech.ts`, `parts.ts`, `concept.ts`)
│   ├── drawing/             Shared interactive Drawing page, camera easing, player, tabs, dark mode, lab
│   ├── claims/              Model-vs-prose arithmetic audit (`audit.mjs`, `arithmetic.mjs`)
│   ├── core/                Trace, steps, timeline, keyed interpolation, scene types
│   ├── unfold/              Directed 3D stage and looks (Drawing, Clay, Paper)
│   ├── iso/                 Isometric projection and depth sorting
│   ├── parts/               Reusable concept parts (rail, ring, tree, network, flow)
│   ├── render/              SVG stage, panels, player controls, styles
│   └── react/               React component adapter
├── references/              Detailed guides (`look.md`, `figures.md`, `kit.md`, `authoring.md`, `craft.md`, `verify.md`)
├── scripts/
│   ├── new-figure.mjs       Scaffolds a studio-grade Machine or Concept figure from templates
│   ├── templates/           Hardened machine & concept starter templates
│   ├── check-drawing.mjs    Headless Chrome layout, contrast, callout, and FPS checks
│   ├── check-arithmetic.mjs Verifies every equation and readout against the model
│   ├── shoot-steps.mjs      Captures light & dark contact sheets of every step
│   ├── review-brief.mjs     Builds the mandatory fresh-context reviewer brief
│   ├── voice.mjs            Local offline TTS narration + word-level sync
│   └── build.mjs / verify.mjs / export-svg.mjs / plant-look.mjs
├── examples/                automatic-watch, differential, derailleur, escalator, lock,
│                            multi-agent, bloom, lru-3d, lru, attention, retries
├── test/fixtures/           Gallery scenes and planted-fault controls
└── evals/evals.json         Prompt benchmarks and acceptance criteria
```

</details>

<details>
<summary><b>Developer &amp; kit commands</b></summary>

<br>

```sh
npm install
npm test                                    # Model tests, engine tests, arithmetic & scaffold tests
npm run typecheck                           # TypeScript verification
npm run build                               # Build standalone dist/<scene>.html pages
npm run verify                              # Verify concept scenes in headless Chrome
npm run verify:controls                     # Planted faults: proves checks actually catch bugs
node scripts/new-figure.mjs <name> --kind=machine|concept   # Scaffold a new studio figure
node scripts/check-drawing.mjs dist/<name>.html             # Chrome layout/FPS/contrast audit
node scripts/check-arithmetic.mjs dist/<name>.html          # Prose-vs-model arithmetic audit
node scripts/shoot-steps.mjs dist/<name>.html               # Step screenshots for review
node scripts/review-brief.mjs <scene-dir>                   # Assemble fresh-context review brief
node scripts/voice.mjs <scene-dir>                          # Record synced offline narration
```

</details>

---

## Requirements

| Requirement | Needed for | Notes |
|---|---|---|
| **[Claude Code](https://code.claude.com/docs/en/overview)**, **[Codex](https://developers.openai.com/codex/skills)**, or **[Antigravity](https://antigravity.google)** | Everything | Follows the open Agent Skills format; tested end-to-end across all three. |
| **Node.js 24+** | Builds & checks | Runs TypeScript directly via native type stripping. Run `npm install` once in the skill folder. |
| **Chrome or Chromium** | Verification | Auto-detected on macOS, Linux, and Windows. Set `CHROME_PATH` for a custom binary. |
| **~90 MB (once)** | Voice narration | Open-source TTS model downloads on first use, then runs 100% offline. |

## Limits

- **Desktop first.** Pages open on phones, though the mobile layout is not yet as polished as desktop.
- **Voice is an explicit build step.** Run `node scripts/voice.mjs <scene>` after finalizing the script. Audio compresses to AAC on macOS; elsewhere it stays WAV. Prepared *What if* branches are not yet voiced.
- **Unfold 3D stage checks vs. Drawing checks.** All new studio figures (both Machines and Concepts) use the Drawing page + `rig/` pipeline and are checked by `check-drawing`, `check-arithmetic`, `shoot-steps`, and the independent reviewer. Legacy `unfold/` 3D scenes still have partial check coverage compared to the isometric stage.
- **Thorough by design.** Building a verified model, 3D rig, voice track, Chrome checks, and independent review takes a real session — not a 3-second SVG dump. That's why the numbers hold up.

## Contributing

Contributions are welcome! The single most valuable contribution is a [report of a figure that looks wrong or teaches badly](https://github.com/Aaryan1524/Visualize/issues/new?template=figure-problem.yml) — nearly every rule in `SKILL.md` started as one. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and PR gates, [Discussions](https://github.com/Aaryan1524/Visualize/discussions) for sharing pages you built, [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Aaryan
