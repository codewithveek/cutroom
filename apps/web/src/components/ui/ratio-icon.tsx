import type { AspectRatio } from "@cutroom/scene-spec";
import type React from "react";

const ratioBoxes: Readonly<Record<AspectRatio, { width: number; height: number }>> = {
  "16:9": { width: 18, height: 10 },
  "9:16": { width: 10, height: 18 },
  "1:1": { width: 14, height: 14 },
  "4:5": { width: 12, height: 15 },
};

/** A frame outline in the ratio's proportions. */
export function RatioIcon(props: { ratio: AspectRatio; className?: string }): React.ReactElement {
  const box = ratioBoxes[props.ratio];
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={props.className ?? "size-5"}>
      <rect
        x={(20 - box.width) / 2}
        y={(20 - box.height) / 2}
        width={box.width}
        height={box.height}
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export const allRatios: ReadonlyArray<AspectRatio> = ["16:9", "9:16", "1:1", "4:5"];
