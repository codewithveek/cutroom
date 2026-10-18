import {
  type ApproveStoryboardInput,
  LocalRunEventBus,
  type PipelineRunner,
  type PipelineServices,
  type RegenerateSceneRequest,
  RunCommands,
  type RunEvent,
  type RunRecord,
  type RunRequestInput,
  type RunStatus,
  type RunStore,
  StepExecutor,
  type UpdateStoryboardResult,
  waitForRunStatus,
} from "@cutroom/pipeline";
import type { RunSettingsUpdate, Storyboard } from "@cutroom/scene-spec";
import type { Client } from "@temporalio/client";
import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import {
  type ProduceVideoInput,
  SIGNAL_APPROVE_STORYBOARD,
  SIGNAL_CONFIRM_EGRESS,
  type WorkflowStatus,
  workflowIdForRun,
} from "./workflow-contracts";

/** A store other processes write to, which can tell this one when a run's events change. */
export interface SharedRunStore extends RunStore {
  watchEvents(runId: string, onChange: () => void): () => void;
  listEventsAfter(runId: string, afterEventId: string): Promise<RunEvent[]>;
  setWorkflowId(runId: string, workflowId: string): Promise<void>;
}

export interface TemporalRunnerOptions {
  services: PipelineServices & { store: SharedRunStore };
  client: Client;
  taskQueue: string;
}

/**
 * PRD §8.1 TemporalRunner: the API side of the durable pipeline. Human actions are validated and
 * stored here (the same RunCommands as in process), then the run's workflow is signalled; the
 * worker (apps/worker) executes the steps. Events reach SSE subscribers through the store.
 */
export class TemporalRunner implements PipelineRunner {
  private readonly store: SharedRunStore;
  private readonly client: Client;
  private readonly taskQueue: string;
  private readonly commands: RunCommands;

  constructor(options: TemporalRunnerOptions) {
    this.store = options.services.store;
    this.client = options.client;
    this.taskQueue = options.taskQueue;
    // Commands run here (edits, re-audits); their events are stored and reach the API via NOTIFY.
    this.commands = new RunCommands(
      new StepExecutor({ services: options.services, bus: new LocalRunEventBus() }),
    );
  }

  async start(request: RunRequestInput): Promise<{ runId: string }> {
    const runId = await this.commands.createRun(request);
    await this.startWorkflow(runId);
    return { runId };
  }

  /** Starts the run's workflow if it is not already running (idempotent by workflow id). */
  async startWorkflow(runId: string): Promise<void> {
    const workflowId = workflowIdForRun(runId);
    const input: ProduceVideoInput = { runId };
    try {
      await this.client.workflow.start("produceVideoWorkflow", {
        taskQueue: this.taskQueue,
        workflowId,
        args: [input],
      });
    } catch (error) {
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
    }
    await this.store.setWorkflowId(runId, workflowId);
  }

  async approveStoryboard(runId: string, approval: ApproveStoryboardInput): Promise<void> {
    await this.commands.recordApproval(runId, approval);
    await this.client.workflow.getHandle(workflowIdForRun(runId)).signal(SIGNAL_APPROVE_STORYBOARD);
  }

  async confirmEgress(runId: string, manifestSha256: string): Promise<void> {
    await this.commands.recordEgressConfirmation(runId, manifestSha256);
    await this.client.workflow.getHandle(workflowIdForRun(runId)).signal(SIGNAL_CONFIRM_EGRESS);
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
    return this.store.get(runId);
  }

  listRuns(): Promise<RunRecord[]> {
    return this.store.list();
  }

  listEvents(runId: string): Promise<RunEvent[]> {
    return this.store.listEvents(runId);
  }

  /** The workflow's own view (current step, paused or running): PRD §8.4 `getRunStatus`. */
  workflowStatus(runId: string): Promise<WorkflowStatus> {
    return this.client.workflow.getHandle(workflowIdForRun(runId)).query<WorkflowStatus>("getRunStatus");
  }

  /** Delivers events appended after subscribing, by whichever process appends them. */
  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    let stopped = false;
    let cursor: Promise<string> = this.store.listEvents(runId).then((events) => events.at(-1)?.id ?? "");
    const deliverNew = () => {
      cursor = cursor.then(async (afterId) => {
        if (stopped) return afterId;
        const events = await this.store.listEventsAfter(runId, afterId).catch(() => []);
        for (const event of events) if (!stopped) listener(event);
        return events.at(-1)?.id ?? afterId;
      });
    };
    const unwatch = this.store.watchEvents(runId, deliverNew);
    return () => {
      stopped = true;
      unwatch();
    };
  }

  waitForStatus(runId: string, statuses: ReadonlyArray<RunStatus>): Promise<RunRecord> {
    return waitForRunStatus({ runner: this, runId, statuses, isBusy: () => false });
  }
}
