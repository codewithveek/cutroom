import type React from "react";

const tones = {
  accent: "bg-accent text-on-accent hover:bg-accent-strong",
  neutral: "border border-line-strong bg-panel text-ink hover:bg-panel-hover",
} as const;

export interface ButtonLinkProps {
  href: string;
  tone: keyof typeof tones;
  children: React.ReactNode;
  className?: string;
}

/** A link that looks like the app's buttons; it navigates, so it stays an anchor. */
export function ButtonLink(props: ButtonLinkProps): React.ReactElement {
  return (
    <a
      href={props.href}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors ${tones[props.tone]} ${props.className ?? ""}`}
    >
      {props.children}
    </a>
  );
}
