import type { IconId } from "@cutroom/scene-spec";
import React from "react";

/** Simple 24×24 stroke icons drawn for Cutroom; the model chooses by name. */
const iconPaths: Readonly<Record<IconId, ReadonlyArray<string>>> = {
  bolt: ["M13 2 4 14h7l-1 8 9-12h-7l1-8Z"],
  shield: ["M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z"],
  code: ["m8 7-5 5 5 5", "m16 7 5 5-5 5", "m14 4-4 16"],
  chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  globe: [
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
    "M3 12h18",
    "M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  ],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 7v5l3 2"],
  sparkle: [
    "M12 3v4",
    "M12 17v4",
    "M3 12h4",
    "M17 12h4",
    "m6 6 2.5 2.5",
    "m15.5 15.5 2.5 2.5",
    "m18 6-2.5 2.5",
    "M8.5 15.5 6 18",
  ],
  check: ["m4 12.5 5 5L20 6.5"],
  terminal: ["m5 7 5 5-5 5", "M12 17h7"],
  layers: ["m12 3 9 5-9 5-9-5 9-5Z", "m3 13 9 5 9-5"],
  lock: ["M6 11h12v10H6z", "M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"],
  users: [
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    "M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5",
    "M16 4.3a3.5 3.5 0 0 1 0 6.4",
    "M18 14.8c2 .7 3.2 2.5 3.5 5.2",
  ],
  search: ["M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z", "m15.5 15.5 5 5"],
  rocket: [
    "M12 15c-1.5-1-2.5-2-3-3 1-5 4.5-8.5 11-9-.5 6.5-4 10-8 12Z",
    "M9 12H5l2.5-3.5H11",
    "M12 15v4l3.5-2.5V13",
    "M6 16c-1.5.5-2 2-2 4 2 0 3.5-.5 4-2",
  ],
  plug: ["M9 3v5", "M15 3v5", "M6 8h12v3a6 6 0 0 1-12 0V8Z", "M12 17v4"],
  eye: [
    "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z",
    "M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  ],
};

export interface IconProps {
  icon: IconId;
  sizePx: number;
  color: string;
  strokeWidth?: number;
}

export function Icon(props: IconProps): React.ReactElement {
  return (
    <svg
      width={props.sizePx}
      height={props.sizePx}
      viewBox="0 0 24 24"
      fill="none"
      stroke={props.color}
      strokeWidth={props.strokeWidth ?? 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[props.icon].map((pathData) => (
        <path key={pathData} d={pathData} />
      ))}
    </svg>
  );
}
