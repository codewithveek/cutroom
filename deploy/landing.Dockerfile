# The cutroom.tech landing page (apps/landing): static pages plus the waitlist route.
#   docker build -f deploy/landing.Dockerfile -t cutroom-landing .
#   docker run -e DATABASE_URL=postgres://… -p 3000:3000 cutroom-landing
# NEXT_PUBLIC_DEV_POST_URL (build arg) adds the DEV post links to the nav and footer.
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cutroom/landing..."
ARG NEXT_PUBLIC_DEV_POST_URL=
ENV NEXT_PUBLIC_DEV_POST_URL=$NEXT_PUBLIC_DEV_POST_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @cutroom/landing build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app /app
WORKDIR /app/apps/landing
EXPOSE 3000
CMD ["sh", "-c", "exec node_modules/.bin/next start -p ${PORT}"]
