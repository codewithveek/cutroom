import { z } from "zod";
import { sceneBaseShape } from "./scene-base";

export const terminalCommandSchema = z.object({
  command: z.string().min(1).max(80),
  output: z.array(z.string().max(80)).max(6).default([]),
});

export const terminalPropsSchema = z.object({
  title: z.string().max(40).optional(),
  commands: z.array(terminalCommandSchema).min(1).max(3),
  /** Typing speed, 12–24 characters per second. */
  charsPerSecond: z.number().min(12).max(24).default(18),
});

export const terminalSceneSchema = z.object({
  ...sceneBaseShape,
  block: z.literal("terminal"),
  props: terminalPropsSchema,
});
export type TerminalScene = z.infer<typeof terminalSceneSchema>;
