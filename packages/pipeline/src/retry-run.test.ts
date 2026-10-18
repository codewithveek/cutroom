import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { shipnoteBriefDraft, shipnoteStoryboardDraft } from "@cutroom/agent";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import type { JsonCompletionTransport } from "@cutroom/providers";
import { createSilentProvider } from "@cutroom/voice";
import { describe, expect, it } from "vitest";
import { createPipelineServices } from "./create-services";
import { InProcessRunner, RunStateError } from "./in-process-runner";
import { createShipnoteScriptedTransport } from "./scripted/shipnote-script";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");

describe("retryRun", () => {
  it("picks a failed run up at the failed step, keeping the brief", async () => {
    let planningWorks = false;
    let briefCalls = 0;
    const shipnote = createShipnoteScriptedTransport();
    // Planning answers with an empty storyboard (invalid every time) until the retry.
    const transport: JsonCompletionTransport = {
      ...shipnote,
      async complete(request) {
        if (request.schemaName === "product_brief") briefCalls += 1;
        if (request.schemaName === "storyboard_draft" && !planningWorks)
          return {
            content: JSON.stringify({ ...shipnoteStoryboardDraft, scenes: [] }),
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        return shipnote.complete(request);
      },
    };
    const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-retry-"));
    const runner = new InProcessRunner(
      createPipelineServices({
        env: parseEnv({ CUTROOM_DATA_DIR: dataDirectory, LOG_LEVEL: "silent" }),
        logger: createLogger({ level: "silent" }),
        overrides: { modelTransportOverride: transport, voiceProviderOverride: createSilentProvider() },
      }),
    );
    const { runId } = await runner.start({
      source: { kind: "path", path: shipnoteFixture },
      videoType: "launch",
      look: "editorial",
      ratios: ["16:9"],
      targetSeconds: 30,
      voice: { provider: "none", voiceId: "silent", speed: 1 },
      music: { kind: "none" },
      privacyMode: "local",
    });
    const failed = await runner.waitForStatus(runId, ["awaiting_review", "failed"]);
    expect(failed.status).toBe("failed");
    expect(failed.brief?.name).toBe(shipnoteBriefDraft.name);
    const before = briefCalls;
    planningWorks = true;
    await runner.retryRun(runId);
    const paused = await runner.waitForStatus(runId, ["awaiting_review", "failed"]);
    expect(paused.status).toBe("awaiting_review");
    expect(paused.error).toBeUndefined();
    expect(briefCalls).toBe(before);
    // Only a failed run can be retried.
    await expect(runner.retryRun(runId)).rejects.toBeInstanceOf(RunStateError);
  }, 120_000);
});
