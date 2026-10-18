import { ulid } from "ulid";
import type { ApiTokenRecord, ApiTokenSummary, UserRecord } from "./auth-records";
import type { AuthStore } from "./auth-store";
import { LoginThrottle } from "./login-throttle";
import { hashPassword, newApiToken, newSessionId, sha256Hex, verifyPassword } from "./secrets";

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
/** A rolling session is extended at most once a minute, not on every request. */
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
const MINIMUM_PASSWORD_LENGTH = 12;

export class AuthInputError extends Error {
  override readonly name = "AuthInputError";
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export type LoginResult =
  | { ok: true; sessionId: string; user: AuthenticatedUser }
  | { ok: false; retryAfterMs: number };

export interface AuthServiceOptions {
  store: AuthStore;
  now?: () => Date;
}

function toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
  return { id: user.id, email: user.email };
}

function summary(record: ApiTokenRecord): ApiTokenSummary {
  const { tokenHash: _tokenHash, ...rest } = record;
  return rest;
}

/** One admin, server-side sessions and revocable API tokens (PRD extension E7). */
export class AuthService {
  private readonly store: AuthStore;
  private readonly now: () => Date;
  private readonly throttle: LoginThrottle;
  /** Verified against when the email is unknown, so the timing does not reveal which emails exist. */
  private dummyHash: Promise<string> | undefined;

  constructor(options: AuthServiceOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.throttle = new LoginThrottle(() => this.now().getTime());
  }

  /** First boot creates the admin from env; later boots ignore env unless `reset` (E7-2). */
  async seedAdmin(admin: {
    email: string;
    password: string;
    reset: boolean;
  }): Promise<"created" | "reset" | "kept"> {
    const timestamp = this.now().toISOString();
    if ((await this.store.countUsers()) === 0) {
      await this.store.createUser({
        id: ulid(),
        email: admin.email.toLowerCase(),
        passwordHash: await hashPassword(admin.password),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return "created";
    }
    if (!admin.reset) return "kept";
    const existing = await this.store.firstUser();
    if (!existing) return "kept";
    await this.store.updateUser(existing.id, {
      email: admin.email.toLowerCase(),
      passwordHash: await hashPassword(admin.password),
      updatedAt: timestamp,
    });
    await this.store.deleteSessionsForUser(existing.id);
    return "reset";
  }

  async login(options: {
    email: string;
    password: string;
    userAgent?: string | undefined;
  }): Promise<LoginResult> {
    const email = options.email.trim().toLowerCase();
    const retryAfterMs = this.throttle.retryAfterMs(email);
    if (retryAfterMs > 0) return { ok: false, retryAfterMs };
    const user = await this.store.findUserByEmail(email);
    this.dummyHash ??= hashPassword("not-a-real-password-for-timing");
    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? (await this.dummyHash),
      options.password,
    );
    if (!user || !passwordMatches) {
      this.throttle.recordFailure(email);
      return { ok: false, retryAfterMs: this.throttle.retryAfterMs(email) };
    }
    this.throttle.recordSuccess(email);
    // A new id on every login (E7-3), so a planted cookie cannot be promoted to a session.
    const sessionId = newSessionId();
    const now = this.now();
    await this.store.createSession({
      idHash: sha256Hex(sessionId),
      userId: user.id,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
      ...(options.userAgent ? { userAgent: options.userAgent.slice(0, 300) } : {}),
    });
    return { ok: true, sessionId, user: toAuthenticatedUser(user) };
  }

  /** The session's user, extending its 7-day expiry; undefined when unknown or expired. */
  async authenticateSession(sessionId: string): Promise<AuthenticatedUser | undefined> {
    const idHash = sha256Hex(sessionId);
    const session = await this.store.findSession(idHash);
    if (!session) return undefined;
    const now = this.now();
    if (new Date(session.expiresAt).getTime() <= now.getTime()) {
      await this.store.deleteSession(idHash);
      return undefined;
    }
    const user = await this.store.findUserById(session.userId);
    if (!user) return undefined;
    if (now.getTime() - new Date(session.lastSeenAt).getTime() > SESSION_TOUCH_INTERVAL_MS) {
      await this.store.touchSession(idHash, {
        lastSeenAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
      });
    }
    return toAuthenticatedUser(user);
  }

  logout(sessionId: string): Promise<void> {
    return this.store.deleteSession(sha256Hex(sessionId));
  }

  async signOutOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.store.deleteSessionsForUser(userId, sha256Hex(currentSessionId));
  }

  /** Changes the email and/or password; the current password is always required (E7-10). */
  async updateAccount(options: {
    userId: string;
    currentPassword: string;
    email?: string | undefined;
    newPassword?: string | undefined;
  }): Promise<AuthenticatedUser> {
    const user = await this.store.findUserById(options.userId);
    if (!user || !(await verifyPassword(user.passwordHash, options.currentPassword)))
      throw new AuthInputError("The current password is not right");
    if (options.newPassword !== undefined && options.newPassword.length < MINIMUM_PASSWORD_LENGTH)
      throw new AuthInputError(`The new password needs at least ${MINIMUM_PASSWORD_LENGTH} characters`);
    const email = options.email?.trim().toLowerCase();
    await this.store.updateUser(user.id, {
      ...(email ? { email } : {}),
      ...(options.newPassword ? { passwordHash: await hashPassword(options.newPassword) } : {}),
      updatedAt: this.now().toISOString(),
    });
    return { id: user.id, email: email ?? user.email };
  }

  /** The token is returned once; only its hash is kept (E7-7). */
  async createApiToken(options: { name: string; expiresAt?: string | undefined }): Promise<{
    token: string;
    summary: ApiTokenSummary;
  }> {
    const token = newApiToken();
    const record: ApiTokenRecord = {
      id: ulid(),
      name: options.name.trim(),
      tokenHash: sha256Hex(token),
      createdAt: this.now().toISOString(),
      ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    };
    await this.store.createApiToken(record);
    return { token, summary: summary(record) };
  }

  async listApiTokens(): Promise<ApiTokenSummary[]> {
    return (await this.store.listApiTokens()).map(summary);
  }

  revokeApiToken(id: string): Promise<boolean> {
    return this.store.revokeApiToken(id, this.now().toISOString());
  }

  /** True for a live token: not revoked, not expired. Records when it was last used. */
  async authenticateApiToken(token: string): Promise<boolean> {
    const record = await this.store.findApiTokenByHash(sha256Hex(token));
    if (!record || record.revokedAt) return false;
    const now = this.now();
    if (record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime()) return false;
    await this.store.touchApiToken(record.id, now.toISOString());
    return true;
  }
}
