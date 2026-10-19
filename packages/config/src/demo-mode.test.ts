import { describe, expect, it } from "vitest";
import { assertNotDemoMode, DemoModeDisabledError } from "./demo-mode";
import { InvalidConfigError, parseEnv } from "./load-env";

describe("demo mode", () => {
  it("is off by default and parsed from CUTROOM_DEMO_MODE", () => {
    expect(parseEnv({}).CUTROOM_DEMO_MODE).toBe(false);
    expect(parseEnv({ CUTROOM_DEMO_MODE: "true" }).CUTROOM_DEMO_MODE).toBe(true);
  });

  it("refuses to boot with provider secrets set", () => {
    expect(() => parseEnv({ CUTROOM_DEMO_MODE: "true", ELEVENLABS_API_KEY: "secret" })).toThrow(
      InvalidConfigError,
    );
  });

  it("throws DemoModeDisabledError for a guarded capability, and only in demo mode", () => {
    expect(() => assertNotDemoMode(parseEnv({ CUTROOM_DEMO_MODE: "true" }), "Repository ingestion")).toThrow(
      DemoModeDisabledError,
    );
    expect(() => assertNotDemoMode(parseEnv({}), "Repository ingestion")).not.toThrow();
  });
});
