import type { LookId, Storyboard } from "@cutroom/scene-spec";
import { fixtureStoryboard } from "@cutroom/video-kit";

export const lookIds: ReadonlyArray<LookId> = ["editorial", "studio", "graphic", "cinematic"];

/** A short sample in a look: the fixture's headline and feature cards, without narration. */
export function lookPreviewStoryboard(look: LookId): Storyboard {
  const sampleScenes = fixtureStoryboard.scenes.filter(
    (scene) => scene.block === "kinetic-headline" || scene.block === "feature-cards",
  );
  return {
    ...fixtureStoryboard,
    look,
    scenes: sampleScenes.map((scene) => ({ ...scene, baseFrames: 45, narration: [] })),
  };
}
