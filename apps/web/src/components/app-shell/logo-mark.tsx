import type React from "react";

/** The Cutroom mark: a frame with a cut through it. */
export function LogoMark(props: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={props.className}>
      <rect x="2" y="2" width="28" height="28" rx="9" className="fill-ink" />
      <path
        d="M20.5 11.2a6.4 6.4 0 1 0 0 9.6"
        fill="none"
        strokeWidth="3.2"
        strokeLinecap="round"
        className="stroke-canvas"
      />
      <circle cx="22.4" cy="16" r="2.1" className="fill-accent" />
    </svg>
  );
}
