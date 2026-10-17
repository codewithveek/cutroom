import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { encodeWav } from "@cutroom/audio-io";
import { estimateTimeline, fixtureStoryboardInput, storyboardSchema } from "@cutroom/scene-spec";
import { describe, expect, it } from "vitest";
import { buildRenderJobBundle, RenderJobIntegrityError, verifyRenderJobUpload } from "./render-job-bundle";
import { createRenderJobClient } from "./render-job-client";

async function makeBundle() {
  const directory = await mkdtemp(path.join(tmpdir(), "cutroom-bundle-"));
  const clipPath = path.join(directory, "clip.wav");
  await writeFile(clipPath, encodeWav({ sampleRate: 24_000, channels: [new Float32Array(2400)] }));
  const storyboard = storyboardSchema.parse(fixtureStoryboardInput);
  const bundle = await buildRenderJobBundle({
    job: {
      jobId: "01JTESTJOB0000000000000000",
      storyboard,
      voiceTimeline: estimateTimeline({ scenes: storyboard.scenes, transitionFrames: 14 }),
      ratios: ["16:9"],
      music: { kind: "generated", bed: "calm" },
    },
    files: [{ assetKey: "voice-abc", kind: "voice-clip", filePath: clipPath }],
    bundleDirectory: path.join(directory, "bundle"),
  });
  const jobJson = await readFile(path.join(bundle.bundleDirectory, "render-job.json"), "utf8");
  const clip = await readFile(path.join(bundle.bundleDirectory, "assets", "voice-abc"));
  return { bundle, jobJson, clip };
}

describe("render job bundle", () => {
  it("lists every file and every code excerpt in the manifest", async () => {
    const { bundle, jobJson } = await makeBundle();
    expect(bundle.manifest.files.map((file) => file.path)).toEqual(["assets/voice-abc", "render-job.json"]);
    expect(bundle.manifest.files.find((file) => file.path === "render-job.json")?.bytes).toBe(
      Buffer.byteLength(jobJson),
    );
    expect(bundle.manifest.codeExcerpts).toEqual([
      { sceneId: "scene-code", filePath: "src/group-commits.ts", lineStart: 1, lineEnd: 5 },
    ]);
  });

  it("accepts the untouched upload and rejects tampering, extra and missing files", async () => {
    const { bundle, jobJson, clip } = await makeBundle();
    const files = [{ path: "assets/voice-abc", content: clip }];
    expect(() => verifyRenderJobUpload({ job: bundle.job, jobJson, files })).not.toThrow();
    const tampered = Buffer.from(clip);
    tampered[100] = 7;
    expect(() =>
      verifyRenderJobUpload({
        job: bundle.job,
        jobJson,
        files: [{ path: "assets/voice-abc", content: tampered }],
      }),
    ).toThrow(RenderJobIntegrityError);
    expect(() =>
      verifyRenderJobUpload({
        job: bundle.job,
        jobJson,
        files: [...files, { path: "assets/source.ts", content: Buffer.from("secret") }],
      }),
    ).toThrow(/Unexpected file/);
    expect(() => verifyRenderJobUpload({ job: bundle.job, jobJson, files: [] })).toThrow(/Missing files/);
    const edited = { ...bundle.job, ratios: ["16:9", "9:16"] as const };
    const editedJson = JSON.stringify(edited);
    expect(() =>
      verifyRenderJobUpload({ job: { ...edited, ratios: [...edited.ratios] }, jobJson: editedJson, files }),
    ).toThrow(/egress manifest/);
  });

  it("uploads only manifest-listed files (FR-PRV-5)", async () => {
    const { bundle } = await makeBundle();
    const client = createRenderJobClient({
      baseUrl: "https://render.example.com",
      token: "t",
      mode: "hybrid",
    });
    const form = await client.buildUploadForm(bundle);
    const uploadedPaths = [...form.keys()].map((key) => (key === "job" ? "render-job.json" : key)).sort();
    expect(uploadedPaths).toEqual(bundle.manifest.files.map((file) => file.path).sort());
  });

  it("refuses to build an upload client in Local mode", () => {
    expect(() =>
      createRenderJobClient({ baseUrl: "https://render.example.com", token: "t", mode: "local" }),
    ).toThrow(/local mode/);
  });
});
