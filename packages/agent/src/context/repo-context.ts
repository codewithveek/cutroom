import type { RepoSnapshot, SnapshotFile, SnapshotReader } from "@cutroom/repo-ingest";

/** Rough and conservative: ~4 characters per token for code and English. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MAX_LINES_PER_FILE = 160;

/** `path (N lines)` header, then each line prefixed with its number so the model can cite it. */
export function renderNumberedFile(options: {
  filePath: string;
  content: string;
  maxLines?: number;
}): string {
  const lines = options.content.split("\n");
  const shownLines = lines.slice(0, options.maxLines ?? MAX_LINES_PER_FILE);
  const body = shownLines.map((line, index) => `${String(index + 1).padStart(4, " ")}| ${line}`).join("\n");
  const truncatedNote =
    shownLines.length < lines.length ? `\n     … ${lines.length - shownLines.length} more lines` : "";
  return `=== ${options.filePath} (${lines.length} lines) ===\n${body}${truncatedNote}`;
}

const sourceLanguages = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "python",
  "go",
  "rust",
  "ruby",
  "java",
  "kotlin",
  "swift",
  "vue",
  "svelte",
  "php",
  "csharp",
]);
const keyRolePriority: Readonly<Record<string, number>> = {
  readme: 0,
  manifest: 1,
  entry: 2,
  route: 3,
  docs: 4,
  i18n: 5,
  config: 6,
};

function isTestFile(filePath: string): boolean {
  return (
    /(^|\/)(__tests__|tests?|spec|e2e|fixtures?)\//.test(filePath) || /\.(test|spec)\.[a-z]+$/.test(filePath)
  );
}

/** Key files first (README, manifests, entries, routes), then source files, smallest first. */
export function rankFilesForContext(snapshot: RepoSnapshot): SnapshotFile[] {
  const roleByPath = new Map(snapshot.keyFiles.map((keyFile) => [keyFile.path, keyFile.role]));
  const keyFiles = snapshot.files
    .filter((file) => roleByPath.has(file.path))
    .toSorted(
      (left, right) =>
        (keyRolePriority[roleByPath.get(left.path) ?? ""] ?? 9) -
        (keyRolePriority[roleByPath.get(right.path) ?? ""] ?? 9),
    );
  const sourceFiles = snapshot.files
    .filter(
      (file) => !roleByPath.has(file.path) && sourceLanguages.has(file.language) && !isTestFile(file.path),
    )
    .toSorted(
      (left, right) => left.path.split("/").length - right.path.split("/").length || left.bytes - right.bytes,
    );
  return [...keyFiles, ...sourceFiles];
}

export interface ContextSelection {
  rendered: string;
  includedPaths: string[];
  omittedPaths: string[];
}

export interface SelectContextOptions {
  reader: SnapshotReader;
  files: ReadonlyArray<SnapshotFile>;
  budgetTokens: number;
}

/** Packs numbered files into the budget, in the given order; never exceeds it (FR-ANA-2). */
export async function selectContext(options: SelectContextOptions): Promise<ContextSelection> {
  const sections: string[] = [];
  const includedPaths: string[] = [];
  const omittedPaths: string[] = [];
  let usedTokens = 0;
  for (const file of options.files) {
    const content = await options.reader.readFile(file.path);
    if (content === undefined) continue;
    const section = renderNumberedFile({ filePath: file.path, content });
    const sectionTokens = estimateTokens(section);
    if (usedTokens + sectionTokens > options.budgetTokens) {
      omittedPaths.push(file.path);
      continue;
    }
    sections.push(section);
    includedPaths.push(file.path);
    usedTokens += sectionTokens;
  }
  return { rendered: sections.join("\n\n"), includedPaths, omittedPaths };
}

/** Group key for map-reduce summaries: the first two path segments (`src/billing`). */
export function directoryGroupOf(filePath: string): string {
  const segments = filePath.split("/");
  return segments.length <= 2
    ? segments.length === 1
      ? "."
      : (segments[0] ?? ".")
    : segments.slice(0, 2).join("/");
}
