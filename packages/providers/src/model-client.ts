import type { z } from "zod";
import type { NetworkScope } from "./privacy-guard";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface JsonCompletionRequest {
  system: string;
  messages: ReadonlyArray<ChatMessage>;
  /** JSON Schema generated from the Zod schema the output must satisfy. */
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface JsonCompletion {
  content: string;
  usage: TokenUsage;
}

/** The wire-level half of a model client: one request, one JSON string back. */
export interface JsonCompletionTransport {
  readonly providerId: string;
  readonly modelId: string;
  readonly networkScope: NetworkScope;
  complete(request: JsonCompletionRequest): Promise<JsonCompletion>;
}

export interface GenerateStructuredOptions<Output> {
  schema: z.ZodType<Output>;
  schemaName: string;
  system: string;
  messages: ReadonlyArray<ChatMessage>;
  /** Checks Zod cannot express (word budgets…). Returned problems trigger a repair attempt. */
  validate?: (output: Output) => ReadonlyArray<string>;
  temperature?: number;
  maxOutputTokens?: number;
  maxAttempts?: number;
  /** Labels the span, e.g. "plan-storyboard". */
  operation: string;
}

export interface StructuredResult<Output> {
  output: Output;
  usage: TokenUsage;
  attempts: number;
}

export interface ModelClient {
  readonly providerId: string;
  readonly modelId: string;
  readonly networkScope: NetworkScope;
  generateStructured<Output>(options: GenerateStructuredOptions<Output>): Promise<StructuredResult<Output>>;
}
