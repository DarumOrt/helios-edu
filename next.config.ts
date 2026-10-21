import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Самодостаточная сборка для Docker: .next/standalone + server.js
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
