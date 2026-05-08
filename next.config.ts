import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // 👇 AGREGA ESTO
  allowedDevOrigins: [
    "*.trycloudflare.com",
  ],
};

export default nextConfig;