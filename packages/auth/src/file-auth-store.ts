import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  type ApiTokenRecord,
  apiTokenRecordSchema,
  type SessionRecord,
  sessionRecordSchema,
  type UserRecord,
  userRecordSchema,
} from "./auth-records";
import type { AuthStore } from "./auth-store";

const authFileSchema = z.object({
  users: z.array(userRecordSchema).default([]),
  sessions: z.array(sessionRecordSchema).default([]),
  apiTokens: z.array(apiTokenRecordSchema).default([]),
});
type AuthFile = z.infer<typeof authFileSchema>;

/** The auth store for installs without Postgres: one JSON file, written atomically, one writer. */
export class FileAuthStore implements AuthStore {
  private readonly filePath: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: { dataDirectory: string }) {
    this.filePath = path.join(options.dataDirectory, "auth.json");
  }

  private async read(): Promise<AuthFile> {
    const content = await readFile(this.filePath, "utf8").catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return "{}";
      throw error;
    });
    return authFileSchema.parse(JSON.parse(content));
  }

  /** Serialises read-modify-write so concurrent requests cannot lose an update. */
  private change<Result>(mutate: (file: AuthFile) => Result): Promise<Result> {
    const next = this.queue.then(async () => {
      const file = await this.read();
      const result = mutate(file);
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(file, null, 2), { mode: 0o600 });
      await rename(temporaryPath, this.filePath);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async countUsers(): Promise<number> {
    return (await this.read()).users.length;
  }
  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    return (await this.read()).users.find((user) => user.email === email.toLowerCase());
  }
  async findUserById(id: string): Promise<UserRecord | undefined> {
    return (await this.read()).users.find((user) => user.id === id);
  }
  async firstUser(): Promise<UserRecord | undefined> {
    return (await this.read()).users.toSorted((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )[0];
  }
  async createUser(user: UserRecord): Promise<void> {
    await this.change((file) => file.users.push(user));
  }
  async updateUser(id: string, changes: Partial<Pick<UserRecord, "email" | "passwordHash" | "updatedAt">>) {
    await this.change((file) => {
      file.users = file.users.map((user) => (user.id === id ? { ...user, ...changes } : user));
    });
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.change((file) => file.sessions.push(session));
  }
  async findSession(idHash: string): Promise<SessionRecord | undefined> {
    return (await this.read()).sessions.find((session) => session.idHash === idHash);
  }
  async touchSession(idHash: string, changes: Pick<SessionRecord, "lastSeenAt" | "expiresAt">) {
    await this.change((file) => {
      file.sessions = file.sessions.map((session) =>
        session.idHash === idHash ? { ...session, ...changes } : session,
      );
    });
  }
  async deleteSession(idHash: string): Promise<void> {
    await this.change((file) => {
      file.sessions = file.sessions.filter((session) => session.idHash !== idHash);
    });
  }
  async deleteSessionsForUser(userId: string, keepIdHash?: string): Promise<void> {
    await this.change((file) => {
      file.sessions = file.sessions.filter(
        (session) => session.userId !== userId || session.idHash === keepIdHash,
      );
    });
  }

  async createApiToken(token: ApiTokenRecord): Promise<void> {
    await this.change((file) => file.apiTokens.push(token));
  }
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    return (await this.read()).apiTokens;
  }
  async findApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | undefined> {
    return (await this.read()).apiTokens.find((token) => token.tokenHash === tokenHash);
  }
  async touchApiToken(id: string, lastUsedAt: string): Promise<void> {
    await this.change((file) => {
      file.apiTokens = file.apiTokens.map((token) => (token.id === id ? { ...token, lastUsedAt } : token));
    });
  }
  async revokeApiToken(id: string, revokedAt: string): Promise<boolean> {
    return this.change((file) => {
      const token = file.apiTokens.find((candidate) => candidate.id === id && !candidate.revokedAt);
      if (!token) return false;
      token.revokedAt = revokedAt;
      return true;
    });
  }
}
