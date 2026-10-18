import { describe, expect, it } from "vitest";
import { safeNextPath } from "./login-form";

describe("safeNextPath", () => {
  it("keeps same-site paths and drops anything that leaves the site", () => {
    expect(safeNextPath("/runs/01ABC?tab=audio")).toBe("/runs/01ABC?tab=audio");
    expect(safeNextPath("https://evil.example.net")).toBe("/");
    expect(safeNextPath("//evil.example.net/path")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
