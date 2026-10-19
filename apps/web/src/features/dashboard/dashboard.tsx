"use client";

import type React from "react";
import { SystemCheckCard } from "@/components/system-check-card";
import { useRuns } from "@/lib/use-runs";
import { useSystemStatus } from "@/lib/use-system-status";
import { HeroMark } from "./hero-mark";
import { PromptComposer } from "./prompt-composer";
import { RecentVideos } from "./recent-videos";

function greetingFor(hasVideos: boolean): { title: string; subtitle: string } {
  return hasVideos
    ? {
        title: "What should we film next?",
        subtitle:
          "Point Cutroom at a repository. It writes the script, checks every claim against the code and renders the cut.",
      }
    : {
        title: "Turn your code into a product video.",
        subtitle:
          "Point Cutroom at a repository. It reads the code, writes the script, checks every claim and renders the video, on open models.",
      };
}

/** Home: one composer to start a video, then what is in flight, then whether the toolchain is ready. */
export function Dashboard(): React.ReactElement {
  const { runs } = useRuns();
  const { status, error } = useSystemStatus();
  const greeting = greetingFor((runs?.length ?? 0) > 0);
  const missing = status?.checks.filter((check) => check.state === "missing") ?? [];
  return (
    <div className="relative min-h-full overflow-hidden rounded-2xl bg-panel/40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-96 w-[56rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-5xl space-y-10 px-4 pt-[6vh] pb-12 sm:space-y-14 sm:px-6 sm:pt-[10vh] sm:pb-16">
        <header className="space-y-5 text-center">
          <HeroMark />
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-4xl">{greeting.title}</h1>
          <p className="mx-auto max-w-xl text-balance text-sm leading-relaxed text-ink-muted">
            {greeting.subtitle}
          </p>
        </header>
        <div className="mx-auto max-w-3xl">
          <PromptComposer status={status} />
        </div>
        {error ? (
          <p className="mx-auto max-w-3xl rounded-xl border border-unsupported/40 bg-unsupported/10 p-3 text-sm text-unsupported">
            The Cutroom API is not answering ({error}). Start it with{" "}
            <code className="font-mono">pnpm dev</code>.
          </p>
        ) : null}
        <RecentVideos runs={runs} />
        {/* The demo has no toolchain to check: it only plays back what was rendered beforehand. */}
        {status && !status.demoMode ? (
          <section aria-labelledby="setup-heading">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="setup-heading" className="text-sm font-semibold">
                Your setup
              </h2>
              <span className="text-xs text-ink-faint">
                {missing.length === 0
                  ? "Everything a Local run needs is here."
                  : `${missing.length} to fix before a Local run`}
              </span>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {status.checks.map((check) => (
                <li key={check.id}>
                  <SystemCheckCard check={check} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
