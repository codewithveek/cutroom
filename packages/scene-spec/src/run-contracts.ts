import { z } from "zod";
import { brandSchema } from "./brand";
import { claimOverrideSchema, claimResultSchema } from "./claims";
import { musicSelectionSchema } from "./music";
import { presetIdSchema } from "./preset-id";
import { aspectRatioSchema, lookIdSchema, privacyModeSchema, videoTypeSchema } from "./primitives";
import { productBriefSchema } from "./product-brief";
import { repoSourceSchema } from "./repo-source";
import { storyboardSchema } from "./storyboard";
import { voiceSelectionSchema } from "./voice-selection";
import { voiceTimelineSchema } from "./voice-timeline";

/** What a caller asks for: POST /runs, `cutroom make`. */
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

export const runErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const runApprovalSchema = z.object({
  versionId: z.string(),
  overrides: z.array(claimOverrideSchema),
  approvedAt: z.string(),
  auto: z.boolean(),
});

export const runProvidersSchema = z.object({
  modelProvider: z.string().optional(),
  modelId: z.string().optional(),
  voiceProvider: z.string().optional(),
  isAiVoice: z.boolean().optional(),
  voiceLicence: z.string().optional(),
});

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

export const assetKindSchema = z.enum([
  "video",
  "captions",
  "thumbnail",
  "still",
  "audio-report",
  "delivery-note",
]);

/** A run as the browser sees it: asset URLs, never file paths (GET /runs/:runId). */
export const runViewSchema = z.object({
  id: z.string(),
  status: runStatusSchema,
  request: runRequestSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  error: runErrorSchema.optional(),
  look: lookIdSchema.optional(),
  lookReason: z.string().optional(),
  brief: productBriefSchema.optional(),
  storyboard: z
    .object({
      versionId: z.string(),
      version: z.number().int().positive(),
      author: z.enum(["agent", "user"]),
      storyboard: storyboardSchema,
      claimResults: z.array(claimResultSchema),
      unsupportedCount: z.number().int().nonnegative(),
    })
    .optional(),
  versions: z.array(
    z.object({
      id: z.string(),
      version: z.number(),
      author: z.enum(["agent", "user"]),
      createdAt: z.string(),
    }),
  ),
  approval: runApprovalSchema.optional(),
  voiceTimeline: voiceTimelineSchema.optional(),
  providers: runProvidersSchema,
  metrics: z.array(stepMetricSchema),
  assets: z.array(
    z.object({
      id: z.string(),
      kind: assetKindSchema,
      ratio: aspectRatioSchema.optional(),
      version: z.number().int().positive(),
      bytes: z.number().int().nonnegative(),
      durationMs: z.number().int().nonnegative().optional(),
      fileName: z.string(),
      url: z.string(),
    }),
  ),
});
export type RunView = z.infer<typeof runViewSchema>;

export const approveRequestSchema = z.object({
  versionId: z.string().min(1),
  overrides: z.array(claimOverrideSchema).default([]),
});
export type ApproveRequest = z.input<typeof approveRequestSchema>;

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
