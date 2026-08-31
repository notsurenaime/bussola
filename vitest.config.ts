import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // PGlite bootstraps a Postgres image on first use; the tenant suite needs
    // more than the default per-hook budget on a cold run.
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
