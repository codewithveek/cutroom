import { analyzeChanges, analyzeProduct } from "@cutroom/agent";
import { loadChangeSnapshot } from "./changes-source";
import { createRunModelClient, requireSnapshot, summaryCacheDirectory } from "./run-resources";
import type { StepFunction } from "./step-context";

/** Step 2 for a changes run (E2): a brief of what the range added, cited on added lines. */
const analyzeChangesStep: StepFunction = async (context, run) => {
  const changes = run.request.changes;
  if (!changes) throw new Error("analyzeChangesStep needs a changes request");
  const { reader } = await requireSnapshot(context);
  const model = createRunModelClient(context, run);
  const changeSnapshot = await loadChangeSnapshot(context);
  const result = await analyzeChanges({
    reader,
    model,
    changes: changeSnapshot,
    addedUiStrings: changeSnapshot.addedUiStrings,
    contextBudgetTokens: context.services.env.MODEL_CONTEXT_BUDGET_TOKENS,
    includeFixes: changes.includeFixes,
    direction: run.request.direction,
    logger: context.logger,
  });
  await context.updateRun((current) => ({
    ...current,
    brief: result.brief,
    providers: { ...current.providers, modelProvider: model.providerId, modelId: model.modelId },
  }));
  return {
    payload: {
      modelId: model.modelId,
      usage: result.usage,
      range: `${changes.fromRef}..${changes.toRef}`,
      changes: result.changeBrief.changes.map((change) => `${change.kind}: ${change.title}`),
      leftOut: result.dropped,
    },
  };
};

/** Step 2: the product brief, with evidence verified against the snapshot. */
export const analyzeStep: StepFunction = async (context, run) => {
  if (run.brief) return { skipped: true };
  if (run.request.changes) return analyzeChangesStep(context, run);
  const { reader } = await requireSnapshot(context);
  const model = createRunModelClient(context, run);
  const result = await analyzeProduct({
    reader,
    model,
    contextBudgetTokens: context.services.env.MODEL_CONTEXT_BUDGET_TOKENS,
    cacheDirectory: summaryCacheDirectory(context),
    logger: context.logger,
    direction: run.request.direction,
  });
  await context.updateRun((current) => ({
    ...current,
    brief: result.brief,
    providers: { ...current.providers, modelProvider: model.providerId, modelId: model.modelId },
  }));
  return {
    payload: {
      modelId: model.modelId,
      usage: result.usage,
      attempts: result.attempts,
      features: result.brief.features.length,
      evidenceVerified: result.evidenceReport.verified + result.evidenceReport.relocated,
      evidenceRejected: result.evidenceReport.rejected.length,
    },
  };
};
