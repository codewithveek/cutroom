import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

export const titleCardPropsSchema = z.object({
  variant: z.enum(["title", "introducing"]),
  name: z.string().min(1).max(40),
  tagline: z.string().max(80),
});

export const titleCardSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("title-card"),
  props: titleCardPropsSchema,
});
export type TitleCardScene = z.infer<typeof titleCardSceneSchema>;
