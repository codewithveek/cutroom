import { z } from "zod";
import type { JsonCompletion, JsonCompletionRequest, JsonCompletionTransport } from "./model-client";
import { ModelTransportError } from "./ollama-transport";
import { networkScopeForUrl } from "./privacy-guard";

const chatCompletionResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

export interface OpenAiCompatibleTransportOptions {
  baseUrl: string;
  apiKey: string | undefined;
  modelId: string;
  fetchImplementation?: typeof fetch;
}

/** Gemma served by vLLM or a GPU droplet, with `response_format: json_schema` (Cloud mode). */
export function createOpenAiCompatibleTransport(
  options: OpenAiCompatibleTransportOptions,
): JsonCompletionTransport {
  const fetchImplementation = options.fetchImplementation ?? ((input, init) => fetch(input, init));
  const endpoint = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
  return {
    providerId: "openai-compatible",
    modelId: options.modelId,
    networkScope: networkScopeForUrl(options.baseUrl),
    async complete(request: JsonCompletionRequest): Promise<JsonCompletion> {
      const response = await fetchImplementation(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: options.modelId,
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          messages: [{ role: "system", content: request.system }, ...request.messages],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, schema: request.jsonSchema, strict: false },
          },
        }),
      });
      if (!response.ok) {
        throw new ModelTransportError(`Model endpoint returned ${response.status}`, response.status);
      }
      const body = chatCompletionResponseSchema.parse(await response.json());
      return {
        content: body.choices[0]?.message.content ?? "",
        usage: {
          inputTokens: body.usage?.prompt_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
