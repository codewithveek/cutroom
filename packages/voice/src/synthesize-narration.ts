import {
  FRAMES_PER_SECOND,
  type Storyboard,
  solveTimeline,
  type VoiceSelection,
  type VoiceTimeline,
} from "@cutroom/scene-spec";
import type { CachedVoice } from "./voice-cache";

export interface VoiceClipAsset {
  assetKey: string;
  filePath: string;
  durationMs: number;
}

export interface SynthesizeNarrationOptions {
  storyboard: Storyboard;
  voice: CachedVoice;
  selection: VoiceSelection;
  transitionFrames: number;
  onLine?: (progress: { done: number; total: number }) => void;
}

export interface NarrationResult {
  timeline: VoiceTimeline;
  clips: VoiceClipAsset[];
  synthesizedLines: number;
  cachedLines: number;
}

/**
 * Pipeline step 5: one clip per narration line (the respelt `say` when present), then the
 * timing solver turns real durations into scene lengths (FR-VO-4, FR-VO-5).
 */
export async function synthesizeNarration(options: SynthesizeNarrationOptions): Promise<NarrationResult> {
  const lineKey = (sceneId: string, lineIndex: number) => `${sceneId}#${lineIndex}`;
  const audioByLine = new Map<string, { frames: number; audioAssetKey: string }>();
  const clips: VoiceClipAsset[] = [];
  const total = options.storyboard.scenes.reduce((sum, scene) => sum + scene.narration.length, 0);
  let done = 0;
  let cachedLines = 0;
  for (const scene of options.storyboard.scenes) {
    for (const [lineIndex, line] of scene.narration.entries()) {
      const clip = await options.voice.synthesize({
        text: line.say ?? line.text,
        voiceId: options.selection.voiceId,
        speed: options.selection.speed,
      });
      if (clip.fromCache) cachedLines += 1;
      const assetKey = `voice-${clip.cacheKey}`;
      if (!clips.some((existing) => existing.assetKey === assetKey)) {
        clips.push({ assetKey, filePath: clip.audioPath, durationMs: clip.durationMs });
      }
      audioByLine.set(lineKey(scene.id, lineIndex), {
        frames: Math.max(1, Math.ceil((clip.durationMs / 1000) * FRAMES_PER_SECOND)),
        audioAssetKey: assetKey,
      });
      done += 1;
      options.onLine?.({ done, total });
    }
  }
  const timeline = solveTimeline({
    scenes: options.storyboard.scenes,
    transitionFrames: options.transitionFrames,
    source: "voice",
    lineAudio: (sceneId, lineIndex) => audioByLine.get(lineKey(sceneId, lineIndex)) ?? { frames: 15 },
  });
  return { timeline, clips, synthesizedLines: total - cachedLines, cachedLines };
}
