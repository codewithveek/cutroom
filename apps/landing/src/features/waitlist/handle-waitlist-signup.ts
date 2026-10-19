import { ulid } from "ulid";
import type { RateLimiter } from "./rate-limiter";
import { type WaitlistResponse, waitlistRequestSchema } from "./waitlist-contracts";
import { type WaitlistStore, WaitlistUnavailableError } from "./waitlist-store";

export interface HandleWaitlistSignupOptions {
  body: unknown;
  clientAddress: string;
  limiter: RateLimiter;
  /** Undefined when DATABASE_URL is not set. */
  store: WaitlistStore | undefined;
}

export interface WaitlistOutcome {
  status: number;
  body: WaitlistResponse;
}

const success: WaitlistOutcome = { status: 200, body: { ok: true } };

/** L-1..L-3: rate limit first, then validate, then a silent honeypot, then store once. */
export async function handleWaitlistSignup(options: HandleWaitlistSignupOptions): Promise<WaitlistOutcome> {
  if (!options.limiter.consume(options.clientAddress))
    return {
      status: 429,
      body: { error: { code: "rate_limited", message: "Too many tries. Wait a few minutes and try again." } },
    };
  const parsed = waitlistRequestSchema.safeParse(options.body);
  if (!parsed.success)
    return {
      status: 400,
      body: { error: { code: "validation_failed", message: "Enter a valid email address." } },
    };
  // A filled honeypot is a bot: it looks like success and nothing is stored.
  if (parsed.data.website) return success;
  if (!options.store) throw new WaitlistUnavailableError("DATABASE_URL is not set");
  // A duplicate also answers success, so the form never reveals who signed up (L-2).
  await options.store.add({ id: ulid(), email: parsed.data.email, source: "landing" });
  return success;
}
