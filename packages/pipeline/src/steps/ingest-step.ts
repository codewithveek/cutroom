import { assertNotDemoMode } from "@cutroom/config";
import { ingestRepository, loadSnapshot } from "@cutroom/repo-ingest";
import { dataPaths } from "../services";
import { prepareChangesSource, saveChangeSnapshot } from "./changes-source";
import { snapshotDirectoryFor } from "./run-resources";
import type { StepFunction } from "./step-context";

/** Step 1: repo in, redacted snapshot out. Skipped when the snapshot is already on disk. */
export const ingestStep: StepFunction = async (context, run) => {
  assertNotDemoMode(context.services.env, "Repository ingestion");
  const snapshotDirectory = snapshotDirectoryFor(context);
  const existing = await loadSnapshot(snapshotDirectory);
  if (existing) return { skipped: true };
  const changes = run.request.changes
    ? await prepareChangesSource({ context, source: run.request.source, changes: run.request.changes })
    : undefined;
  const { snapshot, reader } = await ingestRepository({
    source: changes?.treeSource ?? run.request.source,
    outputDirectory: snapshotDirectory,
    uploadsDirectory: dataPaths(context.services.dataDirectory).uploads,
  });
  const changeSnapshot = changes
    ? await saveChangeSnapshot({ context, changeSnapshot: changes.changeSnapshot, reader })
    : undefined;
  await context.updateRun((current) => ({ ...current, snapshotDirectory }));
  return {
    payload: {
      files: snapshot.stats.keptFiles,
      skipped: snapshot.stats.skippedFiles,
      secretFilesSkipped: snapshot.stats.secretFilesSkipped,
      redactions: snapshot.stats.redactions,
      frameworks: snapshot.frameworks,
      uiStrings: snapshot.uiStrings.length,
      ...(changeSnapshot
        ? {
            range: `${changeSnapshot.fromRef}..${changeSnapshot.toRef}`,
            commits: changeSnapshot.commits.length,
            changedFiles: changeSnapshot.files.length,
          }
        : {}),
    },
  };
};
