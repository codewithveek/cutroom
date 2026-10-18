import { cp, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { REMOTION_ENTRY_FILE } from "@cutroom/video-kit";

export interface VideoKitBundle {
  /** Directory Remotion serves; per-run assets are staged under `public/jobs/`. */
  serveUrl: string;
}

export interface BundleVideoKitOptions {
  outDir: string;
  /**
   * A bundle built ahead of time (the published CLI ships one). It is copied into `outDir`
   * because runs stage their assets inside the bundle, and the package directory may be read-only.
   */
  prebuiltDirectory?: string | undefined;
}

function videoKitPaths(): { entryPoint: string; publicDir: string } {
  const require = createRequire(import.meta.url);
  const indexPath = require.resolve("@cutroom/video-kit");
  const sourceDirectory = path.dirname(indexPath);
  return {
    entryPoint: path.join(sourceDirectory, REMOTION_ENTRY_FILE),
    publicDir: path.join(path.dirname(sourceDirectory), "public"),
  };
}

async function bundleFromSource(outDir: string): Promise<string> {
  // Loaded lazily: webpack is heavy, and a prebuilt bundle never needs it.
  const { bundle } = await import("@remotion/bundler");
  const { entryPoint, publicDir } = videoKitPaths();
  return bundle({ entryPoint, publicDir, outDir });
}

async function copyPrebuiltBundle(options: { prebuiltDirectory: string; outDir: string }): Promise<string> {
  const marker = await stat(path.join(options.prebuiltDirectory, "index.html")).catch(() => null);
  if (!marker) throw new Error(`No Remotion bundle at ${options.prebuiltDirectory} (index.html is missing).`);
  await cp(options.prebuiltDirectory, options.outDir, { recursive: true, force: true });
  return options.outDir;
}

const bundlesByDirectory = new Map<string, Promise<VideoKitBundle>>();

/** Bundles video-kit (or copies a prebuilt bundle) once per process and output directory (FR-RD-1). */
export function bundleVideoKit(options: BundleVideoKitOptions): Promise<VideoKitBundle> {
  const existing = bundlesByDirectory.get(options.outDir);
  if (existing) return existing;
  const serveUrl = options.prebuiltDirectory
    ? copyPrebuiltBundle({ prebuiltDirectory: options.prebuiltDirectory, outDir: options.outDir })
    : bundleFromSource(options.outDir);
  const pending = serveUrl.then((resolved) => ({ serveUrl: resolved }));
  bundlesByDirectory.set(options.outDir, pending);
  pending.catch(() => bundlesByDirectory.delete(options.outDir));
  return pending;
}
