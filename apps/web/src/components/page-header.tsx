import type React from "react";

export function PageHeader(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
        {props.description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{props.description}</p>
        ) : null}
      </div>
      {props.actions}
    </header>
  );
}

/** The standard page frame inside the shell: a panel with comfortable padding. */
export function PageFrame(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="min-h-full rounded-2xl bg-panel/40">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">{props.children}</div>
    </div>
  );
}
