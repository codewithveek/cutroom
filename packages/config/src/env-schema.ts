import { z } from "zod";

const optionalUrl = z.url().optional();
const optionalSecret = z.string().min(1).optional();

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
    CUTROOM_DATA_DIR: z.string().min(1).default(".cutroom"),

    OLLAMA_HOST: z.url().default("http://127.0.0.1:11434"),
    MODEL_ID: z.string().min(1).default("gemma4:e4b"),
    /** `scripted-shipnote` answers from a script for the shipnote fixture (demos and UI work without a GPU). */
    MODEL_PROVIDER: z.enum(["auto", "scripted-shipnote"]).default("auto"),
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

    /** `file` keeps runs in CUTROOM_DATA_DIR; `postgres` uses DATABASE_URL (needed by the Temporal runner). */
    RUN_STORE: z.enum(["file", "postgres"]).default("file"),
    DATABASE_URL: z.string().min(1).optional(),
    /** `in-process` runs steps in the API; `temporal` hands runs to a worker (apps/worker) for durability. */
    RUNNER: z.enum(["in-process", "temporal"]).default("in-process"),
    TEMPORAL_ADDRESS: z.string().min(1).default("127.0.0.1:7233"),
    TEMPORAL_NAMESPACE: z.string().min(1).default("default"),
    TEMPORAL_TASK_QUEUE: z.string().min(1).default("cutroom-pipeline"),
    /** Temporal Cloud: an API key switches the connection to TLS (docs/deploy.md). */
    TEMPORAL_API_KEY: optionalSecret,

    /**
     * Code retrieval for the claim judge (FR-ING-6), stored in pgvector: `ollama` embeds with
     * EMBEDDING_MODEL_ID (768 dimensions), `hashing` is an offline stand-in, `off` keeps grep only.
     */
    EMBEDDINGS: z.enum(["off", "ollama", "hashing"]).default("off"),
    EMBEDDING_MODEL_ID: z.string().min(1).default("nomic-embed-text"),

    BROWSER_EXECUTABLE: z.string().min(1).optional(),
    SENTRY_DSN: optionalUrl,
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
  })
  .superRefine((env, context) => {
    if ((env.RUN_STORE === "postgres" || env.RUNNER === "temporal") && !env.DATABASE_URL)
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "Required for RUN_STORE=postgres and RUNNER=temporal",
      });
    if (env.EMBEDDINGS !== "off" && env.RUN_STORE !== "postgres")
      context.addIssue({
        code: "custom",
        path: ["EMBEDDINGS"],
        message: "Embeddings are stored in pgvector: set RUN_STORE=postgres",
      });
    if (env.RUNNER === "temporal" && env.RUN_STORE !== "postgres")
      context.addIssue({
        code: "custom",
        path: ["RUN_STORE"],
        message: "RUNNER=temporal needs RUN_STORE=postgres: the API and the worker share the run store",
      });
  });

export type CutroomEnv = z.infer<typeof envSchema>;
