import path from "node:path";
import { AuthService, type AuthStore, FileAuthStore } from "@cutroom/auth";
import { loadEnv, resolveAuthConfig } from "@cutroom/config";
import { PostgresAuthStore } from "@cutroom/db";
import { createLogger, initTracing } from "@cutroom/observability";
import { createSystemService, dataPaths, RenderJobWorker, seedDemoRuns } from "@cutroom/pipeline";
import { buildApp } from "./app";
import { createRunner } from "./create-runner";

const env = loadEnv();
// Before anything opens a port: an open public address or weak secrets stop the boot (E7-1).
const authConfig = resolveAuthConfig(env);
initTracing({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
});
const logger = createLogger({ level: env.LOG_LEVEL, name: "cutroom-api" });
const { runner, services, database, close } = await createRunner({ env, logger });
if (env.CUTROOM_DEMO_MODE) {
  logger.warn("demo mode: read-only, sample repository only, no login (D-1)");
  await seedDemoRuns({
    store: services.store,
    seedDirectory: path.resolve(env.CUTROOM_DEMO_SEED_DIR),
    logger,
  });
}

async function createAuthService(): Promise<AuthService | undefined> {
  if (authConfig.mode === "none") {
    logger.info("no login: the API is bound to a loopback address");
    return undefined;
  }
  const store: AuthStore = database
    ? new PostgresAuthStore({ database })
    : new FileAuthStore({ dataDirectory: path.resolve(env.CUTROOM_DATA_DIR) });
  const service = new AuthService({ store });
  const seeded = await service.seedAdmin(authConfig.admin);
  if (seeded === "created") logger.info({ email: authConfig.admin.email }, "created the admin account");
  if (seeded === "reset")
    logger.warn("CUTROOM_ADMIN_RESET applied the env password to the admin; unset it now");
  return service;
}
const authService = await createAuthService();

const renderJobWorker =
  env.RENDER_API_TOKEN && !env.CUTROOM_DEMO_MODE
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
  auth: { config: authConfig, service: authService },
  logger: true,
});
app.addHook("onClose", close);
await app.listen({ host: env.API_HOST, port: env.API_PORT });
logger.info({ runner: env.RUNNER, store: env.RUN_STORE }, "api listening");
