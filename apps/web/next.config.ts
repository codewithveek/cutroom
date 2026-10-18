import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The repo's own CLAUDE.md is the agent guide; the dev badge covers the sidebar's footer.
  agentRules: false,
  devIndicators: false,
  // Workspace packages ship TypeScript source (docs/decisions/0002).
  transpilePackages: ["@cutroom/scene-spec", "@cutroom/video-kit", "@cutroom/presets"],
};

export default nextConfig;
