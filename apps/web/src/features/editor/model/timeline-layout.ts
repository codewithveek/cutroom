import { buildCaptionCues, type CaptionCue, totalVideoFrames, type VoiceTimeline } from "@cutroom/scene-spec";

export interface SceneClip {
  sceneId: string;
  index: number;
  startFrame: number;
  endFrame: number;
  transitionInFrames: number;
}

export interface LineClip {
  sceneId: string;
  lineIndex: number;
  startFrame: number;
  endFrame: number;
  text: string;
  audioAssetKey: string | undefined;
}

export function totalFrames(timeline: VoiceTimeline): number {
  return totalVideoFrames(timeline, false);
}

export function sceneClips(timeline: VoiceTimeline): SceneClip[] {
  return timeline.scenes.map((scene, index) => ({
    sceneId: scene.sceneId,
    index,
    startFrame: scene.fromFrame,
    endFrame: scene.fromFrame + scene.durationFrames,
    transitionInFrames: scene.transitionInFrames,
  }));
}

/** Every narration line placed on the video's global timeline. */
export function lineClips(timeline: VoiceTimeline): LineClip[] {
  return timeline.scenes.flatMap((scene) =>
    scene.lines.map((line) => ({
      sceneId: scene.sceneId,
      lineIndex: line.lineIndex,
      startFrame: scene.fromFrame + line.fromFrame,
      endFrame: scene.fromFrame + line.fromFrame + line.frames,
      text: line.text,
      audioAssetKey: line.audioAssetKey,
    })),
  );
}

/** The same cues the renderer writes to WebVTT and burns in (no thumbnail intro in previews). */
export function captionClips(timeline: VoiceTimeline): CaptionCue[] {
  return buildCaptionCues({ timeline, introFrames: 0 });
}

export function lineAtFrame(lines: ReadonlyArray<LineClip>, frame: number): LineClip | undefined {
  return lines.find((line) => frame >= line.startFrame && frame < line.endFrame);
}

export function sceneAtFrame(scenes: ReadonlyArray<SceneClip>, frame: number): SceneClip | undefined {
  return scenes.findLast((scene) => frame >= scene.startFrame && frame < scene.endFrame) ?? scenes.at(-1);
}

export interface RulerTick {
  frame: number;
  label: string | undefined;
}

/** One tick per second; labels thin out so they stay at least `minLabelGapPx` apart. */
export function rulerTicks(options: {
  totalFrames: number;
  fps: number;
  pixelsPerFrame: number;
  minLabelGapPx?: number;
}): RulerTick[] {
  const pixelsPerSecond = options.fps * options.pixelsPerFrame;
  const labelEvery = Math.max(1, Math.ceil((options.minLabelGapPx ?? 48) / pixelsPerSecond));
  const seconds = Math.ceil(options.totalFrames / options.fps);
  return Array.from({ length: seconds + 1 }, (_, second) => ({
    frame: second * options.fps,
    label: second % labelEvery === 0 ? `${second}s` : undefined,
  }));
}

/** 00:00:07 style, as in a transport bar. */
export function formatClock(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/** 0:04.2 style, for line starts. */
export function formatSeconds(frame: number, fps: number): string {
  const seconds = frame / fps;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, "0")}`;
}
