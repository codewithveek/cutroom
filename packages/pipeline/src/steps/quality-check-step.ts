import { stat } from "node:fs/promises";
import path from "node:path";
import { bundleVideoKit, deliveryOptionsForRatio, qualityCheck, stageAssets } from "@cutroom/renderer";
import { deriveThumbnailTitle, type VideoProps } from "@cutroom/scene-spec";
import { ulid } from "ulid";
import type { AssetRecord } from "../run-schema";
import { dataPaths } from "../services";
import { localAssetsFor } from "./render-step";
import { MissingStepOutputError } from "./run-resources";
import type { StepFunction } from "./step-context";

/** Step 8: stills at scene ends and transition midpoints, plus an audio report per ratio (P7). */
export const qualityCheckStep: StepFunction = async (context, run) => {
  if (run.assets.some((asset) => asset.kind === "audio-report")) return { skipped: true };
  const version = run.storyboardVersions.find((candidate) => candidate.id === run.approval?.versionId);
  if (!version || !run.voiceTimeline) throw new MissingStepOutputError("Nothing has been rendered yet.");
  const { serveUrl } = await bundleVideoKit({ outDir: dataPaths(context.services.dataDirectory).bundle });
  const assetUrls = await stageAssets({
    serveUrl,
    jobId: run.id,
    assets: await localAssetsFor(context, run),
  });
  const videos = run.assets.filter((asset) => asset.kind === "video" && asset.ratio);
  const records: AssetRecord[] = [];
  const summaries: Array<Record<string, unknown>> = [];
  for (const video of videos) {
    if (!video.ratio) continue;
    const videoProps: VideoProps = {
      storyboard: version.storyboard,
      voiceTimeline: run.voiceTimeline,
      ratio: video.ratio,
      music: run.request.music,
      assetUrls,
      ...deliveryOptionsForRatio(video.ratio),
      thumbnailTitle: deriveThumbnailTitle(version.storyboard),
    };
    const result = await qualityCheck({
      serveUrl,
      videoProps,
      videoPath: video.filePath,
      outputDirectory: path.join(
        context.runDirectory,
        "deliverables",
        "quality",
        video.ratio.replace(":", "x"),
      ),
      browserExecutable: context.services.browserExecutable,
    });
    context.progress({ ratio: video.ratio, stills: result.stills.length });
    for (const still of result.stills) {
      records.push({
        id: ulid(),
        kind: "still",
        ratio: video.ratio,
        version: video.version,
        filePath: still.filePath,
        bytes: (await stat(still.filePath)).size,
      });
    }
    records.push({
      id: ulid(),
      kind: "audio-report",
      ratio: video.ratio,
      version: video.version,
      filePath: result.audioReportPath,
      bytes: (await stat(result.audioReportPath)).size,
    });
    summaries.push({
      ratio: video.ratio,
      peakDbfs: result.audioReport.peakDbfs,
      integratedLufs: result.audioReport.integratedLufs,
      lowEnergyPercent: result.audioReport.lowEnergyPercent,
    });
  }
  await context.updateRun((current) => ({ ...current, assets: [...current.assets, ...records] }));
  return {
    payload: { stills: records.filter((record) => record.kind === "still").length, audio: summaries },
  };
};
