"use client";

import { FlaskConical } from "lucide-react";
import type React from "react";
import { useSystemStatus } from "@/lib/use-system-status";

const REPOSITORY_URL = "https://github.com/codewithveek/cutroom";

/** The public demo's notice (D-5a): says what this is and where to run it for real. */
export function DemoBanner(): React.ReactElement | null {
  const { status } = useSystemStatus();
  if (!status?.demoMode) return null;
  return (
    <div
      role="note"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-line-strong bg-panel-raised px-4 py-2 text-center text-sm text-ink-muted"
    >
      <FlaskConical className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <span>Demo on a sample repo</span>
      <span aria-hidden="true">·</span>
      <span>Read-only</span>
      <span aria-hidden="true">·</span>
      <a href={REPOSITORY_URL} className="font-medium text-accent hover:text-accent-strong" rel="noreferrer">
        Run it locally →
      </a>
    </div>
  );
}
