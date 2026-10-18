import { condition, defineQuery, defineSignal, proxyActivities, setHandler } from "@temporalio/workflow";
import {
  ACTIVITY_HEARTBEAT_TIMEOUT,
  type PipelineActivities,
  type ProduceVideoInput,
  QUERY_RUN_STATUS,
  SIGNAL_APPROVE_STORYBOARD,
  SIGNAL_CONFIRM_EGRESS,
  type StepPolicy,
  stepPolicies,
  type WorkflowStatus,
} from "../workflow-contracts";

/** Sent after the API has stored the approval (with any overrides): the review step can pass. */
export const approveStoryboardSignal = defineSignal(SIGNAL_APPROVE_STORYBOARD);
/** Sent after the API has stored the egress confirmation (Hybrid): the bundle may be uploaded. */
export const confirmEgressSignal = defineSignal(SIGNAL_CONFIRM_EGRESS);
export const runStatusQuery = defineQuery<WorkflowStatus>(QUERY_RUN_STATUS);

function activitiesFor(policy: StepPolicy): PipelineActivities {
  return proxyActivities<PipelineActivities>({
    startToCloseTimeout: policy.startToCloseTimeout,
    heartbeatTimeout: ACTIVITY_HEARTBEAT_TIMEOUT,
    retry: { maximumAttempts: policy.maximumAttempts, initialInterval: "2 seconds", backoffCoefficient: 2 },
  });
}

/**
 * PRD §8.4 `produceVideoWorkflow`: every pipeline step as an activity, in order. A step that
 * pauses (review, Hybrid egress) waits for a signal and then runs again; steps are idempotent,
 * so a replay after a crash only redoes work that was never persisted.
 */
export async function produceVideoWorkflow(input: ProduceVideoInput): Promise<WorkflowStatus> {
  const status: WorkflowStatus = { state: "running", currentStep: undefined };
  let signalsReceived = 0;
  setHandler(approveStoryboardSignal, () => {
    signalsReceived += 1;
  });
  setHandler(confirmEgressSignal, () => {
    signalsReceived += 1;
  });
  setHandler(runStatusQuery, () => status);

  for (const policy of stepPolicies) {
    status.currentStep = policy.step;
    for (;;) {
      const signalsBefore = signalsReceived;
      const result = await activitiesFor(policy).runPipelineStep({
        runId: input.runId,
        step: policy.step,
        maximumAttempts: policy.maximumAttempts,
      });
      if (result === "failed") {
        status.state = "failed";
        return status;
      }
      if (result === "continued") break;
      status.state = "paused";
      await condition(() => signalsReceived > signalsBefore);
      status.state = "running";
    }
  }
  const last = stepPolicies.at(-1);
  if (last) await activitiesFor(last).completeRun(input);
  status.state = "completed";
  return status;
}
