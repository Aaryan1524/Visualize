// The LRU example drawn on the Unfold stage in the paper look, with a spoken
// script: the voice says why, while the parts it names light up.
import lru from "../../../examples/lru/scene.ts";
import { defineScene } from "../../../src/core/scene.ts";
import type { GetEvent, LruState } from "../../../examples/lru/model.ts";

function voice(s: LruState, e: GetEvent | null, k: number): string {
  // Plain words only: the voice model cannot say single letters well, so keys are "the new key",
  // "the oldest one", and the part lights up as it is named.
  if (!e) return "A least recently used cache is a small, fast store that keeps the things you used most recently, and throws away the one you haven't touched for the longest. Here's one with room for three keys. When a fourth arrives, which one should go?";
  const key = `entry-${e.key}`;
  if (e.result === "hit") return `[This key|${key}] is already here. That's a hit, so it moves to the most recent end.`;
  if (e.evicted) {
    const out = `entry-${e.evicted}`;
    return s.evictions === 1
      ? `[The new key|${key}] needs a slot, and the cache is full. The key nobody has touched for longest, [the least recently used one|${out}], leaves. Notice: it wasn't the oldest key to arrive. It was the one used least recently.`
      : `[The new key|${key}] comes in, so [the least recently used one|${out}] makes room.`;
  }
  return k === 3 ? `[The new key|${key}] fills the last slot. Now the cache is full.` : `[The new key|${key}] is new. There's room, so it takes an empty slot.`;
}

const clay = defineScene({ ...lru, id: "unfold-lru", title: "LRU Cache", look: "clay", voice, about: "Keeps what you used lately and drops what you haven't." });
export const variants = { "unfold-lru": clay, "unfold-lru-paper": defineScene({ ...clay, id: "unfold-lru-paper", look: "paper" }) };
export default clay;
