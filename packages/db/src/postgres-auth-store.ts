import type { ApiTokenRecord, AuthStore, SessionRecord, UserRecord } from "@cutroom/auth";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { DatabaseHandle } from "./database";
import { apiTokens, sessions, users } from "./schema";

/** Postgres returns `2026-10-18 12:00:00+00`; the auth records carry ISO strings. */
function iso(value: string): string;
function iso(value: string | null): string | undefined;
function iso(value: string | null): string | undefined {
  return value === null ? undefined : new Date(value).toISOString();
}

function toUser(row: typeof users.$inferSelect): UserRecord {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
}

function toSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    idHash: row.idHash,
    userId: row.userId,
    createdAt: iso(row.createdAt),
    expiresAt: iso(row.expiresAt),
    lastSeenAt: iso(row.lastSeenAt),
    ...(row.userAgent ? { userAgent: row.userAgent } : {}),
  };
}

function toApiToken(row: typeof apiTokens.$inferSelect): ApiTokenRecord {
  const lastUsedAt = iso(row.lastUsedAt);
  const expiresAt = iso(row.expiresAt);
  const revokedAt = iso(row.revokedAt);
  return {
    id: row.id,
    name: row.name,
    tokenHash: row.tokenHash,
    createdAt: iso(row.createdAt),
    ...(lastUsedAt ? { lastUsedAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
  };
}

/** Users, sessions and API tokens for a deployed instance (PRD extension E7). */
export class PostgresAuthStore implements AuthStore {
  readonly #database: DatabaseHandle;

  constructor(options: { database: DatabaseHandle }) {
    this.#database = options.database;
  }

  async countUsers(): Promise<number> {
    const [row] = await this.#database.db.select({ count: sql<number>`count(*)::int` }).from(users);
    return row?.count ?? 0;
  }
  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const [row] = await this.#database.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return row ? toUser(row) : undefined;
  }
  async findUserById(id: string): Promise<UserRecord | undefined> {
    const [row] = await this.#database.db.select().from(users).where(eq(users.id, id));
    return row ? toUser(row) : undefined;
  }
  async firstUser(): Promise<UserRecord | undefined> {
    const [row] = await this.#database.db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
    return row ? toUser(row) : undefined;
  }
  async createUser(user: UserRecord): Promise<void> {
    await this.#database.db.insert(users).values(user);
  }
  async updateUser(id: string, changes: Partial<Pick<UserRecord, "email" | "passwordHash" | "updatedAt">>) {
    await this.#database.db.update(users).set(changes).where(eq(users.id, id));
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.#database.db.insert(sessions).values({ ...session, userAgent: session.userAgent ?? null });
  }
  async findSession(idHash: string): Promise<SessionRecord | undefined> {
    const [row] = await this.#database.db.select().from(sessions).where(eq(sessions.idHash, idHash));
    return row ? toSession(row) : undefined;
  }
  async touchSession(idHash: string, changes: Pick<SessionRecord, "lastSeenAt" | "expiresAt">) {
    await this.#database.db.update(sessions).set(changes).where(eq(sessions.idHash, idHash));
  }
  async deleteSession(idHash: string): Promise<void> {
    await this.#database.db.delete(sessions).where(eq(sessions.idHash, idHash));
  }
  async deleteSessionsForUser(userId: string, keepIdHash?: string): Promise<void> {
    await this.#database.db
      .delete(sessions)
      .where(
        keepIdHash
          ? and(eq(sessions.userId, userId), ne(sessions.idHash, keepIdHash))
          : eq(sessions.userId, userId),
      );
  }

  async createApiToken(token: ApiTokenRecord): Promise<void> {
    await this.#database.db.insert(apiTokens).values({
      ...token,
      lastUsedAt: token.lastUsedAt ?? null,
      expiresAt: token.expiresAt ?? null,
      revokedAt: token.revokedAt ?? null,
    });
  }
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    return (await this.#database.db.select().from(apiTokens).orderBy(asc(apiTokens.createdAt))).map(
      toApiToken,
    );
  }
  async findApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | undefined> {
    const [row] = await this.#database.db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash));
    return row ? toApiToken(row) : undefined;
  }
  async touchApiToken(id: string, lastUsedAt: string): Promise<void> {
    await this.#database.db.update(apiTokens).set({ lastUsedAt }).where(eq(apiTokens.id, id));
  }
  async revokeApiToken(id: string, revokedAt: string): Promise<boolean> {
    const updated = await this.#database.db
      .update(apiTokens)
      .set({ revokedAt })
      .where(and(eq(apiTokens.id, id), sql`${apiTokens.revokedAt} is null`))
      .returning({ id: apiTokens.id });
    return updated.length > 0;
  }
}
