import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { extractZipArchive, uploadDirectory } from "@cutroom/repo-ingest";
import type { UploadResult } from "@cutroom/scene-spec";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ulid } from "ulid";
import { ApiError } from "../../plugins/error-handler";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export interface UploadRoutesOptions {
  uploadsDirectory: string;
}

/** Zip upload (FR-ING-1, P1): stored and extracted here, so a bad archive fails before a run starts. */
export const uploadRoutes: FastifyPluginAsyncZod<UploadRoutesOptions> = async (app, options) => {
  app.post("/uploads", async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
    if (!file)
      throw new ApiError({ code: "validation_failed", statusCode: 400, message: "Attach a .zip file" });
    const fileName = path.basename(file.filename);
    if (!/\.zip$/i.test(fileName)) {
      file.file.resume();
      throw new ApiError({
        code: "validation_failed",
        statusCode: 400,
        message: "Only .zip archives are accepted",
      });
    }
    const uploadId = ulid();
    const directory = uploadDirectory({ uploadsDirectory: options.uploadsDirectory, uploadId });
    await mkdir(directory, { recursive: true });
    const archivePath = path.join(directory, "archive.zip");
    await pipeline(file.file, createWriteStream(archivePath));
    if (file.file.truncated) {
      await rm(directory, { recursive: true, force: true });
      throw new ApiError({
        code: "validation_failed",
        statusCode: 413,
        message: `The archive is over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
      });
    }
    try {
      const extracted = await extractZipArchive({
        archivePath,
        destination: path.join(directory, "extracted"),
      });
      const result: UploadResult = { uploadId, fileName, ...extracted };
      return reply.status(201).send(result);
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  });
};
