import { describe, expect, it } from "vitest";
import type { CapturedScreen, SceneDraft } from "./index";
import { attachScreenView } from "./screen-view";

const capturedScreen: CapturedScreen = {
  id: "screen-1",
  route: "/",
  title: "Shipnote · changelog preview",
  width: 1440,
  height: 900,
  fileName: "screen-1.png",
  targets: [{ text: "Write CHANGELOG.md", box: { x: 288, y: 450, width: 144, height: 45 } }],
  redactions: 0,
};

function screenshotScene(props: { screenId: string; focusText?: string }): SceneDraft {
  return {
    beat: "moment",
    block: "screenshot-window",
    props,
    narration: [{ text: "Write the changelog in one click." }],
  };
}

describe("attachScreenView", () => {
  it("fills the image size and the normalised element box from the capture", () => {
    const scene = attachScreenView({
      scene: screenshotScene({ screenId: "screen-1", focusText: "Write CHANGELOG.md" }),
      screens: [capturedScreen],
    });
    expect(scene.block === "screenshot-window" && scene.props.view).toEqual({
      imageWidth: 1440,
      imageHeight: 900,
      focusBox: { x: 0.2, y: 0.5, width: 0.1, height: 0.05 },
    });
  });

  it("leaves out the focus box when no element was named", () => {
    const scene = attachScreenView({
      scene: screenshotScene({ screenId: "screen-1" }),
      screens: [capturedScreen],
    });
    expect(scene.block === "screenshot-window" && scene.props.view).toEqual({
      imageWidth: 1440,
      imageHeight: 900,
    });
  });
});
