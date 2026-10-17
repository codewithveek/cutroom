import type { CutroomLogger } from "@cutroom/observability";
import type { PipelineStep, RunRecord } from "../run-schema";
import type { PipelineServices } from "../services";

export interface StepContext {
  services: PipelineServices;
  runId: string;
  runDirectory: string;
  logger: CutroomLogger;
  progress(payload: Record<string, unknown>): void;
  updateRun(mutate: (run: RunRecord) => RunRecord): Promise<RunRecord>;
}

export interface StepOutcome {
  /** True when persisted output already existed (idempotent re-run). */
  skipped?: boolean;
  /** True when the run must pause for a human. */
  paused?: boolean;
  payload?: Record<string, unknown>;
}

export type StepFunction = (context: StepContext, run: RunRecord) => Promise<StepOutcome>;

export interface StepDefinition {
  step: PipelineStep;
  status: RunRecord["status"];
  run: StepFunction;
}
