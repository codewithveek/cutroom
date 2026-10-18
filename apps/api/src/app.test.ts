import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { encodeWav } from "@cutroom/audio-io";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  createSystemService,
  InProcessRunner,
} from "@cutroom/pipeline";
import { createChangesFixtureRepo } from "@cutroom/repo-ingest";
import { createSilentProvider } from "@cutroom/voice";
import type { FastifyInstance } from "fastify";
import { zipSync } from "fflate";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { parseRangeHeader } from "./modules/assets/asset-routes";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");
let app: FastifyInstance;
let runner: InProcessRunner;

beforeAll(async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-api-"));
  const env = parseEnv({ CUTROOM_DATA_DIR: dataDirectory });
  const services = createPipelineServices({
    env,
    logger: createLogger({ level: "silent" }),
    overrides: {
      modelTransportOverride: createShipnoteScriptedTransport(),
      voiceProviderOverride: createSilentProvider(),
    },
  });
  runner = new InProcessRunner(services);
  app = await buildApp({
    env,
    runner,
    store: services.store,
    system: createSystemService(services),
    uploadsDirectory: path.join(dataDirectory, "uploads"),
  });
});

const runBody = {
  source: { kind: "path", path: shipnoteFixture },
  videoType: "launch",
  look: "editorial",
  ratios: ["16:9"],
  targetSeconds: 30,
  voice: { provider: "none", voiceId: "silent", speed: 1 },
  music: { kind: "none" },
  privacyMode: "local",
};

describe("sources", () => {
  it("lists a local repository's tags newest first, and none for a folder without git", async () => {
    const repo = path.join(await mkdtemp(path.join(tmpdir(), "cutroom-tags-")), "shipnote");
    await createChangesFixtureRepo(repo);
    const tagged = await app.inject({ method: "GET", url: `/sources/tags?path=${encodeURIComponent(repo)}` });
    expect(tagged.json().tags).toEqual(expect.arrayContaining(["v1.1.0", "v1.0.0"]));
    const plain = await app.inject({
      method: "GET",
      url: `/sources/tags?path=${encodeURIComponent(tmpdir())}`,
    });
    expect(plain.json()).toEqual({ tags: [] });
  });
});

describe("catalogue", () => {
  it("serves health, presets and looks", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ runner: "in-process", database: "not-used" });
    expect(health.json().checks.map((check: { id: string }) => check.id)).toContain("model");
    const presetsResponse = await app.inject({ method: "GET", url: "/presets" });
    expect(presetsResponse.json().presets).toHaveLength(7);
    const looksResponse = await app.inject({ method: "GET", url: "/looks" });
    expect(looksResponse.json().looks.map((look: { id: string }) => look.id)).toEqual([
      "studio",
      "editorial",
      "graphic",
      "cinematic",
    ]);
  });
});

describe("errors", () => {
  it("uses one envelope for validation errors and unknown routes", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: "/runs",
      payload: { ...runBody, ratios: ["21:9"] },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("validation_failed");
    const missing = await app.inject({ method: "GET", url: "/runs/01JABCDEFGHJKMNPQRSTVWXYZ0" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: "not_found" } });
    expect((await app.inject({ method: "GET", url: "/nope" })).json().error.code).toBe("not_found");
  });
});

describe("runs", () => {
  it("creates a run, reaches review, accepts an edit and blocks approval on unsupported claims", async () => {
    const created = await app.inject({ method: "POST", url: "/runs", payload: runBody });
    expect(created.statusCode).toBe(201);
    const runId: string = created.json().id;
    await runner.waitForStatus(runId, ["awaiting_review"]);
    const view = (await app.inject({ method: "GET", url: `/runs/${runId}` })).json();
    expect(view.status).toBe("awaiting_review");
    expect(view.brief.name).toBe("Shipnote");
    expect(JSON.stringify(view)).not.toContain(shipnoteFixture.replace(/evals.*/, ".cutroom"));
    const storyboard = structuredClone(view.storyboard.storyboard);
    storyboard.scenes[0].props.lines = ['Press "Export PDF" now'];
    const edited = await app.inject({
      method: "PUT",
      url: `/runs/${runId}/storyboard`,
      payload: { storyboard },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().storyboard.version).toBe(2);
    expect(edited.json().storyboard.unsupportedCount).toBeGreaterThan(0);
    const approve = await app.inject({
      method: "POST",
      url: `/runs/${runId}/approve`,
      payload: { versionId: edited.json().storyboard.versionId, overrides: [] },
    });
    expect(approve.statusCode).toBe(409);
    expect(approve.json().error.code).toBe("approval_blocked");
    const events = await runner.listEvents(runId);
    expect(events.length).toBeGreaterThan(5);
    const sceneId: string = edited.json().storyboard.storyboard.scenes[1].id;
    const regenerated = await app.inject({
      method: "POST",
      url: `/runs/${runId}/scenes/${sceneId}/regenerate`,
      payload: {},
    });
    expect(regenerated.statusCode).toBe(200);
    expect(regenerated.json().storyboard.version).toBe(3);
    expect(regenerated.json().storyboard.storyboard.scenes[1].id).toBe(sceneId);
    const unknownScene = await app.inject({
      method: "POST",
      url: `/runs/${runId}/scenes/nope/regenerate`,
      payload: {},
    });
    expect(unknownScene.statusCode).toBe(404);
    const settings = await app.inject({
      method: "PATCH",
      url: `/runs/${runId}/settings`,
      payload: { voice: { provider: "kokoro", voiceId: "bf_emma", speed: 1 }, music: { kind: "none" } },
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().request.voice.voiceId).toBe("bf_emma");
    expect(settings.json().request.music).toEqual({ kind: "none" });
    const emptySettings = await app.inject({ method: "PATCH", url: `/runs/${runId}/settings`, payload: {} });
    const before = (await app.inject({ method: "GET", url: `/runs/${runId}` })).json();
    const editedBrief = { ...before.brief, tagline: "Changelogs from commits, in one command" };
    const replanned = await app.inject({
      method: "PUT",
      url: `/runs/${runId}/brief`,
      payload: { brief: editedBrief },
    });
    expect(replanned.statusCode).toBe(200);
    expect(replanned.json().brief.tagline).toBe("Changelogs from commits, in one command");
    expect(replanned.json().storyboard.version).toBe(before.storyboard.version + 1);
    expect(replanned.json().storyboard.author).toBe("agent");
    const unknownMedia = await app.inject({ method: "GET", url: `/runs/${runId}/media/nope` });
    expect(unknownMedia.statusCode).toBe(404);
    expect(emptySettings.statusCode).toBe(400);
  });

  it("lets the web app PUT and PATCH across origins", async () => {
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/runs/01M55MVJYSFBS7DCNYGS3CFHDF/settings",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "PATCH" },
    });
    expect(preflight.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(preflight.headers["access-control-allow-methods"]).toContain("PUT");
  });

  it("reports the toolchain and lists voices", async () => {
    const status = await app.inject({ method: "GET", url: "/system/status" });
    expect(status.statusCode).toBe(200);
    expect(status.json().model.provider).toBe("scripted");
    expect(status.json().checks.map((check: { id: string }) => check.id)).toEqual([
      "model",
      "voice",
      "ffmpeg",
      "render-host",
    ]);
    expect(status.json().demoRepositoryPath).toBe(shipnoteFixture);
    const voices = await app.inject({ method: "GET", url: "/voices" });
    expect(voices.json().voices[0]).toMatchObject({ id: "af_heart", grade: "A" });
    const unknownVoice = await app.inject({ method: "GET", url: "/voices/xx_nobody/sample" });
    expect(unknownVoice.statusCode).toBe(404);
  });
});

/** A multipart body with one file field, as a browser would send it. */
function multipartFile(options: { fileName: string; content: Uint8Array }): {
  body: Buffer;
  contentType: string;
} {
  const boundary = "----cutroom-test-boundary";
  const head = `--${boundary}\r\ncontent-disposition: form-data; name="archive"; filename="${options.fileName}"\r\ncontent-type: application/zip\r\n\r\n`;
  return {
    body: Buffer.concat([
      Buffer.from(head),
      Buffer.from(options.content),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe("music uploads", () => {
  it("transcodes the user's track into the run's music and serves it for the preview", async () => {
    const created = await app.inject({ method: "POST", url: "/runs", payload: runBody });
    const runId: string = created.json().id;
    await runner.waitForStatus(runId, ["awaiting_review"]);
    const sampleRate = 22_050;
    const tone = Float32Array.from(
      { length: sampleRate },
      (_, index) => 0.2 * Math.sin((index / sampleRate) * 2 * Math.PI * 440),
    );
    const wav = encodeWav({ sampleRate, channels: [tone] });
    const upload = multipartFile({ fileName: "theme.wav", content: wav });
    const response = await app.inject({
      method: "POST",
      url: `/runs/${runId}/music`,
      payload: upload.body,
      headers: { "content-type": upload.contentType },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().request.music).toEqual({
      kind: "uploaded",
      assetKey: "music",
      fileName: "theme.wav",
    });
    expect(response.json().media.map((item: { kind: string }) => item.kind)).toContain("music");
    const media = await app.inject({ method: "GET", url: `/runs/${runId}/media/music` });
    expect(media.statusCode).toBe(200);
    expect(media.headers["content-type"]).toBe("audio/wav");

    const fake = multipartFile({ fileName: "song.mp3", content: new TextEncoder().encode("not audio") });
    const rejected = await app.inject({
      method: "POST",
      url: `/runs/${runId}/music`,
      payload: fake.body,
      headers: { "content-type": fake.contentType },
    });
    expect(rejected.statusCode).toBe(400);
  });
});

describe("zip uploads", () => {
  it("extracts an archive, then a run ingests it as its source", async () => {
    const files = Object.fromEntries(
      [
        "package.json",
        "README.md",
        "src/cli.ts",
        "src/group-commits.ts",
        "src/parse-commit.ts",
        "src/write-changelog.ts",
      ].map((name) => [`shipnote-main/${name}`, readFileSync(path.join(shipnoteFixture, name))]),
    );
    const upload = multipartFile({ fileName: "shipnote-main.zip", content: zipSync(files) });
    const response = await app.inject({
      method: "POST",
      url: "/uploads",
      payload: upload.body,
      headers: { "content-type": upload.contentType },
    });
    expect(response.statusCode).toBe(201);
    const { uploadId, fileName } = response.json();
    expect(response.json().files).toBe(6);
    const created = await app.inject({
      method: "POST",
      url: "/runs",
      payload: { ...runBody, source: { kind: "zip", uploadId, fileName } },
    });
    expect(created.statusCode).toBe(201);
    const run = await runner.waitForStatus(created.json().id, ["awaiting_review"]);
    expect(run.status).toBe("awaiting_review");
    expect(run.brief?.name).toBe("Shipnote");
  });

  it("refuses files that are not zip archives", async () => {
    const upload = multipartFile({ fileName: "notes.txt", content: new TextEncoder().encode("hello") });
    const response = await app.inject({
      method: "POST",
      url: "/uploads",
      payload: upload.body,
      headers: { "content-type": upload.contentType },
    });
    expect(response.statusCode).toBe(400);
    const broken = multipartFile({ fileName: "broken.zip", content: new TextEncoder().encode("not a zip") });
    const brokenResponse = await app.inject({
      method: "POST",
      url: "/uploads",
      payload: broken.body,
      headers: { "content-type": broken.contentType },
    });
    expect(brokenResponse.statusCode).toBe(400);
    expect(brokenResponse.json().error.message).toMatch(/zip/);
  });
});

describe("parseRangeHeader", () => {
  it("parses byte ranges", () => {
    expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRangeHeader("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRangeHeader("bytes=2000-", 1000)).toBeUndefined();
    expect(parseRangeHeader(undefined, 1000)).toBeUndefined();
  });
});
