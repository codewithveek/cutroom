import type { CSSProperties, ReactNode } from "react";
import React from "react";
import { AbsoluteFill } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";

export interface BlockFrameProps {
  children: ReactNode;
  align?: "center" | "start";
  style?: CSSProperties;
}

/** Safe-area padding shared by every block (9:16 keeps the bottom 20% clear). */
export function BlockFrame(props: BlockFrameProps): React.ReactElement {
  const shape = useFrameShape();
  return (
    <AbsoluteFill
      style={{
        paddingLeft: shape.paddingX,
        paddingRight: shape.paddingX,
        paddingTop: shape.paddingTop,
        paddingBottom: shape.paddingBottom,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: props.align === "start" ? "flex-start" : "center",
        textAlign: props.align === "start" ? "left" : "center",
        ...props.style,
      }}
    >
      {props.children}
    </AbsoluteFill>
  );
}
