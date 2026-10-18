"use client";

import { Moon, Sun } from "lucide-react";
import type React from "react";
import { classNames } from "@/lib/class-names";
import { type Theme, useTheme } from "@/lib/theme";

const options: ReadonlyArray<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** Light / Dark pill at the foot of the sidebar; a single round toggle when collapsed. */
export function ThemeSwitch(props: { collapsed: boolean }): React.ReactElement {
  const { theme, setTheme } = useTheme();
  if (props.collapsed) {
    const next = theme === "dark" ? "light" : "dark";
    const Icon = theme === "dark" ? Moon : Sun;
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`Switch to ${next} theme`}
        className="mx-auto grid size-11 place-items-center rounded-full bg-panel-raised text-ink-muted hover:text-ink"
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </button>
    );
  }
  return (
    <fieldset className="grid grid-cols-2 rounded-full bg-panel-raised p-1">
      <legend className="sr-only">Theme</legend>
      {options.map(({ value, label, Icon }) => (
        <label
          key={value}
          className={classNames(
            "flex cursor-pointer items-center justify-center gap-2 rounded-full py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
            theme === value ? "bg-panel-hover font-medium text-ink" : "text-ink-faint hover:text-ink-muted",
          )}
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            className="sr-only"
          />
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
