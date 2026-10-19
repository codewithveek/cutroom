import { z } from "zod";
import { musicSelectionSchema } from "./music";
import { privacyModeSchema } from "./primitives";
import { voiceProviderIdSchema, voiceSelectionSchema } from "./voice-selection";

/** A voice the user can pick and preview. Descriptions are facts from the model card, not marketing. */
export const voiceOptionSchema = z.object({
  id: z.string().min(1),
  provider: voiceProviderIdSchema,
  name: z.string().min(1),
  accent: z.enum(["American", "British"]),
  gender: z.enum(["female", "male"]),
  /** The model card's overall grade (A…F). */
  grade: z.string().min(1),
});
export type VoiceOption = z.infer<typeof voiceOptionSchema>;

export const systemCheckIdSchema = z.enum(["model", "voice", "ffmpeg", "render-host"]);
export type SystemCheckId = z.infer<typeof systemCheckIdSchema>;

export const systemCheckSchema = z.object({
  id: systemCheckIdSchema,
  label: z.string(),
  /** `optional`: not needed for Local mode (the Hybrid render host). */
  state: z.enum(["ready", "missing", "optional"]),
  detail: z.string(),
  /** A command or setting that fixes a missing check. */
  fix: z.string().optional(),
});
export type SystemCheck = z.infer<typeof systemCheckSchema>;

/** The public demo's answer to every write (prd-site D-3), from the API and from the web app. */
export const DEMO_READ_ONLY_MESSAGE = "This is a read-only demo. Run Cutroom locally to use your own code.";

/** What this installation can do right now: the dashboard's setup strip and the settings page. */
export const systemStatusSchema = z.object({
  model: z.object({
    provider: z.enum(["ollama", "scripted"]),
    modelId: z.string(),
    installedModels: z.array(z.string()),
  }),
  checks: z.array(systemCheckSchema),
  defaultPrivacyMode: privacyModeSchema,
  /** The shipnote fixture, when this installation has it (the scripted model knows it). */
  demoRepositoryPath: z.string().optional(),
  /** The public read-only showcase (CUTROOM_DEMO_MODE): the web app shows a banner and disables writes. */
  demoMode: z.boolean().default(false),
});
export type SystemStatus = z.infer<typeof systemStatusSchema>;

/** Run settings that may change until the storyboard is approved. */
export const runSettingsUpdateSchema = z
  .object({ voice: voiceSelectionSchema.optional(), music: musicSelectionSchema.optional() })
  .refine((update) => update.voice !== undefined || update.music !== undefined, {
    message: "Change the voice, the music or both",
  });
export type RunSettingsUpdate = z.infer<typeof runSettingsUpdateSchema>;

/** GET /health: liveness for the platform, plus what a fresh deploy still needs (E4-2). */
export const healthSchema = z.object({
  /** `degraded` when the model, voice or ffmpeg is not ready yet; the API still answers. */
  status: z.enum(["ok", "degraded", "down"]),
  runner: z.enum(["in-process", "temporal"]),
  database: z.enum(["ready", "down", "not-used"]),
  checks: z.array(systemCheckSchema.pick({ id: true, state: true, detail: true })),
});
export type Health = z.infer<typeof healthSchema>;
