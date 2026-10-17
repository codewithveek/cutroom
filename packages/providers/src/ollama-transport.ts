import { z } from "zod";
import type { JsonCompletion, JsonCompletionRequest, JsonCompletionTransport } from "./model-client";
import { networkScopeForUrl } from "./privacy-guard";

const ollamaChatResponseSchema = z.object({
  message: z.object({ content: z.string() }),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

export class ModelTransportError extends Error {
  override readonly name = "ModelTransportError";
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface OllamaTransportOptions {
  host: string;
  modelId: string;
  contextTokens: number;
  fetchImplementation?: typeof fetch;
}

/** Gemma via Ollama's /api/chat with structured output through `format` (FR-SB-2). */
export function createOllamaTransport(options: OllamaTransportOptions): JsonCompletionTransport {
  const fetchImplementation = options.fetchImplementation ?? ((input, init) => fetch(input, init));
  return {
    providerId: "ollama",
    modelId: options.modelId,
    networkScope: networkScopeForUrl(options.host),
    async complete(request: JsonCompletionRequest): Promise<JsonCompletion> {
      const response = await fetchImplementation(new URL("/api/chat", options.host), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: options.modelId,
          stream: false,
          format: request.jsonSchema,
          messages: [{ role: "system", content: request.system }, ...request.messages],
          options: {
            temperature: request.temperature,
            num_predict: request.maxOutputTokens,
            num_ctx: options.contextTokens,
          },
        }),
      });
      if (!response.ok) {
        throw new ModelTransportError(
          `Ollama returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
          response.status,
        );
      }
      const body = ollamaChatResponseSchema.parse(await response.json());
      return {
        content: body.message.content,
        usage: { inputTokens: body.prompt_eval_count ?? 0, outputTokens: body.eval_count ?? 0 },
      };
    },
  };
}
