import { auditClaims } from "@cutroom/claim-audit";
import type { ClaimResult } from "@cutroom/scene-spec";
import { latestStoryboardVersion, type RunRecord } from "../run-schema";
import { createRunModelClient, MissingStepOutputError, requireSnapshot } from "./run-resources";
import type { StepContext, StepFunction } from "./step-context";

export interface AuditVersionOptions {
  context: StepContext;
  run: RunRecord;
  versionId: string;
  /** Audit only these scenes; results for other scenes carry over from `previousResults`. */
  sceneIds?: ReadonlyArray<string>;
  previousResults?: ReadonlyArray<ClaimResult>;
}

/** Audits one storyboard version and stores the results on it. */
export async function auditVersion(
  options: AuditVersionOptions,
): Promise<{ results: ClaimResult[]; judged: number }> {
  const { context, run } = options;
  const version = run.storyboardVersions.find((candidate) => candidate.id === options.versionId);
  if (!version || !run.brief) throw new MissingStepOutputError("Nothing to audit yet.");
  const { reader } = await requireSnapshot(context);
  const audit = await auditClaims({
    storyboard: version.storyboard,
    reader,
    brief: run.brief,
    model: createRunModelClient(context, run),
    ...(options.sceneIds ? { sceneIds: options.sceneIds } : {}),
    logger: context.logger,
  });
  const auditedScenes = new Set(options.sceneIds ?? version.storyboard.scenes.map((scene) => scene.id));
  const liveScenes = new Set(version.storyboard.scenes.map((scene) => scene.id));
  const carried = (options.previousResults ?? []).filter(
    (result) => !auditedScenes.has(result.sceneId) && liveScenes.has(result.sceneId),
  );
  const results = [...carried, ...audit.results];
  await context.updateRun((current) => ({
    ...current,
    storyboardVersions: current.storyboardVersions.map((candidate) =>
      candidate.id === options.versionId ? { ...candidate, claimResults: results, audited: true } : candidate,
    ),
  }));
  return { results, judged: audit.judgedClaims };
}

/** Step 4: deterministic checks, then the model judge, on the latest version. */
export const auditStep: StepFunction = async (context, run) => {
  const version = latestStoryboardVersion(run);
  if (!version) throw new MissingStepOutputError("The storyboard is missing.");
  if (version.audited) return { skipped: true };
  const { results, judged } = await auditVersion({ context, run, versionId: version.id });
  const count = (verdict: ClaimResult["verdict"]) =>
    results.filter((result) => result.verdict === verdict).length;
  return {
    payload: {
      claims: results.length,
      judged,
      supported: count("supported"),
      weak: count("weak"),
      unsupported: count("unsupported"),
    },
  };
};
