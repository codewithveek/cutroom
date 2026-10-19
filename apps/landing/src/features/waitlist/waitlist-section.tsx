import type React from "react";
import { SectionHeading } from "@/features/site/section-heading";
import { WaitlistForm } from "./waitlist-form";

export function WaitlistSection(): React.ReactElement {
  return (
    <section aria-labelledby="waitlist-heading" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="panel relative px-4 py-10 sm:px-10">
        <SectionHeading
          id="waitlist-heading"
          title="Want the hosted version?"
          sub="Cloud rendering, premium voices, team presets."
        />
        <WaitlistForm />
      </div>
    </section>
  );
}
