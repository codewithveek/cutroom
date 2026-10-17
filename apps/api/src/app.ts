import type { CutroomEnv } from "@cutroom/config";
import type { PipelineRunner, RunStore } from "@cutroom/pipeline";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { assetRoutes } from "./modules/assets/asset-routes";
import { catalogueRoutes } from "./modules/catalogue/catalogue-routes";
import { runRoutes } from "./modules/runs/run-routes";
import { registerErrorHandler } from "./plugins/error-handler";

export interface BuildAppOptions {
  env: CutroomEnv;
  runner: PipelineRunner;
  store: RunStore;
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
  await app.register(catalogueRoutes);
  await app.register(runRoutes, { runner: options.runner });
  await app.register(assetRoutes, { runner: options.runner, store: options.store });
  return app;
}
