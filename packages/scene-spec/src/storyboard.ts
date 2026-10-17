import { z } from "zod";
import { brandSchema } from "./brand";
import { lookIdSchema, videoTypeSchema } from "./primitives";
import { sceneSchema } from "./scene";

export const storyboardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  videoType: videoTypeSchema,
  look: lookIdSchema,
  brand: brandSchema,
  /** Seeds every random choice in the render (P6). */
  seed: z.number().int().nonnegative().default(1),
  scenes: z.array(sceneSchema).min(3).max(16),
});
export type Storyboard = z.infer<typeof storyboardSchema>;
export type StoryboardInput = z.input<typeof storyboardSchema>;
