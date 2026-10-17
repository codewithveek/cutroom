import type { ClaimOverride, ClaimResult } from "@cutroom/scene-spec";

export class ApprovalBlockedError extends Error {
  override readonly name = "ApprovalBlockedError";
  readonly blockingClaims: ReadonlyArray<ClaimResult>;

  constructor(blockingClaims: ReadonlyArray<ClaimResult>) {
    super(
      `${blockingClaims.length} unsupported claim${blockingClaims.length === 1 ? "" : "s"} need evidence or an override`,
    );
    this.blockingClaims = blockingClaims;
  }
}

/** Unsupported claims without a typed override block approval (FR-CA-4). */
export function findApprovalBlockers(
  results: ReadonlyArray<ClaimResult>,
  overrides: ReadonlyArray<ClaimOverride>,
): ClaimResult[] {
  const overridden = new Set(overrides.map((override) => override.claimId));
  return results.filter((result) => result.verdict === "unsupported" && !overridden.has(result.claimId));
}

/** Stores override reasons on the results so the delivery note can list them. */
export function applyOverrides(
  results: ReadonlyArray<ClaimResult>,
  overrides: ReadonlyArray<ClaimOverride>,
): ClaimResult[] {
  const reasons = new Map(overrides.map((override) => [override.claimId, override.reason]));
  return results.map((result) => {
    const reason = reasons.get(result.claimId);
    return reason ? { ...result, overrideReason: reason } : result;
  });
}

export function assertApprovable(
  results: ReadonlyArray<ClaimResult>,
  overrides: ReadonlyArray<ClaimOverride>,
): void {
  const blockers = findApprovalBlockers(results, overrides);
  if (blockers.length > 0) throw new ApprovalBlockedError(blockers);
}
