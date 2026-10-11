import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tfxglvosqhiidyjhfyav.supabase.co',
      },
    ],
  },
};

export default nextConfig;
