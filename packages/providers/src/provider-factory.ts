import type { CutroomEnv } from "@cutroom/config";
import type { PrivacyMode } from "@cutroom/scene-spec";
import type { JsonCompletionTransport, ModelClient } from "./model-client";
import { createOllamaTransport } from "./ollama-transport";
import { createOpenAiCompatibleTransport } from "./openai-compatible-transport";
import { assertProviderAllowed, type PrivacyOptIns } from "./privacy-guard";
import { createModelClientFromTransport } from "./structured-generation";

export interface CreateModelClientOptions {
  mode: PrivacyMode;
  env: Pick<
    CutroomEnv,
    | "OLLAMA_HOST"
    | "MODEL_ID"
    | "MODEL_CONTEXT_BUDGET_TOKENS"
    | "OPENAI_COMPAT_BASE_URL"
    | "OPENAI_COMPAT_API_KEY"
    | "OPENAI_COMPAT_MODEL_ID"
  >;
  optIns?: PrivacyOptIns;
  /** Use this transport instead of a real model (tests, scripted demos). */
  transportOverride?: JsonCompletionTransport;
}

function chooseTransport(options: CreateModelClientOptions): JsonCompletionTransport {
  if (options.transportOverride) return options.transportOverride;
  if (options.mode === "cloud" && options.env.OPENAI_COMPAT_BASE_URL) {
    return createOpenAiCompatibleTransport({
      baseUrl: options.env.OPENAI_COMPAT_BASE_URL,
      apiKey: options.env.OPENAI_COMPAT_API_KEY,
      modelId: options.env.OPENAI_COMPAT_MODEL_ID ?? options.env.MODEL_ID,
    });
  }
  return createOllamaTransport({
    host: options.env.OLLAMA_HOST,
    modelId: options.env.MODEL_ID,
    contextTokens: options.env.MODEL_CONTEXT_BUDGET_TOKENS,
  });
}

/**
 * Builds the model client for a run and applies the privacy guard at construction:
 * a provider outside the mode's allow-list throws PrivacyViolationError (FR-PRV-2).
 */
export function createModelClient(options: CreateModelClientOptions): ModelClient {
  const transport = chooseTransport(options);
  assertProviderAllowed({
    mode: options.mode,
    provider: { providerId: transport.providerId, role: "model", networkScope: transport.networkScope },
    ...(options.optIns ? { optIns: options.optIns } : {}),
  });
  return createModelClientFromTransport(transport);
}
