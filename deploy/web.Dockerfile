# The Next.js app. NEXT_PUBLIC_API_URL is read at build time, so pass the API's public URL:
#   docker build -f deploy/web.Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t cutroom-web .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cutroom/web..."
ARG NEXT_PUBLIC_API_URL=http://localhost:4100
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @cutroom/web build

FROM node:22-bookworm-slim
# No pnpm here: corepack would download it on every start. Run Next's own binary instead.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["sh", "-c", "exec node_modules/.bin/next start -p ${PORT}"]
