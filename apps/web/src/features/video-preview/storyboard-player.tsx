"use client";

import {
  type AspectRatio,
  frameSizeByRatio,
  type Storyboard,
  totalVideoFrames,
  type VideoProps,
  type VoiceTimeline,
} from "@cutroom/scene-spec";
import { VideoComposition } from "@cutroom/video-kit";
import { Player, type PlayerRef } from "@remotion/player";
import type React from "react";
import { forwardRef, useMemo } from "react";
import { ensurePreviewFonts } from "./load-fonts";
import { previewVideoProps } from "./preview-props";

ensurePreviewFonts();

export interface StoryboardPlayerProps {
  storyboard: Storyboard;
  ratio: AspectRatio;
  /** Real voice timing when available; otherwise estimated from word counts (FR-HR-3). */
  voiceTimeline?: VoiceTimeline | undefined;
  assetUrls?: Readonly<Record<string, string>> | undefined;
  burnCaptions?: boolean | undefined;
  watermark?: boolean | undefined;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
}

/** A live preview of a storyboard: the same composition the renderer uses. */
export const StoryboardPlayer = forwardRef<PlayerRef, StoryboardPlayerProps>(
  function StoryboardPlayer(props, ref) {
    const { storyboard, ratio, voiceTimeline } = props;
    const inputProps = useMemo<VideoProps>(
      () =>
        previewVideoProps({
          storyboard,
          ratio,
          voiceTimeline,
          ...(props.assetUrls ? { assetUrls: props.assetUrls } : {}),
          burnCaptions: props.burnCaptions,
          watermark: props.watermark,
        }),
      [storyboard, ratio, voiceTimeline, props.assetUrls, props.burnCaptions, props.watermark],
    );
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
