import { z } from "zod";
import type { JsonCompletion, JsonCompletionRequest, JsonCompletionTransport } from "./model-client";
import { networkScopeForUrl } from "./privacy-guard";

const ollamaChatChunkSchema = z.object({
  message: z.object({ content: z.string() }).optional(),
  done: z.boolean().optional(),
  error: z.string().optional(),
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

interface StreamedChat {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Reads Ollama's NDJSON stream. Streaming matters on slow hardware: a non-streamed answer
 * sends no headers until it is complete, and Node's fetch gives up after five minutes.
 */
export async function readOllamaStream(body: ReadableStream<Uint8Array>): Promise<StreamedChat> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const result: StreamedChat = { content: "", inputTokens: 0, outputTokens: 0 };
  let buffered = "";
  const absorbLine = (line: string) => {
    if (!line.trim()) return;
    const chunk = ollamaChatChunkSchema.parse(JSON.parse(line));
    if (chunk.error) throw new ModelTransportError(`Ollama: ${chunk.error}`);
    result.content += chunk.message?.content ?? "";
    if (chunk.done) {
      result.inputTokens = chunk.prompt_eval_count ?? 0;
      result.outputTokens = chunk.eval_count ?? 0;
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) absorbLine(line);
  }
  absorbLine(buffered + decoder.decode());
  return result;
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
          stream: true,
          // Thinking-capable models (gemma4) ignore `format` while thinking (ADR 0014).
          think: false,
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
      if (!response.body) throw new ModelTransportError("Ollama returned an empty body");
      const streamed = await readOllamaStream(response.body);
      return {
        content: streamed.content,
        usage: { inputTokens: streamed.inputTokens, outputTokens: streamed.outputTokens },
      };
    },
  };
}
