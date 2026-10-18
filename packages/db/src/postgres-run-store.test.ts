import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import { createPipelineServices, createShipnoteScriptedTransport, InProcessRunner } from "@cutroom/pipeline";
import { createSilentProvider } from "@cutroom/voice";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle, runMigrations } from "./database";
import { PostgresRunStore } from "./postgres-run-store";

const connectionString = process.env.CUTROOM_TEST_DATABASE_URL;
const shipnoteFixture = path.resolve(import.meta.dirname, "../../../evals/fixtures/shipnote");

describe.skipIf(!connectionString)("PostgresRunStore", () => {
  let database: DatabaseHandle;
  let store: PostgresRunStore;
  let runner: InProcessRunner;

  beforeAll(async () => {
    database = createDatabase({ connectionString: connectionString ?? "" });
    await runMigrations(database.db);
    await database.db.execute(sql`truncate projects, runs, voice_clips cascade`);
    const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-db-"));
    store = new PostgresRunStore({ database, filesRoot: path.join(dataDirectory, "runs") });
    const services = createPipelineServices({
      env: parseEnv({ CUTROOM_DATA_DIR: dataDirectory, LOG_LEVEL: "silent" }),
      logger: createLogger({ level: "silent" }),
      overrides: {
        store,
        modelTransportOverride: createShipnoteScriptedTransport(),
        voiceProviderOverride: createSilentProvider(),
      },
    });
    runner = new InProcessRunner(services);
  });

  afterAll(async () => {
    await store?.close();
    await database?.close();
  });

  it("runs the pipeline to review on Postgres and round-trips the whole record", async () => {
    const { runId } = await runner.start({
      source: { kind: "path", path: shipnoteFixture },
      videoType: "launch",
      look: "editorial",
      ratios: ["16:9", "9:16"],
      targetSeconds: 30,
      voice: { provider: "none", voiceId: "silent", speed: 1 },
      music: { kind: "none" },
      privacyMode: "local",
    });
    const paused = await runner.waitForStatus(runId, ["awaiting_review"]);
    expect(paused.status).toBe("awaiting_review");
    expect(paused.brief?.name).toBe("Shipnote");
    expect(paused.storyboardVersions[0]?.claimResults.length).toBeGreaterThan(0);

    const version = paused.storyboardVersions[0];
    if (!version) throw new Error("no storyboard");
    const edited = structuredClone(version.storyboard);
    const firstScene = edited.scenes[0];
    if (firstScene) firstScene.transitionIn = "zoom";
    await runner.updateStoryboard(runId, edited);

    const reread = await store.get(runId);
    expect(reread?.storyboardVersions.map((candidate) => candidate.version)).toEqual([1, 2]);
    const claimIds = (results: ReadonlyArray<{ claimId: string }> | undefined) =>
      (results ?? []).map((claim) => claim.claimId).toSorted();
    expect(claimIds(reread?.storyboardVersions[1]?.claimResults)).toEqual(claimIds(version.claimResults));
    expect(reread?.storyboardVersions[0]).toEqual(version);
    expect(reread?.request.ratios).toEqual(["16:9", "9:16"]);
    expect((await store.list()).map((run) => run.id)).toContain(runId);
    const events = await store.listEvents(runId);
    expect(events.map((event) => event.step)).toContain("audit-claims");
    expect(await store.listEventsAfter(runId, events.at(-2)?.id ?? "")).toHaveLength(1);
  });

  it("serialises concurrent updates and notifies other connections of new events", async () => {
    const { runId } = await runner.start({
      source: { kind: "path", path: shipnoteFixture },
      videoType: "launch",
      look: "graphic",
      ratios: ["16:9"],
      targetSeconds: 30,
      voice: { provider: "none", voiceId: "silent", speed: 1 },
      music: { kind: "none" },
      privacyMode: "local",
    });
    await runner.waitForStatus(runId, ["awaiting_review"]);
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        store.update(runId, (run) => ({
          ...run,
          metrics: [...run.metrics, { step: "review", startedAt: "x", finishedAt: "y", durationMs: index }],
        })),
      ),
    );
    const metrics = (await store.get(runId))?.metrics.filter((metric) => metric.step === "review") ?? [];
    expect(metrics.length).toBeGreaterThanOrEqual(8);

    const otherConnection = new PostgresRunStore({ database, filesRoot: tmpdir() });
    const heard = new Promise<void>((resolve) => {
      const stop = otherConnection.watchEvents(runId, () => {
        stop();
        resolve();
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await store.appendEvent({
      id: "01ZZZZZZZZZZZZZZZZZZZZZZZZ",
      runId,
      step: "review",
      kind: "progress",
      payload: { note: "hello" },
      createdAt: new Date().toISOString(),
    });
    await heard;
    await otherConnection.close();
  });
});
