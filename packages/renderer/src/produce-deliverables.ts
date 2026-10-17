import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type AspectRatio,
  buildCaptionCues,
  deriveThumbnailTitle,
  FRAMES_PER_SECOND,
  introFramesFor,
  type MusicSelection,
  type Storyboard,
  totalVideoFrames,
  type VideoProps,
  type VoiceTimeline,
} from "@cutroom/scene-spec";
import { audioAssetKeys } from "@cutroom/video-kit";
import { synthesizeMusicBed } from "./audio/music-bed";
import { synthesizeClick, synthesizeWhoosh } from "./audio/sound-effects";
import { encodeWav } from "./audio/wav";
import { buildWebVtt } from "./captions-vtt";
import { embedCoverArt } from "./cover-art";
import { type LoudnessMeasurement, normalizeLoudness } from "./loudness";
import { renderRatio, renderThumbnail } from "./render-ratio";
import { type StagedAsset, stageAssets } from "./stage-assets";
import { nextVersionedPath } from "./versioned-path";

export type DeliveryStage = "render" | "normalize" | "thumbnail" | "captions" | "done";

export interface DeliveryProgress {
  ratio: AspectRatio;
  stage: DeliveryStage;
  progress: number;
}

export interface ProduceDeliverablesOptions {
  serveUrl: string;
  jobId: string;
  storyboard: Storyboard;
  voiceTimeline: VoiceTimeline;
  ratios: ReadonlyArray<AspectRatio>;
  music: MusicSelection;
  /** assetKey → local file (voice clips, uploaded music, logo). */
  localAssets: ReadonlyArray<StagedAsset>;
  outputDirectory: string;
  workDirectory: string;
  baseName: string;
  browserExecutable: string | null;
  onProgress?: (progress: DeliveryProgress) => void;
}

export interface RatioDeliverable {
  ratio: AspectRatio;
  videoPath: string;
  captionsPath: string;
  version: number;
  durationMs: number;
  bytes: number;
  width: number;
  height: number;
  loudness: LoudnessMeasurement;
}

export interface Deliverables {
  ratios: RatioDeliverable[];
  thumbnailPngPath: string;
  thumbnailJpgPath: string;
  generatedMusic: boolean;
}

const ratioFileSuffix: Readonly<Record<AspectRatio, string>> = {
  "16:9": "16x9",
  "9:16": "9x16",
  "1:1": "1x1",
  "4:5": "4x5",
};

/** Captions are burned in for 9:16 and 1:1; 16:9 opens on the thumbnail (PRD §7.6, FR-RD-4). */
export function deliveryOptionsForRatio(
  ratio: AspectRatio,
): Pick<VideoProps, "openOnThumbnail" | "burnCaptions"> {
  return { openOnThumbnail: ratio === "16:9", burnCaptions: ratio === "9:16" || ratio === "1:1" };
}

async function writeGeneratedAudio(options: ProduceDeliverablesOptions): Promise<StagedAsset[]> {
  await mkdir(options.workDirectory, { recursive: true });
  const generated: StagedAsset[] = [];
  const whooshPath = path.join(options.workDirectory, "sfx-whoosh.wav");
  await writeFile(whooshPath, encodeWav(synthesizeWhoosh(options.storyboard.seed)));
  generated.push({ assetKey: audioAssetKeys.whoosh, filePath: whooshPath });
  const clickPath = path.join(options.workDirectory, "sfx-click.wav");
  await writeFile(clickPath, encodeWav(synthesizeClick()));
  generated.push({ assetKey: audioAssetKeys.click, filePath: clickPath });
  if (options.music.kind === "generated") {
    const durationSeconds = totalVideoFrames(options.voiceTimeline, true) / FRAMES_PER_SECOND + 1;
    const musicPath = path.join(options.workDirectory, `music-${options.music.bed}.wav`);
    const bed = synthesizeMusicBed({
      bed: options.music.bed,
      durationSeconds,
      seed: options.storyboard.seed,
    });
    await writeFile(musicPath, encodeWav(bed));
    generated.push({ assetKey: audioAssetKeys.music, filePath: musicPath });
  }
  return generated;
}

interface RenderOneRatioOptions {
  produce: ProduceDeliverablesOptions;
  ratio: AspectRatio;
  assetUrls: Record<string, string>;
  coverJpgPath: string;
}

async function renderOneRatio(options: RenderOneRatioOptions): Promise<RatioDeliverable> {
  const { produce, ratio } = options;
  const report = (stage: DeliveryStage, progress: number) => produce.onProgress?.({ ratio, stage, progress });
  const ratioOptions = deliveryOptionsForRatio(ratio);
  const videoProps: VideoProps = {
    storyboard: produce.storyboard,
    voiceTimeline: produce.voiceTimeline,
    ratio,
    music: produce.music,
    assetUrls: options.assetUrls,
    ...ratioOptions,
    thumbnailTitle: deriveThumbnailTitle(produce.storyboard),
  };
  const rawPath = path.join(produce.workDirectory, `raw-${ratioFileSuffix[ratio]}.mp4`);
  const normalizedPath = path.join(produce.workDirectory, `normalized-${ratioFileSuffix[ratio]}.mp4`);
  const rendered = await renderRatio({
    serveUrl: produce.serveUrl,
    videoProps,
    outputPath: rawPath,
    browserExecutable: produce.browserExecutable,
    onProgress: (progress) => report("render", progress),
  });
  report("normalize", 0);
  const loudness = await normalizeLoudness({ inputPath: rawPath, outputPath: normalizedPath });
  const { filePath: videoPath, version } = await nextVersionedPath({
    directory: produce.outputDirectory,
    baseName: `${produce.baseName}-${ratioFileSuffix[ratio]}`,
    extension: ".mp4",
  });
  await embedCoverArt({
    videoPath: normalizedPath,
    coverJpgPath: options.coverJpgPath,
    outputPath: videoPath,
  });
  report("captions", 0);
  const cues = buildCaptionCues({
    timeline: produce.voiceTimeline,
    introFrames: introFramesFor(ratioOptions.openOnThumbnail),
  });
  const captionsPath = videoPath.replace(/\.mp4$/, ".vtt");
  await writeFile(captionsPath, buildWebVtt(cues, FRAMES_PER_SECOND));
  await rm(rawPath, { force: true });
  await rm(normalizedPath, { force: true });
  report("done", 1);
  return {
    ratio,
    videoPath,
    captionsPath,
    version,
    durationMs: Math.round((rendered.durationInFrames / FRAMES_PER_SECOND) * 1000),
    bytes: (await stat(videoPath)).size,
    width: rendered.width,
    height: rendered.height,
    loudness,
  };
}

/** Renders every ratio, then loudness, captions, thumbnail and cover art (pipeline steps 6–7). */
export async function produceDeliverables(options: ProduceDeliverablesOptions): Promise<Deliverables> {
  await mkdir(options.outputDirectory, { recursive: true });
  const generatedAudio = await writeGeneratedAudio(options);
  const assetUrls = await stageAssets({
    serveUrl: options.serveUrl,
    jobId: options.jobId,
    assets: [...options.localAssets, ...generatedAudio],
  });
  const thumbnailPng = await nextVersionedPath({
    directory: options.outputDirectory,
    baseName: `${options.baseName}-thumbnail`,
    extension: ".png",
  });
  const thumbnailJpgPath = thumbnailPng.filePath.replace(/\.png$/, ".jpg");
  await renderThumbnail({
    serveUrl: options.serveUrl,
    thumbnailProps: {
      storyboard: options.storyboard,
      ratio: "16:9",
      titleLines: deriveThumbnailTitle(options.storyboard),
      assetUrls,
    },
    pngPath: thumbnailPng.filePath,
    jpgPath: thumbnailJpgPath,
    browserExecutable: options.browserExecutable,
  });
  const ratios: RatioDeliverable[] = [];
  // Ratios render one after another: each render already uses every core.
  for (const ratio of options.ratios) {
    ratios.push(await renderOneRatio({ produce: options, ratio, assetUrls, coverJpgPath: thumbnailJpgPath }));
  }
  return {
    ratios,
    thumbnailPngPath: thumbnailPng.filePath,
    thumbnailJpgPath,
    generatedMusic: options.music.kind === "generated",
  };
}
