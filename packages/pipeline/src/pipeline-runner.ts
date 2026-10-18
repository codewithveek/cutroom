import type { ClaimOverride, ClaimResult, RunSettingsUpdate, Storyboard } from "@cutroom/scene-spec";
import type { RunEvent, RunRecord, RunRequestInput, RunStatus } from "./run-schema";

export interface ApproveStoryboardInput {
  versionId: string;
  overrides: ReadonlyArray<ClaimOverride>;
}

export interface RegenerateSceneRequest {
  sceneId: string;
  instruction?: string | undefined;
}

export interface UpdateStoryboardResult {
  versionId: string;
  version: number;
  claimResults: ClaimResult[];
}

/**
 * The one seam between callers (CLI, API) and execution. InProcessRunner runs the steps in
 * this process; a TemporalRunner calls the same step functions as activities (PRD §8.1).
 */
export interface PipelineRunner {
  start(request: RunRequestInput): Promise<{ runId: string }>;
  approveStoryboard(runId: string, approval: ApproveStoryboardInput): Promise<void>;
  confirmEgress(runId: string, manifestSha256: string): Promise<void>;
  updateStoryboard(runId: string, storyboard: Storyboard): Promise<UpdateStoryboardResult>;
  regenerateScene(runId: string, request: RegenerateSceneRequest): Promise<UpdateStoryboardResult>;
  updateSettings(runId: string, settings: RunSettingsUpdate): Promise<void>;
  getRun(runId: string): Promise<RunRecord | undefined>;
  listRuns(): Promise<RunRecord[]>;
  listEvents(runId: string): Promise<RunEvent[]>;
  subscribe(runId: string, listener: (event: RunEvent) => void): () => void;
  /** Resolves when the run reaches one of `statuses` (or fails). */
  waitForStatus(runId: string, statuses: ReadonlyArray<RunStatus>): Promise<RunRecord>;
}
