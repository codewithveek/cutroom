import type { JsonCompletion, JsonCompletionRequest, JsonCompletionTransport } from "./model-client";

export type ScriptedResponder = (request: JsonCompletionRequest, callIndex: number) => unknown;

/**
 * A model that answers from a script: for tests, the CI end-to-end run and demos without
 * a GPU. It never touches the network.
 */
export function createScriptedTransport(
  responder: ScriptedResponder,
  modelId = "scripted",
): JsonCompletionTransport & {
  readonly requests: JsonCompletionRequest[];
} {
  const requests: JsonCompletionRequest[] = [];
  return {
    providerId: "scripted",
    modelId,
    networkScope: "none",
    requests,
    async complete(request): Promise<JsonCompletion> {
      requests.push(request);
      const answer = responder(request, requests.length - 1);
      const content = typeof answer === "string" ? answer : JSON.stringify(answer);
      return {
        content,
        usage: {
          inputTokens: Math.ceil(request.system.length / 4),
          outputTokens: Math.ceil(content.length / 4),
        },
      };
    },
  };
}
