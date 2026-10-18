import { type ChangedFile, type ChangeSnapshot, changeSnapshotSchema } from "@cutroom/scene-spec";
import { createIgnoreMatcher, hasBinaryExtension } from "../ignore-rules";
import { isSecretFile, redactSecrets } from "../redaction";
import type { UiString } from "../snapshot-schema";
import { SourceError } from "../source";
import { gitOutput } from "./git-output";
import { addedLineRanges, changelogSectionFor, isOnAddedLines, parseCommit } from "./parse-diff";

const MAX_CHANGED_FILES = 80;
const MAX_PATCH_CHARACTERS = 6000;
const changelogFiles = ["CHANGELOG.md", "CHANGES.md", "RELEASE_NOTES.md", "HISTORY.md"];
const statusByLetter: Readonly<Record<string, ChangedFile["status"]>> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
};

export async function resolveCommit(repoDirectory: string, ref: string): Promise<string> {
  const sha = await gitOutput(repoDirectory, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).catch(
    () => "",
  );
  if (!/^[0-9a-f]{40}$/.test(sha.trim()))
    throw new SourceError(`"${ref}" is not a tag, branch or commit in this repository.`);
  return sha.trim();
}

/** Tags newest first, for the composer's "Changes since <tag>" chip. */
export async function listTags(repoDirectory: string): Promise<string[]> {
  const output = await gitOutput(repoDirectory, ["tag", "--sort=-creatordate"]).catch(() => "");
  return output
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 30);
}

async function readCommits(options: { repoDirectory: string; fromSha: string; toSha: string }) {
  const output = await gitOutput(options.repoDirectory, [
    "log",
    "--format=%H%x1f%s%x1f%b%x1e",
    `${options.fromSha}..${options.toSha}`,
  ]);
  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha = "", subject = "", body = ""] = record.split("\x1f");
      return parseCommit({ sha, subject: redactSecrets(subject).content, body });
    })
    .filter((commit) => /^[0-9a-f]{40}$/.test(commit.sha));
}

async function readChangedFiles(options: {
  repoDirectory: string;
  fromSha: string;
  toSha: string;
}): Promise<ChangedFile[]> {
  const ignore = createIgnoreMatcher([]);
  const statusLines = await gitOutput(options.repoDirectory, [
    "diff",
    "--name-status",
    "-M",
    "--no-color",
    options.fromSha,
    options.toSha,
  ]);
  const entries = statusLines
    .split("\n")
    .map((line) => line.split("\t"))
    .flatMap(([code = "", first = "", second]) => {
      const status = statusByLetter[code.charAt(0)];
      const filePath = second ?? first;
      return status && filePath ? [{ status, path: filePath }] : [];
    })
    .filter(
      (entry) => !isSecretFile(entry.path) && !hasBinaryExtension(entry.path) && !ignore.ignores(entry.path),
    )
    .slice(0, MAX_CHANGED_FILES);
  const files: ChangedFile[] = [];
  for (const entry of entries) {
    if (entry.status === "deleted") {
      files.push({ ...entry, addedLines: [], patch: "" });
      continue;
    }
    const patch = await gitOutput(options.repoDirectory, [
      "diff",
      "--unified=2",
      "--no-color",
      options.fromSha,
      options.toSha,
      "--",
      entry.path,
    ]);
    files.push({
      ...entry,
      addedLines: addedLineRanges(patch),
      patch: redactSecrets(patch).content.slice(0, MAX_PATCH_CHARACTERS),
    });
  }
  return files;
}

async function readChangelogSection(options: { repoDirectory: string; toSha: string; toRef: string }) {
  for (const fileName of changelogFiles) {
    const content = await gitOutput(options.repoDirectory, ["show", `${options.toSha}:${fileName}`]).catch(
      () => undefined,
    );
    if (content) {
      const section = changelogSectionFor(content, options.toRef);
      if (section) return redactSecrets(section).content.slice(0, 3000);
    }
  }
  return undefined;
}

/** E2-1: commits, redacted hunks with their added lines, and the release's CHANGELOG section. */
export async function buildChangeSnapshot(options: {
  repoDirectory: string;
  fromRef: string;
  toRef: string;
}): Promise<ChangeSnapshot> {
  const fromSha = await resolveCommit(options.repoDirectory, options.fromRef);
  const toSha = await resolveCommit(options.repoDirectory, options.toRef);
  const range = { repoDirectory: options.repoDirectory, fromSha, toSha };
  const changelogSection = await readChangelogSection({ ...range, toRef: options.toRef });
  return changeSnapshotSchema.parse({
    fromRef: options.fromRef,
    toRef: options.toRef,
    fromSha,
    toSha,
    commits: await readCommits(range),
    files: await readChangedFiles(range),
    ...(changelogSection ? { changelogSection } : {}),
    addedUiStrings: [],
  });
}

/** UI strings of the toRef snapshot that sit on lines the range added. */
export function uiStringsOnAddedLines(options: {
  uiStrings: ReadonlyArray<UiString>;
  files: ReadonlyArray<ChangedFile>;
}): string[] {
  const rangesByPath = new Map(options.files.map((file) => [file.path, file.addedLines]));
  const added = options.uiStrings.filter((uiString) => {
    const ranges = rangesByPath.get(uiString.filePath);
    return ranges ? isOnAddedLines(ranges, uiString.line, uiString.line) : false;
  });
  return [...new Set(added.map((uiString) => uiString.text))].slice(0, 40);
}
