import type React from "react";

export function SectionHeading(props: {
  id: string;
  title: string;
  sub?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mb-8 space-y-2 text-center">
      <h2 id={props.id} className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
        {props.title}
      </h2>
      {props.sub ? <p className="mx-auto max-w-xl text-balance text-ink-muted">{props.sub}</p> : null}
    </div>
  );
}
