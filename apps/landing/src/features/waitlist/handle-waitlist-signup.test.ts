import { describe, expect, it } from "vitest";
import { handleWaitlistSignup } from "./handle-waitlist-signup";
import { clientAddressFrom, createSlidingWindowLimiter } from "./rate-limiter";
import type { WaitlistSignup, WaitlistStore } from "./waitlist-store";

function memoryStore(): WaitlistStore & { emails: string[] } {
  const emails: string[] = [];
  return {
    emails,
    async add(signup: WaitlistSignup) {
      if (!emails.includes(signup.email)) emails.push(signup.email);
    },
  };
}

function setup() {
  const store = memoryStore();
  const limiter = createSlidingWindowLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
  const signUp = (body: unknown, clientAddress = "198.51.100.7") =>
    handleWaitlistSignup({ body, clientAddress, limiter, store });
  return { store, signUp };
}

describe("waitlist signup", () => {
  it("stores a valid email once, trimmed and lower-cased, and answers success both times", async () => {
    const { store, signUp } = setup();
    expect(await signUp({ email: "  Ada@Example.COM " })).toEqual({ status: 200, body: { ok: true } });
    expect(await signUp({ email: "ada@example.com" })).toEqual({ status: 200, body: { ok: true } });
    expect(store.emails).toEqual(["ada@example.com"]);
  });

  it("rejects an invalid or over-long email with the error envelope", async () => {
    const { signUp } = setup();
    expect((await signUp({ email: "not-an-email" })).status).toBe(400);
    const tooLong = `${"a".repeat(250)}@x.io`;
    expect(await signUp({ email: tooLong })).toMatchObject({
      status: 400,
      body: { error: { code: "validation_failed" } },
    });
  });

  it("ignores a filled honeypot silently", async () => {
    const { store, signUp } = setup();
    expect(await signUp({ email: "bot@example.com", website: "https://spam.example" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(store.emails).toEqual([]);
  });

  it("rate limits the sixth request from one address in ten minutes", async () => {
    const { signUp } = setup();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1)
      statuses.push((await signUp({ email: `person${attempt}@example.com` })).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect((await signUp({ email: "other@example.com" }, "203.0.113.4")).status).toBe(200);
  });
});

describe("sliding window limiter", () => {
  it("lets an address in again once the window has passed", () => {
    let time = 0;
    const limiter = createSlidingWindowLimiter({ max: 1, windowMs: 1000, now: () => time });
    expect(limiter.consume("a")).toBe(true);
    expect(limiter.consume("a")).toBe(false);
    time = 1500;
    expect(limiter.consume("a")).toBe(true);
  });
});

describe("clientAddressFrom", () => {
  it("takes the entry the load balancer appended, not one the client made up", () => {
    expect(clientAddressFrom(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientAddressFrom(new Headers())).toBe("unknown");
  });
});
