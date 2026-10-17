import { describe, expect, it } from "vitest";
import { buildCaptionCues, splitSentences, wrapWords } from "./captions";
import {
  estimateNarrationFrames,
  estimateTimeline,
  FIRST_SCENE_LEAD_FRAMES,
  LINE_GAP_FRAMES,
  SCENE_TAIL_FRAMES,
  solveTimeline,
  type TimedScene,
} from "./timing";

const twoScenes: TimedScene[] = [
  { id: "a", baseFrames: 60, narration: [{ text: "First line." }, { text: "Second line." }] },
  { id: "b", baseFrames: 200, narration: [{ text: "Third.", atFrame: 40 }] },
];

describe("solveTimeline", () => {
  const timeline = solveTimeline({
    scenes: twoScenes,
    transitionFrames: 12,
    source: "voice",
    lineAudio: (sceneId, lineIndex) => ({ frames: 50, audioAssetKey: `${sceneId}-${lineIndex}` }),
  });

  it("starts the first line after the lead-in and chains the rest with a gap", () => {
    const [first, second] = timeline.scenes[0]?.lines ?? [];
    expect(first?.fromFrame).toBe(FIRST_SCENE_LEAD_FRAMES);
    expect(second?.fromFrame).toBe(FIRST_SCENE_LEAD_FRAMES + 50 + LINE_GAP_FRAMES);
  });

  it("stretches a scene to fit its narration plus tail and crossfade", () => {
    const expectedEnd = FIRST_SCENE_LEAD_FRAMES + 50 + LINE_GAP_FRAMES + 50;
    expect(timeline.scenes[0]?.durationFrames).toBe(expectedEnd + SCENE_TAIL_FRAMES + 12);
  });

  it("keeps the base length when narration is short, and honours atFrame", () => {
    expect(timeline.scenes[1]?.durationFrames).toBe(200);
    expect(timeline.scenes[1]?.lines[0]?.fromFrame).toBe(40);
  });

  it("overlaps scenes by the transition length", () => {
    const firstScene = timeline.scenes[0];
    expect(timeline.scenes[1]?.fromFrame).toBe((firstScene?.durationFrames ?? 0) - 12);
    expect(timeline.totalFrames).toBe((timeline.scenes[1]?.fromFrame ?? 0) + 200);
  });

  it("never lets an atFrame overlap the previous line", () => {
    const overlapping = solveTimeline({
      scenes: [{ id: "x", baseFrames: 30, narration: [{ text: "one" }, { text: "two", atFrame: 0 }] }],
      transitionFrames: 12,
      source: "voice",
      lineAudio: () => ({ frames: 40 }),
    });
    expect(overlapping.scenes[0]?.lines[1]?.fromFrame).toBe(FIRST_SCENE_LEAD_FRAMES + 40 + LINE_GAP_FRAMES);
  });
});

describe("estimateTimeline", () => {
  it("estimates 2.5 words per second", () => {
    expect(estimateNarrationFrames("one two three four five")).toBe(60);
    const timeline = estimateTimeline({ scenes: twoScenes, transitionFrames: 14 });
    expect(timeline.source).toBe("estimate");
    expect(timeline.scenes).toHaveLength(2);
  });
});

describe("captions", () => {
  it("splits sentences and wraps to 42 characters", () => {
    expect(splitSentences("One. Two! Three")).toEqual(["One.", "Two!", "Three"]);
    const wrapped = wrapWords("a ".repeat(60).trim(), 42);
    expect(wrapped.every((line) => line.length <= 42)).toBe(true);
  });

  it("builds contiguous cues, shifted by the intro", () => {
    const timeline = solveTimeline({
      scenes: [{ id: "s", baseFrames: 30, narration: [{ text: "Hello there. General Kenobi." }] }],
      transitionFrames: 12,
      source: "voice",
      lineAudio: () => ({ frames: 90 }),
    });
    const cues = buildCaptionCues({ timeline, introFrames: 25 });
    expect(cues).toHaveLength(2);
    expect(cues[0]?.startFrame).toBe(25 + FIRST_SCENE_LEAD_FRAMES);
    expect(cues[0]?.endFrame).toBe(cues[1]?.startFrame);
    expect(cues[1]?.endFrame).toBe(25 + FIRST_SCENE_LEAD_FRAMES + 90);
  });

  it("keeps every cue within two lines of 42 characters", () => {
    const longText =
      "This sentence is deliberately long so that it needs more than two caption lines to show it all.";
    const timeline = solveTimeline({
      scenes: [{ id: "s", baseFrames: 30, narration: [{ text: longText }] }],
      transitionFrames: 12,
      source: "estimate",
      lineAudio: () => ({ frames: 120 }),
    });
    for (const cue of buildCaptionCues({ timeline, introFrames: 0 })) {
      const lines = cue.text.split("\n");
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines.every((line) => line.length <= 42)).toBe(true);
    }
  });
});
