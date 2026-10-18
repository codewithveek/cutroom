import { z } from "zod";
import { musicSelectionSchema } from "./music";
import { aspectRatioSchema } from "./primitives";
import { storyboardSchema } from "./storyboard";
import { voiceTimelineSchema } from "./voice-timeline";

export const renderAssetKindSchema = z.enum(["voice-clip", "logo", "screenshot", "music", "font"]);

export const renderAssetSchema = z.object({
  assetKey: z.string().min(1),
  kind: renderAssetKindSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().positive(),
});
export type RenderAsset = z.infer<typeof renderAssetSchema>;

/** The only contract between the analysis half and the render half (Hybrid mode uploads exactly this). */
export const renderJobSchema = z.object({
  jobId: z.string().min(1),
  storyboard: storyboardSchema,
  voiceTimeline: voiceTimelineSchema,
  ratios: z.array(aspectRatioSchema).min(1),
  music: musicSelectionSchema,
  watermark: z.boolean().default(false),
  assets: z.array(renderAssetSchema),
  manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type RenderJob = z.infer<typeof renderJobSchema>;

export const egressManifestSchema = z.object({
  files: z.array(
    z.object({ path: z.string().min(1), kind: z.string().min(1), bytes: z.number().int().nonnegative() }),
  ),
  codeExcerpts: z.array(
    z.object({
      sceneId: z.string().min(1),
      filePath: z.string().min(1),
      lineStart: z.number().int().positive(),
      lineEnd: z.number().int().positive(),
    }),
  ),
});
export type EgressManifest = z.infer<typeof egressManifestSchema>;
