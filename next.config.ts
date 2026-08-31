import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM database drivers must stay outside the bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
