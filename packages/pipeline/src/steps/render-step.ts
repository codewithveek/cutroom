import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StagedAsset } from "@cutroom/renderer";
import { bundleVideoKit, produceDeliverables } from "@cutroom/renderer";
import { aspectRatioSchema, renderJobSchema } from "@cutroom/scene-spec";
import { ulid } from "ulid";
import {
  createRenderJobClient,
  type RemoteJobStatus,
  type RenderJobClient,
} from "../remote-render/render-job-client";
import type { AssetRecord, RunRecord } from "../run-schema";
import { dataPaths } from "../services";
import { screenshotAssetsFor } from "./captured-screens";
import { LOGO_ASSET_KEY } from "./plan-step";
import { MissingStepOutputError, requireSnapshot } from "./run-resources";
import type { StepContext, StepFunction } from "./step-context";
import { uploadedMusicAssetKey, uploadedMusicPath } from "./uploaded-music";

/** Voice clips, music, screenshots and the repo's logo: the local files a render of this run needs. */
export async function localAssetsFor(context: StepContext, run: RunRecord): Promise<StagedAsset[]> {
  const version = run.storyboardVersions.find((candidate) => candidate.id === run.approval?.versionId);
  const { logoFilePath } = await requireSnapshot(context);
  return [
    ...run.voiceClips.map((clip) => ({ assetKey: clip.assetKey, filePath: clip.filePath })),
    ...(run.request.music.kind === "uploaded"
      ? [{ assetKey: uploadedMusicAssetKey, filePath: uploadedMusicPath(context.runDirectory) }]
      : []),
    ...(version
      ? screenshotAssetsFor({ runDirectory: context.runDirectory, run, storyboard: version.storyboard })
      : []),
    ...(logoFilePath && version?.storyboard.brand.logoAssetKey === LOGO_ASSET_KEY
      ? [{ assetKey: LOGO_ASSET_KEY, filePath: logoFilePath }]
      : []),
  ];
}

/** Hybrid: upload the confirmed bundle, wait for the remote render, download the files. */
async function renderRemotely(context: StepContext, run: RunRecord): Promise<AssetRecord[]> {
  const { env } = context.services;
  if (!run.egress?.confirmedAt) throw new MissingStepOutputError("Confirm the egress manifest first.");
  if (!env.RENDER_API_BASE_URL || !env.RENDER_API_TOKEN) {
    throw new MissingStepOutputError("Hybrid mode needs RENDER_API_BASE_URL and RENDER_API_TOKEN.");
  }
  const client = createRenderJobClient({
    baseUrl: env.RENDER_API_BASE_URL,
    token: env.RENDER_API_TOKEN,
    mode: run.request.privacyMode,
  });
  const bundleDirectory = run.egress.bundleDirectory;
  const job = renderJobSchema.parse(
    JSON.parse(await readFile(path.join(bundleDirectory, "render-job.json"), "utf8")),
  );
  const remoteJobId = run.egress.remoteJobId ?? (await client.upload({ job, bundleDirectory }));
  await context.updateRun((current) =>
    current.egress ? { ...current, egress: { ...current.egress, remoteJobId } } : current,
  );
  for (;;) {
    const status = await client.status(remoteJobId);
    context.progress({ remoteJobId, stage: status.status, progress: status.progress ?? 0 });
    if (status.status === "failed")
      throw new MissingStepOutputError(`Remote render failed: ${status.error ?? "unknown error"}`);
    if (status.status === "completed")
      return downloadRemoteOutputs({ context, run, client, remoteJobId, outputs: status.outputs });
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

interface DownloadRemoteOutputsOptions {
  context: StepContext;
  run: RunRecord;
  client: RenderJobClient;
  remoteJobId: string;
  outputs: RemoteJobStatus["outputs"];
}

async function downloadRemoteOutputs(options: DownloadRemoteOutputsOptions): Promise<AssetRecord[]> {
  const outputDirectory = path.join(options.context.runDirectory, "deliverables");
  await mkdir(outputDirectory, { recursive: true });
  const timeline = options.run.voiceTimeline;
  const records: AssetRecord[] = [];
  for (const output of options.outputs) {
    const filePath = path.join(outputDirectory, output.fileName);
    const content = await options.client.download(options.remoteJobId, output.fileName);
    await writeFile(filePath, content);
    const ratio = aspectRatioSchema.safeParse(output.ratio);
    records.push({
      id: ulid(),
      kind: output.kind,
      ...(ratio.success ? { ratio: ratio.data } : {}),
      version: 1,
      filePath,
      bytes: content.length,
      ...(output.kind === "video" && timeline
        ? { durationMs: Math.round((timeline.totalFrames / timeline.fps) * 1000) }
        : {}),
    });
  }
  return records;
}

/** Steps 6–7: every ratio, then loudness, captions, thumbnail and cover art. */
export const renderStep: StepFunction = async (context, run) => {
  const renderedRatios = new Set(
    run.assets.filter((asset) => asset.kind === "video").map((asset) => asset.ratio),
  );
  if (run.request.ratios.every((ratio) => renderedRatios.has(ratio))) return { skipped: true };
  if (run.request.privacyMode === "hybrid") {
    const assets = await renderRemotely(context, run);
    await context.updateRun((current) => ({ ...current, assets: [...current.assets, ...assets] }));
    return { payload: { remote: true, files: assets.length } };
  }
  const version = run.storyboardVersions.find((candidate) => candidate.id === run.approval?.versionId);
  if (!version || !run.voiceTimeline)
    throw new MissingStepOutputError("Approve the storyboard and synthesise the voice first.");
  const { serveUrl } = await bundleVideoKit({
    outDir: dataPaths(context.services.dataDirectory).bundle,
    prebuiltDirectory: context.services.prebuiltBundleDirectory,
  });
  const localAssets = await localAssetsFor(context, run);
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
