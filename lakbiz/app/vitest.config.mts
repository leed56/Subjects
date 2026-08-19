import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Phase 22 — first test infrastructure this project has had. Deliberately
 * minimal: no jsdom/browser environment (this sandbox has never had a
 * browser, and the highest-value first targets — job-profitability.ts,
 * income-tax.ts — are plain TypeScript functions with zero DOM/React
 * dependency), just the "@/" path alias mirrored from tsconfig.json so
 * test files can import app modules the same way the app itself does.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
