import {
  type AspectRatio,
  estimateTimeline,
  type Storyboard,
  type VideoProps,
  type VoiceTimeline,
} from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";

export interface PreviewPropsOptions {
  storyboard: Storyboard;
  ratio: AspectRatio;
  /** Real voice timing when available; otherwise estimated from word counts (FR-HR-3). */
  voiceTimeline?: VoiceTimeline | undefined;
  /** Asset key → URL: voice clips and the logo served by the API. */
  assetUrls?: Readonly<Record<string, string>>;
  /** Defaults to the renderer's rule: burned in for 9:16 and 1:1. */
  burnCaptions?: boolean | undefined;
}

/** The exact props the renderer passes to VideoComposition, built for the browser preview. */
export function previewVideoProps(options: PreviewPropsOptions): VideoProps {
  const { storyboard, ratio, voiceTimeline } = options;
  const timeline =
    voiceTimeline?.scenes.length === storyboard.scenes.length
      ? voiceTimeline
      : estimateTimeline({
          scenes: storyboard.scenes,
          transitionFrames: lookTokensById[storyboard.look].crossfadeFrames,
        });
  return {
    storyboard,
    voiceTimeline: timeline,
    ratio,
    music: { kind: "none" },
    assetUrls: { ...options.assetUrls },
    openOnThumbnail: false,
    burnCaptions: options.burnCaptions ?? (ratio === "9:16" || ratio === "1:1"),
  };
}
