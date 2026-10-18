"use client";

import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { classNames } from "@/lib/class-names";

export interface DropdownOption<Value extends string> {
  value: Value;
  label: string;
  description?: string;
  Icon?: React.ComponentType<{ className?: string }>;
}

export interface DropdownSelectProps<Value extends string> {
  label: string;
  options: ReadonlyArray<DropdownOption<Value>>;
  value: Value;
  onChange: (value: Value) => void;
  /** Where the menu opens relative to the button. */
  placement?: "above" | "below";
  className?: string;
}

/** A compact pill that opens a listbox; arrows move, Enter picks, Escape closes. */
export function DropdownSelect<Value extends string>(props: DropdownSelectProps<Value>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = props.options.find((option) => option.value === props.value) ?? props.options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => window.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const choose = (value: Value) => {
    props.onChange(value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActiveIndex(
        Math.max(
          0,
          props.options.findIndex((option) => option.value === props.value),
        ),
      );
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + props.options.length) % props.options.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = props.options[activeIndex];
      if (option) choose(option.value);
    }
  };

  const SelectedIcon = selected?.Icon;
  return (
    <div ref={containerRef} className={classNames("relative", props.className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${props.label}: ${selected?.label ?? ""}`}
        onClick={() => setOpen(!open)}
        onKeyDown={onKeyDown}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-panel-hover hover:text-ink"
      >
        {SelectedIcon ? <SelectedIcon className="size-3.5" /> : null}
        {selected?.label}
        <ChevronDown className="size-3 opacity-70" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={props.label}
          className={classNames(
            "absolute left-0 z-50 min-w-56 rounded-xl border border-line-strong bg-panel-raised p-1 shadow-2xl",
            props.placement === "above" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {props.options.map((option, index) => {
            const isSelected = option.value === props.value;
            const OptionIcon = option.Icon;
            return (
              <div
                key={option.value}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.value)}
                onKeyDown={() => undefined}
                className={classNames(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left",
                  index === activeIndex && "bg-panel-hover",
                )}
              >
                {OptionIcon ? <OptionIcon className="mt-0.5 size-4 shrink-0 text-ink-muted" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block text-xs leading-snug text-ink-faint">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
