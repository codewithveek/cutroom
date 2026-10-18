import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { type Algorithm, hash, verify } from "@node-rs/argon2";

/** `Algorithm.Argon2id`; the package ships a const enum, which isolated modules cannot read. */
const ARGON2ID = 2 as Algorithm;
/** OWASP's argon2id minimum: 19 MiB memory, 2 iterations, 1 lane (E7-2). */
const argon2Options = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const API_TOKEN_PREFIX = "ctr_";

export function hashPassword(password: string): Promise<string> {
  return hash(password, argon2Options);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** A 256-bit session id for the cookie; only its hash is stored. */
export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/** `ctr_` + 256 random bits; shown once, stored as a hash. */
export function newApiToken(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(sha256Hex(left), "hex");
  const rightBytes = Buffer.from(sha256Hex(right), "hex");
  return timingSafeEqual(leftBytes, rightBytes);
}
