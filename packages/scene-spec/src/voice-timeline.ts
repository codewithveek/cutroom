import { z } from "zod";

export const voiceLineTimingSchema = z.object({
  lineIndex: z.number().int().nonnegative(),
  text: z.string(),
  /** Scene-relative start frame. */
  fromFrame: z.number().int().nonnegative(),
  frames: z.number().int().positive(),
  audioAssetKey: z.string().min(1).optional(),
});
export type VoiceLineTiming = z.infer<typeof voiceLineTimingSchema>;

export const sceneTimingSchema = z.object({
  sceneId: z.string().min(1),
  /** Global start frame (scenes overlap by the transition length). */
  fromFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  /** Length of the transition into this scene (0 for the first scene). */
  transitionInFrames: z.number().int().nonnegative(),
  lines: z.array(voiceLineTimingSchema),
});
export type SceneTiming = z.infer<typeof sceneTimingSchema>;

export const voiceTimelineSchema = z.object({
  fps: z.number().int().positive(),
  /** `estimate` before synthesis (preview), `voice` after. */
  source: z.enum(["estimate", "voice"]),
  scenes: z.array(sceneTimingSchema),
  totalFrames: z.number().int().positive(),
});
export type VoiceTimeline = z.infer<typeof voiceTimelineSchema>;
