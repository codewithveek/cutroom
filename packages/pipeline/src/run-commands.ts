import { regenerateScene, reverifyBrief } from "@cutroom/agent";
import { assertApprovable } from "@cutroom/claim-audit";
import {
  type ProductBrief,
  productBriefSchema,
  type RunSettingsUpdate,
  type Storyboard,
  storyboardSchema,
} from "@cutroom/scene-spec";
import { lookTokensById } from "@cutroom/video-kit";
import { ulid } from "ulid";
import type {
  ApproveStoryboardInput,
  RegenerateSceneRequest,
  UpdateStoryboardResult,
} from "./pipeline-runner";
import {
  latestStoryboardVersion,
  type RunRecord,
  type RunRequestInput,
  type RunStatus,
  runRequestSchema,
} from "./run-schema";
import type { StepExecutor } from "./step-executor";
import { auditVersion } from "./steps/audit-step";
import { LOGO_ASSET_KEY, planFromBrief } from "./steps/plan-step";
import { createRunModelClient, requireSnapshot } from "./steps/run-resources";
import { RunNotFoundError } from "./store/run-store";

export class RunStateError extends Error {
  override readonly name = "RunStateError";
}

export const terminalStatuses: ReadonlySet<RunStatus> = new Set(["completed", "failed"]);
export const pausedStatuses: ReadonlySet<RunStatus> = new Set(["awaiting_review", "awaiting_egress"]);

function changedSceneIds(previous: Storyboard, next: Storyboard): string[] {
  const previousById = new Map(previous.scenes.map((scene) => [scene.id, JSON.stringify(scene)]));
  return next.scenes
    .filter((scene) => previousById.get(scene.id) !== JSON.stringify(scene))
    .map((scene) => scene.id);
}

/**
 * Validated changes to a run's record: what a human does between steps. Runners call these and
 * then decide how execution continues (in process, or by signalling a Temporal workflow).
 */
export class RunCommands {
  private readonly executor: StepExecutor;

  constructor(executor: StepExecutor) {
    this.executor = executor;
  }

  private get store() {
    return this.executor.services.store;
  }

  async requireRun(runId: string): Promise<RunRecord> {
    const run = await this.store.get(runId);
    if (!run) throw new RunNotFoundError(`Run not found: ${runId}`);
    return run;
  }

  async createRun(requestInput: RunRequestInput): Promise<string> {
    const request = runRequestSchema.parse(requestInput);
    const now = new Date().toISOString();
    const runId = ulid();
    await this.store.create({
      id: runId,
      request,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      storyboardVersions: [],
      voiceClips: [],
      assets: [],
      providers: {},
      metrics: [],
    });
    return runId;
  }

  async recordApproval(runId: string, approval: ApproveStoryboardInput): Promise<void> {
    const run = await this.requireRun(runId);
    if (run.status !== "awaiting_review")
      throw new RunStateError(`Run ${runId} is ${run.status}, not awaiting review`);
    const version = run.storyboardVersions.find((candidate) => candidate.id === approval.versionId);
    if (!version) throw new RunStateError(`Unknown storyboard version ${approval.versionId}`);
    if (version.id !== latestStoryboardVersion(run)?.id)
      throw new RunStateError("Only the latest storyboard version can be approved");
    assertApprovable(version.claimResults, approval.overrides);
    const overrideReasons = new Map(
      approval.overrides.map((override) => [override.claimId, override.reason]),
    );
    await this.store.update(runId, (current) => ({
      ...current,
      approval: {
        versionId: version.id,
        overrides: [...approval.overrides],
        approvedAt: new Date().toISOString(),
        auto: false,
      },
      storyboardVersions: current.storyboardVersions.map((candidate) =>
        candidate.id === version.id
          ? {
              ...candidate,
              claimResults: candidate.claimResults.map((result) => {
                const reason = overrideReasons.get(result.claimId);
                return reason ? { ...result, overrideReason: reason } : result;
              }),
            }
          : candidate,
      ),
    }));
  }

  /** Hybrid: the user has seen the egress manifest and agrees to upload exactly that bundle. */
  async recordEgressConfirmation(runId: string, manifestSha256: string): Promise<void> {
    const run = await this.requireRun(runId);
    if (run.status !== "awaiting_egress" || !run.egress)
      throw new RunStateError(`Run ${runId} is not waiting for egress confirmation`);
    if (run.egress.manifestSha256 !== manifestSha256)
      throw new RunStateError("The manifest changed since you reviewed it");
    await this.store.update(runId, (current) =>
      current.egress
        ? { ...current, egress: { ...current.egress, confirmedAt: new Date().toISOString() } }
        : current,
    );
  }

  async updateStoryboard(runId: string, storyboardInput: Storyboard): Promise<UpdateStoryboardResult> {
    const storyboard = storyboardSchema.parse(storyboardInput);
    const run = await this.requireRun(runId);
    if (run.status !== "awaiting_review")
      throw new RunStateError(`Run ${runId} is ${run.status}; edits are only accepted during review`);
    const previous = latestStoryboardVersion(run);
    if (!previous) throw new RunStateError("No storyboard to edit");
    const versionId = ulid();
    const updated = await this.store.update(runId, (current) => ({
      ...current,
      storyboardVersions: [
        ...current.storyboardVersions,
        {
          id: versionId,
          version: previous.version + 1,
          storyboard,
          author: "user",
          createdAt: new Date().toISOString(),
          claimResults: [],
          audited: false,
        },
      ],
    }));
    const { results } = await auditVersion({
      context: this.executor.createContext(runId, "audit-claims"),
      run: updated,
      versionId,
      sceneIds: changedSceneIds(previous.storyboard, storyboard),
      previousResults: previous.claimResults,
    });
    return { versionId, version: previous.version + 1, claimResults: results };
  }

  /** Re-runs generation for one scene with the others fixed, then versions and re-audits it (FR-SB-7). */
  async regenerateScene(runId: string, request: RegenerateSceneRequest): Promise<UpdateStoryboardResult> {
    const run = await this.requireRun(runId);
    if (run.status !== "awaiting_review")
      throw new RunStateError(`Run ${runId} is ${run.status}; scenes can only be regenerated during review`);
    const latest = latestStoryboardVersion(run);
    if (!latest || !run.brief) throw new RunStateError("No storyboard to regenerate");
    const context = this.executor.createContext(runId, "plan-storyboard");
    const { reader } = await requireSnapshot(context);
    const { storyboard } = await regenerateScene({
      storyboard: latest.storyboard,
      sceneId: request.sceneId,
      brief: run.brief,
      reader,
      model: createRunModelClient(context, run),
      paceSeconds: lookTokensById[latest.storyboard.look].paceSeconds,
      targetSeconds: run.request.targetSeconds,
      ...(request.instruction ? { instruction: request.instruction } : {}),
    });
    return this.updateStoryboard(runId, storyboard);
  }

  /**
   * The user edited the brief: re-verify its evidence, store it, plan a new storyboard version
   * from it and audit every scene. Only during review.
   */
  async updateBrief(runId: string, briefInput: ProductBrief): Promise<UpdateStoryboardResult> {
    const brief = productBriefSchema.parse(briefInput);
    const run = await this.requireRun(runId);
    if (run.status !== "awaiting_review")
      throw new RunStateError(`Run ${runId} is ${run.status}; the brief can only change during review`);
    const previous = latestStoryboardVersion(run);
    if (!previous) throw new RunStateError("No storyboard to re-plan");
    const context = this.executor.createContext(runId, "plan-storyboard");
    const { reader } = await requireSnapshot(context);
    const verified = await reverifyBrief({ brief, reader });
    const withBrief = await this.store.update(runId, (current) => ({ ...current, brief: verified }));
    const planned = await planFromBrief({ context, run: withBrief, brief: verified });
    const versionId = ulid();
    const updated = await this.store.update(runId, (current) => ({
      ...current,
      storyboardVersions: [
        ...current.storyboardVersions,
        {
          id: versionId,
          version: previous.version + 1,
          storyboard: planned.storyboard,
          author: "agent",
          createdAt: new Date().toISOString(),
          claimResults: [],
          audited: false,
        },
      ],
    }));
    const { results } = await auditVersion({
      context: this.executor.createContext(runId, "audit-claims"),
      run: updated,
      versionId,
    });
    return { versionId, version: previous.version + 1, claimResults: results };
  }

  /** Voice and music may change until approval; the voice step reads them afterwards. */
  async updateSettings(runId: string, settings: RunSettingsUpdate): Promise<void> {
    const run = await this.requireRun(runId);
    if (run.approval || terminalStatuses.has(run.status))
      throw new RunStateError(`Run ${runId} is ${run.status}; settings are fixed once it is approved`);
    await this.store.update(runId, (current) => ({
      ...current,
      request: {
        ...current.request,
        ...(settings.voice ? { voice: settings.voice } : {}),
        ...(settings.music ? { music: settings.music } : {}),
      },
    }));
  }

  /** The file behind a run's media key: a synthesised voice clip or the repo's logo. */
  async mediaFilePath(runId: string, assetKey: string): Promise<string | undefined> {
    const run = await this.requireRun(runId);
    const clip = run.voiceClips.find((candidate) => candidate.assetKey === assetKey);
    if (clip) return clip.filePath;
    if (assetKey !== LOGO_ASSET_KEY) return undefined;
    const { logoFilePath } = await requireSnapshot(
      this.executor.createContext(runId, "ingest-repository"),
    ).catch(() => ({ logoFilePath: undefined }));
    return logoFilePath;
  }
}
