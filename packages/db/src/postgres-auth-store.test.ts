import { AuthService } from "@cutroom/auth";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle, runMigrations } from "./database";
import { PostgresAuthStore } from "./postgres-auth-store";

const connectionString = process.env.CUTROOM_TEST_DATABASE_URL;
const admin = { email: "admin@example.com", password: "correct horse battery", reset: false };

describe.skipIf(!connectionString)("PostgresAuthStore", () => {
  let database: DatabaseHandle;
  let now = new Date("2026-10-18T12:00:00Z");
  let service: AuthService;

  beforeAll(async () => {
    database = createDatabase({ connectionString: connectionString ?? "" });
    await runMigrations(database.db);
    await database.db.execute(sql`truncate users, sessions, api_tokens cascade`);
    service = new AuthService({ store: new PostgresAuthStore({ database }), now: () => now });
  });

  afterAll(async () => {
    await database.close();
  });

  it("seeds once, logs in, rolls and ends sessions", async () => {
    expect(await service.seedAdmin(admin)).toBe("created");
    expect(await service.seedAdmin(admin)).toBe("kept");
    const login = await service.login({
      email: "Admin@Example.com",
      password: admin.password,
      userAgent: "vitest",
    });
    if (!login.ok) throw new Error("login failed");
    now = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    expect(await service.authenticateSession(login.sessionId)).toMatchObject({ email: admin.email });
    const other = await service.login({ email: admin.email, password: admin.password });
    if (!other.ok) throw new Error("login failed");
    await service.signOutOtherSessions(login.user.id, login.sessionId);
    expect(await service.authenticateSession(other.sessionId)).toBeUndefined();
    expect(await service.authenticateSession(login.sessionId)).toBeDefined();
    await service.logout(login.sessionId);
    expect(await service.authenticateSession(login.sessionId)).toBeUndefined();
  });

  it("creates, lists, uses and revokes API tokens", async () => {
    const { token, summary } = await service.createApiToken({ name: "CLI" });
    expect(await service.authenticateApiToken(token)).toBe(true);
    expect((await service.listApiTokens()).find((item) => item.id === summary.id)?.lastUsedAt).toBeDefined();
    expect(await service.revokeApiToken(summary.id)).toBe(true);
    expect(await service.revokeApiToken(summary.id)).toBe(false);
    expect(await service.authenticateApiToken(token)).toBe(false);
  });
});
