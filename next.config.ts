import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server only trusts localhost by default; without this, opening the app via
  // 127.0.0.1 or the LAN IP blocks dev assets, so the page never hydrates and sits on its loader.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
