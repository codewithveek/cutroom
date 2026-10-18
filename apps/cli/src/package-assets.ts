import { existsSync } from "node:fs";
import path from "node:path";

/**
 * The published package ships a Remotion bundle next to its entry file; a source checkout does not,
 * and bundles video-kit on first render instead.
 */
export function findPrebuiltBundle(entryDirectory: string): string | undefined {
  const directory = path.join(entryDirectory, "remotion-bundle");
  return existsSync(path.join(directory, "index.html")) ? directory : undefined;
}

/** The shipnote fixture the scripted model knows: `dist/demo-repo` when published, `evals/` in a checkout. */
export function findDemoRepository(entryDirectory: string): string | undefined {
  const candidates = [
    path.join(entryDirectory, "demo-repo"),
    path.resolve(entryDirectory, "../../../evals/fixtures/shipnote"),
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, "package.json")));
}
