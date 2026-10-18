"use client";

import type { RunEvent } from "@cutroom/scene-spec";
import type React from "react";
import { HeroMark } from "@/features/dashboard/hero-mark";
import { RunTimeline } from "@/features/render-queue/run-timeline";
import type { RunView } from "@/lib/api-client";
import { runStatusLabels } from "@/lib/run-status";

/** Before there is a storyboard to edit: what the agent is doing, live, and what it has found. */
export function PipelineView(props: { run: RunView; events: ReadonlyArray<RunEvent> }): React.ReactElement {
  const { run } = props;
  return (
    <div className="panel flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-8">
      <div className="w-full max-w-xl space-y-8 pt-[6vh]">
        <div className="space-y-4 text-center">
          {run.status === "failed" ? null : <HeroMark />}
          <h1 className="text-2xl font-semibold tracking-tight">{runStatusLabels[run.status]}</h1>
          <p className="text-sm text-ink-muted">
            {run.status === "failed"
              ? "The run stopped. The step that failed and why are below."
              : "Gemma is reading the repository. The storyboard opens here for review as soon as every claim is audited."}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-panel-raised p-3">
          <RunTimeline events={props.events} />
        </div>
        {run.error ? (
          <p className="rounded-xl bg-unsupported/10 p-3 text-sm text-unsupported">
            {run.error.code}: {run.error.message}
          </p>
        ) : null}
        {run.brief ? (
          <div className="rounded-2xl border border-line p-4">
            <div className="text-xs text-ink-faint">Product brief</div>
            <div className="mt-1 text-lg font-medium">{run.brief.name}</div>
            <p className="text-sm text-ink-muted">{run.brief.tagline}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {run.brief.features.slice(0, 5).map((feature) => (
                <li key={feature.title} className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{feature.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
