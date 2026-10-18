import React from "react";
import { AbsoluteFill } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useLook } from "../looks/look-context";

/** Cutroom's own palette (apps/web globals.css), so the badge reads the same in every look. */
const badgeColors = {
  background: "rgba(11,11,12,0.72)",
  border: "rgba(243,243,244,0.14)",
  ink: "#f3f3f4",
  inkMuted: "#a3a3ab",
  markTile: "#f3f3f4",
  markCut: "#0b0b0c",
  accent: "#ff7a1a",
} as const;

/** The Cutroom mark: a frame with a cut through it (same drawing as the app's logo). */
function CutroomMark(props: { sizePx: number }): React.ReactElement {
  return (
    <svg width={props.sizePx} height={props.sizePx} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="9" fill={badgeColors.markTile} />
      <path
        d="M20.5 11.2a6.4 6.4 0 1 0 0 9.6"
        fill="none"
        stroke={badgeColors.markCut}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="22.4" cy="16" r="2.1" fill={badgeColors.accent} />
    </svg>
  );
}

/** "created with [mark] cutroom", bottom right, above every scene, caption and the thumbnail intro. */
export function CreatedWithWatermark(): React.ReactElement {
  const look = useLook();
  const shape = useFrameShape();
  // Sized from the short side so the badge is the same physical size in every ratio.
  const unit = Math.min(shape.width, shape.height) / 1080;
  const textPx = Math.round(22 * unit);
  const margin = Math.round(32 * unit);
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "flex-end", padding: margin, pointerEvents: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: Math.round(8 * unit),
          padding: `${Math.round(8 * unit)}px ${Math.round(14 * unit)}px`,
          borderRadius: 999,
          background: badgeColors.background,
          border: `${Math.max(1, Math.round(unit))}px solid ${badgeColors.border}`,
          fontFamily: look.fonts.body.family,
          fontSize: textPx,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: badgeColors.inkMuted, fontWeight: 500 }}>created with</span>
        <CutroomMark sizePx={Math.round(textPx * 1.25)} />
        <span style={{ color: badgeColors.ink, fontWeight: 700, letterSpacing: "-0.01em" }}>cutroom</span>
      </div>
    </AbsoluteFill>
  );
}
