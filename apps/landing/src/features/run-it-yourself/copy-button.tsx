"use client";

import { Check, Copy } from "lucide-react";
import type React from "react";
import { useState } from "react";

const COPIED_FOR_MS = 2000;

export function CopyButton(props: { text: string; label: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FOR_MS);
    } catch {
      // No clipboard permission: the text is still there to select by hand.
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={props.label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-panel-raised px-2.5 text-xs text-ink-muted hover:text-ink"
    >
      {copied ? (
        <Check className="size-3.5 text-supported" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
