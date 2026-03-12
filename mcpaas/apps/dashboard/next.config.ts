import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mcpaas/kernel-connectors",
    "@mcpaas/kernel-datastore",
    "@mcpaas/kernel-registry",
    "@mcpaas/kernel-telemetry",
    "@mcpaas/kernel-types",
  ],
};

export default nextConfig;
