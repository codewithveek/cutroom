/**
 * Exponential backoff per email after repeated failures (E7-4), on top of the per-IP rate limit:
 * from the fifth failure on, each attempt waits 2^(failures-5) seconds, capped at 15 minutes.
 */
const FREE_FAILURES = 4;
const MAXIMUM_LOCK_MS = 15 * 60 * 1000;

interface FailureState {
  failures: number;
  lockedUntil: number;
}

export class LoginThrottle {
  private readonly failuresByEmail = new Map<string, FailureState>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Milliseconds until this email may try again; 0 when it may try now. */
  retryAfterMs(email: string): number {
    const state = this.failuresByEmail.get(email.toLowerCase());
    return state ? Math.max(0, state.lockedUntil - this.now()) : 0;
  }

  recordFailure(email: string): void {
    const key = email.toLowerCase();
    const failures = (this.failuresByEmail.get(key)?.failures ?? 0) + 1;
    const lockMs =
      failures > FREE_FAILURES ? Math.min(MAXIMUM_LOCK_MS, 1000 * 2 ** (failures - FREE_FAILURES - 1)) : 0;
    this.failuresByEmail.set(key, { failures, lockedUntil: this.now() + lockMs });
  }

  recordSuccess(email: string): void {
    this.failuresByEmail.delete(email.toLowerCase());
  }
}
