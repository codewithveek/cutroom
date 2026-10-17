import type { ThumbnailProps, VideoProps } from "@cutroom/scene-spec";
import { compositionIds, THUMBNAIL_CAPTURE_FRAME } from "@cutroom/video-kit";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

export interface RenderRatioOptions {
  serveUrl: string;
  videoProps: VideoProps;
  outputPath: string;
  browserExecutable: string | null;
  concurrency?: number;
  onProgress?: (progress: number) => void;
}

export interface RenderRatioResult {
  outputPath: string;
  durationInFrames: number;
  width: number;
  height: number;
}

/** selectComposition + renderMedia for one aspect ratio (FR-RD-1). */
export async function renderRatio(options: RenderRatioOptions): Promise<RenderRatioResult> {
  const inputProps = options.videoProps;
  const composition = await selectComposition({
    serveUrl: options.serveUrl,
    id: compositionIds.video,
    inputProps,
    browserExecutable: options.browserExecutable,
    logLevel: "error",
  });
  await renderMedia({
    serveUrl: options.serveUrl,
    composition,
    inputProps,
    codec: "h264",
    audioCodec: "aac",
    pixelFormat: "yuv420p",
    crf: 18,
    outputLocation: options.outputPath,
    browserExecutable: options.browserExecutable,
    concurrency: options.concurrency ?? null,
    logLevel: "error",
    onProgress: ({ progress }) => options.onProgress?.(progress),
  });
  return {
    outputPath: options.outputPath,
    durationInFrames: composition.durationInFrames,
    width: composition.width,
    height: composition.height,
  };
}

export interface RenderThumbnailOptions {
  serveUrl: string;
  thumbnailProps: ThumbnailProps;
  pngPath: string;
  jpgPath: string;
  browserExecutable: string | null;
}

/** 1920 PNG + 1280 JPG, rendered at frame 239 of a 240-frame composition (FR-RD-4). */
export async function renderThumbnail(options: RenderThumbnailOptions): Promise<void> {
  const inputProps = options.thumbnailProps;
  const composition = await selectComposition({
    serveUrl: options.serveUrl,
    id: compositionIds.thumbnail,
    inputProps,
    browserExecutable: options.browserExecutable,
    logLevel: "error",
  });
  const shared = {
    serveUrl: options.serveUrl,
    composition,
    inputProps,
    frame: THUMBNAIL_CAPTURE_FRAME,
    browserExecutable: options.browserExecutable,
    logLevel: "error" as const,
  };
  await renderStill({ ...shared, output: options.pngPath, imageFormat: "png" });
  await renderStill({
    ...shared,
    output: options.jpgPath,
    imageFormat: "jpeg",
    jpegQuality: 88,
    scale: 1280 / composition.width,
  });
}

export interface RenderStillsOptions {
  serveUrl: string;
  videoProps: VideoProps;
  frames: ReadonlyArray<number>;
  outputPathForFrame: (frame: number) => string;
  browserExecutable: string | null;
}

/** Stills at chosen frames of the full composition (quality checks and contract tests). */
export async function renderStills(options: RenderStillsOptions): Promise<string[]> {
  const inputProps = options.videoProps;
  const composition = await selectComposition({
    serveUrl: options.serveUrl,
    id: compositionIds.video,
    inputProps,
    browserExecutable: options.browserExecutable,
    logLevel: "error",
  });
  const outputPaths: string[] = [];
  for (const frame of options.frames) {
    const output = options.outputPathForFrame(frame);
    await renderStill({
      serveUrl: options.serveUrl,
      composition,
      inputProps,
      frame: Math.min(frame, composition.durationInFrames - 1),
      output,
      browserExecutable: options.browserExecutable,
      logLevel: "error",
    });
    outputPaths.push(output);
  }
  return outputPaths;
}
