# The Next.js app. It reaches the API through its own /cutroom-api proxy, at CUTROOM_API_URL read at
# runtime, so one image fits every deploy:
#   docker build -f deploy/web.Dockerfile -t cutroom-web .
#   docker run -e CUTROOM_API_URL=http://api:4100 -p 3000:3000 cutroom-web
# (--build-arg NEXT_PUBLIC_API_URL=https://api.example.com makes the browser call the API directly.)
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cutroom/web..."
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @cutroom/web build

FROM node:22-bookworm-slim
# No pnpm here: corepack would download it on every start. Run Next's own binary instead.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["sh", "-c", "exec node_modules/.bin/next start -p ${PORT}"]
