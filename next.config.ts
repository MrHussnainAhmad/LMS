import type { NextConfig } from "next";

const buildId = Date.now().toString();

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  /* config options here */
};

export default nextConfig;
