"use client";

import type { SystemCheck } from "@cutroom/scene-spec";
import { Check, Copy, Cpu, Film, Mic, Server } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { classNames } from "@/lib/class-names";

const checkIcons: Readonly<Record<SystemCheck["id"], typeof Cpu>> = {
  model: Cpu,
  voice: Mic,
  ffmpeg: Film,
  "render-host": Server,
};

const stateClasses: Readonly<Record<SystemCheck["state"], string>> = {
  ready: "bg-supported/15 text-supported",
  missing: "bg-unsupported/15 text-unsupported",
  optional: "bg-panel-hover text-ink-faint",
};

const stateLabels: Readonly<Record<SystemCheck["state"], string>> = {
  ready: "Ready",
  missing: "Missing",
  optional: "Optional",
};

function CopyCommand(props: { command: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(props.command).then(() => setCopied(true));
      }}
      className="mt-2 flex w-full items-center gap-2 rounded-lg bg-panel-raised px-2.5 py-1.5 text-left font-mono text-[11px] text-ink-muted hover:text-ink"
    >
      <span className="min-w-0 flex-1 truncate">{props.command}</span>
      {copied ? (
        <Check className="size-3.5 text-supported" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy command"}</span>
    </button>
  );
}

export function SystemCheckCard(props: { check: SystemCheck }): React.ReactElement {
  const Icon = checkIcons[props.check.id];
  return (
    <div className="rounded-xl border border-line bg-panel p-3.5">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 text-ink-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-sm leading-tight font-medium">{props.check.label}</span>
        <span
          className={classNames(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            stateClasses[props.check.state],
          )}
        >
          {stateLabels[props.check.state]}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{props.check.detail}</p>
      {props.check.fix && props.check.state === "missing" ? <CopyCommand command={props.check.fix} /> : null}
    </div>
  );
}
