import type { RepoSnapshot } from "@cutroom/repo-ingest";
import { type ChangeSnapshot, parseDirection } from "@cutroom/scene-spec";
import { estimateTokens } from "../context/repo-context";
import { describeSnapshotFacts } from "./analyze-product-prompt";
import { describeDirection, directionRule } from "./direction-block";
import { accuracyRules } from "./shared-rules";

export const analyzeChangesSystemPrompt = `You are the release analyst inside Cutroom. You read a range of a repository's history and write the brief for a short "what's new" video.

Rules:
- ${accuracyRules}
- ${directionRule}
- Describe only what the added lines show. Every change cites evidence from lines marked "+" in the patches, with the line numbers shown there.
- kind "feature" is something a user can now do, "improvement" makes something existing better, "fix" repairs a bug. Refactors, tests, formatting, CI and dependency bumps are not changes.
- Return an empty "changes" list when the range has nothing a user would notice.
- name, tagline, audience, problem and promise frame the product as the repository describes it; problem is life before this release, promise is what it brings.
Return JSON only, matching the schema.`;

/**
 * A unified diff with new-file line numbers, so evidence cites lines as they are in toRef:
 * "+  12| added", "   11| context", "-    | removed".
 */
export function numberedPatch(patch: string): string {
  let newLine = 0;
  const lines: string[] = [];
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk?.[1]) {
      newLine = Number(hunk[1]);
      lines.push(line);
      continue;
    }
    if (newLine === 0 || line.startsWith("+++") || line.startsWith("---") || line.startsWith("\\")) continue;
    if (line.startsWith("-")) {
      lines.push(`-     | ${line.slice(1)}`);
      continue;
    }
    const marker = line.startsWith("+") ? "+" : " ";
    lines.push(`${marker}${String(newLine).padStart(5, " ")}| ${line.slice(1)}`);
    newLine += 1;
  }
  return lines.join("\n");
}

export interface AnalyzeChangesPromptOptions {
  snapshot: RepoSnapshot;
  changes: ChangeSnapshot;
  addedUiStrings: ReadonlyArray<string>;
  budgetTokens: number;
  direction?: string | undefined;
}

/** Patches in order of the most added lines, until the budget is spent. */
function describePatches(changes: ChangeSnapshot, budgetTokens: number): string {
  const byAdded = changes.files
    .filter((file) => file.status !== "deleted")
    .toSorted((left, right) => addedCount(right) - addedCount(left));
  const rendered: string[] = [];
  let used = 0;
  for (const file of byAdded) {
    const block = `=== ${file.path} (${file.status})\n${numberedPatch(file.patch)}`;
    const cost = estimateTokens(block);
    if (used + cost > budgetTokens) continue;
    rendered.push(block);
    used += cost;
  }
  const deleted = changes.files.filter((file) => file.status === "deleted").map((file) => file.path);
  return [...rendered, ...(deleted.length > 0 ? [`Deleted: ${deleted.join(", ")}`] : [])].join("\n\n");
}

function addedCount(file: ChangeSnapshot["files"][number]): number {
  return file.addedLines.reduce((sum, [start, end]) => sum + end - start + 1, 0);
}

export function buildAnalyzeChangesPrompt(options: AnalyzeChangesPromptOptions): string {
  const commits = options.changes.commits
    .map(
      (commit) =>
        `- ${commit.type ? `${commit.type}${commit.scope ? `(${commit.scope})` : ""}: ` : ""}${commit.subject}${commit.breaking ? " [breaking]" : ""}`,
    )
    .join("\n");
  return [
    `Write the brief for a video of what changed from ${options.changes.fromRef} to ${options.changes.toRef}.`,
    "",
    "## Facts from the repository",
    describeSnapshotFacts(options.snapshot),
    "",
    "## Commits in the range",
    commits || "(none)",
    ...(options.changes.changelogSection
      ? ["", "## Release notes from the CHANGELOG", options.changes.changelogSection]
      : []),
    ...(options.addedUiStrings.length > 0
      ? ["", "## UI labels on added lines", options.addedUiStrings.map((text) => `- "${text}"`).join("\n")]
      : []),
    "",
    "## Patches (new-file line numbers; + marks added lines)",
    describePatches(options.changes, options.budgetTokens),
    "",
    "Return 0–4 changes, the most user-visible first.",
    ...describeDirection(parseDirection(options.direction)),
  ].join("\n");
}
