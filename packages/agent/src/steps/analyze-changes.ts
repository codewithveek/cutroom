import type { CutroomLogger } from "@cutroom/observability";
import type { ModelClient, TokenUsage } from "@cutroom/providers";
import { isOnAddedLines, redactSecrets, type SnapshotReader, verifyEvidence } from "@cutroom/repo-ingest";
import {
  type Change,
  type ChangeBrief,
  type ChangeSnapshot,
  changeBriefDraftSchema,
  type Evidence,
  type ProductBrief,
} from "@cutroom/scene-spec";
import { analyzeChangesSystemPrompt, buildAnalyzeChangesPrompt } from "../prompts/analyze-changes-prompt";

/** The range has nothing a user would notice: no video is made (E2 acceptance). */
export class NoUserVisibleChangesError extends Error {
  override readonly name = "NoUserVisibleChangesError";
}

export interface AnalyzeChangesOptions {
  reader: SnapshotReader;
  model: ModelClient;
  changes: ChangeSnapshot;
  addedUiStrings: ReadonlyArray<string>;
  contextBudgetTokens: number;
  includeFixes: boolean;
  direction?: string | undefined;
  logger?: CutroomLogger;
}

export interface AnalyzeChangesResult {
  changeBrief: ChangeBrief;
  /** The same content as a ProductBrief, so planning, audit and review are unchanged. */
  brief: ProductBrief;
  dropped: ReadonlyArray<{ title: string; reason: string }>;
  usage: TokenUsage;
}

const RESERVED_TOKENS = 6000;

/** Evidence that matches the toRef tree and sits entirely on lines the range added (E2-2). */
async function addedLineEvidence(options: {
  reader: SnapshotReader;
  changes: ChangeSnapshot;
  evidence: ReadonlyArray<Evidence>;
}): Promise<Evidence[]> {
  const rangesByPath = new Map(options.changes.files.map((file) => [file.path, file.addedLines]));
  const kept: Evidence[] = [];
  for (const item of options.evidence) {
    const verification = await verifyEvidence(options.reader, item);
    if (verification.status === "rejected") continue;
    const verified = verification.evidence;
    const ranges = rangesByPath.get(verified.filePath);
    if (ranges && isOnAddedLines(ranges, verified.lineStart, verified.lineEnd)) kept.push(verified);
  }
  return kept;
}

function toProductBrief(changeBrief: ChangeBrief): ProductBrief {
  return {
    name: changeBrief.name,
    tagline: changeBrief.tagline,
    audience: changeBrief.audience,
    problem: changeBrief.problem,
    promise: changeBrief.promise,
    features: changeBrief.changes.map((change) => ({
      title: change.title,
      description: change.description,
      evidence: change.evidence,
      strength: "verified" as const,
    })),
  };
}

/** Pipeline step 2 for a changes run: what the range added, each change cited on added lines. */
export async function analyzeChanges(options: AnalyzeChangesOptions): Promise<AnalyzeChangesResult> {
  const result = await options.model.generateStructured({
    schema: changeBriefDraftSchema,
    schemaName: "change_brief",
    system: analyzeChangesSystemPrompt,
    messages: [
      {
        role: "user",
        content: buildAnalyzeChangesPrompt({
          snapshot: options.reader.snapshot,
          changes: options.changes,
          addedUiStrings: options.addedUiStrings,
          budgetTokens: Math.max(1000, options.contextBudgetTokens - RESERVED_TOKENS),
          direction: options.direction ? redactSecrets(options.direction).content : undefined,
        }),
      },
    ],
    operation: "analyze-changes",
    temperature: 0.3,
    maxOutputTokens: 3000,
  });
  const dropped: Array<{ title: string; reason: string }> = [];
  const changes: Change[] = [];
  for (const change of result.output.changes) {
    if (change.kind === "fix" && !options.includeFixes) {
      dropped.push({ title: change.title, reason: "a fix (use --include-fixes to keep fixes)" });
      continue;
    }
    const evidence = await addedLineEvidence({
      reader: options.reader,
      changes: options.changes,
      evidence: change.evidence,
    });
    if (evidence.length === 0) {
      dropped.push({ title: change.title, reason: "none of its evidence is on lines this range added" });
      continue;
    }
    changes.push({ ...change, evidence });
  }
  options.logger?.info({ kept: changes.length, dropped }, "analysed the range");
  if (changes.length === 0)
    throw new NoUserVisibleChangesError(
      `No user-visible changes found between ${options.changes.fromRef} and ${options.changes.toRef}${
        dropped.length > 0
          ? ` (left out: ${dropped.map((item) => `${item.title}: ${item.reason}`).join("; ")})`
          : ""
      }.`,
    );
  const changeBrief: ChangeBrief = { ...result.output, changes };
  return { changeBrief, brief: toProductBrief(changeBrief), dropped, usage: result.usage };
}
