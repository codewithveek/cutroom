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
    <fieldset className="inline-flex rounded-md border border-line bg-canvas p-0.5">
      <legend className="sr-only">{props.label}</legend>
      {props.options.map((option) => (
        <label
          key={option.value}
          className={classNames(
            "cursor-pointer rounded px-2.5 py-1 font-mono text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
            option.value === props.value ? "bg-panel-raised text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          <input
            type="radio"
            name={props.label}
            value={option.value}
            checked={option.value === props.value}
            onChange={() => props.onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
