import { describe, expect, it } from "vitest";
import { parseEbur128Timeline, planQualityStills } from "./quality-check";

describe("planQualityStills", () => {
  it("captures each resolved scene end and each transition midpoint, after the intro", () => {
    const plans = planQualityStills({
      openOnThumbnail: true,
      voiceTimeline: {
        fps: 30,
        source: "voice",
        totalFrames: 190,
        scenes: [
          { sceneId: "a", fromFrame: 0, durationFrames: 100, transitionInFrames: 0, lines: [] },
          { sceneId: "b", fromFrame: 88, durationFrames: 102, transitionInFrames: 12, lines: [] },
        ],
      },
    });
    expect(plans).toEqual([
      { frame: 25 + 100 - 12 - 1, label: "scene-1-end" },
      { frame: 25 + 88 + 6, label: "transition-1-2" },
      { frame: 25 + 88 + 102 - 1, label: "scene-2-end" },
    ]);
  });
});

describe("parseEbur128Timeline", () => {
  it("samples momentary loudness once per second", () => {
    const stderr = [
      "[Parsed_ebur128_0 @ 0x1] t: 0.1      TARGET:-23 LUFS    M: -inf S:-120.7     I: -70.0 LUFS",
      "[Parsed_ebur128_0 @ 0x1] t: 0.5      TARGET:-23 LUFS    M: -30.2 S:-120.7     I: -70.0 LUFS",
      "[Parsed_ebur128_0 @ 0x1] t: 1.0      TARGET:-23 LUFS    M: -18.4 S:-20.1     I: -19.0 LUFS",
      "[Parsed_ebur128_0 @ 0x1] t: 1.4      TARGET:-23 LUFS    M: -17.9 S:-20.1     I: -19.0 LUFS",
      "[Parsed_ebur128_0 @ 0x1] t: 2.0      TARGET:-23 LUFS    M: -16.0 S:-18.0     I: -17.0 LUFS",
    ].join("\n");
    expect(parseEbur128Timeline(stderr)).toEqual([
      { second: 0, lufs: -70 },
      { second: 1, lufs: -18.4 },
      { second: 2, lufs: -16 },
    ]);
  });
});
