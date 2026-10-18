import type { CutroomLogger } from "@cutroom/observability";
import type { EmbeddingClient, ModelClient, TokenUsage } from "@cutroom/providers";
import {
  type Claim,
  type ClaimCheck,
  type ClaimResult,
  type ClaimVerdict,
  collectClaims,
  type Evidence,
  type Storyboard,
} from "@cutroom/scene-spec";
import { type AuditContext, buildRepoTextIndex, type RepoTextIndex } from "./audit-context";
import {
  type CheckOutcome,
  checkCodeExcerpt,
  checkCommand,
  checkNumbers,
  checkOverclaims,
  checkQuotedLabels,
  checkUrl,
  isSelfEvident,
} from "./deterministic-checks/checks";
import { type JudgedClaim, judgeClaims } from "./model-judge/judge-claims";
import { type CodeVectorIndex, createSemanticRetriever } from "./semantic-retrieval/semantic-retriever";

const verdictRank: Readonly<Record<ClaimVerdict, number>> = { supported: 0, weak: 1, unsupported: 2 };

function worstVerdict(verdicts: ReadonlyArray<ClaimVerdict>): ClaimVerdict {
  return verdicts.reduce<ClaimVerdict>(
    (worst, verdict) => (verdictRank[verdict] > verdictRank[worst] ? verdict : worst),
    "supported",
  );
}

interface ClaimCheckOptions {
  claim: Claim;
  index: RepoTextIndex;
}

async function runDeterministicChecks({
  claim,
  context,
  index,
}: ClaimCheckOptions & { context: AuditContext }): Promise<CheckOutcome[]> {
  return [
    ...checkQuotedLabels(claim, index),
    ...(await checkCodeExcerpt(claim, context)),
    ...checkNumbers(claim, index),
    ...checkCommand(claim, index),
    ...checkUrl(claim, index),
    ...checkOverclaims(claim),
  ];
}

/** Claims whose kind the deterministic checks fully decide never go to the model. */
function needsJudgment({
  claim,
  outcomes,
  index,
}: ClaimCheckOptions & { outcomes: ReadonlyArray<CheckOutcome> }): boolean {
  if (outcomes.some((outcome) => outcome.blocking)) return false;
  if (
    claim.kind === "code-excerpt" ||
    claim.kind === "command" ||
    claim.kind === "url" ||
    claim.kind === "number"
  )
    return false;
  return !isSelfEvident(claim, index);
}

interface CombineOptions {
  claim: Claim;
  outcomes: ReadonlyArray<CheckOutcome>;
  judged: JudgedClaim | undefined;
  wasSentToJudge: boolean;
}

function combineResult(options: CombineOptions): ClaimResult {
  const { claim, outcomes, judged } = options;
  const checks: ClaimCheck[] = outcomes.map((outcome) => outcome.check);
  const verdicts: ClaimVerdict[] = outcomes.map((outcome) =>
    outcome.blocking ? "unsupported" : outcome.check.passed ? "supported" : "weak",
  );
  const evidence: Evidence[] = outcomes.flatMap((outcome) => outcome.evidence ?? []);
  const suggestions = outcomes.flatMap((outcome) => (outcome.suggestion ? [outcome.suggestion] : []));
  if (options.wasSentToJudge) {
    if (judged) {
      checks.push({ check: "model-judge", passed: judged.verdict === "supported", detail: judged.reason });
      verdicts.push(judged.verdict);
      evidence.push(...judged.evidence);
      if (judged.rewrite && judged.verdict !== "supported") suggestions.unshift(judged.rewrite);
    } else {
      // Never checked is not "probably fine": it blocks approval until someone looks (and --yes).
      checks.push({ check: "model-judge", passed: false, detail: "No verdict returned" });
      verdicts.push("unsupported");
    }
  }
  const suggestion = suggestions[0];
  return {
    claimId: claim.id,
    sceneId: claim.sceneId,
    fieldPath: claim.fieldPath,
    claimText: claim.text,
    verdict: worstVerdict(verdicts),
    checks,
    evidence,
    ...(suggestion ? { suggestion } : {}),
  };
}

export interface AuditClaimsOptions extends AuditContext {
  storyboard: Storyboard;
  model: ModelClient;
  /** Re-audit only these scenes (after an edit, FR-HR-2). */
  sceneIds?: ReadonlyArray<string>;
  logger?: CutroomLogger;
  /** Vector search for the judge (FR-ING-6): the project's code index and the run's embedder. */
  semantic?: { index: CodeVectorIndex; embedder: EmbeddingClient } | undefined;
}

export interface AuditClaimsResult {
  results: ClaimResult[];
  usage: TokenUsage;
  judgedClaims: number;
}

/** Pipeline step 4: deterministic checks first, the model judge second (FR-CA-1…3). */
export async function auditClaims(options: AuditClaimsOptions): Promise<AuditClaimsResult> {
  const index = await buildRepoTextIndex(options);
  const sceneFilter = options.sceneIds ? new Set(options.sceneIds) : undefined;
  const claims = collectClaims(options.storyboard).filter(
    (claim) => !sceneFilter || sceneFilter.has(claim.sceneId),
  );
  const outcomesByClaim = new Map<string, CheckOutcome[]>();
  for (const claim of claims)
    outcomesByClaim.set(claim.id, await runDeterministicChecks({ claim, context: options, index }));
  const claimsForJudge = claims.filter((claim) =>
    needsJudgment({ claim, outcomes: outcomesByClaim.get(claim.id) ?? [], index }),
  );
  const { judged, usage } =
    claimsForJudge.length > 0
      ? await judgeClaims({
          claims: claimsForJudge,
          index,
          reader: options.reader,
          brief: options.brief,
          model: options.model,
          retriever: options.semantic
            ? createSemanticRetriever({
                ...options.semantic,
                repoText: index,
                onSynced: (stats) => options.logger?.info(stats, "synced the code index"),
              })
            : undefined,
        })
      : { judged: new Map<string, JudgedClaim>(), usage: { inputTokens: 0, outputTokens: 0 } };
  const judgedIds = new Set(claimsForJudge.map((claim) => claim.id));
  const results = claims.map((claim) =>
    combineResult({
      claim,
      outcomes: outcomesByClaim.get(claim.id) ?? [],
      judged: judged.get(claim.id),
      wasSentToJudge: judgedIds.has(claim.id),
    }),
  );
  options.logger?.info(
    {
      claims: results.length,
      judged: claimsForJudge.length,
      unsupported: results.filter((result) => result.verdict === "unsupported").length,
    },
    "audited claims",
  );
  return { results, usage, judgedClaims: claimsForJudge.length };
}
