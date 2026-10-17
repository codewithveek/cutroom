import { describe, expect, it } from "vitest";
import { formatNumber } from "./odometer";

describe("formatNumber", () => {
  it("formats integers, percents and currency", () => {
    expect(formatNumber(12500, "integer")).toBe("12,500");
    expect(formatNumber(99.6, "percent")).toBe("100%");
    expect(formatNumber(-42, "currency")).toBe("-$42");
  });
});
