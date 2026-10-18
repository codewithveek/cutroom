import type { ChangedFile, ClaimResult } from "@cutroom/scene-spec";

/** Words that present something as new in this release. */
const newnessPattern = /\b(new|now|introduc\w*|adds?|added|launch\w*)\b/i;

function onAddedLines(files: ReadonlyArray<ChangedFile>, result: ClaimResult): boolean {
  const rangesByPath = new Map(files.map((file) => [file.path, file.addedLines]));
  return result.evidence.some((evidence) =>
    (rangesByPath.get(evidence.filePath) ?? []).some(
      ([start, end]) => evidence.lineStart >= start && evidence.lineEnd <= end,
    ),
  );
}

/**
 * E2-5: in a changes video, a claim phrased as new ("New: …", "now drafts …") must cite evidence
 * on lines the range added; otherwise it is unsupported, whatever the other checks said.
 */
export function applyAddedLineRule(options: {
  results: ReadonlyArray<ClaimResult>;
  files: ReadonlyArray<ChangedFile>;
}): ClaimResult[] {
  return options.results.map((result) => {
    if (!newnessPattern.test(result.claimText)) return result;
    if (onAddedLines(options.files, result)) {
      return {
        ...result,
        checks: [
          ...result.checks,
          { check: "added-lines", passed: true, detail: "Cited on lines this range added" },
        ],
      };
    }
    return {
      ...result,
      verdict: "unsupported",
      checks: [
        ...result.checks,
        {
          check: "added-lines",
          passed: false,
          detail: "Said to be new, but no cited evidence is on lines this range added",
        },
      ],
    };
  });
}
