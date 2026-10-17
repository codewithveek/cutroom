import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

export const wordSlotPropsSchema = z.object({
  /** Fixed words before the slot, e.g. "Built for". */
  lead: z.string().min(1).max(30),
  items: z.array(z.string().min(1).max(28)).min(2).max(6),
});

export const wordSlotSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("word-slot"),
  props: wordSlotPropsSchema,
});
export type WordSlotScene = z.infer<typeof wordSlotSceneSchema>;
