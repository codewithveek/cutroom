import type { RunEvent } from "@cutroom/pipeline";

const stepLabels: Readonly<Record<RunEvent["step"], string>> = {
  "ingest-repository": "Reading the repository",
  "analyze-product": "Writing the product brief",
  "plan-storyboard": "Planning the storyboard",
  "audit-claims": "Auditing every claim against the code",
  review: "Review",
  "synthesize-voice": "Synthesising the voice",
  render: "Rendering",
  "quality-check": "Checking stills and audio",
  "finalize-deliverables": "Writing the delivery note",
};

function formatPayload(payload: Record<string, unknown>): string {
  const interesting = Object.entries(payload).filter(([key]) => !["durationMs", "skipped"].includes(key));
  return interesting
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" ");
}

/** One line per step start/finish; render progress rewrites a single line. */
export function printEvent(event: RunEvent): void {
  const label = stepLabels[event.step];
  if (event.kind === "started") {
    process.stdout.write(`\n▸ ${label}…`);
    return;
  }
  if (event.kind === "progress") {
    if (event.step === "render" && typeof event.payload.progress === "number") {
      process.stdout.write(
        `\r▸ ${label}: ${String(event.payload.ratio)} ${String(event.payload.stage)} ${Math.round(event.payload.progress * 100)}%   `,
      );
    }
    return;
  }
  const seconds =
    typeof event.payload.durationMs === "number"
      ? ` (${(event.payload.durationMs / 1000).toFixed(1)} s)`
      : "";
  const mark = event.kind === "failed" ? "✘" : "✔";
  const details = formatPayload(event.payload);
  process.stdout.write(
    `\r${mark} ${label}${seconds}${event.payload.skipped ? " · cached" : ""}${details ? `  ${details}` : ""}\n`,
  );
}
