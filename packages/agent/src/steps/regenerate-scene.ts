import { videoTypeTemplates } from "@cutroom/presets";
import type { ModelClient, TokenUsage } from "@cutroom/providers";
import type { SnapshotReader } from "@cutroom/repo-ingest";
import {
  blocksAllowedInLook,
  createSceneDraftSchema,
  type ProductBrief,
  type Scene,
  type SceneDraft,
  type Storyboard,
  storyboardSchema,
} from "@cutroom/scene-spec";
import { buildPlanStoryboardPrompt, planStoryboardSystemPrompt } from "../prompts/plan-storyboard-prompt";
import { storyboardDraftIssues } from "../validation/word-budget";
import { assembleScene } from "./assemble-storyboard";

export class SceneNotFoundError extends Error {
  override readonly name = "SceneNotFoundError";
}

export interface RegenerateSceneOptions {
  storyboard: Storyboard;
  sceneId: string;
  brief: ProductBrief;
  reader: SnapshotReader;
  model: ModelClient;
  paceSeconds: readonly [number, number];
  targetSeconds: number;
  /** Optional direction from the user, e.g. "show the CLI instead". */
  instruction?: string;
}

function toDraft(scene: Scene): SceneDraft {
  const { id: _id, baseFrames: _baseFrames, transitionOrigin: _origin, ...draft } = scene;
  return draft as SceneDraft;
}

/** Re-runs generation for one scene with the others as fixed context (FR-SB-7). */
export async function regenerateScene(
  options: RegenerateSceneOptions,
): Promise<{ storyboard: Storyboard; usage: TokenUsage; attempts: number }> {
  const { storyboard } = options;
  const sceneIndex = storyboard.scenes.findIndex((scene) => scene.id === options.sceneId);
  const current = storyboard.scenes[sceneIndex];
  if (!current) throw new SceneNotFoundError(`No scene ${options.sceneId} in this storyboard`);
  const template = videoTypeTemplates[storyboard.videoType];
  const beat = template.beats.find((candidate) => candidate.beat === current.beat);
  const allowedInLook = new Set(blocksAllowedInLook(storyboard.look));
  const blocks = (beat?.blocks ?? [current.block]).filter((block) => allowedInLook.has(block));
  const otherScenes = storyboard.scenes.map((scene, index) =>
    index === sceneIndex ? "<< this scene >>" : toDraft(scene),
  );
  const prompt = [
    buildPlanStoryboardPrompt({
      brief: options.brief,
      snapshot: options.reader.snapshot,
      videoType: storyboard.videoType,
      look: storyboard.look,
      targetSeconds: options.targetSeconds,
    }),
    "",
    "## The storyboard so far (keep every other scene as it is)",
    JSON.stringify(otherScenes, null, 2),
    "",
    `Rewrite scene ${sceneIndex + 1} only (beat "${current.beat ?? "moment"}"), using one of: ${blocks.join(", ")}.`,
    "It must read well between its neighbours and must not repeat what they already say.",
    options.instruction ? `Direction from the user: ${options.instruction}` : "",
    'Return {"scene": …}.',
  ].join("\n");
  const result = await options.model.generateStructured({
    schema: createSceneDraftSchema(blocks),
    schemaName: "scene_draft",
    system: planStoryboardSystemPrompt,
    messages: [{ role: "user", content: prompt }],
    validate: ({ scene }) => {
      const scenes = storyboard.scenes.map((existing, index) =>
        index === sceneIndex ? { ...scene, beat: current.beat } : toDraft(existing),
      );
      return storyboardDraftIssues({ title: storyboard.title, scenes }, storyboard.videoType).filter(
        (issue) => issue.startsWith(`scenes.${sceneIndex}`),
      );
    },
    operation: "regenerate-scene",
    temperature: 0.7,
    maxOutputTokens: 1500,
  });
  const replacement = await assembleScene({
    draftScene: { ...result.output.scene, ...(current.beat ? { beat: current.beat } : {}) },
    paceSeconds: options.paceSeconds,
    reader: options.reader,
    sceneId: current.id,
  });
  const scenes = storyboard.scenes.map((scene, index) => (index === sceneIndex ? replacement : scene));
  return {
    storyboard: storyboardSchema.parse({ ...storyboard, scenes }),
    usage: result.usage,
    attempts: result.attempts,
  };
}
