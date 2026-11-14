// The LRU example drawn on the Unfold stage, in the paper look.
import lru from "../../../examples/lru/scene.ts";
import { defineScene } from "../../../src/core/scene.ts";
export default defineScene({ ...lru, id: "unfold-lru", look: "paper" });
