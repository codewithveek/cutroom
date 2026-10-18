import { type EgressGuard, installLocalEgressGuard } from "@cutroom/providers";
import type { RunSettingsUpdate, Storyboard } from "@cutroom/scene-spec";
import type {
  ApproveStoryboardInput,
  PipelineRunner,
  RegenerateSceneRequest,
  UpdateStoryboardResult,
} from "./pipeline-runner";
import { pausedStatuses, RunCommands, terminalStatuses } from "./run-commands";
import { LocalRunEventBus, type RunEventBus } from "./run-event-bus";
import type { RunEvent, RunRecord, RunRequestInput, RunStatus } from "./run-schema";
import type { PipelineServices } from "./services";
import { StepExecutor } from "./step-executor";
import { pipelineSteps } from "./step-registry";

export { RunStateError } from "./run-commands";

/** Resolves when the run reaches one of `statuses` (or fails), polling between events. */
export async function waitForRunStatus(options: {
  runner: Pick<PipelineRunner, "getRun" | "subscribe">;
  runId: string;
  statuses: ReadonlyArray<RunStatus>;
  isBusy: (run: RunRecord) => boolean;
}): Promise<RunRecord> {
  const wanted = new Set<RunStatus>([...options.statuses, "failed"]);
  for (;;) {
    const run = await options.runner.getRun(options.runId);
    if (run && wanted.has(run.status) && !options.isBusy(run)) return run;
    await new Promise<void>((resolve) => {
      const unsubscribe = options.runner.subscribe(options.runId, () => {
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

/**
 * Runs the steps in this process. Every step is idempotent, so `resume` after a crash picks
 * up from the last completed one (G5). The CLI uses this runner; the API can use it or Temporal.
 */
export class InProcessRunner implements PipelineRunner {
  private readonly services: PipelineServices;
  private readonly bus: RunEventBus;
  private readonly executor: StepExecutor;
  private readonly commands: RunCommands;
  private readonly executing = new Map<string, Promise<void>>();

  constructor(services: PipelineServices) {
    this.services = services;
    this.bus = new LocalRunEventBus();
    this.executor = new StepExecutor({ services, bus: this.bus });
    this.commands = new RunCommands(this.executor);
  }

  async start(request: RunRequestInput): Promise<{ runId: string }> {
    const runId = await this.commands.createRun(request);
    this.execute(runId);
    return { runId };
  }

  /** Continues a run from its last completed step (after a crash or restart). */
  resume(runId: string): void {
    this.execute(runId);
  }

  async approveStoryboard(runId: string, approval: ApproveStoryboardInput): Promise<void> {
    await this.commands.recordApproval(runId, approval);
    this.execute(runId);
  }

  async confirmEgress(runId: string, manifestSha256: string): Promise<void> {
    await this.commands.recordEgressConfirmation(runId, manifestSha256);
    this.execute(runId);
  }

  updateStoryboard(runId: string, storyboard: Storyboard): Promise<UpdateStoryboardResult> {
    return this.commands.updateStoryboard(runId, storyboard);
  }

  regenerateScene(runId: string, request: RegenerateSceneRequest): Promise<UpdateStoryboardResult> {
    return this.commands.regenerateScene(runId, request);
  }

  updateSettings(runId: string, settings: RunSettingsUpdate): Promise<void> {
    return this.commands.updateSettings(runId, settings);
  }

  mediaFilePath(runId: string, assetKey: string): Promise<string | undefined> {
    return this.commands.mediaFilePath(runId, assetKey);
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
    return this.bus.subscribe(runId, listener);
  }

  waitForStatus(runId: string, statuses: ReadonlyArray<RunStatus>): Promise<RunRecord> {
    return waitForRunStatus({
      runner: this,
      runId,
      statuses,
      isBusy: (run) =>
        this.executing.has(runId) && !terminalStatuses.has(run.status) && !pausedStatuses.has(run.status),
    });
  }

  /** Waits for the current execution of a run, if any (tests and the CLI use it). */
  async settled(runId: string): Promise<void> {
    await this.executing.get(runId);
  }

  private execute(runId: string): void {
    if (this.executing.has(runId)) return;
    const execution = this.executeSteps(runId).finally(() => this.executing.delete(runId));
    this.executing.set(runId, execution);
  }

  private async executeSteps(runId: string): Promise<void> {
    const initial = await this.commands.requireRun(runId);
    const guard: EgressGuard | undefined =
      this.services.enforceLocalEgress && initial.request.privacyMode === "local"
        ? installLocalEgressGuard()
        : undefined;
    try {
      for (const definition of pipelineSteps) {
        const result = await this.executor.runStep({ runId, definition, recordFailure: true });
        if (result !== "continued") return;
      }
      await this.executor.completeRun(runId);
    } finally {
      guard?.release();
    }
  }
}
