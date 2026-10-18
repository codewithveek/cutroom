import path from "node:path";
import { type BundleFile, buildRenderJobBundle, manifestSha256 } from "../remote-render/render-job-bundle";
import { screenshotAssetsFor } from "./captured-screens";
import { LOGO_ASSET_KEY } from "./plan-step";
import { MissingStepOutputError, requireSnapshot } from "./run-resources";
import type { StepFunction } from "./step-context";
import { uploadedMusicAssetKey, uploadedMusicPath } from "./uploaded-music";

/**
 * Step 5b, Hybrid only: writes the RenderJob bundle and its egress manifest, then pauses until
 * the user confirms what will leave the machine (FR-PRV-3). Local and Cloud runs skip it.
 */
export const buildRenderJobStep: StepFunction = async (context, run) => {
  if (run.request.privacyMode !== "hybrid") return { skipped: true };
  if (run.egress?.confirmedAt) return { skipped: true };
  if (run.egress) return { paused: true, payload: { awaitingEgress: true } };
  const version = run.storyboardVersions.find((candidate) => candidate.id === run.approval?.versionId);
  if (!version || !run.voiceTimeline)
    throw new MissingStepOutputError("Approve the storyboard and synthesise the voice first.");
  const { logoFilePath } = await requireSnapshot(context);
  const files: BundleFile[] = [
    ...run.voiceClips.map((clip) => ({
      assetKey: clip.assetKey,
      kind: "voice-clip" as const,
      filePath: clip.filePath,
    })),
    ...(logoFilePath && version.storyboard.brand.logoAssetKey === LOGO_ASSET_KEY
      ? [{ assetKey: LOGO_ASSET_KEY, kind: "logo" as const, filePath: logoFilePath }]
      : []),
    ...screenshotAssetsFor({ runDirectory: context.runDirectory, run, storyboard: version.storyboard }).map(
      (asset) => ({ ...asset, kind: "screenshot" as const }),
    ),
  ];
  if (run.request.music.kind === "uploaded")
    files.push({
      assetKey: uploadedMusicAssetKey,
      kind: "music" as const,
      filePath: uploadedMusicPath(context.runDirectory),
    });
  const bundleDirectory = path.join(context.runDirectory, "render-job");
  const bundle = await buildRenderJobBundle({
    job: {
      jobId: run.id,
      storyboard: version.storyboard,
      voiceTimeline: run.voiceTimeline,
      ratios: run.request.ratios,
      music: run.request.music,
    },
    files,
    bundleDirectory,
  });
  const egress = {
    manifest: bundle.manifest,
    manifestSha256: manifestSha256(bundle.manifest),
    bundleDirectory,
  };
  const autoConfirmed = run.request.autoApprove;
  await context.updateRun((current) => ({
    ...current,
    egress: { ...egress, ...(autoConfirmed ? { confirmedAt: new Date().toISOString() } : {}) },
  }));
  const payload = {
    files: bundle.manifest.files.length,
    bytes: bundle.manifest.files.reduce((sum, file) => sum + file.bytes, 0),
    codeExcerpts: bundle.manifest.codeExcerpts.length,
    manifestSha256: egress.manifestSha256,
  };
  return autoConfirmed
    ? { payload: { ...payload, autoConfirmed: true } }
    : { paused: true, payload: { ...payload, awaitingEgress: true } };
};
