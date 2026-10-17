import { FRAMES_PER_SECOND } from "./primitives";
import type { Scene } from "./scene";
import type { SceneTiming, VoiceLineTiming, VoiceTimeline } from "./voice-timeline";

/** Narration pace used for estimates and the word budget (FR-SB-4). */
export const NARRATION_WORDS_PER_SECOND = 2.5;
export const LINE_GAP_FRAMES = 6;
/** Hold the resolved state ≥ 0.5 s before a transition (PRD §7.5). */
export const SCENE_TAIL_FRAMES = 15;
export const FIRST_SCENE_LEAD_FRAMES = 10;
/** 16:9 videos open on the thumbnail: 25 frames held, then a 10-frame fade (FR-RD-4). */
export const THUMBNAIL_HOLD_FRAMES = 25;
export const THUMBNAIL_FADE_FRAMES = 10;
const MINIMUM_LINE_FRAMES = 15;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateNarrationFrames(text: string): number {
  const seconds = countWords(text) / NARRATION_WORDS_PER_SECOND;
  return Math.max(MINIMUM_LINE_FRAMES, Math.round(seconds * FRAMES_PER_SECOND));
}

export interface LineAudio {
  frames: number;
  audioAssetKey?: string;
}

export type TimedScene = Pick<Scene, "id" | "baseFrames" | "narration">;

export interface SolveTimelineOptions {
  scenes: ReadonlyArray<TimedScene>;
  /** Length of every transition; all transitions last the look's crossfade (PRD §7.7). */
  transitionFrames: number;
  /** Synthesised (or estimated) audio for one narration line. */
  lineAudio: (sceneId: string, lineIndex: number) => LineAudio;
  source: VoiceTimeline["source"];
}

function solveSceneLines(
  scene: TimedScene,
  options: SolveTimelineOptions,
  leadFrames: number,
): VoiceLineTiming[] {
  const lineTimings: VoiceLineTiming[] = [];
  let previousLineEnd: number | undefined;
  scene.narration.forEach((line, lineIndex) => {
    const audio = options.lineAudio(scene.id, lineIndex);
    const earliestStart = previousLineEnd === undefined ? leadFrames : previousLineEnd + LINE_GAP_FRAMES;
    const fromFrame = Math.max(line.atFrame ?? earliestStart, earliestStart);
    lineTimings.push({
      lineIndex,
      text: line.text,
      fromFrame,
      frames: Math.max(1, audio.frames),
      ...(audio.audioAssetKey ? { audioAssetKey: audio.audioAssetKey } : {}),
    });
    previousLineEnd = fromFrame + Math.max(1, audio.frames);
  });
  return lineTimings;
}

/**
 * Narration drives timing (P2): a scene lasts max(base, last line end + tail + crossfade).
 * Scenes overlap by the transition length, so each starts `transitionFrames` before the previous ends.
 */
export function solveTimeline(options: SolveTimelineOptions): VoiceTimeline {
  const sceneTimings: SceneTiming[] = [];
  let nextSceneStart = 0;
  options.scenes.forEach((scene, sceneIndex) => {
    const transitionInFrames = sceneIndex === 0 ? 0 : options.transitionFrames;
    const leadFrames = sceneIndex === 0 ? FIRST_SCENE_LEAD_FRAMES : transitionInFrames;
    const lines = solveSceneLines(scene, options, leadFrames);
    const lastLine = lines.at(-1);
    const narrationEnd = lastLine ? lastLine.fromFrame + lastLine.frames : 0;
    const durationFrames = Math.max(
      scene.baseFrames,
      narrationEnd + SCENE_TAIL_FRAMES + options.transitionFrames,
    );
    const fromFrame = Math.max(0, nextSceneStart - transitionInFrames);
    sceneTimings.push({ sceneId: scene.id, fromFrame, durationFrames, transitionInFrames, lines });
    nextSceneStart = fromFrame + durationFrames;
  });
  return {
    fps: FRAMES_PER_SECOND,
    source: options.source,
    scenes: sceneTimings,
    totalFrames: Math.max(1, nextSceneStart),
  };
}

export interface EstimateTimelineOptions {
  scenes: ReadonlyArray<TimedScene>;
  transitionFrames: number;
}

/** Timeline from word counts, for previews before voice synthesis (FR-HR-3). */
export function estimateTimeline(options: EstimateTimelineOptions): VoiceTimeline {
  const scenesById = new Map(options.scenes.map((scene) => [scene.id, scene]));
  return solveTimeline({
    scenes: options.scenes,
    transitionFrames: options.transitionFrames,
    source: "estimate",
    lineAudio: (sceneId, lineIndex) => {
      const line = scenesById.get(sceneId)?.narration[lineIndex];
      return { frames: line ? estimateNarrationFrames(line.say ?? line.text) : MINIMUM_LINE_FRAMES };
    },
  });
}

export function introFramesFor(openOnThumbnail: boolean): number {
  return openOnThumbnail ? THUMBNAIL_HOLD_FRAMES : 0;
}

export function totalVideoFrames(timeline: VoiceTimeline, openOnThumbnail: boolean): number {
  return timeline.totalFrames + introFramesFor(openOnThumbnail);
}
