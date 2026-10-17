import { access } from "node:fs/promises";
import path from "node:path";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface VersionedPathOptions {
  directory: string;
  baseName: string;
  extension: string;
}

/** Re-renders never overwrite: `launch-16x9.mp4`, then `launch-16x9-v2.mp4`, … (FR-RD-6). */
export async function nextVersionedPath(
  options: VersionedPathOptions,
): Promise<{ filePath: string; version: number }> {
  for (let version = 1; version < 1000; version += 1) {
    const suffix = version === 1 ? "" : `-v${version}`;
    const filePath = path.join(options.directory, `${options.baseName}${suffix}${options.extension}`);
    if (!(await exists(filePath))) return { filePath, version };
  }
  throw new Error(`Too many versions of ${options.baseName}`);
}
