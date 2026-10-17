import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildEgressManifest,
  canonicalManifestJson,
  type EgressManifest,
  type RenderAsset,
  type RenderJob,
  renderJobSchema,
} from "@cutroom/scene-spec";

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function manifestSha256(manifest: EgressManifest): string {
  return sha256Hex(canonicalManifestJson(manifest));
}

const PLACEHOLDER_SHA = "0".repeat(64);

export interface BundleFile {
  assetKey: string;
  kind: RenderAsset["kind"];
  filePath: string;
}

export interface BuildRenderJobBundleOptions {
  job: Omit<RenderJob, "assets" | "manifestSha256">;
  files: ReadonlyArray<BundleFile>;
  bundleDirectory: string;
}

export interface RenderJobBundle {
  job: RenderJob;
  manifest: EgressManifest;
  bundleDirectory: string;
}

/**
 * Writes `render-job.json` and `assets/<assetKey>` into one directory: exactly what a Hybrid
 * upload sends. The manifest hash is stored on the job so the server can prove it got what the
 * user confirmed (FR-PRV-3).
 */
export async function buildRenderJobBundle(options: BuildRenderJobBundleOptions): Promise<RenderJobBundle> {
  const assetsDirectory = path.join(options.bundleDirectory, "assets");
  await mkdir(assetsDirectory, { recursive: true });
  const assets: RenderAsset[] = [];
  for (const file of options.files) {
    const content = await readFile(file.filePath);
    await copyFile(file.filePath, path.join(assetsDirectory, file.assetKey));
    assets.push({
      assetKey: file.assetKey,
      kind: file.kind,
      sha256: sha256Hex(content),
      bytes: content.length,
    });
  }
  const draftJob: RenderJob = { ...options.job, assets, manifestSha256: PLACEHOLDER_SHA };
  // The hash is fixed-width, so the placeholder gives the final file's exact size.
  const renderJobBytes = Buffer.byteLength(JSON.stringify(draftJob));
  const manifest = buildEgressManifest({ storyboard: options.job.storyboard, assets, renderJobBytes });
  const job = renderJobSchema.parse({ ...draftJob, manifestSha256: manifestSha256(manifest) });
  await writeFile(path.join(options.bundleDirectory, "render-job.json"), JSON.stringify(job));
  return { job, manifest, bundleDirectory: options.bundleDirectory };
}

export class RenderJobIntegrityError extends Error {
  override readonly name = "RenderJobIntegrityError";
}

export interface UploadedFile {
  /** `assets/<assetKey>` as listed in the manifest. */
  path: string;
  content: Buffer;
}

/**
 * Server side: every uploaded file must be listed and hash-match, nothing may be missing or
 * extra, and the recomputed manifest must hash to what the user confirmed.
 */
export function verifyRenderJobUpload(options: {
  job: RenderJob;
  jobJson: string;
  files: ReadonlyArray<UploadedFile>;
}): EgressManifest {
  const { job } = options;
  const expected = new Map(job.assets.map((asset) => [`assets/${asset.assetKey}`, asset]));
  for (const file of options.files) {
    const asset = expected.get(file.path);
    if (!asset) throw new RenderJobIntegrityError(`Unexpected file in upload: ${file.path}`);
    if (sha256Hex(file.content) !== asset.sha256 || file.content.length !== asset.bytes) {
      throw new RenderJobIntegrityError(`Hash mismatch for ${file.path}`);
    }
    expected.delete(file.path);
  }
  if (expected.size > 0)
    throw new RenderJobIntegrityError(`Missing files: ${[...expected.keys()].join(", ")}`);
  const manifest = buildEgressManifest({
    storyboard: job.storyboard,
    assets: job.assets,
    renderJobBytes: Buffer.byteLength(options.jobJson),
  });
  if (manifestSha256(manifest) !== job.manifestSha256) {
    throw new RenderJobIntegrityError("The bundle does not match the egress manifest the user confirmed");
  }
  return manifest;
}

export async function fileSize(filePath: string): Promise<number> {
  return (await stat(filePath)).size;
}
