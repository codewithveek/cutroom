import { z } from "zod";

export const MAX_EMAIL_LENGTH = 254;

/** POST /api/waitlist (L-1). `website` is the honeypot: people never see it, so they leave it empty. */
export const waitlistRequestSchema = z.object({
  email: z.string().trim().toLowerCase().max(MAX_EMAIL_LENGTH).pipe(z.email()),
  website: z.string().max(500).optional(),
});
export type WaitlistRequest = z.infer<typeof waitlistRequestSchema>;

export const waitlistSuccessSchema = z.object({ ok: z.literal(true) });

export const waitlistErrorCodeSchema = z.enum([
  "validation_failed",
  "rate_limited",
  "unavailable",
  "internal",
]);
export type WaitlistErrorCode = z.infer<typeof waitlistErrorCodeSchema>;

/** The one error envelope (PRD §8.7). */
export const waitlistErrorSchema = z.object({
  error: z.object({ code: waitlistErrorCodeSchema, message: z.string() }),
});

export const waitlistResponseSchema = z.union([waitlistSuccessSchema, waitlistErrorSchema]);
export type WaitlistResponse = z.infer<typeof waitlistResponseSchema>;
