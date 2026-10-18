import type React from "react";
import { classNames } from "@/lib/class-names";
import type { RunActivity } from "@/lib/project-tree";

const dotClasses: Readonly<Record<RunActivity, string>> = {
  working: "bg-accent animate-pulse",
  "needs-you": "bg-weak",
  done: "bg-supported",
  failed: "bg-unsupported",
};

export const activityLabels: Readonly<Record<RunActivity, string>> = {
  working: "In progress",
  "needs-you": "Needs you",
  done: "Done",
  failed: "Failed",
};

export function StatusDot(props: { activity: RunActivity; className?: string }): React.ReactElement {
  return (
    <span
      role="img"
      aria-label={activityLabels[props.activity]}
      className={classNames(
        "inline-block size-1.5 shrink-0 rounded-full",
        dotClasses[props.activity],
        props.className,
      )}
    />
  );
}
