"use client";

import Link from "next/link";
import type React from "react";
import { VideoCard } from "@/components/video-card";
import type { RunView } from "@/lib/api-client";

const RECENT_COUNT = 4;

export function RecentVideos(props: { runs: ReadonlyArray<RunView> | undefined }): React.ReactElement | null {
  if (!props.runs || props.runs.length === 0) return null;
  const recent = props.runs
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, RECENT_COUNT);
  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="recent-heading" className="text-sm font-semibold">
          Continue where you left off
        </h2>
        <Link href="/library" className="text-xs text-ink-faint hover:text-ink">
          View all
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {recent.map((run) => (
          <li key={run.id}>
            <VideoCard run={run} />
          </li>
        ))}
      </ul>
    </section>
  );
}
