import { loadEnv } from "@cutroom/config";
import { createLogger, initTracing } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  createSystemService,
  InProcessRunner,
  RenderJobWorker,
} from "@cutroom/pipeline";
import { buildApp } from "./app";

const env = loadEnv();
initTracing({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
});
const logger = createLogger({ level: env.LOG_LEVEL, name: "cutroom-api" });
const services = createPipelineServices({
  env,
  logger,
  overrides:
    env.MODEL_PROVIDER === "scripted-shipnote"
      ? { modelTransportOverride: createShipnoteScriptedTransport() }
      : {},
});
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

const renderJobWorker = env.RENDER_API_TOKEN
  ? new RenderJobWorker({
      dataDirectory: services.dataDirectory,
      browserExecutable: services.browserExecutable,
      logger,
    })
  : undefined;
if (renderJobWorker) {
  // Remote bundles are deleted 24 h after their job finishes (FR-PRV-6).
  setInterval(() => void renderJobWorker.sweep(), 60 * 60 * 1000).unref();
}

const app = await buildApp({
  env,
  runner,
  store: services.store,
  system: createSystemService(services),
  ...(renderJobWorker ? { renderJobWorker } : {}),
  logger: true,
});
await app.listen({ host: env.API_HOST, port: env.API_PORT });
