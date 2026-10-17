import type { EgressManifest, RenderAsset } from "./render-job";
import type { Storyboard } from "./storyboard";

export interface BuildEgressManifestOptions {
  storyboard: Storyboard;
  /** Every file in the bundle besides render-job.json. */
  assets: ReadonlyArray<Pick<RenderAsset, "assetKey" | "kind" | "bytes">>;
  renderJobBytes: number;
}

/**
 * What a Hybrid upload contains (FR-PRV-3): every file with size and type, and every code
 * excerpt shown on screen. Derived only from the bundle, so the server can recompute it.
 */
export function buildEgressManifest(options: BuildEgressManifestOptions): EgressManifest {
  const files = [
    { path: "render-job.json", kind: "storyboard", bytes: options.renderJobBytes },
    ...options.assets.map((asset) => ({
      path: `assets/${asset.assetKey}`,
      kind: asset.kind,
      bytes: asset.bytes,
    })),
  ].toSorted((left, right) => left.path.localeCompare(right.path));
  const codeExcerpts = options.storyboard.scenes.flatMap((scene) =>
    scene.block === "code-card"
      ? [
          {
            sceneId: scene.id,
            filePath: scene.props.filePath,
            lineStart: scene.props.lineStart,
            lineEnd: scene.props.lineEnd,
          },
        ]
      : [],
  );
  return { files, codeExcerpts };
}

/** Stable JSON for hashing: keys in a fixed order, no whitespace. */
export function canonicalManifestJson(manifest: EgressManifest): string {
  return JSON.stringify({
    files: manifest.files.map((file) => ({ path: file.path, kind: file.kind, bytes: file.bytes })),
    codeExcerpts: manifest.codeExcerpts.map((excerpt) => ({
      sceneId: excerpt.sceneId,
      filePath: excerpt.filePath,
      lineStart: excerpt.lineStart,
      lineEnd: excerpt.lineEnd,
    })),
  });
}
