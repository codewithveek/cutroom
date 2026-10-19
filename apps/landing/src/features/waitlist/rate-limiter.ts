export interface RateLimiter {
  /** Counts one request for `key`; false once the key is over its limit for the window. */
  consume(key: string): boolean;
}

export interface SlidingWindowOptions {
  max: number;
  windowMs: number;
  now?: () => number;
}

/** In memory, per process: the landing site runs as one small instance (L-3). */
export function createSlidingWindowLimiter(options: SlidingWindowOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();
  return {
    consume(key) {
      const currentTime = now();
      const recent = (hits.get(key) ?? []).filter((time) => currentTime - time < options.windowMs);
      recent.push(currentTime);
      hits.set(key, recent);
      // Forget idle keys so the map does not grow with every address ever seen.
      if (hits.size > 10_000)
        for (const [staleKey, times] of hits)
          if (times.every((time) => currentTime - time >= options.windowMs)) hits.delete(staleKey);
      return recent.length <= options.max;
    },
  };
}

/**
 * The visitor's address as the host's load balancer saw it: the last X-Forwarded-For entry is the
 * one it appended; earlier entries are whatever the client sent.
 */
export function clientAddressFrom(headers: Pick<Headers, "get">): string {
  const appended = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return appended || headers.get("x-real-ip")?.trim() || "unknown";
}
