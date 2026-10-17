import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  InProcessRunner,
  latestStoryboardVersion,
  RenderJobWorker,
} from "@cutroom/pipeline";
import { createSilentProvider } from "@cutroom/voice";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");
const token = "test-render-token-123";

describe("Hybrid mode", () => {
  it("analyses locally, waits for egress consent, then renders remotely from the uploaded bundle only", async () => {
    const renderHostDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-render-host-"));
    const hostEnv = parseEnv({ CUTROOM_DATA_DIR: renderHostDirectory, RENDER_API_TOKEN: token });
    const hostServices = createPipelineServices({ env: hostEnv, logger: createLogger({ level: "silent" }) });
    const worker = new RenderJobWorker({
      dataDirectory: renderHostDirectory,
      browserExecutable: hostServices.browserExecutable,
      logger: hostServices.logger,
    });
    const renderHost = await buildApp({
      env: hostEnv,
      runner: new InProcessRunner(hostServices),
      store: hostServices.store,
      renderJobWorker: worker,
    });
    const address = await renderHost.listen({ host: "127.0.0.1", port: 0 });

    const unauthorised = await renderHost.inject({ method: "GET", url: "/render-jobs/x" });
    expect(unauthorised.statusCode).toBe(401);

    const laptopDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-laptop-"));
    const runner = new InProcessRunner(
      createPipelineServices({
        env: parseEnv({
          CUTROOM_DATA_DIR: laptopDirectory,
          RENDER_API_BASE_URL: address,
          RENDER_API_TOKEN: token,
        }),
        logger: createLogger({ level: "silent" }),
        overrides: {
          modelTransportOverride: createShipnoteScriptedTransport(),
          voiceProviderOverride: createSilentProvider(),
        },
      }),
    );
    try {
      const { runId } = await runner.start({
        source: { kind: "path", path: shipnoteFixture },
        videoType: "launch",
        look: "graphic",
        ratios: ["1:1"],
        targetSeconds: 30,
        voice: { provider: "none", voiceId: "silent", speed: 1 },
        music: { kind: "none" },
        privacyMode: "hybrid",
      });
      const review = await runner.waitForStatus(runId, ["awaiting_review"]);
      const version = latestStoryboardVersion(review);
      if (!version) throw new Error("no storyboard");
      await runner.approveStoryboard(runId, { versionId: version.id, overrides: [] });
      const waiting = await runner.waitForStatus(runId, ["awaiting_egress"]);
      expect(waiting.status).toBe("awaiting_egress");
      const files = waiting.egress?.manifest.files.map((file) => file.path) ?? [];
      expect(files).toContain("render-job.json");
      expect(files.every((file) => file === "render-job.json" || file.startsWith("assets/"))).toBe(true);
      await expect(runner.confirmEgress(runId, "0".repeat(64))).rejects.toThrow(/changed/);
      await runner.confirmEgress(runId, waiting.egress?.manifestSha256 ?? "");
      const done = await runner.waitForStatus(runId, ["completed"]);
      expect(done.error).toBeUndefined();
      expect(done.egress?.remoteJobId).toBe(runId);
      expect(done.assets.find((asset) => asset.kind === "video")?.ratio).toBe("1:1");
    } finally {
      await renderHost.close();
    }
  }, 600_000);
});
