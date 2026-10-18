import { existsSync } from "node:fs";
import { ensureBrowser } from "@remotion/renderer";

/** Pre-installed headless shells we know about; Remotion downloads its own when none is found. */
const knownHeadlessShells: ReadonlyArray<string> = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
];

export function resolveBrowserExecutable(configured?: string): string | null {
  if (configured) return configured;
  return knownHeadlessShells.find((candidate) => existsSync(candidate)) ?? null;
}

export interface EnsureRenderBrowserOptions {
  browserExecutable: string | null;
  /** Called only when a download starts, then with its progress. */
  onDownloadProgress?: (percent: number) => void;
}

/**
 * Makes sure Remotion has a browser before a run starts. Without one, Remotion downloads Chrome
 * Headless Shell mid-render, which the Local-mode egress guard rightly blocks; downloading it here,
 * before the guard is installed, keeps it a one-time setup step like the voice model.
 */
export async function ensureRenderBrowser(
  options: EnsureRenderBrowserOptions,
): Promise<"ready" | "downloaded"> {
  let downloaded = false;
  await ensureBrowser({
    browserExecutable: options.browserExecutable,
    logLevel: "error",
    onBrowserDownload: () => {
      downloaded = true;
      return {
        version: null,
        onProgress: (progress) => options.onDownloadProgress?.(Math.round(progress.percent * 100)),
      };
    },
  });
  return downloaded ? "downloaded" : "ready";
}
