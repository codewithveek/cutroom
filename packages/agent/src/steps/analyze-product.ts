import type { CutroomLogger } from "@cutroom/observability";
import type { ModelClient, TokenUsage } from "@cutroom/providers";
import type { SnapshotReader } from "@cutroom/repo-ingest";
import { verifyEvidence } from "@cutroom/repo-ingest";
import { type Evidence, type Feature, type ProductBrief, productBriefDraftSchema } from "@cutroom/scene-spec";
import { estimateTokens, rankFilesForContext, selectContext } from "../context/repo-context";
import { analyzeProductSystemPrompt, buildAnalyzeProductPrompt } from "../prompts/analyze-product-prompt";
import { renderDirectorySummaries, summarizeDirectories } from "./summarize-directories";

/** Room for the system prompt, the facts block and the model's answer. */
const RESERVED_TOKENS = 6000;

export interface AnalyzeProductOptions {
  reader: SnapshotReader;
  model: ModelClient;
  contextBudgetTokens: number;
  cacheDirectory?: string;
  logger?: CutroomLogger;
}

export interface EvidenceReport {
  verified: number;
  relocated: number;
  rejected: ReadonlyArray<{ feature: string; reason: string }>;
}

export interface AnalyzeProductResult {
  brief: ProductBrief;
  usage: TokenUsage;
  attempts: number;
  evidenceReport: EvidenceReport;
  summarizedDirectories: string[];
}

interface VerifiedFeatures {
  features: Feature[];
  report: EvidenceReport;
}

async function verifyFeatures(
  reader: SnapshotReader,
  draftFeatures: ReadonlyArray<{ title: string; description: string; evidence: Evidence[] }>,
): Promise<VerifiedFeatures> {
  let verified = 0;
  let relocated = 0;
  const rejected: Array<{ feature: string; reason: string }> = [];
  const features: Feature[] = [];
  for (const draftFeature of draftFeatures) {
    const keptEvidence: Evidence[] = [];
    for (const evidence of draftFeature.evidence) {
      const verification = await verifyEvidence(reader, evidence);
      if (verification.status === "rejected") {
        rejected.push({ feature: draftFeature.title, reason: verification.reason });
        continue;
      }
      if (verification.status === "relocated") relocated += 1;
      else verified += 1;
      keptEvidence.push(verification.evidence);
    }
    features.push({
      title: draftFeature.title,
      description: draftFeature.description,
      evidence: keptEvidence,
      strength: keptEvidence.length > 0 ? "verified" : "weak",
    });
  }
  return { features, report: { verified, relocated, rejected } };
}

/** Pipeline step 2: a ProductBrief whose evidence has been checked against the repo. */
export async function analyzeProduct(options: AnalyzeProductOptions): Promise<AnalyzeProductResult> {
  const { reader, model } = options;
  const contentBudget = Math.max(1000, options.contextBudgetTokens - RESERVED_TOKENS);
  const rankedFiles = rankFilesForContext(reader.snapshot);
  const directSelection = await selectContext({
    reader,
    files: rankedFiles,
    budgetTokens: Math.floor(contentBudget * 0.7),
  });
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let directorySummaries = "";
  let summarizedDirectories: string[] = [];
  if (directSelection.omittedPaths.length > 0) {
    const omitted = new Set(directSelection.omittedPaths);
    const summaries = await summarizeDirectories({
      reader,
      model,
      files: rankedFiles.filter((file) => omitted.has(file.path)),
      budgetTokensPerCall: contentBudget,
      ...(options.cacheDirectory ? { cacheDirectory: options.cacheDirectory } : {}),
    });
    usage.inputTokens += summaries.usage.inputTokens;
    usage.outputTokens += summaries.usage.outputTokens;
    const remainingBudget = Math.floor(contentBudget * 0.3);
    const kept = summaries.directories.filter(
      (_, index, all) => estimateTokens(renderDirectorySummaries(all.slice(0, index + 1))) <= remainingBudget,
    );
    directorySummaries = renderDirectorySummaries(kept);
    summarizedDirectories = kept.map((directory) => directory.directory);
    options.logger?.info(
      { directories: summarizedDirectories.length },
      "summarised directories for analysis",
    );
  }
  const result = await model.generateStructured({
    schema: productBriefDraftSchema,
    schemaName: "product_brief",
    system: analyzeProductSystemPrompt,
    messages: [
      {
        role: "user",
        content: buildAnalyzeProductPrompt({
          snapshot: reader.snapshot,
          renderedFiles: directSelection.rendered,
          directorySummaries,
        }),
      },
    ],
    operation: "analyze-product",
    temperature: 0.3,
    maxOutputTokens: 3000,
  });
  usage.inputTokens += result.usage.inputTokens;
  usage.outputTokens += result.usage.outputTokens;
  const { features, report } = await verifyFeatures(reader, result.output.features);
  options.logger?.info({ ...report, rejected: report.rejected.length }, "verified brief evidence");
  return {
    brief: { ...result.output, features },
    usage,
    attempts: result.attempts,
    evidenceReport: report,
    summarizedDirectories,
  };
}
