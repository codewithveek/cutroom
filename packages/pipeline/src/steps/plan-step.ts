import { brandFromBrief, planStoryboard } from "@cutroom/agent";
import { recommendLook } from "@cutroom/presets";
import { isDarkColor, type RepoSnapshot, webUiFrameworks } from "@cutroom/repo-ingest";
import type { LookId, ProductBrief, Storyboard } from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import { ulid } from "ulid";
import type { RunRecord } from "../run-schema";
import { createRunModelClient, MissingStepOutputError, requireSnapshot } from "./run-resources";
import type { StepContext, StepFunction } from "./step-context";

/** The asset key the renderer stages the repo's logo under. */
export const LOGO_ASSET_KEY = "logo";

function chooseLook({
  run,
  snapshot,
  brief,
}: {
  run: RunRecord;
  snapshot: RepoSnapshot;
  brief: ProductBrief;
}): {
  look: LookId;
  reason: string;
} {
  if (run.request.look) return { look: run.request.look, reason: "Chosen by the user" };
  const recommendation = recommendLook(run.request.videoType, {
    productName: brief.name,
    uiStringCount: snapshot.uiStrings.length,
    hasWebUi: snapshot.frameworks.some((framework) => webUiFrameworks.has(framework)),
    brandIsDark: snapshot.brandHints.backgroundColor
      ? isDarkColor(snapshot.brandHints.backgroundColor)
      : false,
    ...(run.request.ratios.length === 1 && run.request.ratios[0] === "9:16"
      ? { targetChannel: "vertical-social" as const }
      : {}),
  });
  return { look: recommendation.look, reason: recommendation.reason };
}

export interface PlannedStoryboard {
  storyboard: Storyboard;
  look: LookId;
  lookReason: string;
  modelId: string;
  usage: unknown;
  attempts: number;
}

/** Plans a storyboard from a brief: step 3, and "re-plan" after the user edits the brief. */
export async function planFromBrief(options: {
  context: StepContext;
  run: RunRecord;
  brief: ProductBrief;
}): Promise<PlannedStoryboard> {
  const { context, run, brief } = options;
  const { reader, logoFilePath } = await requireSnapshot(context);
  const { look, reason } = chooseLook({ run, snapshot: reader.snapshot, brief });
  const model = createRunModelClient(context, run);
  const brand = brandFromBrief({
    brief,
    hints: reader.snapshot.brandHints,
    override: { ...(logoFilePath ? { logoAssetKey: LOGO_ASSET_KEY } : {}), ...run.request.brandOverride },
  });
  const result = await planStoryboard({
    brief,
    reader,
    model,
    videoType: run.request.videoType,
    look,
    paceSeconds: lookTokensById[look].paceSeconds,
    targetSeconds: run.request.targetSeconds,
    brand,
    seed: run.request.seed,
    direction: run.request.direction,
    screens: run.capture?.screens ?? [],
    logger: context.logger,
  });
  return {
    storyboard: result.storyboard,
    look,
    lookReason: reason,
    modelId: model.modelId,
    usage: result.usage,
    attempts: result.attempts,
  };
}

/** Step 3: storyboard v1 from the brief, the video type's beats and the look. */
export const planStep: StepFunction = async (context, run) => {
  if (run.storyboardVersions.length > 0) return { skipped: true };
  if (!run.brief) throw new MissingStepOutputError("The product brief is missing.");
  const planned = await planFromBrief({ context, run, brief: run.brief });
  await context.updateRun((current) => ({
    ...current,
    look: planned.look,
    lookReason: planned.lookReason,
    storyboardVersions: [
      {
        id: ulid(),
        version: 1,
        storyboard: planned.storyboard,
        author: "agent",
        createdAt: new Date().toISOString(),
        claimResults: [],
        audited: false,
      },
    ],
  }));
  return {
    payload: {
      modelId: planned.modelId,
      usage: planned.usage,
      attempts: planned.attempts,
      look: planned.look,
      scenes: planned.storyboard.scenes.length,
    },
  };
};
