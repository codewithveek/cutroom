import { createLogger } from "@cutroom/observability";
import { handleWaitlistSignup } from "@/features/waitlist/handle-waitlist-signup";
import { clientAddressFrom, createSlidingWindowLimiter } from "@/features/waitlist/rate-limiter";
import type { WaitlistResponse } from "@/features/waitlist/waitlist-contracts";
import { PostgresWaitlistStore, WaitlistUnavailableError } from "@/features/waitlist/waitlist-store";

export const dynamic = "force-dynamic";

const logger = createLogger({ name: "cutroom-landing" });
/** 5 requests per IP per 10 minutes (L-3). */
const limiter = createSlidingWindowLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
const store = process.env.DATABASE_URL
  ? new PostgresWaitlistStore({ connectionString: process.env.DATABASE_URL })
  : undefined;

function respond(status: number, body: WaitlistResponse): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const outcome = await handleWaitlistSignup({
      body,
      clientAddress: clientAddressFrom(request.headers),
      limiter,
      store,
    });
    return respond(outcome.status, outcome.body);
  } catch (error) {
    // Never the email itself: only what went wrong.
    if (error instanceof WaitlistUnavailableError) {
      logger.error({ step: "waitlist", reason: error.message }, "waitlist is not configured");
      return respond(503, { error: { code: "unavailable", message: "The waitlist is closed right now." } });
    }
    logger.error({ step: "waitlist", err: error }, "waitlist signup failed");
    return respond(500, { error: { code: "internal", message: "Something went wrong. Try again soon." } });
  }
}
