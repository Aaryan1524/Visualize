import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reportFreshness, staleShots } from "./fresh.mjs";

test("fresh: shots newer than the page pass; a planted stale shot fails, and so does an empty folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "viz-fresh-")), page = join(dir, "page.html");
  writeFileSync(page, "<html>");
  const now = Date.now() / 1000;
  utimesSync(page, now - 60, now - 60);
  for (const f of ["step-0.png", "step-1.png"]) {
    writeFileSync(join(dir, f), "png");
    utimesSync(join(dir, f), now, now);
  }
  const lines = [];
  assert.equal(reportFreshness(dir, page, (l) => lines.push(l)), 0, lines.join("\n"));
  // a shot from before the page was built: a day old
  writeFileSync(join(dir, "step-2.png"), "png");
  utimesSync(join(dir, "step-2.png"), now - 86400, now - 86400);
  assert.deepEqual(staleShots(dir, page).stale, ["step-2.png"]);
  assert.equal(reportFreshness(dir, page, () => {}), 1);
  const empty = mkdtempSync(join(tmpdir(), "viz-fresh-empty-"));
  assert.equal(reportFreshness(empty, page, () => {}), 1, "no shots is not fresh shots");
});
