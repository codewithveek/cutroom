import type { VideoType } from "@cutroom/scene-spec";
import { interpolate } from "remotion";

export const DUCK_RAMP_FRAMES = 8;
export const MUSIC_FADE_IN_FRAMES = 20;
export const MUSIC_FADE_OUT_FRAMES = 50;
export const WHOOSH_VOLUME = 0.2;
export const WHOOSH_LEAD_FRAMES = 3;
export const CLICK_VOLUME = 0.38;

export interface MusicLevels {
  alone: number;
  underVoice: number;
}

/** FR-MU-3: tutorials sit lower; music-led looks raise the level when nobody is speaking. */
export function musicLevelsFor(videoType: VideoType, musicLed: boolean): MusicLevels {
  const isTutorial = videoType === "tutorial";
  const alone = musicLed ? 0.6 : isTutorial ? 0.3 : 0.5;
  return { alone, underVoice: isTutorial ? 0.11 : 0.16 };
}

export interface VoiceInterval {
  fromFrame: number;
  toFrame: number;
}

export interface MusicVolumeOptions {
  frame: number;
  totalFrames: number;
  levels: MusicLevels;
  voiceIntervals: ReadonlyArray<VoiceInterval>;
}

/** 1 inside a voice interval, ramping linearly to 0 over DUCK_RAMP_FRAMES either side. */
function duckAmount(frame: number, voiceIntervals: ReadonlyArray<VoiceInterval>): number {
  let amount = 0;
  for (const interval of voiceIntervals) {
    const rampIn = interpolate(frame, [interval.fromFrame - DUCK_RAMP_FRAMES, interval.fromFrame], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const rampOut = interpolate(frame, [interval.toFrame, interval.toFrame + DUCK_RAMP_FRAMES], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    amount = Math.max(amount, Math.min(rampIn, rampOut));
  }
  return amount;
}

export function musicVolumeAt(options: MusicVolumeOptions): number {
  const { frame, totalFrames, levels } = options;
  const ducked = interpolate(
    duckAmount(frame, options.voiceIntervals),
    [0, 1],
    [levels.alone, levels.underVoice],
  );
  const fadeIn = interpolate(frame, [0, MUSIC_FADE_IN_FRAMES], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [totalFrames - MUSIC_FADE_OUT_FRAMES, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return ducked * Math.min(fadeIn, fadeOut);
}
