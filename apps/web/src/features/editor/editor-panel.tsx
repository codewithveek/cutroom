import type React from "react";
import { classNames } from "@/lib/class-names";

/** The rounded panel every editor region sits in, with an optional title row. */
export function EditorPanel(props: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}): React.ReactElement {
  return (
    <section className={classNames("panel flex min-h-0 flex-col", props.className)}>
      {props.title ? (
        <div className="flex h-14 shrink-0 items-center gap-2 px-4">
          <h2 className="text-[15px] font-medium">{props.title}</h2>
          <div className="ml-auto flex items-center gap-1.5">{props.actions}</div>
        </div>
      ) : null}
      <div className={classNames("min-h-0 flex-1 overflow-y-auto", props.bodyClassName ?? "px-3 pb-3")}>
        {props.children}
      </div>
    </section>
  );
}

export function IconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean },
): React.ReactElement {
  const { label, active, className, children, ...rest } = props;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={classNames(
        "grid size-8 place-items-center rounded-lg border border-line transition-colors disabled:opacity-40",
        active ? "bg-accent-soft text-accent" : "bg-panel-raised text-ink-muted hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}
