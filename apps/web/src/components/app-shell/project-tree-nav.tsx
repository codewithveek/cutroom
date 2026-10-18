"use client";

import { ChevronRight, GitBranch, HardDrive } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import type { RunView } from "@/lib/api-client";
import { classNames } from "@/lib/class-names";
import { buildProjectTree, type ProjectNode, runActivity, videoLabel } from "@/lib/project-tree";
import { StatusDot } from "./status-dot";

const MAX_PROJECTS = 6;
const MAX_VIDEOS = 5;

function activeRunId(pathname: string): string | undefined {
  return pathname.match(/^\/runs\/([^/]+)/)?.[1];
}

/**
 * A tree branch, as in the design: each child draws a curved elbow into its row, and every child
 * but the last continues the vertical rule down to its next sibling.
 */
function Branch(props: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <ul
      className={classNames(
        "relative ml-[22px] space-y-0.5 pl-3.5 [&>li:not(:last-child)]:before:absolute [&>li:not(:last-child)]:before:top-0 [&>li:not(:last-child)]:before:-bottom-0.5 [&>li:not(:last-child)]:before:-left-3.5 [&>li:not(:last-child)]:before:border-l [&>li:not(:last-child)]:before:border-line",
        props.className,
      )}
    >
      {props.children}
    </ul>
  );
}

function Elbow(): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 -left-3.5 h-[17px] w-2.5 rounded-bl-lg border-b border-l border-line"
    />
  );
}

function shortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function VideoRow(props: { run: RunView; active: boolean }): React.ReactElement {
  return (
    <li className="relative">
      <Elbow />
      <Link
        href={`/runs/${props.run.id}`}
        aria-current={props.active ? "page" : undefined}
        className={classNames(
          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
          props.active ? "bg-panel-hover font-medium text-ink" : "text-ink-muted hover:text-ink",
        )}
      >
        <StatusDot activity={runActivity(props.run)} />
        <span className="min-w-0 flex-1 truncate">{videoLabel(props.run)}</span>
        {props.active ? (
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <span className="shrink-0 text-[10px] text-ink-faint">{shortDate(props.run.createdAt)}</span>
        )}
      </Link>
    </li>
  );
}

function ProjectRow(props: {
  project: ProjectNode;
  activeId: string | undefined;
  open: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const SourceIcon = props.project.sourceKind === "git" ? GitBranch : HardDrive;
  return (
    <li className="relative">
      <Elbow />
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={props.open}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-muted transition-colors hover:text-ink"
      >
        <SourceIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{props.project.label}</span>
        <span className="font-mono text-[10px] text-ink-faint">{props.project.videos.length}</span>
        <ChevronRight
          className={classNames("size-3.5 shrink-0 transition-transform", props.open && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      {props.open ? (
        <Branch className="mt-0.5 mb-1">
          {props.project.videos.slice(0, MAX_VIDEOS).map((run) => (
            <VideoRow key={run.id} run={run} active={run.id === props.activeId} />
          ))}
        </Branch>
      ) : null}
    </li>
  );
}

export interface ProjectTreeNavProps {
  runs: ReadonlyArray<RunView> | undefined;
  pathname: string;
}

/** Projects → videos. The project holding the open video starts expanded. */
export function ProjectTreeNav(props: ProjectTreeNavProps): React.ReactElement {
  const tree = buildProjectTree(props.runs ?? []);
  const activeId = activeRunId(props.pathname);
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set());
  const activeProjectKey = tree.find((project) => project.videos.some((run) => run.id === activeId))?.key;
  const firstProjectKey = tree[0]?.key;

  useEffect(() => {
    const keyToOpen = activeProjectKey ?? firstProjectKey;
    if (keyToOpen)
      setOpenKeys((previous) => (previous.has(keyToOpen) ? previous : new Set([...previous, keyToOpen])));
  }, [activeProjectKey, firstProjectKey]);

  if (!props.runs) return <p className="ml-[30px] py-1.5 text-xs text-ink-faint">Loading…</p>;
  if (tree.length === 0)
    return (
      <Branch>
        <li className="relative">
          <Elbow />
          <Link
            href="/new"
            className="block rounded-lg px-2.5 py-1.5 text-[13px] text-ink-faint hover:text-ink"
          >
            No projects yet
          </Link>
        </li>
      </Branch>
    );
  const toggle = (key: string) =>
    setOpenKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <Branch>
      {tree.slice(0, MAX_PROJECTS).map((project) => (
        <ProjectRow
          key={project.key}
          project={project}
          activeId={activeId}
          open={openKeys.has(project.key)}
          onToggle={() => toggle(project.key)}
        />
      ))}
      {tree.length > MAX_PROJECTS ? (
        <li className="relative">
          <Elbow />
          <Link href="/library" className="block px-2.5 py-1.5 text-[13px] text-ink-faint hover:text-ink">
            {tree.length - MAX_PROJECTS} more in Library
          </Link>
        </li>
      ) : null}
    </Branch>
  );
}
