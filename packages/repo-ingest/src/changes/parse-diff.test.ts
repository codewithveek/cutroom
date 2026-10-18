import { describe, expect, it } from "vitest";
import { addedLineRanges, changelogSectionFor, isOnAddedLines, parseCommit } from "./parse-diff";

describe("addedLineRanges", () => {
  it("numbers added lines in the new file and merges neighbours", () => {
    const patch = [
      "diff --git a/src/cli.ts b/src/cli.ts",
      "--- a/src/cli.ts",
      "+++ b/src/cli.ts",
      "@@ -1,3 +1,5 @@",
      " import x from 'x';",
      "+export function draft() {",
      "+  return 1;",
      " }",
      "-old();",
      "@@ -10,2 +12,3 @@ function tail()",
      " keep();",
      "+added();",
      " end();",
    ].join("\n");
    const ranges = addedLineRanges(patch);
    expect(ranges).toEqual([
      [2, 3],
      [13, 13],
    ]);
    expect(isOnAddedLines(ranges, 2, 3)).toBe(true);
    expect(isOnAddedLines(ranges, 1, 2)).toBe(false);
  });
});

describe("parseCommit", () => {
  it("reads conventional commits, scopes and breaking changes", () => {
    const sha = "a".repeat(40);
    expect(parseCommit({ sha, subject: "feat(cli)!: add --changes", body: "" })).toEqual({
      sha,
      type: "feat",
      scope: "cli",
      subject: "add --changes",
      breaking: true,
    });
    expect(parseCommit({ sha, subject: "Update readme", body: "BREAKING CHANGE: none" })).toEqual({
      sha,
      subject: "Update readme",
      breaking: true,
    });
  });
});

describe("changelogSectionFor", () => {
  const changelog = "# Changelog\n\n## v1.3.0\n- Draft command\n### Fixes\n- typo\n\n## v1.2.0\n- First\n";
  it("finds the release's section, sub-headings included", () => {
    expect(changelogSectionFor(changelog, "v1.3.0")).toBe("## v1.3.0\n- Draft command\n### Fixes\n- typo");
    expect(changelogSectionFor(changelog, "1.2.0")).toBe("## v1.2.0\n- First");
  });
  it("falls back to the newest versioned section, and to nothing without versions", () => {
    expect(changelogSectionFor(changelog, "HEAD")).toContain("## v1.3.0");
    expect(changelogSectionFor("# Notes\nnothing here", "HEAD")).toBeUndefined();
  });
});
