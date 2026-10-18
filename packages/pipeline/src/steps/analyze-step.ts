import { analyzeProduct } from "@cutroom/agent";
import { createRunModelClient, requireSnapshot, summaryCacheDirectory } from "./run-resources";
import type { StepFunction } from "./step-context";

/** Step 2: the product brief, with evidence verified against the snapshot. */
export const analyzeStep: StepFunction = async (context, run) => {
  if (run.brief) return { skipped: true };
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
