"use client";

import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { classNames } from "@/lib/class-names";
import { runActivity } from "@/lib/project-tree";
import { useRuns } from "@/lib/use-runs";
import { LogoMark } from "./logo-mark";
import { isActivePath, type NavEntry, type NavLink, navGroups } from "./nav-config";
import { ProjectTreeNav } from "./project-tree-nav";
import { ThemeSwitch } from "./theme-switch";

const rowClasses =
  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors";

function Tooltip(props: { label: string }): React.ReactElement {
  return (
    <span className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-lg border border-line-strong bg-panel-raised px-3 py-1.5 text-xs font-medium whitespace-nowrap text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {props.label}
    </span>
  );
}

function Badge(props: { count: number; collapsed: boolean }): React.ReactElement | null {
  if (props.count === 0) return null;
  if (props.collapsed)
    return <span className="absolute top-2 right-2 size-2 rounded-full bg-accent" aria-hidden="true" />;
  return (
    <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-md bg-accent px-1.5 text-xs font-semibold text-on-accent">
      {props.count}
    </span>
  );
}

function LinkItem(props: {
  link: NavLink;
  active: boolean;
  collapsed: boolean;
  badge: number;
}): React.ReactElement {
  const { Icon } = props.link;
  return (
    <li className="group relative">
      <Link
        href={props.link.href}
        aria-current={props.active ? "page" : undefined}
        aria-label={props.collapsed ? props.link.label : undefined}
        className={classNames(
          rowClasses,
          props.collapsed && "justify-center px-0",
          props.active ? "bg-panel-hover text-ink" : "text-ink-muted hover:bg-panel-raised hover:text-ink",
        )}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
        {props.collapsed ? null : <span>{props.link.label}</span>}
        <Badge count={props.badge} collapsed={props.collapsed} />
      </Link>
      {props.collapsed ? (
        <Tooltip label={props.badge ? `${props.link.label} · ${props.badge}` : props.link.label} />
      ) : null}
    </li>
  );
}

function ProjectsItem(props: {
  entry: NavEntry;
  collapsed: boolean;
  pathname: string;
  runs: ReturnType<typeof useRuns>["runs"];
}): React.ReactElement {
  const [open, setOpen] = useState(true);
  const { Icon } = props.entry;
  const active = props.pathname.startsWith("/runs/");
  if (props.collapsed) {
    return (
      <li className="group relative">
        <button
          type="button"
          aria-label={props.entry.label}
          aria-haspopup="true"
          className={classNames(
            rowClasses,
            "justify-center px-0",
            active ? "bg-panel-hover text-ink" : "text-ink-muted hover:bg-panel-raised hover:text-ink",
          )}
        >
          <Icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
        </button>
        {/* Fly-out: the same tree beside the rail, on hover or keyboard focus. */}
        <div className="invisible absolute top-0 left-full z-50 pl-3 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="w-64 rounded-2xl border border-line-strong bg-panel p-3 shadow-2xl">
            <div className="mb-1 px-2 text-xs font-semibold text-ink">{props.entry.label}</div>
            <ProjectTreeNav runs={props.runs} pathname={props.pathname} />
          </div>
        </div>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={classNames(
          rowClasses,
          open || active ? "bg-panel-hover text-ink" : "text-ink-muted hover:bg-panel-raised hover:text-ink",
        )}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
        <span>{props.entry.label}</span>
        <ChevronDown
          className={classNames("ml-auto size-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="mt-2 mb-1">
          <ProjectTreeNav runs={props.runs} pathname={props.pathname} />
        </div>
      ) : null}
    </li>
  );
}

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/** The app's navigation: brand, two groups of items with a projects tree, theme switch. */
export function Sidebar(props: SidebarProps): React.ReactElement {
  const pathname = usePathname();
  const { runs } = useRuns();
  const activeCount = (runs ?? []).filter((run) => {
    const activity = runActivity(run);
    return activity === "working" || activity === "needs-you";
  }).length;
  const CollapseIcon = props.collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      aria-label="Sidebar"
      className={classNames(
        "panel relative flex h-full shrink-0 flex-col py-5 transition-[width] duration-200",
        props.collapsed ? "w-[76px] px-3" : "w-[264px] px-4",
      )}
    >
      <div className={classNames("flex items-center", props.collapsed ? "justify-center" : "gap-3 px-2")}>
        <Link href="/" aria-label="Cutroom home" className="flex items-center gap-3">
          <LogoMark className="size-8 shrink-0" />
          {props.collapsed ? null : <span className="text-lg font-semibold tracking-tight">Cutroom</span>}
        </Link>
      </div>
      <nav aria-label="Main" className={classNames("mt-10 flex-1", props.collapsed ? "" : "overflow-y-auto")}>
        {navGroups.map((group, groupIndex) => (
          <div key={group[0]?.id ?? groupIndex}>
            {groupIndex > 0 ? <hr className="mx-3 my-5 border-line" /> : null}
            <ul className="space-y-1.5">
              {group.map((entry) =>
                entry.kind === "projects" ? (
                  <ProjectsItem
                    key={entry.id}
                    entry={entry}
                    collapsed={props.collapsed}
                    pathname={pathname}
                    runs={runs}
                  />
                ) : (
                  <LinkItem
                    key={entry.id}
                    link={entry}
                    active={isActivePath(pathname, entry)}
                    collapsed={props.collapsed}
                    badge={entry.id === "activity" ? activeCount : 0}
                  />
                ),
              )}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-4 space-y-3">
        <ThemeSwitch collapsed={props.collapsed} />
        <button
          type="button"
          onClick={props.onToggleCollapsed}
          aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={classNames(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-ink-faint hover:text-ink",
            props.collapsed && "mx-auto px-0",
          )}
        >
          <CollapseIcon className="size-4" aria-hidden="true" />
          {props.collapsed ? null : "Collapse"}
        </button>
      </div>
    </aside>
  );
}
