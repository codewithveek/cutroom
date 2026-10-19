import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "./error-handler";

export const DEMO_READ_ONLY_MESSAGE = "This is a read-only demo. Run Cutroom locally to use your own code.";

/** Reading never changes anything; CORS preflights and HEAD are not writes either. */
const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const DEMO_RATE_LIMIT = { max: 120, timeWindow: "1 minute" } as const;

/**
 * The client's address as the platform's load balancer saw it: the last X-Forwarded-For entry is
 * the one it appended. The leftmost entries (what `trustProxy: true` reads) are whatever the client
 * sent, so keying on them would let anyone dodge the limit with a made-up header.
 */
export function demoRateLimitKey(request: Pick<FastifyRequest, "headers" | "socket">): string {
  const forwardedFor = request.headers["x-forwarded-for"];
  const chain = (Array.isArray(forwardedFor) ? forwardedFor.join(",") : (forwardedFor ?? "")).split(",");
  return chain.at(-1)?.trim() || request.socket.remoteAddress || "unknown";
}

/**
 * The public demo's security boundary (D-3, D-8): every route is rate limited per IP, and every
 * request that is not a read is refused before it reaches a route. There is no allow-list: the
 * waitlist lives on the landing site.
 */
export async function registerDemoGuard(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, { global: true, ...DEMO_RATE_LIMIT, keyGenerator: demoRateLimitKey });
  app.addHook("onRequest", async (request) => {
    if (readMethods.has(request.method)) return;
    throw new ApiError({ code: "DEMO_READ_ONLY", statusCode: 403, message: DEMO_READ_ONLY_MESSAGE });
  });
}
