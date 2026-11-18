#!/usr/bin/env node
// Kept for older instructions: the same as `node scripts/new-figure.mjs <name> --kind machine`.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

try {
  execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "new-figure.mjs"), ...process.argv.slice(2), "--kind", "machine"], { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
