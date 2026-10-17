import React from "react";
import { Img } from "remotion";
import { useLook } from "../looks/look-context";

export interface BrandMarkProps {
  name: string;
  sizePx: number;
  logoUrl?: string | undefined;
}

/** The product's logo when one was found, otherwise a monogram tile in the accent. */
export function BrandMark(props: BrandMarkProps): React.ReactElement {
  const look = useLook();
  if (props.logoUrl) {
    return (
      <Img
        src={props.logoUrl}
        style={{
          width: props.sizePx,
          height: props.sizePx,
          objectFit: "contain",
          borderRadius: props.sizePx * 0.22,
        }}
      />
    );
  }
  const monogram = props.name.trim().charAt(0).toUpperCase() || "•";
  return (
    <div
      style={{
        width: props.sizePx,
        height: props.sizePx,
        borderRadius: props.sizePx * 0.24,
        background: look.colors.accent,
        color: look.isDark ? look.colors.ground : "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: look.fonts.headline.family,
        fontWeight: 800,
        fontSize: props.sizePx * 0.56,
        letterSpacing: "-0.04em",
      }}
    >
      {monogram}
    </div>
  );
}
