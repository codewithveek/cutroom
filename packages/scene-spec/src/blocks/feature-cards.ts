import { z } from "zod";
import { iconIdSchema } from "./icons";
import { sceneBaseShape } from "./scene-base";

export const featureCardSchema = z.object({
  icon: iconIdSchema,
  /** Verb-led, e.g. "Track payouts". */
  title: z.string().min(1).max(32),
  line: z.string().min(1).max(70),
});

export const featureCardsPropsSchema = z.object({
  heading: z.string().max(50).optional(),
  cards: z.array(featureCardSchema).min(2).max(4),
});

export const featureCardsSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("feature-cards"),
  props: featureCardsPropsSchema,
});
export type FeatureCardsScene = z.infer<typeof featureCardsSceneSchema>;
