import { z } from "zod";
import { blocksAllowedInLook } from "./block-catalog";
import { screenshotWindowPropsSchema } from "./blocks/screenshot-window";
import type { LookId } from "./primitives";
import { type BlockId, type Scene, sceneSchemaByBlock } from "./scene";

/**
 * What the model writes for one scene: the block, its props and narration.
 * Code assigns `id` and `baseFrames` afterwards, so the model never invents them.
 */
function draftSchemaForBlock(blockId: BlockId, beats?: ReadonlyArray<string>) {
  const omitted = sceneSchemaByBlock[blockId].omit({ id: true, baseFrames: true, transitionOrigin: true });
  // The screenshot's size and element box come from the capture manifest, never from the model.
  const draft =
    blockId === "screenshot-window"
      ? omitted.extend({ props: screenshotWindowPropsSchema.omit({ view: true }) })
      : omitted;
  const [firstBeat, ...otherBeats] = beats ?? [];
  // Small models skip optional fields; a required enum makes structured output fill the beat.
  return firstBeat ? draft.extend({ beat: z.enum([firstBeat, ...otherBeats]) }) : draft;
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
export function createStoryboardDraftSchema(options: {
  look: LookId;
  beats?: ReadonlyArray<string> | undefined;
  /** Blocks to leave out, e.g. screenshot-window when nothing was captured. */
  excludeBlocks?: ReadonlyArray<BlockId> | undefined;
}): z.ZodType<StoryboardDraft> {
  const { beats } = options;
  const excluded = new Set(options.excludeBlocks ?? []);
  const [firstBlock, ...otherBlocks] = blocksAllowedInLook(options.look).filter(
    (block) => !excluded.has(block),
  );
  if (!firstBlock) throw new Error(`Look ${options.look} allows no blocks`);
  const sceneDraftSchema = z.discriminatedUnion("block", [
    draftSchemaForBlock(firstBlock, beats),
    ...otherBlocks.map((block) => draftSchemaForBlock(block, beats)),
  ]);
  const draftSchema = z.object({
    title: z.string().min(1).max(80),
    scenes: z.array(sceneDraftSchema).min(3).max(16),
  });
  // The narrowed union's output is a subset of SceneDraft; TypeScript cannot see that through
  // the dynamic list of options, so the cast is confined to this one place.
  return draftSchema as unknown as z.ZodType<StoryboardDraft>;
}

/** One scene's draft schema, limited to the given blocks (FR-SB-7: regenerate one scene). */
export function createSceneDraftSchema(blocks: ReadonlyArray<BlockId>): z.ZodType<{ scene: SceneDraft }> {
  const [firstBlock, ...otherBlocks] = blocks;
  if (!firstBlock) throw new Error("At least one block is required");
  const sceneDraftSchema = z.discriminatedUnion("block", [
    draftSchemaForBlock(firstBlock),
    ...otherBlocks.map((block) => draftSchemaForBlock(block)),
  ]);
  // Same narrowing caveat as createStoryboardDraftSchema.
  return z.object({ scene: sceneDraftSchema }) as unknown as z.ZodType<{ scene: SceneDraft }>;
}
