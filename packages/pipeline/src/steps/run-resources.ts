import path from "node:path";
import type { CodeVectorIndex } from "@cutroom/claim-audit";
import { assertNotDemoMode } from "@cutroom/config";
import {
  CODE_EMBEDDING_DIMENSIONS,
  createEmbeddingClient,
  createModelClient,
  type EmbeddingClient,
  type ModelClient,
} from "@cutroom/providers";
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
  assertNotDemoMode(context.services.env, "The model provider");
  return createModelClient({
    mode: run.request.privacyMode,
    env: context.services.env,
    ...(context.services.modelTransportOverride
      ? { transportOverride: context.services.modelTransportOverride }
      : {}),
  });
}

/**
 * Vector search for the claim judge, when EMBEDDINGS is on and the store can hold vectors.
 * The embedder passes the same privacy guard as the model (FR-PRV-2).
 */
export async function semanticRetrievalFor(
  context: StepContext,
  run: RunRecord,
): Promise<{ index: CodeVectorIndex; embedder: EmbeddingClient } | undefined> {
  const embedder = createEmbeddingClient({
    mode: run.request.privacyMode,
    env: context.services.env,
    dimensions: CODE_EMBEDDING_DIMENSIONS,
  });
  if (!embedder || !context.services.codeIndexFor) return undefined;
  const index = await context.services.codeIndexFor(run.id);
  return index ? { index, embedder } : undefined;
}

export function summaryCacheDirectory(context: StepContext): string {
  return dataPaths(context.services.dataDirectory).summaryCache;
}
