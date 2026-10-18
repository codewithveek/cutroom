import { describe, expect, it } from "vitest";
import { isPlausibleSpokenForm, spokenText } from "./narration";

describe("spokenText", () => {
  it("reads the caption when there is no respelling", () => {
    expect(spokenText({ text: "Run the draft command." })).toBe("Run the draft command.");
  });

  it("reads a real respelling of the whole line", () => {
    const line = { text: "Ship with the CLI.", say: "Ship with the C L I." };
    expect(isPlausibleSpokenForm(line)).toBe(true);
    expect(spokenText(line)).toBe("Ship with the C L I.");
  });

  it('ignores a placeholder like "spoken" and reads the caption instead', () => {
    const line = { text: "Introducing Cutroom, a video from your code.", say: "spoken" };
    expect(isPlausibleSpokenForm(line)).toBe(false);
    expect(spokenText(line)).toBe("Introducing Cutroom, a video from your code.");
  });
});

describe("isSourceCodePath", () => {
  it("accepts source files and rejects docs and data", async () => {
    const { isSourceCodePath } = await import("./source-code-path");
    expect(isSourceCodePath("src/group-commits.ts")).toBe(true);
    expect(isSourceCodePath("apps/web/page.tsx")).toBe(true);
    expect(isSourceCodePath("docs/architecture.md")).toBe(false);
    expect(isSourceCodePath("README")).toBe(false);
    expect(isSourceCodePath("pnpm-lock.yaml")).toBe(false);
    expect(isSourceCodePath(".env")).toBe(false);
  });
});
