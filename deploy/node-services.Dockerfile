# The API and the worker: Node 22, ffmpeg, and the Chrome Headless Shell Remotion renders with
# (also used for read-only screen capture). Workspace packages ship TypeScript source and run
# with tsx (docs/decisions/0002), so there is no build step.
#   docker build -f deploy/node-services.Dockerfile -t cutroom-node .
#   docker run cutroom-node api      |      docker run cutroom-node worker
FROM node:22-bookworm-slim

# Remotion's Linux dependencies for Chrome Headless Shell (remotion.dev/docs/docker), ffmpeg for
# loudness and transcoding, and an emoji font so captions never render tofu.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg fonts-noto-color-emoji \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
    libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CUTROOM_DATA_DIR=/data
RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile \
  --filter "@cutroom/api..." --filter "@cutroom/worker..." --filter "@cutroom/db..."

# Download the browser at build time so the first render does not wait on (or fail without) the network.
RUN cd packages/renderer && node --input-type=module -e "import { ensureBrowser } from '@remotion/renderer'; await ensureBrowser();"
# Remotion looks for its download next to the nearest package.json of the working directory, so a
# service started from apps/api would fetch it again. Point every caller (render, capture) at it.
ENV BROWSER_EXECUTABLE=/app/packages/renderer/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell
RUN test -x "$BROWSER_EXECUTABLE"

# Set after the install: pnpm skips devDependencies (tsx among them) under NODE_ENV=production.
ENV NODE_ENV=production API_HOST=0.0.0.0
VOLUME ["/data"]
COPY deploy/node-services-entrypoint.sh /usr/local/bin/cutroom-service
ENTRYPOINT ["cutroom-service"]
CMD ["api"]
