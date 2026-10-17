import type { TerminalScene } from "@cutroom/scene-spec";
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { FadeRise } from "../motion/fade-rise";
import { WindowChrome } from "../primitives/card";
import { useResolveByFrame } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

const TYPING_START_FRAME = 12;
const OUTPUT_LINE_FRAMES = 4;
const PAUSE_AFTER_COMMAND_FRAMES = 8;
const MAX_CHARS_PER_SECOND = 24;

type TerminalCommand = TerminalScene["props"]["commands"][number];

export interface CommandSchedule {
  typeStart: number;
  typeFrames: number;
  outputStart: number;
}

export interface ScheduleCommandsOptions {
  commands: ReadonlyArray<TerminalCommand>;
  charsPerSecond: number;
  fps: number;
  resolveBy: number;
}

/** Types commands at 12–24 chars/s, speeding up (never past 24) to resolve before the hold. */
export function scheduleCommands(options: ScheduleCommandsOptions): CommandSchedule[] {
  const totalCharacters = options.commands.reduce((sum, command) => sum + command.command.length, 0);
  const fixedFrames = options.commands.reduce(
    (sum, command) => sum + PAUSE_AFTER_COMMAND_FRAMES + command.output.length * OUTPUT_LINE_FRAMES,
    TYPING_START_FRAME,
  );
  const availableTypingFrames = Math.max(1, options.resolveBy - fixedFrames);
  const neededCharsPerSecond = (totalCharacters / availableTypingFrames) * options.fps;
  const charsPerSecond = Math.min(
    MAX_CHARS_PER_SECOND,
    Math.max(options.charsPerSecond, neededCharsPerSecond),
  );
  const schedules: CommandSchedule[] = [];
  let cursor = TYPING_START_FRAME;
  for (const command of options.commands) {
    const typeFrames = Math.ceil((command.command.length / charsPerSecond) * options.fps);
    const outputStart = cursor + typeFrames + PAUSE_AFTER_COMMAND_FRAMES;
    schedules.push({ typeStart: cursor, typeFrames, outputStart });
    cursor = outputStart + command.output.length * OUTPUT_LINE_FRAMES + PAUSE_AFTER_COMMAND_FRAMES;
  }
  return schedules;
}

const terminalColors = { background: "#0e0e12", text: "#e7e7ea", muted: "#8d8d98" };

export function TerminalBlock(props: { scene: TerminalScene }): React.ReactElement {
  const { title, commands, charsPerSecond } = props.scene.props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const resolveBy = useResolveByFrame();
  const schedules = scheduleCommands({ commands, charsPerSecond, fps, resolveBy });
  const caretVisible = Math.floor(frame / 15) % 2 === 0;
  return (
    <BlockFrame>
      <FadeRise startFrame={0} distancePx={50} style={{ width: shape.isStacked ? "100%" : "72%" }}>
        <div
          style={{
            background: terminalColors.background,
            borderRadius: look.cardRadiusPx * sizes.scale,
            boxShadow: look.cardShadow,
            overflow: "hidden",
            textAlign: "left",
          }}
        >
          <WindowChrome title={title ?? "terminal"} scale={sizes.scale} />
          <div
            style={{
              padding: `${30 * sizes.scale}px ${34 * sizes.scale}px`,
              minHeight: 220 * sizes.scale,
              fontFamily: look.fonts.mono.family,
              fontSize: sizes.code,
              lineHeight: 1.6,
              color: terminalColors.text,
              fontVariantLigatures: "none",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {commands.map((command, commandIndex) => {
              const schedule = schedules[commandIndex];
              if (!schedule || frame < schedule.typeStart) return null;
              const typedCharacters = Math.floor(
                ((frame - schedule.typeStart) / schedule.typeFrames) * command.command.length,
              );
              const isTyping = frame < schedule.typeStart + schedule.typeFrames;
              return (
                <div key={commandIndex}>
                  <div>
                    <span style={{ color: look.colors.accent }}>$ </span>
                    {command.command.slice(0, Math.min(command.command.length, typedCharacters))}
                    {isTyping && caretVisible ? <span style={{ opacity: 0.8 }}>▍</span> : null}
                  </div>
                  {command.output.map((outputLine, outputIndex) =>
                    frame >= schedule.outputStart + outputIndex * OUTPUT_LINE_FRAMES ? (
                      <div key={outputIndex} style={{ color: terminalColors.muted }}>
                        {outputLine}
                      </div>
                    ) : null,
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </FadeRise>
    </BlockFrame>
  );
}
