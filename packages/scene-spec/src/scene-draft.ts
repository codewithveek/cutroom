import { z } from "zod";
import { blocksAllowedInLook } from "./block-catalog";
import type { LookId } from "./primitives";
import { type BlockId, type Scene, sceneSchemaByBlock } from "./scene";

/**
 * What the model writes for one scene: the block, its props and narration.
 * Code assigns `id` and `baseFrames` afterwards, so the model never invents them.
 */
function draftSchemaForBlock(blockId: BlockId) {
  return sceneSchemaByBlock[blockId].omit({ id: true, baseFrames: true, transitionOrigin: true });
}

/** Omit that keeps a union discriminated. */
type DistributiveOmit<Value, Keys extends PropertyKey> = Value extends unknown ? Omit<Value, Keys> : never;

export type SceneDraft = DistributiveOmit<Scene, "id" | "baseFrames" | "transitionOrigin">;

export interface StoryboardDraft {
  title: string;
  scenes: SceneDraft[];
}

/**
 * Builds a storyboard-draft schema whose scenes may only use the blocks the look allows.
 * Narrowing the union shrinks the JSON Schema the model sees, which cuts invalid outputs.
 */
export function createStoryboardDraftSchema(look: LookId): z.ZodType<StoryboardDraft> {
  const [firstBlock, ...otherBlocks] = blocksAllowedInLook(look);
  if (!firstBlock) throw new Error(`Look ${look} allows no blocks`);
  const sceneDraftSchema = z.discriminatedUnion("block", [
    draftSchemaForBlock(firstBlock),
    ...otherBlocks.map(draftSchemaForBlock),
  ]);
  const draftSchema = z.object({
    title: z.string().min(1).max(80),
    scenes: z.array(sceneDraftSchema).min(3).max(16),
  });
  // The narrowed union's output is a subset of SceneDraft; TypeScript cannot see that through
  // the dynamic list of options, so the cast is confined to this one place.
  return draftSchema as unknown as z.ZodType<StoryboardDraft>;
}
