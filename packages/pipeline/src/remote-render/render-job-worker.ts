import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CutroomLogger } from "@cutroom/observability";
import { bundleVideoKit, produceDeliverables } from "@cutroom/renderer";
import { type RenderJob, renderJobSchema } from "@cutroom/scene-spec";
import { type UploadedFile, verifyRenderJobUpload } from "./render-job-bundle";
import { type RemoteJobStatus, remoteJobStatusSchema } from "./render-job-client";

/** Bundles are deleted from the render host 24 h after the job finishes (FR-PRV-6). */
export const RENDER_JOB_RETENTION_MS = 24 * 60 * 60 * 1000;

const safeName = /^[A-Za-z0-9._-]+$/;

/** Uploaded assets carry no extension; the browser renderer needs one to decode them. */
export function extensionForContent(content: Buffer): string {
  if (content.subarray(0, 4).toString("ascii") === "RIFF") return ".wav";
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return ".png";
  if (content[0] === 0xff && content[1] === 0xd8) return ".jpg";
  if (
    content.subarray(0, 3).toString("ascii") === "ID3" ||
    (content[0] === 0xff && ((content[1] ?? 0) & 0xe0) === 0xe0)
  )
    return ".mp3";
  if (content.subarray(0, 512).toString("utf8").includes("<svg")) return ".svg";
  return ".bin";
}

export interface RenderJobWorkerOptions {
  dataDirectory: string;
  browserExecutable: string | null;
  logger: CutroomLogger;
}

/** The remote half of Hybrid mode: accepts a verified RenderJob bundle and renders it. */
export class RenderJobWorker {
  private readonly options: RenderJobWorkerOptions;
  private readonly jobsDirectory: string;

  constructor(options: RenderJobWorkerOptions) {
    this.options = options;
    this.jobsDirectory = path.join(options.dataDirectory, "render-jobs");
  }

  private jobDirectory(jobId: string): string {
    if (!safeName.test(jobId)) throw new Error(`Invalid job id: ${jobId}`);
    return path.join(this.jobsDirectory, jobId);
  }

  private async writeStatus(status: RemoteJobStatus & { finishedAt?: string }): Promise<void> {
    await writeFile(path.join(this.jobDirectory(status.jobId), "status.json"), JSON.stringify(status));
  }

  async status(jobId: string): Promise<RemoteJobStatus | undefined> {
    try {
      return remoteJobStatusSchema.parse(
        JSON.parse(await readFile(path.join(this.jobDirectory(jobId), "status.json"), "utf8")),
      );
    } catch {
      return undefined;
    }
  }

  /** Absolute path of an output file, or undefined when the name is unknown or unsafe. */
  async outputPath(jobId: string, fileName: string): Promise<string | undefined> {
    const status = await this.status(jobId);
    if (!status || !safeName.test(fileName) || !status.outputs.some((output) => output.fileName === fileName))
      return undefined;
    return path.join(this.jobDirectory(jobId), "out", fileName);
  }

  /** Verifies the upload against its manifest, stores it and starts rendering. */
  async accept(upload: { jobJson: string; files: ReadonlyArray<UploadedFile> }): Promise<RenderJob> {
    const job = renderJobSchema.parse(JSON.parse(upload.jobJson));
    verifyRenderJobUpload({ job, jobJson: upload.jobJson, files: upload.files });
    const directory = this.jobDirectory(job.jobId);
    await mkdir(path.join(directory, "assets"), { recursive: true });
    const localAssets = [];
    for (const file of upload.files) {
      const assetKey = file.path.replace(/^assets\//, "");
      if (!safeName.test(assetKey)) throw new Error(`Unsafe asset key: ${assetKey}`);
      const filePath = path.join(directory, "assets", `${assetKey}${extensionForContent(file.content)}`);
      await writeFile(filePath, file.content);
      localAssets.push({ assetKey, filePath });
    }
    await this.writeStatus({ jobId: job.jobId, status: "queued", outputs: [] });
    void this.render(job, localAssets);
    return job;
  }

  private async render(
    job: RenderJob,
    localAssets: Array<{ assetKey: string; filePath: string }>,
  ): Promise<void> {
    const directory = this.jobDirectory(job.jobId);
    try {
      await this.writeStatus({ jobId: job.jobId, status: "rendering", progress: 0, outputs: [] });
      const { serveUrl } = await bundleVideoKit({ outDir: path.join(this.options.dataDirectory, "bundle") });
      const deliverables = await produceDeliverables({
        serveUrl,
        jobId: job.jobId,
        storyboard: job.storyboard,
        voiceTimeline: job.voiceTimeline,
        ratios: job.ratios,
        music: job.music,
        localAssets,
        outputDirectory: path.join(directory, "out"),
        workDirectory: path.join(directory, "work"),
        baseName: job.storyboard.videoType,
        browserExecutable: this.options.browserExecutable,
      });
      await this.writeStatus({
        jobId: job.jobId,
        status: "completed",
        finishedAt: new Date().toISOString(),
        outputs: [
          ...deliverables.ratios.flatMap((ratio) => [
            { fileName: path.basename(ratio.videoPath), kind: "video" as const, ratio: ratio.ratio },
            { fileName: path.basename(ratio.captionsPath), kind: "captions" as const, ratio: ratio.ratio },
          ]),
          { fileName: path.basename(deliverables.thumbnailPngPath), kind: "thumbnail" as const },
          { fileName: path.basename(deliverables.thumbnailJpgPath), kind: "thumbnail" as const },
        ],
      });
    } catch (error) {
      this.options.logger.error({ jobId: job.jobId, err: error }, "remote render failed");
      await this.writeStatus({
        jobId: job.jobId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date().toISOString(),
        outputs: [],
      });
    }
  }

  /** Deletes every finished job older than the retention window. Returns how many went. */
  async sweep(now = Date.now()): Promise<number> {
    let removed = 0;
    for (const jobId of await readdir(this.jobsDirectory).catch(() => [])) {
      const statusPath = path.join(this.jobDirectory(jobId), "status.json");
      const raw = await readFile(statusPath, "utf8").catch(() => undefined);
      const finishedAt = raw ? (JSON.parse(raw) as { finishedAt?: string }).finishedAt : undefined;
      const finishedTime = finishedAt
        ? Date.parse(finishedAt)
        : (await stat(statusPath).catch(() => undefined))?.mtimeMs;
      if (finishedAt && finishedTime !== undefined && now - finishedTime > RENDER_JOB_RETENTION_MS) {
        await rm(this.jobDirectory(jobId), { recursive: true, force: true });
        removed += 1;
      }
    }
    return removed;
  }
}
