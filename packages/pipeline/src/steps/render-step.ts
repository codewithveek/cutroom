import path from "node:path";
import type { StagedAsset } from "@cutroom/renderer";
import { bundleVideoKit, produceDeliverables } from "@cutroom/renderer";
import { ulid } from "ulid";
import type { AssetRecord } from "../run-schema";
import { dataPaths } from "../services";
import { LOGO_ASSET_KEY } from "./plan-step";
import { MissingStepOutputError, requireSnapshot } from "./run-resources";
import type { StepFunction } from "./step-context";

/** Steps 6–7: every ratio, then loudness, captions, thumbnail and cover art. */
export const renderStep: StepFunction = async (context, run) => {
  const renderedRatios = new Set(
    run.assets.filter((asset) => asset.kind === "video").map((asset) => asset.ratio),
  );
  if (run.request.ratios.every((ratio) => renderedRatios.has(ratio))) return { skipped: true };
  const version = run.storyboardVersions.find((candidate) => candidate.id === run.approval?.versionId);
  if (!version || !run.voiceTimeline)
    throw new MissingStepOutputError("Approve the storyboard and synthesise the voice first.");
  const { logoFilePath } = await requireSnapshot(context);
  const { serveUrl } = await bundleVideoKit({ outDir: dataPaths(context.services.dataDirectory).bundle });
  const localAssets: StagedAsset[] = [
    ...run.voiceClips.map((clip) => ({ assetKey: clip.assetKey, filePath: clip.filePath })),
    ...(logoFilePath && version.storyboard.brand.logoAssetKey === LOGO_ASSET_KEY
      ? [{ assetKey: LOGO_ASSET_KEY, filePath: logoFilePath }]
      : []),
  ];
  const deliverables = await produceDeliverables({
    serveUrl,
    jobId: run.id,
    storyboard: version.storyboard,
    voiceTimeline: run.voiceTimeline,
    ratios: run.request.ratios.filter((ratio) => !renderedRatios.has(ratio)),
    music: run.request.music,
    localAssets,
    outputDirectory: path.join(context.runDirectory, "deliverables"),
    workDirectory: path.join(context.runDirectory, "work"),
    baseName: version.storyboard.videoType,
    browserExecutable: context.services.browserExecutable,
    onProgress: (progress) =>
      context.progress({ ...progress, progress: Math.round(progress.progress * 100) / 100 }),
  });
  const assets: AssetRecord[] = deliverables.ratios.flatMap((ratio) => [
    {
      id: ulid(),
      kind: "video" as const,
      ratio: ratio.ratio,
      version: ratio.version,
      filePath: ratio.videoPath,
      bytes: ratio.bytes,
      durationMs: ratio.durationMs,
    },
    {
      id: ulid(),
      kind: "captions" as const,
      ratio: ratio.ratio,
      version: ratio.version,
      filePath: ratio.captionsPath,
      bytes: 0,
    },
  ]);
  assets.push(
    { id: ulid(), kind: "thumbnail", version: 1, filePath: deliverables.thumbnailPngPath, bytes: 0 },
    { id: ulid(), kind: "thumbnail", version: 1, filePath: deliverables.thumbnailJpgPath, bytes: 0 },
  );
  await context.updateRun((current) => ({ ...current, assets: [...current.assets, ...assets] }));
  return {
    payload: {
      ratios: deliverables.ratios.map((ratio) => ({
        ratio: ratio.ratio,
        seconds: ratio.durationMs / 1000,
        lufsIn: ratio.loudness.input_i,
      })),
    },
  };
};
