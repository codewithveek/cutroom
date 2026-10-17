import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useLook } from "../looks/look-context";
import type { LookTokens } from "../looks/look-tokens";

function hexToRgba(hexColor: string, alpha: number): string {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function StudioGlow(props: { look: LookTokens; gridSizePx: number }): React.ReactElement {
  const frame = useCurrentFrame();
  const drift = (frame * 0.25) % props.gridSizePx;
  return (
    <>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: `${props.gridSizePx}px ${props.gridSizePx}px`,
          backgroundPosition: `${drift}px ${drift}px`,
          maskImage: "radial-gradient(ellipse at 50% 60%, black 20%, transparent 75%)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% 110%, ${hexToRgba(props.look.colors.accent, 0.35)}, transparent 70%)`,
        }}
      />
    </>
  );
}

function PaperVignette(): React.ReactElement {
  return (
    <AbsoluteFill
      style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(92,72,40,0.14) 100%)" }}
    />
  );
}

function FadingGrid(props: { gridSizePx: number }): React.ReactElement {
  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.07) 1px, transparent 1px)",
        backgroundSize: `${props.gridSizePx}px ${props.gridSizePx}px`,
        backgroundPosition: "center center",
        maskImage: "radial-gradient(circle at 50% 50%, black 0%, transparent 70%)",
      }}
    />
  );
}

function CinematicGlow(props: { look: LookTokens }): React.ReactElement {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${hexToRgba(props.look.colors.accent, 0.12)}, transparent 70%)`,
      }}
    />
  );
}

/** The ground every scene sits on; one per look. */
export function LookBackground(): React.ReactElement {
  const look = useLook();
  const shape = useFrameShape();
  const gridSizePx = Math.round(64 * shape.typeScale);
  return (
    <AbsoluteFill style={{ background: look.colors.ground }}>
      {look.background === "studio-glow" ? <StudioGlow look={look} gridSizePx={gridSizePx} /> : null}
      {look.background === "paper" ? <PaperVignette /> : null}
      {look.background === "grid" ? <FadingGrid gridSizePx={gridSizePx} /> : null}
      {look.background === "cinematic-glow" ? <CinematicGlow look={look} /> : null}
    </AbsoluteFill>
  );
}

export { hexToRgba };
