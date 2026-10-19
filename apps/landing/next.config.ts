import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The repo's own CLAUDE.md is the agent guide.
  agentRules: false,
  devIndicators: false,
  // Workspace packages ship TypeScript source (docs/decisions/0002).
  transpilePackages: ["@cutroom/observability"],
  // Node-only logging and tracing stay out of the server bundle.
  serverExternalPackages: ["pino", "@sentry/node"],
};

export default nextConfig;
