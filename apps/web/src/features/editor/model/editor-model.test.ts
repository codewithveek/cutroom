import { estimateTimeline, type Storyboard } from "@cutroom/scene-spec";
import { fixtureStoryboard } from "@cutroom/video-kit";
import { describe, expect, it } from "vitest";
import { createHistory, pushHistory, redoHistory, undoHistory } from "./editor-history";
import {
  duplicateScene,
  insertScene,
  moveScene,
  removeScene,
  StoryboardEditError,
  setBrandAccent,
  setNarrationLine,
  setTransition,
} from "./storyboard-edits";
import {
  captionClips,
  formatClock,
  formatSeconds,
  lineAtFrame,
  lineClips,
  rulerTicks,
  sceneClips,
  totalFrames,
} from "./timeline-layout";

const storyboard: Storyboard = fixtureStoryboard;
const firstId = storyboard.scenes[0]?.id ?? "";

describe("editor history", () => {
  it("undoes and redoes, and a new edit clears the redo stack", () => {
    let history = createHistory(1);
    history = pushHistory(history, 2);
    history = pushHistory(history, 3);
    history = undoHistory(history);
    expect(history.present).toBe(2);
    history = redoHistory(history);
    expect(history.present).toBe(3);
    history = undoHistory(undoHistory(history));
    history = pushHistory(history, 9);
    expect(history.future).toEqual([]);
    expect(undoHistory(createHistory(1)).present).toBe(1);
  });
});

describe("storyboard edits", () => {
  it("inserts from a template with a fresh id and no beat, duplicates and removes", () => {
    const inserted = insertScene({ storyboard, afterSceneId: firstId, block: "big-number" });
    const added = inserted.scenes[1];
    expect(added?.block).toBe("big-number");
    expect(added?.id).not.toBe(storyboard.scenes.find((scene) => scene.block === "big-number")?.id);
    expect(added?.beat).toBeUndefined();
    const duplicated = duplicateScene({ storyboard, sceneId: firstId });
    expect(duplicated.scenes[1]?.props).toEqual(storyboard.scenes[0]?.props);
    expect(removeScene({ storyboard, sceneId: firstId }).scenes).toHaveLength(storyboard.scenes.length - 1);
  });

  it("refuses to go below three scenes", () => {
    const small = { ...storyboard, scenes: storyboard.scenes.slice(0, 3) };
    expect(() => removeScene({ storyboard: small, sceneId: firstId })).toThrow(StoryboardEditError);
  });

  it("moves, sets transitions, narration and the accent", () => {
    expect(moveScene({ storyboard, fromIndex: 0, toIndex: 1 }).scenes[1]?.id).toBe(firstId);
    expect(moveScene({ storyboard, fromIndex: 0, toIndex: -1 })).toBe(storyboard);
    const faded = setTransition({ storyboard, sceneId: firstId, transition: "zoom" });
    expect(faded.scenes[0]?.transitionIn).toBe("zoom");
    expect(
      setTransition({ storyboard: faded, sceneId: firstId, transition: undefined }).scenes[0],
    ).not.toHaveProperty("transitionIn");
    const sceneWithLine = storyboard.scenes.find((scene) => scene.narration.length > 0);
    if (!sceneWithLine) throw new Error("fixture drift");
    const respelt = setNarrationLine({
      storyboard,
      sceneId: sceneWithLine.id,
      lineIndex: 0,
      patch: { say: "ship note" },
    });
    expect(respelt.scenes.find((scene) => scene.id === sceneWithLine.id)?.narration[0]?.say).toBe(
      "ship note",
    );
    const cleared = setNarrationLine({
      storyboard: respelt,
      sceneId: sceneWithLine.id,
      lineIndex: 0,
      patch: { say: "" },
    });
    expect(cleared.scenes.find((scene) => scene.id === sceneWithLine.id)?.narration[0]).not.toHaveProperty(
      "say",
    );
    expect(setBrandAccent(storyboard, "#123456").brand.accentColor).toBe("#123456");
    expect(setBrandAccent(storyboard, undefined).brand).not.toHaveProperty("accentColor");
  });
});

describe("timeline layout", () => {
  const timeline = estimateTimeline({ scenes: storyboard.scenes, transitionFrames: 12 });

  it("places scenes, lines and captions on one clock", () => {
    const scenes = sceneClips(timeline);
    expect(scenes).toHaveLength(storyboard.scenes.length);
    expect(scenes[1]?.startFrame).toBeLessThan(scenes[0]?.endFrame ?? 0);
    const lines = lineClips(timeline);
    const firstLine = lines[0];
    if (!firstLine) throw new Error("fixture drift");
    expect(lineAtFrame(lines, firstLine.startFrame)?.text).toBe(firstLine.text);
    expect(captionClips(timeline).length).toBeGreaterThanOrEqual(lines.length);
    expect(totalFrames(timeline)).toBeGreaterThan(scenes.at(-1)?.startFrame ?? 0);
  });

  it("thins ruler labels and formats clocks", () => {
    const ticks = rulerTicks({ totalFrames: 300, fps: 30, pixelsPerFrame: 1 });
    expect(ticks).toHaveLength(11);
    expect(ticks.filter((tick) => tick.label).length).toBe(6);
    expect(formatClock(30 * 65, 30)).toBe("00:01:05");
    expect(formatSeconds(126, 30)).toBe("0:04.2");
  });
});
