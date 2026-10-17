import type { CutroomEnv } from "@cutroom/config";
import type { PipelineRunner, RenderJobWorker, RunStore } from "@cutroom/pipeline";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { assetRoutes } from "./modules/assets/asset-routes";
import { catalogueRoutes } from "./modules/catalogue/catalogue-routes";
import { renderJobRoutes } from "./modules/render-jobs/render-job-routes";
import { runRoutes } from "./modules/runs/run-routes";
import { registerErrorHandler } from "./plugins/error-handler";

export interface BuildAppOptions {
  env: CutroomEnv;
  runner: PipelineRunner;
  store: RunStore;
  /** Enables the remote render API (Hybrid mode's render half) when a token is configured. */
  renderJobWorker?: RenderJobWorker;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ? { level: options.env.LOG_LEVEL, redact: ["req.headers.authorization"] } : false,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  await app.register(cors, { origin: [options.env.WEB_ORIGIN] });
  await app.register(multipart);
  await app.register(catalogueRoutes);
  await app.register(runRoutes, { runner: options.runner });
  await app.register(assetRoutes, { runner: options.runner, store: options.store });
  if (options.renderJobWorker) {
    await app.register(renderJobRoutes, {
      worker: options.renderJobWorker,
      token: options.env.RENDER_API_TOKEN,
    });
  }
  return app;
}
