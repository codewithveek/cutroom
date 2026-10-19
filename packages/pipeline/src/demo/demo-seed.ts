import { cp, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { CutroomLogger } from "@cutroom/observability";
import { type RunRecord, runEventSchema, runRecordSchema } from "../run-schema";
import type { RunStore } from "../store/run-store";

/** A seed file is `demo/seed/runs/<runId>/run.json` with paths relative to that folder. */
const SEED_RUN_FILE = "run.json";
const SEED_EVENTS_FILE = "events.jsonl";

export class DemoSeedError extends Error {
  override readonly name = "DemoSeedError";
}

function relativeInside(options: { directory: string; filePath: string }): string {
  const relative = path.relative(options.directory, options.filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new DemoSeedError(`${options.filePath} is outside the run's folder`);
  return relative.split(path.sep).join("/");
}

function resolveInside(options: { directory: string; relativePath: string }): string {
  const resolved = path.resolve(options.directory, options.relativePath);
  if (!resolved.startsWith(`${path.resolve(options.directory)}${path.sep}`))
    throw new DemoSeedError(`${options.relativePath} points outside the seeded run's folder`);
  return resolved;
}

/** Rewrites every file path in a run with `mapPath`. */
function mapRunFiles(run: RunRecord, mapPath: (filePath: string) => string): RunRecord {
  return {
    ...run,
    assets: run.assets.map((asset) => ({ ...asset, filePath: mapPath(asset.filePath) })),
    voiceClips: run.voiceClips.map((clip) => ({ ...clip, filePath: mapPath(clip.filePath) })),
  };
}

/** The files a seeded run needs: its deliverables and voice clips, nothing else from its folder. */
export function seedFilesOf(run: RunRecord): string[] {
  return [...run.assets.map((asset) => asset.filePath), ...run.voiceClips.map((clip) => clip.filePath)];
}

export interface SeedExport {
  /** The run with every path relative to its seed folder. */
  run: RunRecord;
  /** Absolute source → path inside the seed folder. */
  files: Array<{ from: string; to: string }>;
}

/**
 * For the exporter: deliverables keep their place in the run's folder; voice clips come from the
 * shared voice cache, so they move into the seed's own `voice/` folder.
 */
export function toSeedRun(options: { run: RunRecord; runDirectory: string }): SeedExport {
  const files: SeedExport["files"] = [];
  const { snapshotDirectory: _snapshot, ...withoutSnapshot } = options.run;
  const assets = options.run.assets.map((asset) => {
    const to = relativeInside({ directory: options.runDirectory, filePath: asset.filePath });
    files.push({ from: asset.filePath, to });
    return { ...asset, filePath: to };
  });
  const voiceClips = options.run.voiceClips.map((clip) => {
    const to = `voice/${path.basename(clip.filePath)}`;
    files.push({ from: clip.filePath, to });
    return { ...clip, filePath: to };
  });
  return { run: { ...withoutSnapshot, assets, voiceClips }, files };
}

async function readSeedEvents(seedRunDirectory: string) {
  const content = await readFile(path.join(seedRunDirectory, SEED_EVENTS_FILE), "utf8").catch(() => "");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => runEventSchema.parse(JSON.parse(line)));
}

async function seedOneRun(options: { store: RunStore; seedRunDirectory: string }): Promise<RunRecord> {
  const seedRun = runRecordSchema.parse(
    JSON.parse(await readFile(path.join(options.seedRunDirectory, SEED_RUN_FILE), "utf8")),
  );
  const runDirectory = options.store.runDirectory(seedRun.id);
  const run = mapRunFiles(seedRun, (relativePath) =>
    resolveInside({ directory: runDirectory, relativePath }),
  );
  for (const relativePath of seedFilesOf(seedRun)) {
    await cp(
      resolveInside({ directory: options.seedRunDirectory, relativePath }),
      resolveInside({ directory: runDirectory, relativePath }),
    );
  }
  await options.store.create(run);
  for (const event of await readSeedEvents(options.seedRunDirectory)) await options.store.appendEvent(event);
  return run;
}

export interface SeedDemoRunsOptions {
  store: RunStore;
  /** `demo/seed`: holds `runs/<runId>/`. */
  seedDirectory: string;
  logger: CutroomLogger;
}

/** D-2: on boot, an empty store gets the sample project's runs with their pre-rendered files. */
export async function seedDemoRuns(options: SeedDemoRunsOptions): Promise<{ seeded: number }> {
  if ((await options.store.list()).length > 0) return { seeded: 0 };
  const runsDirectory = path.join(options.seedDirectory, "runs");
  const entries = await readdir(runsDirectory, { withFileTypes: true }).catch(() => []);
  const seedRunDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(runsDirectory, entry.name));
  if (seedRunDirectories.length === 0)
    options.logger.warn({ seedDirectory: options.seedDirectory }, "the demo seed has no runs");
  for (const seedRunDirectory of seedRunDirectories) {
    const run = await seedOneRun({ store: options.store, seedRunDirectory });
    options.logger.info({ runId: run.id, assets: run.assets.length }, "seeded a demo run");
  }
  return { seeded: seedRunDirectories.length };
}
