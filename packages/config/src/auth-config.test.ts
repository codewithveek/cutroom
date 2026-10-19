import { describe, expect, it } from "vitest";
import { resolveAuthConfig } from "./auth-config";
import { InvalidConfigError, parseEnv } from "./load-env";

const strong = {
  CUTROOM_ADMIN_EMAIL: "admin@example.com",
  CUTROOM_ADMIN_PASSWORD: "a-long-enough-password",
  CUTROOM_SESSION_SECRET: "x".repeat(48),
};

describe("resolveAuthConfig", () => {
  it("needs no login on a loopback address", () => {
    expect(resolveAuthConfig(parseEnv({}))).toEqual({ mode: "none" });
  });

  it("refuses to run open on a public address, naming the variable to set", () => {
    expect(() => resolveAuthConfig(parseEnv({ API_HOST: "0.0.0.0", CUTROOM_AUTH_MODE: "none" }))).toThrow(
      /CUTROOM_AUTH_MODE/,
    );
    expect(() => resolveAuthConfig(parseEnv({ API_HOST: "0.0.0.0" }))).toThrow(InvalidConfigError);
  });

  it("allows an open public host only in demo mode, where the API is read-only", () => {
    expect(
      resolveAuthConfig(
        parseEnv({ API_HOST: "0.0.0.0", CUTROOM_AUTH_MODE: "none", CUTROOM_DEMO_MODE: "true" }),
      ),
    ).toEqual({ mode: "none" });
    expect(resolveAuthConfig(parseEnv({ API_HOST: "0.0.0.0", CUTROOM_DEMO_MODE: "true" }))).toEqual({
      mode: "none",
    });
  });

  it("rejects a short password and a weak session secret", () => {
    try {
      resolveAuthConfig(
        parseEnv({
          API_HOST: "0.0.0.0",
          ...strong,
          CUTROOM_ADMIN_PASSWORD: "short",
          CUTROOM_SESSION_SECRET: "tiny",
        }),
      );
      throw new Error("expected a refusal");
    } catch (error) {
      if (!(error instanceof InvalidConfigError)) throw error;
      expect(error.issues.join("\n")).toMatch(/CUTROOM_ADMIN_PASSWORD/);
      expect(error.issues.join("\n")).toMatch(/CUTROOM_SESSION_SECRET/);
    }
  });

  it("defaults to password mode on a public address, with secure cookies", () => {
    const config = resolveAuthConfig(
      parseEnv({ API_HOST: "0.0.0.0", ...strong, CUTROOM_ADMIN_RESET: "true" }),
    );
    expect(config).toMatchObject({ mode: "password", secureCookies: true, admin: { reset: true } });
  });
});
