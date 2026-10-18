import { StructuredOutputError } from "@cutroom/providers";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerErrorHandler } from "./error-handler";

describe("error handler", () => {
  it("answers a model that never produced valid output with model_output_invalid, not internal", async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.get("/re-audit", async () => {
      throw new StructuredOutputError({
        operation: "audit-claims",
        issues: ["verdicts: missing claimId scene-1:props.cta"],
        attempts: 3,
      });
    });
    const response = await app.inject({ method: "GET", url: "/re-audit" });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: {
        code: "model_output_invalid",
        message: "audit-claims: model output still invalid after 3 attempts",
        details: { issues: ["verdicts: missing claimId scene-1:props.cta"] },
      },
    });
  });
});
