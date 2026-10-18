import { pipelineSteps } from "@cutroom/pipeline";
import { describe, expect, it } from "vitest";
import { stepPolicies, workflowIdForRun } from "./workflow-contracts";

describe("workflow contracts", () => {
  it("lists exactly the pipeline's steps, in the same order", () => {
    expect(stepPolicies.map((policy) => policy.step)).toEqual(
      pipelineSteps.map((definition) => definition.step),
    );
  });

  it("keys a run's workflow by run id so starting twice is idempotent", () => {
    expect(workflowIdForRun("01ABC")).toBe("cutroom-run-01ABC");
  });
});
