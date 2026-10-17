import { z } from "zod";

const optionalUrl = z.url().optional();
const optionalSecret = z.string().min(1).optional();

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
  CUTROOM_DATA_DIR: z.string().min(1).default(".cutroom"),

  OLLAMA_HOST: z.url().default("http://127.0.0.1:11434"),
  MODEL_ID: z.string().min(1).default("gemma4:e4b"),
  MODEL_CONTEXT_BUDGET_TOKENS: z.coerce.number().int().positive().default(24_000),

  OPENAI_COMPAT_BASE_URL: optionalUrl,
  OPENAI_COMPAT_API_KEY: optionalSecret,
  OPENAI_COMPAT_MODEL_ID: z.string().min(1).optional(),

  KOKORO_MODEL_ID: z.string().min(1).default("onnx-community/Kokoro-82M-v1.0-ONNX"),
  KOKORO_DTYPE: z.enum(["fp32", "fp16", "q8", "q4", "q4f16"]).default("q8"),
  ELEVENLABS_API_KEY: optionalSecret,

  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4100),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  RENDER_API_BASE_URL: optionalUrl,
  RENDER_API_TOKEN: optionalSecret,

  BROWSER_EXECUTABLE: z.string().min(1).optional(),
  SENTRY_DSN: optionalUrl,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
});

export type CutroomEnv = z.infer<typeof envSchema>;
