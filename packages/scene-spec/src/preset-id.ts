import { z } from "zod";

export const presetIdSchema = z.enum([
  "launch-editorial",
  "feature-drop-editorial",
  "api-launch-graphic",
  "tutorial-studio",
  "teaser-cinematic",
  "explainer-editorial",
  "social-cutdown-vertical",
]);
export type PresetId = z.infer<typeof presetIdSchema>;
