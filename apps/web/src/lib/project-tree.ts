import { sourceLabel, sourceReference } from "@cutroom/scene-spec";
import type { RunView } from "./api-client";

export type RunActivity = "working" | "needs-you" | "done" | "failed";

const workingStatuses = new Set<RunView["status"]>([
  "queued",
  "ingesting",
  "analyzing",
  "planning",
  "auditing",
  "voicing",
  "rendering",
  "finalizing",
]);

export function runActivity(run: Pick<RunView, "status">): RunActivity {
  if (run.status === "completed") return "done";
  if (run.status === "failed") return "failed";
  if (run.status === "awaiting_review" || run.status === "awaiting_egress") return "needs-you";
  return workingStatuses.has(run.status) ? "working" : "done";
}

export interface ProjectNode {
  /** Stable key for the source: one project per repository (later: per script). */
  key: string;
  label: string;
  sourceKind: RunView["request"]["source"]["kind"];
  videos: RunView[];
  updatedAt: string;
}

function sourceKey(source: RunView["request"]["source"]): string {
  return `${source.kind}:${sourceReference(source)}`;
}

export { sourceLabel };

export function videoLabel(run: RunView): string {
  return run.storyboard?.storyboard.title ?? run.brief?.name ?? `${run.request.videoType} video`;
}

/** Groups runs into projects by source, newest project and newest video first. */
export function buildProjectTree(runs: ReadonlyArray<RunView>): ProjectNode[] {
  const projects = new Map<string, ProjectNode>();
  for (const run of runs) {
    const key = sourceKey(run.request.source);
    const project = projects.get(key) ?? {
      key,
      label: sourceLabel(run.request.source),
      sourceKind: run.request.source.kind,
      videos: [],
      updatedAt: run.updatedAt,
    };
    project.videos.push(run);
    if (run.updatedAt > project.updatedAt) project.updatedAt = run.updatedAt;
    projects.set(key, project);
  }
  return [...projects.values()]
    .map((project) => ({
      ...project,
      videos: project.videos.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt)),
    }))
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
