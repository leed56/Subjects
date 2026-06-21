import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ADMIN_ONLY: process.env.NEXT_PUBLIC_ADMIN_ONLY ?? "true",
  },
};

export default nextConfig;
