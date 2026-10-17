import { describe, expect, it } from "vitest";
import { formatResultsTable } from "./eval-metrics";

describe("formatResultsTable", () => {
  it("summarises evidence validity, first-try validity and repairs", () => {
    const table = formatResultsTable([
      {
        fixtureId: "a",
        modelId: "m",
        ok: true,
        totalSeconds: 10,
        brief: { features: 3, evidenceTotal: 4, evidenceValid: 3, attempts: 1, seconds: 2, tokens: 10 },
        storyboard: { scenes: 7, attempts: 2, firstTryValid: false, seconds: 5, tokens: 20 },
        audit: { claims: 10, supported: 8, weak: 1, unsupported: 1, judged: 6, seconds: 3, tokens: 30 },
      },
      {
        fixtureId: "b",
        modelId: "m",
        ok: false,
        failedStep: "plan-storyboard",
        error: "boom",
        totalSeconds: 4,
      },
    ]);
    expect(table).toContain("| a | m | 75% | no | 1 | 8 / 1 / 1 | 2 | 5 | 3 | 10 |");
    expect(table).toContain("failed at plan-storyboard: boom");
    expect(table).toContain("| **All** | | 75% | 0% | 1.00 |");
  });
});
