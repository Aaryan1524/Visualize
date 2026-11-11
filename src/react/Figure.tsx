// React adapter. A thin wrapper over mount(): the same geometry, motion and
// checks as the standalone page, with no drawing code of its own.
import { useEffect, useRef } from "react";
import type { Scene } from "../core/types.ts";
import { mount, type MountOptions, type PlayerApi } from "../render/player.ts";

export interface FigureProps<S, E> {
  scene: Scene<S, E>;
  /** Force a theme; by default the figure follows the reader's preference. */
  theme?: MountOptions["theme"];
  /** Receives the player once mounted, e.g. to drive it from the page. */
  onReady?: (player: PlayerApi) => void;
  className?: string;
}

/**
 * Renders a scene. Import `visualize/styles.css` once in the app; nothing
 * else is global. Unmounting stops playback and removes every listener.
 */
export function Figure<S, E>({ scene, theme, onReady, className }: FigureProps<S, E>) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const player = mount(host.current, scene, theme ? { theme } : {});
    onReady?.(player);
    return () => player.destroy();
  }, [scene, theme]);
  return <div ref={host} className={className} />;
}
