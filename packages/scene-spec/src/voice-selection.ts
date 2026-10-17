import { z } from "zod";

export const voiceProviderIdSchema = z.enum(["kokoro", "elevenlabs", "none"]);
export type VoiceProviderId = z.infer<typeof voiceProviderIdSchema>;

export const voiceSelectionSchema = z.object({
  provider: voiceProviderIdSchema,
  voiceId: z.string().min(1),
  speed: z.number().min(0.5).max(2).default(1),
});
export type VoiceSelection = z.infer<typeof voiceSelectionSchema>;
