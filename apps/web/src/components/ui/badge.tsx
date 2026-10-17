import type { ClaimVerdict } from "@cutroom/scene-spec";
import type React from "react";
import { classNames } from "@/lib/class-names";

const verdictClasses: Readonly<Record<ClaimVerdict, string>> = {
  supported: "bg-supported/15 text-supported",
  weak: "bg-weak/15 text-weak",
  unsupported: "bg-unsupported/15 text-unsupported",
};

const verdictLabels: Readonly<Record<ClaimVerdict, string>> = {
  supported: "Supported",
  weak: "Weak",
  unsupported: "Unsupported",
};

export function VerdictBadge(props: { verdict: ClaimVerdict; count?: number }): React.ReactElement {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        verdictClasses[props.verdict],
      )}
    >
      {props.count !== undefined ? `${props.count} ` : ""}
      {verdictLabels[props.verdict]}
    </span>
  );
}

export function Badge(props: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted",
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}
