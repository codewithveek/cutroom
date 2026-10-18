import type { CutroomEnv } from "./env-schema";
import { InvalidConfigError } from "./load-env";

export type AuthConfig =
  | { mode: "none" }
  | {
      mode: "password";
      admin: { email: string; password: string; reset: boolean };
      sessionSecret: string;
      publicUrl: string | undefined;
      /** Cookies are Secure except on a loopback address (plain http://localhost). */
      secureCookies: boolean;
    };

const MINIMUM_PASSWORD_LENGTH = 12;
const MINIMUM_SESSION_SECRET_BYTES = 32;

export function isLoopbackAddress(host: string): boolean {
  return host === "localhost" || host === "::1" || host.startsWith("127.");
}

/**
 * Login is required wherever the API is reachable from another machine (E7-1). The API refuses to
 * start on an open address without it, or with weak secrets, and names the variable to set.
 */
export function resolveAuthConfig(env: CutroomEnv): AuthConfig {
  const loopback = isLoopbackAddress(env.API_HOST);
  const mode = env.CUTROOM_AUTH_MODE ?? (loopback ? "none" : "password");
  if (mode === "none") {
    if (!loopback)
      throw new InvalidConfigError([
        `CUTROOM_AUTH_MODE: "none" is only allowed on a loopback address, and API_HOST is ${env.API_HOST}. Set CUTROOM_AUTH_MODE=password with CUTROOM_ADMIN_EMAIL, CUTROOM_ADMIN_PASSWORD and CUTROOM_SESSION_SECRET.`,
      ]);
    return { mode: "none" };
  }
  const issues: string[] = [];
  if (!env.CUTROOM_ADMIN_EMAIL) issues.push("CUTROOM_ADMIN_EMAIL: set the admin's login email");
  if (!env.CUTROOM_ADMIN_PASSWORD || env.CUTROOM_ADMIN_PASSWORD.length < MINIMUM_PASSWORD_LENGTH)
    issues.push(`CUTROOM_ADMIN_PASSWORD: set a password of at least ${MINIMUM_PASSWORD_LENGTH} characters`);
  if (
    !env.CUTROOM_SESSION_SECRET ||
    Buffer.byteLength(env.CUTROOM_SESSION_SECRET) < MINIMUM_SESSION_SECRET_BYTES
  )
    issues.push(
      `CUTROOM_SESSION_SECRET: set at least ${MINIMUM_SESSION_SECRET_BYTES} random bytes (openssl rand -base64 48)`,
    );
  if (
    issues.length > 0 ||
    !env.CUTROOM_ADMIN_EMAIL ||
    !env.CUTROOM_ADMIN_PASSWORD ||
    !env.CUTROOM_SESSION_SECRET
  )
    throw new InvalidConfigError(issues);
  return {
    mode: "password",
    admin: {
      email: env.CUTROOM_ADMIN_EMAIL,
      password: env.CUTROOM_ADMIN_PASSWORD,
      reset: env.CUTROOM_ADMIN_RESET,
    },
    sessionSecret: env.CUTROOM_SESSION_SECRET,
    publicUrl: env.CUTROOM_PUBLIC_URL,
    secureCookies: !loopback,
  };
}
