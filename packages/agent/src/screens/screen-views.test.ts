import type { CapturedScreen } from "@cutroom/scene-spec";
import { describe, expect, it } from "vitest";
import { shipnoteStoryboardDraft } from "../shipnote-fixture-drafts";
import { missingScreenIssues } from "./screen-views";

const screen: CapturedScreen = {
  id: "screen-1",
  route: "/",
  title: "Shipnote",
  width: 1440,
  height: 900,
  fileName: "screen-1.png",
  targets: [],
  redactions: 0,
};

describe("missingScreenIssues", () => {
  it("asks for a screenshot-window when screens were captured and none is used", () => {
    const issues = missingScreenIssues({
      scenes: shipnoteStoryboardDraft.scenes,
      screens: [screen],
      beatsWithScreens: ["moment"],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("screen-1");
    expect(issues[0]).toContain("moment beat");
  });

  it("is satisfied by one screenshot scene, and silent without screens or a beat that takes one", () => {
    const withScreen = [
      ...shipnoteStoryboardDraft.scenes,
      { beat: "moment", block: "screenshot-window" as const, props: { screenId: "screen-1" }, narration: [] },
    ];
    expect(
      missingScreenIssues({ scenes: withScreen, screens: [screen], beatsWithScreens: ["moment"] }),
    ).toEqual([]);
    expect(
      missingScreenIssues({
        scenes: shipnoteStoryboardDraft.scenes,
        screens: [],
        beatsWithScreens: ["moment"],
      }),
    ).toEqual([]);
    expect(
      missingScreenIssues({
        scenes: shipnoteStoryboardDraft.scenes,
        screens: [screen],
        beatsWithScreens: [],
      }),
    ).toEqual([]);
  });
});
