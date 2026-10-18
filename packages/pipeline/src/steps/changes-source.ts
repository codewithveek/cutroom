import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildChangeSnapshot,
  extractCommitTree,
  resolveSource,
  type SnapshotReader,
  SourceError,
  uiStringsOnAddedLines,
} from "@cutroom/repo-ingest";
import {
  type ChangeRequest,
  type ChangeSnapshot,
  changeSnapshotSchema,
  type RepoSource,
} from "@cutroom/scene-spec";
import { snapshotDirectoryFor } from "./run-resources";
import type { StepContext } from "./step-context";

export function changeSnapshotPath(context: StepContext): string {
  return path.join(snapshotDirectoryFor(context), "changes.json");
}

/**
 * E2: read the range from the repository, then extract the toRef tree into the run, so the
 * snapshot (and the claim audit) is the toRef version, not the working copy (E2-5).
 */
export async function prepareChangesSource(options: {
  context: StepContext;
  source: RepoSource;
  changes: ChangeRequest;
}): Promise<{ treeSource: RepoSource; changeSnapshot: ChangeSnapshot }> {
  if (options.source.kind !== "path")
    throw new SourceError(
      "A changes video needs a local git repository with its history (a path, fetch-depth 0).",
    );
  const repo = await resolveSource(options.source);
  const changeSnapshot = await buildChangeSnapshot({
    repoDirectory: repo.rootDirectory,
    fromRef: options.changes.fromRef,
    toRef: options.changes.toRef,
  });
  const treeDirectory = path.join(options.context.runDirectory, "tree");
  await rm(treeDirectory, { recursive: true, force: true });
  await mkdir(treeDirectory, { recursive: true });
  await extractCommitTree({
    repoDirectory: repo.rootDirectory,
    sha: changeSnapshot.toSha,
    outputDirectory: treeDirectory,
  });
  return { treeSource: { kind: "path", path: treeDirectory }, changeSnapshot };
}

export async function saveChangeSnapshot(options: {
  context: StepContext;
  changeSnapshot: ChangeSnapshot;
  reader: SnapshotReader;
}): Promise<ChangeSnapshot> {
  const withUiStrings = {
    ...options.changeSnapshot,
    addedUiStrings: uiStringsOnAddedLines({
      uiStrings: options.reader.snapshot.uiStrings,
      files: options.changeSnapshot.files,
    }),
  };
  await writeFile(changeSnapshotPath(options.context), JSON.stringify(withUiStrings));
  return withUiStrings;
}

export async function loadChangeSnapshot(context: StepContext): Promise<ChangeSnapshot> {
  return changeSnapshotSchema.parse(JSON.parse(await readFile(changeSnapshotPath(context), "utf8")));
}
