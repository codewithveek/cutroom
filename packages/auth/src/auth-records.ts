import { z } from "zod";

export const userRecordSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(3),
  passwordHash: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserRecord = z.infer<typeof userRecordSchema>;

/** A session row stores the SHA-256 of the cookie's id, never the id itself (E7-3). */
export const sessionRecordSchema = z.object({
  idHash: z.string().regex(/^[0-9a-f]{64}$/),
  userId: z.string().min(1),
  createdAt: z.string(),
  expiresAt: z.string(),
  lastSeenAt: z.string(),
  userAgent: z.string().max(300).optional(),
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const apiTokenRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  tokenHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string(),
  lastUsedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  revokedAt: z.string().optional(),
});
export type ApiTokenRecord = z.infer<typeof apiTokenRecordSchema>;

/** What Settings lists: never the hash. */
export type ApiTokenSummary = Omit<ApiTokenRecord, "tokenHash">;
