import type { CodeChunk, CodeVectorIndex, NearestChunk } from "@cutroom/claim-audit";
import { and, cosineDistance, eq, inArray, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { DatabaseHandle } from "./database";
import { codeChunks, runs } from "./schema";

const EMBED_BATCH_SIZE = 64;
const DELETE_BATCH_SIZE = 500;

/** One project's code embeddings in pgvector: synced by content hash, searched by cosine distance. */
export class PgVectorCodeIndex implements CodeVectorIndex {
  readonly #database: DatabaseHandle;
  readonly #projectId: string;

  constructor(options: { database: DatabaseHandle; projectId: string }) {
    this.#database = options.database;
    this.#projectId = options.projectId;
  }

  async sync(options: {
    chunks: ReadonlyArray<CodeChunk>;
    embed: (texts: ReadonlyArray<string>) => Promise<number[][]>;
  }): Promise<{ embedded: number; removed: number }> {
    const { db } = this.#database;
    const stored = await db
      .select({ id: codeChunks.id, contentHash: codeChunks.contentHash })
      .from(codeChunks)
      .where(eq(codeChunks.projectId, this.#projectId));
    const storedHashes = new Set(stored.map((row) => row.contentHash));
    const currentHashes = new Set(options.chunks.map((chunk) => chunk.contentHash));
    const missing = [
      ...new Map(
        options.chunks
          .filter((chunk) => !storedHashes.has(chunk.contentHash))
          .map((chunk) => [chunk.contentHash, chunk]),
      ).values(),
    ];
    for (let start = 0; start < missing.length; start += EMBED_BATCH_SIZE) {
      const batch = missing.slice(start, start + EMBED_BATCH_SIZE);
      const vectors = await options.embed(batch.map((chunk) => chunk.content));
      await db
        .insert(codeChunks)
        .values(
          batch.map((chunk, position) => ({
            id: ulid(),
            projectId: this.#projectId,
            filePath: chunk.filePath,
            lineStart: chunk.lineStart,
            lineEnd: chunk.lineEnd,
            contentHash: chunk.contentHash,
            content: chunk.content,
            embedding: vectors[position] ?? [],
          })),
        )
        .onConflictDoNothing();
    }
    const staleIds = stored.filter((row) => !currentHashes.has(row.contentHash)).map((row) => row.id);
    for (let start = 0; start < staleIds.length; start += DELETE_BATCH_SIZE) {
      await db
        .delete(codeChunks)
        .where(
          and(
            eq(codeChunks.projectId, this.#projectId),
            inArray(codeChunks.id, staleIds.slice(start, start + DELETE_BATCH_SIZE)),
          ),
        );
    }
    return { embedded: missing.length, removed: staleIds.length };
  }

  async nearest(options: { vector: ReadonlyArray<number>; limit: number }): Promise<NearestChunk[]> {
    const distance = cosineDistance(codeChunks.embedding, [...options.vector]);
    const rows = await this.#database.db
      .select({
        filePath: codeChunks.filePath,
        lineStart: codeChunks.lineStart,
        lineEnd: codeChunks.lineEnd,
        content: codeChunks.content,
        similarity: sql<number>`1 - (${distance})`,
      })
      .from(codeChunks)
      .where(eq(codeChunks.projectId, this.#projectId))
      .orderBy(distance)
      .limit(options.limit);
    return rows.map(({ similarity, ...chunk }) => ({ chunk, similarity: Number(similarity) }));
  }
}

/** The code index of the project a run belongs to; undefined for an unknown run. */
export function codeIndexForRun(database: DatabaseHandle) {
  return async (runId: string): Promise<CodeVectorIndex | undefined> => {
    const [row] = await database.db
      .select({ projectId: runs.projectId })
      .from(runs)
      .where(eq(runs.id, runId));
    return row ? new PgVectorCodeIndex({ database, projectId: row.projectId }) : undefined;
  };
}
