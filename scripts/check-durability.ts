/**
 * PRD M4 acceptance: "killing the worker mid-run resumes correctly".
 * Starts a worker process, runs the shipnote fixture through Temporal, approves the storyboard,
 * SIGKILLs the worker while it renders, starts a fresh worker, and checks the run still completes
 * with its video. Needs Postgres (DATABASE_URL) and a Temporal server (TEMPORAL_ADDRESS).
 * Usage: DATABASE_URL=postgres://… tsx scripts/check-durability.ts
 */
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createDatabase, PostgresRunStore, runMigrations } from "@cutroom/db";
import { createLogger } from "@cutroom/observability";
import { createPipelineServices, latestStoryboardVersion, type RunEvent } from "@cutroom/pipeline";
import { TemporalRunner } from "@cutroom/temporal";
import { Client, Connection } from "@temporalio/client";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-durability-"));
const env = parseEnv({
  ...process.env,
  CUTROOM_DATA_DIR: dataDirectory,
  RUN_STORE: "postgres",
  RUNNER: "temporal",
  MODEL_PROVIDER: "scripted-shipnote",
  LOG_LEVEL: "warn",
  // A queue of our own, so a worker left running elsewhere cannot pick up these tasks.
  TEMPORAL_TASK_QUEUE: `cutroom-durability-${Date.now()}`,
});
const workerEnv = {
  ...process.env,
  CUTROOM_DATA_DIR: dataDirectory,
  RUN_STORE: "postgres",
  RUNNER: "temporal",
  MODEL_PROVIDER: "scripted-shipnote",
  LOG_LEVEL: "warn",
  TEMPORAL_TASK_QUEUE: env.TEMPORAL_TASK_QUEUE,
  DATABASE_URL: env.DATABASE_URL,
};

function startWorker(label: string): ChildProcess {
  // Its own process group, so a kill reaches the node process behind `npx tsx`, not just npx.
  const child = spawn("npx", ["tsx", "apps/worker/src/main.ts"], {
    cwd: repositoryRoot,
    env: workerEnv,
    stdio: "inherit",
    detached: true,
  });
  console.log(`▸ ${label} worker started (pid ${child.pid})`);
  return child;
}

function killWorker(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid) process.kill(-child.pid, signal);
}

function until<Value>(options: {
  label: string;
  timeoutMs: number;
  check: () => Promise<Value | undefined>;
}): Promise<Value> {
  const deadline = Date.now() + options.timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = async () => {
      const value = await options.check().catch(() => undefined);
      if (value !== undefined) return resolve(value);
      if (Date.now() > deadline) return reject(new Error(`Timed out waiting for ${options.label}`));
      setTimeout(() => void poll(), 1000);
    };
    void poll();
  });
}

if (!env.DATABASE_URL) throw new Error("Set DATABASE_URL.");
const database = createDatabase({ connectionString: env.DATABASE_URL });
await runMigrations(database.db);
const store = new PostgresRunStore({ database, filesRoot: path.join(dataDirectory, "runs") });
const services = createPipelineServices({
  env,
  logger: createLogger({ level: "warn" }),
  overrides: { store },
});
const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
const runner = new TemporalRunner({
  services: { ...services, store },
  client: new Client({ connection, namespace: env.TEMPORAL_NAMESPACE }),
  taskQueue: env.TEMPORAL_TASK_QUEUE,
});

let worker = startWorker("first");
const { runId } = await runner.start({
  source: { kind: "path", path: path.join(repositoryRoot, "evals/fixtures/shipnote") },
  videoType: "launch",
  look: "editorial",
  ratios: ["16:9"],
  targetSeconds: 30,
  voice: { provider: "none", voiceId: "silent", speed: 1 },
  music: { kind: "none" },
  privacyMode: "local",
});
console.log(`▸ run ${runId} started`);

const review = await until({
  label: "review",
  timeoutMs: 180_000,
  check: async () => {
    const run = await runner.getRun(runId);
    return run?.status === "awaiting_review" ? run : undefined;
  },
});
const version = latestStoryboardVersion(review);
if (!version) throw new Error("No storyboard to approve");
await runner.approveStoryboard(runId, { versionId: version.id, overrides: [] });
console.log("▸ approved; waiting for the render to start");

const renderStarted = (events: ReadonlyArray<RunEvent>) =>
  events.filter((event) => event.step === "render" && event.kind === "started").length;
await until({
  label: "render start",
  timeoutMs: 180_000,
  check: async () => (renderStarted(await runner.listEvents(runId)) > 0 ? true : undefined),
});
await new Promise((resolve) => setTimeout(resolve, 4000));
killWorker(worker, "SIGKILL");
console.log("▸ worker killed mid-render");
await new Promise((resolve) => setTimeout(resolve, 2000));
worker = startWorker("replacement");

const finished = await until({
  label: "completion",
  timeoutMs: 600_000,
  check: async () => {
    const run = await runner.getRun(runId);
    return run?.status === "completed" || run?.status === "failed" ? run : undefined;
  },
});
const events = await runner.listEvents(runId);
killWorker(worker, "SIGTERM");
await connection.close();
await store.close();
await database.close();

const videos = finished.assets.filter((asset) => asset.kind === "video");
console.log(`▸ run ${finished.status}; render started ${renderStarted(events)}×; ${videos.length} video(s)`);
if (finished.status !== "completed" || videos.length !== 1 || renderStarted(events) < 2) {
  console.error("✘ Durability check failed");
  process.exit(1);
}
console.log("✔ The run survived a killed worker and completed.");
process.exit(0);
