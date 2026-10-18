import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SourceError } from "../source";
import { buildChangeSnapshot, listTags, uiStringsOnAddedLines } from "./change-snapshot";
import { createChangesFixtureRepo } from "./changes-fixture-repo";
import { extractCommitTree } from "./git-output";

let repo = "";

beforeAll(async () => {
  repo = path.join(await mkdtemp(path.join(tmpdir(), "cutroom-changes-")), "shipnote");
  await createChangesFixtureRepo(repo);
});

describe("buildChangeSnapshot", () => {
  it("reads the range's commits, added lines and CHANGELOG section", async () => {
    const snapshot = await buildChangeSnapshot({ repoDirectory: repo, fromRef: "v1.0.0", toRef: "v1.1.0" });
    expect(snapshot.commits.map(({ type, scope, subject }) => ({ type, scope, subject }))).toEqual([
      { type: "refactor", scope: undefined, subject: "read-only commits in writeNotes" },
      { type: "feat", scope: "cli", subject: "add the draft command" },
    ]);
    const draft = snapshot.files.find((file) => file.path === "src/draft.ts");
    expect(draft).toMatchObject({ status: "added", addedLines: [[1, 4]] });
    expect(snapshot.changelogSection).toBe("## v1.1.0\n- New `draft` command writes CHANGELOG.md");
    expect(
      uiStringsOnAddedLines({
        uiStrings: [
          { text: "Draft changelog", filePath: "src/cli.tsx", line: 1, kind: "jsx-text" },
          { text: "Old label", filePath: "src/notes.ts", line: 9, kind: "jsx-text" },
        ],
        files: snapshot.files,
      }),
    ).toEqual(["Draft changelog"]);
  });

  it("names a ref that does not exist", async () => {
    await expect(
      buildChangeSnapshot({ repoDirectory: repo, fromRef: "v9.9.9", toRef: "HEAD" }),
    ).rejects.toThrow(SourceError);
  });

  it("lists tags newest first and extracts a commit's tracked files", async () => {
    expect(await listTags(repo)).toEqual(expect.arrayContaining(["v1.1.0", "v1.0.0"]));
    const tree = await mkdtemp(path.join(tmpdir(), "cutroom-tree-"));
    await extractCommitTree({ repoDirectory: repo, sha: "v1.0.0", outputDirectory: tree });
    await expect(readFile(path.join(tree, "src/draft.ts"))).rejects.toThrow();
    expect(await readFile(path.join(tree, "src/notes.ts"), "utf8")).toContain("commits: string[]");
  });
});
