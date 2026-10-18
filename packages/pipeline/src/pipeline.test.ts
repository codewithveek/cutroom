import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import { createSilentProvider } from "@cutroom/voice";
import { describe, expect, it } from "vitest";
import { createPipelineServices } from "./create-services";
import { InProcessRunner } from "./in-process-runner";
import { latestStoryboardVersion, type RunRequestInput } from "./run-schema";
import { createShipnoteScriptedTransport } from "./scripted/shipnote-script";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");

async function createRunner() {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-pipeline-"));
  const services = createPipelineServices({
    env: parseEnv({ CUTROOM_DATA_DIR: dataDirectory, LOG_LEVEL: "silent" }),
    logger: createLogger({ level: "silent" }),
    overrides: {
      modelTransportOverride: createShipnoteScriptedTransport(),
      voiceProviderOverride: createSilentProvider(),
      enforceLocalEgress: true,
    },
  });
  return new InProcessRunner(services);
}

const baseRequest: RunRequestInput = {
  source: { kind: "path", path: shipnoteFixture },
  videoType: "launch",
  look: "editorial",
  ratios: ["9:16"],
  targetSeconds: 30,
  voice: { provider: "none", voiceId: "silent", speed: 1 },
  music: { kind: "generated", bed: "upbeat" },
  privacyMode: "local",
};

describe("InProcessRunner", () => {
  it("pauses for review, versions edits and re-audits only changed scenes", async () => {
    const runner = await createRunner();
    const { runId } = await runner.start(baseRequest);
    const paused = await runner.waitForStatus(runId, ["awaiting_review"]);
    expect(paused.status).toBe("awaiting_review");
    const version = latestStoryboardVersion(paused);
    expect(version?.audited).toBe(true);
    expect(version?.claimResults.length).toBeGreaterThan(10);
    const storyboard = structuredClone(version?.storyboard);
    if (!storyboard) throw new Error("no storyboard");
    const lastScene = storyboard.scenes.at(-1);
    if (lastScene?.block !== "end-card") throw new Error("fixture drift");
    lastScene.props.cta = "Try it free today";
    const edit = await runner.updateStoryboard(runId, storyboard);
    expect(edit.version).toBe(2);
    expect(
      edit.claimResults
        .filter((result) => result.sceneId === lastScene.id)
        .some((result) => result.claimText === "Try it free today"),
    ).toBe(true);
    const run = await runner.getRun(runId);
    expect(run?.storyboardVersions).toHaveLength(2);
    expect(run?.storyboardVersions[1]?.author).toBe("user");
  });

  it("refuses approval while claims are unsupported", async () => {
    const runner = await createRunner();
    const { runId } = await runner.start(baseRequest);
    const paused = await runner.waitForStatus(runId, ["awaiting_review"]);
    const version = latestStoryboardVersion(paused);
    if (!version) throw new Error("no storyboard");
    const storyboard = structuredClone(version.storyboard);
    const firstScene = storyboard.scenes[0];
    if (firstScene?.block !== "kinetic-headline") throw new Error("fixture drift");
    firstScene.props.lines = ['Click "Export PDF" in one step'];
    const edit = await runner.updateStoryboard(runId, storyboard);
    const blocking = edit.claimResults.filter((result) => result.verdict === "unsupported");
    expect(blocking.length).toBeGreaterThan(0);
    await expect(
      runner.approveStoryboard(runId, { versionId: edit.versionId, overrides: [] }),
    ).rejects.toThrow(/unsupported/);
  });

  it("repo in, MP4 out: auto-approves, voices, renders and writes a delivery note with no network", async () => {
    const runner = await createRunner();
    const { runId } = await runner.start({ ...baseRequest, autoApprove: true });
    const run = await runner.waitForStatus(runId, ["completed"]);
    expect(run.error).toBeUndefined();
    expect(run.status).toBe("completed");
    expect(run.approval?.auto).toBe(true);
    const video = run.assets.find((asset) => asset.kind === "video");
    expect(video?.ratio).toBe("9:16");
    if (!video) throw new Error("no video");
    await access(video.filePath);
    for (const asset of run.assets) expect(asset.bytes, `${asset.kind} ${asset.filePath}`).toBeGreaterThan(0);
    const note = run.assets.find((asset) => asset.kind === "delivery-note");
    const noteText = await readFile(note?.filePath ?? "", "utf8");
    expect(noteText).toContain("Ran fully local");
    expect(noteText).toContain("Claims audited");
    const events = await runner.listEvents(runId);
    expect(events.filter((event) => event.kind === "completed").map((event) => event.step)).toEqual(
      expect.arrayContaining([
        "ingest-repository",
        "analyze-product",
        "plan-storyboard",
        "audit-claims",
        "render",
      ]),
    );
  }, 600_000);
});
