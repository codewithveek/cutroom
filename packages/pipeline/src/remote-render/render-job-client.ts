import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertProviderAllowed, networkScopeForUrl } from "@cutroom/providers";
import type { PrivacyMode, RenderJob } from "@cutroom/scene-spec";
import { z } from "zod";

export const remoteJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "rendering", "completed", "failed"]),
  error: z.string().optional(),
  progress: z.number().optional(),
  outputs: z
    .array(
      z.object({
        fileName: z.string(),
        kind: z.enum(["video", "captions", "thumbnail"]),
        ratio: z.string().optional(),
      }),
    )
    .default([]),
});
export type RemoteJobStatus = z.infer<typeof remoteJobStatusSchema>;

export class RemoteRenderError extends Error {
  override readonly name = "RemoteRenderError";
}

export interface RenderJobClientOptions {
  baseUrl: string;
  token: string;
  mode: PrivacyMode;
  fetchImplementation?: typeof fetch;
}

/**
 * The only component allowed to send anything out in Hybrid mode (FR-PRV-2): it uploads the
 * bundle the user confirmed, with a per-user bearer token (FR-PRV-6).
 */
export function createRenderJobClient(options: RenderJobClientOptions) {
  assertProviderAllowed({
    mode: options.mode,
    provider: {
      providerId: "render-api",
      role: "render-upload",
      networkScope: networkScopeForUrl(options.baseUrl),
    },
  });
  const fetchImplementation = options.fetchImplementation ?? ((input, init) => fetch(input, init));
  const endpoint = (pathname: string) =>
    new URL(pathname, options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
  const authorization = { authorization: `Bearer ${options.token}` };

  return {
    /** Builds the multipart body from the bundle directory: render-job.json plus every listed asset, nothing else. */
    async buildUploadForm(bundle: { job: RenderJob; bundleDirectory: string }): Promise<FormData> {
      const form = new FormData();
      const jobJson = await readFile(path.join(bundle.bundleDirectory, "render-job.json"), "utf8");
      form.append("job", new Blob([jobJson], { type: "application/json" }), "render-job.json");
      for (const asset of bundle.job.assets) {
        const content = await readFile(path.join(bundle.bundleDirectory, "assets", asset.assetKey));
        form.append(`assets/${asset.assetKey}`, new Blob([content]), asset.assetKey);
      }
      return form;
    },

    async upload(bundle: { job: RenderJob; bundleDirectory: string }): Promise<string> {
      const response = await fetchImplementation(endpoint("render-jobs"), {
        method: "POST",
        headers: authorization,
        body: await this.buildUploadForm(bundle),
      });
      if (!response.ok)
        throw new RemoteRenderError(
          `Render API refused the job (${response.status}): ${(await response.text()).slice(0, 300)}`,
        );
      return z.object({ jobId: z.string() }).parse(await response.json()).jobId;
    },

    async status(jobId: string): Promise<RemoteJobStatus> {
      const response = await fetchImplementation(endpoint(`render-jobs/${jobId}`), {
        headers: authorization,
      });
      if (!response.ok) throw new RemoteRenderError(`Render API status failed (${response.status})`);
      return remoteJobStatusSchema.parse(await response.json());
    },

    async download(jobId: string, fileName: string): Promise<Buffer> {
      const response = await fetchImplementation(
        endpoint(`render-jobs/${jobId}/files/${encodeURIComponent(fileName)}`),
        { headers: authorization },
      );
      if (!response.ok) throw new RemoteRenderError(`Download of ${fileName} failed (${response.status})`);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

export type RenderJobClient = ReturnType<typeof createRenderJobClient>;
