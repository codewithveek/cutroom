import { NoUserVisibleChangesError } from "@cutroom/agent";
import { ApprovalBlockedError } from "@cutroom/claim-audit";
import {
  EgressBlockedError,
  ModelTransportError,
  PrivacyViolationError,
  StructuredOutputError,
} from "@cutroom/providers";
import { SourceError } from "@cutroom/repo-ingest";
import { VoiceModelMissingError } from "@cutroom/voice";

export const errorCodes = [
  "privacy_violation",
  "egress_blocked",
  "model_output_invalid",
  "model_unavailable",
  "source_unavailable",
  "voice_model_missing",
  "approval_blocked",
  "no_user_visible_changes",
  "step_failed",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export interface DescribedError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** Maps domain errors to the typed codes the API envelope and the UI show. */
export function describeError(error: unknown): DescribedError {
  if (error instanceof PrivacyViolationError) return { code: "privacy_violation", message: error.message };
  if (error instanceof EgressBlockedError) return { code: "egress_blocked", message: error.message };
  if (error instanceof NoUserVisibleChangesError)
    return { code: "no_user_visible_changes", message: error.message };
  if (error instanceof StructuredOutputError)
    return { code: "model_output_invalid", message: error.message, details: { issues: error.issues } };
  if (error instanceof ModelTransportError) return { code: "model_unavailable", message: error.message };
  if (error instanceof SourceError) return { code: "source_unavailable", message: error.message };
  if (error instanceof VoiceModelMissingError) return { code: "voice_model_missing", message: error.message };
  if (error instanceof ApprovalBlockedError) {
    return {
      code: "approval_blocked",
      message: error.message,
      details: { claimIds: error.blockingClaims.map((claim) => claim.claimId) },
    };
  }
  if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
    return {
      code: "model_unavailable",
      message: "Could not reach the model server. Is Ollama running (`ollama serve`)?",
    };
  }
  return { code: "step_failed", message: error instanceof Error ? error.message : String(error) };
}
