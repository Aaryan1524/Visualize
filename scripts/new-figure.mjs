#!/usr/bin/env node
// Start a Drawing page from a small, complete one that already builds and passes check-drawing (all but
// the independent review, which only a fresh reviewer can give). Machines and concepts are built the
// same way, on the rig: a model with a reference test, a rig figure of parts drawn once and moved, a
// camera shot per step, a narration recorded with the local voice, the audit's claims and topics, a
// claims test, a lab and Now you try.
//
//   node scripts/new-figure.mjs <name> --kind machine|concept [--dir <folder>] [--title "Gear Pair"] [--no-voice] [--force]
//
// --kind machine: a gear pair (a tested contact pair; turned and plate parts).
// --kind concept: a hash table with linear probing (slots on a rail with printed values, a key card, an
//                 arrow to the slot looked at, a marker): the concept parts in src/rig/parts.ts.
//
// <folder> defaults to examples/<name>. Then replace the model first (model.mjs), then the figure and
// the story; references/figures.md is the recipe.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const args = process.argv.slice(2);
const name = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--no-voice", "--force"].includes(args[i - 1])));
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const kind = opt("kind", null);
if (!name || !/^[a-z][a-z0-9-]*$/.test(name) || !["machine", "concept"].includes(kind)) {
  console.error('usage: node scripts/new-figure.mjs <name: lowercase, dashes> --kind machine|concept [--dir <folder>] [--title "Title"] [--no-voice] [--force]');
  process.exit(2);
}
const TEMPLATES = join(ROOT, "scripts", "templates", kind);
const dir = resolve(opt("dir", join(ROOT, "examples", name)));
const title = opt("title", name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "));
if (existsSync(dir) && readdirSync(dir).length && !args.includes("--force")) {
  console.error(`new-figure: ${dir} is not empty (--force to write over it)`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const realDir = realpathSync(dir);
// imports reach the skill by a relative path, so the folder can sit anywhere on this disk
let rel = relative(realDir, ROOT).split(sep).join("/") || ".";
if (!rel.startsWith(".")) rel = `./${rel}`;
for (const f of readdirSync(TEMPLATES).filter((f) => f.endsWith(".tmpl"))) {
  const text = readFileSync(join(TEMPLATES, f), "utf8").replaceAll("__ROOT__", rel).replaceAll("__NAME__", name).replaceAll("__TITLE__", title);
  writeFileSync(join(dir, f.replace(/\.tmpl$/, "")), text);
  console.log(`wrote ${join(dir, f.replace(/\.tmpl$/, ""))}`);
}
if (!args.includes("--no-voice")) {
  console.log("recording the narration (Kokoro, local; about a minute)…");
  execFileSync(process.execPath, [join(dir, "voice.mjs")], { cwd: dir, stdio: "inherit" });
}
const page = join(dir, "dist", `${name}.html`);
const auditFile = join(dir, "dist", `${name}.audit.json`);
const shotsDir = join(dir, "shots");
console.log(`
Next:
  node --test ${join(dir, "model.test.mjs")} ${join(dir, "claims.test.mjs")}
  node ${join(dir, "build.mjs")}
  node ${join(ROOT, "scripts", "check-drawing.mjs")} ${page}       (passes all but the review)
  node ${join(ROOT, "scripts", "check-arithmetic.mjs")} ${page}
  node ${join(ROOT, "scripts", "shoot-steps.mjs")} ${page} --out ${shotsDir}   (look at every light & dark image)
  node ${join(ROOT, "scripts", "review-brief.mjs")} ${auditFile} ${join(dir, "review.json")} ${page} --shots ${shotsDir}   (give to a fresh independent reviewer)
Replace the model first: model.mjs, then figure.mjs and story.mjs (references/figures.md).`);
