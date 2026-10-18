import { createHash } from "node:crypto";

export interface CodeChunk {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  /** Hash of the embedding model and the content: an unchanged chunk is never embedded twice. */
  contentHash: string;
}

export interface ChunkRepoFilesOptions {
  files: ReadonlyArray<{ path: string; content: string }>;
  /** Names the embedding model, so switching models re-embeds instead of mixing vector spaces. */
  embeddingModelId: string;
  linesPerChunk?: number;
  overlapLines?: number;
}

/** Overlapping line windows over the redacted files; blank windows are skipped. */
export function chunkRepoFiles(options: ChunkRepoFilesOptions): CodeChunk[] {
  const linesPerChunk = options.linesPerChunk ?? 40;
  const step = Math.max(1, linesPerChunk - (options.overlapLines ?? 10));
  const chunks: CodeChunk[] = [];
  for (const file of options.files) {
    const lines = file.content.split("\n");
    for (let start = 0; start < lines.length; start += step) {
      const window = lines.slice(start, start + linesPerChunk);
      const content = window.join("\n");
      if (content.trim().length > 0)
        chunks.push({
          filePath: file.path,
          lineStart: start + 1,
          lineEnd: start + window.length,
          content,
          contentHash: createHash("sha256")
            .update(`${options.embeddingModelId}\0${file.path}\0${content}`)
            .digest("hex"),
        });
      if (start + linesPerChunk >= lines.length) break;
    }
  }
  return chunks;
}
