"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { apiClient, type RunView } from "@/lib/api-client";

/** Past videos with thumbnail, look, ratio chips and date (PRD §9 screen 6). */
export function LibraryGrid(): React.ReactElement {
  const [runs, setRuns] = useState<RunView[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    apiClient
      .listRuns()
      .then((response) => setRuns(response.runs))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);
  if (error) return <p className="text-sm text-unsupported">{error}</p>;
  if (!runs) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (runs.length === 0)
    return <p className="text-sm text-ink-muted">No videos yet. Start one from New video.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {runs.map((run) => {
        const thumbnail = run.assets.find(
          (asset) => asset.kind === "thumbnail" && asset.fileName.endsWith(".jpg"),
        );
        return (
          <li key={run.id}>
            <Link
              href={`/runs/${run.id}`}
              className="block overflow-hidden rounded-xl border border-line bg-panel hover:border-line-strong"
            >
              <div className="aspect-video bg-panel-raised">
                {thumbnail ? (
                  // biome-ignore lint/performance/noImgElement: thumbnails come from the local API, not a Next image host
                  <img src={apiClient.assetUrl(thumbnail.url)} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-medium">
                  {run.storyboard?.storyboard.title ?? run.brief?.name ?? run.id}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge>{run.status}</Badge>
                  {run.look ? <Badge>{run.look}</Badge> : null}
                  {run.request.ratios.map((ratio) => (
                    <Badge key={ratio}>{ratio}</Badge>
                  ))}
                </div>
                <div className="text-[11px] text-ink-faint">{new Date(run.createdAt).toLocaleString()}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
