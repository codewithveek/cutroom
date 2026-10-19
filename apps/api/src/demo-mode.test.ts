import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import { createPipelineServices, createSystemService, InProcessRunner } from "@cutroom/pipeline";
import type { FastifyInstance } from "fastify";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { DEMO_RATE_LIMIT, DEMO_READ_ONLY_MESSAGE } from "./plugins/demo-guard";

let app: FastifyInstance;

beforeAll(async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-demo-"));
  const env = parseEnv({ CUTROOM_DATA_DIR: dataDirectory, CUTROOM_DEMO_MODE: "true" });
  const services = createPipelineServices({ env, logger: createLogger({ level: "silent" }) });
  app = await buildApp({
    env,
    runner: new InProcessRunner(services),
    store: services.store,
    system: createSystemService(services),
    uploadsDirectory: path.join(dataDirectory, "uploads"),
  });
});

const readOnlyRefusal = { error: { code: "DEMO_READ_ONLY", message: DEMO_READ_ONLY_MESSAGE } };

describe("demo mode", () => {
  it("refuses every write before it reaches a route (D-3)", async () => {
    const writes = [
      { method: "POST", url: "/runs", payload: {} },
      { method: "POST", url: "/projects" },
      { method: "POST", url: "/uploads" },
      { method: "PUT", url: "/runs/01J0000000000000000000000A/storyboard", payload: {} },
      { method: "PATCH", url: "/runs/01J0000000000000000000000A/settings", payload: {} },
      { method: "DELETE", url: "/runs/01J0000000000000000000000A" },
    ] as const;
    for (const write of writes) {
      const response = await app.inject(write);
      expect(response.statusCode, `${write.method} ${write.url}`).toBe(403);
      expect(response.json()).toEqual(readOnlyRefusal);
    }
  });

  it("still answers reads, and says it is a demo", async () => {
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/runs" })).json()).toEqual({ runs: [] });
    const status = await app.inject({ method: "GET", url: "/system/status" });
    expect(status.json()).toMatchObject({ demoMode: true, checks: [] });
  });

  it("has no repository lookups at all (D-4)", async () => {
    const tags = await app.inject({ method: "GET", url: "/sources/tags?path=/etc" });
    expect(tags.statusCode).toBe(404);
  });

  it("does not synthesise voice samples", async () => {
    const sample = await app.inject({ method: "GET", url: "/voices/af_heart/sample" });
    expect(sample.statusCode).toBe(403);
    expect(sample.json()).toMatchObject({ error: { code: "DEMO_READ_ONLY" } });
  });

  it("rate limits every route per IP (D-8)", async () => {
    const remoteAddress = "203.0.113.9";
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= DEMO_RATE_LIMIT.max; attempt += 1)
      statuses.push((await app.inject({ method: "GET", url: "/looks", remoteAddress })).statusCode);
    expect(statuses.slice(0, DEMO_RATE_LIMIT.max).every((status) => status !== 429)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("keys the limit on the address the load balancer appended, not one the client made up", async () => {
    const spoofed = await app.inject({
      method: "GET",
      url: "/looks",
      remoteAddress: "10.0.0.2",
      headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.9" },
    });
    expect(spoofed.statusCode).toBe(429);
  });
});
