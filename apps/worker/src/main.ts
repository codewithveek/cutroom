import path from "node:path";
import { loadEnv } from "@cutroom/config";
import { createDatabase, PostgresRunStore } from "@cutroom/db";
import { createLogger, flushTracing, initTracing } from "@cutroom/observability";
import { createPipelineServices, createShipnoteScriptedTransport } from "@cutroom/pipeline";
import { createPipelineWorker } from "@cutroom/temporal";

const env = loadEnv();
initTracing({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
});
const logger = createLogger({ level: env.LOG_LEVEL, name: "cutroom-worker" });
if (env.RUNNER !== "temporal") {
  logger.info("RUNNER is in-process: the API runs pipeline steps itself, so this worker has nothing to do");
  process.exit(0);
}
if (!env.DATABASE_URL)
  throw new Error("The worker needs DATABASE_URL: it shares the run store with the API.");

const database = createDatabase({ connectionString: env.DATABASE_URL });
const store = new PostgresRunStore({
  database,
  filesRoot: path.join(path.resolve(env.CUTROOM_DATA_DIR), "runs"),
});
const services = createPipelineServices({
  env,
  logger,
  overrides: {
    store,
    ...(env.MODEL_PROVIDER === "scripted-shipnote"
      ? { modelTransportOverride: createShipnoteScriptedTransport() }
      : {}),
  },
});

const { worker, connection } = await createPipelineWorker({
  services,
  address: env.TEMPORAL_ADDRESS,
  namespace: env.TEMPORAL_NAMESPACE,
  taskQueue: env.TEMPORAL_TASK_QUEUE,
});
logger.info({ taskQueue: env.TEMPORAL_TASK_QUEUE, address: env.TEMPORAL_ADDRESS }, "worker polling");
try {
  // Runs until SIGINT/SIGTERM; in-flight activities are retried on another worker after a crash.
  await worker.run();
} finally {
  await connection.close();
  await store.close();
  await database.close();
  await flushTracing();
}
