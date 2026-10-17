import type { LookId, MusicBed, TransitionId } from "@cutroom/scene-spec";

export interface LookFont {
  family: string;
  weight: number;
}

export type LookBackground = "studio-glow" | "paper" | "grid" | "cinematic-glow";

/** A look is data: every block reads these tokens instead of hard-coding style. */
export interface LookTokens {
  id: LookId;
  label: string;
  /** One line shown on the look picker. */
  summary: string;
  isDark: boolean;
  background: LookBackground;
  colors: {
    ground: string;
    ink: string;
    inkMuted: string;
    accent: string;
    alarm: string;
    card: string;
    cardInk: string;
    cardBorder: string;
    codeBackground: string;
  };
  fonts: {
    headline: LookFont;
    body: LookFont;
    number: LookFont;
    mono: LookFont;
  };
  /** Headline size at 1920×1080; frame shapes scale it. */
  headlineSizePx: number;
  numberSizePx: number;
  /** Letter spacing in em. */
  headlineTracking: number;
  eyebrow: "uppercase-accent" | "none";
  cardShadow: string;
  cardRadiusPx: number;
  transitions: {
    default: TransitionId;
    brandMoment: TransitionId;
    detail: TransitionId;
    close: TransitionId;
  };
  crossfadeFrames: number;
  /** Seconds per scene. */
  paceSeconds: readonly [number, number];
  codeTheme: "github-light" | "github-dark-dimmed";
  sound: {
    musicLed: boolean;
    suggestedBed: MusicBed;
  };
}
