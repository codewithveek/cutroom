import { createStepLogger, withPipelineStepSpan } from "@cutroom/observability";
import { ulid } from "ulid";
import { describeError } from "./describe-error";
import type { RunEventBus } from "./run-event-bus";
import type { RunEvent, RunRecord } from "./run-schema";
import type { PipelineServices } from "./services";
import type { StepContext, StepDefinition, StepOutcome } from "./steps/step-context";

export type StepResult = "continued" | "paused" | "failed";

export interface RunStepOptions {
  runId: string;
  definition: StepDefinition;
  /**
   * True: a thrown error marks the run failed. False: the error is rethrown untouched, so a
   * durable runner (Temporal) can retry the step; it records the failure on the last attempt.
   */
  recordFailure: boolean;
}

/**
 * Runs one pipeline step with the bookkeeping every runner needs: status, started/completed
 * events, metrics, pause states and failure records. Both runners call this, so a step behaves
 * the same in process and as a Temporal activity.
 */
export class StepExecutor {
  readonly services: PipelineServices;
  private readonly bus: RunEventBus;

  constructor(options: { services: PipelineServices; bus: RunEventBus }) {
    this.services = options.services;
    this.bus = options.bus;
  }

  async emit(event: Omit<RunEvent, "id" | "createdAt">): Promise<void> {
    const fullEvent: RunEvent = { ...event, id: ulid(), createdAt: new Date().toISOString() };
    await this.services.store.appendEvent(fullEvent);
    this.bus.publish(fullEvent);
  }

  createContext(runId: string, step: StepDefinition["step"]): StepContext {
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

  async runStep(options: RunStepOptions): Promise<StepResult> {
    const { runId, definition } = options;
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
      await this.recordOutcome({ runId, definition, outcome, startedAt });
      return outcome.paused ? "paused" : "continued";
    } catch (error) {
      if (!options.recordFailure) throw error;
      await this.recordFailure({ runId, definition, error });
      return "failed";
    }
  }

  async recordFailure(options: { runId: string; definition: StepDefinition; error: unknown }): Promise<void> {
    const described = describeError(options.error);
    createStepLogger(this.services.logger, { runId: options.runId, step: options.definition.step }).error(
      { code: described.code, message: described.message },
      "step failed",
    );
    await this.services.store.update(options.runId, (current) => ({
      ...current,
      status: "failed",
      error: described,
    }));
    await this.emit({
      runId: options.runId,
      step: options.definition.step,
      kind: "failed",
      payload: { ...described },
    });
  }

  async completeRun(runId: string): Promise<void> {
    await this.services.store.update(runId, (current) => ({ ...current, status: "completed" }));
    await this.emit({
      runId,
      step: "finalize-deliverables",
      kind: "completed",
      payload: { runCompleted: true },
    });
  }

  private async recordOutcome(options: {
    runId: string;
    definition: StepDefinition;
    outcome: StepOutcome;
    startedAt: Date;
  }): Promise<void> {
    const { runId, definition, outcome, startedAt } = options;
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const usage = outcome.payload?.usage as { inputTokens: number; outputTokens: number } | undefined;
    await this.services.store.update(runId, (current: RunRecord) => ({
      ...current,
      ...(outcome.paused
        ? {
            status:
              definition.step === "build-render-job"
                ? ("awaiting_egress" as const)
                : ("awaiting_review" as const),
          }
        : {}),
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
  }
}
