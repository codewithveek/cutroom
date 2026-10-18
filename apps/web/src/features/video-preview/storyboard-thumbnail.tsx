"use client";

import { type AspectRatio, frameSizeByRatio, type Storyboard, totalVideoFrames } from "@cutroom/scene-spec";
import { VideoComposition } from "@cutroom/video-kit";
import { Thumbnail } from "@remotion/player";
import type React from "react";
import { useMemo } from "react";
import { ensurePreviewFonts } from "./load-fonts";
import { previewVideoProps } from "./preview-props";

ensurePreviewFonts();

export interface StoryboardThumbnailProps {
  storyboard: Storyboard;
  ratio?: AspectRatio;
  /** Frame to show; defaults to a resolved moment of the first scene. */
  frame?: number;
  className?: string;
}

/** One frame of a storyboard, rendered live by the same composition the renderer uses. */
export function StoryboardThumbnail(props: StoryboardThumbnailProps): React.ReactElement {
  const ratio = props.ratio ?? "16:9";
  const inputProps = useMemo(
    () => previewVideoProps({ storyboard: props.storyboard, ratio, burnCaptions: false }),
    [props.storyboard, ratio],
  );
  const size = frameSizeByRatio[ratio];
  const durationInFrames = totalVideoFrames(inputProps.voiceTimeline, false);
  return (
    <Thumbnail
      component={VideoComposition as React.ComponentType<Record<string, unknown>>}
      inputProps={inputProps as unknown as Record<string, unknown>}
      compositionWidth={size.width}
      compositionHeight={size.height}
      durationInFrames={durationInFrames}
      fps={inputProps.voiceTimeline.fps}
      frameToDisplay={Math.min(props.frame ?? 50, durationInFrames - 1)}
      {...(props.className ? { className: props.className } : {})}
      style={{ width: "100%", aspectRatio: `${size.width} / ${size.height}` }}
    />
  );
}
