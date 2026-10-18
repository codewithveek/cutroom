import { describeError, type ErrorCode, pipelineSteps, type StepExecutor } from "@cutroom/pipeline";
import { ApplicationFailure, Context } from "@temporalio/activity";
import {
  ACTIVITY_HEARTBEAT_INTERVAL_MS,
  type PipelineActivities,
  type ProduceVideoInput,
  type RunStepInput,
  type StepActivityResult,
} from "./workflow-contracts";

export class UnknownStepError extends Error {
  override readonly name = "UnknownStepError";
}

/** Keeps Temporal informed that this worker is alive while a long step (render) runs. */
async function withHeartbeat<Result>(work: () => Promise<Result>): Promise<Result> {
  const context = Context.current();
  const timer = setInterval(() => context.heartbeat(), ACTIVITY_HEARTBEAT_INTERVAL_MS);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

/** Failures a retry cannot fix: the run fails at once instead of spending more model calls. */
const finalErrorCodes: ReadonlySet<ErrorCode> = new Set([
  "privacy_violation",
  "egress_blocked",
  "source_unavailable",
  "no_user_visible_changes",
]);

/**
 * Activities on top of the shared StepExecutor. Errors are rethrown so Temporal retries the step;
 * only the last attempt records the failure on the run.
 */
export function createPipelineActivities(executor: StepExecutor): PipelineActivities {
  return {
    async runPipelineStep(input: RunStepInput): Promise<StepActivityResult> {
      const definition = pipelineSteps.find((candidate) => candidate.step === input.step);
      if (!definition) throw new UnknownStepError(`No pipeline step named ${input.step}`);
      const finalAttempt = Context.current().info.attempt >= input.maximumAttempts;
      try {
        return await withHeartbeat(() =>
          executor.runStep({ runId: input.runId, definition, recordFailure: finalAttempt }),
        );
      } catch (error) {
        const described = describeError(error);
        if (finalAttempt || !finalErrorCodes.has(described.code)) throw error;
        await executor.recordFailure({ runId: input.runId, definition, error });
        throw ApplicationFailure.nonRetryable(described.message, described.code);
      }
    },
    async completeRun(input: ProduceVideoInput): Promise<void> {
      await executor.completeRun(input.runId);
    },
  };
}
