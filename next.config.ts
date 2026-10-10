import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  logging: { incomingRequests: false },
  serverExternalPackages: [],
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
};
export default config;
