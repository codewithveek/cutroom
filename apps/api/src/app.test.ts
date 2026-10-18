import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  createSystemService,
  InProcessRunner,
} from "@cutroom/pipeline";
import { createSilentProvider } from "@cutroom/voice";
import type { FastifyInstance } from "fastify";
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
  app = await buildApp({ env, runner, store: services.store, system: createSystemService(services) });
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

describe("catalogue", () => {
  it("serves health, presets and looks", async () => {
    expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok" });
    const presetsResponse = await app.inject({ method: "GET", url: "/presets" });
    expect(presetsResponse.json().presets).toHaveLength(6);
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
    expect(emptySettings.statusCode).toBe(400);
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

describe("parseRangeHeader", () => {
  it("parses byte ranges", () => {
    expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRangeHeader("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRangeHeader("bytes=2000-", 1000)).toBeUndefined();
    expect(parseRangeHeader(undefined, 1000)).toBeUndefined();
  });
});
