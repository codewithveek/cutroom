"use client";

import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { classNames } from "@/lib/class-names";

export interface MenuItem {
  id: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
}

export interface MenuProps {
  label: string;
  trigger: React.ReactNode;
  items: ReadonlyArray<MenuItem>;
  align?: "start" | "end";
  triggerClassName?: string;
  heading?: string;
}

/** A button that opens a list of actions; Escape or a click outside closes it. */
export function Menu(props: MenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !containerRef.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={props.label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className={props.triggerClassName}
      >
        {props.trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={props.label}
          className={classNames(
            "absolute top-full z-50 mt-1.5 min-w-48 rounded-xl border border-line-strong bg-panel-raised p-1 shadow-2xl",
            props.align === "end" ? "right-0" : "left-0",
          )}
        >
          {props.heading ? (
            <div className="px-2.5 pt-1.5 pb-1 text-[11px] text-ink-faint">{props.heading}</div>
          ) : null}
          {props.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={classNames(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-40",
                item.danger ? "text-unsupported" : "text-ink",
              )}
            >
              {item.Icon ? <item.Icon className="size-4 shrink-0 text-ink-muted" /> : null}
              <span className="flex-1">{item.label}</span>
              {item.hint ? <span className="font-mono text-[10px] text-ink-faint">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
