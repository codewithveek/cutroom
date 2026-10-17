import { describe, expect, it } from "vitest";
import { getAtPath, moveItem, setAtPath } from "./edit-paths";

describe("edit paths", () => {
  const scene = { props: { lines: ["a", "b"], cards: [{ title: "x" }] }, narration: [{ text: "hi" }] };

  it("reads and writes nested values without mutating", () => {
    expect(getAtPath(scene, "props.lines.1")).toBe("b");
    const updated = setAtPath(scene, "props.cards.0.title", "y");
    expect(updated.props.cards[0]?.title).toBe("y");
    expect(scene.props.cards[0]?.title).toBe("x");
    expect(setAtPath(scene, "narration.0.text", "hello").narration[0]?.text).toBe("hello");
  });

  it("moves items within bounds", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
