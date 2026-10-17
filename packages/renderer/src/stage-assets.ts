import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface StagedAsset {
  assetKey: string;
  filePath: string;
}

export interface StageAssetsOptions {
  serveUrl: string;
  jobId: string;
  assets: ReadonlyArray<StagedAsset>;
}

const safeSegment = /^[A-Za-z0-9._-]+$/;

/**
 * Copies a job's local files (voice clips, music, logo) into the bundle's public folder and
 * returns `assetUrls` the composition can load. Keys become file names, so they must be safe.
 */
export async function stageAssets(options: StageAssetsOptions): Promise<Record<string, string>> {
  if (!safeSegment.test(options.jobId)) throw new Error(`Unsafe job id: ${options.jobId}`);
  const relativeDirectory = path.posix.join("public", "jobs", options.jobId);
  const targetDirectory = path.join(options.serveUrl, relativeDirectory);
  await mkdir(targetDirectory, { recursive: true });
  const assetUrls: Record<string, string> = {};
  for (const asset of options.assets) {
    if (!safeSegment.test(asset.assetKey)) throw new Error(`Unsafe asset key: ${asset.assetKey}`);
    const fileName = `${asset.assetKey}${path.extname(asset.filePath)}`;
    await copyFile(asset.filePath, path.join(targetDirectory, fileName));
    assetUrls[asset.assetKey] = path.posix.join(relativeDirectory, fileName);
  }
  return assetUrls;
}
