CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"kind" text NOT NULL,
	"ratio" text,
	"version" integer NOT NULL,
	"storage_key" text NOT NULL,
	"bytes" integer NOT NULL,
	"duration_ms" integer,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_results" (
	"id" text PRIMARY KEY NOT NULL,
	"storyboard_version_id" text NOT NULL,
	"position" integer NOT NULL,
	"claim_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"field_path" text NOT NULL,
	"claim_text" text NOT NULL,
	"verdict" text NOT NULL,
	"checks" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"suggestion" text,
	"override_reason" text
);
--> statement-breakpoint
CREATE TABLE "code_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"file_path" text NOT NULL,
	"line_start" integer NOT NULL,
	"line_end" integer NOT NULL,
	"content_hash" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"brief" jsonb NOT NULL,
	"model_id" text,
	"usage" jsonb,
	CONSTRAINT "product_briefs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text NOT NULL,
	"brand" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"step" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_voice_clips" (
	"run_id" text NOT NULL,
	"cache_key" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"preset_id" text,
	"video_type" text NOT NULL,
	"look" text,
	"look_reason" text,
	"ratios" text[] NOT NULL,
	"privacy_mode" text NOT NULL,
	"status" text NOT NULL,
	"temporal_workflow_id" text,
	"request" jsonb NOT NULL,
	"error" jsonb,
	"snapshot_directory" text,
	"approval" jsonb,
	"egress" jsonb,
	"voice_timeline" jsonb,
	"providers" jsonb NOT NULL,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storyboard_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"version" integer NOT NULL,
	"storyboard" jsonb NOT NULL,
	"author" text NOT NULL,
	"audited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_clips" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"provider" text,
	"voice_id" text,
	"audio_path" text NOT NULL,
	"duration_ms" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_results" ADD CONSTRAINT "claim_results_storyboard_version_id_storyboard_versions_id_fk" FOREIGN KEY ("storyboard_version_id") REFERENCES "public"."storyboard_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_briefs" ADD CONSTRAINT "product_briefs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_voice_clips" ADD CONSTRAINT "run_voice_clips_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_voice_clips" ADD CONSTRAINT "run_voice_clips_cache_key_voice_clips_cache_key_fk" FOREIGN KEY ("cache_key") REFERENCES "public"."voice_clips"("cache_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboard_versions" ADD CONSTRAINT "storyboard_versions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_run_idx" ON "assets" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_results_version_claim_idx" ON "claim_results" USING btree ("storyboard_version_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "code_chunks_project_hash_idx" ON "code_chunks" USING btree ("project_id","file_path","content_hash");--> statement-breakpoint
CREATE INDEX "code_chunks_embedding_idx" ON "code_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "projects_source_idx" ON "projects" USING btree ("source_type","source_ref");--> statement-breakpoint
CREATE INDEX "run_events_run_idx" ON "run_events" USING btree ("run_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_voice_clips_idx" ON "run_voice_clips" USING btree ("run_id","cache_key");--> statement-breakpoint
CREATE INDEX "runs_project_idx" ON "runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "runs_created_idx" ON "runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "storyboard_versions_run_version_idx" ON "storyboard_versions" USING btree ("run_id","version");