import type { CutroomLogger } from "@cutroom/observability";
import { videoTypeTemplates } from "@cutroom/presets";
import type { ModelClient, TokenUsage } from "@cutroom/providers";
import type { SnapshotReader } from "@cutroom/repo-ingest";
import { redactSecrets } from "@cutroom/repo-ingest";
import {
  type Brand,
  type CapturedScreen,
  createStoryboardDraftSchema,
  type LookId,
  type ProductBrief,
  type Storyboard,
  type VideoType,
} from "@cutroom/scene-spec";
import { buildPlanStoryboardPrompt, planStoryboardSystemPrompt } from "../prompts/plan-storyboard-prompt";
import { screenIssues } from "../screens/screen-views";
import { storyboardDraftIssues } from "../validation/word-budget";
import { assembleStoryboard } from "./assemble-storyboard";

export interface PlanStoryboardOptions {
  brief: ProductBrief;
  reader: SnapshotReader;
  model: ModelClient;
  videoType: VideoType;
  look: LookId;
  paceSeconds: readonly [number, number];
  targetSeconds: number;
  brand: Brand;
  seed: number;
  /** Free-text steer from the run request; secrets are redacted here before it reaches the model. */
  direction?: string | undefined;
  /** Captured screens of the running app; screenshot-window is offered only when there are some. */
  screens?: ReadonlyArray<CapturedScreen> | undefined;
  logger?: CutroomLogger;
}

export interface PlanStoryboardResult {
  storyboard: Storyboard;
  usage: TokenUsage;
  attempts: number;
}

/** Pipeline step 3: brief + beat template + look → validated, repaired Storyboard (FR-SB-1…6). */
export async function planStoryboard(options: PlanStoryboardOptions): Promise<PlanStoryboardResult> {
  const screens = options.screens ?? [];
  const result = await options.model.generateStructured({
    schema: createStoryboardDraftSchema({
      look: options.look,
      beats: videoTypeTemplates[options.videoType].beats.map((beat) => beat.beat),
      excludeBlocks: screens.length > 0 ? [] : ["screenshot-window"],
    }),
    schemaName: "storyboard_draft",
    system: planStoryboardSystemPrompt,
    messages: [
      {
        role: "user",
        content: buildPlanStoryboardPrompt({
          brief: options.brief,
          snapshot: options.reader.snapshot,
          videoType: options.videoType,
          look: options.look,
          targetSeconds: options.targetSeconds,
          direction: options.direction ? redactSecrets(options.direction).content : undefined,
          screens,
        }),
      },
    ],
    validate: (draft) => [
      ...storyboardDraftIssues(draft, options.videoType),
      ...screenIssues({ scenes: draft.scenes, screens }),
    ],
    operation: "plan-storyboard",
    temperature: 0.5,
    maxOutputTokens: 4000,
  });
  options.logger?.info(
    { attempts: result.attempts, scenes: result.output.scenes.length },
    "planned storyboard",
  );
  const storyboard = await assembleStoryboard({
    draft: result.output,
    videoType: options.videoType,
    look: options.look,
    paceSeconds: options.paceSeconds,
    brand: options.brand,
    reader: options.reader,
    seed: options.seed,
    screens,
  });
  return { storyboard, usage: result.usage, attempts: result.attempts };
}
