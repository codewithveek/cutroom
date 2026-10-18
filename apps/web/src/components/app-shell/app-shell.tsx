"use client";

import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
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

/**
 * Sidebar + content on the canvas. The editor needs the width, so run pages start with the
 * rail; elsewhere the stored preference wins.
 */
export function AppShell(props: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const isEditor = pathname.startsWith("/runs/");
  const [collapsed, setCollapsed] = useState(isEditor);

  useEffect(() => {
    setCollapsed(isEditor ? true : (readStoredCollapsed() ?? false));
  }, [isEditor]);

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
    <div className="flex h-dvh gap-3 p-3">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      <main className="min-w-0 flex-1 overflow-y-auto rounded-2xl">{props.children}</main>
    </div>
  );
}
