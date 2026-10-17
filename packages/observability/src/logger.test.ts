import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, createStepLogger } from "./logger";

function captureLines(): { stream: Writable; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { stream, lines };
}

describe("createStepLogger", () => {
  it("adds runId and step to every line", () => {
    const { stream, lines } = captureLines();
    const logger = createStepLogger(createLogger({ destination: stream }), {
      runId: "run_1",
      step: "ingest",
    });
    logger.info("hello");
    const parsed: unknown = JSON.parse(lines[0] ?? "{}");
    expect(parsed).toMatchObject({ runId: "run_1", step: "ingest", msg: "hello" });
  });

  it("redacts secret-looking fields", () => {
    const { stream, lines } = captureLines();
    createLogger({ destination: stream }).info({ apiKey: "sk-live-123", provider: { token: "abc" } }, "call");
    expect(lines[0]).not.toContain("sk-live-123");
    expect(lines[0]).not.toContain('"abc"');
    expect(lines[0]).toContain("‹redacted›");
  });
});
