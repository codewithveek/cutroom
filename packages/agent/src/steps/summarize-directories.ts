import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ModelClient, TokenUsage } from "@cutroom/providers";
import type { SnapshotFile, SnapshotReader } from "@cutroom/repo-ingest";
import { evidenceSchema } from "@cutroom/scene-spec";
import { z } from "zod";
import { directoryGroupOf, estimateTokens, selectContext } from "../context/repo-context";
import { directorySummarySystemPrompt } from "../prompts/analyze-product-prompt";

export const directorySummarySchema = z.object({
  summary: z.string().min(1).max(600),
  candidateFeatures: z
    .array(z.object({ title: z.string().min(1).max(60), evidence: z.array(evidenceSchema).min(1).max(2) }))
    .max(4),
});
export type DirectorySummary = z.infer<typeof directorySummarySchema>;

/**
 * Room for the largest answer the schema allows: a 600-character summary and eight 400-character
 * code excerpts run to ~1,500 tokens with JSON escaping; at 1,200 they were cut off mid-string.
 */
const SUMMARY_MAX_OUTPUT_TOKENS = 2048;

export interface SummarizeDirectoriesOptions {
  reader: SnapshotReader;
  model: ModelClient;
  files: ReadonlyArray<SnapshotFile>;
  budgetTokensPerCall: number;
  /**
   * Stop once the rendered summaries pass this many tokens. Callers keep only the prefix that
   * fits, so later directories would be summarised (minutes each on a CPU) and then dropped.
   */
  renderedBudgetTokens?: number;
  cacheDirectory?: string;
}

export interface SummarizedDirectory {
  directory: string;
  summary: DirectorySummary;
  cached: boolean;
}

function cacheKeyFor(options: {
  modelId: string;
  directory: string;
  files: ReadonlyArray<SnapshotFile>;
}): string {
  const hash = createHash("sha256").update(options.modelId).update(options.directory);
  for (const file of options.files) hash.update(file.path).update(file.sha256);
  return hash.digest("hex");
}

async function readCachedSummary(cachePath: string): Promise<DirectorySummary | undefined> {
  try {
    return directorySummarySchema.parse(JSON.parse(await readFile(cachePath, "utf8")));
  } catch {
    return undefined;
  }
}

function groupFilesByDirectory(files: ReadonlyArray<SnapshotFile>): Map<string, SnapshotFile[]> {
  const groups = new Map<string, SnapshotFile[]>();
  for (const file of files) {
    const directory = directoryGroupOf(file.path);
    groups.set(directory, [...(groups.get(directory) ?? []), file]);
  }
  return groups;
}

/** Map step of the map-reduce analysis: one cached summary per directory (FR-ANA-2). */
export async function summarizeDirectories(
  options: SummarizeDirectoriesOptions,
): Promise<{ directories: SummarizedDirectory[]; usage: TokenUsage }> {
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const directories: SummarizedDirectory[] = [];
  for (const [directory, groupFiles] of groupFilesByDirectory(options.files)) {
    const cachePath = options.cacheDirectory
      ? path.join(
          options.cacheDirectory,
          `${cacheKeyFor({ modelId: options.model.modelId, directory, files: groupFiles })}.json`,
        )
      : undefined;
    const cached = cachePath ? await readCachedSummary(cachePath) : undefined;
    if (cached) {
      directories.push({ directory, summary: cached, cached: true });
      if (exceedsRenderedBudget(directories, options.renderedBudgetTokens)) break;
      continue;
    }
    const selection = await selectContext({
      reader: options.reader,
      files: groupFiles,
      budgetTokens: options.budgetTokensPerCall,
    });
    if (estimateTokens(selection.rendered) === 0) continue;
    const result = await options.model.generateStructured({
      schema: directorySummarySchema,
      schemaName: "directory_summary",
      system: directorySummarySystemPrompt,
      messages: [{ role: "user", content: `Directory: ${directory}\n\n${selection.rendered}` }],
      operation: "summarize-directory",
      temperature: 0.2,
      maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
    });
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    if (cachePath) {
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(result.output));
    }
    directories.push({ directory, summary: result.output, cached: false });
    if (exceedsRenderedBudget(directories, options.renderedBudgetTokens)) break;
  }
  return { directories, usage };
}

function exceedsRenderedBudget(
  directories: ReadonlyArray<SummarizedDirectory>,
  renderedBudgetTokens: number | undefined,
): boolean {
  return (
    renderedBudgetTokens !== undefined &&
    estimateTokens(renderDirectorySummaries(directories)) > renderedBudgetTokens
  );
}

export function renderDirectorySummaries(directories: ReadonlyArray<SummarizedDirectory>): string {
  return directories
    .map(({ directory, summary }) => {
      const features = summary.candidateFeatures
        .map((feature) => {
          const evidence = feature.evidence
            .map((item) => `${item.filePath}:${item.lineStart}-${item.lineEnd} "${item.excerpt}"`)
            .join("; ");
          return `  - ${feature.title} (${evidence})`;
        })
        .join("\n");
      return `### ${directory}\n${summary.summary}${features ? `\n${features}` : ""}`;
    })
    .join("\n\n");
}
