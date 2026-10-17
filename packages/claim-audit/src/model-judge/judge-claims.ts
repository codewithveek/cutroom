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

const CLAIMS_PER_CALL = 10;
const SNIPPETS_PER_CLAIM = 4;

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

function renderClaims(claims: ReadonlyArray<Claim>, index: RepoTextIndex): string {
  return claims
    .map((claim) => {
      const snippets = retrieveCandidateEvidence({ claim, index, limit: SNIPPETS_PER_CLAIM });
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
    const batch = options.claims.slice(start, start + CLAIMS_PER_CALL);
    const batchIds = new Set(batch.map((claim) => claim.id));
    const result = await options.model.generateStructured({
      schema: claimVerdictsSchema,
      schemaName: "claim_verdicts",
      system: judgeSystemPrompt,
      messages: [
        {
          role: "user",
          content: `Verified brief for ${options.brief.name}:\n${renderBrief(options.brief)}\n\nClaims to judge:\n\n${renderClaims(batch, options.index)}`,
        },
      ],
      validate: (output) => {
        const returned = new Set(output.verdicts.map((verdict) => verdict.claimId));
        return [...batchIds]
          .filter((claimId) => !returned.has(claimId))
          .map((claimId) => `verdicts: missing claimId ${claimId}`);
      },
      operation: "audit-claims",
      temperature: 0.1,
      maxOutputTokens: 2500,
    });
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    for (const verdict of result.output.verdicts) {
      if (!batchIds.has(verdict.claimId)) continue;
      const { rewrite, ...rest } = verdict;
      judged.set(
        verdict.claimId,
        await keepVerifiedEvidence(options.reader, { ...rest, ...(rewrite ? { rewrite } : {}) }),
      );
    }
  }
  return { judged, usage };
}
