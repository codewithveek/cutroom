import * as Sentry from "@sentry/node";

export interface InitTracingOptions {
  dsn: string | undefined;
  environment: string;
  tracesSampleRate: number;
}

/** Sentry is optional: without a DSN, spans are no-ops and nothing leaves the machine. */
export function initTracing(options: InitTracingOptions): boolean {
  if (!options.dsn) return false;
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    tracesSampleRate: options.tracesSampleRate,
  });
  return true;
}

export type SpanAttributeValue = string | number | boolean;
export type SpanAttributes = Record<string, SpanAttributeValue | undefined>;

export interface SpanHandle {
  setAttributes(attributes: SpanAttributes): void;
}

export interface WithSpanOptions {
  name: string;
  op: string;
  attributes?: SpanAttributes;
}

function definedAttributes(attributes: SpanAttributes): Record<string, SpanAttributeValue> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, SpanAttributeValue] => entry[1] !== undefined,
    ),
  );
}

export function withSpan<Result>(
  options: WithSpanOptions,
  work: (span: SpanHandle) => Promise<Result>,
): Promise<Result> {
  return Sentry.startSpan(
    { name: options.name, op: options.op, attributes: definedAttributes(options.attributes ?? {}) },
    (span) =>
      work({
        setAttributes: (attributes) => span.setAttributes(definedAttributes(attributes)),
      }),
  );
}

export interface PipelineStepSpanOptions {
  runId: string;
  step: string;
}

export function withPipelineStepSpan<Result>(
  options: PipelineStepSpanOptions,
  work: (span: SpanHandle) => Promise<Result>,
): Promise<Result> {
  return withSpan(
    {
      name: `pipeline.${options.step}`,
      op: "cutroom.pipeline.step",
      attributes: { "cutroom.run_id": options.runId, "cutroom.step": options.step },
    },
    work,
  );
}

export interface ModelCallSpanOptions {
  providerId: string;
  modelId: string;
  operation: string;
  attempt: number;
}

/** Uses Sentry's gen_ai span conventions so calls show up in Agent Tracing (FR-OBS-2). */
export function withModelCallSpan<Result>(
  options: ModelCallSpanOptions,
  work: (span: SpanHandle) => Promise<Result>,
): Promise<Result> {
  return withSpan(
    {
      name: `chat ${options.modelId}`,
      op: "gen_ai.chat",
      attributes: {
        "gen_ai.system": options.providerId,
        "gen_ai.request.model": options.modelId,
        "gen_ai.operation.name": "chat",
        "cutroom.model_operation": options.operation,
        "cutroom.attempt": options.attempt,
      },
    },
    work,
  );
}

export interface TokenUsageAttributes {
  inputTokens: number;
  outputTokens: number;
  validationOutcome: "valid" | "invalid";
}

export function recordModelUsage(span: SpanHandle, usage: TokenUsageAttributes): void {
  span.setAttributes({
    "gen_ai.usage.input_tokens": usage.inputTokens,
    "gen_ai.usage.output_tokens": usage.outputTokens,
    "cutroom.validation_outcome": usage.validationOutcome,
  });
}

export function captureError(error: unknown): void {
  Sentry.captureException(error);
}

export function flushTracing(timeoutMs = 2000): Promise<boolean> {
  return Sentry.flush(timeoutMs);
}
