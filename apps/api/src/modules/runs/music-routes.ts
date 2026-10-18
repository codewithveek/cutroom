import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { PipelineRunner } from "@cutroom/pipeline";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../../plugins/error-handler";
import { toRunView } from "./run-view";

export const MAX_MUSIC_BYTES = 30 * 1024 * 1024;
const audioFileName = /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus)$/i;

/** POST /runs/:runId/music: the user's own track becomes the run's music bed (until approval). */
export const musicRoutes: FastifyPluginAsyncZod<{ runner: PipelineRunner }> = async (app, options) => {
  app.post(
    "/runs/:runId/music",
    { schema: { params: z.object({ runId: z.string().regex(/^[0-9A-Z]{26}$/) }) } },
    async (request) => {
      const file = await request.file({ limits: { fileSize: MAX_MUSIC_BYTES, files: 1 } });
      if (!file)
        throw new ApiError({ code: "validation_failed", statusCode: 400, message: "Attach an audio file" });
      const fileName = path.basename(file.filename);
      if (!audioFileName.test(fileName)) {
        file.file.resume();
        throw new ApiError({
          code: "validation_failed",
          statusCode: 400,
          message: "Upload mp3, wav, m4a, aac, ogg, opus or flac",
        });
      }
      const workDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-music-"));
      try {
        const sourcePath = path.join(workDirectory, `upload${path.extname(fileName).toLowerCase()}`);
        await pipeline(file.file, createWriteStream(sourcePath));
        if (file.file.truncated)
          throw new ApiError({
            code: "validation_failed",
            statusCode: 413,
            message: "The track is over 30 MB",
          });
        await options.runner.attachMusic(request.params.runId, { sourcePath, fileName });
      } finally {
        await rm(workDirectory, { recursive: true, force: true });
      }
      const run = await options.runner.getRun(request.params.runId);
      if (!run) throw new ApiError({ code: "not_found", statusCode: 404, message: "Run not found" });
      return toRunView(run);
    },
  );
};
