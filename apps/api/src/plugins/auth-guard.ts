import type { AuthenticatedUser, AuthService } from "@cutroom/auth";
import { constantTimeEquals } from "@cutroom/auth";
import type { AuthConfig } from "@cutroom/config";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "./error-handler";

export const SESSION_COOKIE = "cutroom_session";
const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Who a request is: the local user (no login), the signed-in admin, or an API token. */
export type Principal =
  | { kind: "local" }
  | { kind: "session"; user: AuthenticatedUser; sessionId: string }
  | { kind: "token" };

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export interface AuthGuardOptions {
  config: AuthConfig;
  service: AuthService | undefined;
  /** RENDER_API_TOKEN: an optional bootstrap token, accepted like an API token (E7-7). */
  bootstrapToken: string | undefined;
}

/** Routes open without a session or token (E7-6). */
const publicRoutes = new Set(["GET /health", "POST /auth/login", "GET /auth/me"]);
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function bearerToken(request: FastifyRequest): string | undefined {
  return request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
}

export async function isValidApiToken(options: AuthGuardOptions, token: string): Promise<boolean> {
  if (options.bootstrapToken && constantTimeEquals(options.bootstrapToken, token)) return true;
  return options.service ? options.service.authenticateApiToken(token) : false;
}

/**
 * The origin a cookie-authenticated, state-changing request must come from (E7-5): the configured
 * public URL, or else the host the web app's proxy received the request on.
 */
export function expectedOrigin(request: FastifyRequest, publicUrl: string | undefined): string {
  if (publicUrl) return new URL(publicUrl).origin;
  const forwardedHost = request.headers["x-forwarded-host"];
  const forwardedProto = request.headers["x-forwarded-proto"];
  const host = (typeof forwardedHost === "string" ? forwardedHost : undefined) ?? request.headers.host ?? "";
  const protocol =
    (typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : undefined) ?? request.protocol;
  return `${protocol}://${host}`;
}

async function sessionPrincipal(
  request: FastifyRequest,
  service: AuthService,
): Promise<Principal | undefined> {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return undefined;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return undefined;
  const user = await service.authenticateSession(unsigned.value);
  return user ? { kind: "session", user, sessionId: unsigned.value } : undefined;
}

function unauthorized(): ApiError {
  return new ApiError({ code: "unauthorized", statusCode: 401, message: "Sign in to continue" });
}

export function setSessionCookie(options: { reply: FastifyReply; sessionId: string; secure: boolean }): void {
  options.reply.setCookie(SESSION_COOKIE, options.sessionId, {
    signed: true,
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** The security boundary for deployed instances; Next.js only redirects for UX (E7-6). */
export async function registerAuthGuard(app: FastifyInstance, options: AuthGuardOptions): Promise<void> {
  const { config, service } = options;
  if (config.mode === "none" || !service) {
    app.addHook("onRequest", async (request) => {
      request.principal = { kind: "local" };
    });
    return;
  }
  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-site" },
  });
  // Keyed per IP and email, so it runs after the body is parsed (E7-4).
  await app.register(rateLimit, { global: false, hook: "preHandler" });

  app.addHook("onRequest", async (request) => {
    const route = `${request.method} ${request.routeOptions.url ?? request.url.split("?")[0]}`;
    const token = bearerToken(request);
    if (token) {
      if (!(await isValidApiToken(options, token))) throw unauthorized();
      request.principal = { kind: "token" };
      return;
    }
    const principal = await sessionPrincipal(request, service);
    if (principal) {
      if (
        !safeMethods.has(request.method) &&
        request.headers.origin !== expectedOrigin(request, config.publicUrl)
      )
        throw new ApiError({
          code: "unauthorized",
          statusCode: 403,
          message: "This request did not come from the Cutroom web app",
        });
      request.principal = principal;
      return;
    }
    if (request.method === "OPTIONS" || publicRoutes.has(route)) return;
    throw unauthorized();
  });
}
