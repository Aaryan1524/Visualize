// The LRU example drawn on the Unfold stage in the paper look, with a spoken
// script: the voice says why, while the parts it names light up.
import lru from "../../../examples/lru/scene.ts";
import { defineScene } from "../../../src/core/scene.ts";
import type { GetEvent, LruState } from "../../../examples/lru/model.ts";

function voice(s: LruState, e: GetEvent | null, k: number): string {
  if (!e) return "An {L} {R} {U} cache is a small, fast store that keeps the things you used most recently, and throws away the one you haven't touched for the longest. Here's one with room for three keys. When a fourth arrives, which one should go?";
  const at = (key: string) => `[${key}|entry-${key}]`;
  if (e.result === "hit") return `${at(e.key)} is already here. That's a hit, so {${e.key}} moves to the most recent end.`;
  if (e.evicted) {
    const first = s.evictions === 1;
    return first
      ? `${at(e.key)} is new, and the cache is full. The key nobody has touched for longest, ${at(e.evicted)}, leaves. Notice: it wasn't the oldest key. It was the least recently used.`
      : `${at(e.key)} comes in, so ${at(e.evicted)}, the least recently used, makes room.`;
  }
  return k === 3 ? `${at(e.key)} fills the last slot. Now the cache is full.` : `${at(e.key)} is new. There's room, so it takes an empty slot.`;
}

const clay = defineScene({ ...lru, id: "unfold-lru", look: "clay", voice, about: "Keeps what you used lately and drops what you haven't." });
export const variants = { "unfold-lru": clay, "unfold-lru-paper": defineScene({ ...clay, id: "unfold-lru-paper", look: "paper" }) };
export default clay;
