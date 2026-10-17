import type { TransitionId } from "@cutroom/scene-spec";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill } from "remotion";

export interface CutroomTransitionProps extends Record<string, unknown> {
  transition: TransitionId;
  /** Normalised [x, y] origin for circle and zoom. */
  origin: readonly [number, number];
  /** Colour of the slab that sweeps across in `slab`. */
  slabColor: string;
}

type PresentationComponentProps = TransitionPresentationComponentProps<CutroomTransitionProps>;

interface StyleOptions {
  transition: TransitionId;
  progress: number;
  origin: readonly [number, number];
}

function enteringStyle({ transition, progress, origin }: StyleOptions): React.CSSProperties {
  const originCss = `${origin[0] * 100}% ${origin[1] * 100}%`;
  switch (transition) {
    case "fade":
      return { opacity: progress };
    case "focus":
      return {
        opacity: progress,
        filter: `blur(${(1 - progress) * 18}px)`,
        transform: `scale(${1.05 - 0.05 * progress})`,
      };
    case "circle":
      return { clipPath: `circle(${progress * 150}% at ${originCss})` };
    case "panel":
      return {
        opacity: Math.min(1, progress * 1.6),
        transform: `scale(${0.7 + 0.3 * progress})`,
        borderRadius: `${(1 - progress) * 48}px`,
        overflow: "hidden",
      };
    case "slab":
      return { clipPath: `inset(0 0 0 ${progress < 0.5 ? 100 : (1 - (progress - 0.5) * 2) * 100}%)` };
    case "zoom":
      return { opacity: progress, transform: `scale(${0.6 + 0.4 * progress})`, transformOrigin: originCss };
    case "push":
      return { transform: `translateX(${(1 - progress) * 100}%)` };
    case "cut":
      return { opacity: progress < 0.5 ? 0 : 1 };
  }
}

function exitingStyle({ transition, progress, origin }: StyleOptions): React.CSSProperties {
  const originCss = `${origin[0] * 100}% ${origin[1] * 100}%`;
  switch (transition) {
    case "focus":
      return { filter: `blur(${progress * 12}px)`, opacity: 1 - progress * 0.6 };
    case "panel":
      return { transform: `scale(${1 - 0.06 * progress})`, opacity: 1 - progress * 0.5 };
    case "zoom":
      return { transform: `scale(${1 + 1.4 * progress})`, opacity: 1 - progress, transformOrigin: originCss };
    case "push":
      return { transform: `translateX(${-progress * 100}%)` };
    case "cut":
      return { opacity: progress < 0.5 ? 1 : 0 };
    default:
      return {};
  }
}

/** The colour slab covers the frame on the way in and uncovers the new scene on the way out. */
function SlabOverlay(props: { progress: number; color: string }): React.ReactElement {
  const coverStart = props.progress < 0.5 ? 0 : (props.progress - 0.5) * 2 * 100;
  const coverEnd = props.progress < 0.5 ? props.progress * 2 * 100 : 100;
  return (
    <AbsoluteFill
      style={{
        background: props.color,
        clipPath: `inset(0 ${100 - coverEnd}% 0 ${coverStart}%)`,
      }}
    />
  );
}

function CutroomPresentation(props: PresentationComponentProps): React.ReactElement {
  const { transition, origin, slabColor } = props.passedProps;
  const isEntering = props.presentationDirection === "entering";
  const style = isEntering
    ? enteringStyle({ transition, progress: props.presentationProgress, origin })
    : exitingStyle({ transition, progress: props.presentationProgress, origin });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={style}>{props.children}</AbsoluteFill>
      {isEntering && transition === "slab" ? (
        <SlabOverlay progress={props.presentationProgress} color={slabColor} />
      ) : null}
    </AbsoluteFill>
  );
}

export function cutroomTransition(
  props: CutroomTransitionProps,
): TransitionPresentation<CutroomTransitionProps> {
  return { component: CutroomPresentation, props };
}
