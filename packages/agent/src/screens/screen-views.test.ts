import type { CapturedScreen, SceneDraft } from "@cutroom/scene-spec";
import { describe, expect, it } from "vitest";
import { attachScreenView, describeScreens, screenIssues } from "./screen-views";

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

describe("describeScreens", () => {
  it("lists each screen with the element texts the planner may focus", () => {
    const description = describeScreens([capturedScreen]);
    expect(description).toContain("screen-1");
    expect(description).toContain('"Write CHANGELOG.md"');
  });

  it("tells the planner not to use the block when nothing was captured", () => {
    expect(describeScreens([])).toContain("do not use screenshot-window");
  });
});

describe("screenIssues", () => {
  it("accepts a captured screen and one of its real elements", () => {
    const scenes = [screenshotScene({ screenId: "screen-1", focusText: "Write CHANGELOG.md" })];
    expect(screenIssues({ scenes, screens: [capturedScreen] })).toEqual([]);
  });

  it("rejects a screen that was not captured", () => {
    const scenes = [screenshotScene({ screenId: "screen-4" })];
    const [issue] = screenIssues({ scenes, screens: [capturedScreen] });
    expect(issue).toContain("scenes.0.props.screenId");
  });

  it("rejects focus text that is not on the screen, so the camera never points at invented UI", () => {
    const scenes = [screenshotScene({ screenId: "screen-1", focusText: "Publish to Slack" })];
    const [issue] = screenIssues({ scenes, screens: [capturedScreen] });
    expect(issue).toContain("scenes.0.props.focusText");
  });
});

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
