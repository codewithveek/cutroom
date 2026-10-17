import { describe, expect, it } from "vitest";
import { getAtPath, moveItem, setAtPath } from "./edit-paths";

describe("edit paths", () => {
  const scene = { props: { lines: ["a", "b"], cards: [{ title: "x" }] }, narration: [{ text: "hi" }] };

  it("reads and writes nested values without mutating", () => {
    expect(getAtPath(scene, "props.lines.1")).toBe("b");
    const updated = setAtPath({ value: scene, path: "props.cards.0.title", nextValue: "y" });
    expect(updated.props.cards[0]?.title).toBe("y");
    expect(scene.props.cards[0]?.title).toBe("x");
    expect(setAtPath({ value: scene, path: "narration.0.text", nextValue: "hello" }).narration[0]?.text).toBe(
      "hello",
    );
  });

  it("moves items within bounds", () => {
    expect(moveItem({ items: ["a", "b", "c"], fromIndex: 0, toIndex: 2 })).toEqual(["b", "c", "a"]);
    expect(moveItem({ items: ["a", "b"], fromIndex: 0, toIndex: -1 })).toEqual(["a", "b"]);
  });
});
