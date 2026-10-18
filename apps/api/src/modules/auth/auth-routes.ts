import { AuthInputError, type AuthService } from "@cutroom/auth";
import type { AuthConfig } from "@cutroom/config";
import {
  type AuthStatus,
  accountUpdateSchema,
  createApiTokenRequestSchema,
  loginRequestSchema,
} from "@cutroom/scene-spec";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { clearSessionCookie, expectedOrigin, setSessionCookie } from "../../plugins/auth-guard";
import { ApiError } from "../../plugins/error-handler";

export interface AuthRoutesOptions {
  config: AuthConfig;
  service: AuthService | undefined;
}

const LOGIN_ATTEMPTS_PER_MINUTE = 5;

function requireSession(request: FastifyRequest) {
  const principal = request.principal;
  if (principal?.kind !== "session")
    throw new ApiError({ code: "unauthorized", statusCode: 401, message: "Sign in to change the account" });
  return principal;
}

type PasswordConfig = Extract<AuthConfig, { mode: "password" }>;

function requirePasswordMode(options: AuthRoutesOptions): { service: AuthService; config: PasswordConfig } {
  if (options.config.mode === "none" || !options.service)
    throw new ApiError({ code: "not_found", statusCode: 404, message: "This install has no login" });
  return { service: options.service, config: options.config };
}

/** Login, logout, the account and API tokens (PRD extension E7). Local installs answer `mode: none`. */
export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, options) => {
  app.get("/auth/me", async (request): Promise<AuthStatus> => {
    if (options.config.mode === "none") return { mode: "none" };
    const principal = request.principal;
    if (principal?.kind === "session") return { mode: "password", user: principal.user, via: "session" };
    if (principal?.kind === "token") return { mode: "password", via: "token" };
    return { mode: "password" };
  });

  app.post(
    "/auth/login",
    {
      schema: { body: loginRequestSchema },
      config: {
        rateLimit: {
          max: LOGIN_ATTEMPTS_PER_MINUTE,
          timeWindow: "1 minute",
          keyGenerator: (request: FastifyRequest) => {
            const parsed = loginRequestSchema.safeParse(request.body);
            return `${request.ip}|${parsed.success ? parsed.data.email.toLowerCase() : ""}`;
          },
        },
      },
    },
    async (request, reply) => {
      const { service, config } = requirePasswordMode(options);
      // Login CSRF: a page elsewhere must not sign the visitor in to this instance.
      const origin = request.headers.origin;
      if (origin && origin !== expectedOrigin(request, config.publicUrl))
        throw new ApiError({
          code: "unauthorized",
          statusCode: 403,
          message: "Sign in from the Cutroom web app",
        });
      const result = await service.login({
        email: request.body.email,
        password: request.body.password,
        userAgent: request.headers["user-agent"],
      });
      if (!result.ok) {
        // One message for every failure; never the password (E7-4).
        request.log.warn({ email: request.body.email.toLowerCase(), ip: request.ip }, "failed login");
        if (result.retryAfterMs > 0) void reply.header("retry-after", Math.ceil(result.retryAfterMs / 1000));
        throw new ApiError({
          code: "unauthorized",
          statusCode: 401,
          message: "That email and password do not match",
        });
      }
      setSessionCookie({ reply, sessionId: result.sessionId, secure: config.secureCookies });
      return { mode: "password", user: result.user, via: "session" } satisfies AuthStatus;
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const { service } = requirePasswordMode(options);
    const principal = request.principal;
    if (principal?.kind === "session") await service.logout(principal.sessionId);
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.patch("/account", { schema: { body: accountUpdateSchema } }, async (request) => {
    const { service } = requirePasswordMode(options);
    const principal = requireSession(request);
    try {
      const user = await service.updateAccount({ userId: principal.user.id, ...request.body });
      return { mode: "password", user, via: "session" } satisfies AuthStatus;
    } catch (error) {
      if (error instanceof AuthInputError)
        throw new ApiError({ code: "validation_failed", statusCode: 400, message: error.message });
      throw error;
    }
  });

  app.post("/account/sign-out-others", async (request, reply) => {
    const { service } = requirePasswordMode(options);
    const principal = requireSession(request);
    await service.signOutOtherSessions(principal.user.id, principal.sessionId);
    return reply.status(204).send();
  });

  app.get("/api-tokens", async () => ({
    tokens: await requirePasswordMode(options).service.listApiTokens(),
  }));

  app.post("/api-tokens", { schema: { body: createApiTokenRequestSchema } }, async (request) => {
    const { service } = requirePasswordMode(options);
    requireSession(request);
    const expiresAt = request.body.expiresInDays
      ? new Date(Date.now() + request.body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    return service.createApiToken({ name: request.body.name, expiresAt });
  });

  app.delete(
    "/api-tokens/:tokenId",
    { schema: { params: z.object({ tokenId: z.string().min(1).max(40) }) } },
    async (request, reply) => {
      const { service } = requirePasswordMode(options);
      requireSession(request);
      if (!(await service.revokeApiToken(request.params.tokenId)))
        throw new ApiError({ code: "not_found", statusCode: 404, message: "No such token" });
      return reply.status(204).send();
    },
  );
};
