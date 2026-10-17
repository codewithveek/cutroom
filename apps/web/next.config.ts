import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source (docs/decisions/0002).
  transpilePackages: ["@cutroom/scene-spec", "@cutroom/video-kit", "@cutroom/presets"],
};

export default nextConfig;
