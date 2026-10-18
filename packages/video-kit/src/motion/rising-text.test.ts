import { describe, expect, it } from "vitest";
import { countRisingWords, splitWords } from "./rising-text";

const text = (source: string) =>
  splitWords(source).map((word) => word.parts.map((part) => part.text).join(""));

describe("splitWords", () => {
  it("keeps punctuation after a starred phrase on its last word", () => {
    expect(text("Launch videos cost *days*.")).toEqual(["Launch", "videos", "cost", "days."]);
    expect(splitWords("cost *days*.")[1]?.parts).toEqual([
      { text: "days", starred: true },
      { text: ".", starred: false },
    ]);
    expect(text("Most launches *ship without one*.")).toEqual([
      "Most",
      "launches",
      "ship",
      "without",
      "one.",
    ]);
    expect(countRisingWords("*Ship* every week")).toBe(3);
  });

  it("still splits a starred phrase that is followed by a space", () => {
    expect(text("Ship *every* week")).toEqual(["Ship", "every", "week"]);
  });
});
