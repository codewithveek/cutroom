import type { EmbeddingClient } from "@cutroom/providers";
import { type Claim, stripStars } from "@cutroom/scene-spec";
import type { RepoTextIndex } from "../audit-context";
import { type CandidateSnippet, claimKeywords } from "../model-judge/retrieve-evidence";
import { type CodeChunk, chunkRepoFiles } from "./code-chunks";

/** A chunk found by vector search, with its cosine similarity (1 = identical direction). */
export interface NearestChunk {
  chunk: Omit<CodeChunk, "contentHash">;
  similarity: number;
}

/** Where code embeddings live (pgvector in production), scoped to one project. */
export interface CodeVectorIndex {
  /** Stores vectors for chunks it does not have yet and drops chunks that no longer exist. */
  sync(options: {
    chunks: ReadonlyArray<CodeChunk>;
    embed: (texts: ReadonlyArray<string>) => Promise<number[][]>;
  }): Promise<{ embedded: number; removed: number }>;
  nearest(options: { vector: ReadonlyArray<number>; limit: number }): Promise<NearestChunk[]>;
}

/** Retrieval by meaning, next to the keyword search: finds code that says it in other words. */
export interface SemanticRetriever {
  retrieve(options: {
    claims: ReadonlyArray<Claim>;
    limit: number;
  }): Promise<ReadonlyMap<string, CandidateSnippet[]>>;
}

/** Below this similarity a chunk is noise, not evidence. */
const MIN_SIMILARITY = 0.2;
/** Lines of a matched chunk shown to the judge: the window that shares the most words with the claim. */
const FOCUS_LINES = 8;

export function focusWindow(options: { match: NearestChunk; claimText: string }): CandidateSnippet {
  const { chunk } = options.match;
  const lines = chunk.content.split("\n");
  const words = claimKeywords(options.claimText).map((word) => word.replace(/(ing|ed|es|s)$/, ""));
  let bestStart = 0;
  let bestScore = -1;
  for (let start = 0; start <= Math.max(0, lines.length - FOCUS_LINES); start += 1) {
    const window = lines
      .slice(start, start + FOCUS_LINES)
      .join("\n")
      .toLowerCase();
    const score = words.reduce((sum, word) => sum + (window.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }
  const window = lines.slice(bestStart, bestStart + FOCUS_LINES);
  return {
    filePath: chunk.filePath,
    lineStart: chunk.lineStart + bestStart,
    lineEnd: chunk.lineStart + bestStart + window.length - 1,
    text: window.join("\n"),
    score: options.match.similarity,
  };
}

/** Syncs the repo into the index once, on first use, then embeds each batch of claims and searches. */
export function createSemanticRetriever(options: {
  index: CodeVectorIndex;
  embedder: EmbeddingClient;
  repoText: RepoTextIndex;
  onSynced?: (stats: { chunks: number; embedded: number; removed: number }) => void;
}): SemanticRetriever {
  let synced: Promise<void> | undefined;
  const ensureSynced = () => {
    synced ??= (async () => {
      const chunks = chunkRepoFiles({
        files: options.repoText.files,
        embeddingModelId: options.embedder.modelId,
      });
      const stats = await options.index.sync({ chunks, embed: (texts) => options.embedder.embed(texts) });
      options.onSynced?.({ chunks: chunks.length, ...stats });
    })();
    return synced;
  };
  return {
    async retrieve({ claims, limit }) {
      await ensureSynced();
      const vectors = await options.embedder.embed(claims.map((claim) => stripStars(claim.text)));
      const found = new Map<string, CandidateSnippet[]>();
      for (const [position, claim] of claims.entries()) {
        const vector = vectors[position];
        if (!vector) continue;
        const nearest = await options.index.nearest({ vector, limit });
        found.set(
          claim.id,
          nearest
            .filter((match) => match.similarity >= MIN_SIMILARITY)
            .map((match) => focusWindow({ match, claimText: claim.text })),
        );
      }
      return found;
    },
  };
}

/** Keyword hits first, then semantic hits from other places, up to `limit`. */
export function mergeSnippets(options: {
  keyword: ReadonlyArray<CandidateSnippet>;
  semantic: ReadonlyArray<CandidateSnippet>;
  limit: number;
}): CandidateSnippet[] {
  const merged = [...options.keyword];
  for (const snippet of options.semantic) {
    if (merged.length >= options.limit) break;
    const overlaps = merged.some(
      (existing) =>
        existing.filePath === snippet.filePath &&
        existing.lineStart <= snippet.lineEnd &&
        snippet.lineStart <= existing.lineEnd,
    );
    if (!overlaps) merged.push(snippet);
  }
  return merged.slice(0, options.limit);
}
