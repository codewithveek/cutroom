import type React from "react";
import { classNames } from "@/lib/class-names";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedControlProps<Value extends string> {
  label: string;
  options: ReadonlyArray<SegmentedOption<Value>>;
  value: Value;
  onChange: (value: Value) => void;
}

export function SegmentedControl<Value extends string>(
  props: SegmentedControlProps<Value>,
): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={props.label}
      className="inline-flex rounded-md border border-line bg-canvas p-0.5"
    >
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === props.value}
          onClick={() => props.onChange(option.value)}
          className={classNames(
            "rounded px-2.5 py-1 font-mono text-xs transition-colors",
            option.value === props.value ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
