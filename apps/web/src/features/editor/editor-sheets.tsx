"use client";

import type { RunEvent } from "@cutroom/scene-spec";
import type React from "react";
import { SideSheet } from "@/components/ui/side-sheet";
import { BriefPanel } from "@/features/product-brief/brief-panel";
import { RendersPanel } from "@/features/render-queue/renders-panel";
import { RunTimeline } from "@/features/render-queue/run-timeline";
import type { RunView } from "@/lib/api-client";
import type { EditorSheet } from "./editor-context";

/** Brief, pipeline and renders as sheets over the editor, so editing never loses its place. */
export function EditorSheets(props: {
  run: RunView;
  events: ReadonlyArray<RunEvent>;
  sheet: EditorSheet | undefined;
  onClose: () => void;
}): React.ReactElement {
  const { run } = props;
  return (
    <>
      <SideSheet title="Pipeline" open={props.sheet === "pipeline"} onClose={props.onClose}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
            <span className="rounded-md bg-panel-raised px-2 py-0.5">{run.request.privacyMode} mode</span>
            {run.providers.modelId ? (
              <span className="rounded-md bg-panel-raised px-2 py-0.5">{run.providers.modelId}</span>
            ) : null}
            {run.look ? <span className="rounded-md bg-panel-raised px-2 py-0.5">{run.look}</span> : null}
          </div>
          {run.lookReason && run.lookReason !== "Chosen by the user" ? (
            <p className="text-xs text-ink-muted">{run.lookReason}</p>
          ) : null}
          <RunTimeline events={props.events} />
          {run.error ? (
            <p className="rounded-lg bg-unsupported/10 p-3 text-xs text-unsupported">
              {run.error.code}: {run.error.message}
            </p>
          ) : null}
        </div>
      </SideSheet>
      <SideSheet title="Product brief" open={props.sheet === "brief"} onClose={props.onClose}>
        {run.brief ? <BriefPanel brief={run.brief} /> : null}
      </SideSheet>
      <SideSheet title="Renders" open={props.sheet === "renders"} onClose={props.onClose}>
        <RendersPanel run={run} events={props.events} />
      </SideSheet>
    </>
  );
}
