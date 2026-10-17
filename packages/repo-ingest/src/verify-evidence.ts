import type { Evidence } from "@cutroom/scene-spec";
import type { SnapshotReader } from "./snapshot-reader";

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export type EvidenceVerification =
  | { status: "verified"; evidence: Evidence }
  | { status: "relocated"; evidence: Evidence; claimedLines: [number, number] }
  | { status: "rejected"; reason: string };

/** Finds the 1-based line range of a whitespace-normalised excerpt, in one linear pass. */
function locateExcerpt(fileLines: ReadonlyArray<string>, excerpt: string): [number, number] | undefined {
  const target = normalizeWhitespace(excerpt);
  if (!target) return undefined;
  const lineOffsets: Array<{ lineNumber: number; offset: number }> = [];
  let joined = "";
  fileLines.forEach((line, index) => {
    const normalizedLine = normalizeWhitespace(line);
    if (!normalizedLine) return;
    if (joined) joined += " ";
    lineOffsets.push({ lineNumber: index + 1, offset: joined.length });
    joined += normalizedLine;
  });
  const matchStart = joined.indexOf(target);
  if (matchStart < 0) return undefined;
  const matchEnd = matchStart + target.length - 1;
  const lineAt = (offset: number) => lineOffsets.findLast((entry) => entry.offset <= offset)?.lineNumber ?? 1;
  return [lineAt(matchStart), lineAt(matchEnd)];
}

/**
 * Deterministic evidence check (FR-ANA-3): the file exists, the range is in bounds and the
 * excerpt appears in the file. An excerpt found elsewhere in the file keeps its real lines.
 */
export async function verifyEvidence(
  reader: SnapshotReader,
  evidence: Evidence,
): Promise<EvidenceVerification> {
  const content = await reader.readFile(evidence.filePath);
  if (content === undefined)
    return { status: "rejected", reason: `File not in repository: ${evidence.filePath}` };
  const fileLines = content.split("\n");
  const inBounds =
    evidence.lineStart >= 1 && evidence.lineEnd >= evidence.lineStart && evidence.lineEnd <= fileLines.length;
  if (inBounds) {
    const citedText = fileLines.slice(evidence.lineStart - 1, evidence.lineEnd).join("\n");
    if (normalizeWhitespace(citedText).includes(normalizeWhitespace(evidence.excerpt))) {
      return { status: "verified", evidence };
    }
  }
  const located = locateExcerpt(fileLines, evidence.excerpt);
  if (!located) {
    return { status: "rejected", reason: `Excerpt not found in ${evidence.filePath}` };
  }
  return {
    status: "relocated",
    evidence: { ...evidence, lineStart: located[0], lineEnd: located[1] },
    claimedLines: [evidence.lineStart, evidence.lineEnd],
  };
}
