import { ingestRepository, loadSnapshot } from "@cutroom/repo-ingest";
import { snapshotDirectoryFor } from "./run-resources";
import type { StepFunction } from "./step-context";

/** Step 1: repo in, redacted snapshot out. Skipped when the snapshot is already on disk. */
export const ingestStep: StepFunction = async (context, run) => {
  const snapshotDirectory = snapshotDirectoryFor(context);
  const existing = await loadSnapshot(snapshotDirectory);
  if (existing) return { skipped: true };
  const { snapshot } = await ingestRepository({
    source: run.request.source,
    outputDirectory: snapshotDirectory,
  });
  await context.updateRun((current) => ({ ...current, snapshotDirectory }));
  return {
    payload: {
      files: snapshot.stats.keptFiles,
      skipped: snapshot.stats.skippedFiles,
      secretFilesSkipped: snapshot.stats.secretFilesSkipped,
      redactions: snapshot.stats.redactions,
      frameworks: snapshot.frameworks,
      uiStrings: snapshot.uiStrings.length,
    },
  };
};
