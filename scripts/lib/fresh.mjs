// Are the screenshots of a page newer than the page? A reviewer once judged a camera from images a
// day older than the camera: every shot showed a page that no longer existed. Look only at fresh shots.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Local time, as `ls -l` shows it. */
export const stamp = (file) => new Date(statSync(file).mtimeMs - new Date().getTimezoneOffset() * 60000).toISOString().replace("T", " ").slice(0, 19);

/** The PNGs in `dir` older than `page`: { total, stale: [names] }. An empty or missing folder has no fresh shots. */
export function staleShots(dir, page) {
  const built = statSync(page).mtimeMs;
  const pngs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")) : [];
  return { total: pngs.length, stale: pngs.filter((f) => statSync(join(dir, f)).mtimeMs < built) };
}

/** Print the verdict and return the exit code: 0 when every shot is newer than the page and there is at least one. */
export function reportFreshness(dir, page, log = console.log) {
  const { total, stale } = staleShots(dir, page);
  for (const f of stale) log(`stale: ${f} (${stamp(join(dir, f))}) is older than ${page} (${stamp(page)})`);
  if (!total) log(`shots: none in ${dir}; take them (node scripts/shoot-steps.mjs ${page})`);
  else log(stale.length ? `shots: ${stale.length} of ${total} older than the page; take them again` : `shots: all ${total} newer than the page (${stamp(page)})`);
  return total && !stale.length ? 0 : 1;
}
