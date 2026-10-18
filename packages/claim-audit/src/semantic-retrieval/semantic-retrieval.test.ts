import { createHashingEmbeddingClient } from "@cutroom/providers";
import type { Claim } from "@cutroom/scene-spec";
import { describe, expect, it } from "vitest";
import type { RepoTextIndex } from "../audit-context";
import { type CodeChunk, chunkRepoFiles } from "./code-chunks";
import {
  type CodeVectorIndex,
  createSemanticRetriever,
  mergeSnippets,
  type NearestChunk,
} from "./semantic-retriever";

/** The pgvector index's behaviour, in memory. */
function createMemoryIndex(): CodeVectorIndex & {
  stored: Map<string, { chunk: CodeChunk; vector: number[] }>;
} {
  const stored = new Map<string, { chunk: CodeChunk; vector: number[] }>();
  return {
    stored,
    async sync({ chunks, embed }) {
      const missing = chunks.filter((chunk) => !stored.has(chunk.contentHash));
      const vectors = await embed(missing.map((chunk) => chunk.content));
      for (const [position, chunk] of missing.entries())
        stored.set(chunk.contentHash, { chunk, vector: vectors[position] ?? [] });
      const current = new Set(chunks.map((chunk) => chunk.contentHash));
      const stale = [...stored.keys()].filter((hash) => !current.has(hash));
      for (const hash of stale) stored.delete(hash);
      return { embedded: missing.length, removed: stale.length };
    },
    async nearest({ vector, limit }): Promise<NearestChunk[]> {
      return [...stored.values()]
        .map(({ chunk, vector: stored }) => ({
          chunk,
          similarity: stored.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0),
        }))
        .toSorted((left, right) => right.similarity - left.similarity)
        .slice(0, limit);
    },
  };
}

const files = [
  {
    path: "src/group-commits.ts",
    content: Array.from({ length: 60 }, (_, line) =>
      line === 45
        ? "export function groupCommitsByType(commits) {}"
        : line === 9
          ? 'import { readTags } from "./git";'
          : "",
    ).join("\n"),
  },
  { path: "src/loudness.ts", content: "export function measureLoudness(file) {}\n" },
];
const repoText: RepoTextIndex = {
  uiStrings: new Set(),
  commands: new Set(),
  files,
  productNames: new Set(["shipnote"]),
};

function claim(text: string): Claim {
  return { id: "claim-1", sceneId: "scene-1", fieldPath: "props.heading", text, kind: "text" };
}

describe("chunkRepoFiles", () => {
  it("cuts overlapping windows and hashes them with the model id", () => {
    const chunks = chunkRepoFiles({ files, embeddingModelId: "model-a" });
    expect(chunks.map((chunk) => [chunk.filePath, chunk.lineStart, chunk.lineEnd])).toEqual([
      ["src/group-commits.ts", 1, 40],
      ["src/group-commits.ts", 31, 60],
      ["src/loudness.ts", 1, 2],
    ]);
    const otherModel = chunkRepoFiles({ files, embeddingModelId: "model-b" });
    expect(otherModel[0]?.contentHash).not.toBe(chunks[0]?.contentHash);
  });
});

describe("createSemanticRetriever", () => {
  it("syncs once, embeds only new chunks and focuses each hit on the lines that match", async () => {
    const index = createMemoryIndex();
    const syncs: number[] = [];
    const retriever = createSemanticRetriever({
      index,
      embedder: createHashingEmbeddingClient({ dimensions: 128 }),
      repoText,
      onSynced: (stats) => syncs.push(stats.embedded),
    });
    const found = await retriever.retrieve({ claims: [claim("Groups commits by type")], limit: 2 });
    await retriever.retrieve({ claims: [claim("Measures loudness")], limit: 2 });
    expect(syncs).toEqual([3]);
    const [best] = found.get("claim-1") ?? [];
    expect(best?.filePath).toBe("src/group-commits.ts");
    expect(best?.text).toContain("groupCommitsByType");
    expect((best?.lineEnd ?? 0) - (best?.lineStart ?? 0)).toBeLessThan(8);
  });
});

describe("mergeSnippets", () => {
  it("keeps keyword hits first and adds semantic hits from other places", () => {
    const snippet = (filePath: string, lineStart: number) => ({
      filePath,
      lineStart,
      lineEnd: lineStart + 2,
      text: "",
      score: 1,
    });
    const merged = mergeSnippets({
      keyword: [snippet("a.ts", 10)],
      semantic: [snippet("a.ts", 11), snippet("b.ts", 1), snippet("c.ts", 1)],
      limit: 2,
    });
    expect(merged.map((item) => `${item.filePath}:${item.lineStart}`)).toEqual(["a.ts:10", "b.ts:1"]);
  });
});
