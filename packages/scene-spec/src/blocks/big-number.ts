import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

export const bigNumberPropsSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.number(),
  format: z.enum(["integer", "percent", "currency"]),
  /** *starred* phrase takes the accent. */
  line: z.string().max(60),
  limitState: z.boolean().default(false),
});

export const bigNumberSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("big-number"),
  props: bigNumberPropsSchema,
});
export type BigNumberScene = z.infer<typeof bigNumberSceneSchema>;
