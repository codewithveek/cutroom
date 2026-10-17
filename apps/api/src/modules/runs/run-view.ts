import { findApprovalBlockers } from "@cutroom/claim-audit";
import { latestStoryboardVersion, type RunRecord } from "@cutroom/pipeline";

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
