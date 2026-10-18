"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { PageFrame, PageHeader } from "@/components/page-header";
import { VideoCard } from "@/components/video-card";
import type { RunView } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { type RunActivity, runActivity, sourceLabel, videoLabel } from "@/lib/project-tree";
import { useRuns } from "@/lib/use-runs";

export type LibraryFilter = "all" | "active" | "done" | "failed";

const filters: ReadonlyArray<{ id: LibraryFilter; label: string; activities: ReadonlyArray<RunActivity> }> = [
  { id: "all", label: "All", activities: ["working", "needs-you", "done", "failed"] },
  { id: "active", label: "In progress", activities: ["working", "needs-you"] },
  { id: "done", label: "Done", activities: ["done"] },
  { id: "failed", label: "Failed", activities: ["failed"] },
];

export function filterRuns(options: {
  runs: ReadonlyArray<RunView>;
  filter: LibraryFilter;
  query: string;
}): RunView[] {
  const activities = filters.find((candidate) => candidate.id === options.filter)?.activities ?? [];
  const query = options.query.trim().toLowerCase();
  return options.runs
    .filter((run) => activities.includes(runActivity(run)))
    .filter(
      (run) =>
        !query ||
        videoLabel(run).toLowerCase().includes(query) ||
        sourceLabel(run.request.source).toLowerCase().includes(query),
    )
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export interface LibraryViewProps {
  title: string;
  description: string;
  initialFilter: LibraryFilter;
}

/** Every video as a card, filterable by state and searchable by title or project (PRD §9 screen 6). */
export function LibraryView(props: LibraryViewProps): React.ReactElement {
  const { runs, error } = useRuns();
  const [filter, setFilter] = useState<LibraryFilter>(props.initialFilter);
  const [query, setQuery] = useState("");
  const visible = runs ? filterRuns({ runs, filter, query }) : [];
  return (
    <PageFrame>
      <PageHeader
        title={props.title}
        description={props.description}
        actions={
          <Link
            href="/"
            className="flex h-9 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-medium text-on-accent hover:bg-accent-strong"
          >
            <Plus className="size-4" aria-hidden="true" /> New video
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex max-w-full overflow-x-auto rounded-xl bg-panel p-1">
          <legend className="sr-only">Filter</legend>
          {filters.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === filter}
              onClick={() => setFilter(candidate.id)}
              className={classNames(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                candidate.id === filter
                  ? "bg-panel-hover font-medium text-ink"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {candidate.label}
              {runs ? (
                <span className="ml-1.5 text-xs text-ink-faint">
                  {filterRuns({ runs, filter: candidate.id, query: "" }).length}
                </span>
              ) : null}
            </button>
          ))}
        </fieldset>
        <label className="flex h-10 w-full items-center sm:ml-auto sm:w-72 gap-2 rounded-xl border border-line bg-panel px-3 focus-within:border-line-strong">
          <Search className="size-4 text-ink-faint" aria-hidden="true" />
          <span className="sr-only">Search videos</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or project"
            className="w-full bg-transparent text-sm placeholder:text-ink-faint focus:outline-none"
          />
        </label>
      </div>
      {error ? <p className="text-sm text-unsupported">{error}</p> : null}
      {runs && visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-12 text-center text-sm text-ink-muted">
          {runs.length === 0 ? "No videos yet. Start one from Home." : "Nothing matches this filter."}
        </div>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((run) => (
          <li key={run.id}>
            <VideoCard run={run} />
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
