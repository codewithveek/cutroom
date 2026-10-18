import { describe, expect, it } from "vitest";
import { parseDirection } from "./direction";

describe("parseDirection", () => {
  it("keeps free text as the prompt and reads audience, tone and phrases out of it", () => {
    const direction = parseDirection(
      `for open-source maintainers: keep it punchy, say "one command" and don't say "AI-powered"`,
    );
    expect(direction).toEqual({
      prompt: `for open-source maintainers: keep it punchy, say "one command" and don't say "AI-powered"`,
      audience: "open-source maintainers",
      tone: "confident",
      mustSay: ["one command"],
      mustNotSay: ["AI-powered"],
    });
  });

  it("returns nothing for an empty direction and only the prompt when there is nothing to parse", () => {
    expect(parseDirection("   ")).toEqual({});
    expect(parseDirection("Focus on the draft command")).toEqual({ prompt: "Focus on the draft command" });
  });

  it("reads avoid and never-mention as must-not-say, with curly quotes too", () => {
    expect(parseDirection("avoid “revolutionary”, never mention 'blockchain'").mustNotSay).toEqual([
      "revolutionary",
      "blockchain",
    ]);
  });
});
