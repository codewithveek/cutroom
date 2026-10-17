import { type PipelineRunner, runRequestSchema } from "@cutroom/pipeline";
import { claimOverrideSchema, storyboardSchema } from "@cutroom/scene-spec";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../../plugins/error-handler";
import { toRunView } from "./run-view";

const runParamsSchema = z.object({ runId: z.string().regex(/^[0-9A-Z]{26}$/, "Expected a ULID") });

export interface RunRoutesOptions {
  runner: PipelineRunner;
}

export const runRoutes: FastifyPluginAsyncZod<RunRoutesOptions> = async (app, options) => {
  const { runner } = options;

  async function requireRun(runId: string) {
    const run = await runner.getRun(runId);
    if (!run) throw new ApiError({ code: "not_found", statusCode: 404, message: `Run ${runId} not found` });
    return run;
  }

  app.post("/runs", { schema: { body: runRequestSchema } }, async (request, reply) => {
    const { runId } = await runner.start(request.body);
    return reply.status(201).send(toRunView(await requireRun(runId)));
  });

  app.get("/runs", async () => ({ runs: (await runner.listRuns()).map(toRunView) }));

  app.get("/runs/:runId", { schema: { params: runParamsSchema } }, async (request) =>
    toRunView(await requireRun(request.params.runId)),
  );

  app.put(
    "/runs/:runId/storyboard",
    { schema: { params: runParamsSchema, body: z.object({ storyboard: storyboardSchema }) } },
    async (request) => {
      await requireRun(request.params.runId);
      await runner.updateStoryboard(request.params.runId, request.body.storyboard);
      return toRunView(await requireRun(request.params.runId));
    },
  );

  app.post(
    "/runs/:runId/approve",
    {
      schema: {
        params: runParamsSchema,
        body: z.object({ versionId: z.string().min(1), overrides: z.array(claimOverrideSchema).default([]) }),
      },
    },
    async (request) => {
      await runner.approveStoryboard(request.params.runId, request.body);
      return toRunView(await requireRun(request.params.runId));
    },
  );

  app.post(
    "/runs/:runId/scenes/:sceneId/regenerate",
    {
      schema: {
        params: runParamsSchema.extend({ sceneId: z.string().min(1).max(64) }),
        body: z.object({ instruction: z.string().max(300).optional() }).default({}),
      },
    },
    async (request) => {
      await runner.regenerateScene(request.params.runId, {
        sceneId: request.params.sceneId,
        instruction: request.body.instruction,
      });
      return toRunView(await requireRun(request.params.runId));
    },
  );

  app.post(
    "/runs/:runId/confirm-egress",
    {
      schema: {
        params: runParamsSchema,
        body: z.object({ manifestSha256: z.string().regex(/^[0-9a-f]{64}$/) }),
      },
    },
    async (request) => {
      await runner.confirmEgress(request.params.runId, request.body.manifestSha256);
      return toRunView(await requireRun(request.params.runId));
    },
  );

  /** Server-sent events: the run timeline in the browser (FR-OBS-3). Replays history first. */
  app.get("/runs/:runId/events", { schema: { params: runParamsSchema } }, async (request, reply) => {
    const { runId } = request.params;
    await requireRun(runId);
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": reply.getHeader("access-control-allow-origin")?.toString() ?? "*",
    });
    const send = (event: unknown) => reply.raw.write(`event: run-event\ndata: ${JSON.stringify(event)}\n\n`);
    for (const event of await runner.listEvents(runId)) send(event);
    const unsubscribe = runner.subscribe(runId, send);
    const heartbeat = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15_000);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
    return reply;
  });
};
