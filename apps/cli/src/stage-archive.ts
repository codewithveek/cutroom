import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { extractZipArchive, uploadDirectory } from "@cutroom/repo-ingest";
import type { RepoSource } from "@cutroom/scene-spec";
import { ulid } from "ulid";

export function isZipPath(repo: string): boolean {
  return /\.zip$/i.test(repo) && !/^(https:\/\/|git@)/.test(repo);
}

/** `--repo app.zip`: extract it the same way the API does, then run on it as a zip source. */
export async function stageArchive(options: {
  archivePath: string;
  uploadsDirectory: string;
}): Promise<RepoSource> {
  const uploadId = ulid();
  const directory = uploadDirectory({ uploadsDirectory: options.uploadsDirectory, uploadId });
  await mkdir(directory, { recursive: true });
  const archivePath = path.join(directory, "archive.zip");
  await copyFile(path.resolve(options.archivePath), archivePath);
  await extractZipArchive({ archivePath, destination: path.join(directory, "extracted") });
  return { kind: "zip", uploadId, fileName: path.basename(options.archivePath) };
}
