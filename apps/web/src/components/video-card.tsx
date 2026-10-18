"use client";

import { Clapperboard } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { activityLabels, StatusDot } from "@/components/app-shell/status-dot";
import { StoryboardThumbnail } from "@/features/video-preview/storyboard-thumbnail";
import { apiClient, type RunView } from "@/lib/api-client";
import { runActivity, sourceLabel, videoLabel } from "@/lib/project-tree";

export function relativeTime(isoDate: string, now: number = Date.now()): string {
  const minutes = Math.round((now - new Date(isoDate).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(isoDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The rendered thumbnail when there is one, else a live frame of the storyboard, else the status. */
function CardPoster(props: { run: RunView }): React.ReactElement {
  const thumbnail = props.run.assets.find(
    (asset) => asset.kind === "thumbnail" && asset.fileName.endsWith(".jpg"),
  );
  if (thumbnail) {
    return (
      // biome-ignore lint/performance/noImgElement: thumbnails come from the local API, not a Next image host
      <img src={apiClient.assetUrl(thumbnail.url)} alt="" className="aspect-video w-full object-cover" />
    );
  }
  const storyboard = props.run.storyboard?.storyboard;
  if (storyboard) return <StoryboardThumbnail storyboard={storyboard} />;
  return (
    <div className="grid aspect-video w-full place-items-center bg-panel-raised text-ink-faint">
      <Clapperboard className="size-6" aria-hidden="true" />
    </div>
  );
}

export function VideoCard(props: { run: RunView }): React.ReactElement {
  const activity = runActivity(props.run);
  return (
    <Link
      href={`/runs/${props.run.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line-strong"
    >
      <div className="pointer-events-none overflow-hidden border-b border-line">
        <CardPoster run={props.run} />
      </div>
      <div className="space-y-1.5 p-3.5">
        <div className="truncate text-sm font-medium">{videoLabel(props.run)}</div>
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <StatusDot activity={activity} />
          <span className="text-ink-muted">{activityLabels[activity]}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{sourceLabel(props.run.request.source)}</span>
          <span className="ml-auto shrink-0">{relativeTime(props.run.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
