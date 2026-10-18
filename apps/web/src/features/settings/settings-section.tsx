import type React from "react";

/** A Settings row: title and description on the left, the controls on the right. */
export function Section(props: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      aria-labelledby={props.id}
      className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[260px_minmax(0,1fr)]"
    >
      <div>
        <h2 id={props.id} className="text-sm font-semibold">
          {props.title}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{props.description}</p>
      </div>
      <div>{props.children}</div>
    </section>
  );
}
