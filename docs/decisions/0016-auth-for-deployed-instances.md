# 0016 · Auth for deployed instances: one seeded admin, server-side sessions, hashed tokens

- **Status:** accepted · 2026-10-18

## Context
PRD extension E7: a one-click deploy must never be open, and a laptop install must stay login-free. The API had no authentication; only the remote render API checked a bearer token.

## Decision
- **Mode from the bind address.** `CUTROOM_AUTH_MODE` defaults to `none` on loopback and `password` elsewhere. `resolveAuthConfig` runs in the API before it opens a port and refuses `none` on a public address, a password under 12 characters or a session secret under 32 bytes. It is not in the shared env schema, because the Temporal worker serves no HTTP and should not need admin settings.
- **One admin seeded from env** (as Grafana does), not a first-visitor wizard, so a fresh deploy cannot be claimed by a stranger. argon2id via `@node-rs/argon2` at OWASP's minimum (19 MiB, t=2, p=1). Env changes are ignored after the first boot unless `CUTROOM_ADMIN_RESET=true`, which also ends every session.
- **Server-side sessions.** The cookie carries a 256-bit id, signed with `CUTROOM_SESSION_SECRET` (`@fastify/cookie`); the store keeps only its SHA-256. `HttpOnly`, `Secure` off loopback, `SameSite=Lax`, 7-day rolling expiry, a new id on every login.
- **Stores.** Postgres (`users`, `sessions`, `api_tokens`, migration 0003) when `RUN_STORE=postgres`, else `auth.json` in the data directory, written atomically through one queue.
- **CSRF.** Cookie-authenticated non-GET requests, and logins, must carry an `Origin` equal to `CUTROOM_PUBLIC_URL`, or else to the host the web app's proxy received the request on (`x-forwarded-host`). One-click deploys learn their URL after creation, so requiring the variable would break the button. A cross-site page cannot set `x-forwarded-host`: a custom header needs a CORS preflight, which the proxy does not answer.
- **The API is the boundary.** One `onRequest` hook protects every route but `/health`, `POST /auth/login` and `GET /auth/me`; the web app only redirects to `/login` when a call returns 401.
- **Login protection.** `@fastify/rate-limit` (5 per minute per IP and email, after body parsing), exponential backoff per email from the fifth failure, one message for every failure, a dummy hash for unknown emails, failures logged without the password. `trustProxy` is on off loopback, so the limit sees the client's IP.
- **API tokens** `ctr_<256 bits>`, shown once, stored as SHA-256 with `last_used_at`, optional expiry, revocable. Accepted everywhere a session is, and by the remote render API.
- Dependencies are pinned to releases at least two weeks old: `@fastify/cookie` 11.1.2, `@fastify/helmet` 13.1.1, `@fastify/rate-limit` 11.2.0, `@node-rs/argon2` 2.2.1.

## Consequences
- The rate limit and backoff live in memory: correct for one API instance, per-instance if scaled out.
- No sign-up, roles, SSO, email reset or 2FA (out of scope); moving to a full auth library is the upgrade path when teams arrive.
