"use client";

import {
  type AspectRatio,
  estimateTimeline,
  frameSizeByRatio,
  type Storyboard,
  totalVideoFrames,
  type VideoProps,
  type VoiceTimeline,
} from "@cutroom/scene-spec";
import { lookTokensById, VideoComposition } from "@cutroom/video-kit";
import { Player, type PlayerRef } from "@remotion/player";
import type React from "react";
import { forwardRef, useMemo } from "react";
import { ensurePreviewFonts } from "./load-fonts";

ensurePreviewFonts();

export interface StoryboardPlayerProps {
  storyboard: Storyboard;
  ratio: AspectRatio;
  /** Real voice timing when available; otherwise estimated from word counts (FR-HR-3). */
  voiceTimeline?: VoiceTimeline | undefined;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
}

/** A live preview of a storyboard: the same composition the renderer uses. */
export const StoryboardPlayer = forwardRef<PlayerRef, StoryboardPlayerProps>(
  function StoryboardPlayer(props, ref) {
    const { storyboard, ratio, voiceTimeline } = props;
    const inputProps = useMemo<VideoProps>(() => {
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
        assetUrls: {},
        openOnThumbnail: false,
        burnCaptions: ratio === "9:16" || ratio === "1:1",
      };
    }, [storyboard, ratio, voiceTimeline]);
    const size = frameSizeByRatio[ratio];
    return (
      <Player
        ref={ref}
        component={VideoComposition as React.ComponentType<Record<string, unknown>>}
        inputProps={inputProps as unknown as Record<string, unknown>}
        durationInFrames={totalVideoFrames(inputProps.voiceTimeline, false)}
        fps={inputProps.voiceTimeline.fps}
        compositionWidth={size.width}
        compositionHeight={size.height}
        controls={props.controls ?? true}
        autoPlay={props.autoPlay ?? false}
        loop={props.loop ?? false}
        acknowledgeRemotionLicense
        {...(props.className ? { className: props.className } : {})}
        style={{
          width: "100%",
          aspectRatio: `${size.width} / ${size.height}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      />
    );
  },
);
