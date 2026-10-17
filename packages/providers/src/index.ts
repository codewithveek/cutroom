export { EgressBlockedError, type EgressGuard, installLocalEgressGuard } from "./egress-guard";
export type {
  ChatMessage,
  GenerateStructuredOptions,
  JsonCompletion,
  JsonCompletionRequest,
  JsonCompletionTransport,
  ModelClient,
  StructuredResult,
  TokenUsage,
} from "./model-client";
export { createOllamaTransport, ModelTransportError } from "./ollama-transport";
export { createOpenAiCompatibleTransport } from "./openai-compatible-transport";
export {
  assertProviderAllowed,
  isLoopbackHost,
  isProviderAllowed,
  type NetworkScope,
  networkScopeForUrl,
  type PrivacyOptIns,
  PrivacyViolationError,
  type ProviderDeclaration,
  type ProviderRole,
} from "./privacy-guard";
export { type CreateModelClientOptions, createModelClient } from "./provider-factory";
export { createScriptedTransport, type ScriptedResponder } from "./scripted-transport";
export {
  createModelClientFromTransport,
  DEFAULT_MAX_ATTEMPTS,
  extractJsonText,
  formatZodIssues,
  generateWithRepair,
  StructuredOutputError,
} from "./structured-generation";
