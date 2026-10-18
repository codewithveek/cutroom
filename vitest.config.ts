import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The web app's `@/` path alias (apps/web/tsconfig.json), for its unit tests.
    alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") },
  },
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}", "evals/**/*.test.ts"],
    testTimeout: 30_000,
    environment: "node",
  },
});
