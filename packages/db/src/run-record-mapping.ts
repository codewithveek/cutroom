import { type RunRecord, runRecordSchema } from "@cutroom/pipeline";
import type { RepoSource } from "@cutroom/scene-spec";
import { ulid } from "ulid";
import type {
  assets,
  claimResults,
  productBriefs,
  projects,
  runs,
  runVoiceClips,
  storyboardVersions,
  voiceClips,
} from "./schema";

export type RunRow = typeof runs.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type BriefRow = typeof productBriefs.$inferSelect;
export type VersionRow = typeof storyboardVersions.$inferSelect;
export type ClaimRow = typeof claimResults.$inferSelect;
export type VoiceClipRow = typeof voiceClips.$inferSelect;
export type RunVoiceClipRow = typeof runVoiceClips.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;

/** Everything one run is stored as, across the PRD §8.6 tables. */
export interface RunRows {
  run: RunRow;
  brief: BriefRow | undefined;
  versions: VersionRow[];
  claims: ClaimRow[];
  voiceClips: VoiceClipRow[];
  runVoiceClips: RunVoiceClipRow[];
  assets: AssetRow[];
}

function nullable<Value>(value: Value | undefined): Value | null {
  return value === undefined ? null : value;
}

function optional<Key extends string, Value>(key: Key, value: Value | null): Partial<Record<Key, Value>> {
  return value === null ? {} : ({ [key]: value } as Record<Key, Value>);
}

export function projectForSource(options: { source: RepoSource; id?: string }): ProjectInsert {
  const sourceRef = options.source.kind === "git" ? options.source.url : options.source.path;
  const name =
    sourceRef
      .replace(/\.git$/, "")
      .replace(/[\\/]+$/, "")
      .split(/[\\/:]/)
      .pop() || sourceRef;
  return { id: options.id ?? ulid(), name, sourceType: options.source.kind, sourceRef };
}

export function toRows(options: {
  record: RunRecord;
  projectId: string;
  temporalWorkflowId?: string | null;
}): RunRows {
  const { record } = options;
  const run: RunRow = {
    id: record.id,
    projectId: options.projectId,
    presetId: nullable(record.request.presetId),
    videoType: record.request.videoType,
    look: nullable(record.look),
    lookReason: nullable(record.lookReason),
    ratios: [...record.request.ratios],
    privacyMode: record.request.privacyMode,
    status: record.status,
    temporalWorkflowId: options.temporalWorkflowId ?? null,
    request: record.request,
    error: nullable(record.error),
    snapshotDirectory: nullable(record.snapshotDirectory),
    approval: nullable(record.approval),
    egress: nullable(record.egress),
    voiceTimeline: nullable(record.voiceTimeline),
    providers: record.providers,
    metrics: record.metrics,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  const versions: VersionRow[] = record.storyboardVersions.map((version) => ({
    id: version.id,
    runId: record.id,
    version: version.version,
    storyboard: version.storyboard,
    author: version.author,
    audited: version.audited,
    createdAt: version.createdAt,
  }));
  const claims: ClaimRow[] = record.storyboardVersions.flatMap((version) =>
    version.claimResults.map((claim, position) => ({
      id: ulid(),
      storyboardVersionId: version.id,
      position,
      claimId: claim.claimId,
      sceneId: claim.sceneId,
      fieldPath: claim.fieldPath,
      claimText: claim.claimText,
      verdict: claim.verdict,
      checks: claim.checks,
      evidence: claim.evidence,
      suggestion: nullable(claim.suggestion),
      overrideReason: nullable(claim.overrideReason),
    })),
  );
  return {
    run,
    brief: record.brief
      ? {
          id: record.id,
          runId: record.id,
          brief: record.brief,
          modelId: nullable(record.providers.modelId),
          usage: null,
        }
      : undefined,
    versions,
    claims,
    voiceClips: record.voiceClips.map((clip) => ({
      cacheKey: clip.assetKey,
      provider: nullable(record.providers.voiceProvider),
      voiceId: record.request.voice.voiceId,
      audioPath: clip.filePath,
      durationMs: clip.durationMs,
    })),
    runVoiceClips: record.voiceClips.map((clip, position) => ({
      runId: record.id,
      cacheKey: clip.assetKey,
      position,
    })),
    assets: record.assets.map((asset, position) => ({
      id: asset.id,
      runId: record.id,
      kind: asset.kind,
      ratio: nullable(asset.ratio),
      version: asset.version,
      storageKey: asset.filePath,
      bytes: asset.bytes,
      durationMs: nullable(asset.durationMs),
      position,
    })),
  };
}

/** Reassembles and validates the record, so a bad row fails loudly instead of leaking into a step. */
export function fromRows(rows: RunRows): RunRecord {
  const { run } = rows;
  const clipsByKey = new Map(rows.voiceClips.map((clip) => [clip.cacheKey, clip]));
  return runRecordSchema.parse({
    id: run.id,
    request: run.request,
    status: run.status,
    createdAt: new Date(run.createdAt).toISOString(),
    updatedAt: new Date(run.updatedAt).toISOString(),
    ...optional("error", run.error),
    ...optional("look", run.look),
    ...optional("lookReason", run.lookReason),
    ...optional("snapshotDirectory", run.snapshotDirectory),
    ...(rows.brief ? { brief: rows.brief.brief } : {}),
    storyboardVersions: rows.versions
      .toSorted((left, right) => left.version - right.version)
      .map((version) => ({
        id: version.id,
        version: version.version,
        storyboard: version.storyboard,
        author: version.author,
        audited: version.audited,
        createdAt: new Date(version.createdAt).toISOString(),
        claimResults: rows.claims
          .filter((claim) => claim.storyboardVersionId === version.id)
          .toSorted((left, right) => left.position - right.position)
          .map((claim) => ({
            claimId: claim.claimId,
            sceneId: claim.sceneId,
            fieldPath: claim.fieldPath,
            claimText: claim.claimText,
            verdict: claim.verdict,
            checks: claim.checks,
            evidence: claim.evidence,
            ...optional("suggestion", claim.suggestion),
            ...optional("overrideReason", claim.overrideReason),
          })),
      })),
    ...optional("approval", run.approval),
    ...optional("egress", run.egress),
    ...optional("voiceTimeline", run.voiceTimeline),
    voiceClips: rows.runVoiceClips
      .toSorted((left, right) => left.position - right.position)
      .flatMap((link) => {
        const clip = clipsByKey.get(link.cacheKey);
        return clip
          ? [{ assetKey: clip.cacheKey, filePath: clip.audioPath, durationMs: clip.durationMs }]
          : [];
      }),
    assets: rows.assets
      .toSorted((left, right) => left.position - right.position)
      .map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        ...optional("ratio", asset.ratio),
        version: asset.version,
        filePath: asset.storageKey,
        bytes: asset.bytes,
        ...optional("durationMs", asset.durationMs),
      })),
    providers: run.providers,
    metrics: run.metrics,
  });
}
