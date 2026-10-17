import type { Claim } from "@cutroom/scene-spec";
import { stripStars } from "@cutroom/scene-spec";
import type { RepoTextIndex } from "../audit-context";

const stopWords = new Set(
  "the and for with your from that this into onto over each every what when where which while about after before their there them they then than just only also more most less like make makes made does done have has had are was were will would could should can our you its it's one two three".split(
    " ",
  ),
);

export function claimKeywords(text: string): string[] {
  const words = stripStars(text)
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word));
  return [...new Set(words)];
}

export interface CandidateSnippet {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  text: string;
  score: number;
}

/** Light stemming so "groups" finds "groupCommits" and "drafts" finds "draft". */
function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "");
}

/**
 * Grep-style retrieval over the redacted repo (FR-CA-3; embeddings come in P1):
 * scores each line by the claim keywords it contains and returns the best windows.
 */
export function retrieveCandidateEvidence(options: {
  claim: Claim;
  index: RepoTextIndex;
  limit: number;
}): CandidateSnippet[] {
  const stems = claimKeywords(options.claim.text)
    .map(stem)
    .filter((word) => word.length >= 3);
  if (stems.length === 0) return [];
  const snippets: CandidateSnippet[] = [];
  for (const file of options.index.files) {
    const lines = file.content.split("\n");
    lines.forEach((line, lineIndex) => {
      const lowered = line.toLowerCase();
      const score = stems.reduce((sum, word) => sum + (lowered.includes(word) ? 1 : 0), 0);
      if (score === 0) return;
      const lineStart = Math.max(1, lineIndex);
      const lineEnd = Math.min(lines.length, lineIndex + 2);
      snippets.push({
        filePath: file.path,
        lineStart,
        lineEnd,
        text: lines.slice(lineStart - 1, lineEnd).join("\n"),
        score,
      });
    });
  }
  return snippets
    .toSorted((left, right) => right.score - left.score || left.filePath.localeCompare(right.filePath))
    .filter(
      (snippet, index, all) =>
        all.findIndex(
          (other) => other.filePath === snippet.filePath && Math.abs(other.lineStart - snippet.lineStart) < 3,
        ) === index,
    )
    .slice(0, options.limit);
}
