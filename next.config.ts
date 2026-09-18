import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@moss-dev/moss", "@moss-dev/moss-core", "pdf-parse"],
};

export default nextConfig;