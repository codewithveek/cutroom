import {
  FRAMES_PER_SECOND,
  frameSizeByRatio,
  type ThumbnailProps,
  thumbnailPropsSchema,
  totalVideoFrames,
  type VideoProps,
  videoPropsSchema,
} from "@cutroom/scene-spec";
import { THUMBNAIL_FRAMES } from "./thumbnail-frame";

export const compositionIds = {
  video: "cutroom-video",
  thumbnail: "cutroom-thumbnail",
} as const;

export interface CompositionMetadata<Props> {
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
  props: Props;
}

/** Dimensions and duration come from input props: ratio and the voice timeline (PRD §7.6). */
export function calculateVideoMetadata(rawProps: unknown): CompositionMetadata<VideoProps> {
  const props = videoPropsSchema.parse(rawProps);
  const size = frameSizeByRatio[props.ratio];
  return {
    ...size,
    fps: FRAMES_PER_SECOND,
    durationInFrames: totalVideoFrames(props.voiceTimeline, props.openOnThumbnail),
    props,
  };
}

export function calculateThumbnailMetadata(rawProps: unknown): CompositionMetadata<ThumbnailProps> {
  const props = thumbnailPropsSchema.parse(rawProps);
  return {
    ...frameSizeByRatio[props.ratio],
    fps: FRAMES_PER_SECOND,
    durationInFrames: THUMBNAIL_FRAMES,
    props,
  };
}
