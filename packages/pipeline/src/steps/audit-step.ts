import { auditClaims } from "@cutroom/claim-audit";
import { type ClaimResult, collectSceneClaims, type Storyboard } from "@cutroom/scene-spec";
import { latestStoryboardVersion, type RunRecord } from "../run-schema";
import {
  createRunModelClient,
  MissingStepOutputError,
  requireSnapshot,
  semanticRetrievalFor,
} from "./run-resources";
import type { StepContext, StepFunction } from "./step-context";

export interface AuditVersionOptions {
  context: StepContext;
  run: RunRecord;
  versionId: string;
  /** Audit only these scenes; results for other scenes carry over from `previousResults`. */
  sceneIds?: ReadonlyArray<string>;
  previousResults?: ReadonlyArray<ClaimResult>;
}

/**
 * The scenes to audit: the requested ones, plus any scene with claims that `previousResults` does
 * not cover, so nothing is carried over as "clear" from an audit that never ran.
 */
function scenesToAudit(options: {
  storyboard: Storyboard;
  sceneIds: ReadonlyArray<string>;
  previousResults: ReadonlyArray<ClaimResult>;
}): string[] {
  const covered = new Set(options.previousResults.map((result) => result.sceneId));
  const uncovered = options.storyboard.scenes
    .filter((scene) => !covered.has(scene.id) && collectSceneClaims(scene).length > 0)
    .map((scene) => scene.id);
  return [...new Set([...options.sceneIds, ...uncovered])];
}

/** Audits one storyboard version and stores the results on it. */
export async function auditVersion(
  options: AuditVersionOptions,
): Promise<{ results: ClaimResult[]; judged: number }> {
  const { context, run } = options;
  const version = run.storyboardVersions.find((candidate) => candidate.id === options.versionId);
  if (!version || !run.brief) throw new MissingStepOutputError("Nothing to audit yet.");
  const { reader } = await requireSnapshot(context);
  const sceneIds = options.sceneIds
    ? scenesToAudit({
        storyboard: version.storyboard,
        sceneIds: options.sceneIds,
        previousResults: options.previousResults ?? [],
      })
    : undefined;
  const audit = await auditClaims({
    storyboard: version.storyboard,
    reader,
    brief: run.brief,
    model: createRunModelClient(context, run),
    semantic: await semanticRetrievalFor(context, run),
    ...(sceneIds ? { sceneIds } : {}),
    logger: context.logger,
  });
  const auditedScenes = new Set(sceneIds ?? version.storyboard.scenes.map((scene) => scene.id));
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
