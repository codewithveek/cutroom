import { describe, expect, it } from "vitest";
import { InvalidConfigError, parseEnv } from "./load-env";

describe("parseEnv", () => {
  it("applies defaults for an empty environment", () => {
    const env = parseEnv({});
    expect(env.MODEL_ID).toBe("gemma4:e4b");
    expect(env.OLLAMA_HOST).toBe("http://127.0.0.1:11434");
    expect(env.API_PORT).toBe(4100);
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({ ELEVENLABS_API_KEY: "", API_PORT: "" });
    expect(env.ELEVENLABS_API_KEY).toBeUndefined();
    expect(env.API_PORT).toBe(4100);
  });

  it("rejects invalid values with a readable error", () => {
    expect(() => parseEnv({ OLLAMA_HOST: "not a url" })).toThrow(InvalidConfigError);
    try {
      parseEnv({ API_PORT: "-1" });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigError);
      expect((error as InvalidConfigError).issues[0]).toContain("API_PORT");
    }
  });
});
