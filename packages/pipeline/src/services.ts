import path from "node:path";
import type { CodeVectorIndex } from "@cutroom/claim-audit";
import type { CutroomEnv } from "@cutroom/config";
import type { CutroomLogger } from "@cutroom/observability";
import type { JsonCompletionTransport } from "@cutroom/providers";
import type { VoiceProvider } from "@cutroom/voice";
import type { RunStore } from "./store/run-store";

/** Everything the steps need from the outside world, injected so tests can swap any of it. */
export interface PipelineServices {
  env: CutroomEnv;
  logger: CutroomLogger;
  store: RunStore;
  /** Absolute; holds the render bundle, voice cache, model cache and summary cache. */
  dataDirectory: string;
  browserExecutable: string | null;
  /** Use a scripted model instead of Ollama / the OpenAI-compatible endpoint. */
  modelTransportOverride?: JsonCompletionTransport;
  /** Use this voice instead of the one the run asks for (CI without the Kokoro model). */
  voiceProviderOverride?: VoiceProvider;
  /** CLI only: block every non-loopback connection while a Local-mode run executes. */
  enforceLocalEgress?: boolean;
  /** The code index of a run's project (pgvector), when retrieval is on (EMBEDDINGS, FR-ING-6). */
  codeIndexFor?: (runId: string) => Promise<CodeVectorIndex | undefined>;
  /** A prebuilt Remotion bundle to copy instead of bundling video-kit from source (published CLI). */
  prebuiltBundleDirectory?: string;
}

export function dataPaths(dataDirectory: string) {
  return {
    bundle: path.join(dataDirectory, "bundle"),
    voiceCache: path.join(dataDirectory, "voice-cache"),
    models: path.join(dataDirectory, "models"),
    summaryCache: path.join(dataDirectory, "summary-cache"),
    uploads: path.join(dataDirectory, "uploads"),
  };
}
