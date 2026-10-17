import type React from "react";
import { classNames } from "@/lib/class-names";

export interface RadioCardsProps<Value extends string> {
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: Value; content: React.ReactNode }>;
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
}

/** Native radio inputs styled as cards: keyboard and screen-reader behaviour for free. */
export function RadioCards<Value extends string>(props: RadioCardsProps<Value>): React.ReactElement {
  return (
    <fieldset className={props.className}>
      <legend className="sr-only">{props.legend}</legend>
      {props.options.map((option) => {
        const checked = option.value === props.value;
        return (
          <label
            key={option.value}
            className={classNames(
              "block cursor-pointer rounded-lg border p-4 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
              checked ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-line-strong",
            )}
          >
            <input
              type="radio"
              name={props.name}
              value={option.value}
              checked={checked}
              onChange={() => props.onChange(option.value)}
              className="sr-only"
            />
            {option.content}
          </label>
        );
      })}
    </fieldset>
  );
}
