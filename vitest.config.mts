import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    // PGlite bootstraps a Postgres image on first use; the tenant suite needs
    // more than the default per-hook budget on a cold run.
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
