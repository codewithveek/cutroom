import { access, mkdtemp } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import { type Scene, screenshotAssetKey } from "@cutroom/scene-spec";
import { createSilentProvider } from "@cutroom/voice";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPipelineServices } from "./create-services";
import { InProcessRunner, StoryboardEditError } from "./in-process-runner";
import { latestStoryboardVersion } from "./run-schema";
import { createShipnoteScriptedTransport } from "./scripted/shipnote-script";

const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");
const appPage = `<!doctype html><html><head><title>Shipnote</title></head>
<body style="font: 16px sans-serif; padding: 40px">
  <h1>Release notes</h1>
  <button style="margin-top: 400px">Draft release notes from your commits</button>
</body></html>`;

let server: Server;
let appUrl = "";

beforeAll(async () => {
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(appPage);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  appUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

async function createRunner(): Promise<InProcessRunner> {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-capture-run-"));
  return new InProcessRunner(
    createPipelineServices({
      env: parseEnv({ CUTROOM_DATA_DIR: dataDirectory, LOG_LEVEL: "silent" }),
      logger: createLogger({ level: "silent" }),
      overrides: {
        modelTransportOverride: createShipnoteScriptedTransport(),
        voiceProviderOverride: createSilentProvider(),
        enforceLocalEgress: true,
      },
    }),
  );
}

function screenshotScene(props: { screenId: string; focusText: string }): Scene {
  return {
    id: "scene-screen",
    beat: "moment",
    block: "screenshot-window",
    baseFrames: 120,
    props: { ...props, view: { imageWidth: 10, imageHeight: 10 } },
    narration: [{ text: "Write the changelog in one click." }],
  };
}

describe("capture-screens step", () => {
  it("captures the app, serves the screenshot and fills screenshot scenes from the capture", async () => {
    const runner = await createRunner();
    const { runId } = await runner.start({
      source: { kind: "path", path: shipnoteFixture },
      videoType: "launch",
      look: "editorial",
      ratios: ["16:9"],
      targetSeconds: 30,
      voice: { provider: "none", voiceId: "silent", speed: 1 },
      music: { kind: "none" },
      privacyMode: "local",
      capture: { appUrl, routes: ["/"] },
    });
    const paused = await runner.waitForStatus(runId, ["awaiting_review", "failed"]);
    expect(paused.error).toBeUndefined();
    const [screen] = paused.capture?.screens ?? [];
    expect(screen?.targets.map((target) => target.text)).toContain("Draft release notes from your commits");
    const screenshotPath = await runner.mediaFilePath(runId, screenshotAssetKey("screen-1"));
    if (!screenshotPath) throw new Error("no screenshot");
    await access(screenshotPath);

    const version = latestStoryboardVersion(paused);
    if (!version) throw new Error("no storyboard");
    // The planner was told to show a captured screen, and the view came from the capture.
    const planned = version.storyboard.scenes.find((scene) => scene.block === "screenshot-window");
    if (planned?.block !== "screenshot-window") throw new Error("the planner showed no captured screen");
    expect(planned.props.screenId).toBe("screen-1");
    expect(planned.props.view?.imageWidth).toBe(1440);
    const scenes = [...version.storyboard.scenes];
    scenes.splice(
      1,
      0,
      screenshotScene({ screenId: "screen-1", focusText: "Draft release notes from your commits" }),
    );
    await runner.updateStoryboard(runId, { ...version.storyboard, scenes });
    const edited = latestStoryboardVersion((await runner.getRun(runId)) ?? paused);
    const shown = edited?.storyboard.scenes.find((scene) => scene.id === "scene-screen");
    if (shown?.block !== "screenshot-window") throw new Error("scene missing");
    expect(shown.props.view?.imageWidth).toBe(1440);
    expect(shown.props.view?.focusBox?.y).toBeGreaterThan(0.4);

    scenes[1] = screenshotScene({ screenId: "screen-1", focusText: "Export to PDF" });
    await expect(runner.updateStoryboard(runId, { ...version.storyboard, scenes })).rejects.toBeInstanceOf(
      StoryboardEditError,
    );
  }, 300_000);
});
