import { Clapperboard } from "lucide-react";
import Link from "next/link";
import type React from "react";

export function TopBar(): React.ReactElement {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-6 border-b border-line bg-canvas/90 px-5 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <Clapperboard className="size-5 text-accent" aria-hidden="true" />
        Cutroom
      </Link>
      <nav className="flex items-center gap-4 text-sm text-ink-muted" aria-label="Main">
        <Link href="/" className="hover:text-ink">
          New video
        </Link>
        <Link href="/library" className="hover:text-ink">
          Library
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-muted">
        <span className="size-1.5 rounded-full bg-supported" aria-hidden="true" />
        Open models · Gemma + Kokoro
      </div>
    </header>
  );
}
