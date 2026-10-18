import { createReadStream } from "node:fs";
import type { SystemService } from "@cutroom/pipeline";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

export interface SystemRoutesOptions {
  system: SystemService;
}

/** Toolchain health and voice previews for the dashboard, editor and settings screens. */
export const systemRoutes: FastifyPluginAsyncZod<SystemRoutesOptions> = async (app, options) => {
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
