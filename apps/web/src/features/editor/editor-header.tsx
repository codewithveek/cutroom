"use client";

import type { RunEvent } from "@cutroom/scene-spec";
import {
  ChevronLeft,
  Cloud,
  type Download,
  FileText,
  Laptop,
  ListChecks,
  Loader2,
  Split,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { activityLabels, StatusDot } from "@/components/app-shell/status-dot";
import type { RunView } from "@/lib/api-client";
import { isEnabled } from "@/lib/capabilities";
import { classNames } from "@/lib/class-names";
import { runActivity, sourceLabel, videoLabel } from "@/lib/project-tree";
import { runStatusLabels } from "@/lib/run-status";
import type { EditorSheet } from "./editor-context";
import { type EditorTabId, editorTabs } from "./editor-tabs";

const privacyIcons = { local: Laptop, hybrid: Split, cloud: Cloud } as const;

function renderProgress(events: ReadonlyArray<RunEvent>): number | undefined {
  const progress = events.filter((event) => event.step === "render" && event.kind === "progress").at(-1);
  return typeof progress?.payload.progress === "number" ? progress.payload.progress : undefined;
}

export interface PrimaryActionState {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone: "accent" | "danger" | "neutral";
  Icon?: typeof Download;
}

export interface EditorHeaderProps {
  run: RunView;
  events: ReadonlyArray<RunEvent>;
  tab: EditorTabId;
  onTab: (tab: EditorTabId) => void;
  tabsEnabled: boolean;
  dirty: boolean;
  onOpenSheet: (sheet: EditorSheet) => void;
  primary: PrimaryActionState;
}

/** Back, title, the editing tabs, and the run's state with the one next step (save, approve, download). */
export function EditorHeader(props: EditorHeaderProps): React.ReactElement {
  const { run } = props;
  const PrivacyIcon = privacyIcons[run.request.privacyMode];
  const progress = renderProgress(props.events);
  const activity = runActivity(run);
  const tabs = editorTabs.filter((tab) => !tab.requires || isEnabled(tab.requires));
  return (
    <header className="panel flex h-16 shrink-0 items-center gap-3 px-3">
      <Link
        href="/"
        aria-label="Back to Home"
        className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-panel-raised hover:text-ink"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </Link>
      <div className="min-w-0 max-w-64">
        <div className="truncate text-[15px] font-medium">{videoLabel(run)}</div>
        <div className="truncate text-[11px] text-ink-faint">
          {sourceLabel(run.request.source)}
          {run.storyboard ? ` · v${run.storyboard.version}` : ""}
          {props.dirty ? " · unsaved edits" : ""}
        </div>
      </div>
      <nav aria-label="Editor" className="mx-auto flex items-center gap-0.5 rounded-2xl bg-panel-raised p-1">
        {tabs.map((tab) => {
          const active = tab.id === props.tab;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={!props.tabsEnabled}
              aria-pressed={active}
              onClick={() => props.onTab(tab.id)}
              className={classNames(
                "flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition-colors disabled:opacity-40",
                active ? "bg-panel-hover text-accent" : "text-ink-muted hover:text-ink",
              )}
            >
              <tab.Icon className="size-4" aria-hidden="true" />
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => props.onOpenSheet("pipeline")}
          className="flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs text-ink-muted hover:bg-panel-raised hover:text-ink"
          title={activityLabels[activity]}
        >
          <StatusDot activity={activity} />
          <span className="hidden 2xl:inline">{runStatusLabels[run.status]}</span>
          {run.status === "rendering" && progress !== undefined ? (
            <span className="font-mono">{Math.round(progress * 100)}%</span>
          ) : null}
          <ListChecks className="size-4 2xl:hidden" aria-hidden="true" />
        </button>
        <span
          title={`${run.request.privacyMode} mode`}
          className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs text-ink-muted capitalize"
        >
          <PrivacyIcon className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">{run.request.privacyMode}</span>
        </span>
        {run.brief ? (
          <button
            type="button"
            aria-label="Product brief"
            title="Product brief"
            onClick={() => props.onOpenSheet("brief")}
            className="grid size-9 place-items-center rounded-xl border border-line bg-panel-raised text-ink-muted hover:text-ink"
          >
            <FileText className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={props.primary.onClick}
          disabled={props.primary.disabled || props.primary.busy}
          className={classNames(
            "flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            props.primary.tone === "accent" && "bg-accent text-on-accent hover:bg-accent-strong",
            props.primary.tone === "danger" && "bg-unsupported/15 text-unsupported hover:bg-unsupported/25",
            props.primary.tone === "neutral" && "border border-line bg-panel-raised text-ink",
          )}
        >
          {props.primary.busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {props.primary.Icon && !props.primary.busy ? (
            <props.primary.Icon className="size-4" aria-hidden="true" />
          ) : null}
          {props.primary.label}
        </button>
      </div>
    </header>
  );
}
