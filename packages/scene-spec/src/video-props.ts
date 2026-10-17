import { z } from "zod";
import { musicSelectionSchema } from "./music";
import { aspectRatioSchema } from "./primitives";
import { storyboardSchema } from "./storyboard";
import { voiceTimelineSchema } from "./voice-timeline";

/** Input props of the main composition: everything a render needs, nothing else. */
export const videoPropsSchema = z.object({
  storyboard: storyboardSchema,
  voiceTimeline: voiceTimelineSchema,
  ratio: aspectRatioSchema,
  music: musicSelectionSchema,
  /** assetKey → URL the renderer can load (staticFile path or http URL). */
  assetUrls: z.record(z.string(), z.string()).default({}),
  /** 16:9 videos open on the thumbnail because feeds preview the first frame (FR-RD-4). */
  openOnThumbnail: z.boolean().default(false),
  burnCaptions: z.boolean().default(false),
});
export type VideoProps = z.infer<typeof videoPropsSchema>;
export type VideoPropsInput = z.input<typeof videoPropsSchema>;

export const thumbnailPropsSchema = z.object({
  storyboard: storyboardSchema,
  ratio: aspectRatioSchema,
  /** Two lines, ≤ 5 words in total; the second line takes the accent. */
  titleLines: z.tuple([z.string().min(1), z.string().min(1)]),
  assetUrls: z.record(z.string(), z.string()).default({}),
});
export type ThumbnailProps = z.infer<typeof thumbnailPropsSchema>;
