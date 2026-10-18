import type {
  ClaimOverride,
  ClaimResult,
  ProductBrief,
  RunSettingsUpdate,
  Storyboard,
} from "@cutroom/scene-spec";
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
  /** Runs a failed run again from the step that failed; finished steps are kept. */
  retryRun(runId: string): Promise<void>;
  approveStoryboard(runId: string, approval: ApproveStoryboardInput): Promise<void>;
  confirmEgress(runId: string, manifestSha256: string): Promise<void>;
  updateStoryboard(runId: string, storyboard: Storyboard): Promise<UpdateStoryboardResult>;
  regenerateScene(runId: string, request: RegenerateSceneRequest): Promise<UpdateStoryboardResult>;
  updateSettings(runId: string, settings: RunSettingsUpdate): Promise<void>;
  /** The user edited the brief: re-verify it and plan a new storyboard version from it. */
  updateBrief(runId: string, brief: ProductBrief): Promise<UpdateStoryboardResult>;
  /** Uses the user's track as the run's music (transcoded; until approval). */
  attachMusic(runId: string, options: { sourcePath: string; fileName: string }): Promise<void>;
  /** The file behind a media key (voice clip or logo), for previews in the browser. */
  mediaFilePath(runId: string, assetKey: string): Promise<string | undefined>;
  getRun(runId: string): Promise<RunRecord | undefined>;
  listRuns(): Promise<RunRecord[]>;
  listEvents(runId: string): Promise<RunEvent[]>;
  subscribe(runId: string, listener: (event: RunEvent) => void): () => void;
  /** Resolves when the run reaches one of `statuses` (or fails). */
  waitForStatus(runId: string, statuses: ReadonlyArray<RunStatus>): Promise<RunRecord>;
}
