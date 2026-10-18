import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AuthService, FileAuthStore } from "@cutroom/auth";
import { parseEnv, resolveAuthConfig } from "@cutroom/config";
import { createLogger } from "@cutroom/observability";
import {
  createPipelineServices,
  createShipnoteScriptedTransport,
  createSystemService,
  InProcessRunner,
} from "@cutroom/pipeline";
import { createSilentProvider } from "@cutroom/voice";
import type { FastifyInstance } from "fastify";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";

const admin = { email: "admin@example.com", password: "correct horse battery" };
const webOrigin = "https://cutroom.example.com";
let app: FastifyInstance;

beforeAll(async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-auth-api-"));
  const env = parseEnv({
    CUTROOM_DATA_DIR: dataDirectory,
    API_HOST: "0.0.0.0",
    CUTROOM_ADMIN_EMAIL: admin.email,
    CUTROOM_ADMIN_PASSWORD: admin.password,
    CUTROOM_SESSION_SECRET: "s".repeat(48),
  });
  const config = resolveAuthConfig(env);
  if (config.mode !== "password") throw new Error("expected password mode");
  const service = new AuthService({ store: new FileAuthStore({ dataDirectory }) });
  await service.seedAdmin(config.admin);
  const services = createPipelineServices({
    env,
    logger: createLogger({ level: "silent" }),
    overrides: {
      modelTransportOverride: createShipnoteScriptedTransport(),
      voiceProviderOverride: createSilentProvider(),
    },
  });
  app = await buildApp({
    env,
    runner: new InProcessRunner(services),
    store: services.store,
    system: createSystemService(services),
    uploadsDirectory: path.join(dataDirectory, "uploads"),
    auth: { config, service },
  });
});

async function login(credentials = admin, ip = "203.0.113.1") {
  return app.inject({
    method: "POST",
    url: "/auth/login",
    headers: {
      origin: webOrigin,
      "x-forwarded-host": "cutroom.example.com",
      "x-forwarded-proto": "https",
      "x-forwarded-for": ip,
    },
    payload: credentials,
  });
}

function sessionCookie(response: Awaited<ReturnType<typeof login>>): string {
  const cookie = response.cookies.find((candidate) => candidate.name === "cutroom_session");
  if (!cookie) throw new Error("no session cookie");
  return `cutroom_session=${cookie.value}`;
}

describe("auth on a deployed instance", () => {
  it("answers health and the login page's status, and nothing else, without a session", async () => {
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/auth/me" })).json()).toEqual({ mode: "password" });
    for (const url of ["/runs", "/runs/01ABC/assets/01DEF", "/system/status", "/presets", "/api-tokens"])
      expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(401);
    expect((await app.inject({ method: "POST", url: "/runs", payload: {} })).statusCode).toBe(401);
  });

  it("signs in with an HttpOnly, Secure, SameSite=Lax cookie and one message for every failure", async () => {
    const wrong = await login({ email: admin.email, password: "nope" }, "203.0.113.9");
    const unknown = await login({ email: "who@example.com", password: "nope" }, "203.0.113.9");
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(unknown.json().error.message);
    const signedIn = await login();
    expect(signedIn.statusCode).toBe(200);
    const cookie = signedIn.cookies.find((candidate) => candidate.name === "cutroom_session");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    const runs = await app.inject({
      method: "GET",
      url: "/runs",
      headers: { cookie: sessionCookie(signedIn) },
    });
    expect(runs.statusCode).toBe(200);
    expect(runs.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("refuses a cookie-authenticated change from another origin", async () => {
    const cookie = sessionCookie(await login());
    const forwarded = { "x-forwarded-host": "cutroom.example.com", "x-forwarded-proto": "https" };
    const crossSite = await app.inject({
      method: "POST",
      url: "/api-tokens",
      headers: { cookie, origin: "https://evil.example.net", ...forwarded },
      payload: { name: "stolen" },
    });
    expect(crossSite.statusCode).toBe(403);
    const sameSite = await app.inject({
      method: "POST",
      url: "/api-tokens",
      headers: { cookie, origin: webOrigin, ...forwarded },
      payload: { name: "CLI" },
    });
    expect(sameSite.statusCode).toBe(200);
  });

  it("rate-limits the sixth rapid failed login", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1)
      statuses.push(
        (await login({ email: "target@example.com", password: "guess" }, "198.51.100.7")).statusCode,
      );
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("accepts an API token as a bearer and refuses it as soon as it is revoked", async () => {
    const cookie = sessionCookie(await login());
    const headers = {
      cookie,
      origin: webOrigin,
      "x-forwarded-host": "cutroom.example.com",
      "x-forwarded-proto": "https",
    };
    const created = (
      await app.inject({ method: "POST", url: "/api-tokens", headers, payload: { name: "GitHub Action" } })
    ).json();
    const bearer = { authorization: `Bearer ${created.token}` };
    expect((await app.inject({ method: "GET", url: "/runs", headers: bearer })).statusCode).toBe(200);
    const revoked = await app.inject({ method: "DELETE", url: `/api-tokens/${created.summary.id}`, headers });
    expect(revoked.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/runs", headers: bearer })).statusCode).toBe(401);
  });

  it("logs out, and the old cookie stops working", async () => {
    const cookie = sessionCookie(await login());
    const headers = {
      cookie,
      origin: webOrigin,
      "x-forwarded-host": "cutroom.example.com",
      "x-forwarded-proto": "https",
    };
    expect((await app.inject({ method: "POST", url: "/auth/logout", headers })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/runs", headers: { cookie } })).statusCode).toBe(401);
  });
});
