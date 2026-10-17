import { appendFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { type RunEvent, type RunRecord, runEventSchema, runRecordSchema } from "../run-schema";
import { RunNotFoundError, type RunStore } from "./run-store";

const safeRunId = /^[0-9A-Za-z_-]{1,64}$/;

/** One directory per run: run.json (atomic rename) and events.jsonl (append-only). */
export class FileRunStore implements RunStore {
  private readonly rootDirectory: string;
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(rootDirectory: string) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  runDirectory(runId: string): string {
    if (!safeRunId.test(runId)) throw new RunNotFoundError(`Invalid run id: ${runId}`);
    return path.join(this.rootDirectory, runId);
  }

  private async writeRun(run: RunRecord): Promise<void> {
    const directory = this.runDirectory(run.id);
    await mkdir(directory, { recursive: true });
    const temporaryPath = path.join(directory, `run.json.${process.pid}.tmp`);
    await writeFile(temporaryPath, JSON.stringify(run, null, 2));
    await rename(temporaryPath, path.join(directory, "run.json"));
  }

  async create(run: RunRecord): Promise<void> {
    await this.writeRun(runRecordSchema.parse(run));
  }

  async get(runId: string): Promise<RunRecord | undefined> {
    try {
      const content = await readFile(path.join(this.runDirectory(runId), "run.json"), "utf8");
      return runRecordSchema.parse(JSON.parse(content));
    } catch (error) {
      if (error instanceof RunNotFoundError) return undefined;
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  /** Serialises updates per run so concurrent steps never lose a write. */
  async update(runId: string, mutate: (run: RunRecord) => RunRecord): Promise<RunRecord> {
    const previous = this.locks.get(runId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const current = await this.get(runId);
      if (!current) throw new RunNotFoundError(`Run not found: ${runId}`);
      const updated = runRecordSchema.parse({ ...mutate(current), updatedAt: new Date().toISOString() });
      await this.writeRun(updated);
      return updated;
    });
    this.locks.set(
      runId,
      next.catch(() => undefined),
    );
    return next;
  }

  async list(): Promise<RunRecord[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.rootDirectory);
    } catch {
      return [];
    }
    const runs = await Promise.all(
      entries.filter((entry) => safeRunId.test(entry)).map((entry) => this.get(entry)),
    );
    return runs
      .filter((run): run is RunRecord => run !== undefined)
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async appendEvent(event: RunEvent): Promise<void> {
    const directory = this.runDirectory(event.runId);
    await mkdir(directory, { recursive: true });
    await appendFile(
      path.join(directory, "events.jsonl"),
      `${JSON.stringify(runEventSchema.parse(event))}\n`,
    );
  }

  async listEvents(runId: string): Promise<RunEvent[]> {
    try {
      const content = await readFile(path.join(this.runDirectory(runId), "events.jsonl"), "utf8");
      return content
        .split("\n")
        .filter(Boolean)
        .map((line) => runEventSchema.parse(JSON.parse(line)));
    } catch {
      return [];
    }
  }
}
