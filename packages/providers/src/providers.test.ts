import { parseEnv } from "@cutroom/config";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EgressBlockedError, installLocalEgressGuard } from "./egress-guard";
import { createOllamaTransport } from "./ollama-transport";
import { isProviderAllowed, networkScopeForUrl, PrivacyViolationError } from "./privacy-guard";
import { createModelClient } from "./provider-factory";
import { createScriptedTransport } from "./scripted-transport";
import { extractJsonText, generateWithRepair, StructuredOutputError } from "./structured-generation";

const answerSchema = z.object({ title: z.string().min(3), count: z.number().int() });

describe("generateWithRepair", () => {
  it("returns the first valid output", async () => {
    const transport = createScriptedTransport(() => ({ title: "Hello", count: 2 }));
    const result = await generateWithRepair(transport, {
      schema: answerSchema,
      schemaName: "answer",
      system: "s",
      messages: [{ role: "user", content: "go" }],
      operation: "test",
    });
    expect(result).toMatchObject({ output: { title: "Hello", count: 2 }, attempts: 1 });
    expect(transport.requests[0]?.jsonSchema).toMatchObject({ type: "object" });
  });

  it("sends issues back with the previous output and repairs", async () => {
    const transport = createScriptedTransport((_request, callIndex) =>
      callIndex === 0 ? { title: "Hi", count: 1.5 } : { title: "Hello", count: 1 },
    );
    const result = await generateWithRepair(transport, {
      schema: answerSchema,
      schemaName: "answer",
      system: "s",
      messages: [{ role: "user", content: "go" }],
      operation: "test",
    });
    expect(result.attempts).toBe(2);
    const repairRequest = transport.requests[1];
    expect(repairRequest?.messages.at(-2)?.role).toBe("assistant");
    expect(repairRequest?.messages.at(-1)?.content).toContain("title");
    expect(repairRequest?.messages.at(-1)?.content).toContain("count");
  });

  it("runs semantic validators and gives up after three attempts", async () => {
    const transport = createScriptedTransport(() => ({ title: "Too long a title", count: 1 }));
    const attempt = generateWithRepair(transport, {
      schema: answerSchema,
      schemaName: "answer",
      system: "s",
      messages: [{ role: "user", content: "go" }],
      validate: (output) => (output.title.split(" ").length > 2 ? ["title: at most 2 words"] : []),
      operation: "test",
    });
    await expect(attempt).rejects.toBeInstanceOf(StructuredOutputError);
    await expect(attempt).rejects.toMatchObject({ issues: ["title: at most 2 words"], attempts: 3 });
    expect(transport.requests).toHaveLength(3);
  });

  it("strips code fences and prose", () => {
    expect(extractJsonText('Sure!\n```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonText('Here you go: {"a":1}')).toBe('{"a":1}');
  });
});

describe("privacy guard", () => {
  it("derives network scope from the URL", () => {
    expect(networkScopeForUrl("http://127.0.0.1:11434")).toBe("localhost");
    expect(networkScopeForUrl("http://localhost:11434")).toBe("localhost");
    expect(networkScopeForUrl("https://gpu.example.com/v1")).toBe("external");
  });

  it("applies each mode's allow-list", () => {
    const externalModel = { providerId: "x", role: "model" as const, networkScope: "external" as const };
    const externalVoice = {
      providerId: "elevenlabs",
      role: "voice" as const,
      networkScope: "external" as const,
    };
    const upload = {
      providerId: "render-api",
      role: "render-upload" as const,
      networkScope: "external" as const,
    };
    expect(isProviderAllowed({ mode: "local", provider: externalModel })).toBe(false);
    expect(isProviderAllowed({ mode: "local", provider: upload })).toBe(false);
    expect(isProviderAllowed({ mode: "hybrid", provider: externalModel })).toBe(false);
    expect(isProviderAllowed({ mode: "hybrid", provider: upload })).toBe(true);
    expect(isProviderAllowed({ mode: "hybrid", provider: externalVoice })).toBe(false);
    expect(
      isProviderAllowed({ mode: "hybrid", provider: externalVoice, optIns: { externalVoice: true } }),
    ).toBe(true);
    expect(isProviderAllowed({ mode: "cloud", provider: externalModel })).toBe(true);
  });

  it("throws PrivacyViolationError at construction for a remote model in Local mode", () => {
    const env = parseEnv({ OLLAMA_HOST: "https://ollama.example.com" });
    expect(() => createModelClient({ mode: "local", env })).toThrow(PrivacyViolationError);
    expect(createModelClient({ mode: "local", env: parseEnv({}) }).networkScope).toBe("localhost");
  });

  it("uses the OpenAI-compatible endpoint only in Cloud mode", () => {
    const env = parseEnv({ OPENAI_COMPAT_BASE_URL: "https://gpu.example.com/v1" });
    expect(createModelClient({ mode: "cloud", env }).providerId).toBe("openai-compatible");
    expect(createModelClient({ mode: "local", env }).providerId).toBe("ollama");
  });
});

describe("ollama transport", () => {
  it("posts the JSON schema as `format` and reads token counts", async () => {
    let sentBody: unknown;
    const transport = createOllamaTransport({
      host: "http://127.0.0.1:11434",
      modelId: "gemma4:e4b",
      contextTokens: 8192,
      fetchImplementation: async (_input, init) => {
        sentBody = JSON.parse(String(init?.body));
        const chunks = [
          { message: { content: '{"ok":' }, done: false },
          { message: { content: "true}" }, done: true, prompt_eval_count: 12, eval_count: 5 },
        ];
        return new Response(chunks.map((chunk) => JSON.stringify(chunk)).join("\n"));
      },
    });
    const completion = await transport.complete({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      jsonSchema: { type: "object" },
      schemaName: "x",
      temperature: 0.2,
      maxOutputTokens: 100,
    });
    expect(completion).toEqual({ content: '{"ok":true}', usage: { inputTokens: 12, outputTokens: 5 } });
    expect(sentBody).toMatchObject({ model: "gemma4:e4b", stream: true, format: { type: "object" } });
  });
});

describe("installLocalEgressGuard", () => {
  it("blocks non-loopback fetches and allows localhost", async () => {
    const guard = installLocalEgressGuard();
    try {
      await expect(fetch("https://example.com")).rejects.toBeInstanceOf(EgressBlockedError);
      await expect(fetch("http://127.0.0.1:9/never")).rejects.not.toBeInstanceOf(EgressBlockedError);
    } finally {
      guard.release();
    }
  });
});
