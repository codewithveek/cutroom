import { Easing, interpolate } from "remotion";

/** Ease out into values; nothing stops abruptly (PRD §7.5). */
export const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export interface ProgressOptions {
  frame: number;
  startFrame: number;
  durationFrames: number;
  easing?: (input: number) => number;
}

/** 0 → 1 between startFrame and startFrame + durationFrames, eased and clamped. */
export function progressBetween(options: ProgressOptions): number {
  return interpolate(
    options.frame,
    [options.startFrame, options.startFrame + options.durationFrames],
    [0, 1],
    {
      easing: options.easing ?? easeOutExpo,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
}
