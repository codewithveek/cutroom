import { ArrowRight, Terminal } from "lucide-react";
import type React from "react";
import { ButtonLink } from "@/features/site/button-link";
import { siteCopy, siteLinks } from "@/features/site/site-links";

export function HeroSection(): React.ReactElement {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-96 w-[56rem] max-w-[200vw] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl space-y-6 px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-24">
        <h1 id="hero-heading" className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          Point it at a release. Get the launch video.
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-base leading-relaxed text-ink-muted sm:text-lg">
          {siteCopy.heroSub}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={siteLinks.demo} tone="accent">
            Try the demo
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href={siteLinks.repository} tone="neutral">
            <Terminal className="size-4" aria-hidden="true" />
            Run it locally
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
