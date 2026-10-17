import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

export const endCardPropsSchema = z.object({
  /** Verbs shown as beats before the mark, e.g. ["Read.", "Write.", "Ship."]. */
  verbs: z.array(z.string().min(1).max(16)).max(4).default([]),
  name: z.string().min(1).max(40),
  tagline: z.string().max(80),
  cta: z.string().min(1).max(32),
  url: z.string().max(80).optional(),
});

export const endCardSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("end-card"),
  props: endCardPropsSchema,
});
export type EndCardScene = z.infer<typeof endCardSceneSchema>;
