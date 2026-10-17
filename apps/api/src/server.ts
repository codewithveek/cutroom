import { loadEnv } from "@cutroom/config";
import { createLogger, initTracing } from "@cutroom/observability";
import { createPipelineServices, InProcessRunner } from "@cutroom/pipeline";
import { buildApp } from "./app";

const env = loadEnv();
initTracing({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
});
const logger = createLogger({ level: env.LOG_LEVEL, name: "cutroom-api" });
const services = createPipelineServices({ env, logger });
const runner = new InProcessRunner(services);

// Durability for the in-process runner: runs interrupted by a restart continue from their last step.
const interruptedStatuses = new Set([
  "queued",
  "ingesting",
  "analyzing",
  "planning",
  "auditing",
  "voicing",
  "rendering",
  "finalizing",
]);
for (const run of await services.store.list()) {
  if (interruptedStatuses.has(run.status)) {
    logger.info({ runId: run.id, status: run.status }, "resuming interrupted run");
    runner.resume(run.id);
  }
}

const app = await buildApp({ env, runner, store: services.store, logger: true });
await app.listen({ host: env.API_HOST, port: env.API_PORT });
