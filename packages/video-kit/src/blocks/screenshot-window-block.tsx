import { type ScreenshotWindowScene, screenshotAssetKey } from "@cutroom/scene-spec";
import React from "react";
import { Img, useCurrentFrame } from "remotion";
import { useFrameShape } from "../frame-shape/use-frame-shape";
import { useTypeSizes } from "../frame-shape/use-type-sizes";
import { useLook } from "../looks/look-context";
import { easeInOut, progressBetween } from "../motion/easing";
import { FadeRise } from "../motion/fade-rise";
import { Card, WindowChrome } from "../primitives/card";
import { useSceneContext } from "../scene-context/scene-context";
import { BlockFrame } from "./block-frame";

const CAMERA_START_FRAME = 14;
const CAMERA_FRAMES = 42;
const CURSOR_START_FRAME = 10;
const CURSOR_FRAMES = 40;
const CLICK_FRAME = CURSOR_START_FRAME + CURSOR_FRAMES + 2;
const MAX_ZOOM = 2.2;
/** Before a capture exists (previews of templates), the window keeps a laptop screen's shape. */
const DEFAULT_ASPECT = 1440 / 900;

type FocusBox = NonNullable<NonNullable<ScreenshotWindowScene["props"]["view"]>["focusBox"]>;

/** Zoom so the element fills about a third of the window, centred, never past the image edges. */
export function cameraFor(focus: FocusBox): { scale: number; originX: number; originY: number } {
  const scale = Math.min(MAX_ZOOM, Math.max(1, 0.34 / Math.max(focus.width, focus.height * 0.6)));
  return { scale, originX: focus.x + focus.width / 2, originY: focus.y + focus.height / 2 };
}

function Cursor(props: { focus: FocusBox; sizePx: number }): React.ReactElement {
  const frame = useCurrentFrame();
  const travel = progressBetween({
    frame,
    startFrame: CURSOR_START_FRAME,
    durationFrames: CURSOR_FRAMES,
    easing: easeInOut,
  });
  const click = progressBetween({ frame, startFrame: CLICK_FRAME, durationFrames: 14 });
  const targetX = props.focus.x + props.focus.width / 2;
  const targetY = props.focus.y + props.focus.height / 2;
  const left = (0.92 + (targetX - 0.92) * travel) * 100;
  const top = (0.9 + (targetY - 0.9) * travel) * 100;
  return (
    <div style={{ position: "absolute", left: `${left}%`, top: `${top}%`, pointerEvents: "none" }}>
      {click > 0 && click < 1 ? (
        <div
          style={{
            position: "absolute",
            left: -props.sizePx,
            top: -props.sizePx,
            width: props.sizePx * 2,
            height: props.sizePx * 2,
            borderRadius: "50%",
            border: `${Math.max(2, props.sizePx * 0.08)}px solid rgba(255,255,255,0.9)`,
            opacity: 1 - click,
            transform: `scale(${0.4 + click})`,
          }}
        />
      ) : null}
      <svg
        width={props.sizePx}
        height={props.sizePx}
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ display: "block", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.45))" }}
      >
        <path
          d="M4 2l15 10.5-6.6 1.3 3.9 7.4-2.8 1.5-3.9-7.4L4 19.5z"
          fill="#ffffff"
          stroke="#111111"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}

/** A captured screen in an app window: the camera eases to a real element and a cursor clicks it. */
export function ScreenshotWindowBlock(props: { scene: ScreenshotWindowScene }): React.ReactElement {
  const { screenId, caption, view } = props.scene.props;
  const look = useLook();
  const shape = useFrameShape();
  const sizes = useTypeSizes();
  const { assetUrls } = useSceneContext();
  const frame = useCurrentFrame();
  const imageUrl = assetUrls[screenshotAssetKey(screenId)];
  const aspect = view ? view.imageWidth / view.imageHeight : DEFAULT_ASPECT;
  const windowWidth = shape.width * (shape.layout === "wide" ? 0.74 : 0.9);
  const focus = view?.focusBox;
  const camera = focus ? cameraFor(focus) : undefined;
  const zoom = camera
    ? 1 +
      (camera.scale - 1) *
        progressBetween({
          frame,
          startFrame: CAMERA_START_FRAME,
          durationFrames: CAMERA_FRAMES,
          easing: easeInOut,
        })
    : 1;
  return (
    <BlockFrame>
      <FadeRise startFrame={0} distancePx={50} style={{ width: windowWidth }}>
        <Card scale={sizes.scale} style={{ width: "100%" }}>
          <WindowChrome title={screenId} scale={sizes.scale} />
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: `${aspect}`,
              overflow: "hidden",
              background: look.colors.codeBackground,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                transformOrigin: camera ? `${camera.originX * 100}% ${camera.originY * 100}%` : "50% 50%",
                transform: `scale(${zoom})`,
              }}
            >
              {imageUrl ? (
                <Img
                  src={imageUrl}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: look.fonts.mono.family,
                    fontSize: sizes.small,
                    color: look.colors.inkMuted,
                  }}
                >
                  {screenId} is captured when the run starts
                </div>
              )}
              {focus ? (
                <Cursor focus={focus} sizePx={Math.round((34 * sizes.scale) / Math.max(1, zoom))} />
              ) : null}
            </div>
          </div>
        </Card>
      </FadeRise>
      {caption ? (
        <FadeRise
          startFrame={CAMERA_START_FRAME + 10}
          distancePx={20}
          style={{ marginTop: 36 * sizes.scale }}
        >
          <div
            style={{
              fontFamily: look.fonts.headline.family,
              fontWeight: look.fonts.headline.weight,
              fontSize: sizes.body,
              color: look.colors.ink,
              textAlign: "center",
            }}
          >
            {caption}
          </div>
        </FadeRise>
      ) : null}
    </BlockFrame>
  );
}
