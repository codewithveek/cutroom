import { existsSync } from "node:fs";

/** Pre-installed headless shells we know about; Remotion downloads its own when none is found. */
const knownHeadlessShells: ReadonlyArray<string> = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
];

export function resolveBrowserExecutable(configured?: string): string | null {
  if (configured) return configured;
  return knownHeadlessShells.find((candidate) => existsSync(candidate)) ?? null;
}
