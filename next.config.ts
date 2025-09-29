import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/convex': require('path').resolve(__dirname, 'convex'),
    };
    return config;
  },
};

export default nextConfig;
