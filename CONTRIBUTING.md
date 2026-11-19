# Contributing to Visualize

Thank you for helping. Visualize is an Agent Skill: a coding agent reads `SKILL.md`, writes a small model of an idea, draws it from the kit, and proves with checks that the page shows what the model computed. A contribution is good when it makes the **next figure an agent builds** clearer, truer or better looking, not only the one in front of you.

## Ways to help

| You want to | Start here |
|---|---|
| Report a figure that looks wrong, says something false or teaches badly | [Figure problem](https://github.com/Aaryan1524/Visualize/issues/new?template=figure-problem.yml): this is the most useful report there is |
| Report a crash, a failing check or a broken install | [Bug report](https://github.com/Aaryan1524/Visualize/issues/new?template=bug-report.yml) |
| Ask for a new part, a new kind of concept or a feature | [Feature request](https://github.com/Aaryan1524/Visualize/issues/new?template=feature-request.yml) |
| Ask a question or show something you made | [Discussions](https://github.com/Aaryan1524/Visualize/discussions) |
| Report a security problem | Privately, as in [SECURITY.md](SECURITY.md), never in a public issue |

For anything larger than a small fix, open an issue first so we can agree on the approach before you spend time on it.

## Set up

You need Node.js 24 or later, pnpm 11 and Google Chrome (or Chromium; set `CHROME_PATH` if it is somewhere unusual).

```sh
git clone https://github.com/Aaryan1524/Visualize.git
cd Visualize
pnpm install
pnpm test && pnpm typecheck
node scripts/build.mjs examples/lru-3d --out dist && open dist/lru-3d.html
```

To try your copy as a skill, link it into your agent's skills folder as `visualize` (for Claude Code, `~/.claude/skills/visualize`) and ask for an explanation in a new session.

## The rules that keep figures good

These come from real failures. Each one has a check behind it, or a reason it cannot have one yet.

1. **The model is the truth.** Never type a number, an order or an outcome into a view, a caption or the narration. Compute it in the model, show it through the view, and declare what the reader should see as observations, which `verify` reads back from the rendered page.
2. **Draw the shape the field already draws.** A ring for anything circular, a tree over its array for a heap, a sequence diagram for timing, a to-scale cutaway for a machine. A part in the kit must never choose the picture.
3. **One look per kind of subject.** Machines are technical cutaways ([`references/drawing.md`](references/drawing.md)); concepts are built from the kit's 3D parts in the same drawing style. Do not add a new palette, font or material for one figure. Pages open in the light theme.
4. **It must read at first glance.** Every figure, gallery and fixture needs a real question, named parts and a short story. A correct picture that a newcomer cannot read is a bug.
5. **The voice explains, then narrates.** Step 0 says what the concept is before anything moves. Spoken text uses plain words and says keys in context ("key A"), never bare letters or abbreviations. Each step is recorded in one pass (`node scripts/voice.mjs <scene>`).
6. **Fix it in the kit, not in the scene,** whenever the same problem would come back in the next figure.
7. **Original work only.** Do not copy code, drawings or assets from other projects unless their licence allows it and you say where they came from. Do not imitate another product's look.

## Making a change

### Fixing a figure or the kit

1. Reproduce it: build the page and find the step (`#step=k`) and the screenshot that shows the problem.
2. Find the cause, then fix it at the lowest level that removes it for every figure (engine, part, check, then `SKILL.md`, then the scene).
3. Look at the result at 1× and at 4× (`node scripts/shoot.mjs <page> --step k --select .vz-stage --scale 4 --out close.png`). A passing `verify` proves correctness and tidiness, not beauty.

### Adding a part

A part lives in `src/parts/`, is built from boxes and cylinders with its detail attached (`surface`), and returns named anchors derived from its own dimensions. It needs:

- part tests: no two pieces interpenetrate, every piece is supported, anchors lie on their part, bad input throws a `RangeError`;
- a gallery scene in `test/fixtures/gallery-*` that tells a small story with it and passes `verify`;
- a row in `references/kit.md` and in the parts table of `SKILL.md`.

### Adding a check

A check that never fails proves nothing. Every new check needs a **planted fault**: a broken variant in `test/fixtures/faults/scene.ts` or a plant in `scripts/verify.mjs`, listed in `CONTROLS`, so that `pnpm verify:controls` shows the check catching it. Add the failure line and its usual fix to `references/verify.md`.

### Adding an example

Examples are the quality bar agents copy from, so add one only when it teaches the kit something new. It needs a model tested against a separately written reference, observations for every value it shows, a voice, a prediction and Now you try, and it must pass every check below.

## Before you open a pull request

Run the same gates as CI:

```sh
pnpm test                 # models against their references, engine and part tests
pnpm typecheck
pnpm verify               # every example and gallery in headless Chrome
pnpm verify:controls      # every planted fault must be caught
pnpm check:embed
pnpm check:reproducible   # rebuilding gives byte-identical pages
pnpm check:drawing        # machine pages
```

Then in the pull request:

- say what failed before and how you know it is fixed;
- attach screenshots before and after for anything visual, at 1× and a 4× close-up;
- add a line to `CHANGELOG.md` under **Unreleased** that names the failure that caused the change, so the reason for every rule is kept;
- keep it to one change; split unrelated fixes into separate pull requests.

Commit messages use the [Conventional Commits](https://www.conventionalcommits.org) style (`fix(voice): …`, `feat(parts): …`) and say why, not only what.

## What will not be merged

- A check weakened, skipped or deleted to make a figure pass.
- Numbers, orders or outcomes typed into a view, caption or narration.
- A new look, palette or font for a single figure.
- Generated files: `dist/`, `shots/` and anything else in `.gitignore`.
- Code or assets you do not have the right to contribute.

## Licence

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE), like the rest of the project.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
