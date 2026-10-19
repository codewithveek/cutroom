import Image from "next/image";
import type React from "react";
import { SectionHeading } from "@/features/site/section-heading";

/**
 * Stills rendered by Cutroom's own blocks in each look (`pnpm --filter @cutroom/landing render:looks`);
 * the summaries are the looks' own (packages/video-kit/src/looks).
 */
const looks = [
  {
    id: "studio",
    label: "Studio",
    summary: "Near-black with a soft glow; your app floats in a window. Voice first.",
  },
  {
    id: "editorial",
    label: "Editorial",
    summary: "Warm paper, white cards and big numbers. Music-led, magazine pacing.",
  },
  {
    id: "graphic",
    label: "Graphic",
    summary: "Off-white grid, tight type and colour slabs cut on the beat.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    summary: "Near-black, low glow and lots of space. Slow focus pulls.",
  },
] as const;

export function StylesGallery(): React.ReactElement {
  return (
    <section aria-labelledby="styles-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading
        id="styles-heading"
        title="Four looks"
        sub="The same storyboard, rendered in each style."
      />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {looks.map((look) => (
          <li key={look.id} className="panel overflow-hidden">
            <Image
              src={`/media/looks/${look.id}.jpg`}
              alt={`A frame rendered in the ${look.label} look: feature cards for a sample product`}
              width={960}
              height={540}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="block aspect-video h-auto w-full bg-panel-raised object-cover"
            />
            <div className="space-y-1 p-4">
              <h3 className="font-semibold">{look.label}</h3>
              <p className="text-sm text-ink-muted">{look.summary}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
