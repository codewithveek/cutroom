import type { KineticHeadlineScene } from "@cutroom/scene-spec";
import React from "react";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { countRisingWords, RisingText, WORD_STAGGER_FRAMES } from "../motion/rising-text";
import { useResolveByFrame, useSceneContext } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

const DEFAULT_LINE_GAP_FRAMES = 14;

/**
 * Each headline line lands with its narration line when one exists (FR-VO-6),
 * but always early enough to resolve before the hold.
 */
function lineStartFrames(
  lines: ReadonlyArray<string>,
  narrationStarts: ReadonlyArray<number>,
  resolveBy: number,
): number[] {
  return lines.map((line, lineIndex) => {
    const preferredStart = narrationStarts[lineIndex] ?? lineIndex * DEFAULT_LINE_GAP_FRAMES;
    const latestStart = resolveBy - countRisingWords(line) * WORD_STAGGER_FRAMES - 16;
    return Math.max(0, Math.min(preferredStart, latestStart));
  });
}

export function KineticHeadlineBlock(props: { scene: KineticHeadlineScene }): React.ReactElement {
  const { lines, tone } = props.scene.props;
  const look = useLook();
  const sizes = useTypeSizes();
  const { timing } = useSceneContext();
  const resolveBy = useResolveByFrame();
  const narrationStarts = timing.lines.map((lineTiming) => lineTiming.fromFrame);
  const startFrames = lineStartFrames(lines, narrationStarts, resolveBy);
  const starColor =
    tone === "problem" ? look.colors.alarm : tone === "promise" ? look.colors.accent : look.colors.accent;
  const align = look.id === "graphic" ? "start" : "center";
  return (
    <BlockFrame align={align}>
      <div
        style={{
          fontFamily: look.fonts.headline.family,
          fontWeight: look.fonts.headline.weight,
          fontSize: sizes.headline,
          letterSpacing: `${look.headlineTracking}em`,
          lineHeight: 1.08,
          color: look.colors.ink,
          display: "flex",
          flexDirection: "column",
          gap: sizes.headline * 0.12,
        }}
      >
        {lines.map((line, lineIndex) => (
          <div key={line}>
            <RisingText text={line} startFrame={startFrames[lineIndex] ?? 0} starColor={starColor} />
          </div>
        ))}
      </div>
    </BlockFrame>
  );
}
