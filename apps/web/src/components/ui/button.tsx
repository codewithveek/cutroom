import type React from "react";
import { classNames } from "@/lib/class-names";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:bg-accent/40",
  secondary:
    "border border-line-strong bg-panel-raised text-ink hover:border-ink-faint disabled:text-ink-faint",
  ghost: "text-ink-muted hover:bg-panel-raised hover:text-ink",
  danger: "bg-unsupported/15 text-unsupported hover:bg-unsupported/25",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      className={classNames(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
}
