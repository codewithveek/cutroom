import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLogger } from "@cutroom/observability";
import { describe, expect, it } from "vitest";
import { type RunRecord, runRecordSchema } from "../run-schema";
import { FileRunStore } from "../store/file-run-store";
import { DemoSeedError, seedDemoRuns, seedFilesOf, toSeedRun } from "./demo-seed";

const logger = createLogger({ level: "silent" });
const runId = "01J00000000000000000000SED";

function sampleRun(runDirectory: string): RunRecord {
  return runRecordSchema.parse({
    id: runId,
    status: "completed",
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
    snapshotDirectory: path.join(runDirectory, "snapshot"),
    request: {
      source: { kind: "path", path: "evals/fixtures/shipnote" },
      videoType: "launch",
      ratios: ["16:9"],
      targetSeconds: 30,
      voice: { provider: "none", voiceId: "silent", speed: 1 },
      music: { kind: "none" },
      privacyMode: "local",
    },
    assets: [
      {
        id: "01J00000000000000000000AST",
        kind: "video",
        ratio: "16:9",
        version: 1,
        filePath: path.join(runDirectory, "deliverables", "launch-16x9.mp4"),
        bytes: 5,
      },
    ],
  });
}

async function writeSeed(seedDirectory: string, run: RunRecord): Promise<void> {
  const seedRunDirectory = path.join(seedDirectory, "runs", run.id);
  await mkdir(path.join(seedRunDirectory, "deliverables"), { recursive: true });
  await writeFile(path.join(seedRunDirectory, "deliverables", "launch-16x9.mp4"), "video");
  await writeFile(path.join(seedRunDirectory, "run.json"), JSON.stringify(run));
}

describe("demo seed", () => {
  it("makes paths relative for export and drops the code snapshot", () => {
    const cachedClip = { assetKey: "voice-1", filePath: "/data/voice-cache/abc.wav", durationMs: 900 };
    const { run: seedRun, files } = toSeedRun({
      run: { ...sampleRun("/data/runs/x"), voiceClips: [cachedClip] },
      runDirectory: "/data/runs/x",
    });
    expect(seedFilesOf(seedRun)).toEqual(["deliverables/launch-16x9.mp4", "voice/abc.wav"]);
    expect(files).toContainEqual({ from: "/data/voice-cache/abc.wav", to: "voice/abc.wav" });
    expect(seedRun.snapshotDirectory).toBeUndefined();
  });

  it("loads runs and their files into an empty store, once", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cutroom-seed-"));
    const seedDirectory = path.join(root, "seed");
    await writeSeed(seedDirectory, toSeedRun({ run: sampleRun("/x"), runDirectory: "/x" }).run);
    const store = new FileRunStore(path.join(root, "runs"));

    expect(await seedDemoRuns({ store, seedDirectory, logger })).toEqual({ seeded: 1 });
    const seeded = await store.get(runId);
    const videoPath = seeded?.assets[0]?.filePath ?? "";
    expect(videoPath.startsWith(store.runDirectory(runId))).toBe(true);
    expect(await readFile(videoPath, "utf8")).toBe("video");

    expect(await seedDemoRuns({ store, seedDirectory, logger })).toEqual({ seeded: 0 });
  });

  it("refuses a seed that points outside its run folder", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cutroom-seed-"));
    const seedDirectory = path.join(root, "seed");
    const escaping = sampleRun("/x");
    const asset = escaping.assets[0];
    if (!asset) throw new Error("expected an asset");
    await writeSeed(seedDirectory, { ...escaping, assets: [{ ...asset, filePath: "../../etc/passwd" }] });
    const store = new FileRunStore(path.join(root, "runs"));
    await expect(seedDemoRuns({ store, seedDirectory, logger })).rejects.toThrow(DemoSeedError);
  });
});
