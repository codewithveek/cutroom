import type { CodeCardScene } from "@cutroom/scene-spec";
import React from "react";
import { useCurrentFrame } from "remotion";
import type { CodeToken } from "../code/highlight-code";
import { useHighlightedCode } from "../code/use-highlighted-code";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { progressBetween } from "../motion/easing";
import { FadeRise } from "../motion/fade-rise";
import { Card, WindowChrome } from "../primitives/card";
import { useResolveByFrame } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

const FIRST_LINE_FRAME = 10;

interface LineRevealOptions {
  lineIndex: number;
  lineCount: number;
  revealWindowFrames: number;
}

function lineRevealStart(options: LineRevealOptions): number {
  const stagger = Math.min(6, options.revealWindowFrames / Math.max(1, options.lineCount));
  return FIRST_LINE_FRAME + options.lineIndex * stagger;
}

/** For `type` reveals: how many characters of the whole excerpt are visible. */
function visibleCharacterCount(frame: number, totalCharacters: number, revealWindowFrames: number): number {
  const progress = progressBetween({
    frame,
    startFrame: FIRST_LINE_FRAME,
    durationFrames: revealWindowFrames,
    easing: (input) => input,
  });
  return Math.floor(progress * totalCharacters);
}

function TokenLine(props: { tokens: CodeToken[]; visibleCharacters: number }): React.ReactElement {
  let remaining = props.visibleCharacters;
  return (
    <>
      {props.tokens.map((token, tokenIndex) => {
        const shown = token.content.slice(0, Math.max(0, remaining));
        remaining -= token.content.length;
        return (
          <span key={tokenIndex} style={{ color: token.color }}>
            {shown}
          </span>
        );
      })}
    </>
  );
}

export function CodeCardBlock(props: { scene: CodeCardScene }): React.ReactElement {
  const { code, filePath, language, lineStart, caption, reveal } = props.scene.props;
  const frame = useCurrentFrame();
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const resolveBy = useResolveByFrame();
  const tokenLines = useHighlightedCode({ code, language, theme: look.codeTheme });
  const revealWindowFrames = Math.max(10, Math.min(resolveBy - FIRST_LINE_FRAME - 10, 90));
  const lineLengths = tokenLines.map((line) => line.reduce((sum, token) => sum + token.content.length, 0));
  const totalCharacters = lineLengths.reduce((sum, length) => sum + length, 0);
  let typedBudget = reveal === "type" ? visibleCharacterCount(frame, totalCharacters, revealWindowFrames) : 0;
  const gutterDigits = String(lineStart + tokenLines.length).length;
  return (
    <BlockFrame>
      <FadeRise startFrame={0} distancePx={50} style={{ width: shape.isStacked ? "100%" : "78%" }}>
        <Card scale={sizes.scale} style={{ background: look.colors.codeBackground, textAlign: "left" }}>
          <WindowChrome title={filePath} scale={sizes.scale} />
          <div
            style={{
              padding: `${28 * sizes.scale}px ${32 * sizes.scale}px`,
              fontFamily: look.fonts.mono.family,
              fontWeight: look.fonts.mono.weight,
              fontSize: sizes.code,
              lineHeight: 1.55,
              fontVariantLigatures: "none",
              whiteSpace: "pre",
              overflow: "hidden",
            }}
          >
            {tokenLines.map((tokens, lineIndex) => {
              const lineProgress =
                reveal === "lines"
                  ? progressBetween({
                      frame,
                      startFrame: lineRevealStart({
                        lineIndex,
                        lineCount: tokenLines.length,
                        revealWindowFrames,
                      }),
                      durationFrames: 14,
                    })
                  : 1;
              const lineLength = lineLengths[lineIndex] ?? 0;
              const visibleCharacters = reveal === "type" ? Math.max(0, typedBudget) : lineLength;
              typedBudget -= lineLength;
              return (
                <div key={lineIndex} style={{ display: "flex", opacity: lineProgress }}>
                  <span
                    style={{
                      color: look.colors.inkMuted,
                      opacity: 0.6,
                      width: `${gutterDigits + 1.5}ch`,
                      flexShrink: 0,
                    }}
                  >
                    {lineStart + lineIndex}
                  </span>
                  <span>
                    <TokenLine tokens={tokens} visibleCharacters={visibleCharacters} />
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </FadeRise>
      {caption ? (
        <FadeRise startFrame={FIRST_LINE_FRAME + 20} style={{ marginTop: 36 * sizes.scale }}>
          <div
            style={{
              fontFamily: look.fonts.body.family,
              fontWeight: 600,
              fontSize: sizes.body,
              color: look.colors.ink,
            }}
          >
            {caption}
          </div>
        </FadeRise>
      ) : null}
    </BlockFrame>
  );
}
