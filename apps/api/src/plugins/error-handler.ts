import { SceneNotFoundError } from "@cutroom/agent";
import { ApprovalBlockedError } from "@cutroom/claim-audit";
import { RunNotFoundError, RunStateError, UnknownVoiceOptionError } from "@cutroom/pipeline";
import { VoiceModelMissingError } from "@cutroom/voice";
import type { FastifyError, FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "validation_failed",
  "unauthorized",
  "not_found",
  "conflict",
  "approval_blocked",
  "internal",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** One error envelope for every endpoint (PRD §8.7). */
export const apiErrorSchema = z.object({
  error: z.object({ code: apiErrorCodeSchema, message: z.string(), details: z.unknown().optional() }),
});

export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly code: ApiErrorCode;
  readonly statusCode: number;

  constructor(options: { code: ApiErrorCode; statusCode: number; message: string }) {
    super(options.message);
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

interface MappedError {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

function mapError(error: FastifyError | Error): MappedError {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      statusCode: 400,
      code: "validation_failed",
      message: "The request does not match the schema",
      details: error.validation,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      statusCode: 400,
      code: "validation_failed",
      message: "The request does not match the schema",
      details: error.issues,
    };
  }
  if (error instanceof ApiError)
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  if (error instanceof VoiceModelMissingError)
    return { statusCode: 409, code: "conflict", message: error.message };
  if (
    error instanceof RunNotFoundError ||
    error instanceof SceneNotFoundError ||
    error instanceof UnknownVoiceOptionError
  ) {
    return { statusCode: 404, code: "not_found", message: error.message };
  }
  if (error instanceof RunStateError) return { statusCode: 409, code: "conflict", message: error.message };
  if (error instanceof ApprovalBlockedError) {
    return {
      statusCode: 409,
      code: "approval_blocked",
      message: error.message,
      details: { claimIds: error.blockingClaims.map((claim) => claim.claimId) },
    };
  }
  return { statusCode: 500, code: "internal", message: "Something went wrong on our side" };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const mapped = mapError(error);
    if (mapped.statusCode >= 500) request.log.error({ err: error }, "request failed");
    void reply.status(mapped.statusCode).send({
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details ? { details: mapped.details } : {}),
      },
    });
  });
  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: { code: "not_found", message: "No such endpoint" } });
  });
}
