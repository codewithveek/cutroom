import { recordModelUsage, withModelCallSpan } from "@cutroom/observability";
import { z } from "zod";
import type {
  ChatMessage,
  GenerateStructuredOptions,
  JsonCompletionTransport,
  ModelClient,
  StructuredResult,
  TokenUsage,
} from "./model-client";

export const DEFAULT_MAX_ATTEMPTS = 3;

export class StructuredOutputError extends Error {
  override readonly name = "StructuredOutputError";
  readonly issues: ReadonlyArray<string>;
  readonly attempts: number;

  constructor(options: { operation: string; issues: ReadonlyArray<string>; attempts: number }) {
    super(`${options.operation}: model output still invalid after ${options.attempts} attempts`);
    this.issues = options.issues;
    this.attempts = options.attempts;
  }
}

/** Removes ```json fences and leading prose some models add despite structured output. */
export function extractJsonText(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? content).trim();
  const firstBrace = candidate.search(/[[{]/);
  return firstBrace > 0 ? candidate.slice(firstBrace) : candidate;
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const location = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${location}: ${issue.message}`;
  });
}

type ParseOutcome<Output> = { ok: true; output: Output } | { ok: false; issues: string[] };

function parseOutput<Output>(
  content: string,
  options: GenerateStructuredOptions<Output>,
): ParseOutcome<Output> {
  let json: unknown;
  try {
    json = JSON.parse(extractJsonText(content));
  } catch (error) {
    return {
      ok: false,
      issues: [`Output is not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
  const result = options.schema.safeParse(json);
  if (!result.success) return { ok: false, issues: formatZodIssues(result.error) };
  const semanticIssues = options.validate?.(result.data) ?? [];
  if (semanticIssues.length > 0) return { ok: false, issues: [...semanticIssues] };
  return { ok: true, output: result.data };
}

function repairMessage(issues: ReadonlyArray<string>): string {
  return [
    "Your previous JSON did not pass validation. Fix every issue below and return the complete corrected JSON only.",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

function addUsage(total: TokenUsage, usage: TokenUsage): TokenUsage {
  return {
    inputTokens: total.inputTokens + usage.inputTokens,
    outputTokens: total.outputTokens + usage.outputTokens,
  };
}

/**
 * Validate-and-repair loop (FR-SB-3): on failure, send the formatted issues back with the
 * previous output; at most `maxAttempts` tries, then fail with the issues attached.
 */
export async function generateWithRepair<Output>(
  transport: JsonCompletionTransport,
  options: GenerateStructuredOptions<Output>,
): Promise<StructuredResult<Output>> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const jsonSchema = z.toJSONSchema(options.schema, {
    target: "draft-7",
    io: "input",
    unrepresentable: "any",
  });
  const messages: ChatMessage[] = [...options.messages];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let lastIssues: ReadonlyArray<string> = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outcome = await withModelCallSpan(
      { providerId: transport.providerId, modelId: transport.modelId, operation: options.operation, attempt },
      async (span) => {
        const completion = await transport.complete({
          system: options.system,
          messages,
          jsonSchema: jsonSchema as Record<string, unknown>,
          schemaName: options.schemaName,
          temperature: options.temperature ?? 0.4,
          maxOutputTokens: options.maxOutputTokens ?? 4096,
        });
        const parsed = parseOutput(completion.content, options);
        recordModelUsage(span, { ...completion.usage, validationOutcome: parsed.ok ? "valid" : "invalid" });
        return { completion, parsed };
      },
    );
    usage = addUsage(usage, outcome.completion.usage);
    if (outcome.parsed.ok) return { output: outcome.parsed.output, usage, attempts: attempt };
    lastIssues = outcome.parsed.issues;
    messages.push({ role: "assistant", content: outcome.completion.content });
    messages.push({ role: "user", content: repairMessage(lastIssues) });
  }
  throw new StructuredOutputError({
    operation: options.operation,
    issues: lastIssues,
    attempts: maxAttempts,
  });
}

/** Wraps a transport into a ModelClient with the repair loop and tracing. */
export function createModelClientFromTransport(transport: JsonCompletionTransport): ModelClient {
  return {
    providerId: transport.providerId,
    modelId: transport.modelId,
    networkScope: transport.networkScope,
    generateStructured: (options) => generateWithRepair(transport, options),
  };
}
