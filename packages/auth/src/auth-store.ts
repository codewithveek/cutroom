import type { ApiTokenRecord, SessionRecord, UserRecord } from "./auth-records";

/** Users, sessions and API tokens: Postgres on deployed instances, a JSON file otherwise. */
export interface AuthStore {
  countUsers(): Promise<number>;
  findUserByEmail(email: string): Promise<UserRecord | undefined>;
  findUserById(id: string): Promise<UserRecord | undefined>;
  firstUser(): Promise<UserRecord | undefined>;
  createUser(user: UserRecord): Promise<void>;
  updateUser(
    id: string,
    changes: Partial<Pick<UserRecord, "email" | "passwordHash" | "updatedAt">>,
  ): Promise<void>;

  createSession(session: SessionRecord): Promise<void>;
  findSession(idHash: string): Promise<SessionRecord | undefined>;
  touchSession(idHash: string, changes: Pick<SessionRecord, "lastSeenAt" | "expiresAt">): Promise<void>;
  deleteSession(idHash: string): Promise<void>;
  /** Signs a user out everywhere except, optionally, the current session. */
  deleteSessionsForUser(userId: string, keepIdHash?: string): Promise<void>;

  createApiToken(token: ApiTokenRecord): Promise<void>;
  listApiTokens(): Promise<ApiTokenRecord[]>;
  findApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | undefined>;
  touchApiToken(id: string, lastUsedAt: string): Promise<void>;
  revokeApiToken(id: string, revokedAt: string): Promise<boolean>;
}
