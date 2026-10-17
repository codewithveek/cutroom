import type { ClaimResult } from "@cutroom/scene-spec";

export interface FixtureEvalResult {
  fixtureId: string;
  modelId: string;
  ok: boolean;
  failedStep?: string;
  error?: string;
  files?: number;
  brief?: {
    features: number;
    evidenceTotal: number;
    evidenceValid: number;
    attempts: number;
    seconds: number;
    tokens: number;
  };
  storyboard?: { scenes: number; attempts: number; firstTryValid: boolean; seconds: number; tokens: number };
  audit?: {
    claims: number;
    supported: number;
    weak: number;
    unsupported: number;
    judged: number;
    seconds: number;
    tokens: number;
  };
  totalSeconds: number;
}

export function verdictCounts(results: ReadonlyArray<ClaimResult>) {
  const count = (verdict: ClaimResult["verdict"]) =>
    results.filter((result) => result.verdict === verdict).length;
  return {
    claims: results.length,
    supported: count("supported"),
    weak: count("weak"),
    unsupported: count("unsupported"),
  };
}

function percent(numerator: number, denominator: number): string {
  return denominator === 0 ? "–" : `${Math.round((100 * numerator) / denominator)}%`;
}

function mean(values: ReadonlyArray<number>): string {
  return values.length === 0
    ? "–"
    : (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
}

/** The table for the post (FR-EV-3): one row per fixture, then a summary row. */
export function formatResultsTable(results: ReadonlyArray<FixtureEvalResult>): string {
  const header =
    "| Fixture | Model | Evidence valid | Storyboard 1st try | Repair attempts | Claims S / W / U | Brief s | Plan s | Audit s | Total s |";
  const divider = "|---|---|---|---|---|---|---|---|---|---|";
  const rows = results.map((result) => {
    if (!result.ok)
      return `| ${result.fixtureId} | ${result.modelId} | failed at ${result.failedStep}: ${result.error?.slice(0, 60)} | | | | | | | ${result.totalSeconds.toFixed(0)} |`;
    const brief = result.brief;
    const storyboard = result.storyboard;
    const audit = result.audit;
    return [
      "",
      result.fixtureId,
      result.modelId,
      brief ? percent(brief.evidenceValid, brief.evidenceTotal) : "–",
      storyboard ? (storyboard.firstTryValid ? "yes" : "no") : "–",
      storyboard ? String(storyboard.attempts - 1) : "–",
      audit ? `${audit.supported} / ${audit.weak} / ${audit.unsupported}` : "–",
      brief ? brief.seconds.toFixed(0) : "–",
      storyboard ? storyboard.seconds.toFixed(0) : "–",
      audit ? audit.seconds.toFixed(0) : "–",
      result.totalSeconds.toFixed(0),
      "",
    ]
      .join(" | ")
      .trim();
  });
  const succeeded = results.filter((result) => result.ok);
  const evidenceValid = succeeded.reduce((sum, result) => sum + (result.brief?.evidenceValid ?? 0), 0);
  const evidenceTotal = succeeded.reduce((sum, result) => sum + (result.brief?.evidenceTotal ?? 0), 0);
  const firstTry = succeeded.filter((result) => result.storyboard?.firstTryValid).length;
  const summary = `| **All** | | ${percent(evidenceValid, evidenceTotal)} | ${percent(firstTry, succeeded.length)} | ${mean(succeeded.map((result) => (result.storyboard?.attempts ?? 1) - 1))} | | | | | |`;
  return [header, divider, ...rows, summary].join("\n");
}
