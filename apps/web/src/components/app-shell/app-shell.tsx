"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { breakpoints, useMediaQuery } from "@/lib/use-media-query";
import { LogoMark } from "./logo-mark";
import { Sidebar } from "./sidebar";

const COLLAPSED_STORAGE_KEY = "cutroom-sidebar-collapsed";

function readStoredCollapsed(): boolean | undefined {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    return stored === null ? undefined : stored === "true";
  } catch {
    return undefined;
  }
}

/** Phones: a top bar whose menu opens the sidebar as a drawer. */
function MobileBar(props: { onOpenMenu: () => void }): React.ReactElement {
  return (
    <header className="panel flex h-14 shrink-0 items-center gap-3 px-3 md:hidden">
      <button
        type="button"
        onClick={props.onOpenMenu}
        aria-label="Open menu"
        className="grid size-9 place-items-center rounded-xl text-ink-muted hover:bg-panel-raised hover:text-ink"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <LogoMark className="size-7" />
        Cutroom
      </Link>
    </header>
  );
}

/**
 * Sidebar + content on the canvas. Desktop: the full sidebar (run pages start with the rail so the
 * editor gets the width). Tablet: always the rail. Phone: a top bar and a drawer.
 */
export function AppShell(props: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const isEditor = pathname.startsWith("/runs/");
  const isDesktop = useMediaQuery(breakpoints.lg);
  const [collapsed, setCollapsed] = useState(isEditor);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setCollapsed(isEditor ? true : (readStoredCollapsed() ?? false));
  }, [isEditor]);

  // Navigating closes the phone drawer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (!isEditor) {
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // The preference lasts for this page only.
      }
    }
  };

  return (
    <div className="flex h-dvh flex-col gap-2 p-2 md:flex-row md:gap-3 md:p-3">
      <MobileBar onOpenMenu={() => setDrawerOpen(true)} />
      <div className="hidden md:flex">
        <Sidebar collapsed={collapsed || !isDesktop} onToggleCollapsed={isDesktop ? toggle : undefined} />
      </div>
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative h-full">
            <Sidebar collapsed={false} onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-2xl">{props.children}</main>
    </div>
  );
}
