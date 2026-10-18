import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import { createChangesFixtureRepo } from "@cutroom/repo-ingest";
import { createSilentProvider } from "@cutroom/voice";
import { beforeAll, describe, expect, it } from "vitest";
import { createPipelineServices } from "./create-services";
import { InProcessRunner } from "./in-process-runner";
import { latestStoryboardVersion, type RunRequestInput } from "./run-schema";
import { createShipnoteScriptedTransport } from "./scripted/shipnote-script";

let repo = "";

beforeAll(async () => {
  repo = path.join(await mkdtemp(path.join(tmpdir(), "cutroom-changes-run-")), "shipnote");
  await createChangesFixtureRepo(repo);
});

async function createRunner() {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-changes-data-"));
  return new InProcessRunner(
    createPipelineServices({
      env: parseEnv({ CUTROOM_DATA_DIR: dataDirectory, LOG_LEVEL: "silent" }),
      logger: createLogger({ level: "silent" }),
      overrides: {
        modelTransportOverride: createShipnoteScriptedTransport(),
        voiceProviderOverride: createSilentProvider(),
      },
    }),
  );
}

function request(changes: RunRequestInput["changes"]): RunRequestInput {
  return {
    source: { kind: "path", path: repo },
    videoType: "launch",
    look: "editorial",
    ratios: ["16:9"],
    targetSeconds: 30,
    voice: { provider: "none", voiceId: "silent", speed: 1 },
    music: { kind: "none" },
    privacyMode: "local",
    ...(changes ? { changes } : {}),
  };
}

describe("changes-to-video", () => {
  it("briefs only what the release added, from the toRef tree, and reaches review", async () => {
    const runner = await createRunner();
    const { runId } = await runner.start(request({ fromRef: "v1.0.0", toRef: "v1.1.0" }));
    const paused = await runner.waitForStatus(runId, ["awaiting_review", "failed"]);
    expect(paused.error).toBeUndefined();
    expect(paused.brief?.features.map((feature) => feature.title)).toEqual(["Draft the changelog"]);
    expect(paused.brief?.features[0]?.evidence[0]).toMatchObject({ filePath: "src/draft.ts", lineStart: 2 });
    const ingest = (await runner.listEvents(runId)).find(
      (event) => event.step === "ingest-repository" && event.kind === "completed",
    );
    expect(ingest?.payload).toMatchObject({ range: "v1.0.0..v1.1.0", commits: 2 });
    expect(latestStoryboardVersion(paused)?.audited).toBe(true);
  }, 120_000);

  it("finds no user-visible changes in a refactor-only range and makes no video", async () => {
    const runner = await createRunner();
    const { runId } = await runner.start(request({ fromRef: "refactor-only-start", toRef: "v1.1.0" }));
    const failed = await runner.waitForStatus(runId, ["awaiting_review", "failed"]);
    expect(failed.status).toBe("failed");
    expect(failed.error?.code).toBe("no_user_visible_changes");
    expect(failed.error?.message).toMatch(
      /No user-visible changes found between refactor-only-start and v1\.1\.0/,
    );
  }, 120_000);
});
