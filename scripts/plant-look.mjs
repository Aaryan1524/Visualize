#!/usr/bin/env node
// Prove the look checks of check-drawing.mjs can fail: plant each fault in a page that passes them
// (VIZ_PLANT, applied after every seek) and require the check's own failure line, which the clean
// page must not print.
//
//   node scripts/plant-look.mjs [dist/bloom.html]
//
// The page must be a rig page with a camera, lit parts and callouts (bloom is; build it first).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const page = process.argv[2] ?? "dist/bloom.html";
const run = promisify(execFile);
const check = async (plant) => {
  const env = { ...process.env, VIZ_ONLY_LOOK: "1", ...(plant ? { VIZ_PLANT: plant } : {}) };
  try {
    return (await run(process.execPath, ["scripts/check-drawing.mjs", page], { env, maxBuffer: 1 << 26 })).stdout;
  } catch (e) {
    return e.stdout ?? String(e);
  }
};
// each fault, and the failure line it must raise
const FAULTS = {
  turn: /part "[^"]+" turns a thick solid by one 2D transform without its error budget/,
  "turn-error": /part "planted" is drawn with a turn error of 3\.50 px/,
  flat: /shows its top and sides .* apart in lightness/,
  pale: /is lit but its top is .* in lightness from the stage/,
  still: /show the same framing/,
  small: /which spans \d+% of the stage's shorter side, under/,
  "leader-long": /the leader of "[^"]+" is \d+% of the stage's shorter side, over/,
  "leader-cross": /the leader of "[^"]+" crosses "[^"]+" for/,
  cover: /is lit but \d+% of it is covered/,
};
const clean = await check(null);
let bad = 0;
for (const [plant, line] of Object.entries(FAULTS)) {
  if (line.test(clean)) {
    console.log(`${plant}: the clean page already fails this check, so the plant proves nothing`);
    bad++;
    continue;
  }
  const out = await check(plant);
  const caught = out.split("\n").find((l) => line.test(l));
  console.log(caught ? `${plant}: caught — ${caught}` : `${plant}: NOT caught`);
  if (!caught) bad++;
}
console.log(bad ? `plant-look: ${bad} of ${Object.keys(FAULTS).length} faults not proven` : `plant-look: all ${Object.keys(FAULTS).length} faults caught`);
process.exit(bad ? 1 : 0);
