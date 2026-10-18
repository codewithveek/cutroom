import { z } from "zod";

/** GET /auth/me: `none` on a local install (no login), otherwise the signed-in admin. */
export const authStatusSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({
    mode: z.literal("password"),
    user: z.object({ id: z.string(), email: z.string() }).optional(),
    via: z.enum(["session", "token"]).optional(),
  }),
]);
export type AuthStatus = z.infer<typeof authStatusSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const accountUpdateSchema = z
  .object({
    currentPassword: z.string().min(1).max(1024),
    email: z.email().optional(),
    newPassword: z.string().min(12).max(1024).optional(),
  })
  .refine((update) => update.email !== undefined || update.newPassword !== undefined, {
    message: "Change the email, the password, or both",
  });
export type AccountUpdate = z.infer<typeof accountUpdateSchema>;

export const apiTokenSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  revokedAt: z.string().optional(),
});
export type ApiTokenSummaryView = z.infer<typeof apiTokenSummarySchema>;

export const createApiTokenRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Days until it stops working; omitted → never expires. */
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;

/** The plain token appears in this response only. */
export const createdApiTokenSchema = z.object({ token: z.string(), summary: apiTokenSummarySchema });
