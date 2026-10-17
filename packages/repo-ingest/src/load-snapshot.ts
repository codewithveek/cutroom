import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SnapshotReader } from "./snapshot-reader";
import { repoSnapshotSchema } from "./snapshot-schema";

export interface LoadedSnapshot {
  reader: SnapshotReader;
  logoFilePath?: string;
}

/** Reopens a snapshot written by ingestRepository, so a resumed run skips re-ingesting. */
export async function loadSnapshot(outputDirectory: string): Promise<LoadedSnapshot | undefined> {
  const root = path.resolve(outputDirectory);
  let content: string;
  try {
    content = await readFile(path.join(root, "snapshot.json"), "utf8");
  } catch {
    return undefined;
  }
  const snapshot = repoSnapshotSchema.parse(JSON.parse(content));
  const reader = new SnapshotReader({ snapshot, mirrorDirectory: path.join(root, "files") });
  const brandFiles = await readdir(path.join(root, "brand")).catch(() => []);
  const logoFile = brandFiles.find((fileName) => fileName.startsWith("logo."));
  return { reader, ...(logoFile ? { logoFilePath: path.join(root, "brand", logoFile) } : {}) };
}
