import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function git(directory: string, args: ReadonlyArray<string>): void {
  const result = spawnSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.com",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.com",
      GIT_AUTHOR_DATE: "2026-10-01T12:00:00Z",
      GIT_COMMITTER_DATE: "2026-10-01T12:00:00Z",
    },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
}

async function write(directory: string, relativePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(directory, relativePath)), { recursive: true });
  await writeFile(path.join(directory, relativePath), content);
}

/**
 * A small tagged repository for changes-to-video tests (E2): v1.0.0 ships notes, v1.1.0 adds a
 * draft command (feat) and tidies code (refactor); `refactor-only` is a range with no feature.
 */
export async function createChangesFixtureRepo(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  git(directory, ["init", "--quiet", "-b", "main"]);
  await write(
    directory,
    "README.md",
    "# Shipnote\n\nRelease notes from your commits.\n\n```bash\nnpx shipnote\n```\n",
  );
  await write(
    directory,
    "package.json",
    JSON.stringify({ name: "shipnote", description: "Release notes from your commits" }),
  );
  await write(
    directory,
    "src/notes.ts",
    "export function writeNotes(commits: string[]) {\n  return commits.join('\\n');\n}\n",
  );
  git(directory, ["add", "-A"]);
  git(directory, ["commit", "--quiet", "-m", "feat: write release notes"]);
  git(directory, ["tag", "v1.0.0"]);
  await write(
    directory,
    "src/draft.ts",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture file's own source contains a template literal
    "/** Drafts CHANGELOG.md from the commits since the last tag. */\nexport function draftChangelog(commits: string[]) {\n  return `## Unreleased\\n${commits.map((commit) => `- ${commit}`).join('\\n')}`;\n}\n",
  );
  await write(
    directory,
    "src/cli.tsx",
    "export const DraftButton = () => <button>Draft changelog</button>;\n",
  );
  await write(
    directory,
    "CHANGELOG.md",
    "# Changelog\n\n## v1.1.0\n- New `draft` command writes CHANGELOG.md\n\n## v1.0.0\n- Release notes\n",
  );
  git(directory, ["add", "-A"]);
  git(directory, ["commit", "--quiet", "-m", "feat(cli): add the draft command"]);
  await write(
    directory,
    "src/notes.ts",
    "export function writeNotes(commits: ReadonlyArray<string>) {\n  return commits.join('\\n');\n}\n",
  );
  git(directory, ["add", "-A"]);
  git(directory, ["commit", "--quiet", "-m", "refactor: read-only commits in writeNotes"]);
  git(directory, ["tag", "v1.1.0"]);
  git(directory, ["tag", "refactor-only-start", "HEAD~1"]);
}
