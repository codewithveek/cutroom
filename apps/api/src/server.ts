import { loadEnv } from "@cutroom/config";
import { createLogger, initTracing } from "@cutroom/observability";
import { createSystemService, dataPaths, RenderJobWorker } from "@cutroom/pipeline";
import { buildApp } from "./app";
import { createRunner } from "./create-runner";

const env = loadEnv();
initTracing({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
});
const logger = createLogger({ level: env.LOG_LEVEL, name: "cutroom-api" });
const { runner, services, close } = await createRunner({ env, logger });

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
  uploadsDirectory: dataPaths(services.dataDirectory).uploads,
  ...(renderJobWorker ? { renderJobWorker } : {}),
  logger: true,
});
app.addHook("onClose", close);
await app.listen({ host: env.API_HOST, port: env.API_PORT });
logger.info({ runner: env.RUNNER, store: env.RUN_STORE }, "api listening");
