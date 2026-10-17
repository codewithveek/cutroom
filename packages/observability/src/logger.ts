import { type Logger, type LoggerOptions, pino } from "pino";

export type CutroomLogger = Logger;

/** Fields that may carry secrets. pino replaces them before a line is written. */
export const redactedLogPaths: ReadonlyArray<string> = [
  "apiKey",
  "token",
  "authorization",
  "password",
  "secret",
  "*.apiKey",
  "*.token",
  "*.authorization",
  "*.password",
  "*.secret",
  "headers.authorization",
  "req.headers.authorization",
  "env.ELEVENLABS_API_KEY",
  "env.OPENAI_COMPAT_API_KEY",
  "env.RENDER_API_TOKEN",
];

export interface CreateLoggerOptions {
  level?: LoggerOptions["level"];
  name?: string;
  destination?: pino.DestinationStream;
}

export function createLogger(options: CreateLoggerOptions = {}): CutroomLogger {
  const loggerOptions: LoggerOptions = {
    level: options.level ?? "info",
    name: options.name ?? "cutroom",
    redact: { paths: [...redactedLogPaths], censor: "‹redacted›" },
  };
  return options.destination ? pino(loggerOptions, options.destination) : pino(loggerOptions);
}

export interface StepLogContext {
  runId: string;
  step: string;
}

/** Every pipeline log line carries runId and step (FR-OBS-1). */
export function createStepLogger(parent: CutroomLogger, context: StepLogContext): CutroomLogger {
  return parent.child({ runId: context.runId, step: context.step });
}
