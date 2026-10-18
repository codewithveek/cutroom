import type { AssetRecord, RunRecord, StoryboardVersion } from "@cutroom/pipeline";
import { CODE_EMBEDDING_DIMENSIONS } from "@cutroom/providers";
import type { ClaimResult, ProductBrief, RunRequest } from "@cutroom/scene-spec";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

/** Dimensions of the code-chunk embeddings, shared with the embedding clients. */
export const EMBEDDING_DIMENSIONS = CODE_EMBEDDING_DIMENSIONS;

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();

/** One project per source (a repository path or URL; later a script). Runs hang off it (PRD §8.6). */
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sourceType: text("source_type", { enum: ["path", "git", "zip"] }).notNull(),
    sourceRef: text("source_ref").notNull(),
    brand: jsonb("brand").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("projects_source_idx").on(table.sourceType, table.sourceRef)],
);

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    presetId: text("preset_id"),
    videoType: text("video_type").notNull(),
    look: text("look"),
    lookReason: text("look_reason"),
    ratios: text("ratios").array().notNull(),
    privacyMode: text("privacy_mode", { enum: ["local", "hybrid", "cloud"] }).notNull(),
    status: text("status").$type<RunRecord["status"]>().notNull(),
    temporalWorkflowId: text("temporal_workflow_id"),
    /** The validated run request, as submitted (and as changed by settings until approval). */
    request: jsonb("request").$type<RunRequest>().notNull(),
    error: jsonb("error").$type<NonNullable<RunRecord["error"]>>(),
    snapshotDirectory: text("snapshot_directory"),
    capture: jsonb("capture").$type<NonNullable<RunRecord["capture"]>>(),
    approval: jsonb("approval").$type<NonNullable<RunRecord["approval"]>>(),
    egress: jsonb("egress").$type<NonNullable<RunRecord["egress"]>>(),
    voiceTimeline: jsonb("voice_timeline").$type<NonNullable<RunRecord["voiceTimeline"]>>(),
    providers: jsonb("providers").$type<RunRecord["providers"]>().notNull(),
    metrics: jsonb("metrics").$type<RunRecord["metrics"]>().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [index("runs_project_idx").on(table.projectId), index("runs_created_idx").on(table.createdAt)],
);

export const runEvents = pgTable(
  "run_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    kind: text("kind", { enum: ["started", "progress", "completed", "failed"] }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("run_events_run_idx").on(table.runId, table.id)],
);

export const productBriefs = pgTable("product_briefs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .unique()
    .references(() => runs.id, { onDelete: "cascade" }),
  brief: jsonb("brief").$type<ProductBrief>().notNull(),
  modelId: text("model_id"),
  usage: jsonb("usage").$type<Record<string, unknown>>(),
});

export const storyboardVersions = pgTable(
  "storyboard_versions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    storyboard: jsonb("storyboard").$type<StoryboardVersion["storyboard"]>().notNull(),
    author: text("author", { enum: ["agent", "user"] }).notNull(),
    audited: boolean("audited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [uniqueIndex("storyboard_versions_run_version_idx").on(table.runId, table.version)],
);

export const claimResults = pgTable(
  "claim_results",
  {
    id: text("id").primaryKey(),
    storyboardVersionId: text("storyboard_version_id")
      .notNull()
      .references(() => storyboardVersions.id, { onDelete: "cascade" }),
    /** Order within the version, so results read back in audit order. */
    position: integer("position").notNull(),
    claimId: text("claim_id").notNull(),
    sceneId: text("scene_id").notNull(),
    fieldPath: text("field_path").notNull(),
    claimText: text("claim_text").notNull(),
    verdict: text("verdict", { enum: ["supported", "weak", "unsupported"] }).notNull(),
    checks: jsonb("checks").$type<ClaimResult["checks"]>().notNull(),
    evidence: jsonb("evidence").$type<ClaimResult["evidence"]>().notNull(),
    suggestion: text("suggestion"),
    overrideReason: text("override_reason"),
  },
  (table) => [uniqueIndex("claim_results_version_claim_idx").on(table.storyboardVersionId, table.claimId)],
);

/** Synthesised narration, shared across runs by content (the voice cache key). */
export const voiceClips = pgTable("voice_clips", {
  cacheKey: text("cache_key").primaryKey(),
  provider: text("provider"),
  voiceId: text("voice_id"),
  audioPath: text("audio_path").notNull(),
  durationMs: doublePrecision("duration_ms").notNull(),
});

export const runVoiceClips = pgTable(
  "run_voice_clips",
  {
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key")
      .notNull()
      .references(() => voiceClips.cacheKey),
    position: integer("position").notNull(),
  },
  (table) => [uniqueIndex("run_voice_clips_idx").on(table.runId, table.cacheKey)],
);

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    kind: text("kind").$type<AssetRecord["kind"]>().notNull(),
    ratio: text("ratio"),
    version: integer("version").notNull(),
    storageKey: text("storage_key").notNull(),
    bytes: integer("bytes").notNull(),
    durationMs: integer("duration_ms"),
    position: integer("position").notNull(),
  },
  (table) => [index("assets_run_idx").on(table.runId)],
);

/** Code retrieval for the claim judge (FR-ING-6, P1). */
export const codeChunks = pgTable(
  "code_chunks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    lineStart: integer("line_start").notNull(),
    lineEnd: integer("line_end").notNull(),
    contentHash: text("content_hash").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (table) => [
    uniqueIndex("code_chunks_project_hash_idx").on(table.projectId, table.filePath, table.contentHash),
    index("code_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ],
);
