import {
  aspectRatioSchema,
  captureManifestSchema,
  claimResultSchema,
  lookIdSchema,
  productBriefSchema,
  runApprovalSchema,
  runEgressSchema,
  runErrorSchema,
  runProvidersSchema,
  runRequestSchema,
  runStatusSchema,
  stepMetricSchema,
  storyboardSchema,
  voiceTimelineSchema,
} from "@cutroom/scene-spec";
import { z } from "zod";

export {
  type PipelineStep,
  pipelineStepSchema,
  type RunEvent,
  type RunRequest,
  type RunRequestInput,
  type RunStatus,
  runEventSchema,
  runRequestSchema,
  runStatusSchema,
  type StepMetric,
  stepMetricSchema,
} from "@cutroom/scene-spec";

export const storyboardVersionSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  storyboard: storyboardSchema,
  author: z.enum(["agent", "user"]),
  createdAt: z.string(),
  claimResults: z.array(claimResultSchema).default([]),
  audited: z.boolean().default(false),
});
export type StoryboardVersion = z.infer<typeof storyboardVersionSchema>;

export const assetRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["video", "captions", "thumbnail", "still", "audio-report", "delivery-note"]),
  ratio: aspectRatioSchema.optional(),
  version: z.number().int().positive(),
  filePath: z.string(),
  bytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type AssetRecord = z.infer<typeof assetRecordSchema>;

export const runRecordSchema = z.object({
  id: z.string(),
  request: runRequestSchema,
  status: runStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  error: runErrorSchema.optional(),
  look: lookIdSchema.optional(),
  lookReason: z.string().optional(),
  snapshotDirectory: z.string().optional(),
  /** Screens captured from the running app (FR-CAP-1); the PNGs live in the run's capture folder. */
  capture: captureManifestSchema.optional(),
  brief: productBriefSchema.optional(),
  storyboardVersions: z.array(storyboardVersionSchema).default([]),
  approval: runApprovalSchema.optional(),
  egress: runEgressSchema.optional(),
  voiceTimeline: voiceTimelineSchema.optional(),
  voiceClips: z
    .array(z.object({ assetKey: z.string(), filePath: z.string(), durationMs: z.number() }))
    .default([]),
  assets: z.array(assetRecordSchema).default([]),
  providers: runProvidersSchema.default({}),
  metrics: z.array(stepMetricSchema).default([]),
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export function latestStoryboardVersion(run: RunRecord): StoryboardVersion | undefined {
  return run.storyboardVersions.at(-1);
}
