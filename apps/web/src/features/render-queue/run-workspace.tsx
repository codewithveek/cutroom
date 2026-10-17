"use client";

import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { BriefPanel } from "@/features/product-brief/brief-panel";
import { StoryboardEditor } from "@/features/storyboard/storyboard-editor";
import { useRun } from "@/lib/use-run";
import { RendersPanel } from "./renders-panel";
import { RunTimeline } from "./run-timeline";

const statusLabels: Readonly<Record<string, string>> = {
  queued: "Queued",
  ingesting: "Reading the repository",
  analyzing: "Writing the brief",
  planning: "Planning the storyboard",
  auditing: "Auditing claims",
  awaiting_review: "Ready for your review",
  voicing: "Synthesising voice",
  rendering: "Rendering",
  finalizing: "Finishing up",
  completed: "Done",
  failed: "Failed",
};

export function RunWorkspace(props: { runId: string }): React.ReactElement {
  const { run, events, error, replaceRun } = useRun(props.runId);
  if (error && !run) return <p className="p-8 text-sm text-unsupported">{error}</p>;
  if (!run) return <p className="p-8 text-sm text-ink-muted">Loading run…</p>;
  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 px-5 py-6 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card>
          <CardHeader
            title={statusLabels[run.status] ?? run.status}
            description={`${run.request.videoType} · ${run.request.ratios.join(", ")}`}
          />
          <div className="space-y-3 p-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{run.request.privacyMode} mode</Badge>
              {run.providers.modelId ? <Badge>{run.providers.modelId}</Badge> : null}
              {run.look ? <Badge>{run.look}</Badge> : null}
            </div>
            {run.lookReason && run.lookReason !== "Chosen by the user" ? (
              <p className="text-xs text-ink-muted">{run.lookReason}</p>
            ) : null}
            <RunTimeline events={events} />
            {run.error ? (
              <p className="rounded-md bg-unsupported/10 p-2 text-xs text-unsupported">
                {run.error.code}: {run.error.message}
              </p>
            ) : null}
          </div>
        </Card>
      </aside>
      <div className="min-w-0 space-y-5">
        <RendersPanel run={run} events={events} />
        {run.storyboard ? <StoryboardEditor run={run} onRunChange={replaceRun} /> : null}
        {run.brief ? <BriefPanel brief={run.brief} /> : null}
      </div>
    </div>
  );
}
