/**
 * Writes finished runs from a Cutroom data directory into `demo/seed/` for the public demo (D-2).
 *
 *   CUTROOM_DATA_DIR=/tmp/demo-data pnpm cutroom demo --ratios 16:9,9:16 --voice af_heart
 *   pnpm tsx scripts/export-demo-seed.ts --data /tmp/demo-data --out demo/seed
 *
 * Only deliverables and voice clips are copied; the code snapshot and render work files stay behind.
 */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { FileRunStore, toSeedRun } from "@cutroom/pipeline";
import { z } from "zod";

const argsSchema = z.object({ data: z.string().min(1), out: z.string().min(1).default("demo/seed") });
const { values } = parseArgs({ options: { data: { type: "string" }, out: { type: "string" } } });
const args = argsSchema.parse(values);

/** Where the sample repository sits in this repo; the exporting machine's absolute path is not shipped. */
const SAMPLE_REPOSITORY_PATH = "evals/fixtures/shipnote";

const store = new FileRunStore(path.join(path.resolve(args.data), "runs"));
const runs = (await store.list()).filter((run) => run.status === "completed");
if (runs.length === 0) throw new Error(`No completed runs in ${args.data}`);

const runsOutDirectory = path.resolve(args.out, "runs");
await rm(runsOutDirectory, { recursive: true, force: true });
for (const run of runs) {
  const runDirectory = store.runDirectory(run.id);
  const { run: seedRun, files } = toSeedRun({ run, runDirectory });
  const seedRunDirectory = path.join(runsOutDirectory, run.id);
  for (const file of files) {
    await mkdir(path.dirname(path.join(seedRunDirectory, file.to)), { recursive: true });
    await cp(file.from, path.join(seedRunDirectory, file.to));
  }
  const portableRun = {
    ...seedRun,
    request: { ...seedRun.request, source: { kind: "path" as const, path: SAMPLE_REPOSITORY_PATH } },
  };
  await writeFile(path.join(seedRunDirectory, "run.json"), `${JSON.stringify(portableRun, null, 2)}\n`);
  // The run timeline needs each step's start and end; render progress ticks are noise here, and
  // payloads name files by this machine's absolute paths.
  const events = (await store.listEvents(run.id)).filter((event) => event.kind !== "progress");
  const portableEvents = events.map((event) => JSON.stringify(event).replaceAll(`${runDirectory}/`, ""));
  await writeFile(path.join(seedRunDirectory, "events.jsonl"), `${portableEvents.join("\n")}\n`);
  console.log(`✔ ${run.id}: ${files.length} files`);
}
