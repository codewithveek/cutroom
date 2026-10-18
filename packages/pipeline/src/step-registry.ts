import { analyzeStep } from "./steps/analyze-step";
import { auditStep } from "./steps/audit-step";
import { buildRenderJobStep } from "./steps/build-render-job-step";
import { captureStep } from "./steps/capture-step";
// from "./steps/build-render-job-step";
import { finalizeStep } from "./steps/finalize-step";
import { ingestStep } from "./steps/ingest-step";
import { planStep } from "./steps/plan-step";
import { qualityCheckStep } from "./steps/quality-check-step";
import { renderStep } from "./steps/render-step";
import { reviewStep } from "./steps/review-step";
import type { StepDefinition } from "./steps/step-context";
import { voiceStep } from "./steps/voice-step";

/** Pipeline order (PRD §8.4). Each step is idempotent: it checks for its persisted output first. */
export const pipelineSteps: ReadonlyArray<StepDefinition> = [
  { step: "ingest-repository", status: "ingesting", run: ingestStep },
  { step: "capture-screens", status: "ingesting", run: captureStep },
  { step: "analyze-product", status: "analyzing", run: analyzeStep },
  { step: "plan-storyboard", status: "planning", run: planStep },
  { step: "audit-claims", status: "auditing", run: auditStep },
  { step: "review", status: "auditing", run: reviewStep },
  { step: "synthesize-voice", status: "voicing", run: voiceStep },
  { step: "build-render-job", status: "voicing", run: buildRenderJobStep },
  { step: "render", status: "rendering", run: renderStep },
  { step: "quality-check", status: "finalizing", run: qualityCheckStep },
  { step: "finalize-deliverables", status: "finalizing", run: finalizeStep },
];
