import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createModelClientFromTransport, createScriptedTransport } from "@cutroom/providers";
import {
  buildChangeSnapshot,
  createChangesFixtureRepo,
  extractCommitTree,
  ingestRepository,
  resolveCommit,
  type SnapshotReader,
} from "@cutroom/repo-ingest";
import type { ChangeSnapshot } from "@cutroom/scene-spec";
import { beforeAll, describe, expect, it } from "vitest";
import { numberedPatch } from "../prompts/analyze-changes-prompt";
import { analyzeChanges, NoUserVisibleChangesError } from "./analyze-changes";

let reader: SnapshotReader;
let changes: ChangeSnapshot;

const framing = {
  name: "Shipnote",
  tagline: "Release notes from your commits",
  audience: "Maintainers who ship often",
  problem: "Changelogs were written by hand.",
  promise: "The changelog drafts itself.",
};
const draftExcerpt = {
  filePath: "src/draft.ts",
  lineStart: 2,
  lineEnd: 2,
  excerpt: "export function draftChangelog(commits: string[]) {",
};

beforeAll(async () => {
  const root = await mkdtemp(path.join(tmpdir(), "cutroom-analyze-changes-"));
  const repo = path.join(root, "shipnote");
  await createChangesFixtureRepo(repo);
  const tree = path.join(root, "tree");
  await mkdir(tree);
  await extractCommitTree({
    repoDirectory: repo,
    sha: await resolveCommit(repo, "v1.1.0"),
    outputDirectory: tree,
  });
  ({ reader } = await ingestRepository({
    source: { kind: "path", path: tree },
    outputDirectory: path.join(root, "snapshot"),
  }));
  changes = await buildChangeSnapshot({ repoDirectory: repo, fromRef: "v1.0.0", toRef: "v1.1.0" });
});

function analyze(answer: unknown, includeFixes = false) {
  const transport = createScriptedTransport(() => answer);
  return {
    transport,
    result: analyzeChanges({
      reader,
      model: createModelClientFromTransport(transport),
      changes,
      addedUiStrings: ["Draft changelog"],
      contextBudgetTokens: 24_000,
      includeFixes,
    }),
  };
}

describe("analyzeChanges", () => {
  it("keeps changes cited on added lines and drops fixes and anything citing unchanged code", async () => {
    const { transport, result } = analyze({
      ...framing,
      changes: [
        {
          kind: "feature",
          title: "Draft the changelog",
          description: "A draft command writes CHANGELOG.md.",
          evidence: [draftExcerpt],
        },
        { kind: "fix", title: "Fix a typo", description: "A typo is gone.", evidence: [draftExcerpt] },
        {
          kind: "feature",
          title: "Write release notes",
          description: "Old feature, unchanged in this range.",
          evidence: [
            { filePath: "src/notes.ts", lineStart: 2, lineEnd: 2, excerpt: "return commits.join('\\n');" },
          ],
        },
      ],
    });
    const { changeBrief, brief, dropped } = await result;
    expect(changeBrief.changes.map((change) => change.title)).toEqual(["Draft the changelog"]);
    expect(brief.features).toMatchObject([{ title: "Draft the changelog", strength: "verified" }]);
    expect(dropped.map((item) => item.title)).toEqual(["Fix a typo", "Write release notes"]);
    const prompt = transport.requests[0]?.messages[0]?.content ?? "";
    expect(prompt).toContain("+    2| export function draftChangelog");
    expect(prompt).toContain("## Release notes from the CHANGELOG");
    expect(prompt).toContain('- "Draft changelog"');
  });

  it("keeps fixes when asked", async () => {
    const { result } = analyze(
      {
        ...framing,
        changes: [
          { kind: "fix", title: "Fix drafting", description: "Drafts work.", evidence: [draftExcerpt] },
        ],
      },
      true,
    );
    expect((await result).changeBrief.changes).toHaveLength(1);
  });

  it("says so, instead of making a video, when nothing user-visible changed", async () => {
    await expect(analyze({ ...framing, changes: [] }).result).rejects.toBeInstanceOf(
      NoUserVisibleChangesError,
    );
  });
});

describe("numberedPatch", () => {
  it("numbers added and context lines as they are in the new file", () => {
    expect(numberedPatch("@@ -1,2 +1,3 @@\n keep\n+added\n-gone\n keep2")).toBe(
      "@@ -1,2 +1,3 @@\n     1| keep\n+    2| added\n-     | gone\n     3| keep2",
    );
  });
});
