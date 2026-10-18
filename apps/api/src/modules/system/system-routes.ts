import { createReadStream } from "node:fs";
import type { CutroomEnv } from "@cutroom/config";
import type { RunStore, SystemService } from "@cutroom/pipeline";
import type { Health } from "@cutroom/scene-spec";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

export interface SystemRoutesOptions {
  system: SystemService;
  store: RunStore;
  env: CutroomEnv;
}

async function databaseState(options: SystemRoutesOptions): Promise<Health["database"]> {
  if (options.env.RUN_STORE !== "postgres") return "not-used";
  return options.store.list().then(
    () => "ready" as const,
    () => "down" as const,
  );
}

/** Liveness plus readiness detail: 503 only when the store is unreachable, so a new deploy still boots. */
async function health(options: SystemRoutesOptions): Promise<Health> {
  const [database, status] = await Promise.all([databaseState(options), options.system.status()]);
  const checks = status.checks.map(({ id, state, detail }) => ({ id, state, detail }));
  return {
    status:
      database === "down" ? "down" : checks.some((check) => check.state === "missing") ? "degraded" : "ok",
    runner: options.env.RUNNER,
    database,
    checks,
  };
}

/** Toolchain health and voice previews for the dashboard, editor and settings screens. */
export const systemRoutes: FastifyPluginAsyncZod<SystemRoutesOptions> = async (app, options) => {
  app.get("/health", async (_request, reply) => {
    const report = await health(options);
    return reply.status(report.status === "down" ? 503 : 200).send(report);
  });

  app.get("/system/status", async () => options.system.status());

  app.get("/voices", async () => ({ voices: options.system.voices() }));

  app.get(
    "/voices/:voiceId/sample",
    { schema: { params: z.object({ voiceId: z.string().regex(/^[a-z]{2}_[a-z]+$/) }) } },
    async (request, reply) => {
      const samplePath = await options.system.voiceSample(request.params.voiceId);
      return reply
        .header("content-type", "audio/wav")
        .header("cache-control", "public, max-age=86400")
        .send(createReadStream(samplePath));
    },
  );
};
