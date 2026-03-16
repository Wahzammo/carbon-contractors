import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MCP route needs Node.js runtime for WebStandardStreamableHTTPServerTransport
  // and crypto module. Do not use edge runtime.
  experimental: {},
};

export default nextConfig;
