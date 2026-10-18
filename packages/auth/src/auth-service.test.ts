import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AuthInputError, AuthService } from "./auth-service";
import { FileAuthStore } from "./file-auth-store";

const admin = { email: "Admin@Example.com", password: "correct horse battery", reset: false };

async function createService(start = new Date("2026-10-18T12:00:00Z")) {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "cutroom-auth-"));
  let now = start;
  const service = new AuthService({ store: new FileAuthStore({ dataDirectory }), now: () => now });
  return { service, dataDirectory, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

describe("AuthService", () => {
  it("seeds the admin once, stores only an argon2id hash, and ignores later env changes", async () => {
    const { service, dataDirectory } = await createService();
    expect(await service.seedAdmin(admin)).toBe("created");
    expect(await service.seedAdmin({ ...admin, password: "a different password" })).toBe("kept");
    const stored = await readFile(path.join(dataDirectory, "auth.json"), "utf8");
    expect(stored).toContain("$argon2id$");
    expect(stored).not.toContain(admin.password);
    expect((await service.login({ email: "admin@example.com", password: admin.password })).ok).toBe(true);
  });

  it("resets the password from env only when asked, and signs everyone out", async () => {
    const { service } = await createService();
    await service.seedAdmin(admin);
    const before = await service.login({ email: admin.email, password: admin.password });
    expect(await service.seedAdmin({ ...admin, password: "a brand new password", reset: true })).toBe(
      "reset",
    );
    if (!before.ok) throw new Error("login failed");
    expect(await service.authenticateSession(before.sessionId)).toBeUndefined();
    expect((await service.login({ email: admin.email, password: "a brand new password" })).ok).toBe(true);
  });

  it("issues a new session id on each login, rolls the expiry, and logs out", async () => {
    const { service, advance } = await createService();
    await service.seedAdmin(admin);
    const first = await service.login({ email: admin.email, password: admin.password });
    const second = await service.login({ email: admin.email, password: admin.password });
    if (!first.ok || !second.ok) throw new Error("login failed");
    expect(first.sessionId).not.toBe(second.sessionId);
    advance(6 * 24 * 60 * 60 * 1000);
    expect(await service.authenticateSession(first.sessionId)).toMatchObject({ email: "admin@example.com" });
    advance(6 * 24 * 60 * 60 * 1000);
    expect(await service.authenticateSession(first.sessionId)).toBeDefined();
    advance(8 * 24 * 60 * 60 * 1000);
    expect(await service.authenticateSession(first.sessionId)).toBeUndefined();
    await service.logout(second.sessionId);
    expect(await service.authenticateSession(second.sessionId)).toBeUndefined();
  });

  it("backs off after repeated failures with the same answer for unknown emails", async () => {
    const { service, advance } = await createService();
    await service.seedAdmin(admin);
    const unknown = await service.login({ email: "nobody@example.com", password: "whatever" });
    expect(unknown).toEqual({ ok: false, retryAfterMs: 0 });
    for (let attempt = 0; attempt < 5; attempt += 1)
      await service.login({ email: admin.email, password: "wrong password" });
    const locked = await service.login({ email: admin.email, password: admin.password });
    expect(locked.ok).toBe(false);
    if (locked.ok) throw new Error("expected a lock");
    expect(locked.retryAfterMs).toBeGreaterThan(0);
    advance(locked.retryAfterMs);
    expect((await service.login({ email: admin.email, password: admin.password })).ok).toBe(true);
  });

  it("requires the current password to change the account", async () => {
    const { service } = await createService();
    await service.seedAdmin(admin);
    const session = await service.login({ email: admin.email, password: admin.password });
    if (!session.ok) throw new Error("login failed");
    await expect(
      service.updateAccount({
        userId: session.user.id,
        currentPassword: "nope",
        newPassword: "another long one",
      }),
    ).rejects.toBeInstanceOf(AuthInputError);
    await service.updateAccount({
      userId: session.user.id,
      currentPassword: admin.password,
      email: "owner@example.com",
      newPassword: "another long one",
    });
    expect((await service.login({ email: "owner@example.com", password: "another long one" })).ok).toBe(true);
  });

  it("shows a token once, keeps only its hash, and refuses it after revocation or expiry", async () => {
    const { service, dataDirectory, advance } = await createService();
    const { token, summary } = await service.createApiToken({ name: "GitHub Action" });
    expect(token).toMatch(/^ctr_[A-Za-z0-9_-]{43}$/);
    expect(await readFile(path.join(dataDirectory, "auth.json"), "utf8")).not.toContain(token);
    expect(await service.authenticateApiToken(token)).toBe(true);
    expect((await service.listApiTokens())[0]).toMatchObject({ name: "GitHub Action" });
    expect(await service.listApiTokens()).not.toHaveProperty("0.tokenHash");
    expect(await service.revokeApiToken(summary.id)).toBe(true);
    expect(await service.authenticateApiToken(token)).toBe(false);
    const expiring = await service.createApiToken({ name: "CLI", expiresAt: "2026-10-19T12:00:00Z" });
    expect(await service.authenticateApiToken(expiring.token)).toBe(true);
    advance(2 * 24 * 60 * 60 * 1000);
    expect(await service.authenticateApiToken(expiring.token)).toBe(false);
  });
});
