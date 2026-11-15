// The flagship: LRU drawn on the Unfold stage in the paper look, with a spoken
// script: the voice says why, while the parts it names light up.
import lru, { CAPACITY, REQUESTS } from "../lru/scene.ts";
import { defineScene } from "../../src/core/scene.ts";
import { run, type GetEvent, type LruState } from "../lru/model.ts";

const STEPS = run(CAPACITY, REQUESTS).steps;
/** Was this key evicted earlier in the run? (Then a hit on it is a key that came back.) */
const cameBack = (e: GetEvent) => STEPS.slice(0, e.index).some((st) => st.event.evicted === e.key);

function voice(s: LruState, e: GetEvent | null, k: number): string {
  if (!e) return "A least recently used cache is a small, fast store that keeps the things you used most recently, and throws away the one you haven't touched for the longest. Here's one with room for three keys. When a fourth arrives, which one should go?";
  const key = `entry-${e.key}`, name = `key ${e.key}`;
  if (e.result === "hit") {
    const said = cameBack(e)
      ? `[${name}|${key}] was pushed out earlier and loaded straight back, so now it's a hit, and it moves to the most recent end.`
      : `[${name}|${key}] is already here. That's a hit, so it moves to the most recent end.`;
    return s.served === s.requests.length ? `${said} In all, ${s.hits} hits out of ${s.requests.length} requests.` : said;
  }
  if (e.evicted) {
    const out = `entry-${e.evicted}`;
    return s.evictions === 1
      ? `[${name}|${key}] needs a slot, and the cache is full. The one nobody has touched for longest, [key ${e.evicted}|${out}], leaves. Notice: it wasn't the oldest key to arrive. It was the one used least recently. The bet is that what you used lately, you'll use again.`
      : `[${name}|${key}] comes in, so [key ${e.evicted}|${out}], the least recently used, makes room.`
        + (STEPS[e.index - 1]?.event.evicted === e.key ? ` This time the bet lost: [${name}|${key}] was pushed out just one request ago.` : "");
  }
  return k === 3 ? `[${name}|${key}] fills the last slot. Now the cache is full.` : `[${name}|${key}] is new. There's room, so it takes an empty slot.`;
}

// The drawing look, the same family as the machine drawings, is the default; Clay and Paper are kept as variants.
const drawn = defineScene({ ...lru, id: "lru-3d", title: "LRU Cache", look: "drawing", voice, about: "When full, drops the entry used longest ago." });
export const variants = { "lru-3d": drawn, "lru-3d-clay": defineScene({ ...drawn, id: "lru-3d-clay", look: "clay" }), "lru-3d-paper": defineScene({ ...drawn, id: "lru-3d-paper", look: "paper" }) };
export default drawn;
export { audit } from "../lru/scene.ts";
