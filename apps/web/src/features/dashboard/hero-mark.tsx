import type React from "react";

const BAR_COUNT = 28;

/** A slowly turning ring of bars: a shutter, in the accent colour. Decorative. */
export function HeroMark(): React.ReactElement {
  return (
    <div aria-hidden="true" className="relative mx-auto size-24">
      <div className="absolute inset-0 animate-[spin_30s_linear_infinite]">
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const angle = (360 / BAR_COUNT) * index;
          const long = index % 4 === 0;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative ring
              key={index}
              className="absolute top-1/2 left-1/2 block w-[5px] origin-[50%_0] rounded-full bg-accent"
              style={{
                height: long ? 22 : 16,
                opacity: 0.35 + 0.65 * ((index % 7) / 6),
                transform: `rotate(${angle}deg) translateY(${long ? 20 : 24}px)`,
              }}
            />
          );
        })}
      </div>
      <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full bg-ink" />
    </div>
  );
}
