import { presetIdSchema } from "@cutroom/presets";
import { repoSourceSchema } from "@cutroom/repo-ingest";
import {
  aspectRatioSchema,
  brandSchema,
  claimOverrideSchema,
  claimResultSchema,
  lookIdSchema,
  musicSelectionSchema,
  privacyModeSchema,
  productBriefSchema,
  storyboardSchema,
  videoTypeSchema,
  voiceSelectionSchema,
  voiceTimelineSchema,
} from "@cutroom/scene-spec";
import { z } from "zod";

export const runRequestSchema = z.object({
  source: repoSourceSchema,
  presetId: presetIdSchema.optional(),
  videoType: videoTypeSchema,
  /** Omitted → recommendLook picks one from the repo's signals. */
  look: lookIdSchema.optional(),
  ratios: z.array(aspectRatioSchema).min(1),
  targetSeconds: z.number().int().min(10).max(120),
  voice: voiceSelectionSchema,
  music: musicSelectionSchema,
  privacyMode: privacyModeSchema,
  /** Skip the review pause, but only when no claim is unsupported (FR-HR-1). */
  autoApprove: z.boolean().default(false),
  brandOverride: brandSchema.partial().optional(),
  seed: z.number().int().nonnegative().default(1),
});
export type RunRequest = z.infer<typeof runRequestSchema>;
export type RunRequestInput = z.input<typeof runRequestSchema>;

export const runStatusSchema = z.enum([
  "queued",
  "ingesting",
  "analyzing",
  "planning",
  "auditing",
  "awaiting_review",
  "voicing",
  "rendering",
  "finalizing",
  "completed",
  "failed",
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const pipelineStepSchema = z.enum([
  "ingest-repository",
  "analyze-product",
  "plan-storyboard",
  "audit-claims",
  "review",
  "synthesize-voice",
  "render",
  "finalize-deliverables",
]);
export type PipelineStep = z.infer<typeof pipelineStepSchema>;

export const runEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  step: pipelineStepSchema,
  kind: z.enum(["started", "progress", "completed", "failed"]),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});
export type RunEvent = z.infer<typeof runEventSchema>;

export const tokenUsageSchema = z.object({ inputTokens: z.number(), outputTokens: z.number() });

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

export const stepMetricSchema = z.object({
  step: pipelineStepSchema,
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  durationMs: z.number().optional(),
  usage: tokenUsageSchema.optional(),
  attempts: z.number().int().optional(),
  modelId: z.string().optional(),
});
export type StepMetric = z.infer<typeof stepMetricSchema>;

export const runRecordSchema = z.object({
  id: z.string(),
  request: runRequestSchema,
  status: runStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }).optional(),
  look: lookIdSchema.optional(),
  lookReason: z.string().optional(),
  snapshotDirectory: z.string().optional(),
  brief: productBriefSchema.optional(),
  storyboardVersions: z.array(storyboardVersionSchema).default([]),
  approval: z
    .object({
      versionId: z.string(),
      overrides: z.array(claimOverrideSchema),
      approvedAt: z.string(),
      auto: z.boolean(),
    })
    .optional(),
  voiceTimeline: voiceTimelineSchema.optional(),
  voiceClips: z
    .array(z.object({ assetKey: z.string(), filePath: z.string(), durationMs: z.number() }))
    .default([]),
  assets: z.array(assetRecordSchema).default([]),
  providers: z
    .object({
      modelProvider: z.string().optional(),
      modelId: z.string().optional(),
      voiceProvider: z.string().optional(),
      isAiVoice: z.boolean().optional(),
      voiceLicence: z.string().optional(),
    })
    .default({}),
  metrics: z.array(stepMetricSchema).default([]),
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export function latestStoryboardVersion(run: RunRecord): StoryboardVersion | undefined {
  return run.storyboardVersions.at(-1);
}
