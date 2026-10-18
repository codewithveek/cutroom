import { z } from "zod";
import { countWords } from "./count-words";

export const narrationLineSchema = z.object({
  /** Shown in captions. */
  text: z.string().min(1),
  /** Respelt for TTS (product names, acronyms, numbers). Identifiers are shown, never spoken. */
  say: z.string().min(1).optional(),
  /** Scene-relative frame to start this line at; otherwise it follows the previous line. */
  atFrame: z.number().int().nonnegative().optional(),
});
export type NarrationLine = z.infer<typeof narrationLineSchema>;

/**
 * A `say` is the whole line respelt for the voice, so it reads about as long as the caption.
 * Anything much shorter (a model once wrote the literal word "spoken" on every line) is ignored.
 */
export function isPlausibleSpokenForm(line: Pick<NarrationLine, "text" | "say">): boolean {
  if (!line.say) return false;
  return countWords(line.say) >= Math.ceil(countWords(line.text) / 2);
}

/** What the voice reads: the respelling when it is a real one, otherwise the caption text. */
export function spokenText(line: Pick<NarrationLine, "text" | "say">): string {
  return line.say && isPlausibleSpokenForm(line) ? line.say : line.text;
}
