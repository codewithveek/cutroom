import type { RepoSnapshot } from "@cutroom/repo-ingest";
import { accuracyRules } from "./shared-rules";

export const analyzeProductSystemPrompt = `You are the product analyst inside Cutroom, a tool that turns a codebase into a product video.
You read a repository and write a product brief a copywriter can trust.

Rules:
- ${accuracyRules}
- Features are things a user can do with the product, phrased verb-first ("Draft release notes", not "Release note drafting").
- Each feature cites 1–4 evidence excerpts (file path, start line, end line, excerpt of at most 400 characters).
- Audience and problem describe who would use this and the pain it removes, based on the README and code; stay concrete.
- Return JSON only, matching the schema.`;

export const directorySummarySystemPrompt = `You summarise one directory of a repository for Cutroom's product analyst.
Rules:
- ${accuracyRules}
- Describe what this code does for a user of the product, not how it is organised.
- List at most 4 candidate user-facing features, each with 1–2 verbatim evidence excerpts from the numbered lines.
- Return JSON only, matching the schema.`;

function sampleUiStrings(snapshot: RepoSnapshot, limit: number): string {
  const unique = [...new Set(snapshot.uiStrings.map((uiString) => uiString.text))].slice(0, limit);
  return unique.length > 0 ? unique.map((text) => `"${text}"`).join(", ") : "(none found)";
}

export function describeSnapshotFacts(snapshot: RepoSnapshot): string {
  const scripts = Object.entries(snapshot.scripts)
    .slice(0, 12)
    .map(([name, command]) => `${name}: ${command}`)
    .join("; ");
  const commands = snapshot.readmeCommands
    .slice(0, 12)
    .map((command) => command.command)
    .join("; ");
  return [
    `Repository: ${snapshot.rootName}${snapshot.packageName ? ` (package "${snapshot.packageName}")` : ""}`,
    snapshot.description ? `Package description: ${snapshot.description}` : undefined,
    `Frameworks detected: ${snapshot.frameworks.join(", ") || "none"}`,
    `Files kept: ${snapshot.stats.keptFiles}`,
    scripts ? `Package scripts: ${scripts}` : undefined,
    commands ? `README commands: ${commands}` : undefined,
    `UI strings (sample): ${sampleUiStrings(snapshot, 60)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface AnalyzeProductPromptOptions {
  snapshot: RepoSnapshot;
  renderedFiles: string;
  directorySummaries: string;
}

export function buildAnalyzeProductPrompt(options: AnalyzeProductPromptOptions): string {
  return [
    "Write the product brief for this repository.",
    "",
    "## Facts from the repository",
    describeSnapshotFacts(options.snapshot),
    "",
    options.directorySummaries ? `## Directory summaries\n${options.directorySummaries}\n` : "",
    "## Files (numbered lines)",
    options.renderedFiles,
    "",
    "Return 3–6 features. Name the product as the repository names it.",
  ].join("\n");
}
