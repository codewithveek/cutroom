import type { ChangedFile, ClaimResult } from "@cutroom/scene-spec";
import { describe, expect, it } from "vitest";
import { applyAddedLineRule } from "./added-line-rule";

const files: ChangedFile[] = [{ path: "src/draft.ts", status: "added", addedLines: [[1, 4]], patch: "" }];

function claim(claimText: string, lineStart: number): ClaimResult {
  return {
    claimId: `scene:${lineStart}`,
    sceneId: "scene",
    fieldPath: "narration.0.text",
    claimText,
    verdict: "supported",
    checks: [],
    evidence: [{ filePath: "src/draft.ts", lineStart, lineEnd: lineStart, excerpt: "x" }],
  };
}

describe("applyAddedLineRule", () => {
  it("keeps a 'new' claim cited on added lines and blocks one cited elsewhere", () => {
    const [cited, elsewhere, plain] = applyAddedLineRule({
      results: [
        claim("New: draft the changelog", 2),
        claim("It now drafts notes", 9),
        claim("Drafts notes", 9),
      ],
      files,
    });
    expect(cited?.verdict).toBe("supported");
    expect(elsewhere?.verdict).toBe("unsupported");
    expect(elsewhere?.checks.at(-1)?.detail).toMatch(/no cited evidence is on lines this range added/);
    expect(plain?.verdict).toBe("supported");
  });
});
