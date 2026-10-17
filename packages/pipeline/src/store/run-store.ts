import type { RunEvent, RunRecord } from "../run-schema";

/** Persistence for runs and their events. File-backed now; Postgres/Drizzle behind the same interface later. */
export interface RunStore {
  create(run: RunRecord): Promise<void>;
  get(runId: string): Promise<RunRecord | undefined>;
  /** Applies a mutation atomically and returns the stored result. */
  update(runId: string, mutate: (run: RunRecord) => RunRecord): Promise<RunRecord>;
  list(): Promise<RunRecord[]>;
  appendEvent(event: RunEvent): Promise<void>;
  listEvents(runId: string): Promise<RunEvent[]>;
  /** Directory where a run's working files live. */
  runDirectory(runId: string): string;
}

export class RunNotFoundError extends Error {
  override readonly name = "RunNotFoundError";
}
