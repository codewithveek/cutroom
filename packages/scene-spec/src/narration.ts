import { z } from "zod";

export const narrationLineSchema = z.object({
  /** Shown in captions. */
  text: z.string().min(1),
  /** Respelt for TTS (product names, acronyms, numbers). Identifiers are shown, never spoken. */
  say: z.string().min(1).optional(),
  /** Scene-relative frame to start this line at; otherwise it follows the previous line. */
  atFrame: z.number().int().nonnegative().optional(),
});
export type NarrationLine = z.infer<typeof narrationLineSchema>;
