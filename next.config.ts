import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      // demo listing photos from scripts/seed-demo.mjs
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
