/**
 * Plain data shared by the workflow (which Temporal bundles and runs deterministically, so it must
 * not import Node code) and the worker. A test checks the step list against the pipeline registry.
 */

export type PipelineStepName =
  | "ingest-repository"
  | "analyze-product"
  | "plan-storyboard"
  | "audit-claims"
  | "review"
  | "synthesize-voice"
  | "build-render-job"
  | "render"
  | "quality-check"
  | "finalize-deliverables";

export interface StepPolicy {
  step: PipelineStepName;
  /** Attempts including the first (PRD §8.4 retries + 1). */
  maximumAttempts: number;
  startToCloseTimeout: string;
}

/** PRD §8.4: retries and timeouts per activity. */
export const stepPolicies: ReadonlyArray<StepPolicy> = [
  { step: "ingest-repository", maximumAttempts: 3, startToCloseTimeout: "5 minutes" },
  { step: "analyze-product", maximumAttempts: 4, startToCloseTimeout: "10 minutes" },
  { step: "plan-storyboard", maximumAttempts: 4, startToCloseTimeout: "10 minutes" },
  { step: "audit-claims", maximumAttempts: 4, startToCloseTimeout: "5 minutes" },
  { step: "review", maximumAttempts: 3, startToCloseTimeout: "1 minute" },
  { step: "synthesize-voice", maximumAttempts: 4, startToCloseTimeout: "10 minutes" },
  { step: "build-render-job", maximumAttempts: 4, startToCloseTimeout: "10 minutes" },
  { step: "render", maximumAttempts: 3, startToCloseTimeout: "30 minutes" },
  { step: "quality-check", maximumAttempts: 3, startToCloseTimeout: "5 minutes" },
  { step: "finalize-deliverables", maximumAttempts: 4, startToCloseTimeout: "10 minutes" },
];

/** A worker that dies mid-step is noticed within this window and the step is retried elsewhere. */
export const ACTIVITY_HEARTBEAT_TIMEOUT = "30 seconds";
export const ACTIVITY_HEARTBEAT_INTERVAL_MS = 5_000;

export type StepActivityResult = "continued" | "paused" | "failed";

export interface ProduceVideoInput {
  runId: string;
}

export interface RunStepInput {
  runId: string;
  step: PipelineStepName;
  maximumAttempts: number;
}

/** The activities the workflow calls; implemented in `activities.ts` on top of the StepExecutor. */
export interface PipelineActivities {
  runPipelineStep(input: RunStepInput): Promise<StepActivityResult>;
  completeRun(input: ProduceVideoInput): Promise<void>;
}

export interface WorkflowStatus {
  state: "running" | "paused" | "completed" | "failed";
  currentStep: PipelineStepName | undefined;
}

export const SIGNAL_APPROVE_STORYBOARD = "approveStoryboard";
export const SIGNAL_CONFIRM_EGRESS = "confirmEgress";
export const QUERY_RUN_STATUS = "getRunStatus";

export function workflowIdForRun(runId: string): string {
  return `cutroom-run-${runId}`;
}
