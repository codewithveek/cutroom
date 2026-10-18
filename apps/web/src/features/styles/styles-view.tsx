"use client";

import { presets } from "@cutroom/presets";
import { lookTokensById } from "@cutroom/video-kit";
import Link from "next/link";
import type React from "react";
import { PageFrame, PageHeader } from "@/components/page-header";
import { RatioIcon } from "@/components/ui/ratio-icon";
import { lookIds } from "@/features/video-preview/look-preview";
import { LookCard } from "./look-card";

/** The four looks (hover to play) and the seven presets that combine a type, a look and ratios. */
export function StylesView(): React.ReactElement {
  return (
    <PageFrame>
      <PageHeader
        title="Styles"
        description="Looks are typed token sets: colour, type, motion and pacing. Your repository's brand accent replaces the look's accent when it has one."
      />
      <section aria-labelledby="looks-heading" className="space-y-3">
        <h2 id="looks-heading" className="text-sm font-semibold">
          Looks
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {lookIds.map((look) => (
            <li key={look}>
              <LookCard look={look} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="presets-heading" className="space-y-3">
        <h2 id="presets-heading" className="text-sm font-semibold">
          Presets
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(presets).map((preset) => (
            <li key={preset.id} className="flex flex-col rounded-2xl border border-line bg-panel p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{preset.label}</h3>
                <span className="ml-auto flex gap-0.5 text-ink-faint">
                  {preset.ratios.map((ratio) => (
                    <RatioIcon key={ratio} ratio={ratio} className="size-4" />
                  ))}
                </span>
              </div>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-muted">{preset.description}</p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-faint">
                <span className="font-mono">
                  {lookTokensById[preset.look].label} · {preset.targetSeconds}s · {preset.ratios.join(" ")}
                </span>
                <Link
                  href={`/new?preset=${preset.id}`}
                  className="ml-auto rounded-lg bg-panel-raised px-2.5 py-1 text-xs font-medium text-ink hover:bg-panel-hover"
                >
                  Use
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}
