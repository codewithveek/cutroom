import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}", "evals/**/*.test.ts"],
    testTimeout: 30_000,
    environment: "node",
  },
});
