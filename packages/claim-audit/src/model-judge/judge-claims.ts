import type { ModelClient, TokenUsage } from "@cutroom/providers";
import { type SnapshotReader, verifyEvidence } from "@cutroom/repo-ingest";
import {
  type Claim,
  claimVerdictSchema,
  type Evidence,
  evidenceSchema,
  type ProductBrief,
} from "@cutroom/scene-spec";
import { z } from "zod";
import type { RepoTextIndex } from "../audit-context";
import { mergeSnippets, type SemanticRetriever } from "../semantic-retrieval/semantic-retriever";
import { type CandidateSnippet, retrieveCandidateEvidence } from "./retrieve-evidence";

export const claimVerdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      claimId: z.string().min(1),
      verdict: claimVerdictSchema,
      evidence: z.array(evidenceSchema).max(3),
      /** A precise rewrite the evidence supports, for anything not supported. */
      rewrite: z.string().max(200).optional(),
      reason: z.string().max(200),
    }),
  ),
});

export const judgeSystemPrompt = `You are the claim auditor inside Cutroom. A product video must show only what is real.
For each claim, decide using ONLY the evidence snippets and the verified brief you are given:
- "supported": the evidence directly shows it.
- "weak": partly shown, vague, or broader than the evidence.
- "unsupported": not shown, or contradicted.
For every weak or unsupported claim, give a precise rewrite the evidence does support ("across borders", not "globally"). Keep rewrites as short as the original.
Cite evidence as file path, start line, end line and a verbatim excerpt from the snippets. Return JSON only, matching the schema.`;

/**
 * Five claims a call: each verdict can quote three 400-character excerpts, so ten overflowed the
 * output budget and the JSON was cut off mid-string (gemma4:e4b on Cutroom's own repository).
 */
const CLAIMS_PER_CALL = 5;
/** Room for five verdicts with three escaped excerpts each, plus reasons and rewrites. */
const JUDGE_MAX_OUTPUT_TOKENS = 4096;
/** Calls per batch: the first for every claim, the rest only for claims still without a verdict. */
const JUDGE_ROUNDS_PER_BATCH = 3;
const SNIPPETS_PER_CLAIM = 4;
/** Extra room for semantic hits found in places the keywords missed. */
const SEMANTIC_SNIPPETS_PER_CLAIM = 2;

function renderSnippet(snippet: CandidateSnippet): string {
  const numbered = snippet.text
    .split("\n")
    .map((line, offset) => `${String(snippet.lineStart + offset).padStart(4, " ")}| ${line}`)
    .join("\n");
  return `    ${snippet.filePath}\n${numbered}`;
}

function renderBrief(brief: ProductBrief): string {
  return brief.features
    .map(
      (feature) =>
        `- ${feature.title}: ${feature.description}${feature.strength === "weak" ? " (weak)" : ""}`,
    )
    .join("\n");
}

function renderClaims(options: {
  claims: ReadonlyArray<Claim>;
  index: RepoTextIndex;
  semantic: ReadonlyMap<string, CandidateSnippet[]> | undefined;
}): string {
  return options.claims
    .map((claim) => {
      const snippets = mergeSnippets({
        keyword: retrieveCandidateEvidence({ claim, index: options.index, limit: SNIPPETS_PER_CLAIM }),
        semantic: options.semantic?.get(claim.id) ?? [],
        limit: SNIPPETS_PER_CLAIM + SEMANTIC_SNIPPETS_PER_CLAIM,
      });
      const evidenceText =
        snippets.length > 0 ? snippets.map(renderSnippet).join("\n") : "    (no matching code found)";
      return `- id: ${claim.id}\n  claim: ${JSON.stringify(claim.text)}\n  evidence:\n${evidenceText}`;
    })
    .join("\n\n");
}

export interface JudgedClaim {
  claimId: string;
  verdict: z.infer<typeof claimVerdictSchema>;
  evidence: Evidence[];
  rewrite?: string;
  reason: string;
}

export interface JudgeClaimsOptions {
  claims: ReadonlyArray<Claim>;
  index: RepoTextIndex;
  reader: SnapshotReader;
  brief: ProductBrief;
  model: ModelClient;
  /** Vector search over the repo (FR-ING-6); keyword search alone when absent. */
  retriever?: SemanticRetriever | undefined;
}

/** The model's verdict may only stand on evidence that verifies against the repo. */
async function keepVerifiedEvidence(reader: SnapshotReader, judged: JudgedClaim): Promise<JudgedClaim> {
  const verified: Evidence[] = [];
  for (const evidence of judged.evidence) {
    const verification = await verifyEvidence(reader, evidence);
    if (verification.status !== "rejected") verified.push(verification.evidence);
  }
  if (judged.verdict === "supported" && verified.length === 0) {
    return {
      ...judged,
      verdict: "weak",
      evidence: [],
      reason: `${judged.reason} (the cited evidence did not verify)`,
    };
  }
  return { ...judged, evidence: verified };
}

/** Model check second (FR-CA-3): batched verdicts over retrieved evidence. */
export async function judgeClaims(
  options: JudgeClaimsOptions,
): Promise<{ judged: Map<string, JudgedClaim>; usage: TokenUsage }> {
  const judged = new Map<string, JudgedClaim>();
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  for (let start = 0; start < options.claims.length; start += CLAIMS_PER_CALL) {
    let pending = options.claims.slice(start, start + CLAIMS_PER_CALL);
    for (let round = 1; round <= JUDGE_ROUNDS_PER_BATCH && pending.length > 0; round += 1) {
      const batchUsage = await judgeBatch({ options, batch: pending, judged });
      usage.inputTokens += batchUsage.inputTokens;
      usage.outputTokens += batchUsage.outputTokens;
      // Small models drop claims from long lists; ask again for only the ones left out.
      pending = pending.filter((claim) => !judged.has(claim.id));
    }
  }
  return { judged, usage };
}

interface JudgeBatchOptions {
  options: JudgeClaimsOptions;
  batch: ReadonlyArray<Claim>;
  judged: Map<string, JudgedClaim>;
}

/** One judge call; records every verdict it returns for a claim in the batch. */
async function judgeBatch({ options, batch, judged }: JudgeBatchOptions): Promise<TokenUsage> {
  const batchIds = new Set(batch.map((claim) => claim.id));
  const semantic = await options.retriever?.retrieve({
    claims: batch,
    limit: SEMANTIC_SNIPPETS_PER_CLAIM + 1,
  });
  const result = await options.model.generateStructured({
    schema: claimVerdictsSchema,
    schemaName: "claim_verdicts",
    system: judgeSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Verified brief for ${options.brief.name}:\n${renderBrief(options.brief)}\n\nClaims to judge:\n\n${renderClaims({ claims: batch, index: options.index, semantic })}`,
      },
    ],
    validate: (output) =>
      output.verdicts.some((verdict) => batchIds.has(verdict.claimId))
        ? []
        : [`verdicts: give a verdict for each claim id listed (${[...batchIds].join(", ")})`],
    operation: "audit-claims",
    temperature: 0.1,
    maxOutputTokens: JUDGE_MAX_OUTPUT_TOKENS,
  });
  for (const verdict of result.output.verdicts) {
    if (!batchIds.has(verdict.claimId)) continue;
    const { rewrite, ...rest } = verdict;
    judged.set(
      verdict.claimId,
      await keepVerifiedEvidence(options.reader, { ...rest, ...(rewrite ? { rewrite } : {}) }),
    );
  }
  return result.usage;
}
