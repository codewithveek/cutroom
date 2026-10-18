"use client";

import type { RunEvent } from "@cutroom/scene-spec";
import { Download } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { apiClient, type RunView } from "@/lib/api-client";
import { QualityReport } from "./quality-report";

function latestRenderProgress(
  events: ReadonlyArray<RunEvent>,
): Map<string, { stage: string; progress: number }> {
  const progress = new Map<string, { stage: string; progress: number }>();
  for (const event of events) {
    if (event.step !== "render" || event.kind !== "progress") continue;
    const ratio = String(event.payload.ratio ?? "");
    progress.set(ratio, {
      stage: String(event.payload.stage ?? ""),
      progress: Number(event.payload.progress ?? 0),
    });
  }
  return progress;
}

function DeliveryNote(props: { url: string }): React.ReactElement {
  const [text, setText] = useState("");
  useEffect(() => {
    void fetch(props.url)
      .then((response) => response.text())
      .then(setText);
  }, [props.url]);
  return (
    <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas p-4 text-xs leading-relaxed text-ink-muted">
      {text}
    </pre>
  );
}

/** One card per ratio: progress while rendering, then player and downloads (PRD §9 screen 5). */
export function RendersPanel(props: {
  run: RunView;
  events: ReadonlyArray<RunEvent>;
}): React.ReactElement | null {
  const { run } = props;
  const progress = latestRenderProgress(props.events);
  const videos = run.assets.filter((asset) => asset.kind === "video");
  const note = run.assets.find((asset) => asset.kind === "delivery-note");
  const thumbnail = run.assets.find((asset) => asset.kind === "thumbnail" && asset.fileName.endsWith(".jpg"));
  if (videos.length === 0 && progress.size === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Renders"
        description={
          run.request.privacyMode === "local"
            ? "Ran fully local: the code never left this machine."
            : "Rendered in the cloud; code stayed local."
        }
      />
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {run.request.ratios.map((ratio) => {
          const video = videos.find((asset) => asset.ratio === ratio);
          const captions = run.assets.find((asset) => asset.kind === "captions" && asset.ratio === ratio);
          const ratioProgress = progress.get(ratio);
          return (
            <div key={ratio} className="space-y-2 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono">{ratio}</span>
                {video?.durationMs ? (
                  <span className="text-xs text-ink-faint">{(video.durationMs / 1000).toFixed(1)} s</span>
                ) : null}
              </div>
              {video ? (
                <video
                  controls
                  src={apiClient.assetUrl(video.url)}
                  className="w-full rounded-md bg-black"
                  {...(thumbnail ? { poster: apiClient.assetUrl(thumbnail.url) } : {})}
                >
                  {captions ? (
                    <track
                      kind="captions"
                      src={apiClient.assetUrl(captions.url)}
                      srcLang="en"
                      label="English"
                      default
                    />
                  ) : null}
                </video>
              ) : (
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-panel-raised">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${Math.round((ratioProgress?.progress ?? 0) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-ink-faint">
                    {ratioProgress
                      ? `${ratioProgress.stage} ${Math.round(ratioProgress.progress * 100)}%`
                      : "queued"}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {[video, captions].map((asset) =>
                  asset ? (
                    <a
                      key={asset.id}
                      href={`${apiClient.assetUrl(asset.url)}?download`}
                      className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 font-mono text-[11px] text-ink-muted hover:text-ink"
                    >
                      <Download className="size-3" aria-hidden="true" />
                      {asset.fileName}
                    </a>
                  ) : null,
                )}
              </div>
              <QualityReport run={run} ratio={ratio} />
            </div>
          );
        })}
      </div>
      {note ? (
        <div className="border-t border-line p-5">
          <h3 className="mb-2 text-xs font-medium text-ink-muted">Delivery note</h3>
          <DeliveryNote url={apiClient.assetUrl(note.url)} />
        </div>
      ) : null}
    </Card>
  );
}
