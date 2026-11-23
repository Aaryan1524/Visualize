#!/usr/bin/env node
// Start a Drawing page from a small, complete one that already builds and passes check-drawing (all but
// the independent review, which only a fresh reviewer can give). Everyday objects, machines and concepts
// are built the same way, on the rig: a model with a reference test, a rig figure of parts drawn once and
// moved, a camera shot per step, a narration recorded with the local voice (skipped in --mode fast), the
// audit's claims and topics, a claims test, a lab and Now you try.
//
//   node scripts/new-figure.mjs <name> --kind object|machine|concept [--mode everyday|fast|technical|deep] [--dir <folder>] [--title "Pump Bottle"] [--no-voice] [--force]
//
// --kind object:  a cutaway spring pump bottle (vesselShell, liquidColumn, dipTube, plungerNozzle,
//                 sprayCone, explainerCard, meterBar): the everyday object kit in src/rig/objects.ts.
// --kind machine: a gear pair (a tested contact pair; turned and plate parts).
// --kind concept: a hash table with linear probing (slots on a rail with printed values, a key card, an
//                 arrow to the slot looked at, a marker): the concept parts in src/rig/parts.ts.
//
// <folder> defaults to examples/<name>. Then replace the model first (model.mjs), then the figure and
// the story; references/objects.md (objects) and references/figures.md (machines/concepts) are the recipes.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const VALID_KINDS = ["object", "machine", "concept"];
const VALID_MODES = ["everyday", "fast", "technical", "deep"];
const USAGE =
  'usage: node scripts/new-figure.mjs <name: lowercase, dashes> --kind object|machine|concept [--mode everyday|fast|technical|deep] [--dir <folder>] [--title "Title"] [--no-voice] [--force]';

const args = process.argv.slice(2);
const BOOL_FLAGS = new Set(["--no-voice", "--force"]);
const VALUE_FLAGS = new Set(["--kind", "--mode", "--dir", "--title"]);
const opts = new Map();
let name = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (BOOL_FLAGS.has(a)) {
    opts.set(a.slice(2), true);
  } else if (a.startsWith("--") && a.includes("=")) {
    const eq = a.indexOf("=");
    const flag = a.slice(0, eq);
    if (!VALUE_FLAGS.has(flag)) {
      console.error(`unknown option ${flag}\n${USAGE}`);
      process.exit(2);
    }
    opts.set(flag.slice(2), a.slice(eq + 1));
  } else if (VALUE_FLAGS.has(a)) {
    const val = args[i + 1];
    if (!val || val.startsWith("--")) {
      console.error(`missing value for ${a}\n${USAGE}`);
      process.exit(2);
    }
    opts.set(a.slice(2), val);
    i++;
  } else if (a.startsWith("--")) {
    console.error(`unknown option ${a}\n${USAGE}`);
    process.exit(2);
  } else if (!name) {
    name = a;
  }
}

const kind = opts.get("kind") ?? null;
const mode = opts.get("mode") ?? "everyday";
if (!name || !/^[a-z][a-z0-9-]*$/.test(name) || !VALID_KINDS.includes(kind)) {
  console.error(USAGE);
  process.exit(2);
}
if (!VALID_MODES.includes(mode)) {
  console.error(`invalid --mode "${mode}": expected one of ${VALID_MODES.join(", ")}\n${USAGE}`);
  process.exit(2);
}

const TEMPLATES = join(ROOT, "scripts", "templates", kind);
const dir = resolve(opts.get("dir") ?? join(ROOT, "examples", name));
const title = opts.get("title") ?? name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
if (existsSync(dir) && readdirSync(dir).length && !opts.get("force")) {
  console.error(`new-figure: ${dir} is not empty (--force to write over it)`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const realDir = realpathSync(dir);
// imports reach the skill by a relative path, so the folder can sit anywhere on this disk
let rel = relative(realDir, ROOT).split(sep).join("/") || ".";
if (!rel.startsWith(".")) rel = `./${rel}`;
for (const f of readdirSync(TEMPLATES).filter((f) => f.endsWith(".tmpl"))) {
  const text = readFileSync(join(TEMPLATES, f), "utf8")
    .replaceAll("__ROOT__", rel)
    .replaceAll("__NAME__", name)
    .replaceAll("__TITLE__", title)
    .replaceAll("__MODE__", mode);
  writeFileSync(join(dir, f.replace(/\.tmpl$/, "")), text);
  console.log(`wrote ${join(dir, f.replace(/\.tmpl$/, ""))}`);
}
const skipVoice = Boolean(opts.get("no-voice")) || mode === "fast";
if (!skipVoice) {
  console.log("recording the narration (Kokoro, local; about a minute)…");
  execFileSync(process.execPath, [join(dir, "voice.mjs")], { cwd: dir, stdio: "inherit" });
}
const page = join(dir, "dist", `${name}.html`);
const auditFile = join(dir, "dist", `${name}.audit.json`);
const shotsDir = join(dir, "shots");
const isFast = mode === "fast";
const fastFlag = isFast ? " --fast" : "";
const shotsNote = isFast ? "(look at core light & dark shots)" : "(look at every light & dark image)";
console.log(`
Next:
  node --test ${join(dir, "model.test.mjs")} ${join(dir, "claims.test.mjs")}
  node ${join(dir, "build.mjs")}
  node ${join(ROOT, "scripts", "check-drawing.mjs")} ${page}${fastFlag}       (passes all but the review)
  node ${join(ROOT, "scripts", "check-arithmetic.mjs")} ${page}
  node ${join(ROOT, "scripts", "shoot-steps.mjs")} ${page} --out ${shotsDir}${fastFlag}   ${shotsNote}
  node ${join(ROOT, "scripts", "review-brief.mjs")} ${auditFile} ${join(dir, "review.json")} ${page} --shots ${shotsDir} --mode ${mode}   (give to a fresh independent reviewer)
Replace the model first: model.mjs, then figure.mjs and story.mjs (${kind === "object" ? "references/objects.md" : "references/figures.md"}).`);
