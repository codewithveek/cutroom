import { describe, expect, it } from "vitest";
import { musicLevelsFor, musicVolumeAt } from "./music-levels";

describe("music levels", () => {
  it("follows FR-MU-3", () => {
    expect(musicLevelsFor("tutorial", false)).toEqual({ alone: 0.3, underVoice: 0.11 });
    expect(musicLevelsFor("launch", false)).toEqual({ alone: 0.5, underVoice: 0.16 });
    expect(musicLevelsFor("launch", true).alone).toBe(0.6);
  });

  it("fades in, ducks under voice and fades out", () => {
    const levels = { alone: 0.5, underVoice: 0.16 };
    const voiceIntervals = [{ fromFrame: 100, toFrame: 200 }];
    const volumeAt = (frame: number) => musicVolumeAt({ frame, totalFrames: 600, levels, voiceIntervals });
    expect(volumeAt(0)).toBe(0);
    expect(volumeAt(50)).toBeCloseTo(0.5);
    expect(volumeAt(96)).toBeCloseTo(0.33);
    expect(volumeAt(150)).toBeCloseTo(0.16);
    expect(volumeAt(212)).toBeCloseTo(0.5);
    expect(volumeAt(575)).toBeCloseTo(0.25);
  });
});
