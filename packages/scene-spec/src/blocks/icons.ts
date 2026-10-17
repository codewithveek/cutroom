import { z } from "zod";

/** A fixed icon vocabulary drawn by video-kit; the model picks, never draws. */
export const iconIdSchema = z.enum([
  "bolt",
  "shield",
  "code",
  "chart",
  "globe",
  "clock",
  "sparkle",
  "check",
  "terminal",
  "layers",
  "lock",
  "users",
  "search",
  "rocket",
  "plug",
  "eye",
]);
export type IconId = z.infer<typeof iconIdSchema>;
