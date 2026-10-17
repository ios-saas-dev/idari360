import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfmake → pdfkit → fontkit, çalışma zamanında kendi veri dosyalarını
  // (data.trie vb.) diskten okur; bundle edilirse bu yollar bozulur.
  serverExternalPackages: ['pdfmake', 'pdfkit', '@foliojs-fork/fontkit'],
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
