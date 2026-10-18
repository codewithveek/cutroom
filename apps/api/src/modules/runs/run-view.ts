import { findApprovalBlockers } from "@cutroom/claim-audit";
import { LOGO_ASSET_KEY, latestStoryboardVersion, type RunRecord } from "@cutroom/pipeline";
import { screenshotAssetKey } from "@cutroom/scene-spec";

/** What the browser sees of a run: never file paths, only asset ids. */
export function toRunView(run: RunRecord) {
  const latest = latestStoryboardVersion(run);
  return {
    id: run.id,
    status: run.status,
    request: run.request,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    error: run.error,
    look: run.look,
    lookReason: run.lookReason,
    brief: run.brief,
    storyboard: latest
      ? {
          versionId: latest.id,
          version: latest.version,
          author: latest.author,
          storyboard: latest.storyboard,
          claimResults: latest.claimResults,
          unsupportedCount: findApprovalBlockers(latest.claimResults, []).length,
        }
      : undefined,
    versions: run.storyboardVersions.map((version) => ({
      id: version.id,
      version: version.version,
      author: version.author,
      createdAt: version.createdAt,
    })),
    approval: run.approval,
    media: [
      ...run.voiceClips.map((clip) => ({
        assetKey: clip.assetKey,
        kind: "voice" as const,
        url: `/runs/${run.id}/media/${clip.assetKey}`,
      })),
      ...(run.request.music.kind === "uploaded"
        ? [
            {
              assetKey: run.request.music.assetKey,
              kind: "music" as const,
              url: `/runs/${run.id}/media/${run.request.music.assetKey}`,
            },
          ]
        : []),
      ...(run.capture?.screens ?? []).map((screen) => ({
        assetKey: screenshotAssetKey(screen.id),
        kind: "screenshot" as const,
        url: `/runs/${run.id}/media/${screenshotAssetKey(screen.id)}`,
      })),
      ...(latest?.storyboard.brand.logoAssetKey === LOGO_ASSET_KEY
        ? [
            {
              assetKey: LOGO_ASSET_KEY,
              kind: "logo" as const,
              url: `/runs/${run.id}/media/${LOGO_ASSET_KEY}`,
            },
          ]
        : []),
    ],
    capture: run.capture,
    egress: run.egress
      ? {
          manifest: run.egress.manifest,
          manifestSha256: run.egress.manifestSha256,
          ...(run.egress.confirmedAt ? { confirmedAt: run.egress.confirmedAt } : {}),
          ...(run.egress.remoteJobId ? { remoteJobId: run.egress.remoteJobId } : {}),
        }
      : undefined,
    voiceTimeline: run.voiceTimeline,
    providers: run.providers,
    metrics: run.metrics,
    assets: run.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      ratio: asset.ratio,
      version: asset.version,
      bytes: asset.bytes,
      durationMs: asset.durationMs,
      fileName: asset.filePath.split("/").pop(),
      url: `/runs/${run.id}/assets/${asset.id}`,
    })),
  };
}
