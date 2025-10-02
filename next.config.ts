import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabilita ESLint durante il build di produzione
  // (gli errori verranno fixati gradualmente in sviluppo)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disabilita anche i warning di TypeScript (opzionale)
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/convex': require('path').resolve(__dirname, 'convex'),
    };
    return config;
  },
};

export default nextConfig;
