import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

export const kineticHeadlinePropsSchema = z.object({
  /** 1–3 lines. Wrap one phrase per line in *stars* to colour it. */
  lines: z.array(z.string().min(1).max(60)).min(1).max(3),
  /** problem → starred phrases take the alarm colour; promise → the accent. Never both. */
  tone: z.enum(["neutral", "problem", "promise"]),
});

export const kineticHeadlineSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("kinetic-headline"),
  props: kineticHeadlinePropsSchema,
});
export type KineticHeadlineScene = z.infer<typeof kineticHeadlineSceneSchema>;
