"use client";

import { X } from "lucide-react";
import type React from "react";
import { useEffect } from "react";

export interface SideSheetProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** A panel sliding over the right edge; Escape closes it. */
export function SideSheet(props: SideSheetProps): React.ReactElement | null {
  const { open, onClose } = props;
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className="relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{props.title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {props.children}
      </aside>
    </div>
  );
}
