import { timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { RenderJobIntegrityError, type RenderJobWorker, type UploadedFile } from "@cutroom/pipeline";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../../plugins/error-handler";

const MAX_BUNDLE_BYTES = 200 * 1024 * 1024;

export interface RenderJobRoutesOptions {
  worker: RenderJobWorker;
  /** Per-user API token; the remote render API is disabled without one. */
  token: string | undefined;
}

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function requireBearer(request: FastifyRequest, token: string | undefined): void {
  if (!token)
    throw new ApiError({
      code: "not_found",
      statusCode: 404,
      message: "The remote render API is not enabled on this server",
    });
  const provided = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!provided || !tokensMatch(token, provided)) {
    throw new ApiError({
      code: "unauthorized",
      statusCode: 401,
      message: "A valid render API token is required",
    });
  }
}

const jobParamsSchema = z.object({ jobId: z.string().regex(/^[0-9A-Za-z_-]{1,64}$/) });

/** The remote render API (PRD §8.7, Hybrid mode): verified uploads in, rendered files out. */
export const renderJobRoutes: FastifyPluginAsyncZod<RenderJobRoutesOptions> = async (app, options) => {
  app.post("/render-jobs", async (request, reply) => {
    requireBearer(request, options.token);
    let jobJson: string | undefined;
    const files: UploadedFile[] = [];
    for await (const part of request.parts({ limits: { fileSize: MAX_BUNDLE_BYTES } })) {
      if (part.type !== "file") continue;
      const content = await part.toBuffer();
      if (part.fieldname === "job") jobJson = content.toString("utf8");
      else files.push({ path: part.fieldname, content });
    }
    if (!jobJson)
      throw new ApiError({
        code: "validation_failed",
        statusCode: 400,
        message: "The upload has no render-job.json",
      });
    try {
      const job = await options.worker.accept({ jobJson, files });
      return reply.status(202).send({ jobId: job.jobId });
    } catch (error) {
      if (error instanceof RenderJobIntegrityError || error instanceof z.ZodError) {
        throw new ApiError({ code: "validation_failed", statusCode: 400, message: error.message });
      }
      throw error;
    }
  });

  app.get("/render-jobs/:jobId", { schema: { params: jobParamsSchema } }, async (request) => {
    requireBearer(request, options.token);
    const status = await options.worker.status(request.params.jobId);
    if (!status) throw new ApiError({ code: "not_found", statusCode: 404, message: "Render job not found" });
    return status;
  });

  app.get(
    "/render-jobs/:jobId/files/:fileName",
    { schema: { params: jobParamsSchema.extend({ fileName: z.string().regex(/^[A-Za-z0-9._-]+$/) }) } },
    async (request, reply) => {
      requireBearer(request, options.token);
      const filePath = await options.worker.outputPath(request.params.jobId, request.params.fileName);
      if (!filePath) throw new ApiError({ code: "not_found", statusCode: 404, message: "File not found" });
      return reply.header("content-type", "application/octet-stream").send(createReadStream(filePath));
    },
  );
};
