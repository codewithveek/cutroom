import type { PipelineStep, RunEvent } from "@cutroom/scene-spec";
import { Check, Circle, Loader2, X } from "lucide-react";
import type React from "react";
import { classNames } from "@/lib/class-names";

const steps: ReadonlyArray<{ step: PipelineStep; label: string }> = [
  { step: "ingest-repository", label: "Read repository" },
  { step: "analyze-product", label: "Product brief" },
  { step: "plan-storyboard", label: "Storyboard" },
  { step: "audit-claims", label: "Claim audit" },
  { step: "review", label: "Your review" },
  { step: "synthesize-voice", label: "Voice" },
  { step: "build-render-job", label: "Render bundle" },
  { step: "render", label: "Render" },
  { step: "quality-check", label: "Quality check" },
  { step: "finalize-deliverables", label: "Delivery note" },
];

type StepState = "pending" | "running" | "done" | "failed" | "waiting";

interface StepSummary {
  state: StepState;
  durationMs?: number;
  tokens?: number;
  detail?: string;
}

function summarise(events: ReadonlyArray<RunEvent>, step: PipelineStep): StepSummary {
  const stepEvents = events.filter((event) => event.step === step);
  const last = stepEvents.at(-1);
  if (!last) return { state: "pending" };
  const finished = stepEvents.findLast((event) => event.kind === "completed" || event.kind === "failed");
  const usage = finished?.payload.usage as { inputTokens?: number; outputTokens?: number } | undefined;
  const durationMs =
    typeof finished?.payload.durationMs === "number" ? finished.payload.durationMs : undefined;
  const tokens = usage ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) : undefined;
  if (last.kind === "failed") return { state: "failed", detail: "failed" };
  if (last.kind === "progress" && last.payload.awaitingReview)
    return { state: "waiting", detail: "Waiting for your approval" };
  if (last.kind === "completed") {
    return {
      state: "done",
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(tokens ? { tokens } : {}),
      ...(last.payload.skipped ? { detail: "cached" } : {}),
    };
  }
  return { state: "running" };
}

const stateIcons: Readonly<Record<StepState, React.ReactElement>> = {
  pending: <Circle className="size-3.5 text-ink-faint" aria-hidden="true" />,
  running: <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden="true" />,
  done: <Check className="size-3.5 text-supported" aria-hidden="true" />,
  failed: <X className="size-3.5 text-unsupported" aria-hidden="true" />,
  waiting: <Circle className="size-3.5 fill-weak text-weak" aria-hidden="true" />,
};

/** A vertical step list with live durations and token counts (PRD §9 screen 2). */
export function RunTimeline(props: { events: ReadonlyArray<RunEvent> }): React.ReactElement {
  return (
    <ol className="space-y-1" aria-label="Pipeline steps">
      {steps.map(({ step, label }) => {
        const summary = summarise(props.events, step);
        return (
          <li
            key={step}
            className={classNames(
              "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm",
              summary.state === "running" && "bg-panel-raised",
            )}
          >
            {stateIcons[summary.state]}
            <span className={summary.state === "pending" ? "text-ink-faint" : "text-ink"}>{label}</span>
            <span className="ml-auto font-mono text-[11px] text-ink-faint">
              {summary.tokens ? `${summary.tokens.toLocaleString()} tok · ` : ""}
              {summary.durationMs !== undefined
                ? `${(summary.durationMs / 1000).toFixed(1)}s`
                : (summary.detail ?? "")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
