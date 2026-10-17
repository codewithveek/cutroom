import type { ClaimResult, ClaimVerdict } from "@cutroom/scene-spec";

const verdictLabel: Readonly<Record<ClaimVerdict, string>> = {
  supported: "✔ supported",
  weak: "~ weak",
  unsupported: "✘ unsupported",
};

function truncate(text: string, width: number): string {
  const singleLine = text.replace(/\s+/g, " ");
  return singleLine.length <= width ? singleLine.padEnd(width) : `${singleLine.slice(0, width - 1)}…`;
}

/** The CLI audit table (FR-CA-5). */
export function formatAuditTable(
  results: ReadonlyArray<ClaimResult>,
  sceneNumberById: ReadonlyMap<string, number>,
): string {
  const header = `${"#".padEnd(3)} ${"verdict".padEnd(14)} ${"claim".padEnd(48)} evidence / suggestion`;
  const rows = results.map((result) => {
    const sceneNumber = String(sceneNumberById.get(result.sceneId) ?? "?").padEnd(3);
    const evidence = result.evidence[0];
    const detail =
      result.verdict === "supported" && evidence
        ? `${evidence.filePath}:${evidence.lineStart}`
        : (result.suggestion ?? result.checks.find((check) => !check.passed)?.detail ?? "");
    return `${sceneNumber} ${verdictLabel[result.verdict].padEnd(14)} ${truncate(result.claimText, 48)} ${detail}`;
  });
  const counts = (["supported", "weak", "unsupported"] as const).map(
    (verdict) => `${results.filter((result) => result.verdict === verdict).length} ${verdict}`,
  );
  return [header, "-".repeat(header.length + 10), ...rows, "", counts.join(" · ")].join("\n");
}
