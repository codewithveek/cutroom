import type { CSSProperties, ReactNode } from "react";
import React from "react";
import { useLook } from "../looks/look-context";

export interface CardProps {
  children: ReactNode;
  scale: number;
  style?: CSSProperties;
}

/** UI sits on cards: white with warm shadow (Editorial), outlined (Graphic), floating (dark looks). */
export function Card(props: CardProps): React.ReactElement {
  const look = useLook();
  return (
    <div
      style={{
        background: look.colors.card,
        color: look.colors.cardInk,
        borderRadius: look.cardRadiusPx * props.scale,
        boxShadow: look.cardShadow,
        border: `1px solid ${look.colors.cardBorder}`,
        overflow: "hidden",
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}

export interface WindowChromeProps {
  title: string;
  scale: number;
}

/** Three dots and a title: the top of an app or terminal window. */
export function WindowChrome(props: WindowChromeProps): React.ReactElement {
  const look = useLook();
  const dotSize = 14 * props.scale;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10 * props.scale,
        padding: `${16 * props.scale}px ${22 * props.scale}px`,
        borderBottom: `1px solid ${look.colors.cardBorder}`,
      }}
    >
      {["#ff5f57", "#febc2e", "#28c840"].map((dotColor) => (
        <div
          key={dotColor}
          style={{ width: dotSize, height: dotSize, borderRadius: dotSize, background: dotColor }}
        />
      ))}
      <div
        style={{
          marginLeft: 12 * props.scale,
          fontFamily: look.fonts.mono.family,
          fontSize: 22 * props.scale,
          color: look.colors.inkMuted,
          fontVariantLigatures: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {props.title}
      </div>
    </div>
  );
}
