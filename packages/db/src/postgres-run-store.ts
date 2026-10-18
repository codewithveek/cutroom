import path from "node:path";
import {
  type RunEvent,
  RunNotFoundError,
  type RunRecord,
  type RunStore,
  runEventSchema,
  runRecordSchema,
} from "@cutroom/pipeline";
import { asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { PoolClient } from "pg";
import type { CutroomDatabase, DatabaseHandle } from "./database";
import { fromRows, projectForSource, type RunRows, toRows } from "./run-record-mapping";
import {
  assets,
  claimResults,
  productBriefs,
  projects,
  runEvents,
  runs,
  runVoiceClips,
  storyboardVersions,
  voiceClips,
} from "./schema";

const EVENTS_CHANNEL = "cutroom_run_events";
const safeRunId = /^[0-9A-Za-z_-]{1,64}$/;

type Transaction = Parameters<Parameters<CutroomDatabase["transaction"]>[0]>[0];
type Queryable = CutroomDatabase | Transaction;

async function loadRows(
  database: Queryable,
  runRows: ReadonlyArray<typeof runs.$inferSelect>,
): Promise<RunRows[]> {
  if (runRows.length === 0) return [];
  const runIds = runRows.map((run) => run.id);
  const [briefs, versions, runClipLinks, assetRows] = await Promise.all([
    database.select().from(productBriefs).where(inArray(productBriefs.runId, runIds)),
    database.select().from(storyboardVersions).where(inArray(storyboardVersions.runId, runIds)),
    database.select().from(runVoiceClips).where(inArray(runVoiceClips.runId, runIds)),
    database.select().from(assets).where(inArray(assets.runId, runIds)),
  ]);
  const versionIds = versions.map((version) => version.id);
  const cacheKeys = [...new Set(runClipLinks.map((link) => link.cacheKey))];
  const [claims, clips] = await Promise.all([
    versionIds.length > 0
      ? database.select().from(claimResults).where(inArray(claimResults.storyboardVersionId, versionIds))
      : Promise.resolve([]),
    cacheKeys.length > 0
      ? database.select().from(voiceClips).where(inArray(voiceClips.cacheKey, cacheKeys))
      : Promise.resolve([]),
  ]);
  return runRows.map((run) => {
    const runVersions = versions.filter((version) => version.runId === run.id);
    const runVersionIds = new Set(runVersions.map((version) => version.id));
    const links = runClipLinks.filter((link) => link.runId === run.id);
    const keys = new Set(links.map((link) => link.cacheKey));
    return {
      run,
      brief: briefs.find((brief) => brief.runId === run.id),
      versions: runVersions,
      claims: claims.filter((claim) => runVersionIds.has(claim.storyboardVersionId)),
      voiceClips: clips.filter((clip) => keys.has(clip.cacheKey)),
      runVoiceClips: links,
      assets: assetRows.filter((asset) => asset.runId === run.id),
    };
  });
}

/** Replaces a run's child rows with the record's; the run row itself is upserted by the caller. */
async function writeChildren(transaction: Transaction, rows: RunRows): Promise<void> {
  const runId = rows.run.id;
  await transaction.delete(storyboardVersions).where(eq(storyboardVersions.runId, runId));
  await transaction.delete(assets).where(eq(assets.runId, runId));
  await transaction.delete(runVoiceClips).where(eq(runVoiceClips.runId, runId));
  await transaction.delete(productBriefs).where(eq(productBriefs.runId, runId));
  if (rows.brief) await transaction.insert(productBriefs).values(rows.brief);
  if (rows.versions.length > 0) await transaction.insert(storyboardVersions).values(rows.versions);
  if (rows.claims.length > 0) await transaction.insert(claimResults).values(rows.claims);
  for (const clip of rows.voiceClips) {
    await transaction
      .insert(voiceClips)
      .values(clip)
      .onConflictDoUpdate({
        target: voiceClips.cacheKey,
        set: { audioPath: clip.audioPath, durationMs: clip.durationMs },
      });
  }
  if (rows.runVoiceClips.length > 0) await transaction.insert(runVoiceClips).values(rows.runVoiceClips);
  if (rows.assets.length > 0) await transaction.insert(assets).values(rows.assets);
}

function toEvent(row: typeof runEvents.$inferSelect): RunEvent {
  return runEventSchema.parse({ ...row, createdAt: new Date(row.createdAt).toISOString() });
}

/**
 * Runs in Postgres across the PRD §8.6 tables (Drizzle). Working files (snapshots, renders)
 * stay on disk under `filesRoot`, which the API and the worker must share. Event appends
 * NOTIFY, so another process's subscribers hear them without polling.
 */
export class PostgresRunStore implements RunStore {
  private readonly database: DatabaseHandle;
  private readonly filesRoot: string;
  private listener: Promise<PoolClient> | undefined;
  private readonly watchers = new Map<string, Set<() => void>>();

  constructor(options: { database: DatabaseHandle; filesRoot: string }) {
    this.database = options.database;
    this.filesRoot = path.resolve(options.filesRoot);
  }

  private get db(): CutroomDatabase {
    return this.database.db;
  }

  runDirectory(runId: string): string {
    if (!safeRunId.test(runId)) throw new RunNotFoundError(`Invalid run id: ${runId}`);
    return path.join(this.filesRoot, runId);
  }

  async create(record: RunRecord): Promise<void> {
    const parsed = runRecordSchema.parse(record);
    await this.db.transaction(async (transaction) => {
      const project = projectForSource({ source: parsed.request.source });
      await transaction.insert(projects).values(project).onConflictDoNothing();
      const [stored] = await transaction
        .select({ id: projects.id })
        .from(projects)
        .where(
          sql`${projects.sourceType} = ${project.sourceType} and ${projects.sourceRef} = ${project.sourceRef}`,
        );
      if (!stored) throw new Error("Could not create the project row");
      const rows = toRows({ record: parsed, projectId: stored.id });
      await transaction.insert(runs).values(rows.run);
      await writeChildren(transaction, rows);
    });
  }

  async get(runId: string): Promise<RunRecord | undefined> {
    const runRows = await this.db.select().from(runs).where(eq(runs.id, runId));
    const [rows] = await loadRows(this.db, runRows);
    return rows ? fromRows(rows) : undefined;
  }

  /** Row-locks the run, so concurrent updates from the API and the worker never lose a write. */
  async update(runId: string, mutate: (run: RunRecord) => RunRecord): Promise<RunRecord> {
    return this.db.transaction(async (transaction) => {
      const runRows = await transaction.select().from(runs).where(eq(runs.id, runId)).for("update");
      const [rows] = await loadRows(transaction, runRows);
      if (!rows) throw new RunNotFoundError(`Run not found: ${runId}`);
      const updated = runRecordSchema.parse({
        ...mutate(fromRows(rows)),
        updatedAt: new Date().toISOString(),
      });
      const next = toRows({
        record: updated,
        projectId: rows.run.projectId,
        temporalWorkflowId: rows.run.temporalWorkflowId,
      });
      await transaction.update(runs).set(next.run).where(eq(runs.id, runId));
      await writeChildren(transaction, next);
      return updated;
    });
  }

  async list(): Promise<RunRecord[]> {
    const runRows = await this.db.select().from(runs).orderBy(desc(runs.createdAt));
    return (await loadRows(this.db, runRows)).map(fromRows);
  }

  async appendEvent(event: RunEvent): Promise<void> {
    const parsed = runEventSchema.parse(event);
    await this.db.transaction(async (transaction) => {
      await transaction.insert(runEvents).values(parsed);
      await transaction.execute(sql`select pg_notify(${EVENTS_CHANNEL}, ${parsed.runId})`);
    });
  }

  async listEvents(runId: string): Promise<RunEvent[]> {
    const rows = await this.db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, runId))
      .orderBy(asc(runEvents.id));
    return rows.map(toEvent);
  }

  async listEventsAfter(runId: string, afterEventId: string): Promise<RunEvent[]> {
    const rows = await this.db
      .select()
      .from(runEvents)
      .where(sql`${runEvents.runId} = ${runId} and ${gt(runEvents.id, afterEventId)}`)
      .orderBy(asc(runEvents.id));
    return rows.map(toEvent);
  }

  /** Records which Temporal workflow drives a run (PRD §8.6 `temporal_workflow_id`). */
  async setWorkflowId(runId: string, workflowId: string): Promise<void> {
    await this.db.update(runs).set({ temporalWorkflowId: workflowId }).where(eq(runs.id, runId));
  }

  /**
   * Calls `onChange` whenever any process appends an event to the run (Postgres LISTEN).
   * Returns an unsubscribe function.
   */
  watchEvents(runId: string, onChange: () => void): () => void {
    const watchers = this.watchers.get(runId) ?? new Set();
    watchers.add(onChange);
    this.watchers.set(runId, watchers);
    void this.ensureListener();
    return () => {
      watchers.delete(onChange);
      if (watchers.size === 0) this.watchers.delete(runId);
    };
  }

  async close(): Promise<void> {
    const listener = await this.listener?.catch(() => undefined);
    listener?.release();
    this.listener = undefined;
  }

  private ensureListener(): Promise<PoolClient> {
    this.listener ??= this.database.pool.connect().then(async (client) => {
      client.on("notification", (message) => {
        if (message.channel !== EVENTS_CHANNEL || !message.payload) return;
        for (const watcher of this.watchers.get(message.payload) ?? []) watcher();
      });
      await client.query(`LISTEN ${EVENTS_CHANNEL}`);
      return client;
    });
    return this.listener;
  }
}
