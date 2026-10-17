import path from "node:path";
import { createModelClient, type ModelClient } from "@cutroom/providers";
import { type LoadedSnapshot, loadSnapshot } from "@cutroom/repo-ingest";
import type { RunRecord } from "../run-schema";
import { dataPaths } from "../services";
import type { StepContext } from "./step-context";

export class MissingStepOutputError extends Error {
  override readonly name = "MissingStepOutputError";
}

export function snapshotDirectoryFor(context: StepContext): string {
  return path.join(context.runDirectory, "snapshot");
}

export async function requireSnapshot(context: StepContext): Promise<LoadedSnapshot> {
  const loaded = await loadSnapshot(snapshotDirectoryFor(context));
  if (!loaded) throw new MissingStepOutputError("The repository snapshot is missing; re-run ingestion.");
  return loaded;
}

export function createRunModelClient(context: StepContext, run: RunRecord): ModelClient {
  return createModelClient({
    mode: run.request.privacyMode,
    env: context.services.env,
    ...(context.services.modelTransportOverride
      ? { transportOverride: context.services.modelTransportOverride }
      : {}),
  });
}

export function summaryCacheDirectory(context: StepContext): string {
  return dataPaths(context.services.dataDirectory).summaryCache;
}
