import type React from "react";
import { classNames } from "@/lib/class-names";

export function Card(props: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <section className={classNames("rounded-xl border border-line bg-panel", props.className)}>
      {props.children}
    </section>
  );
}

export function CardHeader(props: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">{props.title}</h2>
        {props.description ? <p className="mt-1 text-sm text-ink-muted">{props.description}</p> : null}
      </div>
      {props.action}
    </div>
  );
}
