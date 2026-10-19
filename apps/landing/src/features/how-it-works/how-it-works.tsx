import type React from "react";
import { SectionHeading } from "@/features/site/section-heading";

const steps = [
  "Reads your repo",
  "Writes a brief with evidence",
  "Writes the storyboard",
  "Audits every claim",
  "Renders 16:9, 9:16, 1:1 and 4:5",
] as const;

export function HowItWorks(): React.ReactElement {
  return (
    <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading id="how-heading" title="How it works" />
      <ol className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step} className="panel flex items-center gap-3 p-4 md:flex-col md:items-start">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-accent/60 font-mono text-sm text-accent">
              {index + 1}
            </span>
            <span className="text-sm font-medium">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
