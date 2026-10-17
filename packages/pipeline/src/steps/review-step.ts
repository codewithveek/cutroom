import { findApprovalBlockers } from "@cutroom/claim-audit";
import { latestStoryboardVersion } from "../run-schema";
import { MissingStepOutputError } from "./run-resources";
import type { StepFunction } from "./step-context";

/**
 * The human gate (FR-HR-1): pauses until approveStoryboard, unless autoApprove is set and no
 * claim is unsupported.
 */
export const reviewStep: StepFunction = async (context, run) => {
  if (run.approval) return { skipped: true };
  const version = latestStoryboardVersion(run);
  if (!version) throw new MissingStepOutputError("The storyboard is missing.");
  const blockers = findApprovalBlockers(version.claimResults, []);
  if (run.request.autoApprove && blockers.length === 0) {
    await context.updateRun((current) => ({
      ...current,
      approval: { versionId: version.id, overrides: [], approvedAt: new Date().toISOString(), auto: true },
    }));
    return { payload: { autoApproved: true } };
  }
  return {
    paused: true,
    payload: { unsupportedClaims: blockers.length, autoApproveRequested: run.request.autoApprove },
  };
};
