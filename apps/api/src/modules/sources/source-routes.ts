import { listTags, resolveSource } from "@cutroom/repo-ingest";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

/** Tags of a local repository, newest first, for "Changes since <tag>" (E2-6). */
export const sourceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/sources/tags",
    { schema: { querystring: z.object({ path: z.string().trim().min(1).max(1024) }) } },
    async (request) => {
      // Not a repository, or not a directory: no tags, so the composer shows no range chip.
      const source = await resolveSource({ kind: "path", path: request.query.path }).catch(() => undefined);
      return { tags: source ? await listTags(source.rootDirectory) : [] };
    },
  );
};
