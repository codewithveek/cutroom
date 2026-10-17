import type React from "react";
import { classNames } from "@/lib/class-names";

const controlClasses =
  "w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none";

export function Label(props: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}): React.ReactElement {
  return (
    <label htmlFor={props.htmlFor} className="mb-1.5 block text-xs font-medium text-ink-muted">
      {props.children}
      {props.hint ? <span className="ml-1 font-normal text-ink-faint">{props.hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement {
  return <input {...props} className={classNames(controlClasses, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.ReactElement {
  return <textarea rows={2} {...props} className={classNames(controlClasses, "resize-y", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>): React.ReactElement {
  return <select {...props} className={classNames(controlClasses, "appearance-none", props.className)} />;
}
