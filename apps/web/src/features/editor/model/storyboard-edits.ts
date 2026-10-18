import type { BlockId, LookId, NarrationLine, Scene, Storyboard, TransitionId } from "@cutroom/scene-spec";
import { fixtureStoryboard } from "@cutroom/video-kit";
import { ulid } from "ulid";
import { moveItem } from "@/features/storyboard/edit-paths";

export const MIN_SCENES = 3;
export const MAX_SCENES = 16;

export class StoryboardEditError extends Error {
  override readonly name = "StoryboardEditError";
}

function replaceScene(storyboard: Storyboard, sceneId: string, update: (scene: Scene) => Scene): Storyboard {
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => (scene.id === sceneId ? update(scene) : scene)),
  };
}

function insertAfter(options: {
  storyboard: Storyboard;
  afterSceneId: string | undefined;
  scene: Scene;
}): Storyboard {
  if (options.storyboard.scenes.length >= MAX_SCENES)
    throw new StoryboardEditError(`A storyboard holds at most ${MAX_SCENES} scenes.`);
  const index = options.storyboard.scenes.findIndex((scene) => scene.id === options.afterSceneId);
  const scenes = [...options.storyboard.scenes];
  scenes.splice(index === -1 ? scenes.length : index + 1, 0, options.scene);
  return { ...options.storyboard, scenes };
}

/** Blocks that have a template scene to start from. */
export function templateBlocks(): ReadonlySet<BlockId> {
  return new Set(fixtureStoryboard.scenes.map((scene) => scene.block));
}

/**
 * Adds a scene of `block` after `afterSceneId`, starting from the block's template. Its sample
 * text is placeholder data for the user to replace; the audit runs on save as for any edit.
 */
export function insertScene(options: {
  storyboard: Storyboard;
  afterSceneId: string | undefined;
  block: BlockId;
}): Storyboard {
  const template = fixtureStoryboard.scenes.find((scene) => scene.block === options.block);
  if (!template) throw new StoryboardEditError(`No template for ${options.block}.`);
  const { beat: _templateBeat, ...rest } = structuredClone(template);
  return insertAfter({
    storyboard: options.storyboard,
    afterSceneId: options.afterSceneId,
    scene: { ...rest, id: ulid() },
  });
}

export function duplicateScene(options: { storyboard: Storyboard; sceneId: string }): Storyboard {
  const source = options.storyboard.scenes.find((scene) => scene.id === options.sceneId);
  if (!source) throw new StoryboardEditError("That scene no longer exists.");
  return insertAfter({
    storyboard: options.storyboard,
    afterSceneId: options.sceneId,
    scene: { ...structuredClone(source), id: ulid() },
  });
}

export function removeScene(options: { storyboard: Storyboard; sceneId: string }): Storyboard {
  if (options.storyboard.scenes.length <= MIN_SCENES)
    throw new StoryboardEditError(`A storyboard needs at least ${MIN_SCENES} scenes.`);
  return {
    ...options.storyboard,
    scenes: options.storyboard.scenes.filter((scene) => scene.id !== options.sceneId),
  };
}

export function moveScene(options: {
  storyboard: Storyboard;
  fromIndex: number;
  toIndex: number;
}): Storyboard {
  const { fromIndex, toIndex, storyboard } = options;
  if (toIndex < 0 || toIndex >= storyboard.scenes.length || fromIndex === toIndex) return storyboard;
  return { ...storyboard, scenes: moveItem({ items: storyboard.scenes, fromIndex, toIndex }) };
}

export function setLook(storyboard: Storyboard, look: LookId): Storyboard {
  return storyboard.look === look ? storyboard : { ...storyboard, look };
}

export function setTransition(options: {
  storyboard: Storyboard;
  sceneId: string;
  transition: TransitionId | undefined;
}): Storyboard {
  return replaceScene(options.storyboard, options.sceneId, (scene) => {
    const { transitionIn: _previous, ...rest } = scene;
    return (options.transition ? { ...rest, transitionIn: options.transition } : rest) as Scene;
  });
}

/** Edits one narration line; an empty `say` is removed so the voice reads the caption text. */
export function setNarrationLine(options: {
  storyboard: Storyboard;
  sceneId: string;
  lineIndex: number;
  patch: Partial<Pick<NarrationLine, "text" | "say">>;
}): Storyboard {
  return replaceScene(options.storyboard, options.sceneId, (scene) => ({
    ...scene,
    narration: scene.narration.map((line, index) => {
      if (index !== options.lineIndex) return line;
      const merged = { ...line, ...options.patch };
      if (!merged.say) {
        const { say: _empty, ...withoutSay } = merged;
        return withoutSay;
      }
      return merged;
    }),
  }));
}

export function setBrandAccent(storyboard: Storyboard, accentColor: string | undefined): Storyboard {
  const { accentColor: _previous, ...brand } = storyboard.brand;
  return { ...storyboard, brand: accentColor ? { ...brand, accentColor } : brand };
}
