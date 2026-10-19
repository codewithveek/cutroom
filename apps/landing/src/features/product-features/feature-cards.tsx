import { GitCompare, Laptop, ShieldCheck } from "lucide-react";
import type React from "react";
import { SectionHeading } from "@/features/site/section-heading";

const features = [
  {
    title: "Every release gets a video.",
    body: "Point it at a tag, a release or a commit range, and it makes a video about only what changed.",
    Icon: GitCompare,
  },
  {
    title: "It can't lie about your product.",
    body: "Every headline, label and number is checked against the code before anything renders.",
    Icon: ShieldCheck,
  },
  {
    title: "Your code stays on your machine.",
    body: "Gemma and Kokoro run locally. Nothing is uploaded.",
    Icon: Laptop,
  },
] as const;

export function FeatureCards(): React.ReactElement {
  return (
    <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading id="features-heading" title="Why Cutroom" />
      <ul className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.title} className="panel space-y-3 p-6">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <feature.Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-ink-muted">{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
