import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Общие инструкции уже ведём в AGENTS.md; запуск сайта не должен менять этот файл.
  agentRules: false,
  // Самодостаточная сборка для Docker: .next/standalone + server.js
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
