import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RepoSnapshot } from "./snapshot-schema";

export class PathOutsideSnapshotError extends Error {
  override readonly name = "PathOutsideSnapshotError";
}

/** Resolves a repo-relative path inside `rootDirectory`, refusing traversal (NFR security). */
export function resolveInside(rootDirectory: string, relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    throw new PathOutsideSnapshotError(`Path escapes the snapshot: ${relativePath}`);
  }
  const resolved = path.resolve(rootDirectory, normalized);
  if (resolved !== rootDirectory && !resolved.startsWith(`${rootDirectory}${path.sep}`)) {
    throw new PathOutsideSnapshotError(`Path escapes the snapshot: ${relativePath}`);
  }
  return resolved;
}

/**
 * Read access to the redacted mirror of a repository. Every later step reads code through
 * this, so nothing downstream can see a secret the ingest step removed.
 */
export class SnapshotReader {
  readonly snapshot: RepoSnapshot;
  readonly mirrorDirectory: string;
  private readonly knownPaths: Set<string>;
  private readonly cache = new Map<string, string>();

  constructor(options: { snapshot: RepoSnapshot; mirrorDirectory: string }) {
    this.snapshot = options.snapshot;
    this.mirrorDirectory = options.mirrorDirectory;
    this.knownPaths = new Set(options.snapshot.files.map((file) => file.path));
  }

  hasFile(relativePath: string): boolean {
    return this.knownPaths.has(path.posix.normalize(relativePath));
  }

  async readFile(relativePath: string): Promise<string | undefined> {
    const normalized = path.posix.normalize(relativePath);
    if (!this.knownPaths.has(normalized)) return undefined;
    const cached = this.cache.get(normalized);
    if (cached !== undefined) return cached;
    const content = await readFile(resolveInside(this.mirrorDirectory, normalized), "utf8");
    this.cache.set(normalized, content);
    return content;
  }

  /** Lines `lineStart`..`lineEnd` (1-based, inclusive), or undefined when out of bounds. */
  async readLines(options: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
  }): Promise<string | undefined> {
    const content = await this.readFile(options.filePath);
    if (content === undefined) return undefined;
    const lines = content.split("\n");
    if (options.lineStart < 1 || options.lineEnd < options.lineStart || options.lineEnd > lines.length)
      return undefined;
    return lines.slice(options.lineStart - 1, options.lineEnd).join("\n");
  }
}
