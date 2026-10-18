import { chunkRepoFiles } from "@cutroom/claim-audit";
import { CODE_EMBEDDING_DIMENSIONS, createHashingEmbeddingClient } from "@cutroom/providers";
import { sql } from "drizzle-orm";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle, runMigrations } from "./database";
import { PgVectorCodeIndex } from "./pgvector-code-index";
import { projects } from "./schema";

const connectionString = process.env.CUTROOM_TEST_DATABASE_URL;

describe.skipIf(!connectionString)("PgVectorCodeIndex", () => {
  let database: DatabaseHandle;
  let index: PgVectorCodeIndex;
  const embedder = createHashingEmbeddingClient({ dimensions: CODE_EMBEDDING_DIMENSIONS });
  const embed = (texts: ReadonlyArray<string>) => embedder.embed(texts);
  const chunksOf = (files: Array<{ path: string; content: string }>) =>
    chunkRepoFiles({ files, embeddingModelId: embedder.modelId });

  beforeAll(async () => {
    database = createDatabase({ connectionString: connectionString ?? "" });
    await runMigrations(database.db);
    const projectId = ulid();
    await database.db
      .insert(projects)
      .values({ id: projectId, name: "vectors", sourceType: "path", sourceRef: `/tmp/${projectId}` });
    index = new PgVectorCodeIndex({ database, projectId });
  });

  afterAll(async () => {
    await database?.db.execute(sql`delete from projects where name = 'vectors'`);
    await database?.close();
  });

  it("embeds new chunks once, drops stale ones and finds the nearest by cosine distance", async () => {
    const files = [
      { path: "src/group-commits.ts", content: "export function groupCommitsByType(commits) {}" },
      { path: "src/loudness.ts", content: "export function measureLoudness(file) {}" },
    ];
    expect(await index.sync({ chunks: chunksOf(files), embed })).toEqual({ embedded: 2, removed: 0 });
    expect(await index.sync({ chunks: chunksOf(files), embed })).toEqual({ embedded: 0, removed: 0 });

    const [vector] = await embedder.embed(["groups commits by type"]);
    const [nearest] = await index.nearest({ vector: vector ?? [], limit: 1 });
    expect(nearest?.chunk.filePath).toBe("src/group-commits.ts");
    expect(nearest?.similarity).toBeGreaterThan(0.2);

    const changed = [
      files[0] ?? files[1],
      { path: "src/loudness.ts", content: "export const target = -16;" },
    ];
    expect(
      await index.sync({ chunks: chunksOf(changed.filter((file) => file !== undefined)), embed }),
    ).toEqual({
      embedded: 1,
      removed: 1,
    });
  });
});
