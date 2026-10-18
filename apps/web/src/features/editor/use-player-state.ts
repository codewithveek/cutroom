"use client";

import type { PlayerRef } from "@remotion/player";
import { useEffect, useState } from "react";

export interface PlayerState {
  frame: number;
  playing: boolean;
  volume: number;
  muted: boolean;
}

/** Mirrors the Remotion player's frame, play state and volume into React state. */
export function usePlayerState(player: PlayerRef | null): PlayerState {
  const [state, setState] = useState<PlayerState>({ frame: 0, playing: false, volume: 1, muted: false });
  useEffect(() => {
    if (!player) return undefined;
    const sync = () =>
      setState({
        frame: player.getCurrentFrame(),
        playing: player.isPlaying(),
        volume: player.getVolume(),
        muted: player.isMuted(),
      });
    const onFrame = (event: { detail: { frame: number } }) =>
      setState((previous) => ({ ...previous, frame: event.detail.frame }));
    sync();
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", sync);
    player.addEventListener("play", sync);
    player.addEventListener("pause", sync);
    player.addEventListener("ended", sync);
    player.addEventListener("volumechange", sync);
    player.addEventListener("mutechange", sync);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", sync);
      player.removeEventListener("play", sync);
      player.removeEventListener("pause", sync);
      player.removeEventListener("ended", sync);
      player.removeEventListener("volumechange", sync);
      player.removeEventListener("mutechange", sync);
    };
  }, [player]);
  return state;
}
