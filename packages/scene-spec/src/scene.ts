import { z } from "zod";
import { bigNumberSceneSchema } from "./blocks/big-number";
import { codeCardSceneSchema } from "./blocks/code-card";
import { endCardSceneSchema } from "./blocks/end-card";
import { featureCardsSceneSchema } from "./blocks/feature-cards";
import { kineticHeadlineSceneSchema } from "./blocks/kinetic-headline";
import { terminalSceneSchema } from "./blocks/terminal";
import { titleCardSceneSchema } from "./blocks/title-card";
import { wordSlotSceneSchema } from "./blocks/word-slot";

export const sceneSchemaByBlock = {
  "title-card": titleCardSceneSchema,
  "kinetic-headline": kineticHeadlineSceneSchema,
  "big-number": bigNumberSceneSchema,
  "feature-cards": featureCardsSceneSchema,
  "code-card": codeCardSceneSchema,
  terminal: terminalSceneSchema,
  "word-slot": wordSlotSceneSchema,
  "end-card": endCardSceneSchema,
} as const;

export type BlockId = keyof typeof sceneSchemaByBlock;

export const blockIdSchema = z.enum([
  "title-card",
  "kinetic-headline",
  "big-number",
  "feature-cards",
  "code-card",
  "terminal",
  "word-slot",
  "end-card",
]);

export const sceneSchema = z.discriminatedUnion("block", [
  titleCardSceneSchema,
  kineticHeadlineSceneSchema,
  bigNumberSceneSchema,
  featureCardsSceneSchema,
  codeCardSceneSchema,
  terminalSceneSchema,
  wordSlotSceneSchema,
  endCardSceneSchema,
]);

export type Scene = z.infer<typeof sceneSchema>;
export type SceneInput = z.input<typeof sceneSchema>;
export type SceneOfBlock<Block extends BlockId> = Extract<Scene, { block: Block }>;
export type PropsOfBlock<Block extends BlockId> = SceneOfBlock<Block>["props"];
