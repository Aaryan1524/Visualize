// The LRU example drawn on the Unfold stage in the paper look, with a spoken
// script: the voice says why, while the parts it names light up.
import lru from "../../../examples/lru/scene.ts";
import { defineScene } from "../../../src/core/scene.ts";
import type { GetEvent, LruState } from "../../../examples/lru/model.ts";

function voice(s: LruState, e: GetEvent | null, k: number): string {
  if (!e) return "Here's a cache with room for three keys. Requests arrive one at a time, and when it's full, one key has to go. The question is: which one?";
  const at = (key: string) => `[${key}|entry-${key}]`;
  if (e.result === "hit") return `${at(e.key)} is already here. That's a hit, so ${e.key} moves to the most recent end.`;
  if (e.evicted) {
    const first = s.evictions === 1;
    return first
      ? `${at(e.key)} is new, and the cache is full. The key nobody has touched for longest, ${at(e.evicted)}, leaves. Notice: it wasn't the oldest key. It was the least recently used.`
      : `${at(e.key)} comes in, so ${at(e.evicted)}, the least recently used, makes room.`;
  }
  return k === 3 ? `${at(e.key)} fills the last slot. Now the cache is full.` : `${at(e.key)} is new. There's room, so it takes an empty slot.`;
}

export default defineScene({ ...lru, id: "unfold-lru", look: "paper", voice });
