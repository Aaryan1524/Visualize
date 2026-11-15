#!/usr/bin/env node
// Build every example twice into fresh folders and require byte-identical pages.
// The same input must always produce the same output.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const all = readdirSync(join(ROOT, "examples")).map((n) => join(ROOT, "examples", n));
// Scenes build through scripts/build.mjs; Drawing examples (references/drawing.md) carry their own build.mjs.
const examples = all.filter((d) => existsSync(join(d, "scene.ts")));
const drawings = all.filter((d) => !existsSync(join(d, "scene.ts")) && existsSync(join(d, "build.mjs")));
const hashes = () => {
  const out = mkdtempSync(join(tmpdir(), "visualize-build-"));
  for (const d of examples) execFileSync(process.execPath, [join(ROOT, "scripts/build.mjs"), d, "--out", out], { stdio: "pipe" });
  for (const d of drawings) execFileSync(process.execPath, [join(d, "build.mjs"), "--out", join(out, `${basename(d)}.html`)], { stdio: "pipe" });
  const map = Object.fromEntries(readdirSync(out).sort().map((f) => [f, createHash("sha256").update(readFileSync(join(out, f))).digest("hex")]));
  rmSync(out, { recursive: true, force: true });
  return map;
};
const [a, b] = [hashes(), hashes()];
const differ = Object.keys({ ...a, ...b }).filter((f) => a[f] !== b[f]);
if (differ.length) {
  console.log(`reproducible: FAILED, ${differ.join(", ")} differ between two builds`);
  process.exitCode = 1;
} else console.log(`reproducible: passed (${Object.keys(a).length} pages byte-identical across two builds)`);
