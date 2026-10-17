import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { PipelineRunner, RunStore } from "@cutroom/pipeline";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError } from "../../plugins/error-handler";

const contentTypes: Readonly<Record<string, string>> = {
  ".mp4": "video/mp4",
  ".vtt": "text/vtt; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json",
};

export interface ByteRange {
  start: number;
  end: number;
}

/** Parses a single `bytes=start-end` range; undefined when absent or unsatisfiable. */
export function parseRangeHeader(header: string | undefined, size: number): ByteRange | undefined {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return undefined;
  const [, startText = "", endText = ""] = match;
  if (!startText && !endText) return undefined;
  const start = startText ? Number(startText) : Math.max(0, size - Number(endText));
  const end = startText && endText ? Math.min(Number(endText), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : undefined;
}

export interface AssetRoutesOptions {
  runner: PipelineRunner;
  store: RunStore;
}

/** Streams deliverables with HTTP range support; only files inside the run's directory (NFR security). */
export const assetRoutes: FastifyPluginAsyncZod<AssetRoutesOptions> = async (app, options) => {
  app.get(
    "/runs/:runId/assets/:assetId",
    {
      schema: {
        params: z.object({
          runId: z.string().regex(/^[0-9A-Z]{26}$/),
          assetId: z.string().regex(/^[0-9A-Z]{26}$/),
        }),
      },
    },
    async (request, reply) => {
      const run = await options.runner.getRun(request.params.runId);
      const asset = run?.assets.find((candidate) => candidate.id === request.params.assetId);
      if (!run || !asset)
        throw new ApiError({ code: "not_found", statusCode: 404, message: "Asset not found" });
      const runDirectory = path.resolve(options.store.runDirectory(run.id));
      const filePath = path.resolve(asset.filePath);
      if (!filePath.startsWith(`${runDirectory}${path.sep}`)) {
        throw new ApiError({ code: "not_found", statusCode: 404, message: "Asset not found" });
      }
      const { size } = await stat(filePath);
      const contentType = contentTypes[path.extname(filePath)] ?? "application/octet-stream";
      void reply.header("accept-ranges", "bytes").header("content-type", contentType);
      if (request.query && "download" in (request.query as Record<string, unknown>)) {
        void reply.header("content-disposition", `attachment; filename="${path.basename(filePath)}"`);
      }
      const range = parseRangeHeader(request.headers.range, size);
      if (request.headers.range && !range) {
        return reply.status(416).header("content-range", `bytes */${size}`).send();
      }
      if (range) {
        return reply
          .status(206)
          .header("content-range", `bytes ${range.start}-${range.end}/${size}`)
          .header("content-length", range.end - range.start + 1)
          .send(createReadStream(filePath, range));
      }
      return reply.header("content-length", size).send(createReadStream(filePath));
    },
  );
};
