import { createRequire } from "node:module";
import path from "node:path";
import { REMOTION_ENTRY_FILE } from "@cutroom/video-kit";
import { bundle } from "@remotion/bundler";

export interface VideoKitBundle {
  /** Directory Remotion serves; per-run assets are staged under `public/jobs/`. */
  serveUrl: string;
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

const bundlesByDirectory = new Map<string, Promise<VideoKitBundle>>();

/** Bundles video-kit once per worker process and output directory (FR-RD-1). */
export function bundleVideoKit(options: { outDir: string }): Promise<VideoKitBundle> {
  const existing = bundlesByDirectory.get(options.outDir);
  if (existing) return existing;
  const { entryPoint, publicDir } = videoKitPaths();
  const pending = bundle({ entryPoint, publicDir, outDir: options.outDir }).then((serveUrl) => ({
    serveUrl,
  }));
  bundlesByDirectory.set(options.outDir, pending);
  pending.catch(() => bundlesByDirectory.delete(options.outDir));
  return pending;
}
