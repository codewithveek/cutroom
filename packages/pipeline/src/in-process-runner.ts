import { EventEmitter } from "node:events";
import { assertApprovable } from "@cutroom/claim-audit";
import { createStepLogger, withPipelineStepSpan } from "@cutroom/observability";
import { type EgressGuard, installLocalEgressGuard } from "@cutroom/providers";
import { type Storyboard, storyboardSchema } from "@cutroom/scene-spec";
import { ulid } from "ulid";
import { describeError } from "./describe-error";
import type { ApproveStoryboardInput, PipelineRunner, UpdateStoryboardResult } from "./pipeline-runner";
import {
  latestStoryboardVersion,
  type RunEvent,
  type RunRecord,
  type RunRequestInput,
  type RunStatus,
  runRequestSchema,
} from "./run-schema";
import type { PipelineServices } from "./services";
import { pipelineSteps } from "./step-registry";
import { auditVersion } from "./steps/audit-step";
import type { StepContext, StepDefinition } from "./steps/step-context";
import { RunNotFoundError } from "./store/run-store";

export class RunStateError extends Error {
  override readonly name = "RunStateError";
}

const terminalStatuses: ReadonlySet<RunStatus> = new Set(["completed", "failed"]);

function changedSceneIds(previous: Storyboard, next: Storyboard): string[] {
  const previousById = new Map(previous.scenes.map((scene) => [scene.id, JSON.stringify(scene)]));
  return next.scenes
    .filter((scene) => previousById.get(scene.id) !== JSON.stringify(scene))
    .map((scene) => scene.id);
}

/**
 * Runs the steps in this process. Every step is idempotent, so `resume` after a crash picks
 * up from the last completed one (G5). The CLI and the Week-2 API use this runner.
 */
export class InProcessRunner implements PipelineRunner {
  private readonly services: PipelineServices;
  private readonly events = new EventEmitter();
  private readonly executing = new Map<string, Promise<void>>();

  constructor(services: PipelineServices) {
    this.services = services;
    this.events.setMaxListeners(100);
  }

  async start(requestInput: RunRequestInput): Promise<{ runId: string }> {
    const request = runRequestSchema.parse(requestInput);
    const now = new Date().toISOString();
    const runId = ulid();
    await this.services.store.create({
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
    this.execute(runId);
    return { runId };
  }

  /** Continues a run from its last completed step (after a crash or restart). */
  resume(runId: string): void {
    this.execute(runId);
  }

  async approveStoryboard(runId: string, approval: ApproveStoryboardInput): Promise<void> {
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
    await this.services.store.update(runId, (current) => ({
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
    this.execute(runId);
  }

  async updateStoryboard(runId: string, storyboardInput: Storyboard): Promise<UpdateStoryboardResult> {
    const storyboard = storyboardSchema.parse(storyboardInput);
    const run = await this.requireRun(runId);
    if (run.status !== "awaiting_review")
      throw new RunStateError(`Run ${runId} is ${run.status}; edits are only accepted during review`);
    const previous = latestStoryboardVersion(run);
    if (!previous) throw new RunStateError("No storyboard to edit");
    const versionId = ulid();
    const updated = await this.services.store.update(runId, (current) => ({
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
    const context = this.createContext(runId, "audit-claims");
    const { results } = await auditVersion({
      context,
      run: updated,
      versionId,
      sceneIds: changedSceneIds(previous.storyboard, storyboard),
      previousResults: previous.claimResults,
    });
    return { versionId, version: previous.version + 1, claimResults: results };
  }

  getRun(runId: string): Promise<RunRecord | undefined> {
    return this.services.store.get(runId);
  }

  listRuns(): Promise<RunRecord[]> {
    return this.services.store.list();
  }

  listEvents(runId: string): Promise<RunEvent[]> {
    return this.services.store.listEvents(runId);
  }

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const channel = `run:${runId}`;
    this.events.on(channel, listener);
    return () => this.events.off(channel, listener);
  }

  async waitForStatus(runId: string, statuses: ReadonlyArray<RunStatus>): Promise<RunRecord> {
    const wanted = new Set<RunStatus>([...statuses, "failed"]);
    for (;;) {
      const run = await this.requireRun(runId);
      if (wanted.has(run.status) && !this.isExecuting(runId, run)) return run;
      await new Promise<void>((resolve) => {
        const unsubscribe = this.subscribe(runId, () => {
          unsubscribe();
          resolve();
        });
        setTimeout(() => {
          unsubscribe();
          resolve();
        }, 500);
      });
    }
  }

  /** Waits for the current execution of a run, if any (tests and the CLI use it). */
  async settled(runId: string): Promise<void> {
    await this.executing.get(runId);
  }

  private isExecuting(runId: string, run: RunRecord): boolean {
    return this.executing.has(runId) && !terminalStatuses.has(run.status) && run.status !== "awaiting_review";
  }

  private async requireRun(runId: string): Promise<RunRecord> {
    const run = await this.services.store.get(runId);
    if (!run) throw new RunNotFoundError(`Run not found: ${runId}`);
    return run;
  }

  private execute(runId: string): void {
    if (this.executing.has(runId)) return;
    const execution = this.executeSteps(runId).finally(() => this.executing.delete(runId));
    this.executing.set(runId, execution);
  }

  private async emit(event: Omit<RunEvent, "id" | "createdAt">): Promise<void> {
    const fullEvent: RunEvent = { ...event, id: ulid(), createdAt: new Date().toISOString() };
    await this.services.store.appendEvent(fullEvent);
    this.events.emit(`run:${event.runId}`, fullEvent);
  }

  private createContext(runId: string, step: StepDefinition["step"]): StepContext {
    return {
      services: this.services,
      runId,
      runDirectory: this.services.store.runDirectory(runId),
      logger: createStepLogger(this.services.logger, { runId, step }),
      progress: (payload) => {
        void this.emit({ runId, step, kind: "progress", payload });
      },
      updateRun: (mutate) => this.services.store.update(runId, mutate),
    };
  }

  private async executeSteps(runId: string): Promise<void> {
    const initial = await this.requireRun(runId);
    const guard: EgressGuard | undefined =
      this.services.enforceLocalEgress && initial.request.privacyMode === "local"
        ? installLocalEgressGuard()
        : undefined;
    try {
      for (const definition of pipelineSteps) {
        const shouldContinue = await this.runStep(runId, definition);
        if (!shouldContinue) return;
      }
      await this.services.store.update(runId, (current) => ({ ...current, status: "completed" }));
      await this.emit({
        runId,
        step: "finalize-deliverables",
        kind: "completed",
        payload: { runCompleted: true },
      });
    } finally {
      guard?.release();
    }
  }

  /** Returns false when the run paused or failed. */
  private async runStep(runId: string, definition: StepDefinition): Promise<boolean> {
    const context = this.createContext(runId, definition.step);
    const run = await this.services.store.update(runId, (current) => ({
      ...current,
      status: definition.status,
    }));
    const startedAt = new Date();
    await this.emit({ runId, step: definition.step, kind: "started", payload: {} });
    try {
      const outcome = await withPipelineStepSpan({ runId, step: definition.step }, () =>
        definition.run(context, run),
      );
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const usage = outcome.payload?.usage as { inputTokens: number; outputTokens: number } | undefined;
      await this.services.store.update(runId, (current) => ({
        ...current,
        ...(outcome.paused ? { status: "awaiting_review" as const } : {}),
        metrics: [
          ...current.metrics.filter((metric) => metric.step !== definition.step || outcome.skipped),
          ...(outcome.skipped
            ? []
            : [
                {
                  step: definition.step,
                  startedAt: startedAt.toISOString(),
                  finishedAt: finishedAt.toISOString(),
                  durationMs,
                  ...(usage ? { usage } : {}),
                },
              ]),
        ],
      }));
      await this.emit({
        runId,
        step: definition.step,
        kind: outcome.paused ? "progress" : "completed",
        payload: {
          ...outcome.payload,
          durationMs,
          ...(outcome.skipped ? { skipped: true } : {}),
          ...(outcome.paused ? { awaitingReview: true } : {}),
        },
      });
      return !outcome.paused;
    } catch (error) {
      const described = describeError(error);
      context.logger.error({ code: described.code, message: described.message }, "step failed");
      await this.services.store.update(runId, (current) => ({
        ...current,
        status: "failed",
        error: described,
      }));
      await this.emit({ runId, step: definition.step, kind: "failed", payload: { ...described } });
      return false;
    }
  }
}
